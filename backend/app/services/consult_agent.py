"""
CHIBI's consultation agent: listens quietly, works in batches, and remembers.

Every few lines of speech (BATCH_MIN_LINES, or BATCH_MAX_WAIT_S after the last batch), the agent sends the
AI three things, all through SETU-Shield (masked, verified, recorded):
  MEMORY   its own running summary of everything said so far (so each request stays small but has context)
  NEW      the lines spoken since the last batch
  NOTE     what the doctor has written
and gets back: an updated memory, new note lines (in the CareBridge note format), anything important said
but missing from the note, and at most two suggestions. With no AI available, the rule engine does the same
job (symptoms, allergies, medicines, advice, danger signs) without the memory summary's wording.

At the end, `finish` writes the consultation summary from the memory, the facts and the note.
The doctor's screen gets real names back; the AI only ever sees placeholders.
"""
import asyncio
import hashlib
import re
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from app.services import call_minutes as cm
from app.services import live_assistant as la
from app.services import privacy_gateway as pg
from app.services.ai_client import AIUnavailable, ai
from app.services.note_format import HEADING, SECTIONS, section_for

BATCH_MIN_LINES = 3
BATCH_MAX_WAIT_S = 12.0
MAX_SUGGESTIONS_PER_TURN = 2
MEMORY_WORDS = 140
Notify = Callable[[Dict[str, Any]], Awaitable[None]]

KEYS = [k for k, _, _ in SECTIONS]
KIND_TO_KEY = {
    "symptom": "complaints", "complaint": "complaints", "complaints": "complaints",
    "allergy": "allergies", "allergies": "allergies",
    "medication": "medications", "current_medications": "medications", "medications": "medications",
    "family": "history", "history": "history",
    "vital": "vitals", "vitals": "vitals",
    "exam": "exam", "examination": "exam",
    "diagnosis": "diagnosis",
    "investigation": "investigations", "investigations": "investigations", "labs": "investigations", "tests": "investigations",
    "rx": "rx", "prescription": "rx", "prescriptions": "rx",
    "advice": "advice",
    "follow_up": "follow_up", "followup": "follow_up",
    "other": "history"
}

TURN_PROMPT = f"""You are CHIBI, an expert clinical AI listening to a doctor-patient consultation in India.
The text is de-identified: [PATIENT], [DOCTOR], [PERSON_1], [PLACE_1], [ID_1] are placeholders. Keep them as they are.

You get MEMORY (your summary of the consultation so far), NEW LINES (speech since your last update) and NOTE
(what the doctor has written). Reply with JSON only:
{{"memory": "...", "facts": [{{"key": "...", "text": "..."}}], "missed": [{{"key": "...", "text": "...", "why": "..."}}],
  "suggest": [{{"kind": "ASK|CHECK|SAFETY", "text": "..."}}]}}

- memory: the updated running summary of the WHOLE consultation (old memory + new lines), at most {MEMORY_WORDS} words,
  clinical style. Keep every symptom, duration, history item, allergy, medicine and plan mentioned.
- facts: ONLY NEW verified clinical findings from NEW LINES. Must match one of these 11 section keys:
  * "complaints": Symptoms / chief complaints (e.g. "Headache", "Cough x 2 days", "Skin infection", "Pain")
  * "history": Past medical history, chronic conditions, family history
  * "allergies": Verified allergens ONLY (e.g. "Dust allergy", "Penicillin allergy"). NEVER generic words like "something" or "anything"
  * "medications": Medicines the patient already takes before this visit (e.g. "Taking painkillers x 1 day", "Metformin 500mg")
  * "vitals": Spoken vitals (BP, pulse, SpO2, temp)
  * "exam": Physical examination findings
  * "diagnosis": Clinical impression or diagnosis
  * "investigations": Diagnostic tests, lab tests, blood tests, scans ordered by the DOCTOR (e.g. "Blood test", "Complete Blood Count (CBC)", "Chest X-ray"). NEVER put lab tests in advice!
  * "rx": Medicines prescribed by the DOCTOR now during this visit (e.g. "Paracetamol 650mg", "Phenolphthalein"). EVERY medicine prescribed by the doctor MUST go to 'rx', NEVER 'advice' or 'history'!
  * "advice": Lifestyle, hydration, dietary, precautions (e.g. "Drink plenty of water", "Rest", "Avoid dust")
  * "follow_up": Review / return timeline (e.g. "Review in 3 days")
- Each fact must be ONE item per line ("Paracetamol 650mg", "Phenolphthalein"), NOT a list. If multiple medicines or tests are mentioned, output each as its own fact object.
- Filter out all hesitation noises ("ooh", "aah", "shibi", "shibhi", "shaaba", "chibi"), UI reading, and stuttered corrections.
- missed: important clinical items said but not in NOTE yet. At most 3.
- suggest: at most {MAX_SUGGESTIONS_PER_TURN}, only if clearly useful and not already asked or written. Otherwise [].
- Never invent symptoms, numbers, doses or diagnoses. Never state a diagnosis as fact."""

FINAL_PROMPT = """You are CHIBI. The consultation has ended. From MEMORY, FACTS and NOTE (de-identified; keep placeholders),
write JSON only:
{"summary": "...", "key_points": ["..."], "considerations": ["..."], "follow_up": ["..."], "gaps": ["..."]}
- summary: 2-3 plain sentences a busy doctor reads in 10 seconds. Only what was said; no filler such as
  "X was not mentioned".
- key_points: at most 6, each 2-6 words ("Fever x 4 days", "Difficulty swallowing"). No repeats.
- considerations: at most 4 things for the doctor to consider (not diagnoses), each under 12 words.
- follow_up: at most 4 concrete next steps, each under 14 words.
- gaps: at most 3 important items said in the consultation but missing from NOTE, each a few words. [] if none.
Never invent facts, numbers or doses. Never state a diagnosis as fact."""


@dataclass
class AgentState:
    memory: str = ""                        # masked running summary (what the AI sees next time)
    processed: int = 0                      # lines already handled
    facts: List[Dict[str, Any]] = field(default_factory=list)
    suggestions: List[Dict[str, Any]] = field(default_factory=list)
    alerts: List[Dict[str, Any]] = field(default_factory=list)
    turns: List[Dict[str, Any]] = field(default_factory=list)
    last_turn_at: float = field(default_factory=time.time)
    running: bool = False
    note: str = ""
    final: Optional[Dict[str, Any]] = None
    seen: set = field(default_factory=set)
    missed_model: List[Dict[str, Any]] = field(default_factory=list)
    timer: Any = None                       # pending "batch is due" check


def agent_of(session: cm.CallSession) -> AgentState:
    st = getattr(session, "agent", None)
    if st is None:
        st = AgentState()
        session.agent = st
    return st


def _show(shield: pg.Shield, text: str) -> str:
    """Real names back for the doctor; labels the AI used on its own ("[PATIENT]" with no name) read naturally."""
    out = shield.restore(text or "") or ""
    out = re.sub(r"\[PATIENT\]('s)?", lambda m: "the patient" + (m.group(1) or ""), out)
    out = re.sub(r"\[DOCTOR\]('s)?", lambda m: "the doctor" + (m.group(1) or ""), out)
    out = re.sub(r"(^|[.!?]\s+)the (patient|doctor)", lambda m: m.group(1) + "The " + m.group(2), out)
    return out


def _tidy(items: List[str]) -> List[str]:
    """Trim, drop empties and near-repeats, and start each item with a capital."""
    out: List[str] = []
    for x in items:
        x = re.sub(r"\s+", " ", x).strip(" -•.;")
        if x and not any(_covered(x, o.lower()) and _covered(o, x.lower()) for o in out):
            out.append(x[0].upper() + x[1:])
    return out


def _fid(key: str, text: str) -> str:
    return hashlib.sha1(f"{key}|{text.lower()}".encode()).hexdigest()[:12]

def _norm_key(key: Any) -> str:
    key = str(key or "").strip().lower().replace("-", "_").replace(" ", "_")
    key = {
        "symptoms": "complaints", "complaint": "complaints", "chief_complaint": "complaints", "chief_complaints": "complaints",
        "allergy": "allergies", "allergies": "allergies",
        "medication": "medications", "current_medications": "medications", "current_medication": "medications", "meds": "medications",
        "vital": "vitals", "vitals": "vitals", "vital_signs": "vitals",
        "examination": "exam", "physical_examination": "exam", "exam": "exam", "o/e": "exam",
        "diagnosis": "diagnosis", "assessment": "diagnosis", "impression": "diagnosis",
        "investigation": "investigations", "investigations": "investigations", "labs": "investigations", "tests": "investigations", "orders": "investigations",
        "rx": "rx", "prescription": "rx", "prescriptions": "rx", "prescribed": "rx", "treatment": "rx",
        "advice": "advice", "plan": "advice", "instructions": "advice",
        "follow_up": "follow_up", "followup": "follow_up", "next_visit": "follow_up", "review": "follow_up",
        "family": "history", "past_history": "history", "history": "history"
    }.get(key, key)
    return key if key in KEYS else "history"


def _covered(text: str, note_lower: str) -> bool:
    words = cm._content_words(text)
    if not words:
        return True
    return sum(1 for w in words if w in note_lower) / len(words) >= 0.6


def due(session: cm.CallSession) -> bool:
    st = agent_of(session)
    new = len(session.lines) - st.processed
    return new >= BATCH_MIN_LINES or (new > 0 and time.time() - st.last_turn_at >= BATCH_MAX_WAIT_S)


def _add_fact(st: AgentState, key: str, text: str, source: str, shield: pg.Shield) -> Optional[Dict[str, Any]]:
    text = re.sub(r"\s+", " ", str(text or "")).strip().rstrip(".")
    # The heading already says it: "Allergy: Penicillin" -> "Penicillin" under Allergies.
    text = re.sub(r"(?i)^(?:allerg(?:y|ies)|current medications?|medications?|family history|complaints?|rx|prescription|investigations?|advice|follow[- ]?up)\s*:\s*", "", text)
    if len(text) < 3:
        return None

    # Filter out fake allergens like "Something (patient-reported)" or generic hesitation words
    if key == "allergies":
        clean_cand = re.sub(r"\(patient-reported\)|\bpatient-reported\b", "", text, flags=re.I).strip(" .,-")
        if clean_cand.lower() in cm.NON_ALLERGENS or len(clean_cand) < 3:
            return None

    # Filter out acoustic / hesitation noise in facts
    if re.search(r"\b(?:shibhi|shibi|shaaba|shaba|chibi|chiba|ooh+|aah+)\b", text, re.I):
        return None

    shown = _show(shield, text) or text
    fid = _fid(key, shown)
    if fid in st.seen:
        return None
    st.seen.add(fid)
    # One line per finding, updated in place: the AI tends to restate the whole complaint each batch
    # ("Fever x 4 days" -> "Fever x 4 days, chills at night" -> ...).
    new_words = cm._content_words(shown)
    replaces: List[str] = []
    for old in [f for f in st.facts if f["key"] == key]:
        old_words = cm._content_words(old["text"])
        if not new_words or not old_words:
            continue
        if len(new_words & old_words) / len(new_words) >= 0.9:
            return None                                   # says nothing the existing line doesn't
        if len(new_words & old_words) / len(old_words) >= 0.8:
            replaces.append(old["id"])                    # a fuller version of an existing line
    if replaces:
        first = next(i for i, f in enumerate(st.facts) if f["id"] in replaces)
        st.facts = [f for f in st.facts if f["id"] not in replaces]
    fact = {"id": fid, "key": key, "heading": HEADING[key], "section": section_for(key), "text": shown,
            "source": source, "at": time.time(), "replaces": replaces}
    if replaces:
        st.facts.insert(min(first, len(st.facts)), fact)
    else:
        st.facts.append(fact)
    return fact


def _add_suggestion(st: AgentState, kind: str, text: str, shield: pg.Shield) -> Optional[Dict[str, Any]]:
    text = _show(shield, str(text or "")).strip()
    kind = str(kind or "ASK").upper()
    if len(text) < 5 or kind not in ("ASK", "CHECK", "SAFETY", "NOTE"):
        return None
    sid = _fid("s", text)
    if sid in st.seen:
        return None
    st.seen.add(sid)
    s = {"id": sid, "kind": kind, "text": text, "at": time.time()}
    st.suggestions.append(s)
    return s


def _rules_memory(st: AgentState) -> str:
    parts = []
    for key in KEYS:
        items = [f["text"] for f in st.facts if f["key"] == key]
        if items:
            parts.append(f"{HEADING[key]}: {'; '.join(items)}.")
    return " ".join(parts)


async def _model_turn(session: cm.CallSession, st: AgentState, new_lines: List[cm.TranscriptLine],
                      shield: pg.Shield) -> Dict[str, Any]:
    sent = shield.prepare("consult_agent", {
        "memory": st.memory or "(nothing yet)",
        "transcript": "\n".join(f"[{l.segment.speaker.upper()}]: {l.redacted_english}" for l in new_lines) or "(no new speech)",
        "note": st.note[-2500:] or "(empty)"})
    messages = [{"role": "system", "content": TURN_PROMPT},
                {"role": "user", "content": f"MEMORY:\n{sent.get('memory', '')}\n\nNEW LINES:\n{sent.get('transcript', '')}"
                                            f"\n\nNOTE:\n{sent.get('note', '')}"}]
    shield.release("consult_agent", messages)
    return await ai.chat_json(messages, max_tokens=700, timeout=45.0, important=True)


async def run_turn(session: cm.CallSession, notify: Optional[Notify] = None, force: bool = False) -> Optional[Dict[str, Any]]:
    """Process the lines since the last batch. Returns what changed (or None if nothing to do / busy)."""
    st = agent_of(session)
    if st.running:
        return None
    end = len(session.lines)
    new_lines = session.lines[st.processed:end]
    if not new_lines and not force:
        return None
    st.running = True
    if session.note_text:
        st.note = session.note_text          # in a call, the notepad's latest text arrives here
    started = time.perf_counter()
    shield = pg.shield_for_session(session)
    new_facts: List[Dict[str, Any]] = []
    new_sugs: List[Dict[str, Any]] = []
    engine = "rules"
    try:
        alerts = la.safety_alerts(session, new_lines)
        st.alerts.extend(alerts)
        data: Dict[str, Any] = {}
        if ai.enabled and await ai.online():
            try:
                data = await _model_turn(session, st, new_lines, shield)
                engine = "ai"
            except (pg.OutboundBlocked, AIUnavailable, ValueError, asyncio.TimeoutError, OSError) as exc:
                data = {}
                engine = f"rules ({'privacy check' if isinstance(exc, pg.OutboundBlocked) else 'AI unavailable'})"
        if data:
            for f in data.get("facts") or []:
                if isinstance(f, dict):
                    norm_k = _norm_key(f.get("key"))
                    raw_text = str(f.get("text", "")).strip()
                    # If multiple items were concatenated in one fact line (e.g. "Phenophthalene and Paracetamol" in rx),
                    # split them so each item is added as its own line in the notepad
                    if norm_k in ("rx", "investigations", "complaints") and (" and " in raw_text or ", " in raw_text):
                        parts = [p.strip() for p in re.split(r",\s*(?:and\s+)?|\s+and\s+", raw_text) if p.strip()]
                    else:
                        parts = [raw_text] if raw_text else []
                    for part in parts:
                        fact = _add_fact(st, norm_k, part, "ai", shield)
                        if fact:
                            new_facts.append(fact)
            for s in (data.get("suggest") or [])[:MAX_SUGGESTIONS_PER_TURN]:
                if isinstance(s, dict):
                    sug = _add_suggestion(st, s.get("kind"), s.get("text"), shield)
                    if sug:
                        new_sugs.append(sug)
            st.missed_model = [{"key": _norm_key(m.get("key")), "text": shield.restore(str(m.get("text", ""))),
                                "why": shield.restore(str(m.get("why", "")))}
                                for m in (data.get("missed") or [])[:3] if isinstance(m, dict) and m.get("text")]
            memory = str(data.get("memory") or "").strip()
            if memory:
                st.memory = " ".join(memory.split()[:MEMORY_WORDS + 40])
        # Rules always run too: they catch what the model skipped and keep working with no AI at all.
        for it in cm.extract_items(new_lines):
            key = KIND_TO_KEY.get(it.kind, "history")
            # Skip what the AI already wrote under this heading (no "Fever x 4 days" + "Fever for 4 days").
            same = " ".join(f["text"] for f in st.facts if f["key"] == key).lower()
            if same and _covered(re.sub(r"(?i)^(?:allerg(?:y|ies)|current medications?|medications?)\s*:\s*", "", it.text), same):
                continue
            fact = _add_fact(st, key, it.text, "rules", shield)
            if fact:
                new_facts.append(fact)
        if not data:
            st.memory = _rules_memory(st)
            for line in la.demo_suggestions(session)[:MAX_SUGGESTIONS_PER_TURN]:
                kind, _, text = line.partition(":")
                sug = _add_suggestion(st, kind, text.strip(), shield)
                if sug:
                    new_sugs.append(sug)
        st.processed = end
        st.last_turn_at = time.time()
        turn = {"at": st.last_turn_at, "lines": len(new_lines), "engine": engine,
                "ms": round((time.perf_counter() - started) * 1000), "facts": len(new_facts), "suggestions": len(new_sugs)}
        st.turns.append(turn)
        update = {"turn": turn, "facts": new_facts, "suggestions": new_sugs, "alerts": alerts}
        if notify:
            await notify({"type": "AGENT_UPDATE", **update, "missed": missed(session)})
        return update
    finally:
        st.running = False


def missed(session: cm.CallSession) -> List[Dict[str, Any]]:
    """Facts said in the consultation that the note doesn't have yet (what CHIBI quietly offers)."""
    st = agent_of(session)
    note_lower = st.note.lower()
    out = [f for f in st.facts if not _covered(f["text"], note_lower)]
    for m in st.missed_model:
        if not _covered(m["text"], note_lower) and not any(_covered(m["text"], f["text"].lower()) for f in out):
            fid = _fid(m["key"], m["text"])
            out.append({"id": fid, "key": m["key"], "heading": HEADING[m["key"]], "section": section_for(m["key"]),
                        "text": m["text"], "why": m.get("why"), "source": "ai", "at": time.time()})
    return out


def schedule(session: cm.CallSession, notify: Optional[Notify] = None) -> None:
    """Run a batch in the background when one is due; otherwise check again when the wait runs out."""
    st = agent_of(session)
    loop = asyncio.get_running_loop()
    if st.timer is not None:
        st.timer.cancel()
        st.timer = None
    if due(session) and not st.running:
        async def run_then_recheck() -> None:
            await run_turn(session, notify)
            if len(session.lines) > st.processed:        # speech arrived while the batch ran
                schedule(session, notify)
        loop.create_task(run_then_recheck())
    elif len(session.lines) > st.processed:
        wait = max(0.5, BATCH_MAX_WAIT_S - (time.time() - st.last_turn_at))
        st.timer = loop.call_later(wait, lambda: schedule(session, notify))


async def finish(session: cm.CallSession) -> Dict[str, Any]:
    """Last batch + the consultation summary."""
    st = agent_of(session)
    for _ in range(40):                      # a batch may still be running
        if not st.running:
            break
        await asyncio.sleep(0.25)
    await run_turn(session, force=bool(len(session.lines) - st.processed))
    shield = pg.shield_for_session(session)
    gaps = [m["text"] for m in missed(session)]
    final: Dict[str, Any] = {}
    engine = "rules"
    if ai.enabled and await ai.online():
        try:
            sent = shield.prepare("consult_summary", {
                "memory": st.memory, "facts": [f"{f['heading']}: {f['text']}" for f in st.facts], "note": st.note[-3000:]})
            messages = [{"role": "system", "content": FINAL_PROMPT},
                        {"role": "user", "content": f"MEMORY:\n{sent.get('memory', '')}\n\nFACTS:\n" +
                         "\n".join(sent.get("facts", [])) + f"\n\nNOTE:\n{sent.get('note', '')}"}]
            shield.release("consult_summary", messages)
            data = await ai.chat_json(messages, max_tokens=900, timeout=60.0, important=True)
            if data.get("summary"):
                limits = {"key_points": 6, "considerations": 4, "follow_up": 4, "gaps": 3}
                final = {k: (_show(shield, v) if isinstance(v, str)
                             else _tidy([_show(shield, str(x)) for x in v])[:limits[k]])
                         for k, v in data.items() if k in ("summary", *limits) and isinstance(v, (str, list))}
                engine = "ai"
        except (pg.OutboundBlocked, AIUnavailable, ValueError, asyncio.TimeoutError, OSError):
            final = {}
    if not final:
        by_key = {k: [f["text"] for f in st.facts if f["key"] == k] for k in KEYS}
        sentences = []
        if by_key["complaints"]:
            sentences.append("Presented with " + "; ".join(by_key["complaints"]).lower() + ".")
        if by_key["history"] or by_key["medications"]:
            sentences.append("History: " + "; ".join(by_key["history"] + by_key["medications"]) + ".")
        if by_key["allergies"]:
            sentences.append("Allergies: " + "; ".join(by_key["allergies"]) + ".")
        if by_key["advice"] or by_key["rx"]:
            sentences.append("Plan discussed: " + "; ".join(by_key["rx"] + by_key["advice"]) + ".")
        final = {"summary": " ".join(sentences) or "Nothing clinical was captured.",
                 "key_points": [f"{f['heading']}: {f['text']}" for f in st.facts][:12],
                 "considerations": [s["text"] for s in st.suggestions][:5],
                 "follow_up": by_key["follow_up"], "gaps": gaps}
    final.setdefault("gaps", gaps)
    final["engine"] = engine
    final["memory"] = _show(shield, st.memory)
    st.final = final
    return final


def view(session: cm.CallSession) -> Dict[str, Any]:
    """Everything the screen needs (real names restored for the doctor)."""
    st = agent_of(session)
    shield = pg.shield_for_session(session)
    return {
        "session_id": session.id, "encounter_id": session.encounter_id,
        "transcript": [{"speaker": l.segment.speaker, "text": l.segment.text, "at_ms": l.segment.start_ms} for l in session.lines],
        "pending_lines": len(session.lines) - st.processed, "busy": st.running,
        "memory": _show(shield, st.memory), "facts": st.facts, "missed": missed(session),
        "suggestions": st.suggestions[-8:], "alerts": st.alerts, "turns": st.turns[-20:], "final": st.final,
        "identifiers_removed": session.deid.summary(), "ai": ai.info(),
        "batch": {"min_lines": BATCH_MIN_LINES, "max_wait_s": BATCH_MAX_WAIT_S},
    }
