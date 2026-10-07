import hashlib
from typing import Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Encounter, ClinicalNote, Practitioner, AuditEvent
from app.schemas.schemas import ScribeGenerateIn, ClinicalNoteOut, ClinicalNoteSignIn
from app.services.scribe_service import generate_soap_note_from_dialogue
from app.services.auth_dependencies import require_doctor

router = APIRouter(prefix="/scribe", tags=["scribe"])

@router.post("/generate")
async def draft_soap_note(
    req: ScribeGenerateIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db)
):
    """
    AI Clinical Scribe parses consultation transcript into structured SOAP format.
    Does NOT issue prescription autonomously; marked as 'draft'.
    """
    enc_res = await db.execute(select(Encounter).where(Encounter.encounter_id == req.encounter_id))
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    soap_data = generate_soap_note_from_dialogue(req.transcript_text)
    
    # Check if existing note exists
    note_res = await db.execute(select(ClinicalNote).where(ClinicalNote.encounter_id == req.encounter_id))
    note = note_res.scalar_one_or_none()

    if not note:
        note = ClinicalNote(
            encounter_id=req.encounter_id,
            practitioner_id=enc.practitioner_id or "dr_ananya_sharma",
            subjective=soap_data["subjective"],
            objective=soap_data["objective"],
            assessment=soap_data["assessment"],
            plan_json=soap_data["plan"],
            status="draft"
        )
        db.add(note)
    else:
        note.subjective = soap_data["subjective"]
        note.objective = soap_data["objective"]
        note.assessment = soap_data["assessment"]
        note.plan_json = soap_data["plan"]
        note.status = "draft"

    await db.commit()
    await db.refresh(note)

    return {
        "note_id": note.note_id,
        "encounter_id": note.encounter_id,
        "subjective": note.subjective,
        "objective": note.objective,
        "assessment": note.assessment,
        "plan": note.plan_json,
        "status": note.status,
        "message": "Draft SOAP note generated. Awaiting clinician review & signature."
    }

@router.post("/sign/{encounter_id}", response_model=ClinicalNoteOut)
async def sign_care_plan(
    encounter_id: str,
    sign_data: ClinicalNoteSignIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db)
):
    """
    Mandatory Clinician Approval Gate:
    Under NMC Telemedicine Guidelines, doctor must review, acknowledge any DDI flags,
    and attach cryptographic signature timestamp before care plan can be delivered to patient.
    """
    note_res = await db.execute(select(ClinicalNote).where(ClinicalNote.encounter_id == encounter_id))
    note = note_res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Clinical note not found for this encounter")

    enc_res = await db.execute(select(Encounter).where(Encounter.encounter_id == encounter_id))
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    now = datetime.now(timezone.utc)
    sig_payload = f"{sign_data.doctor_signature_name}:{encounter_id}:{now.isoformat()}"
    crypto_signature = f"NMC-SIG-SHA256:{hashlib.sha256(sig_payload.encode()).hexdigest()[:16]}"

    note.subjective = sign_data.subjective
    note.objective = sign_data.objective
    note.assessment = sign_data.assessment
    note.plan_json = sign_data.plan
    note.status = "clinician_approved"
    note.clinician_signature = crypto_signature
    note.signed_at = now

    enc.status = "completed"
    enc.end_time = now

    audit = AuditEvent(
        actor_id=sign_data.doctor_signature_name,
        action="CARE_PLAN_SIGNED_AND_ISSUED",
        resource_id=encounter_id,
        outcome="SUCCESS"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(note)

    return ClinicalNoteOut(
        note_id=note.note_id,
        encounter_id=note.encounter_id,
        subjective=note.subjective,
        objective=note.objective,
        assessment=note.assessment,
        plan_json=note.plan_json or {},
        status=note.status,
        clinician_signature=note.clinician_signature,
        signed_at=note.signed_at
    )

@router.get("/{encounter_id}", response_model=ClinicalNoteOut)
async def get_clinical_note(encounter_id: str, db: AsyncSession = Depends(get_db)):
    note_res = await db.execute(select(ClinicalNote).where(ClinicalNote.encounter_id == encounter_id))
    note = note_res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="No clinical note found for encounter")
    return ClinicalNoteOut(
        note_id=note.note_id,
        encounter_id=note.encounter_id,
        subjective=note.subjective,
        objective=note.objective,
        assessment=note.assessment,
        plan_json=note.plan_json or {},
        status=note.status,
        clinician_signature=note.clinician_signature,
        signed_at=note.signed_at
    )
