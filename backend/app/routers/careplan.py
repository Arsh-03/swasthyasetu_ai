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
    medications = [
        {
            "id": rx.get("id"),
            "name": rx.get("name"),
            "dosage": rx.get("dosage"),
            "frequency": rx.get("frequency"),
            "timing": rx.get("timing"),
            "duration": rx.get("duration"),
            "purpose": rx.get("purpose"),
            "schedule": rx.get("schedule") or {},
            "prescribedBy": rx.get("prescribedBy"),
        }
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
