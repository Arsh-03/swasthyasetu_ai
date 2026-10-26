"""
Patient ↔ doctor chat, tied to consultations.

  GET  /api/v1/chat/threads                    my conversations (doctor: patients · patient: doctors)
  GET  /api/v1/chat/threads/{other_id}         one conversation: messages + whether the patient can write
  POST /api/v1/chat/threads/{other_id}/messages
  POST /api/v1/chat/threads/{other_id}/read
  GET  /api/v1/chat/unread                     unread count (badge)

Rules
- A patient can write while the chat is open: an upcoming appointment, an open consultation, a visit in the
  last N days (doctor setting `chat_window_days`, default 7), or a doctor message in the last 48 hours.
  The doctor can always write.
- Patient messages with emergency words are flagged: the patient is told to call 108, the doctor gets an
  urgent alert. Chat is never the emergency channel.
- Messages are part of the record: stored, linked to the visit, and logged in the audit trail.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    Appointment, AuditEvent, ChatMessage, Encounter, PatientProfile, Practitioner, PractitionerSettings,
)
from app.services.auth_dependencies import get_current_user
from app.services.connection_manager import ws_manager
from app.services.notifications import notify
from app.services.serializers import as_aware
from app.services.translation_service import translation_engine

router = APIRouter(prefix="/chat", tags=["chat"])

DEFAULT_WINDOW_DAYS = 7
DOCTOR_REPLY_HOURS = 48
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

# Words that mean "this is an emergency" in English, Kannada and Hindi (matched case-insensitively).
EMERGENCY_WORDS = [
    "chest pain", "can't breathe", "cannot breathe", "cant breathe", "not breathing", "breathless", "unconscious",
    "fainted", "fainting", "seizure", "fits", "convulsion", "heavy bleeding", "bleeding a lot", "vomiting blood",
    "blood in vomit", "stroke", "paralysis", "suicide", "kill myself", "end my life", "poison", "overdose",
    "severe pain", "heart attack",
    "ಎದೆ ನೋವು", "ಉಸಿರಾಡಲು ಆಗುತ್ತಿಲ್ಲ", "ಉಸಿರು ಕಟ್ಟು", "ಪ್ರಜ್ಞೆ ತಪ್ಪಿ", "ಮೂರ್ಛೆ", "ಫಿಟ್ಸ್", "ತುಂಬಾ ರಕ್ತ",
    "ರಕ್ತ ವಾಂತಿ", "ಪಾರ್ಶ್ವವಾಯು", "ಆತ್ಮಹತ್ಯೆ", "ವಿಷ", "ಹೃದಯಾಘಾತ",
    "सीने में दर्द", "छाती में दर्द", "सांस नहीं", "साँस नहीं", "सांस लेने में तकलीफ", "बेहोश", "दौरा",
    "बहुत खून", "खून की उल्टी", "लकवा", "आत्महत्या", "जहर", "ज़हर", "दिल का दौरा",
    # Kannada / Hindi typed in English letters
    "ede novu", "edhe novu", "usiru kattu", "seene mein dard", "seene me dard", "chhati me dard", "saans nahi",
    "sans nahi", "behosh", "khoon ki ulti",
]
_EMERGENCY_RE = re.compile("|".join(re.escape(w) for w in EMERGENCY_WORDS), re.IGNORECASE)


def is_emergency(text: str) -> bool:
    return bool(_EMERGENCY_RE.search(text or ""))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _who(current_user: Dict[str, Any]) -> str:
    role = current_user["role"]
    if role == "doctor":
        return "doctor"
    if role in ("patient", "representative"):
        return "patient"
    raise HTTPException(status_code=403, detail="Chat is for patients and their doctors.")


def _pair(current_user: Dict[str, Any], other_id: str) -> tuple[str, str, str]:
    """(patient_id, practitioner_id, my_role)"""
    me = _who(current_user)
    if me == "doctor":
        return other_id, current_user["user_id"], me
    return current_user["user_id"], other_id, me


def message_out(m: ChatMessage) -> Dict[str, Any]:
    return {
        "message_id": m.message_id,
        "sender": m.sender_role,
        "body": m.body,
        "lang": m.lang or "en",
        "translation": m.translation,
        "translation_lang": m.translation_lang,
        "encounter_id": m.encounter_id,
        "urgent": bool(m.urgent),
        "created_at": as_aware(m.created_at),
        "read": m.read_at is not None,
    }


async def _settings(db: AsyncSession, practitioner_id: str) -> Dict[str, Any]:
    row = await db.get(PractitionerSettings, practitioner_id)
    prefs = (row.prefs_json if row else None) or {}
    availability = (row.availability_json if row else None) or {}
    return {
        "window_days": int(prefs.get("chat_window_days") or DEFAULT_WINDOW_DAYS),
        "offset": int(prefs.get("utc_offset_minutes") or 330),
        "availability": availability,
    }


def _next_available(availability: Dict[str, Any], offset_minutes: int, now: datetime) -> Optional[datetime]:
    """None when the doctor is within their hours right now, else when their next hours start (up to 14 days)."""
    weekly = availability.get("weekly")
    if not weekly:
        return None  # no hours set: don't promise anything
    tz = timezone(timedelta(minutes=offset_minutes))
    local = now.astimezone(tz)
    leaves = availability.get("leaves", [])
    for day_offset in range(15):
        day = (local + timedelta(days=day_offset)).date()
        key = day.isoformat()
        if any(lv.get("start", "") <= key <= lv.get("end", "") for lv in leaves):
            continue
        for slot in sorted(weekly.get(WEEKDAYS[day.weekday()], []), key=lambda s: s["start"]):
            sh, sm = map(int, slot["start"].split(":"))
            eh, em = map(int, slot["end"].split(":"))
            start = datetime(day.year, day.month, day.day, sh, sm, tzinfo=tz)
            end = datetime(day.year, day.month, day.day, eh, em, tzinfo=tz)
            if start <= local < end:
                return None
            if start > local:
                return start.astimezone(timezone.utc)
    return None


async def thread_status(db: AsyncSession, patient_id: str, practitioner_id: str) -> Dict[str, Any]:
    """Whether the patient can write now, why, and until when; plus the doctor's availability."""
    now = now_utc()
    cfg = await _settings(db, practitioner_id)
    window = timedelta(days=cfg["window_days"])
    ends: List[tuple[datetime, str]] = []

    open_enc = (await db.execute(select(Encounter).where(
        Encounter.patient_id == patient_id, Encounter.status.in_(["queued", "in_progress"])))).scalars().first()
    upcoming = (await db.execute(select(Appointment).where(
        Appointment.patient_id == patient_id, Appointment.practitioner_id == practitioner_id,
        Appointment.visit_status == "scheduled", Appointment.scheduled_at > now - timedelta(hours=2),
    ).order_by(Appointment.scheduled_at))).scalars().first()
    if upcoming:
        ends.append((as_aware(upcoming.scheduled_at) + window, "upcoming"))
    last_visit = (await db.execute(select(Encounter).where(
        Encounter.patient_id == patient_id, Encounter.practitioner_id == practitioner_id, Encounter.status == "completed",
    ).order_by(desc(Encounter.end_time)))).scalars().first()
    if last_visit and last_visit.end_time:
        ends.append((as_aware(last_visit.end_time) + window, "recent_visit"))
    last_doctor_msg = (await db.execute(select(ChatMessage).where(
        ChatMessage.patient_id == patient_id, ChatMessage.practitioner_id == practitioner_id,
        ChatMessage.sender_role == "doctor").order_by(desc(ChatMessage.created_at)))).scalars().first()
    if last_doctor_msg:
        ends.append((as_aware(last_doctor_msg.created_at) + timedelta(hours=DOCTOR_REPLY_HOURS), "doctor_reply"))

    open_until, reason = max(ends, key=lambda e: e[0]) if ends else (None, "closed")
    is_open = bool(open_enc) or (open_until is not None and open_until > now)
    if open_enc and (open_until is None or open_until <= now):
        reason, open_until = "consultation", None
    next_available = _next_available(cfg["availability"], cfg["offset"], now)
    return {
        "open": is_open,
        "reason": reason if is_open else "closed",
        "open_until": open_until if is_open else None,
        "window_days": cfg["window_days"],
        "doctor_available_now": next_available is None,
        "doctor_next_available": next_available,
    }


async def _visit_for(db: AsyncSession, patient_id: str, practitioner_id: str) -> Optional[str]:
    """The visit a new message belongs to: the open consultation, else the latest completed visit."""
    enc = (await db.execute(select(Encounter).where(
        Encounter.patient_id == patient_id, Encounter.status.in_(["queued", "in_progress"])
    ).order_by(Encounter.start_time))).scalars().first()
    if not enc:
        enc = (await db.execute(select(Encounter).where(
            Encounter.patient_id == patient_id, Encounter.practitioner_id == practitioner_id,
            Encounter.status == "completed").order_by(desc(Encounter.end_time)))).scalars().first()
    return enc.encounter_id if enc else None


async def _linked(db: AsyncSession, patient_id: str, practitioner_id: str) -> bool:
    """A chat exists only between a patient and a doctor who has seen or booked them."""
    a = (await db.execute(select(Appointment.appointment_id).where(
        Appointment.patient_id == patient_id, Appointment.practitioner_id == practitioner_id).limit(1))).first()
    e = (await db.execute(select(Encounter.encounter_id).where(
        Encounter.patient_id == patient_id, Encounter.practitioner_id == practitioner_id).limit(1))).first()
    return bool(a or e)


# ---------------------------------------------------------------------------

@router.get("/threads")
async def list_threads(current_user: Dict[str, Any] = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    me = _who(current_user)
    uid = current_user["user_id"]
    if me == "doctor":
        ids = set((await db.execute(select(Appointment.patient_id).where(Appointment.practitioner_id == uid))).scalars())
        ids |= set((await db.execute(select(Encounter.patient_id).where(Encounter.practitioner_id == uid))).scalars())
        others = {p.patient_id: p for p in (await db.execute(
            select(PatientProfile).where(PatientProfile.patient_id.in_(list(ids) or [""])))).scalars()}
        msgs = (await db.execute(select(ChatMessage).where(ChatMessage.practitioner_id == uid)
                                 .order_by(desc(ChatMessage.created_at)))).scalars().all()
        key = lambda m: m.patient_id  # noqa: E731
    else:
        ids = set((await db.execute(select(Appointment.practitioner_id).where(Appointment.patient_id == uid))).scalars())
        ids |= set((await db.execute(select(Encounter.practitioner_id).where(Encounter.patient_id == uid))).scalars())
        ids.discard(None)
        others = {p.practitioner_id: p for p in (await db.execute(
            select(Practitioner).where(Practitioner.practitioner_id.in_(list(ids) or [""])))).scalars()}
        msgs = (await db.execute(select(ChatMessage).where(ChatMessage.patient_id == uid)
                                 .order_by(desc(ChatMessage.created_at)))).scalars().all()
        key = lambda m: m.practitioner_id  # noqa: E731

    last: Dict[str, ChatMessage] = {}
    unread: Dict[str, int] = {}
    urgent: Dict[str, bool] = {}
    for m in msgs:
        k = key(m)
        last.setdefault(k, m)
        if m.sender_role != me and m.read_at is None:
            unread[k] = unread.get(k, 0) + 1
            urgent[k] = urgent.get(k, False) or bool(m.urgent)

    out = []
    for oid, other in others.items():
        status = await thread_status(db, oid if me == "doctor" else uid, uid if me == "doctor" else oid)
        lm = last.get(oid)
        out.append({
            "other_id": oid,
            "name": other.full_name if me == "doctor" else other.display_name,
            "avatar_url": other.avatar_url if me == "doctor" else None,
            "subtitle": (other.demographics_json or {}).get("district") if me == "doctor" else other.specialty,
            "last_message": message_out(lm) if lm else None,
            "unread": unread.get(oid, 0),
            "urgent": urgent.get(oid, False),
            "open": status["open"],
        })
    out.sort(key=lambda th: (th["last_message"] is None, -(th["last_message"]["created_at"].timestamp()) if th["last_message"] else 0, th["name"]))
    return out


@router.get("/unread")
async def unread_count(current_user: Dict[str, Any] = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    me = _who(current_user)
    col = ChatMessage.practitioner_id if me == "doctor" else ChatMessage.patient_id
    rows = (await db.execute(select(ChatMessage.message_id).where(
        col == current_user["user_id"], ChatMessage.sender_role != me, ChatMessage.read_at.is_(None)))).all()
    return {"count": len(rows)}


@router.get("/threads/{other_id}")
async def get_thread(other_id: str, current_user: Dict[str, Any] = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    patient_id, practitioner_id, me = _pair(current_user, other_id)
    if not await _linked(db, patient_id, practitioner_id):
        raise HTTPException(status_code=404, detail="No conversation with this person.")
    rows = (await db.execute(select(ChatMessage).where(
        ChatMessage.patient_id == patient_id, ChatMessage.practitioner_id == practitioner_id,
    ).order_by(desc(ChatMessage.created_at)).limit(300))).scalars().all()
    patient = await db.get(PatientProfile, patient_id)
    doctor = await db.get(Practitioner, practitioner_id)
    return {
        "patient": {"id": patient_id, "name": patient.full_name if patient else "", "avatar_url": patient.avatar_url if patient else None,
                    "language": (patient.preferred_language if patient else None) or "kn"},
        "doctor": {"id": practitioner_id, "name": doctor.display_name if doctor else "", "specialty": doctor.specialty if doctor else ""},
        "status": await thread_status(db, patient_id, practitioner_id),
        "messages": [message_out(m) for m in reversed(rows)],
    }


class MessageIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)
    lang: Optional[str] = None  # the sender's language; defaults to the patient's language / English for doctors


@router.post("/threads/{other_id}/messages")
async def send_message(other_id: str, req: MessageIn, current_user: Dict[str, Any] = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    patient_id, practitioner_id, me = _pair(current_user, other_id)
    if not await _linked(db, patient_id, practitioner_id):
        raise HTTPException(status_code=404, detail="No conversation with this person.")
    body = req.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Write a message first.")
    if me == "patient":
        status = await thread_status(db, patient_id, practitioner_id)
        if not status["open"]:
            raise HTTPException(status_code=403, detail="This chat is closed. Book an appointment to talk to your doctor.")

    patient = await db.get(PatientProfile, patient_id)
    patient_lang = (patient.preferred_language if patient else None) or "kn"
    lang = req.lang or (patient_lang if me == "patient" else "en")
    reader_lang = "en" if me == "patient" else patient_lang
    translation = None
    if lang != reader_lang:
        translated = await translation_engine.translate_text(body, target_lang=reader_lang, source_lang=lang)
        if translated and translated.strip() != body:
            translation = translated  # only when the translator actually changed something
    urgent = me == "patient" and is_emergency(body)

    msg = ChatMessage(
        patient_id=patient_id, practitioner_id=practitioner_id, sender_role=me, body=body, lang=lang,
        translation=translation, translation_lang=reader_lang if translation else None,
        encounter_id=await _visit_for(db, patient_id, practitioner_id), urgent=urgent,
    )
    db.add(msg)
    await db.flush()
    db.add(AuditEvent(
        actor_id=current_user["user_id"] if me == "doctor" else f"patient:{patient_id}",
        action="CHAT_MESSAGE_URGENT" if urgent else "CHAT_MESSAGE_SENT",
        resource_id=patient_id,
        outcome="ALERT" if urgent else "SUCCESS",
        purpose=(f"{'Doctor' if me == 'doctor' else 'Patient'} message ({len(body)} characters)"),
    ))
    await db.commit()
    await db.refresh(msg)

    payload = {"type": "chat_message", "patient_id": patient_id, "practitioner_id": practitioner_id,
               "sender_name": current_user.get("name") or "", **message_out(msg)}
    await ws_manager.send_to([patient_id, practitioner_id], payload)
    if urgent:
        name = patient.full_name if patient else "A patient"
        await notify(kind="alert", severity="critical", practitioner_ids=[practitioner_id],
                     title=f"Urgent message from {name}",
                     body=body[:300], link={"page": "messages", "patient_id": patient_id})
    return {**message_out(msg), "emergency": urgent}


@router.post("/threads/{other_id}/read")
async def mark_thread_read(other_id: str, current_user: Dict[str, Any] = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    patient_id, practitioner_id, me = _pair(current_user, other_id)
    result = await db.execute(update(ChatMessage).where(
        ChatMessage.patient_id == patient_id, ChatMessage.practitioner_id == practitioner_id,
        ChatMessage.sender_role != me, ChatMessage.read_at.is_(None)).values(read_at=now_utc()))
    await db.commit()
    if result.rowcount:
        # Read receipts for the other side.
        await ws_manager.send_to([practitioner_id if me == "patient" else patient_id],
                                 {"type": "chat_read", "patient_id": patient_id, "practitioner_id": practitioner_id, "reader": me})
    return {"marked": result.rowcount or 0}
