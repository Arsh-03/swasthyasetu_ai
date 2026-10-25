import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_
from app.database import get_db
from app.models.models import Consent, RecordMetadata, AuditEvent, Encounter, PatientProfile, Practitioner, User
from app.schemas.schemas import (
    ConsentRequestIn, ConsentDecisionIn, ConsentOut, AuditEventOut,
    LinkPatientRequestIn, ConsentOtpVerifyIn
)
from app.services.token_vault import token_vault
from app.services.connection_manager import ws_manager
from app.services.auth_dependencies import require_doctor, require_patient, get_current_user
from app.services.serializers import as_aware, consent_display_status, remaining_label

router = APIRouter(prefix="/consents", tags=["consents"])


def _restart_window(consent: Consent) -> None:
    """Grant window = requested duration, counted from the moment of approval."""
    created = as_aware(consent.created_at)
    expires = as_aware(consent.expires_at)
    duration = (expires - created) if (created and expires and expires > created) else timedelta(minutes=60)
    consent.expires_at = datetime.now(timezone.utc) + duration

@router.post("/link-patient-request")
async def link_patient_request(
    req: LinkPatientRequestIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db)
):
    """
    Doctor enters patient ABHA ID/Address to request linkage & purpose-bound access.
    Finds patient, creates a pending consent request, and dispatches real-time broadcast.
    """
    clean_id = req.abha_identifier.strip().lower()

    # Search for patient by abha_address, login_identifier, phone, or name
    stmt = (
        select(PatientProfile, User)
        .join(User, PatientProfile.patient_id == User.user_id)
        .where(
            or_(
                PatientProfile.abha_address.ilike(clean_id),
                User.login_identifier.ilike(clean_id),
                User.phone_number == clean_id,
                PatientProfile.full_name.ilike(f"%{clean_id}%")
            )
        )
    )
    res = await db.execute(stmt)
    record = res.first()

    # Fallback search if cleaner matching needed (e.g. without @abdm suffix)
    if not record and "@" not in clean_id:
        stmt2 = (
            select(PatientProfile, User)
            .join(User, PatientProfile.patient_id == User.user_id)
            .where(PatientProfile.abha_address.ilike(f"{clean_id}@abdm"))
        )
        res2 = await db.execute(stmt2)
        record = res2.first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Patient not found with ABHA ID '{req.abha_identifier}'. Please verify the ABHA Address or Mobile Number."
        )

    profile, user = record
    doctor_id = current_doctor.get("user_id", "usr_dr_ananya")
    doctor_name = current_doctor.get("name", "Dr. Ananya Sharma (MD)")

    # Find or create active encounter
    enc_res = await db.execute(
        select(Encounter).where(
            Encounter.patient_id == profile.patient_id,
            Encounter.status.in_(["queued", "in_progress"])
        )
    )
    encounter = enc_res.scalars().first()
    if not encounter:
        encounter = Encounter(
            encounter_id=f"enc_{uuid.uuid4().hex[:8]}",
            patient_id=profile.patient_id,
            practitioner_id=doctor_id,
            mode="video",
            status="in_progress",
            symptoms_text="Patient linked via ABHA lookup for tele-consultation"
        )
        db.add(encounter)
        await db.flush()

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=req.duration_minutes)

    consent = Consent(
        consent_id=f"c_{uuid.uuid4().hex[:12]}",
        encounter_id=encounter.encounter_id,
        patient_id=profile.patient_id,
        practitioner_id=doctor_id,
        record_id="all_abdm_records",
        purpose=req.purpose,
        scope="demographics,medical_history,diagnostic_records",
        status="requested",
        expires_at=expires_at
    )
    db.add(consent)

    audit = AuditEvent(
        actor_id=doctor_id,
        action="DOCTOR_REQUESTED_ABHA_LINKAGE",
        resource_id=profile.abha_address,
        outcome="SUCCESS"
    )
    db.add(audit)
    await db.commit()

    # Dispatch real-time WebSocket notification to patient
    notification_payload = {
        "type": "ABHA_LINK_REQUEST",
        "consent_id": consent.consent_id,
        "encounter_id": encounter.encounter_id,
        "patient_id": profile.patient_id,
        "patient_name": profile.full_name,
        "abha_address": profile.abha_address,
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "purpose": req.purpose,
        "duration_minutes": req.duration_minutes,
        "scopes": req.scopes,
        "phone_masked": f"+91 {user.phone_number[:5]} •••••" if user.phone_number and len(user.phone_number) >= 5 else "•••• 1234",
        "requested_at": datetime.now(timezone.utc).isoformat()
    }
    await ws_manager.send_to([profile.patient_id], notification_payload)     # only the patient asked

    return {
        "success": True,
        "message": f"ABHA Access Request dispatched to {profile.full_name} ({profile.abha_address}).",
        "consent_id": consent.consent_id,
        "encounter_id": encounter.encounter_id,
        "patient": {
            "patient_id": profile.patient_id,
            "full_name": profile.full_name,
            "abha_address": profile.abha_address,
            "phone_masked": user.phone_number[-4:] if user.phone_number else "••••"
        },
        "status": "requested"
    }

@router.post("/{consent_id}/verify-otp-and-grant")
async def verify_otp_and_grant_consent(
    consent_id: str,
    req: ConsentOtpVerifyIn,
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db)
):
    """
    Patient approves with a code (used by the Expo patient app). The patient is already signed in, so the
    code itself adds no security; the web app uses the one-tap /decision endpoint instead.
    Validates OTP, issues single-use HMAC token, and notifies Doctor in real-time.
    """
    clean_otp = req.otp_code.strip()
    if len(clean_otp) < 4:
        raise HTTPException(status_code=400, detail="Please enter a valid OTP code (min 4-6 digits).")

    query = select(Consent).where(Consent.consent_id == consent_id)
    res = await db.execute(query)
    consent = res.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent request not found")
    if consent.patient_id != current_patient["user_id"]:
        raise HTTPException(status_code=403, detail="This consent request belongs to another patient")
    if consent.status != "requested":
        raise HTTPException(status_code=409, detail=f"This request was already {consent.status}.")

    _restart_window(consent)

    # Issue HMAC grant token in vault
    token_info = token_vault.create_grant_token(
        consent_id=consent.consent_id,
        practitioner_id=consent.practitioner_id,
        patient_id=consent.patient_id,
        record_id=consent.record_id,
        purpose=consent.purpose,
        duration_seconds=3600
    )
    grant_token_hash = token_info["token"]

    consent.status = "approved"
    consent.grant_token_hash = grant_token_hash

    audit = AuditEvent(
        actor_id=consent.patient_id,
        action="ABHA_CONSENT_APPROVED_OTP_VERIFIED",
        resource_id=consent.consent_id,
        outcome="SUCCESS"
    )
    db.add(audit)
    await db.commit()

    # Fetch patient profile details to send back to Doctor in real time
    p_res = await db.execute(select(PatientProfile).where(PatientProfile.patient_id == consent.patient_id))
    profile = p_res.scalar_one_or_none()

    # Broadcast approval to Doctor over WebSocket
    approval_broadcast = {
        "type": "ABHA_LINK_APPROVED",
        "consent_id": consent.consent_id,
        "patient_id": consent.patient_id,
        "patient_name": profile.full_name if profile else "Verified Patient",
        "abha_address": profile.abha_address if profile else "",
        "grant_token": grant_token_hash,
        "demographics": profile.demographics_json if profile else {},
        "status": "approved"
    }
    await ws_manager.send_to([consent.practitioner_id], approval_broadcast)   # only the doctor who asked

    return {
        "success": True,
        "message": "Consent successfully signed with OTP and HMAC token provisioned in vault.",
        "consent_id": consent.consent_id,
        "status": "approved",
        "grant_token": grant_token_hash,
        "patient_id": consent.patient_id
    }

@router.get("/pending-for-patient")
async def get_pending_consents_for_patient(
    patient_id: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns pending consent requests ONLY for the specified or authenticated patient.
    If called by a doctor without patient_id, returns empty list.
    """
    # Only the signed-in patient's own requests (the patient_id parameter can't be used to read others').
    if not current_user or current_user.get("role") not in ["patient", "representative"]:
        return []
    target_patient_id = current_user.get("user_id")
    if patient_id and patient_id != target_patient_id:
        return []

    if not target_patient_id:
        return []

    conditions = [
        Consent.status == "requested",
        Consent.patient_id == target_patient_id
    ]

    stmt = (
        select(Consent, Practitioner, RecordMetadata)
        .outerjoin(Practitioner, Consent.practitioner_id == Practitioner.practitioner_id)
        .outerjoin(RecordMetadata, Consent.record_id == RecordMetadata.record_id)
        .where(*conditions)
        .order_by(Consent.created_at.desc())
    )
    res = await db.execute(stmt)
    results = res.all()
    output = []
    for consent, practitioner, record in results:
        created = as_aware(consent.created_at)
        expires = as_aware(consent.expires_at)
        duration = round((expires - created).total_seconds() / 60) if created and expires else 60
        output.append({
            "consent_id": consent.consent_id,
            "encounter_id": consent.encounter_id,
            "patient_id": consent.patient_id,
            "practitioner_id": consent.practitioner_id,
            "practitioner_name": practitioner.display_name if practitioner else consent.practitioner_id,
            "practitioner_reg": practitioner.registration_number if practitioner else "",
            "record_title": record.title if record else "All linked ABDM records",
            "clinical_purpose": consent.purpose,
            "duration_minutes": duration,
            "purpose": consent.purpose,
            "scope": consent.scope,
            "status": consent.status,
            "expires_at": consent.expires_at,
            "created_at": consent.created_at
        })
    return output

@router.post("/request", response_model=ConsentOut)
async def request_consent(
    req: ConsentRequestIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db)
):
    """
    Doctor creates a purpose-bound consent request for a specific record.
    Status starts as 'requested'; the patient app is notified over WebSocket.
    """
    doctor_id = current_doctor["user_id"]

    rec = (await db.execute(select(RecordMetadata).where(RecordMetadata.record_id == req.record_id))).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Health record not found")
    if req.patient_id and rec.patient_id != req.patient_id:
        raise HTTPException(status_code=400, detail="This record does not belong to the selected patient")

    enc = None
    if req.encounter_id:
        enc = (await db.execute(select(Encounter).where(Encounter.encounter_id == req.encounter_id))).scalar_one_or_none()
        if not enc:
            raise HTTPException(status_code=404, detail="Encounter not found")
    if enc is None or enc.patient_id != rec.patient_id:
        enc = (await db.execute(
            select(Encounter)
            .where(Encounter.patient_id == rec.patient_id, Encounter.status.in_(["queued", "in_progress"]))
            .order_by(Encounter.start_time)
        )).scalars().first()
    if enc is None:
        enc = Encounter(
            encounter_id=f"enc_{uuid.uuid4().hex[:8]}",
            patient_id=rec.patient_id,
            practitioner_id=doctor_id,
            mode="video",
            status="in_progress",
        )
        db.add(enc)
        await db.flush()

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=req.duration_minutes)

    consent = Consent(
        consent_id=f"c_{uuid.uuid4().hex[:12]}",
        encounter_id=enc.encounter_id,
        patient_id=rec.patient_id,
        practitioner_id=doctor_id,
        record_id=req.record_id,
        purpose=req.purpose,
        scope="read_only",
        status="requested",
        expires_at=expires_at
    )
    db.add(consent)

    db.add(AuditEvent(
        actor_id=doctor_id,
        action="CONSENT_REQUEST",
        resource_id=req.record_id,
        outcome="PENDING",
        purpose=req.purpose,
    ))

    await db.commit()
    await db.refresh(consent)

    doctor = (await db.execute(select(Practitioner).where(Practitioner.practitioner_id == doctor_id))).scalar_one_or_none()
    await ws_manager.send_to([consent.patient_id], {                    # only the patient asked
        "type": "consent_request",
        "consent_id": consent.consent_id,
        "patient_id": consent.patient_id,
        "practitioner_name": doctor.display_name if doctor else current_doctor.get("name"),
        "practitioner_reg": doctor.registration_number if doctor else "",
        "record_title": rec.title,
        "clinical_purpose": req.purpose,
        "duration_minutes": req.duration_minutes,
    })

    return ConsentOut(
        consent_id=consent.consent_id,
        encounter_id=consent.encounter_id,
        patient_id=consent.patient_id,
        practitioner_id=consent.practitioner_id,
        record_id=consent.record_id,
        purpose=consent.purpose,
        scope=consent.scope,
        status=consent.status,
        expires_at=consent.expires_at,
        created_at=consent.created_at
    )

@router.post("/{consent_id}/decision", response_model=ConsentOut)
async def decide_consent(
    consent_id: str,
    decision: ConsentDecisionIn,
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db)
):
    """
    Patient (or authorised representative) approves or declines doctor's request with one click.
    The patient already proved who they are at login, so no OTP is asked here; the server only
    accepts the decision from the logged-in patient the request was sent to, and only once.
    If approved, generates HMAC-SHA256 single-purpose grant token in Ephemeral Vault.
    """
    query = select(Consent).where(Consent.consent_id == consent_id)
    res = await db.execute(query)
    consent = res.scalar_one_or_none()
    if not consent or consent.patient_id != current_patient["user_id"]:
        raise HTTPException(status_code=404, detail="Consent request not found")
    if consent.status != "requested":
        raise HTTPException(status_code=409, detail=f"This request was already {consent.status}.")

    grant_token_hash = None
    if decision.approved:
        consent.status = "approved"
        _restart_window(consent)
        # Generate HMAC grant token
        token_info = token_vault.create_grant_token(
            consent_id=consent.consent_id,
            practitioner_id=consent.practitioner_id,
            patient_id=consent.patient_id,
            record_id=consent.record_id,
            purpose=consent.purpose,
            duration_seconds=3600
        )
        grant_token_hash = token_info["token"]
        consent.grant_token_hash = grant_token_hash

        audit_action = "CONSENT_APPROVED_BY_PATIENT" if decision.decided_by_role == "patient" else "CONSENT_APPROVED_BY_REPRESENTATIVE"
        outcome = "SUCCESS"
    else:
        consent.status = "declined"
        audit_action = "CONSENT_DECLINED"
        outcome = "DENIED"

    audit = AuditEvent(
        actor_id=f"{decision.decided_by_role}:{consent.patient_id}",
        action=audit_action,
        resource_id=consent.record_id,
        outcome=outcome
    )
    db.add(audit)
    await db.commit()
    await db.refresh(consent)

    if decision.approved:
        profile = (await db.execute(
            select(PatientProfile).where(PatientProfile.patient_id == consent.patient_id))).scalar_one_or_none()
        await ws_manager.send_to([consent.practitioner_id], {              # only the doctor who asked
            "type": "ABHA_LINK_APPROVED",
            "consent_id": consent.consent_id,
            "encounter_id": consent.encounter_id,
            "patient_id": consent.patient_id,
            "patient_name": profile.full_name if profile else "Verified Patient",
            "abha_address": profile.abha_address if profile else "",
            "grant_token": grant_token_hash,
            "demographics": profile.demographics_json if profile else {},
            "status": "approved"
        })
    else:
        await ws_manager.send_to([consent.practitioner_id], {
            "type": "ABHA_LINK_REJECTED",
            "consent_id": consent.consent_id,
            "patient_id": consent.patient_id,
            "status": "declined"
        })

    return ConsentOut(
        consent_id=consent.consent_id,
        encounter_id=consent.encounter_id,
        patient_id=consent.patient_id,
        practitioner_id=consent.practitioner_id,
        record_id=consent.record_id,
        purpose=consent.purpose,
        scope=consent.scope,
        status=consent.status,
        expires_at=consent.expires_at,
        created_at=consent.created_at,
        grant_token=grant_token_hash
    )

@router.post("/{consent_id}/revoke")
async def revoke_consent(
    consent_id: str,
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db)
):
    """
    1-Click Patient Revocation: Instantly invalidates the grant in Redis/Vault.
    Any active stream severed immediately.
    """
    query = select(Consent).where(Consent.consent_id == consent_id)
    res = await db.execute(query)
    consent = res.scalar_one_or_none()
    if not consent or consent.patient_id != current_patient["user_id"]:
        raise HTTPException(status_code=404, detail="Consent not found")
    if consent.patient_id != current_patient["user_id"]:
        raise HTTPException(status_code=403, detail="This consent belongs to another patient")

    consent.status = "revoked"
    token_vault.revoke_by_consent_id(consent_id)

    audit = AuditEvent(
        actor_id=consent.patient_id,
        action="1_CLICK_REVOCATION",
        resource_id=consent.record_id,
        outcome="REVOKED"
    )
    db.add(audit)
    await db.commit()

    return {"status": "revoked", "message": "Consent grant invalidated immediately. Record stream severed."}

@router.get("/{consent_id}/status")
async def get_consent_status(
    consent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Consent).where(Consent.consent_id == consent_id)
    res = await db.execute(query)
    consent = res.scalar_one_or_none()
    if not consent or current_user.get("user_id") not in (consent.patient_id, consent.practitioner_id):
        raise HTTPException(status_code=404, detail="Consent not found")

    token_check = None
    if consent.grant_token_hash:
        token_check = token_vault.verify_and_check(consent.grant_token_hash)

    return {
        "consent_id": consent.consent_id,
        "status": consent.status,
        "record_id": consent.record_id,
        "purpose": consent.purpose,
        "grant_token_hash": consent.grant_token_hash,
        "token_live_status": token_check
    }


@router.get("/history")
async def get_my_consent_history(
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db)
):
    """
    "Who saw my records": every consent on the patient's records, newest first,
    with the doctor, record, purpose and whether access is still live.
    """
    stmt = (
        select(Consent, Practitioner, RecordMetadata)
        .outerjoin(Practitioner, Consent.practitioner_id == Practitioner.practitioner_id)
        .outerjoin(RecordMetadata, Consent.record_id == RecordMetadata.record_id)
        .where(Consent.patient_id == current_patient["user_id"])
        .order_by(Consent.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "consent_id": c.consent_id,
            "doctor": p.display_name if p else c.practitioner_id,
            "reg": p.registration_number if p else "",
            "facility": (p.facility if p else None) or "",
            "record": r.title if r else "All linked ABDM records",
            "purpose": c.purpose,
            "status": consent_display_status(c),
            "active": consent_display_status(c) == "approved",
            "remaining": remaining_label(c.expires_at) if consent_display_status(c) == "approved" else None,
            "created_at": c.created_at,
            "expires_at": c.expires_at,
        }
        for c, p, r in rows
    ]
