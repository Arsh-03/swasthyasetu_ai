"""
Meetings, Google Meet style: every appointment has a meeting code and link, a join window, and a waiting room.

  code        "rgw-pqtk-zma" (3-4-3 lowercase letters), unique per appointment
  join window opens JOIN_EARLY_MIN before the start, closes CLOSE_AFTER_MIN after the scheduled end
  waiting     the patient "asks to join"; the doctor admits them (or is let in automatically if the doctor is
              already waiting in the room). Handled in routers/calls.py on the call socket.
"""
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Appointment, AuditEvent, Encounter, PatientProfile
from app.services.serializers import as_aware

JOIN_EARLY_MIN = 10
CLOSE_AFTER_MIN = 30
OPEN_ENCOUNTER = ("queued", "in_progress")


def new_code() -> str:
    letters = string.ascii_lowercase
    part = lambda n: "".join(secrets.choice(letters) for _ in range(n))  # noqa: E731
    return f"{part(3)}-{part(4)}-{part(3)}"


def window(apt: Appointment, now: Optional[datetime] = None) -> Dict[str, Any]:
    """When patients can join, and the meeting's state right now."""
    now = now or datetime.now(timezone.utc)
    start = as_aware(apt.scheduled_at)
    if not start:
        return {"opens_at": None, "closes_at": None, "ends_at": None, "state": "open"}
    end = start + timedelta(minutes=apt.duration_minutes or 20)
    opens, closes = start - timedelta(minutes=JOIN_EARLY_MIN), end + timedelta(minutes=CLOSE_AFTER_MIN)
    if apt.visit_status == "cancelled":
        state = "cancelled"
    elif apt.visit_status == "completed":
        state = "completed"
    elif now < opens:
        state = "early"
    elif now > closes:
        state = "closed"
    else:
        state = "open"
    return {"opens_at": opens, "closes_at": closes, "ends_at": end, "state": state}


async def ensure_codes(db: AsyncSession) -> int:
    """Give every appointment without a meeting code one (appointments made before codes existed)."""
    rows = (await db.execute(select(Appointment).where(Appointment.meeting_code.is_(None)))).scalars().all()
    for apt in rows:
        apt.meeting_code = new_code()
    return len(rows)


async def ensure_encounter(db: AsyncSession, apt: Appointment, practitioner_id: Optional[str]) -> Tuple[Encounter, bool]:
    """The consultation (call room) for this appointment: its own, the patient's open one, or a new one.
    The patient app joins the patient's oldest open consultation, so an existing open one is reused."""
    enc = await db.get(Encounter, apt.encounter_id) if apt.encounter_id else None
    created = False
    if not enc or enc.status not in OPEN_ENCOUNTER:
        enc = (await db.execute(select(Encounter).where(
            Encounter.patient_id == apt.patient_id, Encounter.status.in_(OPEN_ENCOUNTER)).order_by(Encounter.start_time))).scalars().first()
    if not enc:
        profile = await db.get(PatientProfile, apt.patient_id)
        chart = (profile.chart_json if profile else None) or {}
        enc = Encounter(
            encounter_id=f"enc_{uuid.uuid4().hex[:8]}", patient_id=apt.patient_id, practitioner_id=practitioner_id or apt.practitioner_id,
            mode="video" if "video" in (apt.mode or "").lower() else "audio", status="queued", urgency="routine",
            symptoms_text=apt.agenda or "",
            allergies_json=[a.get("allergen") for a in chart.get("allergies", []) if a.get("allergen")],
            current_meds_json=[f"{rx.get('name')} {rx.get('dosage') or ''}".strip()
                               for rx in chart.get("prescriptions", []) if rx.get("status", "Active") == "Active"],
        )
        db.add(enc)
        created = True
        db.add(AuditEvent(actor_id=practitioner_id or f"patient:{apt.patient_id}", action="CONSULTATION_OPENED",
                          resource_id=enc.encounter_id, outcome="SUCCESS", purpose=f"For appointment {apt.appointment_id}"))
    apt.encounter_id = enc.encounter_id
    enc.practitioner_id = enc.practitioner_id or practitioner_id or apt.practitioner_id
    return enc, created
