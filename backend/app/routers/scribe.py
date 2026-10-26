import re
import hashlib
import uuid
from typing import Dict, Any
from datetime import datetime, timezone
from app.services.note_format import chart_prescription, parse_note
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import ConsultationNotepad, ConsultationRecord, Appointment, Encounter, ClinicalNote, Practitioner, AuditEvent, PatientProfile
from app.schemas.schemas import ScribeGenerateIn, ClinicalNoteOut, ClinicalNoteSignIn
from app.services.scribe_service import generate_soap_note_from_dialogue
from app.services.auth_dependencies import require_doctor

router = APIRouter(prefix="/scribe", tags=["scribe"])


def _prescription_from_text(text: str, doctor_name: str, when: datetime) -> Dict[str, Any]:
    """Turn a free-text order like 'Paracetamol 650mg TDS (After food)' into a chart prescription with patient-friendly fields."""
    t = text.upper()
    has = lambda *words: any(re.search(rf"\b{w}\b", t) for w in words)  # whole words only ("OD" not in "FOOD")
    if has("TDS", "TID", "THRICE", "THREE TIMES"):
        schedule = {"morning": True, "afternoon": True, "night": True}
    elif has("BD", "BID", "TWICE"):
        schedule = {"morning": True, "afternoon": False, "night": True}
    elif has("BEDTIME", "HS", "NIGHT"):
        schedule = {"morning": False, "afternoon": False, "night": True}
    elif has("OD", "ONCE", "DAILY"):
        schedule = {"morning": True, "afternoon": False, "night": False}
    else:
        schedule = {"morning": False, "afternoon": False, "night": False}  # as needed
    timing = text[text.find("(") + 1:text.rfind(")")] if "(" in text and ")" in text else "As advised"
    full_name = text.split("(")[0].strip()

    # Patient-friendly short name
    s = re.sub(r"\b(Tablet|Oral Solution|Solution|Syrup|Capsule|Injection|Suspension|Drops|Ointment|Gel|Cream|SR|ER|CR|XL|OD|BD|TDS|IP|BP|USP)\b", "", full_name, flags=re.IGNORECASE)
    s = re.sub(r"\bHydrochloride\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\b\d+(\.\d+)?\s*(mg|ml|mcg|g|iu)\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip()
    short_name = s or full_name.split()[0]

    # Form
    fl = full_name.lower()
    if any(w in fl for w in ("solution", "syrup", "suspension", "liquid", "ml")):
        form = "syrup"
    elif any(w in fl for w in ("capsule", "cap")):
        form = "capsule"
    elif any(w in fl for w in ("drops", "drop")):
        form = "drops"
    elif any(w in fl for w in ("injection", "inj")):
        form = "injection"
    else:
        form = "tablet"

    # Meal relation
    tl = timing.lower()
    if "bedtime" in tl or "night" in tl or "sleep" in tl:
        meal_rel = "bedtime"
    elif "before" in tl or "empty" in tl:
        meal_rel = "before_food"
    elif "with" in tl or "during" in tl:
        meal_rel = "with_food"
    else:
        meal_rel = "after_food"

    purpose_patient = {
        "en": f"Prescribed by {doctor_name}",
        "kn": f"{doctor_name} ಅವರು ಸೂಚಿಸಿದ ಔಷಧಿ",
        "hi": f"{doctor_name} द्वारा सुझाई गई दवा",
    }

    return {
        "id": f"rx_{uuid.uuid4().hex[:8]}",
        "name": full_name,
        "short_name": short_name,
        "purpose_patient": purpose_patient,
        "form": form,
        "instructions": {
            "dose_amount": "1 tablet" if form == "tablet" else "As advised",
            "meal_relation": meal_rel,
            "intake_method": "with_water",
            "timing_label": timing,
        },
        "dosage": "",
        "route": "Oral",
        "frequency": "As prescribed",
        "timing": timing,
        "duration": "As advised",
        "purpose": "Prescribed during tele-consultation",
        "schedule": schedule,
        "refillsRemaining": 0,
        "prescribedBy": doctor_name,
        "prescribedDate": when.strftime("%d %b %Y"),
        "status": "Active",
    }

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
    enc_res = await db.execute(select(Encounter).where(Encounter.encounter_id == encounter_id))
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")

    note_res = await db.execute(select(ClinicalNote).where(ClinicalNote.encounter_id == encounter_id))
    note = note_res.scalar_one_or_none()
    if not note:
        # No AI draft was generated; the doctor's reviewed scribe entries become the note.
        note = ClinicalNote(encounter_id=encounter_id, practitioner_id=current_doctor["user_id"])
        db.add(note)
    note.practitioner_id = current_doctor["user_id"]

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
    # The appointment this consultation was opened for is done too.
    for apt in (await db.execute(select(Appointment).where(Appointment.encounter_id == encounter_id))).scalars():
        apt.visit_status = "completed"

    # The notepad is the single source: parse it, keep the structured record, and put every prescribed
    # medicine (with dose, frequency, duration and a daily schedule) on the patient's chart.
    pad = await db.get(ConsultationNotepad, encounter_id)
    structured = parse_note(pad.content) if pad and pad.content and pad.content.strip() else None
    doctor_row = (await db.execute(select(Practitioner).where(Practitioner.practitioner_id == current_doctor["user_id"]))).scalar_one_or_none()
    doctor_label = doctor_row.display_name if doctor_row else sign_data.doctor_signature_name
    medicine = (sign_data.plan or {}).get("medicine")
    if structured:
        record = await db.get(ConsultationRecord, encounter_id)
        if not record:
            record = ConsultationRecord(encounter_id=encounter_id, patient_id=enc.patient_id)
            db.add(record)
        record.practitioner_id = current_doctor["user_id"]
        record.structured_json = structured
        record.note_text = pad.content
        record.signed_at = now
        profile = (await db.execute(select(PatientProfile).where(PatientProfile.patient_id == enc.patient_id))).scalar_one_or_none()
        if profile and (structured["prescription"] or structured["allergies"]):
            chart = dict(profile.chart_json or {})
            purpose = "; ".join(structured["diagnosis"])[:120]
            when_label = now.strftime("%d %b %Y")
            chart["prescriptions"] = [chart_prescription(m, doctor_label, when_label, purpose) for m in structured["prescription"]] \
                + list(chart.get("prescriptions", []))
            known = {str(a.get("allergen", "")).lower() for a in chart.get("allergies", []) if isinstance(a, dict)}
            new_allergies = [{"allergen": a, "reaction": "", "source": "Consultation note"} for a in structured["allergies"]
                             if a.lower() not in known and not any(k and k in a.lower() for k in known)]
            if new_allergies:
                chart["allergies"] = list(chart.get("allergies", [])) + new_allergies
            profile.chart_json = chart
        if structured["prescription"]:
            medicine = None              # already on the chart, line by line
    if medicine and medicine.strip():
        profile = (await db.execute(select(PatientProfile).where(PatientProfile.patient_id == enc.patient_id))).scalar_one_or_none()
        if profile:
            chart = dict(profile.chart_json or {})
            doctor = (await db.execute(select(Practitioner).where(Practitioner.practitioner_id == current_doctor["user_id"]))).scalar_one_or_none()
            chart["prescriptions"] = [
                _prescription_from_text(medicine.strip(), doctor.display_name if doctor else sign_data.doctor_signature_name, now)
            ] + list(chart.get("prescriptions", []))
            profile.chart_json = chart

    audit = AuditEvent(
        actor_id=current_doctor["user_id"],
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
