"""
The consultation note format (CareBridge note v1) and its parser.

The doctor writes ONE note during the consultation, under fixed headings. When the consultation is finished,
the note is parsed into structured data (complaints, vitals, diagnosis, prescription with dose / frequency /
duration, advice, follow-up), so the visit summary, the patient's medicine list and the records screens are
filled from the same note: nothing is typed twice.

Parsing is rule-based on purpose: a prescription is read exactly as written, never guessed by a model.
Older notes (the earlier six-heading template) are parsed too.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

FORMAT_VERSION = "carebridge-note-v1"

# key -> (heading shown in the note, IntelliSense section it belongs to)
SECTIONS: List[Tuple[str, str, str]] = [
    ("complaints", "Chief Complaints", "complaints"),
    ("history", "History", "history"),
    ("allergies", "Allergies", "history"),
    ("medications", "Current Medications", "history"),
    ("vitals", "Vitals", "exam"),
    ("exam", "Examination", "exam"),
    ("diagnosis", "Diagnosis", "assessment"),
    ("investigations", "Investigations", "labs"),
    ("rx", "Rx", "plan"),
    ("advice", "Advice", "plan"),
    ("follow_up", "Follow-up", "plan"),
]
HEADING = {k: h for k, h, _ in SECTIONS}
NOTE_SECTION = {k: s for k, _, s in SECTIONS}

TEMPLATE = "".join(f"{h}:\n\n" for _, h, _ in SECTIONS).rstrip("\n") + "\n"

# Heading text (case-insensitive, up to the colon) -> key. Includes the older template's headings.
_HEADING_ALIASES: List[Tuple[str, str]] = [
    (r"chief complaints?|c/c|presenting complaints?|complaints?|hpi|history of present illness", "complaints"),
    (r"allerg(?:y|ies)|drug allerg(?:y|ies)", "allergies"),
    (r"current (?:medications?|meds)|medication history|drug history|regular medications?", "medications"),
    (r"past (?:medical )?history|pmh|medical history|history|family history|social history", "history"),
    (r"vitals?", "vitals"),
    (r"vitals? (?:&|and) examination", "exam"),
    (r"examination|o/e|on examination|findings|clinical findings", "exam"),
    (r"diagnosis|assessment|impression|provisional diagnosis|differentials?", "diagnosis"),
    (r"investigations?|labs?|tests?|orders?", "investigations"),
    (r"rx|prescription|medications?|plan\s*/\s*medications?|treatment", "rx"),
    (r"advice|instructions|plan", "advice"),
    (r"follow[- ]?up|review|next visit", "follow_up"),
]
_HEADING_RE = re.compile(r"^\s*([A-Za-z][A-Za-z /&-]{0,40}?)\s*:\s*(.*)$")


def _heading_key(label: str) -> Optional[str]:
    label = label.strip().lower()
    for pattern, key in _HEADING_ALIASES:
        if re.fullmatch(pattern, label):
            return key
    return None


def split_sections(note: str) -> Dict[str, List[str]]:
    """{key: [lines]} by heading. Text before any heading counts as complaints."""
    out: Dict[str, List[str]] = {k: [] for k, _, _ in SECTIONS}
    current = "complaints"
    for raw in (note or "").splitlines():
        m = _HEADING_RE.match(raw)
        key = _heading_key(m.group(1)) if m else None
        if key:
            current = key
            rest = m.group(2).strip()
            if rest:
                out[current].append(rest)
            continue
        line = raw.strip().lstrip("-•*").strip()
        if line:
            out[current].append(line)
    return out


# --------------------------------------------------------------------------------------------- prescriptions
FORMS = r"tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?|susp(?:ension)?|inj(?:ection)?|drops?|oint(?:ment)?|cream|gel|inh(?:aler)?|sachet|neb(?:ulisation)?|spray"
_FORM_RE = re.compile(rf"^\s*(?:\d+[.)]\s*)?({FORMS})\.?\s+", re.I)
_STRENGTH_RE = re.compile(r"\b(\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|ml|iu|units?|%)(?:\s?/\s?\d+(?:\.\d+)?\s?(?:ml|mg|g))?)\b", re.I)
FREQUENCIES = [
    (r"\b(?:od|once (?:a|per) day|once daily|daily|qd|1-0-0|0-0-1|0-1-0)\b", "Once a day", 1),
    (r"\b(?:bd|bid|twice (?:a|per) day|twice daily|1-0-1|1-1-0|0-1-1)\b", "Twice a day", 2),
    (r"\b(?:tds|tid|thrice (?:a|per) day|three times (?:a|per) day|1-1-1)\b", "Three times a day", 3),
    (r"\b(?:qid|qds|four times (?:a|per) day|1-1-1-1)\b", "Four times a day", 4),
    (r"\b(?:hs|at bedtime|at night|bedtime)\b", "At bedtime", 1),
    (r"\b(?:sos|prn|as needed|when needed|if needed|if required)\b", "Only when needed", 0),
    (r"\bstat\b", "Once, immediately", 1),
    (r"\b(?:weekly|once a week)\b", "Once a week", 0),
]
_DURATION_RE = re.compile(r"(?:x|for|×)\s*(\d+)\s*(day|days|d|week|weeks|wk|wks|w|month|months|mo)\b", re.I)
_TIMING = [
    (r"\b(?:after food|after meals?|pc|a/f)\b", "after food"),
    (r"\b(?:before food|before meals?|ac|b/f|empty stomach)\b", "before food"),
    (r"\b(?:with food|with meals?)\b", "with food"),
]
_ROUTE = [(r"\b(?:iv)\b", "IV"), (r"\b(?:im)\b", "IM"), (r"\b(?:sc|subcut)\b", "SC"), (r"\b(?:po|oral(?:ly)?)\b", "oral"),
          (r"\b(?:topical|apply|local application)\b", "topical"), (r"\b(?:inhal(?:e|ed|ation))\b", "inhaled")]


def parse_medication(line: str) -> Optional[Dict[str, Any]]:
    """'Tab Paracetamol 650 mg TDS x 5 days after food' -> structured, or None if it isn't a medicine line."""
    text = line.strip().rstrip(".")
    if len(text) < 3 or re.match(r"^(?:no|nil|none)\b", text, re.I):
        return None
    form = None
    m = _FORM_RE.match(text)
    if m:
        form = m.group(1).lower().rstrip("s").rstrip(".")
        form = {"tablet": "tab", "capsule": "cap", "syrup": "syr", "syp": "syr", "injection": "inj"}.get(form, form)
        text_rest = text[m.end():]
    else:
        text_rest = re.sub(r"^\s*\d+[.)]\s*", "", text)
    strength = _STRENGTH_RE.search(text_rest)
    name_part = text_rest[: strength.start()] if strength else re.split(
        r"\b(?:od|bd|bid|tds|tid|qid|hs|sos|prn|stat|once|twice|thrice|x|for|after|before|with|\d)\b", text_rest, 1, flags=re.I)[0]
    name = re.sub(r"\s+", " ", name_part).strip(" -,:")
    if not name or not re.search(r"[A-Za-z]{3,}", name):
        return None
    lower = text.lower()
    freq, per_day = None, None
    for rx, label, n in FREQUENCIES:
        if re.search(rx, lower):
            freq, per_day = label, n
            break
    dur = _DURATION_RE.search(text)
    duration, days = None, None
    if dur:
        n, unit = int(dur.group(1)), dur.group(2).lower()
        mult = 7 if unit.startswith("w") else 30 if unit.startswith("mo") or unit == "month" or unit == "months" else 1
        days = n * mult
        word = "week" if unit.startswith("w") else "month" if unit.startswith("mo") else "day"
        duration = f"{n} {word}{'s' if n != 1 else ''}"
    timing = next((label for rx, label in _TIMING if re.search(rx, lower)), None)
    route = next((label for rx, label in _ROUTE if re.search(rx, lower)), None)
    # A medicine line needs a form, a strength or a frequency: otherwise it's free advice.
    if not (form or strength or freq):
        return None
    return {"name": name, "form": form, "strength": strength.group(1).replace(" ", "") if strength else None,
            "frequency": freq, "times_per_day": per_day, "duration": duration, "days": days, "timing": timing,
            "route": route, "text": line.strip()}


# --------------------------------------------------------------------------------------------- vitals
_VITALS = [
    ("bp", r"\b(?:bp|blood pressure)\s*[:\-]?\s*(\d{2,3})\s*/\s*(\d{2,3})", "mmHg"),
    ("pulse", r"\b(?:pulse|pr|hr|heart rate)\s*[:\-]?\s*(\d{2,3})", "bpm"),
    ("temperature", r"\b(?:temp(?:erature)?|t)\s*[:\-]?\s*(\d{2,3}(?:\.\d)?)\s*°?\s*([fc])?", ""),
    ("spo2", r"\b(?:spo2|sp02|o2 sat(?:uration)?|saturation)\s*[:\-]?\s*(\d{2,3})\s*%?", "%"),
    ("resp_rate", r"\b(?:rr|resp(?:iratory)? rate)\s*[:\-]?\s*(\d{1,2})", "/min"),
    ("weight", r"\b(?:wt|weight)\s*[:\-]?\s*(\d{1,3}(?:\.\d)?)\s*kg", "kg"),
    ("sugar", r"\b(?:rbs|fbs|ppbs|grbs|blood sugar|sugar)\s*[:\-]?\s*(\d{2,3})", "mg/dL"),
]


def parse_vitals(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for key, rx, unit in _VITALS:
        m = re.search(rx, text, re.I)
        if not m:
            continue
        if key == "bp":
            out[key] = {"value": f"{m.group(1)}/{m.group(2)}", "unit": unit}
        elif key == "temperature":
            v = float(m.group(1))
            u = (m.group(2) or ("F" if v > 50 else "C")).upper()
            out[key] = {"value": m.group(1), "unit": f"°{u}"}
        else:
            out[key] = {"value": m.group(1), "unit": unit}
    return out


_FOLLOW_RE = re.compile(r"(?:after|in)\s*(\d+)\s*(day|days|week|weeks|month|months)", re.I)


def parse_note(note: str) -> Dict[str, Any]:
    """The whole note as structured data (what the visit summary and the patient's app show)."""
    sec = split_sections(note)
    rx: List[Dict[str, Any]] = []
    rx_free: List[str] = []
    for line in sec["rx"]:
        med = parse_medication(line)
        (rx.append(med) if med else rx_free.append(line))
    current_meds = [parse_medication(l) or {"name": l, "text": l} for l in sec["medications"]]
    vitals = parse_vitals(" ; ".join(sec["vitals"] + sec["exam"]))
    follow = " ".join(sec["follow_up"])
    fm = _FOLLOW_RE.search(follow)
    return {
        "format": FORMAT_VERSION,
        "complaints": sec["complaints"],
        "history": sec["history"],
        "allergies": [a for a in sec["allergies"] if not re.match(r"^(?:nil|none|nkda|no known)", a, re.I)],
        "no_known_allergies": any(re.match(r"^(?:nil|none|nkda|no known)", a, re.I) for a in sec["allergies"]),
        "current_medications": current_meds,
        "vitals": vitals,
        "examination": sec["exam"] + [v for v in sec["vitals"] if not parse_vitals(v)],
        "diagnosis": sec["diagnosis"],
        "investigations": sec["investigations"],
        "prescription": rx,
        "advice": sec["advice"] + rx_free,
        "follow_up": {"text": follow or None,
                      "in_days": (int(fm.group(1)) * (7 if fm.group(2).startswith("week") else 30 if fm.group(2).startswith("month") else 1)) if fm else None},
    }


def section_for(key: str) -> str:
    """IntelliSense section for a structured key (unknown keys go to history)."""
    return NOTE_SECTION.get(key, "history")


# --------------------------------------------------------------------------------------------- from the note to the chart
SCHEDULES = {
    "Once a day": {"morning": True, "afternoon": False, "night": False},
    "Twice a day": {"morning": True, "afternoon": False, "night": True},
    "Three times a day": {"morning": True, "afternoon": True, "night": True},
    "Four times a day": {"morning": True, "afternoon": True, "night": True},
    "At bedtime": {"morning": False, "afternoon": False, "night": True},
}
FORM_NAMES = {"tab": "Tablet", "cap": "Capsule", "syr": "Syrup", "inj": "Injection", "drop": "Drops", "oint": "Ointment",
              "cream": "Cream", "gel": "Gel", "inh": "Inhaler", "sachet": "Sachet", "spray": "Spray"}


def chart_prescription(med: Dict[str, Any], doctor_name: str, when_label: str, purpose: str = "") -> Dict[str, Any]:
    """One parsed Rx line as a chart prescription (the patient app builds the daily medicine plan from these)."""
    import uuid
    freq = med.get("frequency") or "As prescribed"
    return {
        "id": f"rx_{uuid.uuid4().hex[:8]}",
        "name": med["name"],
        "dosage": " ".join(x for x in [FORM_NAMES.get(med.get("form") or "", ""), med.get("strength") or ""] if x),
        "route": {"IV": "IV", "IM": "IM", "SC": "SC", "topical": "Topical", "inhaled": "Inhaled"}.get(med.get("route") or "", "Oral"),
        "frequency": freq,
        "timing": (med.get("timing") or "As advised").capitalize(),
        "duration": med.get("duration") or "As advised",
        "purpose": purpose or "Prescribed during tele-consultation",
        "schedule": SCHEDULES.get(freq, {"morning": False, "afternoon": False, "night": False}),
        "refillsRemaining": 0,
        "prescribedBy": doctor_name,
        "prescribedDate": when_label,
        "status": "Active",
        "source_line": med.get("text"),
    }


def soap_from_structured(st: Dict[str, Any]) -> Dict[str, Any]:
    """Pre-fill for the sign-off form, so the doctor reviews instead of retyping."""
    vitals = " · ".join(f"{k.upper()} {v['value']} {v['unit']}".strip() for k, v in st.get("vitals", {}).items())
    return {
        "subjective": "; ".join(st.get("complaints", []) + st.get("history", [])),
        "objective": " · ".join(x for x in [vitals, "; ".join(st.get("examination", []))] if x),
        "assessment": "; ".join(st.get("diagnosis", [])),
        "plan": {
            "medicine": "; ".join(m.get("text", m["name"]) for m in st.get("prescription", [])),
            "advice": "; ".join(st.get("advice", [])),
            "investigations": "; ".join(st.get("investigations", [])),
            "follow_up": (st.get("follow_up") or {}).get("text") or "",
        },
    }
