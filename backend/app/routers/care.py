"""
A patient's doctors ("My Doctors"): several doctors at once, one per health issue.

  GET  /api/v1/care/departments                     OPD departments + the health issues that lead to them
  GET  /api/v1/care/doctors?department=cardiology   doctors in a department, with their next free slot
  GET  /api/v1/care/doctors/{id}/slots?days=7       free OPD slots (from the doctor's working hours)
  POST /api/v1/care/appointments                    (patient) book a slot; confirmed instantly
  GET  /api/v1/care/appointments                    (patient) all appointments with all doctors
  POST /api/v1/care/appointments/{id}/cancel        (patient) cancel one
  GET  /api/v1/care/my-doctors                      (patient) every doctor they see, with next/last visit
  GET  /api/v1/care/my-doctors/{id}                 (patient) one doctor: visits, notes, medicines
  POST /api/v1/care/my-doctors/{id}/remove          (patient) stop seeing a doctor (hides them from the list)

Booking with a doctor adds them to the patient's care team. A slot is free when it is inside the doctor's
working hours (doctor portal settings), not on leave, not in the past and not already booked.
"""
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.care_catalog import DEPARTMENTS, DEPARTMENT_BY_ID, HEALTH_ISSUES, ISSUE_BY_ID, department_for_specialty
from app.database import get_db
from app.models.models import (
    Appointment, AuditEvent, CareTeamMember, ChatMessage, ClinicalNote, Encounter, PatientProfile, Practitioner,
    PractitionerSettings,
)
from app.routers.doctor import DEFAULT_AVAILABILITY, DEFAULT_PREFS, WEEKDAYS, _availability_problem, labels_for
from app.services.auth_dependencies import require_patient
from app.services.connection_manager import ws_manager
from app.services.notifications import notify
from app.services.serializers import appointment_to_dict, as_aware

router = APIRouter(prefix="/care", tags=["my doctors"])

SLOT_MINUTES = 20
MIN_LEAD_MINUTES = 30      # earliest bookable slot is this far from now
MAX_DAYS_AHEAD = 30
MODES = {"video": "Telehealth Video", "in_person": "In-Person OPD"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def department_of(doc: Practitioner) -> str:
    return doc.department or department_for_specialty(doc.specialty)


def prescriber_key(name: Optional[str]) -> str:
    """'Dr. C. R. Patil (MS, MCh Urology)' and 'Dr. C. R. Patil' -> 'crpatil' (to match prescriptions to doctors)."""
    name = re.sub(r"\(.*?\)", "", name or "").lower()
    name = re.sub(r"^\s*dr\.?\s*", "", name)
    return re.sub(r"[^a-z]", "", name)


def doctor_card(doc: Practitioner) -> Dict[str, Any]:
    return {
        "practitioner_id": doc.practitioner_id,
        "name": doc.display_name,
        "specialty": doc.specialty,
        "department": department_of(doc),
        "facility": doc.facility or "",
        "experience_years": doc.experience_years,
        "languages": doc.languages_json or [],
        "registration_number": doc.registration_number,
    }


# ---------------------------------------------------------------------------
# Free slots
# ---------------------------------------------------------------------------

async def _hours(db: AsyncSession, practitioner_id: str) -> tuple[Dict[str, Any], int]:
    row = await db.get(PractitionerSettings, practitioner_id)
    availability = (row.availability_json if row else None) or DEFAULT_AVAILABILITY
    prefs = {**DEFAULT_PREFS, **((row.prefs_json if row else None) or {})}
    return availability, int(prefs.get("utc_offset_minutes") or 330)


async def free_slots(db: AsyncSession, practitioner_id: str, first_day: Optional[date] = None,
                     days: int = 7, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """[{date: 'YYYY-MM-DD', slots: [{start: <utc>, time: '9:00 AM'}]}] for `days` days from `first_day`.
    Filters out slots where either the doctor OR the patient already has an active scheduled appointment."""
    availability, offset = await _hours(db, practitioner_id)
    tz = timezone(timedelta(minutes=offset))
    now = now_utc()
    earliest = now + timedelta(minutes=MIN_LEAD_MINUTES)
    first_day = first_day or now.astimezone(tz).date()
    range_start = datetime.combine(first_day, datetime.min.time(), tzinfo=tz)
    range_end = range_start + timedelta(days=days)
    range_start_utc = range_start.astimezone(timezone.utc)
    range_end_utc = range_end.astimezone(timezone.utc)

    booked_stmt = select(Appointment).where(
        or_(Appointment.visit_status == "scheduled", Appointment.visit_status.is_(None)),
        Appointment.status != "Cancelled by Patient",
        Appointment.status != "Cancelled by Doctor",
        Appointment.scheduled_at.is_not(None),
        Appointment.scheduled_at >= range_start_utc - timedelta(hours=4),
        Appointment.scheduled_at < range_end_utc,
    )
    if patient_id:
        booked_stmt = booked_stmt.where(
            or_(Appointment.practitioner_id == practitioner_id, Appointment.patient_id == patient_id)
        )
    else:
        booked_stmt = booked_stmt.where(Appointment.practitioner_id == practitioner_id)

    booked = [
        (as_aware(a.scheduled_at), as_aware(a.scheduled_at) + timedelta(minutes=a.duration_minutes or SLOT_MINUTES))
        for a in (await db.execute(booked_stmt)).scalars()
        if a.scheduled_at is not None
    ]
    leaves = availability.get("leaves", [])
    out = []
    for i in range(days):
        day = first_day + timedelta(days=i)
        iso = day.isoformat()
        slots: List[Dict[str, Any]] = []
        on_leave = any(lv.get("start", "") <= iso <= lv.get("end", "") for lv in leaves)
        windows = [] if on_leave else availability.get("weekly", {}).get(WEEKDAYS[day.weekday()], [])
        for win in windows:
            try:
                h1, m1 = map(int, win["start"].split(":"))
                h2, m2 = map(int, win["end"].split(":"))
            except (KeyError, ValueError):
                continue
            t = datetime(day.year, day.month, day.day, h1, m1, tzinfo=tz)
            end = datetime(day.year, day.month, day.day, h2, m2, tzinfo=tz)
            while t + timedelta(minutes=SLOT_MINUTES) <= end:
                t_end = t + timedelta(minutes=SLOT_MINUTES)
                if t >= earliest and not any(b0 < t_end and b1 > t for b0, b1 in booked):
                    utc = t.astimezone(timezone.utc)
                    slots.append({"start": utc, "time": labels_for(utc, offset)[1]})
                t = t_end
        out.append({"date": iso, "slots": slots})
    return out


async def _next_free(db: AsyncSession, practitioner_id: str, patient_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    for day in await free_slots(db, practitioner_id, days=14, patient_id=patient_id):
        if day["slots"]:
            return {"date": day["date"], **day["slots"][0]}
    return None


# ---------------------------------------------------------------------------
# Directory
# ---------------------------------------------------------------------------

@router.get("/departments")
async def departments(current_patient: Dict[str, Any] = Depends(require_patient), db: AsyncSession = Depends(get_db)):
    """Departments (with how many doctors each has) and the health issues the patient picks from."""
    docs = (await db.execute(select(Practitioner).where(Practitioner.credential_status == "verified"))).scalars().all()
    counts: Dict[str, int] = {}
    for d in docs:
        counts[department_of(d)] = counts.get(department_of(d), 0) + 1
    return {
        "departments": [{**d, "doctor_count": counts.get(d["id"], 0)} for d in DEPARTMENTS],
        "issues": HEALTH_ISSUES,
    }


@router.get("/doctors")
async def doctors(department: Optional[str] = None, current_patient: Dict[str, Any] = Depends(require_patient),
                  db: AsyncSession = Depends(get_db)):
    if department and department not in DEPARTMENT_BY_ID:
        raise HTTPException(status_code=404, detail="Unknown department")
    docs = (await db.execute(select(Practitioner).where(Practitioner.credential_status == "verified")
                             .order_by(Practitioner.display_name))).scalars().all()
    docs = [d for d in docs if not department or department_of(d) == department]
    mine = set((await db.execute(select(CareTeamMember.practitioner_id).where(
        CareTeamMember.patient_id == current_patient["user_id"], CareTeamMember.status == "active"))).scalars())
    out = []
    for d in docs:
        out.append({**doctor_card(d), "next_free": await _next_free(db, d.practitioner_id, current_patient["user_id"]),
                    "in_my_doctors": d.practitioner_id in mine})
    # Doctors with an earlier free slot first; fully booked ones last
    out.sort(key=lambda d: (d["next_free"] is None, d["next_free"]["start"] if d["next_free"] else now_utc()))
    return out


@router.get("/doctors/{practitioner_id}/slots")
async def doctor_slots(practitioner_id: str, start: Optional[date] = None, days: int = Query(7, ge=1, le=14),
                       current_patient: Dict[str, Any] = Depends(require_patient), db: AsyncSession = Depends(get_db)):
    doc = await db.get(Practitioner, practitioner_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"doctor": doctor_card(doc), "days": await free_slots(db, practitioner_id, start, days, patient_id=current_patient["user_id"])}


# ---------------------------------------------------------------------------
# Booking and the patient's schedule
# ---------------------------------------------------------------------------

class BookIn(BaseModel):
    practitioner_id: str
    scheduled_at: datetime
    mode: str = "video"                      # 'video' | 'in_person'
    issue_id: Optional[str] = None           # health issue the patient picked
    reason: Optional[str] = Field(None, max_length=200)   # in their words, e.g. "BP is high in the mornings"


def _apt_out(apt: Appointment) -> Dict[str, Any]:
    return appointment_to_dict(apt)


@router.post("/appointments")
async def book(req: BookIn, current_patient: Dict[str, Any] = Depends(require_patient), db: AsyncSession = Depends(get_db)):
    patient_id = current_patient["user_id"]
    profile = await db.get(PatientProfile, patient_id)
    doc = await db.get(Practitioner, req.practitioner_id)
    if not profile or not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if req.mode not in MODES:
        raise HTTPException(status_code=422, detail="mode must be 'video' or 'in_person'")
    start = as_aware(req.scheduled_at)
    if start < now_utc() + timedelta(minutes=MIN_LEAD_MINUTES - 5):
        raise HTTPException(status_code=409, detail="This time has already passed. Please pick another slot.")
    if start > now_utc() + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(status_code=409, detail=f"You can book up to {MAX_DAYS_AHEAD} days ahead.")
    availability, offset = await _hours(db, doc.practitioner_id)
    if _availability_problem(availability, start, SLOT_MINUTES, offset):
        raise HTTPException(status_code=409, detail="The doctor is not available at this time. Please pick another slot.")
    end = start + timedelta(minutes=SLOT_MINUTES)

    def overlaps(a: Appointment) -> bool:
        a0 = as_aware(a.scheduled_at)
        return a0 < end and a0 + timedelta(minutes=a.duration_minutes or SLOT_MINUTES) > start

    window = select(Appointment).where(Appointment.visit_status == "scheduled",
                                       Appointment.scheduled_at > start - timedelta(hours=4),
                                       Appointment.scheduled_at < end)
    if any(overlaps(a) for a in (await db.execute(window.where(Appointment.practitioner_id == doc.practitioner_id))).scalars()):
        raise HTTPException(status_code=409, detail="Someone just booked this slot. Please pick another one.")
    if any(overlaps(a) for a in (await db.execute(window.where(Appointment.patient_id == patient_id))).scalars()):
        raise HTTPException(status_code=409, detail="You already have another appointment at this time.")

    dept = department_of(doc)
    issue = ISSUE_BY_ID.get(req.issue_id or "")
    reason = (req.reason or "").strip() or (issue["label"]["en"] if issue else "")
    date_label, time_label = labels_for(start, offset)
    apt = Appointment(
        appointment_id=f"apt_{uuid.uuid4().hex[:10]}", patient_id=patient_id, practitioner_id=doc.practitioner_id,
        doctor_name=doc.display_name, specialty=doc.specialty, facility=doc.facility, department=dept,
        date_label=date_label, time_label=time_label, relative_label=f"Booked for {date_label}",
        mode=MODES[req.mode], agenda=reason or "Consultation", status="Confirmed by Patient", instructions_json=[],
        scheduled_at=start, duration_minutes=SLOT_MINUTES, visit_status="scheduled", booked_by="patient",
    )
    db.add(apt)

    member = (await db.execute(select(CareTeamMember).where(
        CareTeamMember.patient_id == patient_id, CareTeamMember.practitioner_id == doc.practitioner_id))).scalar_one_or_none()
    is_new_doctor = member is None or member.status != "active"
    if member is None:
        member = CareTeamMember(patient_id=patient_id, practitioner_id=doc.practitioner_id, added_by="patient")
        db.add(member)
    member.status = "active"
    member.department = dept
    if issue and (is_new_doctor or not member.issue_id):
        member.issue_id = issue["id"]
    if reason and (is_new_doctor or not member.reason):
        member.reason = reason[:200]

    db.add(AuditEvent(actor_id=f"patient:{patient_id}", action="APPOINTMENT_BOOKED_BY_PATIENT",
                      resource_id=apt.appointment_id, outcome="SUCCESS",
                      purpose=f"{doc.display_name} · {DEPARTMENT_BY_ID[dept]['name']['en']} · {date_label} {time_label}"))
    await db.commit()
    await db.refresh(apt)

    await notify(kind="appointment", severity="info", practitioner_ids=[doc.practitioner_id],
                 title=f"{'New patient' if is_new_doctor else 'Appointment booked'}: {profile.full_name}",
                 body=f"{date_label} {time_label} · {MODES[req.mode]}" + (f" · {reason}" if reason else ""),
                 link={"page": "patient", "patient_id": patient_id, "tab": "visits"})
    event = {"type": "appointment_event", "event": "appointment_booked", "patient_id": patient_id,
             "appointment_id": apt.appointment_id, "practitioner_id": doc.practitioner_id}
    await ws_manager.send_to([patient_id, doc.practitioner_id], event)
    return {"appointment": _apt_out(apt), "new_doctor": is_new_doctor}


@router.get("/appointments")
async def my_appointments(current_patient: Dict[str, Any] = Depends(require_patient), db: AsyncSession = Depends(get_db)):
    """Every appointment with every doctor: upcoming (soonest first) and past (latest first)."""
    rows = (await db.execute(select(Appointment).where(Appointment.patient_id == current_patient["user_id"]))).scalars().all()
    cutoff = now_utc() - timedelta(minutes=30)
    upcoming, past = [], []
    for a in rows:
        start = as_aware(a.scheduled_at)
        if (a.visit_status or "scheduled") == "scheduled" and start and start >= cutoff:
            upcoming.append(a)
        elif start:
            past.append(a)
    upcoming.sort(key=lambda a: as_aware(a.scheduled_at))
    past.sort(key=lambda a: as_aware(a.scheduled_at), reverse=True)
    return {"upcoming": [_apt_out(a) for a in upcoming], "past": [_apt_out(a) for a in past[:30]]}


@router.post("/appointments/{appointment_id}/cancel")
async def cancel(appointment_id: str, current_patient: Dict[str, Any] = Depends(require_patient),
                 db: AsyncSession = Depends(get_db)):
    patient_id = current_patient["user_id"]
    apt = await db.get(Appointment, appointment_id)
    if not apt or apt.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if apt.visit_status != "scheduled":
        raise HTTPException(status_code=409, detail="Only upcoming appointments can be cancelled.")
    apt.visit_status = "cancelled"
    apt.status = "Cancelled by Patient"
    db.add(AuditEvent(actor_id=f"patient:{patient_id}", action="APPOINTMENT_CANCELLED_BY_PATIENT",
                      resource_id=apt.appointment_id, outcome="SUCCESS", purpose=f"{apt.date_label} {apt.time_label}"))
    await db.commit()
    if apt.practitioner_id:
        await notify(kind="appointment", severity="warning", practitioner_ids=[apt.practitioner_id],
                     title=f"Appointment cancelled by {current_patient.get('name') or 'the patient'}",
                     body=f"{apt.date_label} {apt.time_label} · {apt.agenda or ''}".strip(" ·"),
                     link={"page": "patient", "patient_id": patient_id, "tab": "visits"})
    await ws_manager.send_to([patient_id] + ([apt.practitioner_id] if apt.practitioner_id else []), {
        "type": "appointment_event", "event": "appointment_cancelled", "patient_id": patient_id,
        "appointment_id": apt.appointment_id, "practitioner_id": apt.practitioner_id})
    return _apt_out(apt)


# ---------------------------------------------------------------------------
# My Doctors
# ---------------------------------------------------------------------------

async def _care_team(db: AsyncSession, patient_id: str):
    """(doctors by id, care-team rows by doctor id): doctors the patient added, plus any doctor who has
    booked or seen them, minus the ones the patient removed."""
    members = {m.practitioner_id: m for m in (await db.execute(
        select(CareTeamMember).where(CareTeamMember.patient_id == patient_id))).scalars()}
    ids = set((await db.execute(select(Appointment.practitioner_id).where(Appointment.patient_id == patient_id))).scalars())
    ids |= set((await db.execute(select(Encounter.practitioner_id).where(Encounter.patient_id == patient_id))).scalars())
    ids |= set(members)
    ids.discard(None)
    ids = {i for i in ids if not (i in members and members[i].status == "removed")}
    docs = {d.practitioner_id: d for d in (await db.execute(
        select(Practitioner).where(Practitioner.practitioner_id.in_(list(ids) or [""])))).scalars()}
    return docs, members


def _prescriptions_by(profile: Optional[PatientProfile], doc: Practitioner) -> List[Dict[str, Any]]:
    key = prescriber_key(doc.display_name)
    out = []
    for rx in ((profile.chart_json if profile else None) or {}).get("prescriptions", []):
        if rx.get("status", "Active") == "Active" and key and prescriber_key(rx.get("prescribedBy")) == key:
            out.append({k: rx.get(k) for k in ("id", "name", "short_name", "purpose_patient", "form", "instructions",
                                               "dosage", "frequency", "timing", "duration", "purpose", "prescribedDate")})
    return out


@router.get("/my-doctors")
async def my_doctors(current_patient: Dict[str, Any] = Depends(require_patient), db: AsyncSession = Depends(get_db)):
    patient_id = current_patient["user_id"]
    profile = await db.get(PatientProfile, patient_id)
    docs, members = await _care_team(db, patient_id)
    apts = (await db.execute(select(Appointment).where(Appointment.patient_id == patient_id))).scalars().all()
    encs = (await db.execute(select(Encounter).where(Encounter.patient_id == patient_id,
                                                     Encounter.status == "completed"))).scalars().all()
    unread = (await db.execute(select(ChatMessage.practitioner_id).where(
        ChatMessage.patient_id == patient_id, ChatMessage.sender_role == "doctor", ChatMessage.read_at.is_(None)))).scalars().all()
    cutoff = now_utc() - timedelta(minutes=30)
    out = []
    for pid, doc in docs.items():
        member = members.get(pid)
        upcoming = sorted((a for a in apts if a.practitioner_id == pid and a.visit_status == "scheduled"
                           and a.scheduled_at and as_aware(a.scheduled_at) >= cutoff), key=lambda a: as_aware(a.scheduled_at))
        visits = [e for e in encs if e.practitioner_id == pid]
        last = max(visits, key=lambda e: as_aware(e.end_time or e.start_time), default=None)
        out.append({
            **doctor_card(doc),
            "reason": (member.reason if member else None) or "",
            "issue_id": member.issue_id if member else None,
            "added_at": as_aware(member.created_at) if member else None,
            "next_appointment": _apt_out(upcoming[0]) if upcoming else None,
            "upcoming_count": len(upcoming),
            "last_visit_at": as_aware(last.end_time or last.start_time) if last else None,
            "visit_count": len(visits),
            "medicines_count": len(_prescriptions_by(profile, doc)),
            "unread_messages": sum(1 for u in unread if u == pid),
        })
    far = now_utc() + timedelta(days=3650)
    out.sort(key=lambda d: (as_aware(d["next_appointment"]["scheduledAt"]) if d["next_appointment"] else far,
                            d["name"]))
    return out


@router.get("/my-doctors/{practitioner_id}")
async def my_doctor_detail(practitioner_id: str, current_patient: Dict[str, Any] = Depends(require_patient),
                           db: AsyncSession = Depends(get_db)):
    patient_id = current_patient["user_id"]
    docs, members = await _care_team(db, patient_id)
    doc = docs.get(practitioner_id)
    if not doc:
        raise HTTPException(status_code=404, detail="This doctor is not in your list.")
    profile = await db.get(PatientProfile, patient_id)
    member = members.get(practitioner_id)
    apts = (await db.execute(select(Appointment).where(
        Appointment.patient_id == patient_id, Appointment.practitioner_id == practitioner_id))).scalars().all()
    cutoff = now_utc() - timedelta(minutes=30)
    upcoming = sorted((a for a in apts if a.visit_status == "scheduled" and a.scheduled_at
                       and as_aware(a.scheduled_at) >= cutoff), key=lambda a: as_aware(a.scheduled_at))
    encs = (await db.execute(select(Encounter).where(
        Encounter.patient_id == patient_id, Encounter.practitioner_id == practitioner_id, Encounter.status == "completed")
        .order_by(desc(Encounter.start_time)))).scalars().all()
    notes = {n.encounter_id: n for n in (await db.execute(select(ClinicalNote).where(
        ClinicalNote.encounter_id.in_([e.encounter_id for e in encs] or [""]),
        ClinicalNote.status == "clinician_approved"))).scalars()}
    visits = []
    for e in encs:
        note = notes.get(e.encounter_id)
        plan = (note.plan_json if note else None) or {}
        visits.append({
            "encounter_id": e.encounter_id,
            "date": as_aware(e.end_time or e.start_time),
            "mode": e.mode,
            "complaint": e.symptoms_text or "",
            "diagnosis": (note.assessment if note else "") or "",
            "medicine": plan.get("medicine") or "",
            "advice": plan.get("advice") or "",
            "follow_up": plan.get("follow_up") or "",
        })
    return {
        "doctor": {**doctor_card(doc), "reason": (member.reason if member else None) or "",
                   "issue_id": member.issue_id if member else None},
        "upcoming": [_apt_out(a) for a in upcoming],
        "visits": visits,
        "cancelled": [_apt_out(a) for a in sorted(apts, key=lambda a: as_aware(a.scheduled_at) or cutoff, reverse=True)
                      if a.visit_status in ("cancelled", "no_show")][:5],
        "medicines": _prescriptions_by(profile, doc),
        "next_free": await _next_free(db, practitioner_id, patient_id),
    }


@router.post("/my-doctors/{practitioner_id}/remove")
async def remove_doctor(practitioner_id: str, current_patient: Dict[str, Any] = Depends(require_patient),
                        db: AsyncSession = Depends(get_db)):
    """Hide a doctor from My Doctors. Upcoming appointments with them must be cancelled first."""
    patient_id = current_patient["user_id"]
    upcoming = (await db.execute(select(Appointment).where(
        Appointment.patient_id == patient_id, Appointment.practitioner_id == practitioner_id,
        Appointment.visit_status == "scheduled", Appointment.scheduled_at >= now_utc()))).scalars().first()
    if upcoming:
        raise HTTPException(status_code=409, detail="Cancel your upcoming appointment with this doctor first.")
    member = (await db.execute(select(CareTeamMember).where(
        CareTeamMember.patient_id == patient_id, CareTeamMember.practitioner_id == practitioner_id))).scalar_one_or_none()
    if not member:
        doc = await db.get(Practitioner, practitioner_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found")
        member = CareTeamMember(patient_id=patient_id, practitioner_id=practitioner_id, department=department_of(doc),
                                added_by="system")
        db.add(member)
    member.status = "removed"
    db.add(AuditEvent(actor_id=f"patient:{patient_id}", action="CARE_TEAM_DOCTOR_REMOVED",
                      resource_id=practitioner_id, outcome="SUCCESS"))
    await db.commit()
    return {"ok": True}
