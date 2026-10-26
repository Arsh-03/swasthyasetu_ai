import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Appointment, AuditEvent, PatientProfile, Practitioner
from app.schemas.schemas import AppointmentUpdateIn
from app.services.auth_dependencies import require_doctor, require_patient
from app.services.connection_manager import ws_manager
from app.services.serializers import appointment_to_dict

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("/next")
async def get_my_next_appointment(
    current_patient: Dict[str, Any] = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
):
    """The logged-in patient's soonest upcoming appointment with any of their doctors (null if none).
    All of them: GET /care/appointments."""
    apt = (
        await db.execute(
            select(Appointment)
            .where(Appointment.patient_id == current_patient["user_id"],
                   Appointment.visit_status == "scheduled",
                   Appointment.scheduled_at >= datetime.now(timezone.utc) - timedelta(minutes=30))
            .order_by(Appointment.scheduled_at)
            .limit(1)
        )
    ).scalar_one_or_none()
    return appointment_to_dict(apt) if apt else None


@router.put("/{appointment_id}")
async def reschedule_appointment(
    appointment_id: str,
    req: AppointmentUpdateIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    """
    Doctor reschedules an appointment; the patient app is notified in real time.
    If the appointment does not exist yet and `patientId` is given, a new one is booked.
    """
    apt = (
        await db.execute(select(Appointment).where(Appointment.appointment_id == appointment_id))
    ).scalar_one_or_none()
    if not apt:
        if not req.patientId:
            raise HTTPException(status_code=404, detail="Appointment not found")
        patient = (
            await db.execute(select(PatientProfile).where(PatientProfile.patient_id == req.patientId))
        ).scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        doctor = (
            await db.execute(
                select(Practitioner).where(Practitioner.practitioner_id == current_doctor["user_id"])
            )
        ).scalar_one_or_none()
        apt = Appointment(
            appointment_id=f"apt_{uuid.uuid4().hex[:10]}",
            patient_id=patient.patient_id,
            practitioner_id=doctor.practitioner_id if doctor else None,
            doctor_name=doctor.display_name if doctor else current_doctor.get("name"),
            specialty=doctor.specialty if doctor else None,
            facility=doctor.facility if doctor else None,
            date_label=req.date,
            time_label=req.time,
        )
        db.add(apt)

    apt.date_label = req.date
    apt.time_label = req.time
    apt.relative_label = req.relativeTime or f"Rescheduled to {req.date}"
    apt.mode = req.mode
    if req.agenda is not None:
        apt.agenda = req.agenda
    if req.status:
        apt.status = req.status
    if req.instructionsForPatient:
        apt.instructions_json = req.instructionsForPatient
    apt.is_rescheduled = True

    db.add(AuditEvent(
        actor_id=current_doctor["user_id"],
        action="APPOINTMENT_RESCHEDULED",
        resource_id=apt.appointment_id,
        outcome="SUCCESS",
        purpose=f"Moved to {req.date} {req.time}",
    ))
    await db.commit()
    await db.refresh(apt)

    data = appointment_to_dict(apt)
    await ws_manager.send_to([apt.patient_id, current_doctor["user_id"]], {
        "type": "appointment_event",
        "event": "appointment_rescheduled",
        "patient_id": apt.patient_id,
        "appointment_id": apt.appointment_id,
        "doctor_name": apt.doctor_name,
        "date": apt.date_label,
        "time": apt.time_label,
        "relativeTime": apt.relative_label,
        "mode": apt.mode,
        "facility": apt.facility,
        "agenda": apt.agenda,
        "status": apt.status,
        "instructions": apt.instructions_json,
    })
    return data
