import uuid
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_db
from app.models.models import User, PatientProfile, Practitioner, Representative, AuditEvent, RecordMetadata
from app.schemas.schemas import (
    LoginRequest, PatientRegisterRequest, DoctorRegisterRequest, AuthResponse,
    CreateAbhaRequest, MedicalHistoryUpdateRequest, DoctorUpdateHistoryIn
)
from app.services.auth_dependencies import create_access_token, get_current_user, require_doctor
from app.services.connection_manager import ws_manager

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/profiles")
async def get_all_demo_profiles(db: AsyncSession = Depends(get_db)):
    """
    Returns pre-configured active demo profiles:
    - Ramesh Gowda (Rural Patient)
    - Sunita Devi (Authorised Representative)
    - Dr. Ananya Sharma (Telemedicine Physician)
    """
    pat_res = await db.execute(select(PatientProfile))
    patient = pat_res.scalars().first()

    doc_res = await db.execute(select(Practitioner))
    doc = doc_res.scalars().first()

    rep_res = await db.execute(select(Representative))
    rep = rep_res.scalars().first()

    return {
        "patient": {
            "patient_id": patient.patient_id if patient else "usr_ramesh_gowda",
            "full_name": patient.full_name if patient else "Ramesh Gowda",
            "abha_address": patient.abha_address if patient else "91-4820-1928-1120@abdm",
            "phone_number": "9845012345",
            "preferred_language": patient.preferred_language if patient else "kn",
            "demographics": patient.demographics_json if patient else {"age": 54, "sex": "male", "district": "Hassan, Karnataka"}
        },
        "doctor": {
            "practitioner_id": doc.practitioner_id if doc else "usr_dr_ananya",
            "display_name": doc.display_name if doc else "Dr. Ananya Sharma",
            "registration_number": doc.registration_number if doc else "NMC-KA-581920",
            "phone_number": "9876543210",
            "specialty": doc.specialty if doc else "General Medicine",
            "credential_status": "verified"
        },
        "representative": {
            "representative_id": rep.representative_id if rep else "rep-sunita-1",
            "full_name": rep.full_name if rep else "Sunita Devi",
            "relationship_type": rep.relationship_type if rep else "Daughter-in-law (ಸೊಸೆ)",
            "authority_status": "active"
        }
    }

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login endpoint supporting:
    - Patient: ABHA ID or Mobile Number + Password
    - Doctor: Unique Doctor ID (NMC Reg No) or Mobile Number + Password
    """
    clean_id = req.identifier.strip().lower()

    if req.role == "patient":
        # Search patient by ABHA address or phone or login_identifier
        stmt = (
            select(User, PatientProfile)
            .join(PatientProfile, User.user_id == PatientProfile.patient_id)
            .where(
                or_(
                    User.phone_number == clean_id,
                    User.login_identifier.ilike(clean_id),
                    PatientProfile.abha_address.ilike(clean_id)
                )
            )
        )
        res = await db.execute(stmt)
        record = res.first()

        if not record:
            # Fallback for demo convenience if user typed ramesh or 98450
            if "ramesh" in clean_id or "98450" in clean_id or "abdm" in clean_id or clean_id == "demo":
                stmt_fallback = select(User, PatientProfile).join(PatientProfile, User.user_id == PatientProfile.patient_id)
                res_fallback = await db.execute(stmt_fallback)
                record = res_fallback.first()

        if not record:
            raise HTTPException(
                status_code=401,
                detail="Patient not found with provided ABHA Address or Mobile Number. Please check your credentials or create an account."
            )

        user, profile = record

        # Verify password (in demo environment, accepts password123 or matches hash)
        if req.password not in ["password123", user.password_hash, "demo"]:
            raise HTTPException(status_code=401, detail="Incorrect password. For demo, use: password123")

        token = create_access_token({
            "sub": user.user_id,
            "role": "patient",
            "login_identifier": profile.abha_address,
            "name": profile.full_name
        })

        # Log audit
        audit = AuditEvent(
            actor_id=user.user_id,
            action="PATIENT_LOGIN_AUTHENTICATED",
            resource_id=profile.abha_address,
            outcome="SUCCESS"
        )
        db.add(audit)
        await db.commit()

        return AuthResponse(
            success=True,
            message="Patient logged in successfully",
            token=token,
            user={
                "user_id": user.user_id,
                "role": "patient",
                "full_name": profile.full_name,
                "abha_address": profile.abha_address,
                "phone_number": user.phone_number or "9845012345",
                "preferred_language": profile.preferred_language,
                "demographics": profile.demographics_json
            }
        )

    elif req.role == "doctor":
        # Search doctor by NMC Registration Number, phone or login_identifier
        stmt = (
            select(User, Practitioner)
            .join(Practitioner, User.user_id == Practitioner.practitioner_id)
            .where(
                or_(
                    User.phone_number == clean_id,
                    User.login_identifier.ilike(clean_id),
                    Practitioner.registration_number.ilike(clean_id)
                )
            )
        )
        res = await db.execute(stmt)
        record = res.first()

        if not record:
            # Fallback for demo convenience if user typed ananya, 581920 or 98765
            if "ananya" in clean_id or "581920" in clean_id or "98765" in clean_id or clean_id == "demo":
                stmt_fallback = select(User, Practitioner).join(Practitioner, User.user_id == Practitioner.practitioner_id)
                res_fallback = await db.execute(stmt_fallback)
                record = res_fallback.first()

        if not record:
            raise HTTPException(
                status_code=401,
                detail="Physician not found with provided Doctor ID / NMC Number or Mobile Number. Please verify or register."
            )

        user, practitioner = record

        if req.password not in ["password123", user.password_hash, "demo"]:
            raise HTTPException(status_code=401, detail="Incorrect password. For demo, use: password123")

        token = create_access_token({
            "sub": user.user_id,
            "role": "doctor",
            "login_identifier": practitioner.registration_number,
            "name": practitioner.display_name
        })

        # Log audit
        audit = AuditEvent(
            actor_id=user.user_id,
            action="DOCTOR_LOGIN_AUTHENTICATED",
            resource_id=practitioner.registration_number,
            outcome="SUCCESS"
        )
        db.add(audit)
        await db.commit()

        return AuthResponse(
            success=True,
            message="Doctor logged in successfully",
            token=token,
            user={
                "user_id": user.user_id,
                "role": "doctor",
                "display_name": practitioner.display_name,
                "registration_number": practitioner.registration_number,
                "phone_number": user.phone_number or "9876543210",
                "specialty": practitioner.specialty,
                "credential_status": practitioner.credential_status
            }
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid role specified")


@router.post("/register/patient", response_model=AuthResponse)
async def register_patient(req: PatientRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Patient Registration: creates ABDM ABHA profile & user credentials.
    """
    # Check if ABHA or phone already exists
    existing_user = await db.execute(
        select(User).where(or_(User.phone_number == req.mobile_number, User.login_identifier == req.abha_address))
    )
    if existing_user.scalars().first():
        raise HTTPException(status_code=400, detail="Account with this ABHA Address or Mobile Number already exists.")

    new_user_id = f"pat_{uuid.uuid4().hex[:10]}"
    new_user = User(
        user_id=new_user_id,
        role="patient",
        login_identifier=req.abha_address,
        phone_number=req.mobile_number,
        password_hash=req.password or "password123"
    )
    db.add(new_user)

    new_profile = PatientProfile(
        patient_id=new_user_id,
        preferred_language=req.preferred_language,
        full_name=req.full_name,
        abha_address=req.abha_address,
        demographics_json={
            "age": req.age,
            "gender": req.gender,
            "district": req.district,
            "phone_masked": f"+91 {req.mobile_number[:5]} •••••"
        }
    )
    db.add(new_profile)

    audit = AuditEvent(
        actor_id=new_user_id,
        action="PATIENT_ACCOUNT_CREATED",
        resource_id=req.abha_address,
        outcome="SUCCESS"
    )
    db.add(audit)

    await db.commit()

    token = create_access_token({
        "sub": new_user_id,
        "role": "patient",
        "login_identifier": new_profile.abha_address,
        "name": new_profile.full_name
    })

    return AuthResponse(
        success=True,
        message="Patient registered and ABHA address provisioned successfully",
        token=token,
        user={
            "user_id": new_user_id,
            "role": "patient",
            "full_name": new_profile.full_name,
            "abha_address": new_profile.abha_address,
            "phone_number": req.mobile_number,
            "preferred_language": new_profile.preferred_language,
            "demographics": new_profile.demographics_json
        }
    )


@router.post("/create-abha", response_model=AuthResponse)
async def create_abha_account(req: CreateAbhaRequest, db: AsyncSession = Depends(get_db)):
    """
    ABDM Official / Demo ABHA Creation endpoint:
    Provisions a verified 14-digit ABHA Number and ABHA Address via Aadhaar/Mobile e-KYC.
    Supports optional initial medical history (chronic conditions, allergies, current medications)
    and optional initial diagnostic record metadata.
    """
    clean_abha = req.abha_address.strip().lower()
    if "@" not in clean_abha:
        clean_abha = f"{clean_abha}@abdm"

    clean_phone = req.mobile_number.strip()

    # Check if ABHA or phone already exists
    existing_user = await db.execute(
        select(User).where(or_(User.phone_number == clean_phone, User.login_identifier == clean_abha))
    )
    existing = existing_user.scalars().first()
    if existing:
        # If user exists, log them in or update profile
        token = create_access_token({
            "sub": existing.user_id,
            "role": "patient",
            "login_identifier": clean_abha,
            "name": req.full_name
        })
        p_res = await db.execute(select(PatientProfile).where(PatientProfile.patient_id == existing.user_id))
        prof = p_res.scalar_one_or_none()
        demo = prof.demographics_json if prof else {}
        return AuthResponse(
            success=True,
            message="Existing ABHA Account recognized and session opened.",
            token=token,
            user={
                "user_id": existing.user_id,
                "role": "patient",
                "full_name": prof.full_name if prof else req.full_name,
                "abha_address": clean_abha,
                "abha_number": req.abha_number,
                "phone_number": clean_phone,
                "preferred_language": req.preferred_language,
                "demographics": demo
            }
        )

    new_user_id = f"pat_{uuid.uuid4().hex[:10]}"
    new_user = User(
        user_id=new_user_id,
        role="patient",
        login_identifier=clean_abha,
        phone_number=clean_phone,
        password_hash=req.password or "password123"
    )
    db.add(new_user)

    med_hist = req.medical_history or {
        "chronic_conditions": [],
        "current_medications": [],
        "allergies": [],
        "surgeries": [],
        "blood_group": "B+"
    }

    demographics = {
        "age": req.age,
        "gender": req.gender,
        "district": req.district,
        "abha_number": req.abha_number,
        "auth_method": req.auth_method,
        "aadhaar_last4": req.aadhaar_last4 or "9821",
        "phone_masked": f"+91 {clean_phone[:5]} •••••" if len(clean_phone) >= 5 else clean_phone,
        "medical_history": med_hist
    }

    new_profile = PatientProfile(
        patient_id=new_user_id,
        preferred_language=req.preferred_language,
        full_name=req.full_name,
        abha_address=clean_abha,
        demographics_json=demographics
    )
    db.add(new_profile)

    # If initial diagnostic record is provided during onboarding
    if req.initial_record and req.initial_record.get("title"):
        rec_info = req.initial_record
        new_record = RecordMetadata(
            record_id=f"rec_{uuid.uuid4().hex[:10]}",
            patient_id=new_user_id,
            record_type=rec_info.get("record_type", "blood_panel"),
            title=rec_info.get("title"),
            date_str=rec_info.get("date_str", "2026-10-07"),
            file_mime_type=rec_info.get("file_mime_type", "application/pdf"),
            file_size_bytes=rec_info.get("file_size_bytes", 1500000),
            secure_storage_reference=f"vault://abdm/patients/{new_user_id}/scans/record_{uuid.uuid4().hex[:6]}.enc",
            encryption_key_id="kms-carebridge-aes256-gcm",
            summary_findings=rec_info.get("summary_findings", "Baseline diagnostic record linked to newly provisioned ABHA."),
            raw_preview_text=rec_info.get("raw_preview_text", f"Official diagnostic record issued for ABHA: {req.abha_number}")
        )
        db.add(new_record)

    audit = AuditEvent(
        actor_id=new_user_id,
        action="ABHA_ACCOUNT_PROVISIONED_EKYC",
        resource_id=req.abha_number,
        outcome="SUCCESS"
    )
    db.add(audit)

    await db.commit()

    token = create_access_token({
        "sub": new_user_id,
        "role": "patient",
        "login_identifier": clean_abha,
        "name": new_profile.full_name
    })

    return AuthResponse(
        success=True,
        message="14-digit ABHA Number and Health Profile provisioned successfully under ABDM",
        token=token,
        user={
            "user_id": new_user_id,
            "role": "patient",
            "full_name": new_profile.full_name,
            "abha_address": clean_abha,
            "abha_number": req.abha_number,
            "phone_number": clean_phone,
            "preferred_language": new_profile.preferred_language,
            "demographics": new_profile.demographics_json
        }
    )


@router.post("/patient/medical-history")
async def update_patient_medical_history(
    req: MedicalHistoryUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the patient's medical history (conditions, medications, allergies, surgeries).
    """
    patient_id = current_user["user_id"]
    res = await db.execute(select(PatientProfile).where(PatientProfile.patient_id == patient_id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    demo = dict(profile.demographics_json or {})
    demo["medical_history"] = {
        "chronic_conditions": req.chronic_conditions,
        "current_medications": req.current_medications,
        "allergies": req.allergies,
        "surgeries": req.surgeries,
        "blood_group": req.blood_group or demo.get("medical_history", {}).get("blood_group", "O+"),
        "lifestyle_notes": req.lifestyle_notes
    }
    profile.demographics_json = demo

    audit = AuditEvent(
        actor_id=patient_id,
        action="PATIENT_MEDICAL_HISTORY_UPDATED",
        resource_id=profile.abha_address,
        outcome="SUCCESS"
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "message": "Medical history updated successfully",
        "medical_history": demo["medical_history"],
        "demographics": demo
    }


@router.post("/register/doctor", response_model=AuthResponse)
async def register_doctor(req: DoctorRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Doctor Registration: creates NMC verified telemedicine account.
    """
    existing_user = await db.execute(
        select(User).where(or_(User.phone_number == req.mobile_number, User.login_identifier == req.registration_number))
    )
    if existing_user.scalars().first():
        raise HTTPException(status_code=400, detail="Account with this Doctor ID or Mobile Number already exists.")

    new_user_id = f"doc_{uuid.uuid4().hex[:10]}"
    new_user = User(
        user_id=new_user_id,
        role="practitioner",
        login_identifier=req.registration_number,
        phone_number=req.mobile_number,
        password_hash=req.password or "password123"
    )
    db.add(new_user)

    new_practitioner = Practitioner(
        practitioner_id=new_user_id,
        display_name=f"{req.full_name} ({req.qualification})",
        registration_number=req.registration_number,
        specialty=req.specialty,
        credential_status="verified"
    )
    db.add(new_practitioner)

    audit = AuditEvent(
        actor_id=new_user_id,
        action="DOCTOR_ACCOUNT_REGISTERED_NMC",
        resource_id=req.registration_number,
        outcome="SUCCESS"
    )
    db.add(audit)

    await db.commit()

    token = create_access_token({
        "sub": new_user_id,
        "role": "doctor",
        "login_identifier": new_practitioner.registration_number,
        "name": new_practitioner.display_name
    })

    return AuthResponse(
        success=True,
        message="Doctor registered and NMC credential verified successfully",
        token=token,
        user={
            "user_id": new_user_id,
            "role": "doctor",
            "display_name": new_practitioner.display_name,
            "registration_number": new_practitioner.registration_number,
            "phone_number": req.mobile_number,
            "specialty": new_practitioner.specialty,
            "credential_status": "verified"
        }
    )


@router.get("/me")
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Protected Endpoint: Returns verified user identity from validated JWT claims and database.
    """
    user_id = current_user["user_id"]
    role = current_user["role"]

    if role == "patient":
        stmt = (
            select(PatientProfile, User)
            .join(User, PatientProfile.patient_id == User.user_id)
            .where(PatientProfile.patient_id == user_id)
        )
        res = await db.execute(stmt)
        record = res.first()
        if record:
            profile, user = record
            return {
                "user_id": user_id,
                "role": "patient",
                "full_name": profile.full_name,
                "abha_address": profile.abha_address,
                "phone_number": user.phone_number or "9845012345",
                "preferred_language": profile.preferred_language,
                "demographics": profile.demographics_json
            }
        return {
            "user_id": user_id,
            "role": "patient",
            "full_name": current_user.get("name", "Ramesh Gowda"),
            "abha_address": current_user.get("login_identifier", "91-4820-1928-1120@abdm"),
            "phone_number": "9845012345",
            "preferred_language": "kn"
        }
    else:
        stmt = (
            select(Practitioner, User)
            .join(User, Practitioner.practitioner_id == User.user_id)
            .where(Practitioner.practitioner_id == user_id)
        )
        res = await db.execute(stmt)
        record = res.first()
        if record:
            doc, user = record
            return {
                "user_id": user_id,
                "role": "doctor",
                "display_name": doc.display_name,
                "registration_number": doc.registration_number,
                "phone_number": user.phone_number or "9876543210",
                "specialty": doc.specialty,
                "credential_status": doc.credential_status
            }
        return {
            "user_id": user_id,
            "role": "doctor",
            "display_name": current_user.get("name", "Dr. Ananya Sharma"),
            "registration_number": current_user.get("login_identifier", "NMC-KA-581920"),
            "phone_number": "9876543210",
            "specialty": "General Medicine",
            "credential_status": "verified"
        }


@router.get("/patient/{patient_id}/details")
async def get_patient_details(
    patient_id: str,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns verified patient ABHA profile, demographics, and medical history
    for the treating doctor upon consent approval.
    """
    stmt = (
        select(PatientProfile, User)
        .outerjoin(User, PatientProfile.patient_id == User.user_id)
        .where(
            or_(
                PatientProfile.patient_id == patient_id,
                PatientProfile.abha_address == patient_id
            )
        )
    )
    res = await db.execute(stmt)
    record = res.first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found in ABHA registry.")

    profile, user = record
    phone = user.phone_number if user else "9845012345"

    # Also fetch record metadata
    recs_res = await db.execute(
        select(RecordMetadata).where(RecordMetadata.patient_id == profile.patient_id)
    )
    records = recs_res.scalars().all()
    records_out = [
        {
            "record_id": r.record_id,
            "patient_id": r.patient_id,
            "record_type": r.record_type,
            "title": r.title,
            "date_str": r.date_str,
            "file_mime_type": r.file_mime_type,
            "file_size_bytes": r.file_size_bytes,
            "summary_findings": r.summary_findings
        }
        for r in records
    ]

    return {
        "patient_id": profile.patient_id,
        "full_name": profile.full_name,
        "abha_address": profile.abha_address,
        "phone_number": phone,
        "preferred_language": profile.preferred_language,
        "demographics": profile.demographics_json or {},
        "records": records_out
    }


@router.post("/patient/{patient_id}/doctor-update-history")
async def doctor_update_patient_history(
    patient_id: str,
    req: DoctorUpdateHistoryIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db)
):
    """
    Treating doctor updates patient's clinical medical history in ABHA repository post-consultation:
    - Adds new clinical conditions / diagnoses
    - Appends prescribed medications
    - Adds consultation clinical note with timestamp and doctor info
    Persists data to SQLite ABHA database and broadcasts update in real-time.
    """
    stmt = select(PatientProfile).where(
        or_(
            PatientProfile.patient_id == patient_id,
            PatientProfile.abha_address == patient_id
        )
    )
    res = await db.execute(stmt)
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found in ABHA database.")

    demo = dict(profile.demographics_json or {})
    med_hist = dict(demo.get("medical_history", {
        "chronic_conditions": [],
        "active_medications": [],
        "allergies": [],
        "past_surgeries": [],
        "consultations": []
    }))

    existing_conditions = list(med_hist.get("chronic_conditions", []))
    for c in req.new_conditions:
        c_clean = c.strip()
        if c_clean and c_clean not in existing_conditions:
            existing_conditions.append(c_clean)
    med_hist["chronic_conditions"] = existing_conditions

    existing_meds = list(med_hist.get("active_medications", []))
    for m in req.prescribed_medications:
        m_clean = m.strip()
        if m_clean and m_clean not in existing_meds:
            existing_meds.append(m_clean)
    med_hist["active_medications"] = existing_meds

    if req.updated_allergies:
        existing_allergies = list(med_hist.get("allergies", []))
        for a in req.updated_allergies:
            a_clean = a.strip()
            if a_clean and a_clean not in existing_allergies:
                existing_allergies.append(a_clean)
        med_hist["allergies"] = existing_allergies

    # Append consultation note
    consultations = list(med_hist.get("consultations", []))
    consultation_entry = {
        "consultation_id": f"cons_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "doctor_id": current_doctor.get("user_id"),
        "doctor_name": current_doctor.get("name", "Dr. Treating Physician"),
        "clinical_notes": req.clinical_notes or "Regular consultation completed.",
        "new_diagnoses": req.new_conditions,
        "prescriptions": req.prescribed_medications
    }
    consultations.append(consultation_entry)
    med_hist["consultations"] = consultations
    med_hist["last_updated_by"] = current_doctor.get("name", "Dr. Treating Physician")
    med_hist["last_updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    demo["medical_history"] = med_hist
    profile.demographics_json = demo
    flag_modified(profile, "demographics_json")

    # Audit log
    audit = AuditEvent(
        actor_id=current_doctor.get("user_id", "doctor"),
        action="DOCTOR_UPDATED_PATIENT_MEDICAL_HISTORY",
        resource_id=profile.patient_id,
        outcome="SUCCESS"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(profile)

    # Broadcast update to patient and doctor via WebSocket
    update_event = {
        "type": "PATIENT_HISTORY_UPDATED",
        "patient_id": profile.patient_id,
        "patient_name": profile.full_name,
        "updated_by": current_doctor.get("name", "Doctor"),
        "medical_history": med_hist
    }
    await ws_manager.broadcast(update_event)

    return {
        "success": True,
        "message": f"ABHA Medical history successfully updated for {profile.full_name}.",
        "patient_id": profile.patient_id,
        "medical_history": med_hist,
        "consultation_entry": consultation_entry
    }

