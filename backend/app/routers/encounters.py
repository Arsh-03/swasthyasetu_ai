import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Encounter, PatientProfile, Practitioner, Representative, AuditEvent
from app.schemas.schemas import AuditEventOut, SymptomIntakeIn
from app.services.auth_dependencies import get_current_user, require_patient
from app.services.connection_manager import ws_manager

router = APIRouter(prefix="/encounters", tags=["encounters"])


@router.post("/intake")
async def submit_symptom_intake(
    req: SymptomIntakeIn,
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
):
    """
    Pre-consultation symptom intake from the patient app. Updates the patient's open
    encounter (or opens a new queued one) so it shows up in the doctor's triage queue.
    """
    patient_id = current_patient["user_id"]
    profile = (await db.execute(select(PatientProfile).where(PatientProfile.patient_id == patient_id))).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    parts = [s.strip() for s in req.symptoms if s.strip()]
    complaint = ", ".join(parts)
    if req.notes and req.notes.strip():
        complaint = f"{complaint}. {req.notes.strip()}" if complaint else req.notes.strip()
    if req.is_representative:
        complaint = f"[Reported by representative] {complaint}"

    enc = (await db.execute(
        select(Encounter)
        .where(Encounter.patient_id == patient_id, Encounter.status.in_(["queued", "in_progress"]))
        .order_by(Encounter.start_time)
    )).scalars().first()

    if enc:
        enc.symptoms_text = complaint or enc.symptoms_text
    else:
        chart = profile.chart_json or {}
        enc = Encounter(
            encounter_id=f"enc_{uuid.uuid4().hex[:8]}",
            patient_id=patient_id,
            mode="video",
            status="queued",
            urgency="routine",
            symptoms_text=complaint,
            allergies_json=[a.get("allergen") for a in chart.get("allergies", []) if a.get("allergen")],
            current_meds_json=[
                f"{rx.get('name')} {rx.get('dosage') or ''}".strip()
                for rx in chart.get("prescriptions", [])
                if rx.get("status", "Active") == "Active"
            ],
        )
        db.add(enc)

    db.add(AuditEvent(
        actor_id=f"{'representative' if req.is_representative else 'patient'}:{patient_id}",
        action="SYMPTOM_INTAKE_SUBMITTED",
        resource_id=enc.encounter_id,
        outcome="SUCCESS",
        purpose=complaint[:255] if complaint else None,
    ))
    await db.commit()

    await ws_manager.send_to_role("doctor", {"type": "queue_updated", "patient_id": patient_id, "encounter_id": enc.encounter_id})
    return {"encounter_id": enc.encounter_id, "status": enc.status, "complaint": enc.symptoms_text}


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
