"""
Medication safety checks for the consultation notepad and the CDSS API.

1. Finds medicines in free text: generic names (DDInter vocabulary), Indian/INN names
   (paracetamol, salbutamol, frusemide...) and a starter list of common Indian brands.
2. Drug-drug interactions between medicines in the note and the patient's current medicines,
   from the imported DDInter 2.0 data plus a few curated rules (legacy ddi_engine).
3. Allergy checks against the patient's recorded allergies, by drug class.

Doctor stays in control: these are alerts with their source, never automatic changes.
Everything runs locally against the terminology store; nothing leaves the server.

Curated tables in this file (aliases, brands, allergy classes) are starter content for the
hackathon and need clinical review; CDCI replaces the brand list once imported.
"""
import re
import sqlite3
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from app.services.ddi_engine import VERIFIED_DDI_RULES
from app.terminology.store import terminology

DDINTER_SOURCE = "DDInter 2.0 (CC BY-NC-SA 4.0)"
CURATED_SOURCE = "Curated rule (NFI / formulary)"
ALLERGY_SOURCE = "Patient allergy record"

# Old rule severities -> the DDInter scale used everywhere else.
CURATED_SEVERITY = {"critical": "major", "high": "major", "moderate": "moderate", "low": "minor"}
LOW_PRIORITY = {"minor", "unknown"}

SEVERITY_RANK = {"contraindicated": 0, "major": 1, "moderate": 2, "caution": 3, "minor": 4, "unknown": 5}

# General guidance per DDInter level. DDInter downloads carry the level only, not drug-specific advice.
LEVEL_GUIDANCE = {
    "major": "Avoid the combination or use only with close monitoring; consider an alternative.",
    "moderate": "Use with caution: monitor the patient and adjust dose or timing if needed.",
    "minor": "Low clinical risk; be aware of the interaction.",
    "unknown": "An interaction is recorded but its severity is not graded; review before prescribing.",
}

# Indian / INN / everyday names -> the name DDInter uses.
NAME_EQUIVALENTS = {
    "paracetamol": "acetaminophen", "aspirin": "acetylsalicylic acid", "albuterol": "salbutamol",
    "frusemide": "furosemide", "glibenclamide": "glyburide", "rifampin": "rifampicin",
    "adrenaline": "epinephrine", "noradrenaline": "norepinephrine", "lignocaine": "lidocaine",
    "aluminium hydroxide": "aluminum hydroxide", "alcohol": "ethanol", "levosalbutamol": "levosalbutamol",
    "co-trimoxazole": "sulfamethoxazole", "cotrimoxazole": "sulfamethoxazole",
    "amoxycillin": "amoxicillin", "cephalexin": "cefalexin", "cefalexin": "cephalexin",
    "ciclosporin": "cyclosporine", "thyroxine": "levothyroxine", "vitamin k": "phytonadione",
}

# How to show DDInter's names to doctors in India.
INDIAN_DISPLAY = {
    "acetaminophen": "Paracetamol", "acetylsalicylic acid": "Aspirin", "aluminum hydroxide": "Aluminium hydroxide",
    "glyburide": "Glibenclamide", "ethanol": "Alcohol (ethanol)", "phytonadione": "Vitamin K (phytonadione)",
}

# Common Indian brands -> generics (starter list; CDCI is the authoritative source).
BRANDS = {
    "dolo": ["acetaminophen"], "crocin": ["acetaminophen"], "calpol": ["acetaminophen"],
    "ecosprin": ["acetylsalicylic acid"], "disprin": ["acetylsalicylic acid"],
    "gelusil": ["aluminum hydroxide", "magnesium hydroxide"], "digene": ["aluminum hydroxide", "magnesium hydroxide"],
    "mucaine": ["aluminum hydroxide", "magnesium hydroxide"],
    "combiflam": ["ibuprofen", "acetaminophen"], "brufen": ["ibuprofen"], "voveran": ["diclofenac"],
    "augmentin": ["amoxicillin", "clavulanic acid"], "clavam": ["amoxicillin", "clavulanic acid"],
    "mox": ["amoxicillin"], "pantocid": ["pantoprazole"], "omez": ["omeprazole"], "rantac": ["ranitidine"],
    "glycomet": ["metformin"], "thyronorm": ["levothyroxine"], "eltroxin": ["levothyroxine"],
    "telma": ["telmisartan"], "amlong": ["amlodipine"], "amlodac": ["amlodipine"], "atorva": ["atorvastatin"],
    "clopilet": ["clopidogrel"], "plavix": ["clopidogrel"], "acitrom": ["acenocoumarol"],
    "ciplox": ["ciprofloxacin"], "azithral": ["azithromycin"], "azee": ["azithromycin"],
    "cetzine": ["cetirizine"], "emeset": ["ondansetron"], "aldactone": ["spironolactone"],
    "lasix": ["furosemide"], "asthalin": ["salbutamol"], "deriphyllin": ["theophylline"],
    "metrogyl": ["metronidazole"], "flagyl": ["metronidazole"], "zifi": ["cefixime"], "taxim": ["cefixime"],
    "monocef": ["ceftriaxone"], "septran": ["sulfamethoxazole", "trimethoprim"], "bactrim": ["sulfamethoxazole", "trimethoprim"],
}
# Brands that are also ordinary words only count when written like a prescription ("Pan 40", "Pan-D").
PATTERN_BRANDS = [(re.compile(r"\bpan(?:[-\s]?d)?\s*\d{2}\b", re.I), ["pantoprazole"])]

# Allergy text keyword -> (class name, test for a drug name, severity, explanation)
ALLERGY_CLASSES: List[Tuple[Tuple[str, ...], str, Any, str, str]] = [
    (("penicillin", "amoxicillin", "ampicillin", "beta-lactam", "beta lactam"), "penicillin",
     lambda d: d.endswith("cillin"), "contraindicated",
     "{drug} is a penicillin; patient has a recorded {allergy} allergy."),
    (("penicillin",), "cephalosporin",
     lambda d: d.startswith(("cef", "ceph")), "caution",
     "{drug} is a cephalosporin; possible cross-reactivity with the recorded {allergy} allergy."),
    (("cephalosporin",), "cephalosporin",
     lambda d: d.startswith(("cef", "ceph")), "contraindicated",
     "{drug} is a cephalosporin; patient has a recorded {allergy} allergy."),
    (("sulfa", "sulpha", "sulfonamide", "sulphonamide", "co-trimoxazole", "cotrimoxazole"), "sulfonamide",
     lambda d: d.startswith(("sulfa", "sulpha")), "contraindicated",
     "{drug} is a sulfonamide antibiotic; patient has a recorded {allergy} allergy."),
    (("nsaid", "aspirin", "ibuprofen", "diclofenac", "painkiller"), "NSAID",
     lambda d: d in NSAIDS, "contraindicated",
     "{drug} is an NSAID; patient has a recorded {allergy} allergy."),
    (("quinolone", "fluoroquinolone", "ciprofloxacin", "levofloxacin", "ofloxacin"), "fluoroquinolone",
     lambda d: d.endswith("floxacin"), "contraindicated",
     "{drug} is a fluoroquinolone; patient has a recorded {allergy} allergy."),
    (("macrolide", "azithromycin", "erythromycin", "clarithromycin"), "macrolide",
     lambda d: d.endswith("thromycin"), "contraindicated",
     "{drug} is a macrolide; patient has a recorded {allergy} allergy."),
    (("tetracycline", "doxycycline"), "tetracycline",
     lambda d: d.endswith("cycline"), "contraindicated",
     "{drug} is a tetracycline; patient has a recorded {allergy} allergy."),
]
NSAIDS = {"acetylsalicylic acid", "ibuprofen", "diclofenac", "naproxen", "aceclofenac", "etoricoxib", "ketorolac",
          "mefenamic acid", "indometacin", "indomethacin", "piroxicam", "nimesulide", "celecoxib", "ketoprofen"}

# A medicine mentioned right after one of these isn't being prescribed ("stopped aspirin", "no h/o warfarin").
NEGATION_RE = re.compile(
    r"\b(no|not|never|stop(?:ped)?|discontinue[d]?|withh[oe]ld|avoid|allergic to|allergy to|h/o allergy to|"
    r"instead of|replace[d]?|switch(?:ed)? from|denies|without)\b[^.;\n]{0,25}$", re.I)


@dataclass
class Mention:
    start: int
    end: int
    text: str
    drugs: List[str]          # canonical (DDInter-style) lower-case names
    origin: str = "note"      # "note" or "current medication"
    label: str = ""           # what to show, e.g. the patient's medication line


@dataclass
class _Matcher:
    regex: Optional["re.Pattern[str]"]
    lookup: Dict[str, List[str]] = field(default_factory=dict)
    display: Dict[str, str] = field(default_factory=dict)
    stamp: Tuple[float, int] = (0.0, 0)


_lock = threading.Lock()
_matcher = _Matcher(regex=None)


def _base(name: str) -> str:
    return re.sub(r"\s*\([^)]*\)", "", name).strip().lower()


def _db_conn() -> Optional[sqlite3.Connection]:
    if not terminology.available:
        return None
    try:
        return terminology._conn()
    except sqlite3.Error:
        return None


def _build_matcher() -> _Matcher:
    """Vocabulary of medicine names, rebuilt whenever the terminology database changes."""
    path = terminology.path
    stamp = (path.stat().st_mtime, path.stat().st_size) if path.exists() else (0.0, 0)
    with _lock:
        global _matcher
        if _matcher.regex is not None and _matcher.stamp == stamp:
            return _matcher
        lookup: Dict[str, List[str]] = {}
        display: Dict[str, str] = {}
        conn = _db_conn()
        names: List[Tuple[str, str]] = []
        if conn is not None:
            try:
                names = conn.execute("SELECT name_norm, name FROM interaction_drugs").fetchall()
            except sqlite3.Error:
                names = []
        # Prefer the plain entry when DDInter has variants like "Dexamethasone (topical)".
        for norm, name in sorted(names, key=lambda r: ("(" in r[0], r[0])):
            base = _base(norm)
            if len(base) >= 4 and base not in lookup:
                lookup[base] = [norm]
                display[norm] = re.sub(r"\s*\([^)]*\)", "", name).strip()
        known = set(lookup)
        for alias, target in NAME_EQUIVALENTS.items():
            if target in known and alias not in lookup:
                lookup[alias] = lookup[target]
        for brand, generics in BRANDS.items():
            resolved = [lookup[g][0] for g in generics if g in lookup]
            if resolved:
                lookup[brand] = resolved
        # Without imported data, fall back to the curated rules' keywords so checks still work.
        for rule in VERIFIED_DDI_RULES:
            for side, kws in (("a", rule["keywords_a"]), ("b", rule["keywords_b"])):
                for kw in kws:
                    lookup.setdefault(kw, [kw])
        for norm in [n for vals in lookup.values() for n in vals]:
            display.setdefault(norm, norm.title())
        display.update({k: v for k, v in INDIAN_DISPLAY.items() if k in display})
        alternation = "|".join(re.escape(k).replace(r"\ ", r"\s+") for k in sorted(lookup, key=len, reverse=True))
        regex = re.compile(rf"(?<![A-Za-z])(?:{alternation})(?![A-Za-z])", re.I) if alternation else None
        _matcher = _Matcher(regex=regex, lookup=lookup, display=display, stamp=stamp)
        return _matcher


def is_medicine_word(lower: str) -> bool:
    """True for any single word of a known medicine name, brand or alias (used by spell-check)."""
    m = _build_matcher()
    if m.stamp != getattr(is_medicine_word, "_stamp", None):
        is_medicine_word._words = {w for name in m.lookup for w in name.split()}  # type: ignore[attr-defined]
        is_medicine_word._stamp = m.stamp  # type: ignore[attr-defined]
    return lower in is_medicine_word._words  # type: ignore[attr-defined]


def medicine_word_keys() -> List[Tuple[str, str]]:
    """(word, sound key) for every medicine word, so misspelled brands are corrected to the brand."""
    from app.services.intellisense_engine import sound_key  # lazy: avoids an import cycle
    is_medicine_word("")  # refresh the word set if the database changed
    if getattr(medicine_word_keys, "_stamp", None) != is_medicine_word._stamp:  # type: ignore[attr-defined]
        medicine_word_keys._pairs = [(w, sound_key(w)) for w in is_medicine_word._words if len(w) >= 5]  # type: ignore[attr-defined]
        medicine_word_keys._stamp = is_medicine_word._stamp  # type: ignore[attr-defined]
    return medicine_word_keys._pairs  # type: ignore[attr-defined]


def find_medicines(text: str, origin: str = "note", label: str = "") -> List[Mention]:
    m = _build_matcher()
    found: List[Mention] = []
    if m.regex is not None:
        for hit in m.regex.finditer(text):
            key = re.sub(r"\s+", " ", hit.group(0).lower())
            line_start = text.rfind("\n", 0, hit.start()) + 1
            if NEGATION_RE.search(text[line_start:hit.start()]):
                continue
            found.append(Mention(hit.start(), hit.end(), hit.group(0), list(m.lookup.get(key, [])), origin, label))
    for regex, generics in PATTERN_BRANDS:
        for hit in regex.finditer(text):
            resolved = [m.lookup[g][0] for g in generics if g in m.lookup]
            if resolved:
                found.append(Mention(hit.start(), hit.end(), hit.group(0), resolved, origin, label))
    return sorted(found, key=lambda x: x.start)


def _interaction(a: str, b: str) -> Optional[str]:
    conn = _db_conn()
    if conn is None:
        return None
    x, y = sorted((a, b))
    try:
        row = conn.execute("SELECT severity FROM interactions WHERE a = ? AND b = ? ORDER BY source LIMIT 1", (x, y)).fetchone()
    except sqlite3.Error:
        return None
    return row[0] if row else None


def _curated(a: str, b: str) -> Optional[Dict[str, str]]:
    for rule in VERIFIED_DDI_RULES:
        ka, kb = rule["keywords_a"], rule["keywords_b"]
        hit_a = any(k in a for k in ka) and any(k in b for k in kb)
        hit_b = any(k in b for k in ka) and any(k in a for k in kb)
        if hit_a or hit_b:
            return rule
    return None


_NOTE_ALLERGY_RES = [
    re.compile(r"(?im)^\s*(?:[-*]\s*)?allerg(?:y|ies)\s*:\s*([^(.\n;]{3,40})"),
    re.compile(r"(?i)\ballergic\s+to\s+([a-z][a-z \-]{2,30}?)(?=[.,;(\n]|\s+and\b|$)"),
    re.compile(r"(?i)\b([a-z][a-z\-]{3,30})\s+allergy\b"),
]
_NO_ALLERGY_RE = re.compile(r"(?i)\b(no|nil|nkda|denies|not)\b[^.\n]{0,25}$")


def note_allergies(note_text: str) -> List[str]:
    """Allergies written in the note itself (e.g. added from the call), ignoring "no known drug allergies"."""
    found: List[str] = []
    for rx in _NOTE_ALLERGY_RES:
        for m in rx.finditer(note_text or ""):
            value = m.group(1).strip()
            line_start = note_text.rfind("\n", 0, m.start()) + 1
            if _NO_ALLERGY_RE.search(note_text[line_start:m.start()]) or value.lower().startswith(("no ", "nil", "none", "known")):
                continue
            if value.lower() not in {"drug", "food", "known", "any"} and value not in found:
                found.append(value)
    return found


def check(note_text: str, current_meds: Sequence[str] = (), allergies: Sequence[str] = ()) -> Dict[str, Any]:
    """All safety alerts for a note, the patient's current medicines and recorded allergies."""
    allergies = list(allergies) + [a for a in note_allergies(note_text) if a not in allergies]
    m = _build_matcher()
    note = find_medicines(note_text)
    current: List[Mention] = []
    for med in current_meds:
        for mention in find_medicines(med, origin="current medication", label=med):
            current.append(mention)

    alerts: List[Dict[str, Any]] = []
    seen: Set[Tuple[str, ...]] = set()

    def spans_for(drug: str) -> List[List[int]]:
        return [[x.start, x.end] for x in note if drug in x.drugs]

    # Interactions: every pair that involves at least one medicine written in the note.
    entries = [(d, x) for x in note for d in x.drugs] + [(d, x) for x in current for d in x.drugs]
    def item_key(x: Mention) -> Tuple[str, Any]:
        # A current-medication line ("Gelusil / Magnesium Hydroxide") counts as one item.
        return ("line", x.label) if x.origin != "note" else ("note", id(x))

    graded: Set[frozenset] = set()   # item pairs DDInter already covers
    for i, (d1, x1) in enumerate(entries):
        for d2, x2 in entries[i + 1:]:
            if d1 != d2 and _interaction(d1, d2):
                graded.add(frozenset((item_key(x1), item_key(x2))))
    for i, (d1, x1) in enumerate(entries):
        for d2, x2 in entries[i + 1:]:
            if d1 == d2 or (x1.origin != "note" and x2.origin != "note"):
                continue
            key = tuple(sorted((d1, d2)))
            if key in seen:
                continue
            level = _interaction(d1, d2)
            # Curated rules only fill gaps: never repeat a pair of mentions DDInter already graded.
            rule = None if level or frozenset((item_key(x1), item_key(x2))) in graded else _curated(d1, d2)
            if not level and not rule:
                continue
            seen.add(key)
            names = [m.display.get(d, d.title()) for d in key]
            others = [x for x in (x1, x2) if x.origin != "note"]
            alerts.append({
                "kind": "interaction",
                "severity": level or CURATED_SEVERITY.get(rule["severity"].lower(), "moderate"),
                "title": f"{names[0]} + {names[1]}",
                "detail": LEVEL_GUIDANCE[level] if level else f"{rule['mechanism']} {rule['action']}",
                "source": DDINTER_SOURCE if level else f"{CURATED_SOURCE}: {rule['citation']}",
                "context": f"With current medication: {others[0].label}" if others else "Both written in this note",
                "spans": spans_for(d1) + spans_for(d2),
            })

    # Allergies: medicines in the note against recorded allergies, by class or by name.
    for allergy in allergies:
        a_low = allergy.lower()
        allergy_name = re.sub(r"\s*\(.*", "", allergy).strip() or allergy
        named = {d for x in find_medicines(allergy, origin="allergy") for d in x.drugs}
        for x in note:
            for d in x.drugs:
                hit = None
                for keywords, cls, test, severity, template in ALLERGY_CLASSES:
                    if any(k in a_low for k in keywords) and test(d):
                        hit = (severity, template.format(drug=m.display.get(d, d.title()), allergy=allergy_name.lower()))
                        break
                if not hit and d in named:
                    hit = ("contraindicated", f"Patient has a recorded allergy to {allergy_name}.")
                if not hit:
                    continue
                key = ("allergy", d, allergy_name.lower())
                if key in seen:
                    continue
                seen.add(key)
                alerts.append({
                    "kind": "allergy",
                    "severity": hit[0],
                    "title": f"{m.display.get(d, d.title())}: {allergy_name} allergy",
                    "detail": hit[1],
                    "source": ALLERGY_SOURCE,
                    "context": f"Recorded allergy: {allergy}",
                    "spans": spans_for(d),
                })

    for a in alerts:
        a["low_priority"] = a["severity"] in LOW_PRIORITY
    alerts.sort(key=lambda a: SEVERITY_RANK.get(a["severity"], 9))
    return {
        "alerts": alerts,
        "medicines": [{"start": x.start, "end": x.end, "text": x.text,
                       "drugs": [m.display.get(d, d.title()) for d in x.drugs]} for x in note],
        "checked_against": {"current_medications": list(current_meds), "allergies": list(allergies)},
        "interaction_data": "DDInter" if _interaction_data_present() else "curated rules only",
    }


def _interaction_data_present() -> bool:
    conn = _db_conn()
    if conn is None:
        return False
    try:
        return conn.execute("SELECT 1 FROM interactions LIMIT 1").fetchone() is not None
    except sqlite3.Error:
        return False


def patient_safety_context(encounter: Any, patient: Any) -> Dict[str, List[str]]:
    """Current medicines and allergies from the encounter and the patient's ABHA-linked history."""
    meds: List[str] = list(getattr(encounter, "current_meds_json", None) or [])
    allergies: List[str] = list(getattr(encounter, "allergies_json", None) or [])
    history = ((getattr(patient, "demographics_json", None) or {}).get("medical_history") or {}) if patient else {}
    for item in history.get("active_medications") or []:
        if item not in meds:
            meds.append(item)
    for item in history.get("allergies") or []:
        if item not in allergies:
            allergies.append(item)
    return {"current_medications": meds, "allergies": allergies}
