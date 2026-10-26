"""
AI IntelliSense consultation notepad API.

REST (prefix /api/v1/intellisense):
  GET  /lexicon                              Lexicon for the browser's local Tier 1/2 engine
  POST /analyze                              One-shot analysis (fallback when the WebSocket is down)
  POST /complete                             Tier 3 language-model completion (fallback when the WebSocket is down)
  GET  /tier3                                Tier 3 status: disabled | starting | ready | paused | offline
  GET  /encounters/{id}/notepad              Load saved draft
  PUT  /encounters/{id}/notepad              Save draft (explicit save only)
  GET  /encounters/{id}/fhir                 Coded terms as a FHIR R4 collection Bundle

WebSocket:
  /ws/v1/encounters/{id}/intellisense
    client -> {"type": "AUTH", "token": "<jwt>"}   (first frame, within 5 s; keeps the JWT out of URLs/logs)
    client -> {"type": "INPUT_DELTA", "seq": n, "text": str, "cursor": int, "skip_ranges": [[s, e], ...]}
    server -> {"type": "SUGGESTION_PAYLOAD", "seq": n, "section", "nomenclature", "spelling", "safety", "server_ms"}
    client -> {"type": "COMPLETION_REQUEST", "seq": n, "text": str, "cursor": int}
    server -> {"type": "COMPLETION_PAYLOAD", "seq": n, "completion": str | null, "provider", "latency_ms", "tier3"}
    client -> {"type": "COMPLETION_CANCEL"}   (doctor typed again: stop the model generating)
    client -> {"type": "TERM_SEARCH", "seq": n, "query": str, "section": str | null}
    server -> {"type": "TERM_RESULTS", "seq": n, "span_words": int, "results": [...]}   (local terminology store)
    client -> {"type": "PING"}  server -> {"type": "PONG"}

Keystroke text is processed in memory only and never logged or stored.
"""
import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services import call_minutes as cm
from app.services.privacy_gateway import shield_for_encounter
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.models import AuditEvent, ConsultationNotepad, Encounter, PatientProfile, Practitioner
from app.schemas.schemas import IntelliSenseAnalyzeIn, IntelliSenseCompleteIn, NotepadSaveIn
from app.services.auth_dependencies import decode_access_token, require_doctor
from app.services.clinical_lexicon import LOINC, NOTEPAD_TEMPLATE, lexicon_payload
from app.services.intellisense_engine import MAX_TEXT_CHARS, analyze
from app.services.llm_completion import cancel_task, completion_service
from app.services.safety_engine import check as safety_check, patient_safety_context
from app.routers.terminology import notepad_search
from app.terminology.store import FHIR_SYSTEM_URIS, terminology

WS_AUTH_TIMEOUT_S = 5

router = APIRouter(prefix="/intellisense", tags=["intellisense"])
ws_router = APIRouter(tags=["intellisense"])

FHIR_SYSTEMS = FHIR_SYSTEM_URIS
DRUG_SYSTEMS = {"RxNorm", "CDCI"}


async def _get_encounter(db: AsyncSession, encounter_id: str) -> Encounter:
    enc = (await db.execute(select(Encounter).where(Encounter.encounter_id == encounter_id))).scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return enc


async def _safety_context(db: AsyncSession, enc: Encounter) -> Dict[str, List[str]]:
    """The patient's current medicines and recorded allergies, for medication safety checks."""
    return patient_safety_context(enc, await db.get(PatientProfile, enc.patient_id))


def _analyze_with_safety(text: str, cursor: int, skip_ranges: Any, spell_cache: Optional[Dict[str, Optional[str]]],
                         safety_ctx: Optional[Dict[str, List[str]]]) -> Dict[str, Any]:
    result = analyze(text, cursor, skip_ranges, spell_cache)
    if safety_ctx is not None:
        result["safety"] = safety_check(text, safety_ctx["current_medications"], safety_ctx["allergies"])
    return result


async def _patient_context(db: AsyncSession, enc: Encounter) -> Dict[str, Any]:
    """Age and sex only: the model never receives names or identifiers."""
    patient = await db.get(PatientProfile, enc.patient_id)
    demo = (patient.demographics_json or {}) if patient else {}
    return {"age": demo.get("age"), "sex": demo.get("sex") or demo.get("gender")}


@router.get("/lexicon")
async def get_lexicon(current_doctor: Dict[str, Any] = Depends(require_doctor)):
    return {**lexicon_payload(), "tier3": completion_service.info()}


@router.get("/tier3")
async def tier3_status(current_doctor: Dict[str, Any] = Depends(require_doctor)):
    return completion_service.info()


@router.post("/complete")
async def complete_text(
    req: IntelliSenseCompleteIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    enc = await _get_encounter(db, req.encounter_id)
    return await completion_service.complete(req.text, req.cursor, await _patient_context(db, enc),
                                             cm.conversation_for(enc.encounter_id), await shield_for_encounter(db, enc))


@router.post("/analyze")
async def analyze_text(
    req: IntelliSenseAnalyzeIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    started = time.perf_counter()
    safety_ctx = await _safety_context(db, await _get_encounter(db, req.encounter_id)) if req.encounter_id else None
    result = await asyncio.to_thread(_analyze_with_safety, req.text, req.cursor, req.skip_ranges, None, safety_ctx)
    result["server_ms"] = round((time.perf_counter() - started) * 1000, 2)
    return result


@router.get("/encounters/{encounter_id}/notepad")
async def get_notepad(
    encounter_id: str,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    await _get_encounter(db, encounter_id)
    pad = await db.get(ConsultationNotepad, encounter_id)
    if not pad:
        return {"encounter_id": encounter_id, "content": NOTEPAD_TEMPLATE, "coded_terms": [], "updated_at": None}
    return {
        "encounter_id": encounter_id,
        "content": pad.content or "",
        "coded_terms": pad.coded_terms_json or [],
        "updated_at": pad.updated_at,
    }


@router.put("/encounters/{encounter_id}/notepad")
async def save_notepad(
    encounter_id: str,
    req: NotepadSaveIn,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    await _get_encounter(db, encounter_id)
    # Drop coded terms whose span no longer matches the saved text.
    coded = [t.model_dump() for t in req.coded_terms
             if 0 <= t.start < t.end <= len(req.content) and req.content[t.start:t.end] == t.name]

    pad = await db.get(ConsultationNotepad, encounter_id)
    if not pad:
        pad = ConsultationNotepad(encounter_id=encounter_id, practitioner_id=current_doctor["user_id"])
        db.add(pad)
    pad.content = req.content
    pad.coded_terms_json = coded
    pad.practitioner_id = current_doctor["user_id"]
    pad.updated_at = datetime.now(timezone.utc)

    db.add(AuditEvent(
        actor_id=current_doctor["user_id"],
        action="NOTEPAD_DRAFT_SAVED",
        resource_id=encounter_id,
        outcome="SUCCESS",
    ))
    await db.commit()
    return {"encounter_id": encounter_id, "saved_coded_terms": len(coded), "updated_at": pad.updated_at}


def _with_icd_counterparts(codes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Add the ICD-11 code for an ICD-10 one (and vice versa) from the WHO mapping tables."""
    systems = {c["system"] for c in codes}
    extra: List[Dict[str, Any]] = []
    for src, dst in (("ICD_10", "ICD_11"), ("ICD_11", "ICD_10")):
        if src in systems and dst not in systems:
            src_codes = [c["code"] for c in codes if c["system"] == src]
            for mapped in terminology.map_codes(src, src_codes, dst).values():
                extra.extend(mapped[:1])
    return list(codes) + extra


def _codeable(term: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "coding": [
            {"system": FHIR_SYSTEMS.get(c["system"], c["system"]), "code": c["code"], "display": c.get("display") or term["name"]}
            for c in term.get("codes", [])
        ],
        "text": f"{term['original']} (as written) -> {term['name']}",
    }


@router.get("/encounters/{encounter_id}/fhir")
async def export_coded_terms_fhir(
    encounter_id: str,
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    """
    Serialize the saved notepad's coded terms:
    diagnoses/findings -> Condition (ICD-10 and ICD-11 both included via the WHO map),
    LOINC tests -> ServiceRequest, medicines (RxNorm/CDCI) -> MedicationRequest (draft).
    """
    enc = await _get_encounter(db, encounter_id)
    pad = await db.get(ConsultationNotepad, encounter_id)
    if not pad:
        raise HTTPException(status_code=404, detail="No saved notepad for this encounter. Save the draft first.")

    patient = await db.get(PatientProfile, enc.patient_id)
    practitioner = await db.get(Practitioner, enc.practitioner_id) if enc.practitioner_id else None
    subject = {"reference": f"Patient/{enc.patient_id}", "display": patient.full_name if patient else enc.patient_id}
    recorder: Optional[Dict[str, str]] = (
        {"reference": f"Practitioner/{practitioner.practitioner_id}", "display": practitioner.display_name}
        if practitioner else None
    )

    entries: List[Dict[str, Any]] = []
    seen = set()
    for term in pad.coded_terms_json or []:
        codes = await asyncio.to_thread(_with_icd_counterparts, term.get("codes", []))
        if not codes:
            continue
        term = {**term, "codes": codes}
        key = (term["name"], tuple(c["code"] for c in codes))
        if key in seen:
            continue
        seen.add(key)

        if all(c["system"] in DRUG_SYSTEMS for c in codes):
            resource = {
                "resourceType": "MedicationRequest",
                "id": f"medrq-{uuid.uuid4().hex[:10]}",
                "status": "draft",          # becomes active only when the clinician signs the prescription
                "intent": "proposal",
                "medicationCodeableConcept": _codeable(term),
                "subject": subject,
                "encounter": {"reference": f"Encounter/{encounter_id}"},
            }
            if recorder:
                resource["requester"] = recorder
        elif all(c["system"] == LOINC for c in codes):
            resource = {
                "resourceType": "ServiceRequest",
                "id": f"sr-{uuid.uuid4().hex[:10]}",
                "status": "draft",
                "intent": "proposal",
                "code": _codeable(term),
                "subject": subject,
                "encounter": {"reference": f"Encounter/{encounter_id}"},
            }
            if recorder:
                resource["requester"] = recorder
        else:
            resource = {
                "resourceType": "Condition",
                "id": f"cond-{uuid.uuid4().hex[:10]}",
                "clinicalStatus": {"coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active", "display": "Active"}]},
                # Draft notes are unsigned, so diagnoses stay provisional until the clinician signs.
                "verificationStatus": {"coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "provisional", "display": "Provisional"}]},
                "category": [{"coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                    "code": "encounter-diagnosis", "display": "Encounter Diagnosis"}]}],
                "code": _codeable(term),
                "subject": subject,
                "encounter": {"reference": f"Encounter/{encounter_id}"},
            }
            if recorder:
                resource["recorder"] = recorder
        entries.append({"resource": resource})

    return {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entry": entries,
    }


@ws_router.websocket("/ws/v1/encounters/{encounter_id}/intellisense")
async def intellisense_ws(websocket: WebSocket, encounter_id: str):
    # Browsers can't set headers on WebSocket upgrades. Rather than put the JWT in the URL
    # (where it would land in access logs), the client sends it as the first frame.
    await websocket.accept()
    try:
        first = await asyncio.wait_for(websocket.receive_json(), timeout=WS_AUTH_TIMEOUT_S)
        token = first.get("token", "") if isinstance(first, dict) and first.get("type") == "AUTH" else ""
        claims = decode_access_token(token) if token else None
    except WebSocketDisconnect:
        return  # browser left before authenticating (page reload, tab closed): nothing to clean up
    except (asyncio.TimeoutError, HTTPException, ValueError):
        claims = None
    if not claims or claims.get("role") not in ("doctor", "practitioner"):
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        enc = await db.get(Encounter, encounter_id)
        if not enc:
            await websocket.close(code=4404)
            return
        patient_ctx = await _patient_context(db, enc)
        safety_ctx = await _safety_context(db, enc)
        shield = await shield_for_encounter(db, enc)

    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    spell_cache: Dict[str, Optional[str]] = {}  # per-session, in memory only
    send_lock = asyncio.Lock()  # analysis replies and background completions share one socket
    completion_task: Optional["asyncio.Task[None]"] = None

    async def send(payload: Dict[str, Any]) -> None:
        async with send_lock:
            await websocket.send_json(payload)

    async def run_completion(seq: Any, text: str, cursor: int) -> None:
        # What was said in the live call (de-identified) helps the autocomplete finish the doctor's sentence.
        result = await completion_service.complete(text, cursor, patient_ctx, cm.conversation_for(encounter_id), shield)
        try:
            await send({"type": "COMPLETION_PAYLOAD", "seq": seq, **result})
        except (WebSocketDisconnect, RuntimeError):
            pass  # doctor closed the notepad while the model was answering

    term_status = await asyncio.to_thread(terminology.status)
    await send({
        "type": "SESSION_ACK", "session_id": session_id, "encounter_id": encounter_id,
        "tier3": completion_service.info(),
        "terminology": {"available": term_status["available"],
                        "systems": [s["system"] for s in term_status["sources"]]},
    })

    try:
        while True:
            msg = await websocket.receive_json()
            kind = msg.get("type") if isinstance(msg, dict) else None
            if kind == "PING":
                await send({"type": "PONG"})
            elif kind == "COMPLETION_REQUEST":
                text = msg.get("text")
                if not isinstance(text, str) or len(text) > MAX_TEXT_CHARS:
                    await send({"type": "ERROR", "seq": msg.get("seq"), "detail": "Invalid or oversized text"})
                    continue
                # Only the latest request matters; drop the one still waiting on the model.
                await cancel_task(completion_task)
                try:
                    cursor = int(msg.get("cursor", len(text)))
                except (TypeError, ValueError):
                    cursor = len(text)
                completion_task = asyncio.create_task(run_completion(msg.get("seq"), text, cursor))
            elif kind == "TERM_SEARCH":
                query = msg.get("query")
                if not isinstance(query, str) or not query.strip() or len(query) > 200:
                    continue
                section = msg.get("section") if isinstance(msg.get("section"), str) else None
                span, results = await asyncio.to_thread(notepad_search, query, section)
                await send({"type": "TERM_RESULTS", "seq": msg.get("seq"), "span_words": span, "results": results})
            elif kind == "COMPLETION_CANCEL":
                # Cancelling the task closes the stream to the model server, which stops generation.
                await cancel_task(completion_task)
                completion_task = None
            elif kind == "INPUT_DELTA":
                text = msg.get("text")
                if not isinstance(text, str) or len(text) > MAX_TEXT_CHARS:
                    await send({"type": "ERROR", "seq": msg.get("seq"), "detail": "Invalid or oversized text"})
                    continue
                started = time.perf_counter()
                try:
                    # In a worker thread: spell-check may read the terminology database.
                    result = await asyncio.to_thread(
                        _analyze_with_safety, text, int(msg.get("cursor", len(text))), msg.get("skip_ranges") or [],
                        spell_cache, safety_ctx)
                except (TypeError, ValueError):
                    await send({"type": "ERROR", "seq": msg.get("seq"), "detail": "Malformed INPUT_DELTA"})
                    continue
                result.update({
                    "type": "SUGGESTION_PAYLOAD",
                    "seq": msg.get("seq"),
                    "server_ms": round((time.perf_counter() - started) * 1000, 2),
                })
                await send(result)
            else:
                await send({"type": "ERROR", "detail": "Unknown message type"})
    except WebSocketDisconnect:
        pass
    except ValueError:
        # Non-JSON frame
        await websocket.close(code=1003)
    finally:
        await cancel_task(completion_task)
