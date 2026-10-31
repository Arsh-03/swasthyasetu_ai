"""
SETU-Shield v1: the rules every piece of patient data follows before it leaves our server for an AI model.

The goal: an AI server (ours on Colab today, a third-party API tomorrow) gets enough to give a useful general
answer, and nothing that tells it which patient or which doctor the data is about.

The seven steps (every outbound AI request goes through `Shield.prepare` + `Shield.release`):

  S1 MINIMISE    Each purpose has an allowlist of fields. Anything else is dropped before it is even masked.
  S2 MASK        Direct identifiers become placeholders: names (all scripts), phone, Aadhaar, ABHA, e-mail,
                 our own record IDs, registration numbers, places, full dates. (deidentify.py + exact identifiers)
  S3 GENERALISE  Quasi-identifiers are coarsened: exact age -> age band ("50s"), sex normalised.
  S4 UNLINK      No patient / doctor / encounter IDs, no stable per-person tokens. Requests come from our
                 server, never from the doctor's or patient's device, so the AI side sees one hospital, not people.
  S5 VERIFY      The final payload is scanned for every identifier we know for this patient and doctor, plus
                 generic personal-data patterns. Any hit blocks the request (fail closed); the feature falls back
                 to its offline rules.
  S6 RECORD      A ledger entry and an audit event: purpose, destination, fields, how many identifiers were
                 masked, payload size and SHA-256. Never the content itself.
  S7 RESTORE     Placeholders in the answer are swapped back to real values on our server, only for the
                 doctor's own screen.

Voice is biometric (a voice identifies a person), so raw audio may only go to a SELF-HOSTED speech server.
"""
import asyncio
import hashlib
import json
import re
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, Iterable, List, Optional, Sequence

from app.config import settings
from app.services.deidentify import BROAD_PLACES, PATTERNS, Deidentifier, _name_variants

STANDARD = "SETU-Shield v1"
SELF_HOSTED, THIRD_PARTY = "self_hosted", "third_party"

STEPS = [
    {"id": "S1", "name": "Minimise", "detail": "Only the fields this feature needs leave the server."},
    {"id": "S2", "name": "Mask", "detail": "Names, phone, Aadhaar, ABHA, e-mail, record IDs, places and dates become placeholders."},
    {"id": "S3", "name": "Generalise", "detail": "Exact age becomes an age band; nothing that narrows down a person."},
    {"id": "S4", "name": "Unlink", "detail": "No patient, doctor or consultation IDs. Requests come from the hospital server, not from people."},
    {"id": "S5", "name": "Verify", "detail": "The final payload is scanned for every known identifier. Any hit blocks the request."},
    {"id": "S6", "name": "Record", "detail": "Logged without content: purpose, destination, fields, size and fingerprint."},
    {"id": "S7", "name": "Restore", "detail": "Real names are put back only on the doctor's screen, inside our server."},
]

# What each feature may send (after generalisation).
PURPOSES: Dict[str, Dict[str, Any]] = {
    "notepad_autocomplete": {"label": "Notepad autocomplete", "fields": ("note", "conversation", "age_band", "sex", "section")},
    "live_suggestions": {"label": "Live assistant", "fields": ("transcript", "note", "allergies")},
    "minutes_check": {"label": "Call minutes check", "fields": ("transcript", "note", "found")},
    "patient_summary": {"label": "Patient summary", "fields": ("facts", "language")},
    "speech_to_text": {"label": "Speech to text", "fields": ("audio",)},
    "consult_agent": {"label": "CHIBI agent (batch)", "fields": ("memory", "transcript", "note")},
    "consult_summary": {"label": "CHIBI consultation summary", "fields": ("memory", "facts", "note")},
}
# Fields that are clinical wording and stay as they are once masked (no free identifiers expected).
_PLAIN_FIELDS = {"age_band", "sex", "section", "language"}

# Our own record IDs ("usr_ramesh_gowda", "enc_9481", "apt_demo_031") and NMC registration numbers.
INTERNAL_ID = re.compile(r"\b(?:usr|pat|enc|apt|sess|call|sum|task|ct|demo_pat|prac|doc|asha)_[A-Za-z0-9_]+\b"
                         r"|\bNMC-[A-Z0-9-]+\b", re.I)


class OutboundBlocked(Exception):
    """The verify step found personal data in a payload; it was not sent."""

    def __init__(self, kinds: Sequence[str]):
        super().__init__("Blocked by " + STANDARD + ": " + ", ".join(kinds))
        self.kinds = list(kinds)


def destination(kind: str) -> str:
    """Trust level of where a kind of request goes ('text' = language model, 'speech' = speech-to-text)."""
    if kind == "speech":
        return THIRD_PARTY if settings.AI_SPEECH_DESTINATION == THIRD_PARTY else SELF_HOSTED
    from app.services.ai_client import ai
    return ai.destination()


def age_band(age: Any) -> Optional[str]:
    try:
        a = int(float(age))
    except (TypeError, ValueError):
        return None
    if a < 1:
        return "infant"
    if a < 13:
        return "child"
    if a < 18:
        return "teenager"
    if a >= 80:
        return "80+"
    return f"{a // 10 * 10}s"


# Ages written in free text: "54M", "54 y/M", "54 yrs F", "54-year-old", "aged 54", "age: 54".
_AGE_TEXT = [
    re.compile(r"(?<![-–\d])\b(\d{1,3})(\s?(?:y|yr|yrs|years?)?\s?/?\s?)([MF])\b"),
    re.compile(r"(?<![-–\d])\b(\d{1,3})([\s-]*(?:years?|yrs?)[\s-]*old)\b", re.I),
    re.compile(r"\b((?:aged|age)\s*[:\-]?\s*)(\d{1,3})\b()", re.I),
]


def generalise_ages(text: str) -> str:
    """S3 in free text: an exact age becomes its band ("54M" -> "50s M")."""
    def band(n: str) -> str:
        return age_band(n) if int(n) <= 120 else n
    text = _AGE_TEXT[0].sub(lambda m: f"{band(m.group(1))} {m.group(3)}" if int(m.group(1)) <= 120 else m.group(0), text)
    text = _AGE_TEXT[1].sub(lambda m: f"{band(m.group(1))}" if int(m.group(1)) <= 120 else m.group(0), text)
    return _AGE_TEXT[2].sub(lambda m: f"{m.group(1)}{band(m.group(2))}", text)


def _edits(a: str, b: str, limit: int) -> int:
    """Edit distance with swaps (optimal string alignment), stopping early past `limit`."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev2, prev = None, list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
            if prev2 is not None and i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                cur[j] = min(cur[j], prev2[j - 2] + 1)
        if min(cur) > limit:
            return limit + 1
        prev2, prev = prev, cur
    return prev[-1]


COMMON_WORD_FREQ = 20000      # words used this often in English are never treated as a misspelt name


def _ordinary_word(word: str) -> bool:
    try:
        from app.services.intellisense_engine import _english_freq, _medically_known
        lower = word.lower()
        return _medically_known(lower) or (_english_freq(lower) or 0) >= COMMON_WORD_FREQ
    except Exception:
        return False


def _sex(value: Any) -> Optional[str]:
    v = str(value or "").strip().lower()
    return {"m": "male", "male": "male", "f": "female", "female": "female"}.get(v, "other" if v else None)


# --------------------------------------------------------------------------------------------- the ledger (S6)
LEDGER: Deque[Dict[str, Any]] = deque(maxlen=300)   # server memory only; no content
_audited: set = set()                                # (encounter, purpose) pairs already in the audit trail


def _fingerprint(payload: Any) -> str:
    raw = payload if isinstance(payload, (bytes, bytearray)) else json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()


async def _audit(action: str, encounter_id: str, purpose: str, outcome: str) -> None:
    from app.database import AsyncSessionLocal
    from app.models.models import AuditEvent
    try:
        async with AsyncSessionLocal() as db:
            db.add(AuditEvent(actor_id="system:ai-gateway", action=action, resource_id=encounter_id, outcome=outcome,
                              purpose=f"{STANDARD} · {PURPOSES.get(purpose, {}).get('label', purpose)}"))
            await db.commit()
    except Exception:  # the audit must never break a consultation
        pass


def _audit_soon(action: str, encounter_id: str, purpose: str, outcome: str) -> None:
    try:
        asyncio.get_running_loop().create_task(_audit(action, encounter_id, purpose, outcome))
    except RuntimeError:
        pass


def ledger_for(encounter_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    rows = [r for r in LEDGER if not encounter_id or r["encounter_id"] == encounter_id]
    return [{k: v for k, v in r.items() if k != "encounter_id"} for r in rows[-limit:]][::-1]


# --------------------------------------------------------------------------------------------- the shield
@dataclass
class Shield:
    """Everything we know that could identify the people in one consultation. Lives in server memory only."""
    encounter_id: str
    deid: Deidentifier
    identifiers: List[str] = field(default_factory=list)   # exact values: record IDs, ABHA, phone, registration no.
    names: List[str] = field(default_factory=list)          # people and places (all name variants are checked)

    def __post_init__(self) -> None:
        self._exact: List[tuple] = []
        for value in {i.strip() for i in self.identifiers if i and len(i.strip()) >= 4}:
            self._exact.append((re.compile(re.escape(value), re.I), "record identifier"))
            digits = re.sub(r"\D", "", value)
            if len(digits) >= 8 and digits != value:
                # The same number however it is spaced ("98450 12345", "9845012345", "+91-98450-12345").
                for d in {digits, digits[-10:]}:
                    self._exact.append((re.compile(r"[\s\-.()+]*".join(d)), "phone or ID number"))
        self._names: List[tuple] = []
        # Latin name parts for near-miss spellings ("Goda" for "Gowda", "Ramsh" for "Ramesh").
        self._fuzzy: List[str] = []
        for src in self.names:
            for variant in _name_variants(src):
                if len(variant) < 3 or variant.lower().strip(" ,") in BROAD_PLACES:
                    continue
                if re.search(r"[ऀ-෿]", variant):
                    self._names.append((re.compile(re.escape(variant)), "name or place"))
                else:
                    self._names.append((re.compile(rf"(?<![\w]){re.escape(variant)}(?![\w])", re.I), "name or place"))
                    if " " not in variant and len(variant) >= 4 and variant.lower() not in self._fuzzy:
                        self._fuzzy.append(variant.lower())

    def near_name(self, word: str) -> bool:
        """A misspelling of a known name: same first letter, 1 edit (2 for long names), not an ordinary word."""
        w = word.lower()
        if len(w) < 4:
            return False
        for part in self._fuzzy:
            if part[0] == w[0] and part != w and _edits(w, part, 2 if len(part) >= 8 else 1) <= (2 if len(part) >= 8 else 1):
                return not _ordinary_word(word)
        return False

    def _mask_near_names(self, text: str) -> str:
        if not self._fuzzy:
            return text
        return re.sub(r"(?<![\w\[])[A-Za-z]{4,}(?![\w\]])",
                      lambda m: self.deid._placeholder("PERSON", m.group(0)) if self.near_name(m.group(0)) else m.group(0), text)

    # ---- S2 mask -----------------------------------------------------------------------------------------
    def mask(self, text: str) -> str:
        if not text:
            return text
        out = text
        for rx, _ in self._exact:
            out = rx.sub(lambda m: self.deid._placeholder("ID", m.group(0)), out)
        out = INTERNAL_ID.sub(lambda m: self.deid._placeholder("ID", m.group(0)), out)
        return generalise_ages(self._mask_near_names(self.deid.redact(out)))

    def _mask_any(self, value: Any) -> Any:
        if isinstance(value, str):
            return self.mask(value)
        if isinstance(value, list):
            return [self._mask_any(v) for v in value]
        if isinstance(value, dict):
            return {k: self._mask_any(v) for k, v in value.items()}
        return value

    # ---- S5 verify ---------------------------------------------------------------------------------------
    def scan(self, payload: Any) -> List[str]:
        """Kinds of personal data found in the payload's text (empty = clean)."""
        texts: List[str] = []

        def walk(v: Any) -> None:
            if isinstance(v, str):
                texts.append(v)
            elif isinstance(v, dict):
                for x in v.values():
                    walk(x)
            elif isinstance(v, (list, tuple)):
                for x in v:
                    walk(x)
        walk(payload)
        found: List[str] = []
        for text in texts:
            for rx, kind in self._exact + self._names:
                if rx.search(text) and kind not in found:
                    found.append(kind)
            if "misspelt name" not in found and any(self.near_name(w) for w in re.findall(r"(?<![\w\[])[A-Za-z]{4,}(?![\w\]])", text)):
                found.append("misspelt name")
            if INTERNAL_ID.search(text) and "record identifier" not in found:
                found.append("record identifier")
            for label, rx in PATTERNS:
                kind = {"PHONE": "phone or ID number", "ID": "phone or ID number", "ABHA": "ABHA", "EMAIL": "e-mail",
                        "PIN": "PIN code", "DATE": "full date"}[label]
                if rx.search(text) and kind not in found:
                    found.append(kind)
        return found

    # ---- S1 + S2 + S3 --------------------------------------------------------------------------------------
    def prepare(self, purpose: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        rules = PURPOSES[purpose]
        given = dict(fields)
        if "age" in given:                                     # S3 generalise
            given["age_band"] = age_band(given.pop("age"))
        if "sex" in given:
            given["sex"] = _sex(given["sex"])
        allowed = rules["fields"]
        kept = {k: v for k, v in given.items() if k in allowed and v not in (None, "")}   # S1 minimise
        return {k: (v if k in _PLAIN_FIELDS else self._mask_any(v)) for k, v in kept.items()}   # S2 mask

    # ---- S4 + S5 + S6 --------------------------------------------------------------------------------------
    def release(self, purpose: str, payload: Any, kind: str = "text", engine: str = "") -> str:
        """Check the exact payload about to be sent and record it. Raises OutboundBlocked on any leak."""
        dest = destination(kind)
        request_id = uuid.uuid4().hex[:12]               # random per request: nothing links two requests to a person
        entry = {
            "at": time.time(), "request_id": request_id, "purpose": purpose, "label": PURPOSES[purpose]["label"],
            "destination": "not sent (offline demo)" if engine == "demo" else dest, "encounter_id": self.encounter_id,
            "fields": list(PURPOSES[purpose]["fields"]), "masked": self.deid.summary(),
            "bytes": len(payload) if isinstance(payload, (bytes, bytearray)) else len(json.dumps(payload, ensure_ascii=False)),
            "sha256": _fingerprint(payload)[:16], "standard": STANDARD,
        }
        if kind == "speech":
            leaks = ["voice to a third party"] if dest == THIRD_PARTY else []
        else:
            leaks = self.scan(payload)
        if leaks:
            entry.update(outcome="blocked", leaks=leaks)
            LEDGER.append(entry)
            _audit_soon("AI_OUTBOUND_BLOCKED", self.encounter_id, purpose, "DENIED")
            raise OutboundBlocked(leaks)
        entry.update(outcome="sent", leaks=[])
        LEDGER.append(entry)
        if (self.encounter_id, purpose) not in _audited:
            _audited.add((self.encounter_id, purpose))
            _audit_soon("AI_DATA_SHARED_DEIDENTIFIED", self.encounter_id, purpose, "SUCCESS")
        return request_id

    # ---- S7 restore --------------------------------------------------------------------------------------
    def restore(self, text: Optional[str]) -> Optional[str]:
        return self.deid.restore(text) if text else text

    def restore_masked(self, text: Optional[str]) -> Optional[str]:
        return self.deid.restore(text, mask_patient=True) if text else text


def shield_for_session(session: Any, extra_identifiers: Iterable[str] = ()) -> Shield:
    """The shield of a live call: shares the call's de-identifier, so placeholders stay the same everywhere."""
    sh = getattr(session, "shield", None)
    if sh is None:
        names = [p for src in session.deid.sources for p in re.split(r"\s*,\s*", src or "") if p]
        sh = Shield(session.encounter_id, session.deid, [session.encounter_id, *extra_identifiers], names)
        session.shield = sh
    return sh


async def shield_for_encounter(db: Any, enc: Any) -> Shield:
    """Everything we hold that identifies this consultation's patient and doctor."""
    from app.models.models import PatientProfile, Practitioner, User
    patient = await db.get(PatientProfile, enc.patient_id)
    doctor = await db.get(Practitioner, enc.practitioner_id) if enc.practitioner_id else None
    user = await db.get(User, enc.patient_id)
    demo = (patient.demographics_json or {}) if patient else {}
    places = [demo.get("district") or ""]
    identifiers = [enc.encounter_id, enc.patient_id, enc.practitioner_id or "",
                   getattr(patient, "abha_address", "") or "", demo.get("phone_masked") or "",
                   getattr(user, "phone_number", "") or "", getattr(user, "login_identifier", "") or "",
                   getattr(doctor, "registration_number", "") or ""]
    names = [n for n in [getattr(patient, "full_name", ""), getattr(doctor, "display_name", "")] if n]
    deid = Deidentifier([patient.full_name] if patient else [], [doctor.display_name] if doctor else [], places)
    return Shield(enc.encounter_id, deid, identifiers, names + [p for p in places if p])
