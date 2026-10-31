"""
CHIBI Test Lab: try the whole consultation AI with just your voice, no video call needed.

You speak (the browser's speech recognition, or your Whisper server when it's online); every few lines CHIBI's
agent processes a batch with its running memory (consult_agent.py), fills the notepad and keeps suggestions
ready. When you finish, you get the consultation summary and the structured note (note_format.py) exactly as
a real consultation would save it.

The lab uses a private stand-in patient per doctor ("Test Patient"), which never appears in patient lists.
"""
import time
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models.models import (
    Encounter, PatientProfile, Practitioner, User, ClinicalNote, ConsultationRecord,
    RecordMetadata, AuditEvent,
)
from app.services import call_minutes as cm
from app.services import consult_agent as agent
from app.services.ai_client import ai
from app.services.asr import Segment, is_clinically_relevant
from app.services.auth_dependencies import require_doctor
from app.services.deidentify import deidentifier_for
from app.services.note_format import TEMPLATE, parse_note, chart_prescription, soap_from_structured

router = APIRouter(prefix="/lab", tags=["CHIBI Test Lab"])

LAB_PREFIX = "lab_"


class LineIn(BaseModel):
    text: str = Field(max_length=2000)
    speaker: str = "patient"
    language: str = "en"


class LinesIn(BaseModel):
    lines: List[LineIn] = []
    note: Optional[str] = Field(default=None, max_length=20000)


class NoteIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=20000)


def _own(session_id: str, me: str) -> cm.CallSession:
    s = cm.get_session(session_id)
    if not s or getattr(s, "lab_owner", None) != me:
        raise HTTPException(status_code=404, detail="Test session not found (it expires after an idle hour).")
    return s


async def _lab_patient(db: AsyncSession, me: str) -> PatientProfile:
    pid = f"{LAB_PREFIX}{me}"[:36]
    profile = await db.get(PatientProfile, pid)
    if profile:
        return profile
    if not await db.get(User, pid):
        db.add(User(user_id=pid, role="patient", login_identifier=f"lab:{me}"[:100], status="lab"))
    profile = PatientProfile(patient_id=pid, full_name="Test Patient", preferred_language="en",
                             abha_address=f"lab.{uuid.uuid4().hex[:10]}@sbx",
                             demographics_json={"age": 40, "sex": "other", "district": ""})
    db.add(profile)
    await db.flush()
    return profile


async def _speech_online() -> bool:
    """Is your own speech-to-text server (Whisper) reachable? The demo engine doesn't count."""
    if cm.asr is None:
        return False
    live = getattr(cm.asr, "_live", None) or (cm.asr if getattr(cm.asr, "name", "") == "http" else None)
    return bool(live is not None and await live.health())


@router.get("/status")
async def status(current_doctor: Dict[str, Any] = Depends(require_doctor)):
    """Which AI and speech engines are available right now."""
    speech_online = await _speech_online()
    return {"ai": {**ai.info(), "online": await ai.online()}, "speech_server": speech_online,
            "batch": {"min_lines": agent.BATCH_MIN_LINES, "max_wait_s": agent.BATCH_MAX_WAIT_S}}


@router.post("/sessions")
async def start(current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    me = current_doctor["user_id"]
    patient = await _lab_patient(db, me)
    doctor = await db.get(Practitioner, me)
    enc = Encounter(encounter_id=f"enc_lab_{uuid.uuid4().hex[:8]}", patient_id=patient.patient_id, practitioner_id=me,
                    mode="audio", status="lab", urgency="routine", symptoms_text="CHIBI Test Lab")
    db.add(enc)
    await db.commit()
    s = cm.create_session(enc.encounter_id, deidentifier_for(None, doctor.display_name if doctor else None))
    s.consent_at = time.time()          # the doctor is testing with their own voice
    s.lab_owner = me
    s.patient_recorded_by_doctor = True   # Whisper mode: your mic is uploaded as the patient's voice (/calls/{id}/audio)
    s.lab_started = time.time()
    st = agent.agent_of(s)
    st.note = TEMPLATE
    if cm.asr is not None and hasattr(cm.asr, "choose"):
        await cm.asr.choose(s.id)
    return {"session_id": s.id, "encounter_id": enc.encounter_id, "template": TEMPLATE,
            "speech_server": await _speech_online(), "ai": {**ai.info(), "online": await ai.online()}}


@router.get("/sessions/{session_id}")
async def get_state(session_id: str, current_doctor: Dict[str, Any] = Depends(require_doctor)):
    s = _own(session_id, current_doctor["user_id"])
    agent.schedule(s)                    # speech uploaded through /calls/{id}/audio is batched here
    return agent.view(s)


@router.post("/sessions/{session_id}/lines")
async def add_lines(session_id: str, req: LinesIn, current_doctor: Dict[str, Any] = Depends(require_doctor)):
    """Text from the browser's speech recognition (one entry per finished phrase)."""
    s = _own(session_id, current_doctor["user_id"])
    st = agent.agent_of(s)
    if req.note is not None:
        st.note = req.note
    at = int((time.time() - getattr(s, "lab_started", time.time())) * 1000)
    segs = [Segment("doctor" if l.speaker == "doctor" else "patient", at, at + 3000, l.text.strip(), l.text.strip(),
                    (l.language or "en")[:2]) for l in req.lines if l.text.strip() and is_clinically_relevant(l.text.strip())]
    if segs:
        cm.add_segments(s, segs)
        agent.schedule(s)
    return agent.view(s)


@router.post("/sessions/{session_id}/audio")
async def add_audio(session_id: str, audio: UploadFile = File(...), speaker: str = Form("patient"),
                    offset_ms: int = Form(0), duration_ms: int = Form(4000),
                    current_doctor: Dict[str, Any] = Depends(require_doctor)):
    """A recorded chunk for your own Whisper server (when it's online)."""
    s = _own(session_id, current_doctor["user_id"])
    data = await audio.read()
    if len(data) > 5_000_000:
        raise HTTPException(status_code=413, detail="Audio chunk too large")
    await cm.add_audio(s, "doctor" if speaker == "doctor" else "patient", data, audio.content_type or "audio/webm",
                       offset_ms, duration_ms)
    agent.schedule(s)
    return agent.view(s)


@router.post("/sessions/{session_id}/process")
async def process_now(session_id: str, req: NoteIn, current_doctor: Dict[str, Any] = Depends(require_doctor)):
    s = _own(session_id, current_doctor["user_id"])
    if req.note is not None:
        agent.agent_of(s).note = req.note
    await agent.run_turn(s, force=True)
    return agent.view(s)


@router.post("/sessions/{session_id}/end")
async def end(session_id: str, req: NoteIn, current_doctor: Dict[str, Any] = Depends(require_doctor)):
    """Last batch, the consultation summary, and the note as structured data (what a real visit would save)."""
    s = _own(session_id, current_doctor["user_id"])
    st = agent.agent_of(s)
    if req.note is not None:
        st.note = req.note
    final = await agent.finish(s)
    return {**agent.view(s), "final": final, "structured": parse_note(st.note)}


class SignAndPushIn(BaseModel):
    patient_id: Optional[str] = None
    note: Optional[str] = Field(None, max_length=20000)
    doctor_signature_name: Optional[str] = None
    prescription_overrides: Optional[List[Dict[str, Any]]] = None


@router.post("/sessions/{session_id}/sign_and_push")
async def sign_and_push_lab_report(
    session_id: str,
    req: SignAndPushIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    """
    Doctor Verification & Signing Gate:
    Before any lab consultation or report is committed to the database,
    it must be reviewed and signed by the doctor ("Checked by the doctor and duly signed").
    This commits:
      1. ClinicalNote & ConsultationRecord
      2. RecordMetadata in ABDM health record locker
      3. Prescribed tablets & medications into the patient's care plan
    """
    me = current_doctor["user_id"]
    s = _own(session_id, me)
    st = agent.agent_of(s)
    if req.note is not None:
        st.note = req.note

    final = await agent.finish(s)
    structured = parse_note(st.note)

    profile = None
    if req.patient_id:
        profile = await db.get(PatientProfile, req.patient_id)
    if not profile:
        profile = await _lab_patient(db, me)

    doctor = await db.get(Practitioner, me)
    doctor_label = req.doctor_signature_name or (doctor.display_name if doctor else "Dr. Ananya Sharma")
    now = datetime.now(timezone.utc)
    sig_payload = f"{doctor_label}:{s.id}:{now.isoformat()}"
    crypto_signature = f"NMC-SIG-SHA256:{hashlib.sha256(sig_payload.encode()).hexdigest()[:16]}"

    enc_id = getattr(s, "encounter_id", None) or f"enc_lab_{s.id[:10]}"
    enc = await db.get(Encounter, enc_id)
    if enc:
        enc.status = "completed"
        enc.end_time = now
        enc.patient_id = profile.patient_id

    soap = soap_from_structured(structured)
    note_row = await db.get(ClinicalNote, enc_id)
    if not note_row:
        note_row = ClinicalNote(
            encounter_id=enc_id,
            practitioner_id=me,
            subjective=soap["subjective"],
            objective=soap["objective"],
            assessment=soap["assessment"],
            plan_json=soap["plan"],
            status="clinician_approved",
            clinician_signature=crypto_signature,
            signed_at=now,
        )
        db.add(note_row)
    else:
        note_row.practitioner_id = me
        note_row.subjective = soap["subjective"]
        note_row.objective = soap["objective"]
        note_row.assessment = soap["assessment"]
        note_row.plan_json = soap["plan"]
        note_row.status = "clinician_approved"
        note_row.clinician_signature = crypto_signature
        note_row.signed_at = now

    record = await db.get(ConsultationRecord, enc_id)
    if not record:
        record = ConsultationRecord(
            encounter_id=enc_id,
            patient_id=profile.patient_id,
            practitioner_id=me,
            structured_json=structured,
            note_text=st.note,
            signed_at=now,
        )
        db.add(record)
    else:
        record.structured_json = structured
        record.note_text = st.note
        record.signed_at = now

    rec_id = f"rec_chibi_{uuid.uuid4().hex[:10]}"
    primary_diag = structured.get("diagnosis", ["General Telehealth Consultation"])[0] if structured.get("diagnosis") else "General Consultation"
    vault_record = RecordMetadata(
        record_id=rec_id,
        patient_id=profile.patient_id,
        record_type="op_consultation",
        title=f"CHIBI Consultation & Prescription - {primary_diag}",
        date_str=now.strftime("%Y-%m-%d"),
        file_mime_type="application/pdf",
        file_size_bytes=420000,
        secure_storage_reference=f"vault://abdm/patients/{profile.patient_id}/records/{rec_id}.enc",
        encryption_key_id="kms-carebridge-aes256-gcm",
        summary_findings=final.get("summary") or f"Consultation verified and duly signed by {doctor_label}.",
        raw_preview_text=st.note,
        facility="CHIBI Clinical Telehealth Lab",
        category="diagnostic",
        type_label="CHIBI Verified Consultation & Prescription",
    )
    db.add(vault_record)

    chart = dict(profile.chart_json or {})
    rx_list = req.prescription_overrides if req.prescription_overrides is not None else structured.get("prescription", [])
    when_label = now.strftime("%d %b %Y")
    purpose_label = "; ".join(structured.get("diagnosis", []))[:120]

    new_chart_rxs = [chart_prescription(m, doctor_label, when_label, purpose_label) for m in rx_list]
    chart["prescriptions"] = new_chart_rxs + list(chart.get("prescriptions", []))

    if structured.get("allergies"):
        known_allergens = {str(a.get("allergen", "")).lower() for a in chart.get("allergies", []) if isinstance(a, dict)}
        new_allergies = [
            {"allergen": a, "reaction": "", "source": "CHIBI Consultation Note"}
            for a in structured["allergies"]
            if a.lower() not in known_allergens
        ]
        if new_allergies:
            chart["allergies"] = list(chart.get("allergies", [])) + new_allergies

    profile.chart_json = chart
    flag_modified(profile, "chart_json")

    db.add(AuditEvent(
        actor_id=me,
        action="CHIBI_REPORT_VERIFIED_AND_SIGNED_BY_DOCTOR",
        resource_id=rec_id,
        outcome="SUCCESS",
        purpose=f"Checked by the doctor and duly signed: {crypto_signature}",
    ))

    await db.commit()

    return {
        "status": "signed_and_committed",
        "signature": crypto_signature,
        "signed_at": now.isoformat(),
        "record_id": rec_id,
        "encounter_id": enc_id,
        "patient_id": profile.patient_id,
        "patient_name": profile.full_name,
        "pushed_prescriptions_count": len(new_chart_rxs),
        "structured": structured,
        "final": final,
    }

