"""
Consultation call minutes: transcript -> structured minutes -> "missing from the doctor's note".

Privacy model:
  - Audio is transcribed in memory (asr.py) and discarded; nothing is written to disk.
  - Every transcript line is de-identified (deidentify.py) before any analysis or model sees it.
    Only the doctor's own screen shows the original wording.
  - Sessions live in server memory only for the call (and are purged after SESSION_TTL_S idle).

Extraction runs with built-in rules (no model needed). If SCRIBE_LLM_PROVIDER=local, your own Ollama
model additionally reviews the *de-identified* transcript for anything the rules missed.
Nothing is ever written into the note by the server: the doctor's notepad decides what to add.
"""
import hashlib
import json
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx

from app.config import ai_headers, settings
from app.services.asr import Segment, asr
from app.services.deidentify import Deidentifier
from app.services.safety_engine import find_medicines

SESSION_TTL_S = 3 * 3600
MAX_AUDIO_BYTES = 6 * 1024 * 1024

# ---------------------------------------------------------------------------
# Sessions (memory only)
# ---------------------------------------------------------------------------
@dataclass
class TranscriptLine:
    segment: Segment
    redacted_english: str                     # what analysis / models are allowed to see


@dataclass
class CallSession:
    id: str
    encounter_id: str
    deid: Deidentifier
    consent_at: Optional[float] = None
    ai_enabled: bool = True
    lines: List[TranscriptLine] = field(default_factory=list)
    note_text: str = ""
    last_activity: float = field(default_factory=time.time)
    pending_uploads: int = 0                  # chunks being transcribed right now
    # The patient's phone can't record, so the doctor's app records the patient's voice from the call
    # (set only when the patient consents from such a device).
    patient_recorded_by_doctor: bool = False
    ending: bool = False                      # the call ended; waiting for the last chunks


_sessions: Dict[str, CallSession] = {}


def create_session(encounter_id: str, deid: Deidentifier) -> CallSession:
    purge_expired()
    s = CallSession(id=f"call_{uuid.uuid4().hex[:12]}", encounter_id=encounter_id, deid=deid)
    _sessions[s.id] = s
    return s


def get_session(session_id: str) -> Optional[CallSession]:
    s = _sessions.get(session_id)
    if s:
        s.last_activity = time.time()
    return s


def end_session(session_id: str) -> None:
    s = _sessions.pop(session_id, None)
    if s and asr is not None and hasattr(asr, "forget"):
        asr.forget(session_id)


def purge_expired() -> None:
    now = time.time()
    for sid in [k for k, v in _sessions.items() if now - v.last_activity > SESSION_TTL_S]:
        end_session(sid)


async def add_audio(session: CallSession, speaker: str, audio: bytes, mime: str, offset_ms: int,
                    duration_ms: int) -> List[TranscriptLine]:
    """Transcribe one chunk (in memory), de-identify it, and keep it for this call only."""
    if asr is None:
        return []
    session.pending_uploads += 1
    try:
        segments = await asr.transcribe(session.id, speaker, audio, mime, offset_ms, duration_ms)
    finally:
        session.pending_uploads -= 1
    new = [TranscriptLine(seg, session.deid.redact(punctuate(seg.english))) for seg in segments if seg.english.strip()]
    session.lines.extend(new)
    session.last_activity = time.time()
    return new


# ---------------------------------------------------------------------------
# Rule-based extraction (works on the de-identified English text)
# ---------------------------------------------------------------------------
NUMBER_WORDS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
                "eight": 8, "nine": 9, "ten": 10, "few": None, "couple": 2}
DURATION_RE = re.compile(
    r"\b(?:for|since|from)\s+(?:the\s+(?:last|past)\s+)?(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|couple of|few)"
    r"\s+(day|week|month|year)s?\b", re.I)
MODIFIER_RE = re.compile(r"\b(?:gets?\s+)?(worse|more|increases?|better)\s+(at night|in the (?:morning|evening)|after (?:food|meals)|on exertion|on lying down)", re.I)

# symptom -> words that count as "already in the note"
SYMPTOMS: Dict[str, Tuple[str, ...]] = {
    "fever": ("fever", "pyrexia", "febrile"), "cough": ("cough",), "sore throat": ("sore throat", "throat pain", "pharyngitis", "throat"),
    "headache": ("headache", "cephalgia", "head ache"), "body ache": ("body ache", "bodyache", "myalgia", "body pain"),
    "cold": ("cold", "coryza", "rhinitis", "running nose", "runny nose"), "runny nose": ("runny nose", "running nose", "rhinorrhoea", "coryza"),
    "chills": ("chills", "rigor"), "vomiting": ("vomiting", "emesis"), "nausea": ("nausea",),
    "loose motions": ("loose motion", "loose stools", "diarrhoea", "diarrhea"), "diarrhoea": ("diarrhoea", "diarrhea", "loose stools", "loose motion"),
    "breathlessness": ("breathless", "shortness of breath", "dyspnoea", "dyspnea", "sob"),
    "chest pain": ("chest pain", "chest discomfort"), "abdominal pain": ("abdominal pain", "pain in abdomen", "stomach pain"),
    "stomach pain": ("stomach pain", "abdominal pain", "pain in abdomen"), "dizziness": ("dizziness", "giddiness", "vertigo"),
    "weakness": ("weakness", "fatigue", "tiredness"), "burning urination": ("burning", "dysuria"),
    "rash": ("rash",), "itching": ("itching", "pruritus"), "joint pain": ("joint pain", "arthralgia"),
    "back pain": ("back pain", "backache"), "loss of appetite": ("appetite", "anorexia"), "palpitations": ("palpitation",),
}
_SYMPTOM_RE = re.compile(r"\b(" + "|".join(re.escape(s) for s in sorted(SYMPTOMS, key=len, reverse=True)) + r")s?\b", re.I)

ALLERGY_RES = [
    re.compile(r"\b(?:allergic|allergy)\s+(?:to|from|with)\s+([a-z][a-z \-]{2,30}?)(?=[.,;]|\s+(?:and|but|so)\b|$)", re.I),
    re.compile(r"\b(?:get|gets|got|have|develop)\s+(rash(?:es)?|itching|swelling|hives)\s+(?:from|after|with|due to)\s+([a-z][a-z \-]{2,30}?)(?=[.,;]|\s+(?:and|but)\b|$)", re.I),
    re.compile(r"\b([a-z][a-z\-]{3,30})\s+allergy\b", re.I),
]
REACTION_RE = re.compile(r"\b(rash(?:es)?|itching|swelling|hives|breathless(?:ness)?|anaphylaxis)\b", re.I)

FAMILY_RE = re.compile(
    r"\b(father|mother|brother|sister|parents|grandfather|grandmother|son|daughter|uncle|aunt)\s+(?:also\s+)?"
    r"(?:has|had|have|suffers?\s+from|suffered\s+from|died\s+of|is\s+on\s+treatment\s+for)\s+(?:a\s+)?([a-z][a-z \-]{2,30}?)(?=[.,;]|\s+(?:and|but)\b|$)", re.I)
COLLOQUIAL_CONDITIONS = {
    "sugar": "diabetes", "sugar problem": "diabetes", "bp": "hypertension", "high bp": "hypertension",
    "pressure": "hypertension", "heart attack": "heart attack", "attack": "heart attack", "tb": "tuberculosis",
    "dama": "asthma", "piles": "piles", "thyroid": "thyroid disorder", "cancer": "cancer",
}
CONDITION_ALIASES = {
    "diabetes": ("diabet", "sugar", "dm", "t2dm"), "hypertension": ("hypertension", "htn", "bp"),
    "heart attack": ("heart attack", "myocardial", "mi", "ihd", "cad"), "asthma": ("asthma", "dama"),
    "tuberculosis": ("tuberculosis", "tb", "koch"),
}
MED_CONTEXT_RE = re.compile(r"\b(take|taking|takes|took|on|using|use|been given|prescribed)\b", re.I)
FREQUENCY_RE = re.compile(r"\b(every (?:morning|night|evening|day)|daily|once a day|twice a day|thrice a day|at night|in the morning|when needed)\b", re.I)
ADVICE_RE = re.compile(r"^(?:please\s+)?(take|drink|avoid|come back|return|review|get|do|start|stop|continue|rest|apply|use|check|monitor|eat)\b", re.I)
STOP_WORDS = {"the", "and", "with", "your", "you", "are", "for", "this", "that", "after", "before", "plenty", "some",
              "take", "drink", "come", "back", "please", "if", "not", "better", "is", "above", "of", "a", "an", "to"}


@dataclass
class Item:
    kind: str                    # symptom | allergy | medication | family | advice | other
    section: str                 # complaints | history | plan | exam | labs
    text: str                    # what would be added to the note
    keys: List[Tuple[str, ...]]  # each group: at least one of these must be in the note for "present"
    line: TranscriptLine
    severity: str = "routine"    # routine | urgent
    source: str = "rules"

    @property
    def id(self) -> str:
        return hashlib.sha1(f"{self.kind}|{self.text.lower()}".encode()).hexdigest()[:12]


CLAUSE_STARTS = {"i", "my", "you", "we", "also", "please"}
NO_BREAK_AFTER = {"and", "but", "so", "that", "because", "when", "if", "then", "me", "to", "on", "for", "as", "or",
                  "do", "did", "does", "can", "could", "will", "would", "have", "has", "what", "where", "how", "why",
                  "are", "is", "was", "were", "should", "shall", "may", "might", "than", "which", "who"}


def punctuate(text: str) -> str:
    """Speech-to-text sometimes returns one long lowercase run-on. Split it where a new clause clearly starts
    ("...worse at night i get rashes from penicillin i take metformin...") so the rules see real sentences."""
    words = text.split()
    if not words or sum(text.count(c) for c in ".?!") * 20 >= len(words):
        return text                                   # already punctuated
    out: List[str] = []
    for i, w in enumerate(words):
        lw = w.lower().strip(",")
        if lw == "i":
            w = "I" + w[1:]
        if (i > 0 and lw in CLAUSE_STARTS and out[-1].lower().strip(",") not in NO_BREAK_AFTER
                and not out[-1].endswith((".", "?", "!"))):
            out[-1] = out[-1].rstrip(",") + "."
            w = w[0].upper() + w[1:]
        out.append(w)
    joined = " ".join(out)
    joined = joined[0].upper() + joined[1:]
    return joined if joined.endswith((".", "?", "!")) else joined + "."


QUESTION_RE = re.compile(r"^(?:do|does|did|are|is|have|has|any|what|how|when|where|which|can|could|would|will)\s+"
                         r"(?:you|your|there)\b", re.I)


def _sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n", text) if s.strip()]


def _num(word: str) -> Optional[int]:
    word = word.lower().replace(" of", "")
    return int(word) if word.isdigit() else NUMBER_WORDS.get(word)


def _duration(sentence: str) -> str:
    m = DURATION_RE.search(sentence)
    if not m:
        return ""
    n, unit = _num(m.group(1)), m.group(2).lower()
    if n is None:
        return f" for a few {unit}s"
    return f" for {n} {unit}{'s' if n != 1 else ''}"


def _condition(phrase: str) -> str:
    p = phrase.strip().lower()
    for colloquial, standard in COLLOQUIAL_CONDITIONS.items():
        if p == colloquial or p.startswith(colloquial + " "):
            return standard
    return p


def extract_items(lines: Sequence[TranscriptLine]) -> List[Item]:
    from app.services.safety_engine import _build_matcher  # display names (Paracetamol, Aspirin...)

    display = _build_matcher().display
    items: List[Item] = []
    for line in lines:
        speaker = line.segment.speaker
        for sentence in _sentences(line.redacted_english):
            if speaker == "patient":
                allergy_found = False
                for rx in ALLERGY_RES:
                    for m in rx.finditer(sentence):
                        allergen = (m.group(2) if m.lastindex and m.lastindex >= 2 else m.group(1)).strip()
                        if allergen.lower() in ("any", "anything", "nothing", "no", "medicine", "medicines"):
                            continue
                        reaction = REACTION_RE.search(sentence)
                        meds = find_medicines(allergen)
                        name = display.get(meds[0].drugs[0], allergen) if meds else allergen
                        items.append(Item(
                            "allergy", "history",
                            f"Allergy: {name.title() if name.islower() else name}"
                            + (f" ({reaction.group(1).lower()})" if reaction else "") + " (patient-reported).",
                            [(name.lower(), allergen.lower()), ("allerg",)], line, severity="urgent"))
                        allergy_found = True
                for m in FAMILY_RE.finditer(sentence):
                    relation, condition = m.group(1).lower(), _condition(m.group(2))
                    aliases = CONDITION_ALIASES.get(condition, (condition,))
                    items.append(Item("family", "history", f"Family history: {condition} ({relation}).",
                                      [aliases, ("family", "father", "mother", "brother", "sister", "parent", relation)], line))
                if MED_CONTEXT_RE.search(sentence) and not allergy_found:
                    freq = FREQUENCY_RE.search(sentence)
                    for mention in find_medicines(sentence):
                        for drug in mention.drugs:
                            name = display.get(drug, drug.title())
                            items.append(Item("medication", "history",
                                              f"Current medication: {name}" + (f", {freq.group(1).lower()}" if freq else "") + ".",
                                              [(name.lower(), mention.text.lower())], line))
                if not allergy_found:
                    duration = _duration(sentence)          # "fever, sore throat and cough for 3 days": applies to all
                    for clause in re.split(r",\s*(?:and\s+)?|\s+and\s+", sentence):
                        modifier = MODIFIER_RE.search(clause)   # "worse at night": only within its own clause
                        for m in _SYMPTOM_RE.finditer(clause):
                            symptom = m.group(1).lower()
                            text = symptom.capitalize() + duration
                            keys = [SYMPTOMS[symptom]]
                            if modifier:
                                text += f", {modifier.group(1).lower()} {modifier.group(2).lower()}"
                                keys.append((modifier.group(2).lower().split()[-1],))   # e.g. "night" must be in the note too
                            items.append(Item("symptom", "complaints", text + ".", keys, line))
            else:  # doctor
                if sentence.rstrip().endswith("?"):
                    continue                                  # a question, not advice
                for clause in re.split(r",\s*(?:and\s+)?|\s+and\s+", sentence):
                    clause = clause.strip(" .")
                    if not ADVICE_RE.match(clause) or QUESTION_RE.match(clause):
                        continue
                    words = [w for w in re.findall(r"[a-z]{4,}|\d+", clause.lower()) if w not in STOP_WORDS]
                    keys = [tuple({w, w.rstrip("s")}) for w in words[:3]] or [(clause.lower(),)]
                    if re.search(r"come back|return|review", clause, re.I):
                        keys = [("review", "follow", "come back", "revisit")]
                    items.append(Item("advice", "plan", f"Advised: {clause[0].lower() + clause[1:]}.", keys, line))
    # De-duplicate (same text), keeping the first occurrence.
    seen, unique = set(), []
    for it in items:
        if it.id not in seen:
            seen.add(it.id)
            unique.append(it)
    return unique


def _present(item: Item, note_lower: str) -> bool:
    def has(term: str) -> bool:
        term = term.strip().lower()
        if len(term) <= 3:                       # short terms (dm, bp, tb) must be whole words
            return re.search(rf"(?<![a-z]){re.escape(term)}(?![a-z])", note_lower) is not None
        return term in note_lower
    return all(any(has(t) for t in group if t) for group in item.keys)


# ---------------------------------------------------------------------------
# Optional: your own language model reviews the de-identified transcript
# ---------------------------------------------------------------------------
LLM_PROMPT = """You review a doctor-patient consultation transcript and the doctor's note.
Names and identifiers are already replaced with placeholders like [PATIENT]; never guess them.
List clinical facts that were said in the conversation but are MISSING from both the note and ALREADY FOUND:
symptoms (with duration and character), past illnesses, allergies, current medicines, family history, advice given.
Rules:
- One fact per item, written as a short clinical note line, e.g. "Dry cough, worse at night." or
  "Family history: heart attack (father)." Do not start with "Patient reports".
- Only clinical content. Never include contact details, phone numbers, addresses, names, IDs or placeholders.
- Do not repeat anything in the note or in ALREADY FOUND, even in other words.
- Do not invent or infer anything that was not said. If nothing is missing, return an empty list.
Respond with JSON only:
{"missing": [{"section": "complaints|history|plan", "text": "short note line", "evidence": "exact quote"}]}"""

NON_CLINICAL_RE = re.compile(r"\[|contact|phone|number|call (?:me|him|her)|address|e-?mail|name", re.I)
_CONTENT_WORD_RE = re.compile(r"[a-z]{4,}")
_FILLER = {"patient", "reports", "reported", "mentions", "states", "says", "with", "from", "have", "having", "that",
           "this", "takes", "taking", "history", "family", "current", "medication", "advised", "days", "weeks",
           "present", "presents", "complains", "complaint", "noted", "also", "since"}


def _content_words(text: str) -> set:
    return {w.rstrip("s") for w in _CONTENT_WORD_RE.findall(text.lower()) if w not in _FILLER}


def _already_covered(text: str, note_lower: str, known: Sequence[str]) -> bool:
    """True when the model's line adds nothing new: (nearly) all its clinical words are already in the note
    or in the items found so far, taken together ("fever, sore throat and cough" vs three separate lines)."""
    words = _content_words(text)
    if not words:
        return True
    seen = _content_words(note_lower).union(*(_content_words(k) for k in known)) if known else _content_words(note_lower)
    new = [w for w in words if w not in seen and w not in note_lower]
    return len(new) <= len(words) * 0.2


async def _llm_items(session: CallSession, note_text: str, found: Sequence[str] = ()) -> List[Dict[str, str]]:
    if settings.SCRIBE_LLM_PROVIDER != "local" or not (settings.SCRIBE_LLM_MODEL or settings.INTELLISENSE_LOCAL_MODEL):
        return []
    transcript = "\n".join(f"[{l.segment.speaker.upper()}]: {l.redacted_english}" for l in session.lines)
    payload = {
        "model": settings.SCRIBE_LLM_MODEL or settings.INTELLISENSE_LOCAL_MODEL,
        "stream": False, "format": "json", "options": {"temperature": 0.1},
        "messages": [
            {"role": "system", "content": LLM_PROMPT},
            {"role": "user", "content": f"TRANSCRIPT:\n{transcript}\n\nDOCTOR'S NOTE:\n{session.deid.redact(note_text)}"
                                        f"\n\nALREADY FOUND:\n" + ("\n".join(found) or "(nothing)")},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.SCRIBE_ASR_TIMEOUT_S, headers=ai_headers()) as client:
            res = await client.post(f"{settings.INTELLISENSE_LOCAL_URL.rstrip('/')}/api/chat", json=payload)
            res.raise_for_status()
            data = json.loads(res.json().get("message", {}).get("content") or "{}")
        return [m for m in data.get("missing", []) if isinstance(m, dict) and m.get("text")]
    except (httpx.HTTPError, ValueError, AttributeError):
        return []   # model unavailable: the rule-based results still stand


# ---------------------------------------------------------------------------
# Analysis for the doctor's screen
# ---------------------------------------------------------------------------
def _line_view(line: TranscriptLine) -> Dict[str, Any]:
    seg = line.segment
    return {"speaker": seg.speaker, "start_ms": seg.start_ms, "text": seg.text, "english": seg.english,
            "language": seg.language}


async def analyze(session: CallSession, note_text: Optional[str] = None) -> Dict[str, Any]:
    if note_text is not None:
        session.note_text = note_text
    note_lower = session.note_text.lower()
    items = extract_items(session.lines)
    minutes: Dict[str, List[str]] = {}
    missing: List[Dict[str, Any]] = []
    for it in items:
        minutes.setdefault(it.kind, []).append(it.text)
        if not _present(it, note_lower):
            missing.append({
                "id": it.id, "kind": it.kind, "section": it.section, "text": it.text, "severity": it.severity,
                "source": it.source, "speaker": it.line.segment.speaker, "at_ms": it.line.segment.start_ms,
                "quote": it.line.segment.text, "quote_english": it.line.segment.english,
            })
    found = [it.text for it in items]
    for extra in await _llm_items(session, session.note_text, found):
        raw = str(extra["text"]).strip()
        if NON_CLINICAL_RE.search(raw) or _already_covered(raw, note_lower, found + [m["text"] for m in missing]):
            continue
        text = session.deid.restore(raw)
        missing.append({
            "id": hashlib.sha1(f"llm|{text.lower()}".encode()).hexdigest()[:12], "kind": "other",
            "section": extra.get("section") if extra.get("section") in ("complaints", "history", "plan") else "history",
            "text": text if text.endswith(".") else text + ".", "severity": "routine", "source": "model",
            "speaker": "conversation", "at_ms": None, "quote": session.deid.restore(str(extra.get("evidence", ""))),
            "quote_english": "",
        })
    return {
        "session_id": session.id,
        "transcript": [_line_view(l) for l in session.lines],
        "minutes": minutes,
        "missing": missing,
        "identifiers_removed": session.deid.summary(),
        "engine": {"speech": getattr(asr, "name", None), "analysis": "rules + local model"
                   if settings.SCRIBE_LLM_PROVIDER == "local" else "rules"},
    }
