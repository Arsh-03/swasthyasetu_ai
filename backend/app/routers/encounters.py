from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Encounter, PatientProfile, Practitioner, Representative, AuditEvent
from app.schemas.schemas import AuditEventOut
from app.services.auth_dependencies import get_current_user

router = APIRouter(prefix="/encounters", tags=["encounters"])

@router.get("/{encounter_id}")
async def get_encounter_details(
    encounter_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    enc_res = await db.execute(select(Encounter).where(Encounter.encounter_id == encounter_id))
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    pat_res = await db.execute(select(PatientProfile).where(PatientProfile.patient_id == enc.patient_id))
    pat = pat_res.scalar_one_or_none()

    doc_res = await db.execute(select(Practitioner).where(Practitioner.practitioner_id == enc.practitioner_id))
    doc = doc_res.scalar_one_or_none()

    return {
        "encounter_id": enc.encounter_id,
        "status": enc.status,
        "mode": enc.mode,
        "symptoms": enc.symptoms_text,
        "allergies": enc.allergies_json,
        "current_meds": enc.current_meds_json,
        "patient": {
            "patient_id": pat.patient_id if pat else enc.patient_id,
            "full_name": pat.full_name if pat else "Ramesh Gowda",
            "abha_address": pat.abha_address if pat else "91-4820-1928-1120",
            "preferred_language": pat.preferred_language if pat else "kn",
            "demographics": pat.demographics_json if pat else {}
        },
        "practitioner": {
            "practitioner_id": doc.practitioner_id if doc else "dr_ananya_sharma",
            "display_name": doc.display_name if doc else "Dr. Ananya Sharma",
            "registration_number": doc.registration_number if doc else "581920",
            "specialty": doc.specialty if doc else "General Medicine"
        }
    }

@router.post("/{encounter_id}/mode")
async def update_encounter_mode(
    encounter_id: str,
    mode: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    enc_res = await db.execute(select(Encounter).where(Encounter.encounter_id == encounter_id))
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    enc.mode = mode
    await db.commit()
    return {"encounter_id": encounter_id, "mode": mode}
