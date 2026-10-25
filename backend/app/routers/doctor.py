"""
Doctor portal API: home dashboard, appointment calendar, patients, visit history, notifications, settings.

Times are stored in UTC. The portal sends the doctor's local day boundaries / UTC offset where a
"day" matters (the server has no time-zone database), so "today" is always the doctor's today.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    Appointment, AuditEvent, ClinicalNote, ConsultationNotepad, Encounter, Notification,
    PatientProfile, Practitioner, PractitionerSettings, User,
)
from app.services.auth_dependencies import require_doctor
from app.services.connection_manager import ws_manager
from app.services.notifications import notification_to_dict
from app.services.serializers import as_aware, wait_label

router = APIRouter(prefix="/doctor", tags=["doctor portal"])

OPEN = ("queued", "in_progress")
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DEFAULT_PREFS = {"language": "en", "date_format": "DD MMM YYYY", "time_format": "12h", "timezone": "Asia/Kolkata"}
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

@router.get("/dashboard")
async def dashboard(
    day_start: datetime = Query(..., description="Start of the doctor's local today, as an ISO instant"),
    utc_offset_minutes: int = Query(330),
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    me = current_doctor["user_id"]
    now = now_utc()
    day_start = as_aware(day_start)
    day_end = day_start + timedelta(days=1)
    week_start = day_start - timedelta(days=6)
    chart_start = day_start - timedelta(days=13)

    apts = (await db.execute(
        select(Appointment).where(Appointment.practitioner_id == me, Appointment.scheduled_at.is_not(None))
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

    done = (await db.execute(
        select(Encounter).where(Encounter.practitioner_id == me, Encounter.status == "completed",
                                Encounter.end_time.is_not(None), Encounter.end_time >= chart_start)
    )).scalars().all()
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
    alerts = (await db.execute(
        select(Notification).where(Notification.practitioner_id == me, Notification.severity == "critical",
                                   Notification.read_at.is_(None)).order_by(desc(Notification.created_at)).limit(5)
    )).scalars().all()

    nxt = upcoming[0] if upcoming else None
    return {
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
    rows = (await db.execute(
        select(Appointment).where(Appointment.practitioner_id == current_doctor["user_id"],
                                  Appointment.scheduled_at >= as_aware(start), Appointment.scheduled_at < as_aware(end))
        .order_by(Appointment.scheduled_at)
    )).scalars().all()
    profiles = await _profiles(db, [a.patient_id for a in rows])
    encs = await _encounters(db, [a.encounter_id for a in rows])
    return [appointment_out(a, profiles.get(a.patient_id), encs.get(a.encounter_id)) for a in rows]


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
    doctor = await db.get(Practitioner, me)
    date_label, time_label = labels_for(start, req.utc_offset_minutes)
    apt = Appointment(
        appointment_id=f"apt_{uuid.uuid4().hex[:10]}", patient_id=profile.patient_id, practitioner_id=me,
        doctor_name=doctor.display_name if doctor else None, specialty=doctor.specialty if doctor else None,
        facility=doctor.facility if doctor else None, date_label=date_label, time_label=time_label,
        relative_label=f"Booked for {date_label}", mode=req.mode, agenda=req.agenda or "",
        status="Pending Confirmation", scheduled_at=start, duration_minutes=req.duration_minutes,
        visit_status="scheduled", instructions_json=[],
    )
    db.add(apt)
    db.add(AuditEvent(actor_id=me, action="APPOINTMENT_BOOKED", resource_id=apt.appointment_id,
                      outcome="SUCCESS", purpose=f"{profile.full_name} · {date_label} {time_label}"))
    await db.commit()
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
    await _tell_patient(apt, "appointment_rescheduled")
    profile = await db.get(PatientProfile, apt.patient_id)
    return appointment_out(apt, profile)


@router.post("/appointments/{appointment_id}/open")
async def open_appointment(appointment_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor),
                           db: AsyncSession = Depends(get_db)):
    """The consultation (call room) for this appointment, opening one if needed.

    The patient app joins the patient's oldest open consultation, so an existing open one is reused."""
    me = current_doctor["user_id"]
    apt = await _own_appointment(db, appointment_id, me)
    enc = await db.get(Encounter, apt.encounter_id) if apt.encounter_id else None
    created = False
    if not enc or enc.status not in OPEN:
        enc = (await db.execute(
            select(Encounter).where(Encounter.patient_id == apt.patient_id, Encounter.status.in_(OPEN))
            .order_by(Encounter.start_time)
        )).scalars().first()
    if not enc:
        profile = await db.get(PatientProfile, apt.patient_id)
        chart = (profile.chart_json if profile else None) or {}
        enc = Encounter(
            encounter_id=f"enc_{uuid.uuid4().hex[:8]}", patient_id=apt.patient_id, practitioner_id=me,
            mode="video" if "video" in (apt.mode or "").lower() else "audio", status="queued", urgency="routine",
            symptoms_text=apt.agenda or "",
            allergies_json=[a.get("allergen") for a in chart.get("allergies", []) if a.get("allergen")],
            current_meds_json=[f"{rx.get('name')} {rx.get('dosage') or ''}".strip()
                               for rx in chart.get("prescriptions", []) if rx.get("status", "Active") == "Active"],
        )
        db.add(enc)
        created = True
    apt.encounter_id = enc.encounter_id
    enc.practitioner_id = enc.practitioner_id or me
    if created:
        db.add(AuditEvent(actor_id=me, action="CONSULTATION_OPENED", resource_id=enc.encounter_id,
                          outcome="SUCCESS", purpose=f"For appointment {apt.appointment_id}"))
    await db.commit()
    if created:
        # The patient app looks up its call room again and can now receive the call.
        await ws_manager.send_to([apt.patient_id], {"type": "call_room_ready", "encounter_id": enc.encounter_id})
    profile = await db.get(PatientProfile, apt.patient_id)
    user = await db.get(User, apt.patient_id)
    return {"appointment": appointment_out(apt, profile, enc), "patient": queue_style_summary(enc, profile, user)}


# ---------------------------------------------------------------------------
# Patients and visit history
# ---------------------------------------------------------------------------

async def _my_patient_ids(db: AsyncSession, me: str) -> set:
    ids = set((await db.execute(select(Appointment.patient_id).where(Appointment.practitioner_id == me))).scalars())
    ids |= set((await db.execute(select(Encounter.patient_id).where(Encounter.practitioner_id == me))).scalars())
    return ids


@router.get("/patients")
async def my_patients(current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    now = now_utc()
    ids = await _my_patient_ids(db, me)
    profiles = await _profiles(db, ids)
    users = {u.user_id: u for u in (await db.execute(select(User).where(User.user_id.in_(list(ids))))).scalars()} if ids else {}
    apts = (await db.execute(select(Appointment).where(Appointment.patient_id.in_(list(ids))))).scalars().all() if ids else []
    encs = (await db.execute(select(Encounter).where(Encounter.patient_id.in_(list(ids))))).scalars().all() if ids else []

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
        "patient": patient_brief(profile, user),
        "chart": chart or None,
        "upcoming": [appointment_out(a, profile) for a in upcoming],
        "past_visits": [_visit_row(e, notes.get(e.encounter_id), apt_by_enc.get(e.encounter_id)) for e in past],
        "open_consultation": queue_style_summary(open_enc, profile, user) if open_enc else None,
        "cancelled": [appointment_out(a, profile) for a in apts if a.visit_status in ("cancelled", "no_show")],
    }


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
    apt = (await db.execute(select(Appointment).where(Appointment.encounter_id == encounter_id))).scalars().first()
    events = (await db.execute(select(AuditEvent).where(AuditEvent.resource_id == encounter_id)
                               .order_by(AuditEvent.timestamp))).scalars().all()
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
        "coded_terms": (pad.coded_terms_json or []) if pad else [],
        "appointment": appointment_out(apt) if apt else None,
        "timeline": [{"action": e.action, "at": as_aware(e.timestamp), "detail": e.purpose or ""} for e in events],
    }


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@router.get("/notifications")
async def list_notifications(limit: int = Query(50, le=200), current_doctor: Dict[str, Any] = Depends(require_doctor),
                             db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    rows = (await db.execute(select(Notification).where(Notification.practitioner_id == me)
                             .order_by(desc(Notification.created_at)).limit(limit))).scalars().all()
    unread = (await db.execute(select(Notification.notification_id).where(
        Notification.practitioner_id == me, Notification.read_at.is_(None)))).scalars().all()
    return {"items": [notification_to_dict(n) for n in rows], "unread": len(unread)}


class MarkReadIn(BaseModel):
    ids: List[str] = []
    all: bool = False


@router.post("/notifications/read")
async def mark_read(req: MarkReadIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                    db: AsyncSession = Depends(get_db)):
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


@router.get("/settings")
async def get_settings(current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    doctor = await db.get(Practitioner, current_doctor["user_id"])
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    row = await _settings_row(db, doctor.practitioner_id)
    await db.commit()
    return _settings_out(doctor, row)


@router.put("/settings")
async def save_settings(req: SettingsIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                        db: AsyncSession = Depends(get_db)):
    doctor = await db.get(Practitioner, current_doctor["user_id"])
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
        row.prefs_json = {**DEFAULT_PREFS, **(row.prefs_json or {}), **allowed}; changed.append("preferences")
    if req.availability is not None:
        row.availability_json = _valid_availability(req.availability); changed.append("availability")
    if changed:
        db.add(AuditEvent(actor_id=doctor.practitioner_id, action="DOCTOR_SETTINGS_UPDATED",
                          resource_id=doctor.practitioner_id, outcome="SUCCESS", purpose="Changed " + ", ".join(changed)))
    await db.commit()
    return _settings_out(doctor, row)
