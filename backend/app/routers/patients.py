from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Appointment, Encounter, PatientProfile, User
from app.services.auth_dependencies import get_current_user, require_doctor
from app.services.serializers import URGENCY_RANK, appointment_to_dict, wait_label

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/queue")
async def get_patient_queue(
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    """
    Tele-triage queue: every patient with an open (queued / in-progress) encounter,
    most urgent first, then longest waiting.
    """
    stmt = (
        select(Encounter, PatientProfile, User)
        .join(PatientProfile, Encounter.patient_id == PatientProfile.patient_id)
        .join(User, User.user_id == PatientProfile.patient_id)
        .where(Encounter.status.in_(["queued", "in_progress"]))
        .order_by(Encounter.start_time)
    )
    rows = (await db.execute(stmt)).all()

    queue: Dict[str, Dict[str, Any]] = {}
    for enc, profile, user in rows:
        if profile.patient_id in queue:
            continue  # keep each patient's oldest open encounter
        demo = dict(profile.demographics_json or {})
        demo.pop("medical_history", None)
        queue[profile.patient_id] = {
            "patient_id": profile.patient_id,
            "encounter_id": enc.encounter_id,
            "full_name": profile.full_name,
            "abha_address": profile.abha_address,
            "phone_number": user.phone_number or "",
            "preferred_language": profile.preferred_language or "kn",
            "demographics": demo,
            "complaint": enc.symptoms_text or "",
            "vitals": enc.vitals_summary or "",
            "allergies": enc.allergies_json or [],
            "active_rx": enc.current_meds_json or [],
            "wait_time": wait_label(enc.start_time),
            "urgency": enc.urgency or "routine",
            "avatar_url": profile.avatar_url,
            "encounter_status": enc.status,
        }

    return sorted(queue.values(), key=lambda p: URGENCY_RANK.get(p["urgency"], 3))


@router.get("/{patient_id}/chart")
async def get_patient_chart(
    patient_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Full medical chart for the doctor's chart view (or the patient's own chart).
    `chart` is empty when no detailed history has been recorded yet.
    """
    if current_user["role"] != "doctor" and current_user["user_id"] != patient_id:
        raise HTTPException(status_code=403, detail="Access Denied: You can only view your own chart.")

    profile = (
        await db.execute(select(PatientProfile).where(PatientProfile.patient_id == patient_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")

    apt = (
        await db.execute(
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(desc(Appointment.updated_at))
            .limit(1)
        )
    ).scalar_one_or_none()

    chart = dict(profile.chart_json or {})
    if chart:
        # Profile columns are the source of truth for identity fields
        chart["patientId"] = profile.patient_id
        chart["fullName"] = profile.full_name
        chart["abhaAddress"] = profile.abha_address
        if apt:
            chart["nextAppointment"] = appointment_to_dict(apt)

    return {
        "patient_id": profile.patient_id,
        "chart": chart or None,
        "next_appointment": appointment_to_dict(apt) if apt else None,
    }
