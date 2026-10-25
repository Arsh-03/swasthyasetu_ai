"""
Live consultation assistant: listens to the (consented) call and helps the doctor while they write.

Pipeline, a few seconds behind the conversation:
  audio chunk (5 s) -> speech-to-text in memory (asr.py) -> fillers/stutters removed (call_minutes.clean_speech)
  -> names, numbers, places masked (deidentify.py) -> this module:
     1. Safety alerts, rule-based and instant: danger signs the patient mentions, and medicines the doctor says
        or writes that clash with an allergy. They never wait for a model.
     2. Suggestions, streamed token by token: from your own model (Ollama on the Colab GPU gateway) when it is
        online, otherwise from the built-in demo engine (rules), labelled "Demo AI" on screen.
  The doctor decides: suggestions are shown, never written into the note without a click.

After the call, the patient can ask for a plain-language summary. It is built from the masked text only
(no names of the patient or the doctor) and is stored only if the patient says yes.

Nothing here writes audio or transcripts to disk; the session lives in memory for the call only.
"""
import asyncio
import hashlib
import json
import re
import time
import uuid
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence, Tuple

import httpx

from app.config import ai_headers, settings
from app.services import safety_engine
from app.services.call_minutes import CallSession, TranscriptLine, extract_items

Send = Callable[[Dict[str, Any]], Awaitable[None]]

MODEL_URL = settings.INTELLISENSE_LOCAL_URL.rstrip("/")
MODEL_NAME = settings.SCRIBE_LLM_MODEL or settings.INTELLISENSE_LOCAL_MODEL
HEALTH_TTL_S = max(30, settings.INTELLISENSE_HEALTH_INTERVAL_S)
DEBOUNCE_S = 1.5          # batch lines from both speakers before asking for suggestions
MODEL_TIMEOUT_S = 25.0
DEMO_TOKEN_DELAY_S = 0.035

# ---------------------------------------------------------------------------
# Is the self-hosted model online? (cached, so we don't spend the tunnel's request allowance)
# ---------------------------------------------------------------------------
_health: Dict[str, Any] = {"ok": False, "at": 0.0}


async def model_online(force: bool = False) -> bool:
    if not MODEL_NAME or not MODEL_URL:
        return False
    if not force and time.time() - _health["at"] < HEALTH_TTL_S:
        return _health["ok"]
    ok = False
    try:
        async with httpx.AsyncClient(timeout=6.0, headers=ai_headers()) as client:
            res = await client.get(f"{MODEL_URL}/api/tags")
            ok = res.status_code == 200 and "ngrok-error-code" not in res.headers
    except httpx.HTTPError:
        ok = False
    _health.update(ok=ok, at=time.time())
    return ok


def _mark_offline() -> None:
    _health.update(ok=False, at=time.time())


# ---------------------------------------------------------------------------
# 1. Safety alerts (rules)
# ---------------------------------------------------------------------------
RED_FLAGS: List[Tuple[re.Pattern, str, str]] = [
    (re.compile(r"\b(chest (?:pain|tightness|pressure|discomfort))\b", re.I), "Chest pain mentioned",
     "Consider a cardiac cause: ask about radiation, sweating, breathlessness; arrange an ECG or emergency care if suspected."),
    (re.compile(r"\b(can'?t breathe|cannot breathe|breathless(?:ness)?|short(?:ness)? of breath|difficulty (?:in )?breathing)\b", re.I),
     "Breathlessness mentioned", "Check severity now: can they speak full sentences? SpO2 if available; low threshold for in-person care."),
    (re.compile(r"\b(black (?:stools?|motions?)|blood in (?:the )?(?:stool|motion|vomit)|vomit(?:ing|ed)? blood)\b", re.I),
     "Possible bleeding", "Black stools or blood in vomit/stool can mean gastrointestinal bleeding: urgent assessment."),
    (re.compile(r"\b(faint(?:ed|ing)?|passed out|unconscious|blacked out)\b", re.I), "Fainting mentioned",
     "Ask what happened before and after; consider cardiac and neurological causes."),
    (re.compile(r"\b(fits|seizures?|convulsions?)\b", re.I), "Seizure mentioned", "Ask duration, first episode or known epilepsy; injury; current status."),
    (re.compile(r"\b(stiff neck|neck stiffness)\b", re.I), "Neck stiffness", "With fever or headache this can mean meningitis: urgent assessment."),
    (re.compile(r"\b(weakness (?:on|of) one side|face (?:drooping|deviated)|slurred speech|can'?t move (?:my )?(?:arm|leg))\b", re.I),
     "Possible stroke signs", "Sudden one-sided weakness or slurred speech: emergency referral (time matters)."),
    (re.compile(r"\b(suicid\w*|kill myself|end my life|don'?t want to live)\b", re.I), "Self-harm risk",
     "Ask directly about thoughts and plans; do not end the call without a safety plan; Tele-MANAS 14416."),
    (re.compile(r"\b(pregnan\w*)\b.*\b(bleeding|pain)\b|\b(bleeding|pain)\b.*\bpregnan\w*", re.I), "Pain or bleeding in pregnancy",
     "Needs urgent obstetric assessment."),
]


def _alert_id(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).lower().encode()).hexdigest()[:12]


def safety_alerts(session: CallSession, new_lines: Sequence[TranscriptLine]) -> List[Dict[str, Any]]:
    """New alerts only (each one is sent once per call)."""
    out: List[Dict[str, Any]] = []
    sent = session.sent_alerts
    for line in new_lines:
        if line.segment.speaker != "patient":
            continue
        for rx, title, detail in RED_FLAGS:
            if rx.search(line.segment.english):
                aid = _alert_id("flag", title)
                if aid not in sent:
                    sent.add(aid)
                    out.append({"id": aid, "kind": "red_flag", "severity": "urgent", "title": title, "detail": detail,
                                "quote": line.segment.text, "quote_english": line.segment.english,
                                "at_ms": line.segment.start_ms, "source": "Danger-sign rules"})

    # Allergies: recorded ones plus any the patient mentions in this call, against medicines the doctor says or writes.
    allergies = list(session.known_allergies)
    for item in extract_items(session.lines):
        if item.kind == "allergy":
            m = re.search(r"allergy:\s*([^(]+)", item.text, re.I)
            name = (m.group(1) if m else item.text).strip()
            if name and name.lower() not in (a.lower() for a in allergies):
                allergies.append(name)
    if allergies:
        doctor_said = "\n".join(l.segment.english for l in session.lines if l.segment.speaker == "doctor")
        result = safety_engine.check(f"{session.note_text}\n{doctor_said}", allergies=allergies)
        for a in result["alerts"]:
            if a["kind"] != "allergy":
                continue
            aid = _alert_id("allergy", a["title"])
            if aid in sent:
                continue
            sent.add(aid)
            out.append({"id": aid, "kind": "allergy", "severity": "urgent", "title": a["title"], "detail": a["detail"],
                        "quote": "", "quote_english": "", "at_ms": None, "source": a["source"]})
    return out


# ---------------------------------------------------------------------------
# 2. Suggestions (model when online, demo rules otherwise), streamed
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = (
    "You assist a doctor during a live telemedicine consultation. The transcript is de-identified: [DOCTOR] and "
    "[PATIENT] are the two speakers; other placeholders like [PERSON_1] or [PHONE_1] replace personal details.\n"
    "Suggest up to 3 short, specific items that would help the doctor right now, one per line, each starting with one of:\n"
    "ASK: a question worth asking the patient\nCHECK: something to examine or measure\n"
    "NOTE: something said that should be documented\nSAFETY: a safety consideration\n"
    "Rules: max 18 words per item. Use only facts from the transcript. Never state a diagnosis as fact. Never give "
    "drug doses. Don't repeat what the doctor already asked or wrote. If nothing useful, reply exactly NONE."
)
KINDS = ("ASK", "CHECK", "NOTE", "SAFETY")


def _context(session: CallSession) -> str:
    recent = session.lines[-14:]
    transcript = "\n".join(f"[{l.segment.speaker.upper()}]: {l.redacted_english}" for l in recent)
    note = session.deid.redact(session.note_text[-1500:]) if session.note_text else "(empty)"
    allergies = ", ".join(session.known_allergies) or "none recorded"
    return f"TRANSCRIPT (latest):\n{transcript}\n\nDOCTOR'S NOTE SO FAR:\n{note}\n\nRECORDED ALLERGIES: {allergies}"


def parse_items(text: str, session: CallSession) -> List[Dict[str, str]]:
    items = []
    for raw in text.splitlines():
        m = re.match(r"^\s*[-*\d.)]*\s*(ASK|CHECK|NOTE|SAFETY)\s*:\s*(.+)$", raw.strip(), re.I)
        if not m:
            continue
        body = session.deid.restore(m.group(2).strip().rstrip(". "))
        if re.search(r"\b\d+\s*(mg|ml|mcg|g)\b", body, re.I):
            continue  # no doses from the assistant
        key = re.sub(r"\W+", " ", body.lower()).strip()
        if not key or key in session.sent_suggestions:
            continue
        session.sent_suggestions.add(key)
        end = "" if body.endswith(("?", "!")) else "."
        items.append({"id": hashlib.sha1(key.encode()).hexdigest()[:12], "kind": m.group(1).upper(), "text": body + end})
    return items[:3]


def demo_suggestions(session: CallSession) -> List[str]:
    """Rule-based suggestions from the conversation so far (demo engine; no model)."""
    patient = " ".join(l.segment.english.lower() for l in session.lines if l.segment.speaker == "patient")
    doctor = " ".join(l.segment.english.lower() for l in session.lines if l.segment.speaker == "doctor")
    note = session.note_text.lower()
    asked = lambda *words: any(w in doctor or w in note for w in words)  # noqa: E731
    out: List[str] = []
    if "fever" in patient and not asked("temperature", "thermometer", "how high"):
        out.append("ASK: Highest temperature measured at home, and any rash or joint pain?")
    if re.search(r"\b(three|3|four|4|five|5|six|6|seven|7) days?\b", patient) and "fever" in patient:
        out.append("CHECK: Fever for 3 or more days: consider a blood count and seasonal tests (dengue, malaria).")
    if "throat" in patient and not asked("swallow", "tonsil"):
        out.append("CHECK: Look at the throat: tonsil swelling or white patches? Any pain on swallowing?")
    if "cough" in patient and not asked("phlegm", "sputum", "dry cough"):
        out.append("ASK: Is the cough dry or with phlegm? Any blood in it, or breathlessness?")
    if "headache" in patient and not asked("neck", "vomit", "vision"):
        out.append("ASK: Any neck stiffness, vomiting or blurred vision with the headache?")
    if ("metformin" in patient or "sugar" in patient or "diabet" in patient) and "fever" in patient and not asked("sugar reading", "glucose"):
        out.append("SAFETY: Known diabetic with fever: ask about recent sugar readings; illness can raise blood sugar.")
    if ("penicillin" in patient or any("penicillin" in a.lower() for a in session.known_allergies)) and not asked("avoid amox", "beta-lactam"):
        out.append("SAFETY: Penicillin allergy: avoid amoxicillin and other beta-lactam antibiotics.")
    if re.search(r"\b(father|mother|brother|sister)\b", patient) and "family" not in note:
        out.append("NOTE: Add the family history the patient mentioned to the note.")
    if not asked("allerg") and (re.search(r"\b(take|prescrib|tablet|medicine)\b", doctor)):
        out.append("ASK: Ask about drug allergies before prescribing.")
    return out


async def _stream_demo(session: CallSession, send: Send, rid: str) -> str:
    lines = [s for s in demo_suggestions(session)
             if re.sub(r"\W+", " ", s.split(":", 1)[1].lower()).strip().rstrip(" ") not in session.sent_suggestions][:3]
    text = ""
    for line in lines:
        for word in (line + "\n").split(" "):
            text += word + (" " if not word.endswith("\n") else "")
            await send({"type": "AI_ASSIST", "state": "streaming", "id": rid, "text": text, "engine": "demo"})
            await asyncio.sleep(DEMO_TOKEN_DELAY_S)
    return text


async def _stream_model(session: CallSession, send: Send, rid: str) -> str:
    payload = {
        "model": MODEL_NAME, "stream": True, "keep_alive": settings.INTELLISENSE_LOCAL_KEEP_ALIVE,
        "options": {"temperature": 0.2, "num_predict": 140},
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": _context(session)}],
    }
    text = ""
    async with httpx.AsyncClient(timeout=MODEL_TIMEOUT_S, headers=ai_headers()) as client:
        async with client.stream("POST", f"{MODEL_URL}/api/chat", json=payload) as res:
            res.raise_for_status()
            async for raw in res.aiter_lines():
                if not raw.strip():
                    continue
                chunk = json.loads(raw)
                delta = (chunk.get("message") or {}).get("content") or ""
                if delta:
                    text += delta
                    # The doctor's screen shows real names; the model only ever saw placeholders.
                    await send({"type": "AI_ASSIST", "state": "streaming", "id": rid,
                                "text": session.deid.restore(text), "engine": "live"})
                if chunk.get("done"):
                    break
    return text


async def _suggest_once(session: CallSession, send: Send) -> None:
    rid = uuid.uuid4().hex[:10]
    engine = "live" if await model_online() else "demo"
    try:
        text = await (_stream_model(session, send, rid) if engine == "live" else _stream_demo(session, send, rid))
    except (httpx.HTTPError, ValueError, asyncio.TimeoutError):
        _mark_offline()                      # model went away mid-call: carry on with the demo engine
        engine = "demo"
        text = await _stream_demo(session, send, rid)
    items = [] if text.strip().upper().startswith("NONE") else parse_items(text, session)
    await send({"type": "AI_ASSIST", "state": "done", "id": rid, "items": items, "engine": engine})


def schedule_suggestions(session: CallSession, send: Send) -> None:
    """Ask for suggestions after new speech; one request at a time per call, re-run if more speech arrived."""
    session.assist_dirty = True
    if session.assist_running:
        return

    async def runner() -> None:
        session.assist_running = True
        try:
            while session.assist_dirty and not session.ending:
                session.assist_dirty = False
                await asyncio.sleep(DEBOUNCE_S)
                await _suggest_once(session, send)
        finally:
            session.assist_running = False

    asyncio.create_task(runner())


# ---------------------------------------------------------------------------
# 3. Patient summary (masked; stored only if the patient asks for it)
# ---------------------------------------------------------------------------
_PLACEHOLDER = re.compile(r"\[(?:PERSON|PHONE|ABHA|ID|EMAIL|PIN|PLACE|DATE)(?:_\d+)?\]")


def _mask_for_patient(text: str) -> str:
    text = re.sub(r"^(?:Advised|Plan|Advice):\s*", "", text, flags=re.I)
    text = text.replace("[PATIENT]", "you").replace("[DOCTOR]", "your doctor")
    return re.sub(r"\s{2,}", " ", _PLACEHOLDER.sub("", text)).strip(" ,.") + "."


SUMMARY_PROMPT = (
    "Write a short, kind summary of a doctor's consultation for the patient, in {language}. Use simple words. "
    "Sections: what you told the doctor; what the doctor advised; what to do next; when to seek help urgently. "
    "Use only the facts given. Do not mention any names. Keep medicine names and numbers exactly as given. "
    "Reply as JSON: {{\"told\": [...], \"advice\": [...], \"next\": [...], \"urgent\": [...]}}."
)
LANG_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada"}


def build_summary_facts(session: CallSession) -> Dict[str, List[str]]:
    told, advice, nxt = [], [], []
    for item in extract_items(session.lines):
        masked = _mask_for_patient(session.deid.redact(item.text))
        if item.kind in ("symptom", "allergy", "family", "medication"):
            told.append(masked)
        elif item.kind == "advice":
            (nxt if re.search(r"\b(come back|return|review|follow)", masked, re.I) else advice).append(masked)
    return {"told": told[:8], "advice": advice[:6], "next": nxt[:4],
            "urgent": ["If you feel much worse, have trouble breathing, chest pain or faint, call 108 at once."]}


async def build_patient_summary(session: CallSession, language: str) -> Dict[str, Any]:
    facts = build_summary_facts(session)
    if language != "en" and await model_online():
        try:
            payload = {"model": MODEL_NAME, "stream": False, "format": "json", "options": {"temperature": 0.2},
                       "messages": [{"role": "system", "content": SUMMARY_PROMPT.format(language=LANG_NAMES.get(language, "English"))},
                                    {"role": "user", "content": json.dumps(facts, ensure_ascii=False)}]}
            async with httpx.AsyncClient(timeout=40.0, headers=ai_headers()) as client:
                res = await client.post(f"{MODEL_URL}/api/chat", json=payload)
                res.raise_for_status()
                data = json.loads((res.json().get("message") or {}).get("content") or "{}")
            written = {k: [str(x) for x in data.get(k, []) if str(x).strip()][:8] for k in ("told", "advice", "next", "urgent")}
            if any(written.values()):
                return {"language": language, "sections": written, "engine": "live"}
        except (httpx.HTTPError, ValueError, AttributeError):
            _mark_offline()
    return {"language": "en", "sections": facts, "engine": "rules"}


# In memory until the patient answers (then stored, or dropped). Expires after an hour.
_pending: Dict[str, Dict[str, Any]] = {}
PENDING_TTL_S = 3600


def offer_summary(patient_id: str, encounter_id: str, summary: Dict[str, Any]) -> str:
    now = time.time()
    for sid in [k for k, v in _pending.items() if now - v["at"] > PENDING_TTL_S]:
        _pending.pop(sid, None)
    sid = f"sum_{uuid.uuid4().hex[:12]}"
    _pending[sid] = {"patient_id": patient_id, "encounter_id": encounter_id, "summary": summary, "at": now}
    return sid


def pending_for(patient_id: str) -> List[Dict[str, Any]]:
    return [{"summary_id": k, "encounter_id": v["encounter_id"]} for k, v in _pending.items()
            if v["patient_id"] == patient_id and time.time() - v["at"] <= PENDING_TTL_S]


def take_pending(summary_id: str, patient_id: str) -> Optional[Dict[str, Any]]:
    v = _pending.get(summary_id)
    if not v or v["patient_id"] != patient_id:
        return None
    return _pending.pop(summary_id)
