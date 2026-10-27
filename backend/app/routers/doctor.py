"""
Doctor portal API: home dashboard, appointment calendar, patients, visit history, notifications, settings.

Times are stored in UTC. The portal sends the doctor's local day boundaries / UTC offset where a
"day" matters (the server has no time-zone database), so "today" is always the doctor's today.
"""
import uuid
import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    Appointment, AuditEvent, ChatMessage, ClinicalNote, ConsultationNotepad, ConsultationRecord, Encounter, Notification,
    CareTask, CareTeamMember, HealthWorker, PatientProfile, Practitioner, PractitionerSettings, User, VitalReading,
)
from app.care_catalog import department_for_specialty, department_name
from app.services.auth_dependencies import require_doctor
from app.services.connection_manager import ws_manager
from app.services.notifications import notification_to_dict
from app.services.serializers import as_aware, wait_label
from app.services.meetings import ensure_encounter, window as meeting_window
from app.services.note_format import parse_note, soap_from_structured
from app.routers.vitals import LABELS, latest_by_kind, latest_heart_rate, reading_out

router = APIRouter(prefix="/doctor", tags=["doctor portal"])

OPEN = ("queued", "in_progress")
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
# chat_window_days: how long patients can message after a visit · utc_offset_minutes: kept current by the portal
# (the server has no time-zone database) so chat can tell patients when the doctor is next available.
DEFAULT_PREFS = {"language": "en", "date_format": "DD MMM YYYY", "time_format": "12h", "timezone": "Asia/Kolkata",
                 "chat_window_days": 7, "utc_offset_minutes": 330}
DEFAULT_AVAILABILITY = {
    "weekly": {
        **{d: [{"start": "09:00", "end": "13:00"}, {"start": "14:00", "end": "17:00"}] for d in WEEKDAYS[:5]},
        "sat": [{"start": "09:00", "end": "13:00"}],
        "sun": [],
    },
    "leaves": [],
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Shapes
# ---------------------------------------------------------------------------

def _demographics(profile: PatientProfile) -> Dict[str, Any]:
    demo = dict(profile.demographics_json or {})
    demo.pop("medical_history", None)
    return demo


def patient_brief(profile: PatientProfile, user: Optional[User] = None) -> Dict[str, Any]:
    demo = _demographics(profile)
    chart = profile.chart_json or {}
    return {
        "patient_id": profile.patient_id,
        "full_name": profile.full_name,
        "abha_address": profile.abha_address,
        "avatar_url": profile.avatar_url,
        "preferred_language": profile.preferred_language or "kn",
        "phone_number": (user.phone_number if user else "") or "",
        "age": demo.get("age"),
        "gender": demo.get("gender"),
        "district": demo.get("district"),
        "occupation": demo.get("occupation"),
        "blood_group": chart.get("bloodGroup"),
        "allergies": [a.get("allergen") for a in chart.get("allergies", []) if a.get("allergen")],
        "conditions": [c.get("name") for c in chart.get("chronicConditions", []) if c.get("status") != "Resolved"],
    }


def appointment_out(apt: Appointment, profile: Optional[PatientProfile] = None,
                    enc: Optional[Encounter] = None) -> Dict[str, Any]:
    start = as_aware(apt.scheduled_at)
    return {
        "appointment_id": apt.appointment_id,
        "patient_id": apt.patient_id,
        "patient_name": profile.full_name if profile else None,
        "patient_avatar": profile.avatar_url if profile else None,
        "scheduled_at": start,
        "duration_minutes": apt.duration_minutes or 20,
        "mode": apt.mode,
        "agenda": apt.agenda or "",
        "status": apt.visit_status or "scheduled",
        "patient_confirmed": (apt.status or "").lower().startswith("confirmed"),
        "encounter_id": apt.encounter_id,
        "urgency": enc.urgency if enc else None,
        "complaint": enc.symptoms_text if enc else None,
        "date_label": apt.date_label,
        "time_label": apt.time_label,
        "meeting_code": apt.meeting_code,
        "meeting": {k: v for k, v in meeting_window(apt).items()},
    }


def queue_style_summary(enc: Encounter, profile: PatientProfile, user: Optional[User]) -> Dict[str, Any]:
    """Same shape as /patients/queue items (the consultation screen and notepad use it)."""
    return {
        "patient_id": profile.patient_id,
        "encounter_id": enc.encounter_id,
        "full_name": profile.full_name,
        "abha_address": profile.abha_address,
        "phone_number": (user.phone_number if user else "") or "",
        "preferred_language": profile.preferred_language or "kn",
        "demographics": _demographics(profile),
        "complaint": enc.symptoms_text or "",
        "vitals": enc.vitals_summary or "",
        "allergies": enc.allergies_json or [],
        "active_rx": enc.current_meds_json or [],
        "wait_time": wait_label(enc.start_time),
        "urgency": enc.urgency or "routine",
        "avatar_url": profile.avatar_url,
        "encounter_status": enc.status,
    }


def labels_for(start: datetime, utc_offset_minutes: int) -> tuple[str, str]:
    """Display text the patient app shows: ('2026-11-02', '10:00 AM') in the doctor's local time."""
    local = start.astimezone(timezone(timedelta(minutes=utc_offset_minutes)))
    return local.strftime("%Y-%m-%d"), local.strftime("%I:%M %p").lstrip("0")


async def _profiles(db: AsyncSession, ids) -> Dict[str, PatientProfile]:
    ids = list({i for i in ids if i})
    if not ids:
        return {}
    rows = (await db.execute(select(PatientProfile).where(PatientProfile.patient_id.in_(ids)))).scalars().all()
    return {p.patient_id: p for p in rows}


async def _encounters(db: AsyncSession, ids) -> Dict[str, Encounter]:
    ids = list({i for i in ids if i})
    if not ids:
        return {}
    rows = (await db.execute(select(Encounter).where(Encounter.encounter_id.in_(ids)))).scalars().all()
    return {e.encounter_id: e for e in rows}


async def _settings_row(db: AsyncSession, practitioner_id: str) -> PractitionerSettings:
    row = await db.get(PractitionerSettings, practitioner_id)
    if not row:
        row = PractitionerSettings(practitioner_id=practitioner_id, prefs_json=dict(DEFAULT_PREFS),
                                   availability_json=dict(DEFAULT_AVAILABILITY))
        db.add(row)
        await db.flush()
    return row


def _availability_problem(availability: Dict[str, Any], start: datetime, minutes: int,
                          utc_offset_minutes: int) -> Optional[str]:
    """Why this slot is outside the doctor's hours (None when it fits)."""
    local = start.astimezone(timezone(timedelta(minutes=utc_offset_minutes)))
    day = local.strftime("%Y-%m-%d")
    for leave in availability.get("leaves", []):
        if leave.get("start", "") <= day <= leave.get("end", ""):
            reason = f" ({leave['reason']})" if leave.get("reason") else ""
            return f"You are on leave on {day}{reason}."
    begin = local.strftime("%H:%M")
    end = (local + timedelta(minutes=minutes)).strftime("%H:%M")
    slots = availability.get("weekly", {}).get(WEEKDAYS[local.weekday()], [])
    if not any(s["start"] <= begin and end <= s["end"] for s in slots):
        return f"{local.strftime('%A')} {begin}–{end} is outside your available hours."
    return None


# ---------------------------------------------------------------------------
# Home dashboard
# ---------------------------------------------------------------------------

_DASHBOARD_CACHE: Dict[str, tuple[float, Any]] = {}
_APPOINTMENTS_CACHE: Dict[str, tuple[float, Any]] = {}
_NOTIFICATIONS_CACHE: Dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 15.0  # seconds

def _get_cached_dashboard(key: str) -> Optional[Any]:
    item = _DASHBOARD_CACHE.get(key)
    if item and time.time() - item[0] < _CACHE_TTL:
        return item[1]
    return None

def _set_cached_dashboard(key: str, data: Any):
    _DASHBOARD_CACHE[key] = (time.time(), data)

def invalidate_doctor_caches(practitioner_id: str):
    to_del_dash = [k for k in _DASHBOARD_CACHE if k.startswith(practitioner_id)]
    for k in to_del_dash:
        _DASHBOARD_CACHE.pop(k, None)
    to_del_apts = [k for k in _APPOINTMENTS_CACHE if k.startswith(practitioner_id)]
    for k in to_del_apts:
        _APPOINTMENTS_CACHE.pop(k, None)
    _PATIENTS_CACHE.pop(practitioner_id, None)
    _SETTINGS_CACHE.pop(practitioner_id, None)
    _NOTIFICATIONS_CACHE.pop(practitioner_id, None)

@router.get("/dashboard")
async def dashboard(
    day_start: datetime = Query(..., description="Start of the doctor's local today, as an ISO instant"),
    utc_offset_minutes: int = Query(330),
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    me = current_doctor["user_id"]
    cache_key = f"{me}:{day_start.isoformat()}:{utc_offset_minutes}"
    cached = _get_cached_dashboard(cache_key)
    if cached is not None:
        return cached

    now = now_utc()
    day_start = as_aware(day_start)
    day_end = day_start + timedelta(days=1)
    week_start = day_start - timedelta(days=6)
    chart_start = day_start - timedelta(days=13)

    apts = (await db.execute(
        select(Appointment).where(Appointment.practitioner_id == me, Appointment.scheduled_at.is_not(None))
    )).scalars().all()
    done = (await db.execute(
        select(Encounter).where(Encounter.practitioner_id == me, Encounter.status == "completed",
                                Encounter.end_time.is_not(None), Encounter.end_time >= chart_start)
    )).scalars().all()
    alerts = (await db.execute(
        select(Notification).where(Notification.practitioner_id == me, Notification.severity == "critical",
                                   Notification.read_at.is_(None)).order_by(desc(Notification.created_at)).limit(5)
    )).scalars().all()

    today = sorted([a for a in apts if day_start <= as_aware(a.scheduled_at) < day_end],
                   key=lambda a: as_aware(a.scheduled_at))
    upcoming = sorted(
        [a for a in apts if (a.visit_status or "scheduled") == "scheduled"
         and as_aware(a.scheduled_at) + timedelta(minutes=a.duration_minutes or 20) > now],
        key=lambda a: as_aware(a.scheduled_at),
    )

    profiles = await _profiles(db, [a.patient_id for a in apts])
    encs = await _encounters(db, [a.encounter_id for a in today + upcoming[:1]])

    offset = timedelta(minutes=utc_offset_minutes)
    per_day: Dict[str, int] = {}
    for e in done:
        key = (as_aware(e.end_time) + offset).strftime("%Y-%m-%d")
        per_day[key] = per_day.get(key, 0) + 1
    days = [(chart_start + offset + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(14)]
    scheduled_per_day: Dict[str, int] = {}
    for a in upcoming:
        key = (as_aware(a.scheduled_at) + offset).strftime("%Y-%m-%d")
        scheduled_per_day[key] = scheduled_per_day.get(key, 0) + 1
    ahead = [(day_start + offset + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    under_care = {a.patient_id for a in apts if as_aware(a.scheduled_at) >= now - timedelta(days=90)}
    nxt = upcoming[0] if upcoming else None

    result = {
        "next_appointment": appointment_out(nxt, profiles.get(nxt.patient_id), encs.get(nxt.encounter_id)) if nxt else None,
        "today": [appointment_out(a, profiles.get(a.patient_id), encs.get(a.encounter_id)) for a in today],
        "stats": {
            "today_total": len([a for a in today if a.visit_status != "cancelled"]),
            "today_completed": len([a for a in today if a.visit_status == "completed"]),
            "week_completed": len([e for e in done if as_aware(e.end_time) >= week_start]),
            "upcoming_7_days": len([a for a in upcoming if as_aware(a.scheduled_at) < day_start + timedelta(days=7)]),
            "patients_under_care": len(under_care),
        },
        "consultations_by_day": [{"date": d, "count": per_day.get(d, 0)} for d in days],
        "scheduled_by_day": [{"date": d, "count": scheduled_per_day.get(d, 0)} for d in ahead],
        "alerts": [notification_to_dict(n) for n in alerts],
    }
    _set_cached_dashboard(cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

@router.get("/appointments")
async def list_appointments(
    start: datetime,
    end: datetime,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    me = current_doctor["user_id"]
    cache_key = f"{me}:{start.isoformat()}:{end.isoformat()}"
    cached = _APPOINTMENTS_CACHE.get(cache_key)
    if cached and time.time() - cached[0] < _CACHE_TTL:
        return cached[1]

    rows = (await db.execute(
        select(Appointment).where(Appointment.practitioner_id == me,
                                  Appointment.scheduled_at >= as_aware(start), Appointment.scheduled_at < as_aware(end))
        .order_by(Appointment.scheduled_at)
    )).scalars().all()
    profiles, encs = await asyncio.gather(
        _profiles(db, [a.patient_id for a in rows]),
        _encounters(db, [a.encounter_id for a in rows])
    )
    result = [appointment_out(a, profiles.get(a.patient_id), encs.get(a.encounter_id)) for a in rows]
    _APPOINTMENTS_CACHE[cache_key] = (time.time(), result)
    return result


@router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor),
                          db: AsyncSession = Depends(get_db)):
    apt = await _own_appointment(db, appointment_id, current_doctor["user_id"])
    profile = await db.get(PatientProfile, apt.patient_id)
    enc = await db.get(Encounter, apt.encounter_id) if apt.encounter_id else None
    return appointment_out(apt, profile, enc)


class AppointmentIn(BaseModel):
    patient_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = Field(20, ge=5, le=240)
    mode: str = "Telehealth Video"
    agenda: Optional[str] = None
    status: Optional[str] = None  # 'scheduled' | 'cancelled' | 'no_show'
    utc_offset_minutes: int = 330
    force: bool = False  # book even outside available hours


async def _own_appointment(db: AsyncSession, appointment_id: str, practitioner_id: str) -> Appointment:
    apt = await db.get(Appointment, appointment_id)
    if not apt or apt.practitioner_id not in (practitioner_id, None):
        raise HTTPException(status_code=404, detail="Appointment not found")
    return apt


async def _tell_patient(apt: Appointment, event: str) -> None:
    await ws_manager.send_to([apt.patient_id], {
        "type": "appointment_event", "event": event, "patient_id": apt.patient_id,
        "appointment_id": apt.appointment_id, "doctor_name": apt.doctor_name, "date": apt.date_label,
        "time": apt.time_label, "relativeTime": apt.relative_label, "mode": apt.mode, "facility": apt.facility,
        "agenda": apt.agenda, "status": apt.status, "instructions": apt.instructions_json,
        "practitioner_id": apt.practitioner_id, "visit_status": apt.visit_status,
    })


@router.post("/appointments")
async def book_appointment(req: AppointmentIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                           db: AsyncSession = Depends(get_db)):
    if not req.patient_id or not req.scheduled_at:
        raise HTTPException(status_code=422, detail="patient_id and scheduled_at are required")
    me = current_doctor["user_id"]
    profile = await db.get(PatientProfile, req.patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    start = as_aware(req.scheduled_at)
    settings_row = await _settings_row(db, me)
    problem = _availability_problem(settings_row.availability_json or {}, start, req.duration_minutes, req.utc_offset_minutes)
    if problem and not req.force:
        raise HTTPException(status_code=409, detail=problem)
    end = start + timedelta(minutes=req.duration_minutes or 20)

    def overlaps(a: Appointment) -> bool:
        a0 = as_aware(a.scheduled_at)
        return a0 < end and a0 + timedelta(minutes=a.duration_minutes or 20) > start

    window = select(Appointment).where(
        or_(Appointment.visit_status == "scheduled", Appointment.visit_status.is_(None)),
        Appointment.status != "Cancelled by Patient",
        Appointment.status != "Cancelled by Doctor",
        Appointment.scheduled_at.is_not(None),
        Appointment.scheduled_at > start - timedelta(hours=4),
        Appointment.scheduled_at < end,
    )
    if not req.force:
        if any(overlaps(a) for a in (await db.execute(window.where(Appointment.practitioner_id == me))).scalars()):
            raise HTTPException(status_code=409, detail="You already have another appointment scheduled at this time.")
        if any(overlaps(a) for a in (await db.execute(window.where(Appointment.patient_id == profile.patient_id))).scalars()):
            raise HTTPException(status_code=409, detail="The patient already has another appointment scheduled at this time.")
    doctor = await db.get(Practitioner, me)
    date_label, time_label = labels_for(start, req.utc_offset_minutes)
    apt = Appointment(
        appointment_id=f"apt_{uuid.uuid4().hex[:10]}", patient_id=profile.patient_id, practitioner_id=me,
        doctor_name=doctor.display_name if doctor else None, specialty=doctor.specialty if doctor else None,
        facility=doctor.facility if doctor else None, date_label=date_label, time_label=time_label,
        relative_label=f"Booked for {date_label}", mode=req.mode, agenda=req.agenda or "",
        status="Pending Confirmation", scheduled_at=start, duration_minutes=req.duration_minutes,
        visit_status="scheduled", instructions_json=[], booked_by="doctor",
        department=(doctor.department or department_for_specialty(doctor.specialty)) if doctor else None,
    )
    db.add(apt)
    db.add(AuditEvent(actor_id=me, action="APPOINTMENT_BOOKED", resource_id=apt.appointment_id,
                      outcome="SUCCESS", purpose=f"{profile.full_name} · {date_label} {time_label}"))
    await db.commit()
    invalidate_doctor_caches(me)
    await _tell_patient(apt, "appointment_rescheduled")  # the patient app treats this as "appointment changed"
    return appointment_out(apt, profile)


@router.patch("/appointments/{appointment_id}")
async def change_appointment(appointment_id: str, req: AppointmentIn,
                             current_doctor: Dict[str, Any] = Depends(require_doctor),
                             db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    apt = await _own_appointment(db, appointment_id, me)
    action, detail = "APPOINTMENT_UPDATED", ""
    if req.scheduled_at:
        start = as_aware(req.scheduled_at)
        settings_row = await _settings_row(db, me)
        problem = _availability_problem(settings_row.availability_json or {}, start,
                                        req.duration_minutes, req.utc_offset_minutes)
        if problem and not req.force:
            raise HTTPException(status_code=409, detail=problem)
        end = start + timedelta(minutes=req.duration_minutes or apt.duration_minutes or 20)

        def overlaps(a: Appointment) -> bool:
            a0 = as_aware(a.scheduled_at)
            return a0 < end and a0 + timedelta(minutes=a.duration_minutes or 20) > start

        window = select(Appointment).where(
            Appointment.appointment_id != appointment_id,
            or_(Appointment.visit_status == "scheduled", Appointment.visit_status.is_(None)),
            Appointment.status != "Cancelled by Patient",
            Appointment.status != "Cancelled by Doctor",
            Appointment.scheduled_at.is_not(None),
            Appointment.scheduled_at > start - timedelta(hours=4),
            Appointment.scheduled_at < end,
        )
        if not req.force:
            if any(overlaps(a) for a in (await db.execute(window.where(Appointment.practitioner_id == me))).scalars()):
                raise HTTPException(status_code=409, detail="You already have another appointment scheduled at this time.")
            if any(overlaps(a) for a in (await db.execute(window.where(Appointment.patient_id == apt.patient_id))).scalars()):
                raise HTTPException(status_code=409, detail="The patient already has another appointment scheduled at this time.")
        apt.scheduled_at = start
        apt.duration_minutes = req.duration_minutes
        apt.date_label, apt.time_label = labels_for(start, req.utc_offset_minutes)
        apt.relative_label = f"Rescheduled to {apt.date_label}"
        apt.is_rescheduled = True
        apt.visit_status = "scheduled"
        action, detail = "APPOINTMENT_RESCHEDULED", f"Moved to {apt.date_label} {apt.time_label}"
    if req.status in ("cancelled", "no_show", "scheduled"):
        apt.visit_status = req.status
        if req.status == "cancelled":
            action, detail = "APPOINTMENT_CANCELLED", f"{apt.date_label} {apt.time_label}"
    if req.agenda is not None:
        apt.agenda = req.agenda
    apt.mode = req.mode or apt.mode
    db.add(AuditEvent(actor_id=me, action=action, resource_id=apt.appointment_id, outcome="SUCCESS", purpose=detail or None))
    await db.commit()
    invalidate_doctor_caches(me)
    await _tell_patient(apt, "appointment_rescheduled")
    profile = await db.get(PatientProfile, apt.patient_id)
    return appointment_out(apt, profile)


@router.post("/appointments/{appointment_id}/open")
async def open_appointment(appointment_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor),
                           db: AsyncSession = Depends(get_db)):
    """The consultation (call room) for this appointment, opening one if needed.

    The patient's open consultation with this doctor (or an untaken triage one) is reused, so the patient
    app finds the same call room. Consultations with the patient's other doctors are left alone."""
    me = current_doctor["user_id"]
    apt = await _own_appointment(db, appointment_id, me)
    enc, created = await ensure_encounter(db, apt, me)
    if not apt.meeting_code:
        from app.services.meetings import new_code
        apt.meeting_code = new_code()
    await db.commit()
    if created:
        # The patient app looks up its call room again and can now receive the call.
        await ws_manager.send_to([apt.patient_id], {"type": "call_room_ready", "encounter_id": enc.encounter_id,
                                                    "doctor_name": apt.doctor_name, "practitioner_id": me})
    profile = await db.get(PatientProfile, apt.patient_id)
    user = await db.get(User, apt.patient_id)
    summary = queue_style_summary(enc, profile, user)
    summary["latest_heart_rate"] = await latest_heart_rate(db, apt.patient_id)
    summary["latest_readings"] = await latest_by_kind(db, apt.patient_id)
    return {"appointment": appointment_out(apt, profile, enc), "patient": summary}


# ---------------------------------------------------------------------------
# Patients and visit history
# ---------------------------------------------------------------------------

async def _my_patient_ids(db: AsyncSession, me: str) -> set:
    ids = set((await db.execute(select(Appointment.patient_id).where(Appointment.practitioner_id == me))).scalars())
    ids |= set((await db.execute(select(Encounter.patient_id).where(Encounter.practitioner_id == me))).scalars())
    return {i for i in ids if not str(i).startswith("lab_")}       # the CHIBI Test Lab's stand-in patient


_PATIENTS_CACHE: Dict[str, tuple[float, Any]] = {}

@router.get("/patients")
async def my_patients(current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    cached = _PATIENTS_CACHE.get(me)
    if cached and time.time() - cached[0] < _CACHE_TTL:
        return cached[1]

    now = now_utc()
    ids = await _my_patient_ids(db, me)
    id_list = list(ids)

    if not id_list:
        _PATIENTS_CACHE[me] = (time.time(), [])
        return []

    profiles_task = _profiles(db, ids)
    users_task = db.execute(select(User).where(User.user_id.in_(id_list)))
    apts_task = db.execute(select(Appointment).where(Appointment.patient_id.in_(id_list)))
    encs_task = db.execute(select(Encounter).where(Encounter.patient_id.in_(id_list)))

    profiles, users_res, apts_res, encs_res = await asyncio.gather(
        profiles_task, users_task, apts_task, encs_task
    )
    users = {u.user_id: u for u in users_res.scalars()}
    apts = apts_res.scalars().all()
    encs = encs_res.scalars().all()

    out = []
    for pid, profile in profiles.items():
        mine_apts = [a for a in apts if a.patient_id == pid and a.scheduled_at]
        nxt = min((a for a in mine_apts if a.visit_status == "scheduled" and as_aware(a.scheduled_at) > now - timedelta(minutes=30)),
                  key=lambda a: as_aware(a.scheduled_at), default=None)
        past = [e for e in encs if e.patient_id == pid and e.status == "completed"]
        last = max(past, key=lambda e: as_aware(e.end_time or e.start_time), default=None)
        open_enc = next((e for e in encs if e.patient_id == pid and e.status in OPEN), None)
        out.append({
            **patient_brief(profile, users.get(pid)),
            "next_appointment": appointment_out(nxt) if nxt else None,
            "last_visit_at": as_aware(last.end_time or last.start_time) if last else None,
            "visit_count": len(past),
            "open_encounter_id": open_enc.encounter_id if open_enc else None,
            "urgency": open_enc.urgency if open_enc else None,
        })
    out.sort(key=lambda p: (p["next_appointment"] is None,
                            p["next_appointment"]["scheduled_at"] if p["next_appointment"] else now, p["full_name"]))
    _PATIENTS_CACHE[me] = (time.time(), out)
    return out


def _visit_row(enc: Encounter, note: Optional[ClinicalNote], apt: Optional[Appointment]) -> Dict[str, Any]:
    return {
        "encounter_id": enc.encounter_id,
        "started_at": as_aware(enc.start_time),
        "ended_at": as_aware(enc.end_time),
        "status": enc.status,
        "mode": enc.mode,
        "complaint": enc.symptoms_text or "",
        "diagnosis": (note.assessment if note else "") or "",
        "signed": bool(note and note.status == "clinician_approved"),
        "appointment_id": apt.appointment_id if apt else None,
    }


async def _care_team_brief(db: AsyncSession, patient_id: str, me: str, apts, encs) -> List[Dict[str, Any]]:
    """The patient's other doctors: names, departments and what they look after (no clinical details;
    their records still need the patient's consent)."""
    members = {m.practitioner_id: m for m in (await db.execute(
        select(CareTeamMember).where(CareTeamMember.patient_id == patient_id))).scalars()}
    ids = {a.practitioner_id for a in apts} | {e.practitioner_id for e in encs} | set(members)
    ids = {i for i in ids if i and i != me and not (i in members and members[i].status == "removed")}
    if not ids:
        return []
    docs = (await db.execute(select(Practitioner).where(Practitioner.practitioner_id.in_(list(ids))))).scalars().all()
    now = now_utc()
    out = []
    for d in docs:
        dept = d.department or department_for_specialty(d.specialty)
        nxt = min((as_aware(a.scheduled_at) for a in apts if a.practitioner_id == d.practitioner_id
                   and a.visit_status == "scheduled" and a.scheduled_at and as_aware(a.scheduled_at) > now), default=None)
        member = members.get(d.practitioner_id)
        out.append({"practitioner_id": d.practitioner_id, "name": d.display_name, "department": dept,
                    "department_name": department_name(dept), "facility": d.facility or "",
                    "reason": (member.reason if member else "") or "", "next_appointment_at": nxt})
    out.sort(key=lambda x: x["name"])
    return out


@router.get("/patients/{patient_id}")
async def patient_detail(patient_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor),
                         db: AsyncSession = Depends(get_db)):
    profile = await db.get(PatientProfile, patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    user = await db.get(User, patient_id)
    now = now_utc()
    encs = (await db.execute(select(Encounter).where(Encounter.patient_id == patient_id)
                             .order_by(desc(Encounter.start_time)))).scalars().all()
    notes = {n.encounter_id: n for n in (await db.execute(
        select(ClinicalNote).where(ClinicalNote.encounter_id.in_([e.encounter_id for e in encs] or [""])))).scalars()}
    apts = (await db.execute(select(Appointment).where(Appointment.patient_id == patient_id))).scalars().all()
    apt_by_enc = {a.encounter_id: a for a in apts if a.encounter_id}

    upcoming = sorted([a for a in apts if a.scheduled_at and a.visit_status == "scheduled"
                       and as_aware(a.scheduled_at) > now - timedelta(minutes=30)], key=lambda a: as_aware(a.scheduled_at))
    past = [e for e in encs if e.status == "completed"]
    past.sort(key=lambda e: as_aware(e.end_time or e.start_time), reverse=True)
    open_enc = next((e for e in encs if e.status in OPEN), None)
    chart = dict(profile.chart_json or {})
    chart.pop("nextAppointment", None)
    return {
        "care_team": await _care_team_brief(db, patient_id, current_doctor["user_id"], apts, encs),
        "patient": patient_brief(profile, user),
        "chart": chart or None,
        "upcoming": [appointment_out(a, profile) for a in upcoming],
        "past_visits": [_visit_row(e, notes.get(e.encounter_id), apt_by_enc.get(e.encounter_id)) for e in past],
        "open_consultation": queue_style_summary(open_enc, profile, user) if open_enc else None,
        "cancelled": [appointment_out(a, profile) for a in apts if a.visit_status in ("cancelled", "no_show")],
        "readings": [reading_out(r) for r in (await db.execute(
            select(VitalReading).where(VitalReading.patient_id == patient_id)
            .order_by(desc(VitalReading.created_at)).limit(40))).scalars()],
        "requests": [await _task_view(db, t) for t in (await db.execute(
            select(CareTask).where(CareTask.patient_id == patient_id, CareTask.status == "open")
            .order_by(CareTask.due_at))).scalars()],
    }


async def _task_view(db: AsyncSession, t: CareTask) -> Dict[str, Any]:
    w = await db.get(HealthWorker, t.worker_id) if t.worker_id else None
    return {"task_id": t.task_id, "kinds": t.kinds_json or [], "note": t.note or "", "due_at": as_aware(t.due_at),
            "status": t.status, "worker_name": w.display_name if w else None, "created_at": as_aware(t.created_at)}


class ReadingRequestIn(BaseModel):
    kinds: List[str] = Field(..., min_length=1)
    due_at: Optional[datetime] = None
    note: Optional[str] = Field(None, max_length=300)


@router.post("/patients/{patient_id}/requests")
async def request_readings(patient_id: str, req: ReadingRequestIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                           db: AsyncSession = Depends(get_db)):
    """Ask the patient's ASHA worker for readings on a home visit (e.g. BP before the next consultation)."""
    kinds = [k for k in req.kinds if k in LABELS and k != "heart_rate"]
    if not kinds:
        raise HTTPException(status_code=422, detail="Choose at least one reading.")
    profile = await db.get(PatientProfile, patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    # The ASHA worker covering the patient's district (first match); otherwise any ASHA worker can pick it up.
    district = str((profile.demographics_json or {}).get("district", "")).lower()
    worker = next((w for w in (await db.execute(select(HealthWorker))).scalars()
                   if w.area and w.area.split(",")[0].strip().lower() in district), None)
    task = CareTask(patient_id=patient_id, practitioner_id=current_doctor["user_id"], worker_id=worker.worker_id if worker else None,
                    kinds_json=kinds, note=req.note or "", due_at=as_aware(req.due_at) if req.due_at else now_utc() + timedelta(days=2))
    db.add(task)
    db.add(AuditEvent(actor_id=current_doctor["user_id"], action="ASHA_READINGS_REQUESTED", resource_id=patient_id, outcome="SUCCESS",
                      purpose=", ".join(LABELS[k] for k in kinds) + (f" · {worker.display_name}" if worker else " · any ASHA worker")))
    await db.commit()
    if worker:
        await ws_manager.send_to([worker.worker_id], {"type": "asha_task", "task_id": task.task_id, "patient_id": patient_id})
    return await _task_view(db, task)


@router.post("/requests/{task_id}/cancel")
async def cancel_request(task_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    task = await db.get(CareTask, task_id)
    if not task or task.practitioner_id not in (current_doctor["user_id"], None):
        raise HTTPException(status_code=404, detail="Request not found")
    task.status = "cancelled"
    await db.commit()
    return {"ok": True}


@router.get("/visits/{encounter_id}")
async def visit_detail(encounter_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor),
                       db: AsyncSession = Depends(get_db)):
    enc = await db.get(Encounter, encounter_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Visit not found")
    profile = await db.get(PatientProfile, enc.patient_id)
    doctor = await db.get(Practitioner, enc.practitioner_id) if enc.practitioner_id else None
    note = (await db.execute(select(ClinicalNote).where(ClinicalNote.encounter_id == encounter_id))).scalar_one_or_none()
    pad = await db.get(ConsultationNotepad, encounter_id)
    record = await db.get(ConsultationRecord, encounter_id)
    apt = (await db.execute(select(Appointment).where(Appointment.encounter_id == encounter_id))).scalars().first()
    events = (await db.execute(select(AuditEvent).where(AuditEvent.resource_id == encounter_id)
                               .order_by(AuditEvent.timestamp))).scalars().all()
    chat = (await db.execute(select(ChatMessage).where(ChatMessage.encounter_id == encounter_id)
                             .order_by(ChatMessage.created_at))).scalars().all()
    return {
        "encounter_id": enc.encounter_id,
        "patient": patient_brief(profile) if profile else None,
        "doctor_name": doctor.display_name if doctor else None,
        "started_at": as_aware(enc.start_time),
        "ended_at": as_aware(enc.end_time),
        "status": enc.status,
        "mode": enc.mode,
        "complaint": enc.symptoms_text or "",
        "vitals": enc.vitals_summary or "",
        "allergies": enc.allergies_json or [],
        "medications_at_visit": enc.current_meds_json or [],
        "note": {
            "subjective": note.subjective or "", "objective": note.objective or "",
            "assessment": note.assessment or "", "plan": note.plan_json or {},
            "signed_by": note.clinician_signature, "signed_at": as_aware(note.signed_at), "status": note.status,
        } if note else None,
        "notepad": pad.content if pad else "",
        "structured": (record.structured_json if record else (parse_note(pad.content) if pad and pad.content else None)),
        "coded_terms": (pad.coded_terms_json or []) if pad else [],
        "appointment": appointment_out(apt) if apt else None,
        "timeline": [{"action": e.action, "at": as_aware(e.timestamp), "detail": e.purpose or ""} for e in events],
        "messages": [{"sender": m.sender_role, "body": m.body, "translation": m.translation, "urgent": bool(m.urgent),
                      "created_at": as_aware(m.created_at)} for m in chat],
    }


@router.get("/encounters/{encounter_id}/structured")
async def structured_note(encounter_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor),
                          db: AsyncSession = Depends(get_db)):
    """The current notepad parsed into the CareBridge note format, plus a sign-off pre-fill (nothing is saved)."""
    pad = await db.get(ConsultationNotepad, encounter_id)
    st = parse_note(pad.content if pad else "")
    return {"structured": st, "prefill": soap_from_structured(st)}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@router.get("/notifications")
async def list_notifications(limit: int = Query(50, le=200), current_doctor: Dict[str, Any] = Depends(require_doctor),
                             db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    cached = _NOTIFICATIONS_CACHE.get(me)
    if cached and time.time() - cached[0] < 10.0:
        return cached[1]

    rows = (await db.execute(select(Notification).where(Notification.practitioner_id == me)
                             .order_by(desc(Notification.created_at)).limit(limit))).scalars().all()
    unread_count = (await db.execute(select(func.count(Notification.notification_id)).where(
        Notification.practitioner_id == me, Notification.read_at.is_(None)))).scalar() or 0

    result = {"items": [notification_to_dict(n) for n in rows], "unread": unread_count}
    _NOTIFICATIONS_CACHE[me] = (time.time(), result)
    return result


class MarkReadIn(BaseModel):
    ids: List[str] = []
    all: bool = False


@router.post("/notifications/read")
async def mark_read(req: MarkReadIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                    db: AsyncSession = Depends(get_db)):
    _NOTIFICATIONS_CACHE.pop(current_doctor["user_id"], None)
    stmt = update(Notification).where(Notification.practitioner_id == current_doctor["user_id"],
                                      Notification.read_at.is_(None))
    if not req.all:
        stmt = stmt.where(Notification.notification_id.in_(req.ids or [""]))
    await db.execute(stmt.values(read_at=now_utc()))
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Settings: profile, preferences, availability
# ---------------------------------------------------------------------------

class SettingsIn(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=150)
    specialty: Optional[str] = Field(None, max_length=100)
    facility: Optional[str] = Field(None, max_length=200)
    prefs: Optional[Dict[str, Any]] = None
    availability: Optional[Dict[str, Any]] = None


def _settings_out(doctor: Practitioner, row: PractitionerSettings) -> Dict[str, Any]:
    availability = {**DEFAULT_AVAILABILITY, **(row.availability_json or {})}
    return {
        "profile": {"display_name": doctor.display_name, "specialty": doctor.specialty, "facility": doctor.facility or "",
                    "registration_number": doctor.registration_number},
        "prefs": {**DEFAULT_PREFS, **(row.prefs_json or {})},
        "availability": availability,
    }


def _valid_availability(av: Dict[str, Any]) -> Dict[str, Any]:
    weekly = {}
    for day in WEEKDAYS:
        slots = []
        for s in (av.get("weekly", {}) or {}).get(day, []) or []:
            start, end = str(s.get("start", "")), str(s.get("end", ""))
            if len(start) != 5 or len(end) != 5 or start >= end:
                raise HTTPException(status_code=422, detail=f"{day}: each slot needs a start before its end (HH:MM)")
            slots.append({"start": start, "end": end})
        weekly[day] = sorted(slots, key=lambda s: s["start"])
    leaves = []
    for lv in av.get("leaves", []) or []:
        start, end = str(lv.get("start", "")), str(lv.get("end", "") or lv.get("start", ""))
        if len(start) != 10 or end < start:
            raise HTTPException(status_code=422, detail="Each leave needs a start date and an end date on or after it")
        leaves.append({"id": lv.get("id") or uuid.uuid4().hex[:8], "start": start, "end": end,
                       "reason": str(lv.get("reason", ""))[:120]})
    return {"weekly": weekly, "leaves": sorted(leaves, key=lambda l: l["start"])}


_SETTINGS_CACHE: Dict[str, tuple[float, Any]] = {}

@router.get("/settings")
async def get_settings(current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    cached = _SETTINGS_CACHE.get(me)
    if cached and time.time() - cached[0] < 60.0:
        return cached[1]

    doctor = await db.get(Practitioner, me)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    row = await _settings_row(db, doctor.practitioner_id)
    out = _settings_out(doctor, row)
    _SETTINGS_CACHE[me] = (time.time(), out)
    return out


@router.put("/settings")
async def save_settings(req: SettingsIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                        db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    _SETTINGS_CACHE.pop(me, None)
    doctor = await db.get(Practitioner, me)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    row = await _settings_row(db, doctor.practitioner_id)
    changed = []
    if req.display_name:
        doctor.display_name = req.display_name.strip(); changed.append("name")
    if req.specialty is not None:
        doctor.specialty = req.specialty.strip(); changed.append("department")
    if req.facility is not None:
        doctor.facility = req.facility.strip(); changed.append("facility")
    if req.prefs is not None:
        allowed = {k: v for k, v in req.prefs.items() if k in DEFAULT_PREFS}
        if "chat_window_days" in allowed:
            allowed["chat_window_days"] = max(1, min(30, int(allowed["chat_window_days"] or 7)))
        if "utc_offset_minutes" in allowed:
            allowed["utc_offset_minutes"] = max(-720, min(840, int(allowed["utc_offset_minutes"])))
        row.prefs_json = {**DEFAULT_PREFS, **(row.prefs_json or {}), **allowed}; changed.append("preferences")
    if req.availability is not None:
        row.availability_json = _valid_availability(req.availability); changed.append("availability")
    if changed:
        db.add(AuditEvent(actor_id=doctor.practitioner_id, action="DOCTOR_SETTINGS_UPDATED",
                          resource_id=doctor.practitioner_id, outcome="SUCCESS", purpose="Changed " + ", ".join(changed)))
    await db.commit()
    return _settings_out(doctor, row)
