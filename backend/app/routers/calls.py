"""
Doctor-patient video call with consent-based AI minutes.

WebSocket (one room per encounter; doctor and patient each connect):
  /ws/v1/encounters/{id}/call
    client -> {"type": "AUTH", "token": "<jwt>"}                       first frame
    server -> {"type": "WELCOME", role, peer_present, speech, recording}
    relay  -> {"type": "SIGNAL", "data": {...}}                         WebRTC offer / answer / ICE
    either -> CALL_START {video} | CALL_ACCEPT | CALL_DECLINE | CALL_END    (the caller makes the WebRTC offer)
    doctor -> AI_TOGGLE {enabled} | NOTE_SNAPSHOT {text} | ANALYZE
    patient-> CONSENT_RESPONSE {session_id, accepted, can_record} | CONSENT_WITHDRAW
              (can_record false = a phone without audio recording: the doctor's app then records the
               patient's voice from the call, still only with this consent)
    server -> INCOMING_CALL {from, caller_name, video} | CALL_ACCEPTED | CALL_DECLINED | CALL_ENDED |
              CALL_UNAVAILABLE {reason} | PEER_JOINED | PEER_LEFT |
              CONSENT_REQUEST | RECORDING {active} | AI_STATUS {state} | AI_MINUTES {...}

  /ws/v1/doctor/lobby  (doctors, on every page of their portal)
    server -> INCOMING_CALL {encounter_id, caller_name, video} | CALL_CANCELLED {encounter_id}
    A patient's call reaches the doctor here when the doctor doesn't have that consultation open.

REST:
  POST /api/v1/calls/{session_id}/audio      one audio chunk from the caller's own microphone
  GET  /api/v1/calls/active-encounter        (patient) the encounter to join

Recording only starts after the patient accepts the consent request, and stops as soon as either
side turns it off. Audio is transcribed in memory and discarded; analysis only sees de-identified text.
"""
import asyncio
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.models import AuditEvent, Encounter, PatientProfile, Practitioner, VisitSummary
from app.services import call_minutes as cm
from app.services.asr import ASRError, asr, asr_info
from app.services.auth_dependencies import decode_access_token, get_current_user, require_patient
from app.services.deidentify import deidentifier_for
from app.services import live_assistant as la
from app.services.connection_manager import ws_manager

router = APIRouter(prefix="/calls", tags=["calls"])
ws_router = APIRouter(tags=["calls"])
WS_AUTH_TIMEOUT_S = 5
FINAL_CHUNK_WAIT_S = 4        # after the call ends: time for both sides' last audio chunk to arrive
FINAL_MAX_WAIT_S = 90         # ...and at most this long for transcription to finish


@dataclass
class Room:
    doctor: Optional[WebSocket] = None
    patient: Optional[WebSocket] = None
    session_id: Optional[str] = None
    doctor_name: str = "Your doctor"
    practitioner_id: Optional[str] = None
    patient_id: Optional[str] = None
    # Set while a call is ringing: {"from": role, "video": bool, "caller_name": str}
    ringing: Optional[Dict[str, Any]] = None


_rooms: Dict[str, Room] = {}
_lobbies: Dict[str, Set[WebSocket]] = {}          # practitioner id -> open doctor portals


async def _notify_lobby(practitioner_id: Optional[str], payload: Dict[str, Any]) -> int:
    """To the assigned doctor's open portals; with no doctor assigned yet (a new triage case), to every doctor."""
    if practitioner_id:
        sockets = list(_lobbies.get(practitioner_id, ()))
    else:
        sockets = [ws for group in _lobbies.values() for ws in group]
    for ws in sockets:
        await _send(ws, payload)
    return len(sockets)


async def _authenticate(websocket: WebSocket) -> Optional[Dict[str, Any]]:
    """First frame must be {"type": "AUTH", "token": ...}; tokens never go in URLs."""
    try:
        first = await asyncio.wait_for(websocket.receive_json(), timeout=WS_AUTH_TIMEOUT_S)
        token = first.get("token", "") if isinstance(first, dict) and first.get("type") == "AUTH" else ""
        return decode_access_token(token) if token else None
    except WebSocketDisconnect:
        raise
    except (asyncio.TimeoutError, HTTPException, ValueError):
        return None


async def _send(ws: Optional[WebSocket], payload: Dict[str, Any]) -> None:
    if ws is None:
        return
    try:
        await ws.send_json(payload)
    except Exception:  # noqa: BLE001 - the other side may have just left
        pass


async def _audit(actor: str, action: str, resource: str, outcome: str = "SUCCESS") -> None:
    async with AsyncSessionLocal() as db:
        db.add(AuditEvent(actor_id=actor, action=action, resource_id=resource, outcome=outcome))
        await db.commit()


def _doctor_sender(encounter_id: str):
    """Send to whichever doctor socket is in the room at the time (it may reconnect mid-call)."""
    async def send(payload: Dict[str, Any]) -> None:
        room = _rooms.get(encounter_id)
        if room and room.doctor:
            await _send(room.doctor, payload)
    return send


async def _assist(encounter_id: str, session: cm.CallSession, new_lines) -> None:
    """Live assistant: instant safety alerts, then streamed suggestions."""
    send = _doctor_sender(encounter_id)
    for alert in la.safety_alerts(session, new_lines):
        await send({"type": "AI_ALERT", **alert})
    if new_lines:
        la.schedule_suggestions(session, send)


async def _offer_summary(session: cm.CallSession, patient_id: Optional[str]) -> None:
    """After the call: offer the patient a masked summary. Kept in memory until they answer."""
    if not patient_id or not session.lines:
        return
    async with AsyncSessionLocal() as db:
        profile = await db.get(PatientProfile, patient_id)
    language = (profile.preferred_language if profile else None) or "en"
    summary = await la.build_patient_summary(session, language)
    sid = la.offer_summary(patient_id, session.encounter_id, summary)
    await ws_manager.send_to([patient_id], {"type": "SUMMARY_OFFER", "summary_id": sid, "encounter_id": session.encounter_id})


async def _push_minutes(encounter_id: str, session: cm.CallSession) -> None:
    room = _rooms.get(encounter_id)
    if room and room.doctor:
        await _send(room.doctor, {"type": "AI_MINUTES", **(await cm.analyze(session))})


def _stop_recording(room: Room) -> None:
    """Stop at once and discard what's pending (consent withdrawn, or AI minutes switched off)."""
    if room.session_id:
        cm.end_session(room.session_id)
        room.session_id = None


async def _finish_minutes(encounter_id: str, session: cm.CallSession) -> None:
    """The call ended: accept the last audio chunks, transcribe them, send the final minutes, then close."""
    try:
        await asyncio.sleep(FINAL_CHUNK_WAIT_S)
        deadline = time.time() + FINAL_MAX_WAIT_S
        while session.pending_uploads > 0 and time.time() < deadline:
            await asyncio.sleep(0.5)
        room = _rooms.get(encounter_id)
        if room and room.doctor and session.lines:
            await _send(room.doctor, {"type": "AI_MINUTES", "final": True, **(await cm.analyze(session))})
        if room and room.doctor:
            await _send(room.doctor, {"type": "AI_STATUS", "state": "off", "detail": "Minutes complete."})
        async with AsyncSessionLocal() as db:
            enc = await db.get(Encounter, encounter_id)
        await _offer_summary(session, enc.patient_id if enc else None)
    finally:
        cm.end_session(session.id)


def _end_recording_after_call(encounter_id: str, room: Room) -> bool:
    """On hang-up: keep the session open briefly for the final chunks. Returns True if minutes are being finished."""
    session = cm.get_session(room.session_id) if room.session_id else None
    room.session_id = None
    if not session or not session.consent_at:
        if session:
            cm.end_session(session.id)
        return False
    session.ending = True
    asyncio.create_task(_finish_minutes(encounter_id, session))
    return True


@ws_router.websocket("/ws/v1/encounters/{encounter_id}/call")
async def call_ws(websocket: WebSocket, encounter_id: str):
    await websocket.accept()
    try:
        claims = await _authenticate(websocket)
    except WebSocketDisconnect:
        return
    role = {"doctor": "doctor", "practitioner": "doctor", "patient": "patient"}.get((claims or {}).get("role", ""))
    if not claims or not role:
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        enc = await db.get(Encounter, encounter_id)
        if not enc:
            await websocket.close(code=4404)
            return
        if role == "patient" and enc.patient_id != claims.get("sub"):
            await websocket.close(code=4403)             # patients may only join their own consultation
            return
        patient = await db.get(PatientProfile, enc.patient_id)
        practitioner = await db.get(Practitioner, enc.practitioner_id) if enc.practitioner_id else None
    doctor_name = practitioner.display_name if practitioner else "Your doctor"
    patient_name = patient.full_name if patient else None
    district = ((patient.demographics_json or {}).get("district", "") if patient else "") or ""

    room = _rooms.setdefault(encounter_id, Room())
    room.doctor_name = doctor_name
    room.practitioner_id = enc.practitioner_id
    room.patient_id = enc.patient_id
    old = getattr(room, role)
    if old is not None and old is not websocket:
        await _send(old, {"type": "REPLACED"})          # same person opened the call elsewhere
        try:
            await old.close(code=4409)
        except Exception:  # noqa: BLE001
            pass
    setattr(room, role, websocket)
    other = lambda: room.patient if role == "doctor" else room.doctor  # noqa: E731
    actor = claims.get("sub", role)

    session = cm.get_session(room.session_id) if room.session_id else None
    await _send(websocket, {
        "type": "WELCOME", "role": role, "peer_present": other() is not None, "speech": asr_info(),
        "doctor_name": doctor_name, "patient_name": patient_name,
        # A call that started ringing before this side joined (e.g. the doctor opened it from the lobby).
        "ringing": room.ringing if room.ringing and room.ringing["from"] != role else None,
        "recording": bool(session and session.consent_at), "session_id": room.session_id if session else None,
    })
    await _send(other(), {"type": "PEER_JOINED", "role": role})
    if role == "patient" and session and not session.consent_at and not session.ending:
        await _send(websocket, {"type": "CONSENT_REQUEST", "session_id": session.id, "doctor_name": doctor_name})

    try:
        while True:
            msg = await websocket.receive_json()
            kind = msg.get("type") if isinstance(msg, dict) else None

            if kind == "SIGNAL":
                await _send(other(), {"type": "SIGNAL", "data": msg.get("data")})
            elif kind == "CALL_START":
                caller_name = doctor_name if role == "doctor" else (patient_name or "Your patient")
                room.ringing = {"from": role, "video": bool(msg.get("video", True)), "caller_name": caller_name}
                incoming = {"type": "INCOMING_CALL", "from": role, "caller_name": caller_name,
                            "video": room.ringing["video"], "encounter_id": encounter_id, "patient_id": room.patient_id}
                if other() is not None:
                    await _send(other(), incoming)
                elif role == "patient" and await _notify_lobby(room.practitioner_id, incoming):
                    pass                                  # the doctor's portal will open this consultation
                else:
                    room.ringing = None
                    who = doctor_name if role == "patient" else (patient_name or "The patient")
                    await _send(websocket, {"type": "CALL_UNAVAILABLE", "reason": f"{who} is not online right now."})
            elif kind in ("CALL_ACCEPT", "CALL_DECLINE"):
                if room.ringing and room.ringing["from"] != role:
                    room.ringing = None
                    await _send(other(), {"type": "CALL_ACCEPTED" if kind == "CALL_ACCEPT" else "CALL_DECLINED"})
                    if role == "doctor":                  # stop the ringing in the doctor's other open tabs
                        await _notify_lobby(room.practitioner_id, {"type": "CALL_CANCELLED", "encounter_id": encounter_id})
            elif kind == "CALL_END":
                if room.ringing and room.ringing["from"] == "patient":
                    await _notify_lobby(room.practitioner_id, {"type": "CALL_CANCELLED", "encounter_id": encounter_id})
                room.ringing = None
                finishing = _end_recording_after_call(encounter_id, room)
                await _send(other(), {"type": "CALL_ENDED"})
                await _send(other(), {"type": "RECORDING", "active": False, "reason": "call ended"})
                if finishing:
                    await _send(room.doctor, {"type": "AI_STATUS", "state": "finishing"})

            elif kind == "AI_TOGGLE" and role == "doctor":
                if msg.get("enabled"):
                    if asr is None:
                        await _send(websocket, {"type": "AI_STATUS", "state": "unavailable",
                                                "detail": "Speech-to-text is not configured on the server."})
                        continue
                    if not await asr.health():
                        await _send(websocket, {"type": "AI_STATUS", "state": "unavailable",
                                                "detail": "The speech-to-text server is offline. If it runs on Colab, "
                                                          "restart the notebook and update SCRIBE_ASR_URL."})
                        continue
                    existing = cm.get_session(room.session_id) if room.session_id else None
                    if existing and existing.consent_at:
                        await _send(websocket, {"type": "AI_STATUS", "state": "recording", "session_id": existing.id})
                        continue
                    s = cm.create_session(encounter_id, deidentifier_for(patient_name, doctor_name, [district]))
                    s.known_allergies = [a for a in (enc.allergies_json or []) if isinstance(a, str)]
                    room.session_id = s.id
                    speech_mode = await asr.choose(s.id) if hasattr(asr, "choose") else "live"
                    await _send(websocket, {"type": "AI_MODE", "speech": speech_mode,
                                            "model": "live" if await la.model_online() else "demo"})
                    await _send(room.patient, {"type": "CONSENT_REQUEST", "session_id": s.id, "doctor_name": doctor_name})
                    await _send(websocket, {"type": "AI_STATUS", "state": "waiting_consent", "session_id": s.id,
                                            "patient_connected": room.patient is not None,
                                            "detail": None if room.patient is not None else
                                            "The patient's app is not connected; the request will appear when it reconnects."})
                    await _audit(actor, "AI_MINUTES_CONSENT_REQUESTED", encounter_id)
                else:
                    _stop_recording(room)
                    await _send(websocket, {"type": "AI_STATUS", "state": "off"})
                    await _send(room.patient, {"type": "RECORDING", "active": False, "reason": "The doctor turned off AI minutes."})
                    await _audit(actor, "AI_MINUTES_DISABLED", encounter_id)

            elif kind == "CONSENT_RESPONSE" and role == "patient":
                s = cm.get_session(msg.get("session_id", "")) if msg.get("session_id") == room.session_id else None
                if not s:
                    continue
                if msg.get("accepted"):
                    s.consent_at = time.time()
                    s.patient_recorded_by_doctor = msg.get("can_record") is False
                    await _audit(actor, "RECORDING_CONSENT_GIVEN", encounter_id)
                    await _send(room.patient, {"type": "RECORDING", "active": True, "session_id": s.id})
                    await _send(room.doctor, {"type": "RECORDING", "active": True, "session_id": s.id,
                                              "record_remote": s.patient_recorded_by_doctor})
                    await _send(room.doctor, {"type": "AI_STATUS", "state": "recording", "session_id": s.id})
                else:
                    _stop_recording(room)
                    await _audit(actor, "RECORDING_CONSENT_DECLINED", encounter_id, "DENIED")
                    await _send(room.doctor, {"type": "AI_STATUS", "state": "declined"})
            elif kind == "CONSENT_WITHDRAW" and role == "patient":
                _stop_recording(room)
                await _audit(actor, "RECORDING_CONSENT_WITHDRAWN", encounter_id, "REVOKED")
                await _send(room.doctor, {"type": "AI_STATUS", "state": "withdrawn"})
                for ws in (room.doctor, room.patient):
                    await _send(ws, {"type": "RECORDING", "active": False, "reason": "The patient stopped the recording."})

            elif kind == "NOTE_SNAPSHOT" and role == "doctor":
                s = cm.get_session(room.session_id) if room.session_id else None
                if s and isinstance(msg.get("text"), str):
                    s.note_text = msg["text"][:20000]
                    if s.lines:
                        await _push_minutes(encounter_id, s)
                    if s.consent_at:
                        for alert in la.safety_alerts(s, []):
                            await _send(websocket, {"type": "AI_ALERT", **alert})
            elif kind == "ANALYZE" and role == "doctor":
                s = cm.get_session(room.session_id) if room.session_id else None
                if s:
                    await _push_minutes(encounter_id, s)
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        if getattr(room, role) is websocket:
            setattr(room, role, None)
            if room.ringing and room.ringing["from"] == role:      # the caller left while it was ringing
                room.ringing = None
                if role == "patient":
                    await _notify_lobby(room.practitioner_id, {"type": "CALL_CANCELLED", "encounter_id": encounter_id})
            await _send(other(), {"type": "PEER_LEFT", "role": role})
            # The patient's app closed mid-call: finish the minutes gathered so far for the doctor.
            if role == "patient" and room.session_id and _end_recording_after_call(encounter_id, room):
                await _send(room.doctor, {"type": "AI_STATUS", "state": "finishing"})
        if room.doctor is None and room.patient is None:
            _stop_recording(room)
            _rooms.pop(encounter_id, None)


@ws_router.websocket("/ws/v1/doctor/lobby")
async def doctor_lobby_ws(websocket: WebSocket):
    """Open on every page of the doctor portal, so a patient's call rings wherever the doctor is."""
    await websocket.accept()
    try:
        claims = await _authenticate(websocket)
    except WebSocketDisconnect:
        return
    if not claims or claims.get("role") not in ("doctor", "practitioner"):
        await websocket.close(code=4401)
        return
    practitioner_id = claims.get("sub", "")
    _lobbies.setdefault(practitioner_id, set()).add(websocket)
    try:
        # Calls already ringing for this doctor (e.g. the portal was reloaded while a patient was calling).
        for encounter_id, room in _rooms.items():
            if room.practitioner_id in (practitioner_id, None) and room.ringing and room.ringing["from"] == "patient" \
                    and room.doctor is None:
                await _send(websocket, {"type": "INCOMING_CALL", "from": "patient", "encounter_id": encounter_id,
                                        "patient_id": room.patient_id,
                                        "caller_name": room.ringing["caller_name"], "video": room.ringing["video"]})
        while True:
            msg = await websocket.receive_json()
            # Declining from another page: tell the patient straight away instead of letting it ring out.
            if isinstance(msg, dict) and msg.get("type") == "CALL_DECLINE":
                room = _rooms.get(str(msg.get("encounter_id", "")))
                if room and room.practitioner_id in (practitioner_id, None) and room.ringing and room.ringing["from"] == "patient":
                    room.ringing = None
                    await _send(room.patient, {"type": "CALL_DECLINED"})
                    await _notify_lobby(practitioner_id, {"type": "CALL_CANCELLED", "encounter_id": msg["encounter_id"]})
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        _lobbies.get(practitioner_id, set()).discard(websocket)


@router.post("/{session_id}/audio")
async def upload_audio(
    session_id: str,
    file: UploadFile = File(...),
    offset_ms: int = Form(0),
    duration_ms: int = Form(15000),
    speaker: str = Form(""),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """One chunk from the caller's own microphone (or, when the patient's phone can't record, the
    patient's voice recorded by the doctor's app). Transcribed in memory, then discarded."""
    session = cm.get_session(session_id)
    if not session or not session.consent_at:
        raise HTTPException(status_code=409, detail="Recording is not active for this call (no consent or stopped).")
    role = current_user["role"]
    if role not in ("doctor", "patient"):
        raise HTTPException(status_code=403, detail="Only call participants can send audio.")
    if role == "patient":
        async with AsyncSessionLocal() as db:
            enc = await db.get(Encounter, session.encounter_id)
        if not enc or enc.patient_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your consultation.")
    if speaker == "patient" and role != "patient":
        # Only the doctor of this call, and only when the patient consented from a device that can't record.
        async with AsyncSessionLocal() as db:
            enc = await db.get(Encounter, session.encounter_id)
        if role != "doctor" or not session.patient_recorded_by_doctor or not enc \
                or enc.practitioner_id not in (current_user["user_id"], None):
            raise HTTPException(status_code=403, detail="Not allowed to send the patient's audio.")
        role = "patient"
    audio = await file.read(cm.MAX_AUDIO_BYTES + 1)
    if len(audio) > cm.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio chunk too large.")
    try:
        lines = await cm.add_audio(session, role, audio, file.content_type or "audio/webm", max(0, offset_ms),
                                   max(0, duration_ms))
    except ASRError:
        room = _rooms.get(session.encounter_id)
        if room and room.doctor:
            await _send(room.doctor, {"type": "AI_WARNING",
                                      "detail": "Speech-to-text server not reachable; part of the conversation was not transcribed."})
        return {"transcribed_lines": 0, "speech_to_text": "unavailable"}
    finally:
        del audio  # never stored
    if lines:
        await _push_minutes(session.encounter_id, session)
        await _assist(session.encounter_id, session, lines)
    return {"transcribed_lines": len(lines)}


# ---------------------------------------------------------------------------
# Patient visit summaries: offered after the call, stored only if the patient says yes
# ---------------------------------------------------------------------------
def _summary_out(row: VisitSummary) -> Dict[str, Any]:
    return {"summary_id": row.summary_id, "encounter_id": row.encounter_id, "language": row.language,
            "sections": row.sections_json or {}, "engine": row.engine, "created_at": row.created_at}


@router.get("/summaries/pending")
async def pending_summaries(current_patient: Dict[str, Any] = Depends(require_patient)):
    return la.pending_for(current_patient["user_id"])


@router.post("/summaries/{summary_id}/accept")
async def accept_summary(summary_id: str, current_patient: Dict[str, Any] = Depends(require_patient),
                         db: AsyncSession = Depends(get_db)):
    pending = la.take_pending(summary_id, current_patient["user_id"])
    if not pending:
        raise HTTPException(status_code=404, detail="This summary is no longer available.")
    s = pending["summary"]
    row = VisitSummary(summary_id=summary_id, patient_id=current_patient["user_id"], encounter_id=pending["encounter_id"],
                       language=s["language"], sections_json=s["sections"], engine=s["engine"])
    db.add(row)
    db.add(AuditEvent(actor_id=f"patient:{current_patient['user_id']}", action="VISIT_SUMMARY_SAVED",
                      resource_id=pending["encounter_id"] or summary_id, outcome="SUCCESS",
                      purpose="Patient asked for a summary of the consultation"))
    await db.commit()
    await db.refresh(row)
    return _summary_out(row)


@router.post("/summaries/{summary_id}/decline")
async def decline_summary(summary_id: str, current_patient: Dict[str, Any] = Depends(require_patient)):
    la.take_pending(summary_id, current_patient["user_id"])
    return {"ok": True}


@router.get("/summaries/me")
async def my_summaries(current_patient: Dict[str, Any] = Depends(require_patient), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import desc as _desc
    rows = (await db.execute(select(VisitSummary).where(VisitSummary.patient_id == current_patient["user_id"])
                             .order_by(_desc(VisitSummary.created_at)).limit(20))).scalars().all()
    return [_summary_out(r) for r in rows]


@router.get("/active-encounter")
async def active_encounter(doctor_id: Optional[str] = None,
                           current_patient: Dict[str, Any] = Depends(require_patient),
                           db: AsyncSession = Depends(get_db)):
    """The patient's current consultation, so their app can join the doctor's call.
    With `doctor_id`: the open consultation with that doctor (a patient can have several doctors)."""
    q = select(Encounter).where(Encounter.patient_id == current_patient["user_id"],
                                Encounter.status.in_(["in_progress", "queued"]))
    if doctor_id:
        q = q.where(Encounter.practitioner_id == doctor_id)
    enc = (await db.execute(q.order_by(Encounter.start_time))).scalars().first()  # oldest open, as the queue shows
    if not enc:
        return {"encounter_id": None}
    practitioner = await db.get(Practitioner, enc.practitioner_id) if enc.practitioner_id else None
    return {"encounter_id": enc.encounter_id, "practitioner_id": enc.practitioner_id,
            "doctor_name": practitioner.display_name if practitioner else "Your doctor"}
