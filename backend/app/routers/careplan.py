from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    Appointment, AuditEvent, ClinicalNote, DoseLog, Encounter, PatientProfile,
    Practitioner, RecoveryCheckin,
)
from app.schemas.schemas import DoseLogIn, RecoveryCheckinIn
from app.services.auth_dependencies import require_patient
from app.services.connection_manager import ws_manager
from app.services.notifications import notify

router = APIRouter(prefix="/careplan", tags=["careplan"])

VALID_SLOTS = {"morning", "afternoon", "night", "prn"}
VALID_CHECKINS = {"better", "same", "worse"}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@router.get("")
async def get_my_care_plan(
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
):
    """
    The patient's active medications (from their chart), today's dose log,
    today's recovery check-in and the latest signed doctor note.
    """
    patient_id = current_patient["user_id"]
    profile = (
        await db.execute(select(PatientProfile).where(PatientProfile.patient_id == patient_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    chart = profile.chart_json or {}
    # Match each prescription to the doctor who wrote it (a patient can have several doctors)
    from app.routers.care import department_of, prescriber_key
    doctors_by_key = {prescriber_key(d.display_name): d
                      for d in (await db.execute(select(Practitioner))).scalars().all()}

    def prescriber(name):
        doc = doctors_by_key.get(prescriber_key(name)) if name else None
        if not doc:
            return {"practitioner_id": None, "name": name or "", "department": ""}
        return {"practitioner_id": doc.practitioner_id, "name": doc.display_name, "department": department_of(doc)}

    def normalize_medication(rx):
        name = rx.get("name") or ""
        dosage = rx.get("dosage") or ""
        timing = rx.get("timing") or ""
        
        # 1. Short name
        short_name = rx.get("short_name")
        if not short_name:
            import re
            s = re.sub(r"\b(Tablet|Oral Solution|Solution|Syrup|Capsule|Injection|Suspension|Drops|Ointment|Gel|Cream|SR|ER|CR|XL|OD|BD|TDS|IP|BP|USP)\b", "", name, flags=re.IGNORECASE)
            s = re.sub(r"\bHydrochloride\b", "", s, flags=re.IGNORECASE)
            s = re.sub(r"\b\d+(\.\d+)?\s*(mg|ml|mcg|g|iu)\b", "", s, flags=re.IGNORECASE)
            s = re.sub(r"\s+", " ", s).strip()
            short_name = s or (name.split()[0] if name else "Medicine")

        # 2. Form
        form = rx.get("form")
        if not form:
            nl = (name + " " + str(dosage)).lower()
            if any(w in nl for w in ("solution", "syrup", "suspension", "liquid", "ml")):
                form = "syrup"
            elif any(w in nl for w in ("capsule", "cap")):
                form = "capsule"
            elif any(w in nl for w in ("drops", "drop", "eye drop", "ear drop")):
                form = "drops"
            elif any(w in nl for w in ("injection", "inj", "vial")):
                form = "injection"
            else:
                form = "tablet"

        # 3. Purpose (Patient friendly in English, Kannada, Hindi)
        purpose_patient = rx.get("purpose_patient")
        if not purpose_patient:
            nl = (name + " " + str(rx.get("purpose") or "")).lower()
            if "potassium" in nl or "citrate" in nl or "kidney" in nl or "stone" in nl:
                purpose_patient = {
                    "en": "For dissolving kidney stones",
                    "kn": "ಮೂತ್ರಪಿಂಡದ ಕಲ್ಲು ಕರಗಿಸಲು",
                    "hi": "गुर्दे की पथरी घोलने के लिए"
                }
            elif "metformin" in nl or "glycemic" in nl or "sugar" in nl or "diabetes" in nl:
                purpose_patient = {
                    "en": "For sugar control",
                    "kn": "ಸಕ್ಕರೆ (ಡಯಾಬಿಟಿಸ್) ನಿಯಂತ್ರಣಕ್ಕೆ",
                    "hi": "शुगर (डायबिटीज) नियंत्रण के लिए"
                }
            elif "tamsulosin" in nl or "urination" in nl or "ureteral" in nl:
                purpose_patient = {
                    "en": "For easier urination & stone passage",
                    "kn": "ಸುಲಭ ಮೂತ್ರ ವಿಸರ್ಜನೆಗಾಗಿ",
                    "hi": "पेशाब की रुकावट कम करने के लिए"
                }
            elif "drotaverine" in nl or "colic" in nl or "spasm" in nl:
                purpose_patient = {
                    "en": "For stomach & colic pain",
                    "kn": "ಹೊಟ್ಟೆ ಶೂಲೆ ಮತ್ತು ನೋವಿಗೆ",
                    "hi": "पेट दर्द और ऐंठन के लिए"
                }
            elif "paracetamol" in nl or "fever" in nl or "antipyretic" in nl:
                purpose_patient = {
                    "en": "For fever & mild pain",
                    "kn": "ಜ್ವರ ಮತ್ತು ಮೈಕೈ ನೋವಿಗೆ",
                    "hi": "बुखार और बदन दर्द के लिए"
                }
            elif "ciprofloxacin" in nl or "uti" in nl or "antibacterial" in nl:
                purpose_patient = {
                    "en": "For urinary infection",
                    "kn": "ಮೂತ್ರದ ಸೋಂಕಿಗೆ",
                    "hi": "पेशाब के संक्रमण के लिए"
                }
            else:
                p_orig = rx.get("purpose") or "As prescribed by doctor"
                purpose_patient = {
                    "en": p_orig,
                    "kn": p_orig,
                    "hi": p_orig
                }

        # 4. Structured instructions
        instructions = rx.get("instructions")
        if not instructions:
            tl = timing.lower()
            if "bedtime" in tl or "night" in tl or "sleep" in tl:
                meal_rel = "bedtime"
            elif "before" in tl or "empty" in tl:
                meal_rel = "before_food"
            elif "with" in tl or "during" in tl:
                meal_rel = "with_food"
            else:
                meal_rel = "after_food"
            instructions = {
                "dose_amount": dosage or ("10 mL in a glass of water" if form == "syrup" else "1 tablet"),
                "meal_relation": meal_rel,
                "intake_method": "with_water",
                "timing_label": timing or "As directed by physician"
            }

        return {
            "id": rx.get("id"),
            "name": rx.get("name"),
            "short_name": short_name,
            "purpose_patient": purpose_patient,
            "form": form,
            "instructions": instructions,
            "dosage": rx.get("dosage"),
            "frequency": rx.get("frequency"),
            "timing": rx.get("timing"),
            "duration": rx.get("duration"),
            "purpose": rx.get("purpose"),
            "schedule": rx.get("schedule") or {},
            "prescribedBy": rx.get("prescribedBy"),
            "prescriber": prescriber(rx.get("prescribedBy")),
        }

    medications = [
        normalize_medication(rx)
        for rx in chart.get("prescriptions", [])
        if rx.get("status", "Active") == "Active"
    ]

    today = _today()
    logs = (
        await db.execute(
            select(DoseLog).where(DoseLog.patient_id == patient_id, DoseLog.log_date == today)
        )
    ).scalars().all()

    checkin = (
        await db.execute(
            select(RecoveryCheckin)
            .where(RecoveryCheckin.patient_id == patient_id)
            .order_by(desc(RecoveryCheckin.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    checkin_today = None
    if checkin and checkin.created_at and checkin.created_at.strftime("%Y-%m-%d") == today:
        checkin_today = checkin.status

    note_row = (
        await db.execute(
            select(ClinicalNote, Practitioner)
            .join(Encounter, Encounter.encounter_id == ClinicalNote.encounter_id)
            .outerjoin(Practitioner, Practitioner.practitioner_id == ClinicalNote.practitioner_id)
            .where(Encounter.patient_id == patient_id, ClinicalNote.status == "clinician_approved")
            .order_by(desc(ClinicalNote.signed_at))
            .limit(1)
        )
    ).first()

    apt = (
        await db.execute(
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(desc(Appointment.updated_at))
            .limit(1)
        )
    ).scalar_one_or_none()

    if note_row and note_row[1]:
        doctor_name, facility = note_row[1].display_name, note_row[1].facility
    elif apt:
        doctor_name, facility = apt.doctor_name, apt.facility
    else:
        doctor_name, facility = None, None

    latest_note = None
    if note_row:
        note = note_row[0]
        latest_note = {
            "assessment": note.assessment,
            "plan": note.plan_json or {},
            "signed_at": note.signed_at,
        }

    return {
        "doctor_name": doctor_name,
        "facility": facility,
        "medications": medications,
        "doses_today": {f"{log.medication_id}:{log.slot}": bool(log.taken) for log in logs},
        "checkin_today": checkin_today,
        "latest_note": latest_note,
    }


@router.post("/doses")
async def log_dose(
    req: DoseLogIn,
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
):
    """Mark (or unmark) one dose slot as taken for a day."""
    if req.slot not in VALID_SLOTS:
        raise HTTPException(status_code=400, detail=f"slot must be one of {sorted(VALID_SLOTS)}")
    patient_id = current_patient["user_id"]
    log_date = req.log_date or _today()

    log = (
        await db.execute(
            select(DoseLog).where(
                DoseLog.patient_id == patient_id,
                DoseLog.medication_id == req.medication_id,
                DoseLog.slot == req.slot,
                DoseLog.log_date == log_date,
            )
        )
    ).scalar_one_or_none()
    if log:
        log.taken = req.taken
    else:
        log = DoseLog(
            patient_id=patient_id,
            medication_id=req.medication_id,
            slot=req.slot,
            log_date=log_date,
            taken=req.taken,
        )
        db.add(log)
    await db.commit()
    return {"medication_id": req.medication_id, "slot": req.slot, "log_date": log_date, "taken": req.taken}


@router.post("/checkin")
async def submit_recovery_checkin(
    req: RecoveryCheckinIn,
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
):
    """Patient's 'How are you feeling?' answer; 'worse' is flagged to the doctor portal."""
    if req.status not in VALID_CHECKINS:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_CHECKINS)}")
    patient_id = current_patient["user_id"]
    checkin = RecoveryCheckin(patient_id=patient_id, status=req.status)
    db.add(checkin)
    db.add(AuditEvent(
        actor_id=patient_id,
        action="RECOVERY_CHECKIN",
        resource_id=patient_id,
        outcome="ALERT" if req.status == "worse" else "SUCCESS",
        purpose=f"Patient reported feeling {req.status}",
    ))
    await db.commit()

    if req.status == "worse":
        name = current_patient.get("name") or "A patient"
        await notify(kind="alert", severity="critical", patient_id=patient_id,
                     title=f"{name} reported feeling worse",
                     body="Recovery check-in from the patient app. Review the care plan or call the patient.",
                     link={"page": "patient", "patient_id": patient_id})
    await ws_manager.send_to_role("doctor", {          # clinicians only (single-clinic demo: all doctors)
        "type": "recovery_checkin",
        "patient_id": patient_id,
        "patient_name": current_patient.get("name"),
        "status": req.status,
    })
    return {"checkin_id": checkin.checkin_id, "status": checkin.status, "created_at": checkin.created_at}
