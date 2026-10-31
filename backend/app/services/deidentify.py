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
        self.patient_names: List[str] = list(patient_names)
        self.doctor_names: List[str] = list(doctor_names)
        # The people and places this call knows about (for the privacy gateway's final check).
        self.sources: List[str] = [*patient_names, *doctor_names, *other_people, *places]
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

    def mask_patient_details(self, text: str) -> str:
        """Mask patient personal details for display/memory: replaces name with Patient 1, exact age with range, and phones with [Phone masked]."""
        if not text:
            return text
        out = text
        # 0. Learn patient names from introductions or clinical summary patterns like '[Name] is 21 years old'
        m_intro = re.search(r"(?i)\b(?:my\s+name\s+is|name\s+is)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b", out)
        if m_intro:
            n = m_intro.group(1).strip()
            if n.split()[0].lower() not in _NON_NAME_WORDS and n not in self.patient_names:
                self.patient_names.append(n)
                for v in _name_variants(n):
                    self._add_known(v, "PATIENT")

        m_age_name = re.search(r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+(?:is\s+(?:a\s+)?(?:an\s+)?)(\d{1,3})\s*[- ]*(?:years?|yrs?|yr)?\s*[- ]*old\b", out)
        if m_age_name:
            n = m_age_name.group(1).strip()
            if n.split()[0].lower() not in _NON_NAME_WORDS and n not in self.patient_names:
                self.patient_names.append(n)
                for v in _name_variants(n):
                    self._add_known(v, "PATIENT")

        m_pat = re.search(r"\bPatient\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b", out)
        if m_pat:
            n = m_pat.group(1).strip()
            if n != "1" and n.split()[0].lower() not in _NON_NAME_WORDS and n not in self.patient_names:
                self.patient_names.append(n)
                for v in _name_variants(n):
                    self._add_known(v, "PATIENT")

        # 1. Mask exact age to range
        out = mask_age_to_range(out)
        # 2. Mask phone numbers
        out = re.sub(r"(?<!\d)(?:\+?91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)", "[Phone masked]", out)
        out = re.sub(r"\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|double|triple)[\s,\-]+){6,}(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b", "[Phone masked]", out, flags=re.I)
        out = re.sub(r"\[PHONE(?:_\d+)?\]", "[Phone masked]", out, flags=re.I)
        # 3. Mask Aadhaar / 12-digit IDs
        out = re.sub(r"(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}(?!\d)", "[ID masked]", out)
        out = re.sub(r"\[ID(?:_\d+)?\]", "[ID masked]", out, flags=re.I)
        out = re.sub(r"\[ABHA(?:_\d+)?\]", "[ABHA masked]", out, flags=re.I)
        out = re.sub(r"\[EMAIL(?:_\d+)?\]", "[Email masked]", out, flags=re.I)
        out = re.sub(r"\[PIN(?:_\d+)?\]", "[PIN masked]", out, flags=re.I)
        # 4. Spoken introductions ("My name is ...", "I am [Name]")
        out = mask_spoken_names(out)
        # 5. Replace known patient names with Patient 1
        for src in self.patient_names:
            for variant in _name_variants(src):
                if len(variant) >= 3:
                    out = re.sub(rf"(?<![\wऀ-෿]){re.escape(variant)}(?![\wऀ-෿])", "Patient 1", out, flags=re.I)
        # 6. Replace [PATIENT] and 'the patient' with Patient 1
        out = re.sub(r"\[PATIENT\]('s)?", lambda m: "Patient 1" + (m.group(1) or ""), out)
        out = re.sub(r"\bthe patient('s)?\b", lambda m: "Patient 1" + (m.group(1) or ""), out, flags=re.I)
        return out

    def redact(self, text: str) -> str:
        if not text:
            return text
        out = text
        # 1. Mask exact age to range first so model only ever sees range
        out = mask_age_to_range(out)
        # 2. Numbers and IDs
        for label, rx in PATTERNS:
            out = rx.sub(lambda m: self._placeholder(label, m.group(0)), out)
        # 3. Spoken introductions to catch names spoken during call
        def _catch_intro(m: re.Match) -> str:
            name = m.group(2).strip()
            first = name.split()[0].lower()
            if first in _NON_NAME_WORDS:
                return m.group(0)
            if name not in self.patient_names:
                self.patient_names.append(name)
                for v in _name_variants(name):
                    self._add_known(v, "PATIENT")
            ph = self._placeholder("PATIENT", name)
            return f"{m.group(1)} {ph}"

        out = re.sub(r"(?i)\b(my\s+name\s+is|name\s+is|i\s*am|i'm)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b",
                     _catch_intro, out)
        # 4. Known people and places
        for rx, label in self._known:
            out = rx.sub(lambda m: self._placeholder(label, m.group(0)), out)
        # 5. Names after a title ("Dr. Rao", "Shri Kumar") or a relation ("my wife Sunita").
        out = re.sub(rf"\b({TITLES})\.?\s+([A-Z][a-z]{{2,}}(?:\s+[A-Z][a-z]{{2,}})?)",
                     lambda m: f"{m.group(1)} {self._placeholder('PERSON', m.group(2))}", out)
        out = re.sub(rf"\b((?i:my|his|her|their))\s+((?i:{RELATIONS}))\s+(?:named\s+|called\s+)?([A-Z][a-z]{{2,}})\b",
                     lambda m: f"{m.group(1)} {m.group(2)} {self._placeholder('PERSON', m.group(3))}", out)
        return out

    def restore(self, text: str, mask_patient: bool = False) -> str:
        """Put the real values back (or keep patient PII masked as 'Patient 1', age range, etc.)."""
        if not text:
            return text
        for ph in sorted(self.mapping, key=len, reverse=True):
            if mask_patient:
                if ph == "[PATIENT]":
                    text = text.replace(ph, "Patient 1")
                elif ph.startswith("[PHONE"):
                    text = text.replace(ph, "[Phone masked]")
                elif ph.startswith("[ID"):
                    text = text.replace(ph, "[ID masked]")
                elif ph.startswith("[ABHA"):
                    text = text.replace(ph, "[ABHA masked]")
                elif ph.startswith("[EMAIL"):
                    text = text.replace(ph, "[Email masked]")
                elif ph.startswith("[PIN"):
                    text = text.replace(ph, "[PIN masked]")
                else:
                    text = text.replace(ph, self.mapping[ph])
            else:
                text = text.replace(ph, self.mapping[ph])
        if mask_patient:
            text = self.mask_patient_details(text)
        return text

    def restore_masked(self, text: str) -> str:
        """Always restore with patient identifiers masked (Patient 1, range, no phones)."""
        return self.restore(text, mask_patient=True)

    def summary(self) -> Dict[str, int]:
        """How many identifiers of each kind were removed (no values), for the UI and audit."""
        counts: Dict[str, int] = {}
        for ph in self.mapping:
            label = ph.strip("[]").split("_")[0]
            counts[label] = counts.get(label, 0) + 1
        return counts


def age_to_range(age: int) -> str:
    """Standard clinical age range (10-year deciles) for de-identification."""
    if age < 1:
        return "under 1 year"
    elif age < 10:
        return "1-9 years"
    elif age < 18:
        return "10-17 years"
    else:
        dec = (age // 10) * 10
        return f"{dec}-{dec + 9} years"


def mask_age_to_range(text: str) -> str:
    """Replaces exact ages with age ranges (e.g. '21 years old' -> '20-29 years old', 'age 21' -> 'age 20-29 years')."""
    if not text:
        return text

    # 1. "I am 21 years old" / "I'm 21 years old" / "he is 21 yrs old"
    def _rep_i_am_years_old(m: re.Match) -> str:
        try:
            val = int(m.group(2))
            if 0 <= val <= 120:
                return f"{m.group(1)} {age_to_range(val)} old"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(
        r"(?i)(?<![-–\d])\b(i\s*am|i'm|he\s*is|she\s*is|patient\s*is)\s+(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|yr\s*old)\b",
        _rep_i_am_years_old, text
    )

    # 2. "I am 21" / "I'm 21" (without units and not already a range)
    def _rep_i_am_num(m: re.Match) -> str:
        try:
            val = int(m.group(2))
            if 1 <= val <= 110:
                return f"{m.group(1)} {age_to_range(val)} old"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(
        r"(?i)(?<![-–\d])\b(i\s*am|i'm|he\s*is|she\s*is)\s+(\d{1,2})\b(?!\s*[-–])(?!\s*(?:mg|ml|cm|kg|g|bpm|days?|weeks?|months?|hours?|hrs?|minutes?|mins?|times|tablets?|capsules?|pills?|percent|%|st|nd|rd|th|am|pm|\.|\d|years?|yrs?|yr))",
        _rep_i_am_num, text
    )

    # 3. "age 21" / "age is 21" / "aged 21" / "my age is 21"
    def _rep_age_phrase(m: re.Match) -> str:
        try:
            val = int(m.group(2))
            if 0 <= val <= 120:
                return f"{m.group(1)} {age_to_range(val)}"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(
        r"(?i)(?<![-–\d])\b((?:my\s+)?age(?:d)?\s*(?:is|:)?)\s*(\d{1,3})\s*(?:years?\s*(?:old)?)?\b",
        _rep_age_phrase, text
    )

    # 4. "21 years old" / "21-year-old" / "21 yr old" / "21 yrs old"
    def _rep_hyphen_age(m: re.Match) -> str:
        try:
            val = int(m.group(1))
            if 0 <= val <= 120:
                return f"{age_to_range(val)} old"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(
        r"(?i)(?<![-–\d])\b(\d{1,3})\s*[- ]\s*(?:years?|yrs?|yr)\s*[- ]\s*old\b",
        _rep_hyphen_age, text
    )

    # 5. "54M" / "54 y/M" / "54 yrs F"
    def _rep_age_sex(m: re.Match) -> str:
        try:
            val = int(m.group(1))
            if 0 <= val <= 120:
                return f"{age_to_range(val)} {m.group(2).upper()}"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(
        r"(?i)(?<![-–\d])\b(\d{1,3})\s*(?:y|yr|yrs|years?)?\s*(?:/|\s)\s*([MF])\b",
        _rep_age_sex, text
    )

    # 6. Hindi age: "21 साल की उम्र" / "21 साल का" / "21 साल की"
    def _rep_hindi_age(m: re.Match) -> str:
        try:
            val = int(m.group(1))
            if 0 <= val <= 120:
                rng = age_to_range(val).replace(" years", "")
                post = m.group(2) if len(m.groups()) >= 2 else ""
                return f"{rng} साल {post}".strip()
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(r"(?i)(?<![-–\d])\b(\d{1,3})\s*साल\s*(की\s*उम्र|का|की|के)\b", _rep_hindi_age, text)

    def _rep_hindi_prefix(m: re.Match) -> str:
        try:
            val = int(m.group(1))
            if 0 <= val <= 120:
                rng = age_to_range(val).replace(" years", "")
                return f"उम्र {rng} वर्ष"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(r"(?i)(?<![-–\d])\b(?:उम्र|आयु)\s*(?:है\s*|:\s*)?(\d{1,3})\s*(?:साल|वर्ष)?\b", _rep_hindi_prefix, text)

    # 7. Kannada age: "ವಯಸ್ಸು 21" / "21 ವರ್ಷ ವಯಸ್ಸು"
    def _rep_kannada_age(m: re.Match) -> str:
        try:
            val = int(m.group(1))
            if 0 <= val <= 120:
                rng = age_to_range(val).replace(" years", "")
                return f"ವಯಸ್ಸು {rng} ವರ್ಷ"
        except (ValueError, IndexError):
            pass
        return m.group(0)

    text = re.sub(r"(?i)(?<![-–\d])\b(?:ವಯಸ್ಸು)\s*(?:ಆಗಿದೆ\s*|:\s*)?(\d{1,3})\b", _rep_kannada_age, text)
    text = re.sub(r"(?i)(?<![-–\d])\b(\d{1,3})\s*(?:ವರ್ಷದ\s*ವಯಸ್ಸು|ವರ್ಷ\s*ವಯಸ್ಸು)\b", _rep_kannada_age, text)

    return text


_NON_NAME_WORDS = {
    "suffering", "having", "feeling", "taking", "allergic", "experiencing", "fine", "okay",
    "here", "ready", "sick", "in", "from", "doctor", "patient", "not", "unable", "getting",
    "facing", "pregnant", "diabetic", "asthmatic", "coughing", "sneezing", "vomiting", "bleeding",
    "hurting", "talking", "speaking", "calling", "visiting", "coming", "going", "tired", "weak",
    "dizzy", "nauseous", "better", "worse", "healthy", "sorry", "asking", "telling", "waiting",
    "looking", "showing", "trying", "very", "much", "too", "also", "still", "always", "pain",
    "chest", "stomach", "headache", "fever", "cough", "cold", "kidney", "stone", "trouble",
    "problem", "back", "leg", "knee", "eye", "ear", "throat", "skin", "heart"
}


def mask_spoken_names(text: str) -> str:
    """Masks 'My name is ...', 'I am [Name]' into 'Patient 1'."""
    if not text:
        return text

    def _sub_name_is(m: re.Match) -> str:
        word = m.group(1).strip()
        first = word.split()[0].lower()
        if first in _NON_NAME_WORDS:
            return m.group(0)
        return "My name is Patient 1"

    text = re.sub(r"(?i)\b(?:my\s+name\s+is|name\s+is)\s+([A-Za-z]{2,}(?:\s+[A-Za-z]{2,})?)\b", _sub_name_is, text)

    def _sub_i_am(m: re.Match) -> str:
        word = m.group(1).strip()
        first = word.split()[0].lower()
        if first in _NON_NAME_WORDS:
            return m.group(0)
        return "I am Patient 1"

    text = re.sub(r"(?i)\b(?:i\s*am|i'm)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b", _sub_i_am, text)

    text = re.sub(r"(?i)\b(?:मेरा\s+नाम|नाम)\s+([ऀ-෿]{2,}(?:\s+[ऀ-෿]{2,})?)\s+(?:है)?\b", "मेरा नाम Patient 1 है", text)
    text = re.sub(r"(?i)\b(?:ನನ್ನ\s+ಹೆಸರು|ಹೆಸರು)\s+([ऀ-෿]{2,}(?:\s+[ऀ-෿]{2,})?)\b", "ನನ್ನ ಹೆಸರು Patient 1", text)

    return text


def deidentifier_for(patient_name: Optional[str], doctor_name: Optional[str], places: Iterable[str] = ()) -> Deidentifier:
    return Deidentifier([patient_name] if patient_name else [], [doctor_name] if doctor_name else [], list(places))
