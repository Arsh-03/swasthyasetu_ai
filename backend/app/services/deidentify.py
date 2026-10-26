"""
Removes personal identifiers from consultation transcripts before any AI model sees them.

Every name, phone number, ID, address and date is replaced with a placeholder such as [PATIENT],
[DOCTOR], [PERSON_1], [PHONE_1]. The mapping back to the real values stays in server memory for the
call only, so the doctor's own screen can show real names while the model only ever sees placeholders.

What it catches:
  - The patient's and doctor's names (all parts, in Latin and Indic scripts) from their records
  - Other names after titles or relations ("Dr. Rao", "Shri Kumar", "my wife Sunita")
  - Phone numbers (Indian mobile, with or without +91), Aadhaar-style 12-digit numbers,
    ABHA numbers and ABHA addresses, e-mail addresses, PIN codes after "pin"
  - The patient's town/district from their record, and full calendar dates (e.g. date of birth)

What it deliberately keeps: symptoms, durations ("3 days"), doses, vitals and other clinical content.
Rule-based by design (no model needed); a small risk remains for unusual names said without a title.
"""
import re
from typing import Dict, Iterable, List, Optional, Sequence

# Letters of Indic scripts (Devanagari ... Malayalam) count as "word" characters for name boundaries.
_W = r"\wऀ-෿"
TITLES = r"(?:Dr|Doctor|Mr|Mrs|Ms|Miss|Shri|Sri|Smt|Kumari|Kum|Mister|Madam|Sir)"
RELATIONS = r"(?:wife|husband|son|daughter|brother|sister|mother|father|uncle|aunt|friend|neighbou?r)"
_INDIC = re.compile(r"[ऀ-෿]")
BROAD_PLACES = {"india", "karnataka", "kerala", "tamil nadu", "maharashtra", "andhra pradesh", "telangana",
                "ಕರ್ನಾಟಕ", "ಭಾರತ", "भारत", "कर्नाटक"}
_NON_NAME_PARTS = {"dr", "doctor", "mbbs", "md", "ms", "dnb", "mrcp", "frcs", "phd", "shri", "smt", "sri", "mr", "mrs"}

PATTERNS = [
    ("ABHA", re.compile(r"\b\d{2}-\d{4}-\d{4}-\d{4}\b")),                                    # ABHA number
    ("ABHA", re.compile(r"\b[\w.]+@(?:abdm|sbx|ndhm)\b", re.I)),                               # ABHA address
    ("EMAIL", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")),
    ("ID", re.compile(r"(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}(?!\d)")),                              # Aadhaar-style
    ("PHONE", re.compile(r"(?<!\d)(?:\+?91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)")),               # Indian mobile
    ("PIN", re.compile(r"\b(?:pin(?:\s*code)?|pincode)\s*[:\-]?\s*\d{6}\b", re.I)),
    ("DATE", re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b")),
    ("DATE", re.compile(r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b", re.I)),
    # Any other long number, however speech-to-text formats it ("984-501-2345", "98450 12345", "(984) 501 2345").
    # 8+ digits never occur in clinical values (BP 120/80, doses, SpO2), so this only catches phones and IDs.
    ("PHONE", re.compile(r"(?<![\w/.])\+?\(?\d(?:[ \-.()]{0,2}\d){7,14}(?![\w/])")),
    # Numbers read out digit by digit: "nine eight four five zero one two three four five".
    ("PHONE", re.compile(r"\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)[\s,\-]+){6,}"
                         r"(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b", re.I)),
]


def _name_variants(full_name: str) -> List[str]:
    """'Ramesh Gowda (ರಮೇಶ್ ಗೌಡ)' -> ['Ramesh Gowda', 'ರಮೇಶ್ ಗೌಡ', 'Ramesh', 'Gowda', 'ರಮೇಶ್', 'ಗೌಡ']"""
    if not full_name:
        return []
    names = [full_name]
    names += re.findall(r"\(([^)]+)\)", full_name)
    base = re.sub(r"\([^)]*\)", " ", full_name)
    names.append(base)
    parts: List[str] = []
    for n in names:
        words = [w.strip(".,") for w in re.split(r"\s+", n.strip())]
        words = [w for w in words if w and w.lower().strip(".") not in _NON_NAME_PARTS]
        if len(words) > 1:
            parts.append(" ".join(words))
        parts += [w for w in words if len(w) >= 3]
    seen, out = set(), []
    for p in sorted(parts, key=len, reverse=True):     # longest first so full names win over parts
        if p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    return out


class Deidentifier:
    def __init__(self, patient_names: Sequence[str] = (), doctor_names: Sequence[str] = (),
                 places: Sequence[str] = (), other_people: Sequence[str] = ()):
        self._known: List[tuple] = []          # (regex, placeholder)
        for label, sources in (("PATIENT", patient_names), ("DOCTOR", doctor_names), ("PERSON", other_people)):
            for src in sources:
                for variant in _name_variants(src):
                    self._add_known(variant, label)
        for place in places:
            # "Hassan, Karnataka (ಹಾಸನ, ಕರ್ನಾಟಕ)" -> Hassan, ಹಾಸನ (states are too broad to identify anyone)
            for part in re.split(r"\s*[,()]\s*", place or ""):
                part = part.strip()
                if len(part) >= 3 and part.lower() not in BROAD_PLACES:
                    self._add_known(part, "PLACE")
        self.mapping: Dict[str, str] = {}      # placeholder -> original, kept in memory for this call only
        self._counters: Dict[str, int] = {}

    def _add_known(self, text: str, label: str) -> None:
        if _INDIC.search(text):
            # Indic languages attach endings to names (ಹಾಸನದಿಂದ = "from Hassan"): match the stem.
            rx = re.compile(rf"(?<![{_W}]){re.escape(text)}")
        else:
            rx = re.compile(rf"(?<![{_W}]){re.escape(text)}(?![{_W}])", re.I)
        self._known.append((rx, label))

    def _placeholder(self, label: str, original: str) -> str:
        for ph, orig in self.mapping.items():                  # same value -> same placeholder
            if orig.lower() == original.lower() and ph.startswith(f"[{label}"):
                return ph
        if label in ("PATIENT", "DOCTOR"):
            ph = f"[{label}]"
        else:
            self._counters[label] = self._counters.get(label, 0) + 1
            ph = f"[{label}_{self._counters[label]}]"
        self.mapping.setdefault(ph, original)
        return ph

    def redact(self, text: str) -> str:
        if not text:
            return text
        out = text
        for label, rx in PATTERNS:                                # numbers and IDs first
            out = rx.sub(lambda m: self._placeholder(label, m.group(0)), out)
        for rx, label in self._known:                             # known people and places
            out = rx.sub(lambda m: self._placeholder(label, m.group(0)), out)
        # Names after a title ("Dr. Rao", "Shri Kumar") or a relation ("my wife Sunita").
        out = re.sub(rf"\b({TITLES})\.?\s+([A-Z][a-z]{{2,}}(?:\s+[A-Z][a-z]{{2,}})?)",
                     lambda m: f"{m.group(1)} {self._placeholder('PERSON', m.group(2))}", out)
        out = re.sub(rf"\b((?i:my|his|her|their))\s+((?i:{RELATIONS}))\s+(?:named\s+|called\s+)?([A-Z][a-z]{{2,}})\b",
                     lambda m: f"{m.group(1)} {m.group(2)} {self._placeholder('PERSON', m.group(3))}", out)
        return out

    def restore(self, text: str) -> str:
        """Put the real values back (for the doctor's own screen only)."""
        if not text:
            return text
        for ph in sorted(self.mapping, key=len, reverse=True):
            text = text.replace(ph, self.mapping[ph])
        return text

    def summary(self) -> Dict[str, int]:
        """How many identifiers of each kind were removed (no values), for the UI and audit."""
        counts: Dict[str, int] = {}
        for ph in self.mapping:
            label = ph.strip("[]").split("_")[0]
            counts[label] = counts.get(label, 0) + 1
        return counts


def deidentifier_for(patient_name: Optional[str], doctor_name: Optional[str], places: Iterable[str] = ()) -> Deidentifier:
    return Deidentifier([patient_name] if patient_name else [], [doctor_name] if doctor_name else [], list(places))
