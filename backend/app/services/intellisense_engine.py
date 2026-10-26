"""
Server-side IntelliSense engine.

Runs the context-aware parts of the pipeline that need the full lexicon and more compute:
  - Section (context) detection from note headings
  - Colloquial -> standard nomenclature matching with confidence scoring
  - Medical spelling suggestions

Tier 1 (prefix completion), Tier 2 (shorthand) and auto-punctuation run in the browser
from the same lexicon, so the notepad keeps working offline.

Privacy: all functions are pure and operate on in-memory text only. Nothing here logs or
persists note content.
"""
import re
from functools import lru_cache
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from app.services.clinical_lexicon import (
    AUTO_CONVERT_THRESHOLD, COMMON_WORDS, NOMENCLATURE, SECTION_HEADINGS, SHORTHAND, TERMS,
)

MAX_TEXT_CHARS = 20000
SECTION_BONUS = 0.25
KEYWORD_BONUS = 0.15
MAX_KEYWORD_HITS = 2
CONTEXT_WINDOW = 80

_HEADING_RES = [(re.compile(h["pattern"], re.IGNORECASE), h["section"]) for h in SECTION_HEADINGS]


def detect_section(text: str, pos: int) -> Optional[str]:
    """Return the section of the nearest heading line at or above `pos`."""
    line_start = text.rfind("\n", 0, pos) + 1
    while True:
        line_end = text.find("\n", line_start)
        line = text[line_start: line_end if line_end != -1 else len(text)]
        for regex, section in _HEADING_RES:
            if regex.match(line):
                return section
        if line_start == 0:
            return None
        line_start = text.rfind("\n", 0, line_start - 1) + 1


# ---------------------------------------------------------------------------
# Nomenclature
# ---------------------------------------------------------------------------
def _word_re(phrase: str) -> str:
    return r"(?<![\w/-])" + re.escape(phrase).replace(r"\ ", r"\s+") + r"(?![\w-])"


@dataclass
class _Concept:
    regex: "re.Pattern[str]"
    candidates: List[Dict[str, Any]]
    keyword_res: List[List["re.Pattern[str]"]] = field(default_factory=list)


def _build_concepts() -> List[_Concept]:
    concepts = []
    for entry in NOMENCLATURE:
        phrases = sorted(entry["phrases"], key=len, reverse=True)
        not_followed = entry.get("not_followed_by", [])
        guard = r"(?!\s*[:=]?\s*\d)"  # "sugar 250", "BP: 120/80" are values, not diagnoses
        if not_followed:
            guard += r"(?!\s+(?:" + "|".join(re.escape(w) for w in not_followed) + r")\b)"
        regex = re.compile("(?:" + "|".join(_word_re(p) for p in phrases) + ")" + guard, re.IGNORECASE)
        kw_res = [[re.compile(_word_re(k), re.IGNORECASE) for k in c.get("keywords", [])] for c in entry["candidates"]]
        concepts.append(_Concept(regex=regex, candidates=entry["candidates"], keyword_res=kw_res))
    return concepts


_CONCEPTS = _build_concepts()


def _overlaps(start: int, end: int, ranges: Sequence[Tuple[int, int]]) -> bool:
    return any(start < r_end and r_start < end for r_start, r_end in ranges)


def _context_window(text: str, start: int, end: int) -> str:
    line_start = text.rfind("\n", 0, start) + 1
    line_end = text.find("\n", end)
    if line_end == -1:
        line_end = len(text)
    return text[max(line_start, start - CONTEXT_WINDOW): min(line_end, end + CONTEXT_WINDOW)]


def score_candidates(concept: _Concept, window: str, section: Optional[str]) -> Tuple[List[Dict[str, Any]], float]:
    scored = []
    for cand, kw_res in zip(concept.candidates, concept.keyword_res):
        hits = sum(1 for r in kw_res if r.search(window))
        raw = cand["prior"]
        if section and section in cand.get("sections", []):
            raw += SECTION_BONUS
        raw += KEYWORD_BONUS * min(hits, MAX_KEYWORD_HITS)
        scored.append((raw, cand))
    scored.sort(key=lambda s: s[0], reverse=True)

    if len(scored) == 1:
        confidence = scored[0][0]
    else:
        # Confidence reflects how clearly the top candidate beats the runner-up.
        confidence = 0.5 + (scored[0][0] - scored[1][0])
    confidence = round(max(0.0, min(0.99, confidence)), 2)

    candidates = [
        {
            "name": c["name"], "codes": c["codes"], "category": c["category"],
            "severity": c["severity"], "score": round(raw, 2),
        }
        for raw, c in scored
    ]
    return candidates, confidence


def find_nomenclature(text: str, skip_ranges: Sequence[Tuple[int, int]] = ()) -> List[Dict[str, Any]]:
    """Find colloquial terms in `text` and resolve each to ranked standard concepts."""
    found: List[Tuple[int, int, _Concept]] = []
    for concept in _CONCEPTS:
        for m in concept.regex.finditer(text):
            found.append((m.start(), m.end(), concept))

    # Prefer longer matches when they overlap ("low sugar" beats "sugar").
    found.sort(key=lambda f: (f[0], -(f[1] - f[0])))
    taken: List[Tuple[int, int]] = list(skip_ranges)
    results = []
    for start, end, concept in found:
        if _overlaps(start, end, taken):
            continue
        taken.append((start, end))
        section = detect_section(text, start)
        candidates, confidence = score_candidates(concept, _context_window(text, start, end), section)
        results.append({
            "start": start,
            "end": end,
            "original": text[start:end],
            "section": section,
            "confidence": confidence,
            "auto_convert": confidence >= AUTO_CONVERT_THRESHOLD,
            "candidates": candidates,
        })
    results.sort(key=lambda r: r["start"])
    return results


# ---------------------------------------------------------------------------
# Spelling
# ---------------------------------------------------------------------------
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]+")
_SUFFIXES = ("s", "es", "ed", "ing", "ly", "al")
_COMMON = set(COMMON_WORDS)
MIN_SPELL_LEN = 5

# "Sound key": spellings that sound alike map to the same key, so "numonia", "pnuemonia" and
# "pneumonia", or "diarhea" and "diarrhoea", are close. Mirrored in the browser (localEngine.ts).
_SOUND_RULES = [
    (re.compile(r"^p(?=[nst])"), ""), (re.compile(r"^kn"), "n"), (re.compile(r"^gn"), "n"),
    (re.compile(r"^wr"), "r"), (re.compile(r"ph"), "f"), (re.compile(r"rrh"), "r"), (re.compile(r"rh"), "r"),
    (re.compile(r"ae"), "e"), (re.compile(r"oe"), "e"), (re.compile(r"ck"), "k"), (re.compile(r"qu"), "kw"),
    (re.compile(r"x"), "ks"), (re.compile(r"th"), "t"), (re.compile(r"y"), "i"),
    (re.compile(r"c(?=[ei])"), "s"), (re.compile(r"c"), "k"), (re.compile(r"(.)+"), r""),
]


def sound_key(word: str) -> str:
    key = word.lower()
    for regex, repl in _SOUND_RULES:
        key = regex.sub(repl, key)
    return key


def _build_vocab() -> Dict[str, str]:
    """lowercase word -> display form, from all clinical terms."""
    vocab: Dict[str, str] = {}
    sources = [t["text"] for t in TERMS] + [s["expansion"] for s in SHORTHAND]
    sources += [c["name"] for e in NOMENCLATURE for c in e["candidates"]]
    for src in sources:
        for word in _WORD_RE.findall(src):
            if len(word) >= MIN_SPELL_LEN:
                vocab.setdefault(word.lower(), word)
    return vocab


_VOCAB = _build_vocab()
_VOCAB_KEYS = [(w, sound_key(w)) for w in _VOCAB]


def _bounded_osa(a: str, b: str, limit: int) -> int:
    """Edit distance where swapping two adjacent letters counts as one edit. Stops early past `limit`."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev2: List[int] = []
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        row_min = i
        for j in range(1, len(b) + 1):
            cost = a[i - 1] != b[j - 1]
            val = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                val = min(val, prev2[j - 2] + 1)
            cur[j] = val
            row_min = min(row_min, val)
        if row_min > limit:
            return limit + 1
        prev2, prev = prev, cur
    return prev[-1]


def _is_known(lower: str) -> bool:
    if lower in _VOCAB or lower in _COMMON:
        return True
    return any(lower.endswith(suf) and (lower[: -len(suf)] in _VOCAB or lower[: -len(suf)] in _COMMON)
               for suf in _SUFFIXES)


def _best_match(lower: str, key: str, candidates) -> Optional[str]:
    raw_limit = 1 if len(lower) < 8 else 2
    best: Tuple[int, str] = (99, "")
    for word, wkey in candidates:
        if abs(len(wkey) - len(key)) > 2:
            continue
        d_key = _bounded_osa(key, wkey, 1)          # sounds alike (allow 1 slip)
        d_raw = _bounded_osa(lower, word, raw_limit)  # looks alike
        if d_key <= 1 or d_raw <= raw_limit:
            score = min(d_key, d_raw)
            if score < best[0]:
                best = (score, word)
    return best[1] or None


def _known_in_terminology(lower: str) -> bool:
    from app.terminology.store import terminology  # lazy: optional dependency
    from app.services.safety_engine import is_medicine_word
    if is_medicine_word(lower):
        return True  # brand and generic medicine names (Augmentin, Ciplox, ...) are real words
    return terminology.is_known_word(lower) or any(
        lower.endswith(suf) and terminology.is_known_word(lower[: -len(suf)]) for suf in _SUFFIXES)


# Abbreviations doctors type in lower case; never "corrected".
CLINICAL_ABBREVIATIONS = set("""
ecg ekg cbc lft rft kft usg mri cxr abg esr crp rbs fbs ppbs iv im sc po prn stat bid tid qid od bd tds hs sos nad
sob doe pnd jvp cvs cns afb ors nsaid nsaids ppi arb ccb dm htn ihd cad copd ckd uti urti lrti tb hiv hbsag hcv opd
ipd icu gp mbbs pt pts yrs yr wks wk hrs mins mg mcg ml gm kg cm mm mmhg bpm iu tab tabs cap caps syp inj oint susp
neb gtt qd ac pc rx dx hx tx sx fx ddx bmi bsa ent ob gyn ivf rtpcr ncct hrct echo tmt vitals temp
""".split())
# Mixed case on purpose (mmHg, pH): not a "case slip".
CASE_EXCEPTIONS = {"mmhg", "ph", "meq", "ml", "dl", "igg", "igm", "ige", "iga", "kcal", "mcg"}
_SPELL_WORD_RE = re.compile(r"(?<![\w/'-])[A-Za-z][A-Za-z'-]*[A-Za-z](?![\w/])")
MEDICAL_FREQ = 20_000  # rank medical-vocabulary candidates like a fairly common English word


def _is_subsequence(short: str, long: str) -> bool:
    it = iter(long)
    return all(c in it for c in short)


def _typo_class(typed: str, cand: str) -> int:
    """How typical this typo is: 0 swapped letters, 1 missing/extra letter, 2 wrong letter(s)."""
    if len(typed) == len(cand) and sorted(typed) == sorted(cand):
        return 0                                   # "rset" -> "rest", "teh" -> "the"
    if len(cand) == len(typed) + 1 and _is_subsequence(typed, cand):
        return 1                                   # "tablts" -> "tablets", "presure" -> "pressure"
    if len(typed) == len(cand) + 1 and _is_subsequence(cand, typed):
        return 1                                   # "feever" -> "fever"
    return 2


def _english_freq(lower: str) -> Optional[int]:
    from app.terminology.store import terminology
    return terminology.english_word(lower)


@lru_cache(maxsize=1)
def _english_available() -> bool:
    return _english_freq("the") is not None


def _medically_known(lower: str) -> bool:
    return lower in CLINICAL_ABBREVIATIONS or _is_known(lower) or _known_in_terminology(lower)


def is_word(word: str) -> bool:
    """True for a complete English or clinical word."""
    lower = word.lower()
    return bool(lower) and (_english_freq(lower) is not None or _medically_known(lower))


@lru_cache(maxsize=8192)  # in RAM only; holds single words, cleared on restart
def check_word(word: str) -> Optional[Tuple[str, bool]]:
    """
    (suggestion, safe_to_autocorrect) for a misspelled word, or None if it's fine.
    Real words are never flagged: common English, medical vocabularies, medicines, clinical abbreviations,
    and ALL-CAPS acronyms. Autocorrect is only offered when the fix is clear-cut.
    """
    lower = word.lower()
    if len(lower) < 3 or lower in CLINICAL_ABBREVIATIONS or word.isupper():
        return None
    english = _english_available()
    freq = _english_freq(lower) if english else None

    # Case slip inside a real word: "AdequAte" -> "Adequate".
    if any(c.isupper() for c in word[1:]) and lower not in CASE_EXCEPTIONS:
        if freq is not None or _medically_known(lower):
            return word[0] + word[1:].lower(), True

    if freq:                                   # common English word
        return None
    if _medically_known(lower):
        return None
    rare_known = freq == 0                     # valid but uncommon English word
    if rare_known and len(lower) >= 6:
        return None                            # long rare words are almost always intentional
    if not english and len(lower) < MIN_SPELL_LEN:
        return None                            # without a dictionary, short words are too ambiguous

    key = sound_key(lower)
    short = len(lower) <= 4
    raw_limit = 1 if len(lower) < 8 else 2

    from app.services.safety_engine import medicine_word_keys
    from app.terminology.store import terminology
    pool: Dict[str, Tuple[str, int, str]] = {}   # candidate lower -> (display, frequency, sound key)
    for w, k in _VOCAB_KEYS:
        pool.setdefault(w, (_VOCAB[w], MEDICAL_FREQ, k))
    for w, k in medicine_word_keys():
        pool.setdefault(w, (w.capitalize(), MEDICAL_FREQ, k))
    for w, k in terminology.spelling_candidates(key):
        pool.setdefault(w, (w, MEDICAL_FREQ // 2, k))
    if english:
        for w, k, f in terminology.english_candidates(key, len(key)):
            display, have, _ = pool.get(w, (w, 0, k))
            pool[w] = (display, max(f, have), k)

    scored = []
    for cand, (display, cfreq, ckey) in pool.items():
        if abs(len(cand) - len(lower)) > 2:
            continue
        d_raw = _bounded_osa(lower, cand, raw_limit)
        if short:
            d = d_raw if d_raw <= 1 else 9     # sound-alike is too loose for short words
        else:
            d_key = _bounded_osa(key, ckey, 1)
            d = min(d_key if d_key <= 1 else 9, d_raw if d_raw <= raw_limit else 9)
        if d < 9:
            # Fewest slips, then the most typical kind of typo, then the more common word.
            scored.append((d, _typo_class(lower, cand), -cfreq, cand, display, cfreq))
    if not scored:
        return None
    scored.sort()
    d, typo, _, cand, display, cfreq = scored[0]
    if rare_known and (d > 1 or cfreq < 5_000):
        return None                            # only nudge rare words towards a clearly common one
    runner = scored[1] if len(scored) > 1 else None
    clear_winner = runner is None or runner[0] > d or runner[1] > typo or cfreq >= 5 * runner[5]
    auto = (not rare_known) and len(lower) >= 4 and d <= 1 and clear_winner
    suggestion = display
    if word[0].isupper():
        suggestion = suggestion[0].upper() + suggestion[1:]
    return suggestion, auto


def suggest_spelling(word: str, cache: Optional[Dict[str, Optional[str]]] = None) -> Optional[str]:
    """Return the likely intended word, or None. Real words are never flagged."""
    hit = check_word(word)
    return hit[0] if hit else None


def find_spelling(text: str, skip_ranges: Sequence[Tuple[int, int]] = (),
                  cache: Optional[Dict[str, Optional[str]]] = None) -> List[Dict[str, Any]]:
    issues = []
    for m in _SPELL_WORD_RE.finditer(text):
        if _overlaps(m.start(), m.end(), skip_ranges):
            continue
        hit = check_word(m.group(0))
        if hit:
            issues.append({"start": m.start(), "end": m.end(), "original": m.group(0),
                           "suggestion": hit[0], "auto": hit[1]})
    return issues


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def analyze(text: str, cursor: int, skip_ranges: Sequence[Sequence[int]] = (),
            spell_cache: Optional[Dict[str, Optional[str]]] = None) -> Dict[str, Any]:
    text = text[:MAX_TEXT_CHARS]
    cursor = max(0, min(cursor, len(text)))
    ranges = [(int(r[0]), int(r[1])) for r in skip_ranges if len(r) == 2]

    # Don't flag the word being typed right now; it's still incomplete.
    active = re.search(r"[A-Za-z'-]+$", text[:cursor])
    spell_skip = ranges + ([(active.start(), cursor)] if active else [])

    return {
        "section": detect_section(text, cursor),
        "nomenclature": find_nomenclature(text, ranges),
        "spelling": find_spelling(text, spell_skip, spell_cache),
    }
