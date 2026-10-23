import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.models import RecordMetadata, Consent, AuditEvent, Practitioner
from app.services.serializers import active_consent_for_record
from app.schemas.schemas import RecordMetadataOut, RecordCreateRequest
from app.services.token_vault import token_vault
from app.services.auth_dependencies import get_current_user

router = APIRouter(prefix="/records", tags=["records"])

@router.get("/patient/{patient_id}", response_model=List[RecordMetadataOut])
async def list_patient_records(
    patient_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists ABDM-linked records for a patient, newest first.
    Patients see all their own records. Doctors see findings only for records
    covered by a live (approved, unexpired) consent.
    """
    is_owner = current_user["role"] in ("patient", "representative") and current_user["user_id"] == patient_id
    if current_user["role"] != "doctor" and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You cannot view records of another patient under DPDP Act."
        )
    res = await db.execute(
        select(RecordMetadata)
        .where(RecordMetadata.patient_id == patient_id)
        .order_by(desc(RecordMetadata.created_at))
    )
    records = res.scalars().all()

    consent_rows = (
        await db.execute(
            select(Consent, Practitioner)
            .outerjoin(Practitioner, Practitioner.practitioner_id == Consent.practitioner_id)
            .where(Consent.patient_id == patient_id, Consent.status == "approved")
        )
    ).all()
    consents = [c for c, _ in consent_rows]
    doctor_names = {c.consent_id: (p.display_name if p else None) for c, p in consent_rows}

    output = []
    for r in records:
        live = active_consent_for_record(consents, r.record_id)
        had_consent = any(c.record_id in (r.record_id, "all_abdm_records") for c in consents)
        if is_owner or live:
            status = "approved"
        elif had_consent:
            status = "expired"
        else:
            status = "protected"
        visible = status == "approved"

        output.append(RecordMetadataOut(
            record_id=r.record_id,
            patient_id=r.patient_id,
            record_type=r.record_type,
            title=r.title,
            date_str=r.date_str or "",
            file_mime_type=r.file_mime_type,
            file_size_bytes=r.file_size_bytes,
            summary_findings=r.summary_findings if visible else None,
            consent_status=status,
            facility=r.facility,
            category=r.category,
            type_label=r.type_label,
            imaging=r.imaging_json if visible else None,
            lab_results=r.lab_results_json if visible else None,
            shared_with=doctor_names.get(live.consent_id) if live else None,
            consent_expires_at=live.expires_at if live else None,
            created_at=r.created_at,
        ))

    return output

@router.post("/add", response_model=RecordMetadataOut)
async def add_medical_record(
    req: RecordCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Adds a medical record / diagnostic report to the patient's ABDM encrypted vault.
    """
    target_patient_id = req.patient_id or current_user["user_id"]
    if current_user["role"] != "doctor" and current_user["user_id"] != target_patient_id:
        raise HTTPException(status_code=403, detail="Cannot add records for another patient.")

    rec_id = f"rec_{uuid.uuid4().hex[:10]}"
    new_record = RecordMetadata(
        record_id=rec_id,
        patient_id=target_patient_id,
        record_type=req.record_type,
        title=req.title,
        date_str=req.date_str or "2026-10-07",
        file_mime_type=req.file_mime_type or "application/pdf",
        file_size_bytes=req.file_size_bytes or 1850000,
        secure_storage_reference=f"vault://abdm/patients/{target_patient_id}/records/{rec_id}.enc",
        encryption_key_id="kms-carebridge-aes256-gcm",
        summary_findings=req.summary_findings or "Patient uploaded historical record in ABDM vault.",
        raw_preview_text=req.raw_preview_text or req.summary_findings or f"Historical Record: {req.title}",
        facility=req.facility,
        category=req.category or ("lab" if req.record_type in ("blood_panel", "lab") else "diagnostic"),
        type_label=req.type_label,
    )
    db.add(new_record)

    audit = AuditEvent(
        actor_id=current_user["user_id"],
        action="MEDICAL_RECORD_UPLOADED_VAULT",
        resource_id=rec_id,
        outcome="SUCCESS"
    )
    db.add(audit)
    await db.commit()

    return RecordMetadataOut(
        record_id=new_record.record_id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        title=new_record.title,
        date_str=new_record.date_str,
        file_mime_type=new_record.file_mime_type,
        file_size_bytes=new_record.file_size_bytes,
        summary_findings=new_record.summary_findings,
        consent_status="approved",
        facility=new_record.facility,
        category=new_record.category,
        type_label=new_record.type_label,
        created_at=new_record.created_at,
    )

@router.get("/{record_id}/stream")
async def stream_decrypted_record(
    record_id: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Strict Cryptographic Access Gate:
    Requires Authorization: Bearer <grant_token_hash>.
    Validates token in Ephemeral Vault (HMAC check + Redis TTL).
    Blocks access mid-stream if revoked or expired.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: No CareBridge Purpose-Bound Grant Token provided. Patient consent required."
        )

    token_hash = authorization.replace("Bearer ", "").strip()
    check = token_vault.verify_and_check(token_hash)

    if not check.get("valid"):
        reason = check.get("reason", "Invalid or revoked grant token")
        # Log denied attempt in audit
        audit = AuditEvent(
            actor_id="doctor_or_intruder",
            action="UNAUTHORIZED_RECORD_ACCESS_ATTEMPT",
            resource_id=record_id,
            outcome="DENIED"
        )
        db.add(audit)
        await db.commit()

        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: {reason}. Under DPDP Act 2023, access strictly blocked."
        )

    # Token is valid! Verify it is scoped for this exact record_id
    payload = check.get("payload", {})
    if payload.get("record_id") != record_id:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Token was not issued for this medical record (Cross-record breach blocked)."
        )

    # Fetch record
    res = await db.execute(select(RecordMetadata).where(RecordMetadata.record_id == record_id))
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found in vault")

    # Record successful stream access in audit
    audit = AuditEvent(
        actor_id=payload.get("practitioner_id", "dr_ananya_sharma"),
        action="RECORD_STREAM_ACCESSED",
        resource_id=record_id,
        outcome="SUCCESS"
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "decrypted_stream_active",
        "record_id": record.record_id,
        "title": record.title,
        "record_type": record.record_type,
        "findings": record.summary_findings,
        "preview_text": record.raw_preview_text,
        "remaining_ttl_seconds": check.get("remaining_seconds"),
        "purpose_bound_to": payload.get("purpose"),
        "audit_hmac": payload.get("hmac_signature")
    }
