"""
Importers for official terminology release files. Each reads the file format exactly as published
and writes into the local terminology store. Run through the CLI: `python -m app.terminology --help`.
"""
import csv
import re
from datetime import datetime, timezone
import sqlite3
import sys
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Sequence, Set, Tuple

from app.terminology.store import ConceptRow, replace_maps, replace_system

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

LICENCE_ICD = "WHO ICD-11, CC BY-ND 3.0 IGO"
LICENCE_RXNORM = "NLM RxNorm Current Prescribable Content (no licence required)"
LICENCE_SNOMED = "SNOMED CT, used under the India national licence (NRCeS affiliate)"
LICENCE_LOINC = "LOINC, used under the LOINC licence (loinc.org)"


def _open_text(path: Path):
    return open(path, encoding="utf-8-sig", newline="")


# ---------------------------------------------------------------------------
# ICD-11 MMS (WHO Simple Tabulation) + ICD-10 / ICD-10<->11 maps (WHO mapping tables)
# ---------------------------------------------------------------------------
ICD11_SKIP_CHAPTERS = {"X", "V", "26"}  # extension codes, functioning, traditional-medicine patterns
ICD11_CATEGORY = {"21": "symptom", "22": "injury", "23": "external_cause", "24": "factor"}


def _clean_title(title: str) -> str:
    return re.sub(r"^[-\s]+", "", title.strip().strip('"')).strip()


def _icd11_version(header: Sequence[str]) -> str:
    for col in header:
        if col.lower().startswith("version:"):
            return col.split(":", 1)[1].strip()
    return "unknown"


def icd11_rows(path: Path) -> Tuple[str, Iterator[ConceptRow]]:
    f = _open_text(path)
    reader = csv.reader(f, delimiter="\t")
    header = next(reader)
    idx = {name.strip(): i for i, name in enumerate(header)}
    version = _icd11_version(header)

    def rows() -> Iterator[ConceptRow]:
        with f:
            for r in reader:
                if len(r) <= idx["ChapterNo"]:
                    continue
                code = r[idx["Code"]].strip()
                chapter = r[idx["ChapterNo"]].strip()
                if not code or chapter in ICD11_SKIP_CHAPTERS:
                    continue
                title = _clean_title(r[idx["Title"]])
                yield code, title, ICD11_CATEGORY.get(chapter, "diagnosis"), [(title, "preferred")]

    return version, rows()


def icd10_from_map(path: Path) -> Iterator[ConceptRow]:
    """WHO ICD-10 categories, taken from the ICD-10 -> ICD-11 mapping table."""
    with _open_text(path) as f:
        for row in csv.DictReader(f, delimiter="\t"):
            if (row.get("10ClassKind") or "").strip() != "category":
                continue
            code = (row.get("icd10Code") or "").strip()
            title = _clean_title(row.get("icd10Title") or "")
            if code and title:
                category = "symptom" if (row.get("icd10Chapter") or "").strip() == "XVIII" else "diagnosis"
                yield code, title, category, [(title, "preferred")]


_ROMAN_CHAPTER = re.compile(r"^[IVXL]+$")


def _is_code(code: str) -> bool:
    return bool(code) and "-" not in code and not code.isdigit() and not _ROMAN_CHAPTER.match(code)


def icd_map_rows(path: Path, direction: str) -> Iterator[Tuple[str, str, Optional[str]]]:
    """direction '10to11' or '11to10'. Column names differ slightly between the two WHO files."""
    with _open_text(path) as f:
        reader = csv.DictReader(f, delimiter="\t")
        cols = {c.lower().replace(" ", ""): c for c in (reader.fieldnames or [])}
        c10, c11 = cols.get("icd10code"), cols.get("icd11code")
        t10, t11 = cols.get("icd10title"), cols.get("icd11title")
        if not c10 or not c11:
            raise ValueError(f"{path.name}: expected icd10Code and icd11Code columns, found {reader.fieldnames}")
        for row in reader:
            a, b = (row.get(c10) or "").strip(), (row.get(c11) or "").strip()
            # Skip block ranges ("J09-J18") and chapter numbers ("01", "I"): not codable values.
            if not _is_code(a) or not _is_code(b):
                continue
            if direction == "10to11":
                yield a, b, _clean_title(row.get(t11) or "") if t11 else None
            else:
                yield b, a, _clean_title(row.get(t10) or "") if t10 else None


def import_icd(conn: sqlite3.Connection, tabulation: Path, map_10to11: Optional[Path],
               map_11to10: Optional[Path]) -> Dict[str, int]:
    version, rows = icd11_rows(tabulation)
    out: Dict[str, int] = {}
    out["ICD_11 concepts"], _ = replace_system(conn, "ICD_11", rows, version, tabulation.name, LICENCE_ICD)
    if map_10to11:
        out["ICD_10 concepts"], _ = replace_system(conn, "ICD_10", icd10_from_map(map_10to11), version,
                                                   map_10to11.name, LICENCE_ICD)
        out["ICD_10->ICD_11 maps"] = replace_maps(conn, "ICD_10", "ICD_11", icd_map_rows(map_10to11, "10to11"))
    if map_11to10:
        out["ICD_11->ICD_10 maps"] = replace_maps(conn, "ICD_11", "ICD_10", icd_map_rows(map_11to10, "11to10"))
    return out


# ---------------------------------------------------------------------------
# RxNorm (RXNCONSO.RRF from the prescribable subset or a full release)
# ---------------------------------------------------------------------------
RXNORM_CONCEPT_TTYS = {"IN": 0, "PIN": 1, "MIN": 2, "SCD": 3}   # ingredients and clinical drugs (no US brands)
RXNORM_SYNONYM_TTYS = {"PSN", "SY", "TMSY"}

# US (USAN) name -> name used in India (INN/BAN). Added as searchable aliases.
INDIAN_DRUG_NAMES = {
    "acetaminophen": "paracetamol", "albuterol": "salbutamol", "levalbuterol": "levosalbutamol",
    "epinephrine": "adrenaline", "norepinephrine": "noradrenaline", "furosemide": "frusemide",
    "glyburide": "glibenclamide", "lidocaine": "lignocaine", "meperidine": "pethidine",
    "isoproterenol": "isoprenaline", "cyclosporine": "ciclosporin", "rifampin": "rifampicin",
    "phenobarbital": "phenobarbitone", "cephalexin": "cefalexin", "sulfamethoxazole": "sulphamethoxazole",
    "acetylcysteine": "N-acetylcysteine", "dextroamphetamine": "dexamfetamine",
    "valproate": "sodium valproate", "thiamine": "vitamin B1", "cyanocobalamin": "vitamin B12",
}
_US_NAME_RE = re.compile(r"\b(" + "|".join(re.escape(k) for k in INDIAN_DRUG_NAMES) + r")\b", re.IGNORECASE)


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def _indian_alias(name: str) -> Optional[str]:
    alias = _US_NAME_RE.sub(lambda m: INDIAN_DRUG_NAMES[m.group(1).lower()], name)
    return alias if alias != name else None


def rxnorm_rows(path: Path) -> Iterator[ConceptRow]:
    concepts: Dict[str, Tuple[int, str]] = {}   # rxcui -> (tty rank, name)
    synonyms: Dict[str, List[str]] = {}
    with open(path, encoding="utf-8", newline="") as f:
        for line in f:
            p = line.rstrip("\n").split("|")
            if len(p) < 17 or p[11] != "RXNORM" or p[16] not in ("N", ""):
                continue
            rxcui, tty, name = p[0], p[12], p[14]
            if tty in RXNORM_CONCEPT_TTYS:
                rank = RXNORM_CONCEPT_TTYS[tty]
                if rxcui not in concepts or rank < concepts[rxcui][0]:
                    concepts[rxcui] = (rank, name)
            elif tty in RXNORM_SYNONYM_TTYS:
                synonyms.setdefault(rxcui, []).append(name)

    for rxcui, (rank, name) in concepts.items():
        display = _cap(name) if rank <= 2 else name
        names: List[Tuple[str, str]] = []
        alias = _indian_alias(name)
        if alias:
            names.append((_cap(alias) if rank <= 2 else alias, "alias"))   # Indian name first
        names.append((display, "preferred"))
        for syn in synonyms.get(rxcui, []):
            names.append((syn, "synonym"))
            syn_alias = _indian_alias(syn)
            if syn_alias:
                names.append((syn_alias, "alias"))
        yield rxcui, (_cap(alias) if alias and rank <= 2 else display), "drug", names


def import_rxnorm(conn: sqlite3.Connection, rxnconso: Path, version: str) -> Dict[str, int]:
    n, t = replace_system(conn, "RxNorm", rxnorm_rows(rxnconso), version, rxnconso.name, LICENCE_RXNORM)
    return {"RxNorm concepts": n, "RxNorm terms": t}


# ---------------------------------------------------------------------------
# SNOMED CT (RF2 Snapshot: concepts, descriptions, optional language refset)
# ---------------------------------------------------------------------------
FSN_TYPE = "900000000000003001"
SYNONYM_TYPE = "900000000000013009"
PREFERRED = "900000000000548007"
LANG_REFSET_ORDER = ["900000000000508004", "900000000000509007"]  # en-GB, en-US (India editions follow GB)

SNOMED_CATEGORY = {
    "disorder": "disorder", "finding": "finding", "procedure": "procedure", "regime/therapy": "procedure",
    "body structure": "body", "substance": "substance", "product": "drug", "medicinal product": "drug",
    "medicinal product form": "drug", "clinical drug": "drug", "observable entity": "observation",
    "situation": "situation", "organism": "organism", "morphologic abnormality": "morphology",
    "event": "event", "physical object": "object", "qualifier value": "qualifier", "specimen": "specimen",
}
SNOMED_DEFAULT_TAGS = {
    "disorder", "finding", "procedure", "regime/therapy", "body structure", "substance", "product",
    "medicinal product", "medicinal product form", "clinical drug", "observable entity", "situation",
    "organism", "morphologic abnormality", "event",
}
_TAG_RE = re.compile(r"\(([^()]+)\)\s*$")


def _find(directory: Path, pattern: str) -> Optional[Path]:
    hits = sorted(directory.rglob(pattern))
    return hits[0] if hits else None


def import_snomed(conn: sqlite3.Connection, rf2_dir: Path, version: Optional[str],
                  all_hierarchies: bool = False) -> Dict[str, int]:
    concept_file = _find(rf2_dir, "sct2_Concept_*Snapshot*.txt")
    desc_file = _find(rf2_dir, "sct2_Description_*Snapshot*-en*.txt")
    lang_file = _find(rf2_dir, "der2_cRefset_Language*Snapshot*-en*.txt")
    if not concept_file or not desc_file:
        raise FileNotFoundError(f"No RF2 Snapshot concept/description files under {rf2_dir}")
    version = version or (re.search(r"_(\d{8})\.txt$", concept_file.name) or [None, "unknown"])[1]

    # Pass 1: active concepts.
    active: Set[str] = set()
    with _open_text(concept_file) as f:
        next(f)
        for line in f:
            p = line.rstrip("\r\n").split("\t")
            if len(p) >= 3 and p[2] == "1":
                active.add(p[0])

    # Pass 2: which descriptions are preferred (language refset), choosing one dialect.
    preferred_ids: Set[str] = set()
    if lang_file:
        by_refset: Dict[str, Set[str]] = {}
        with _open_text(lang_file) as f:
            next(f)
            for line in f:
                p = line.rstrip("\r\n").split("\t")
                if len(p) >= 7 and p[2] == "1" and p[6] == PREFERRED:
                    by_refset.setdefault(p[4], set()).add(p[5])
        chosen = next((r for r in LANG_REFSET_ORDER if r in by_refset), next(iter(by_refset), None))
        preferred_ids = by_refset.get(chosen, set()) if chosen else set()

    # Pass 3: semantic tag (from FSN) and preferred term per concept.
    tag: Dict[str, str] = {}
    pref: Dict[str, str] = {}
    with _open_text(desc_file) as f:
        next(f)
        for line in f:
            p = line.rstrip("\r\n").split("\t")
            if len(p) < 9 or p[2] != "1" or p[4] not in active:
                continue
            if p[6] == FSN_TYPE:
                m = _TAG_RE.search(p[7])
                if m:
                    tag[p[4]] = m.group(1)
                pref.setdefault(p[4], _TAG_RE.sub("", p[7]).strip())
            elif p[6] == SYNONYM_TYPE and p[0] in preferred_ids:
                pref[p[4]] = p[7]

    keep = {c for c in active if all_hierarchies or tag.get(c) in SNOMED_DEFAULT_TAGS}
    del active

    # Pass 4: write concepts, then stream synonyms as searchable terms.
    conn.execute("DELETE FROM terms WHERE concept_id IN (SELECT id FROM concepts WHERE system = 'SNOMED_CT')")
    conn.execute("DELETE FROM concepts WHERE system = 'SNOMED_CT'")
    ids: Dict[str, int] = {}
    cur = conn.cursor()
    for code in keep:
        display = pref.get(code)
        if not display:
            continue
        cur.execute("INSERT INTO concepts (system, code, display, category) VALUES ('SNOMED_CT', ?, ?, ?)",
                    (code, display, SNOMED_CATEGORY.get(tag.get(code, ""), "other")))
        ids[code] = cur.lastrowid
    del tag, keep
    n_terms = 0
    with _open_text(desc_file) as f:
        next(f)
        for line in f:
            p = line.rstrip("\r\n").split("\t")
            if len(p) < 9 or p[2] != "1" or p[6] != SYNONYM_TYPE:
                continue
            cid = ids.get(p[4])
            if cid is None:
                continue
            kind = "preferred" if p[0] in preferred_ids or p[7] == pref.get(p[4]) else "synonym"
            cur.execute("INSERT INTO terms (concept_id, term, kind) VALUES (?, ?, ?)", (cid, p[7], kind))
            n_terms += 1
    conn.execute(
        "INSERT OR REPLACE INTO sources (system, version, source_file, concepts, terms, licence, imported_at) "
        "VALUES ('SNOMED_CT', ?, ?, ?, ?, ?, ?)",
        (version, concept_file.parent.name, len(ids), n_terms, LICENCE_SNOMED, datetime.now(timezone.utc).isoformat()),
    )
    return {"SNOMED_CT concepts": len(ids), "SNOMED_CT terms": n_terms}


# ---------------------------------------------------------------------------
# LOINC (Loinc.csv from the LOINC table release)
# ---------------------------------------------------------------------------
LOINC_CLASSTYPE = {"1": "lab", "2": "observation"}  # 3 = claims attachments, 4 = surveys: skipped by default


def loinc_rows(path: Path, include_all_classes: bool) -> Iterator[ConceptRow]:
    with _open_text(path) as f:
        for row in csv.DictReader(f):
            if (row.get("STATUS") or "").upper() != "ACTIVE":
                continue
            category = LOINC_CLASSTYPE.get((row.get("CLASSTYPE") or "").strip())
            if not category and not include_all_classes:
                continue
            code = (row.get("LOINC_NUM") or "").strip()
            display = (row.get("LONG_COMMON_NAME") or row.get("COMPONENT") or "").strip()
            if not code or not display:
                continue
            names = [(display, "preferred")]
            for col, kind in (("DisplayName", "synonym"), ("CONSUMER_NAME", "synonym"), ("SHORTNAME", "short")):
                if row.get(col):
                    names.append((row[col], kind))
            yield code, display, category or "observation", names


def import_loinc(conn: sqlite3.Connection, loinc_csv: Path, version: str, include_all_classes: bool) -> Dict[str, int]:
    n, t = replace_system(conn, "LOINC", loinc_rows(loinc_csv, include_all_classes), version, loinc_csv.name, LICENCE_LOINC)
    return {"LOINC concepts": n, "LOINC terms": t}


# ---------------------------------------------------------------------------
# DDInter 2.0 drug-drug interactions (ddinter_downloads_code_*.csv). Licence: CC BY-NC-SA 4.0.
# ---------------------------------------------------------------------------
LICENCE_DDINTER = "DDInter 2.0, CC BY-NC-SA 4.0 (non-commercial; attribution required)"
DDINTER_LEVELS = {"major": "major", "moderate": "moderate", "minor": "minor", "unknown": "unknown"}


def import_ddinter(conn: sqlite3.Connection, files: Sequence[Path], version: str) -> Dict[str, int]:
    conn.execute("DELETE FROM interactions WHERE source = 'DDInter'")
    conn.execute("DELETE FROM interaction_drugs WHERE source = 'DDInter'")
    drugs: Dict[str, Tuple[str, str]] = {}
    pairs: Dict[Tuple[str, str], str] = {}
    for path in files:
        with _open_text(path) as f:
            for row in csv.DictReader(f):
                a, b = (row.get("Drug_A") or "").strip(), (row.get("Drug_B") or "").strip()
                level = DDINTER_LEVELS.get((row.get("Level") or "").strip().lower())
                if not a or not b or not level or a.lower() == b.lower():
                    continue
                drugs[a.lower()] = (a, (row.get("DDInterID_A") or "").strip())
                drugs[b.lower()] = (b, (row.get("DDInterID_B") or "").strip())
                pairs[tuple(sorted((a.lower(), b.lower())))] = level  # same pair appears in several class files
    conn.executemany(
        "INSERT INTO interaction_drugs (name_norm, name, source, source_id) VALUES (?, ?, 'DDInter', ?)",
        ((k, name, sid) for k, (name, sid) in drugs.items()),
    )
    conn.executemany(
        "INSERT INTO interactions (source, a, b, severity) VALUES ('DDInter', ?, ?, ?)",
        ((a, b, level) for (a, b), level in pairs.items()),
    )
    conn.execute(
        "INSERT OR REPLACE INTO sources (system, version, source_file, concepts, terms, licence, imported_at) "
        "VALUES ('DDInter', ?, ?, ?, ?, ?, ?)",
        (version, ", ".join(p.name for p in files)[:500], len(drugs), len(pairs), LICENCE_DDINTER,
         datetime.now(timezone.utc).isoformat()),
    )
    return {"DDInter drugs": len(drugs), "DDInter interaction pairs": len(pairs)}


# ---------------------------------------------------------------------------
# English dictionary for spell-check: FrequencyWords en_50k (CC BY-SA 4.0) + dwyl words_alpha (public domain)
# ---------------------------------------------------------------------------
LICENCE_ENGLISH = "FrequencyWords en_50k (Hermit Dave, CC BY-SA 4.0, OpenSubtitles 2018) + dwyl english-words (public domain)"
_ALPHA_RE = re.compile(r"^[a-z][a-z']*$")


def import_english(conn: sqlite3.Connection, freq_file: Path, words_file: Optional[Path]) -> Dict[str, int]:
    from app.services.intellisense_engine import sound_key  # lazy: avoids an import cycle

    conn.execute("DELETE FROM english_words")
    rows: Dict[str, int] = {}
    with _open_text(freq_file) as f:
        for line in f:
            parts = line.split()
            if len(parts) == 2 and _ALPHA_RE.match(parts[0]) and parts[1].isdigit():
                rows.setdefault(parts[0], int(parts[1]))
    common = len(rows)
    if words_file:
        with _open_text(words_file) as f:
            for line in f:
                w = line.strip().lower()
                if len(w) >= 2 and _ALPHA_RE.match(w):
                    rows.setdefault(w, 0)
    conn.executemany(
        "INSERT INTO english_words (word, freq, key, first, len) VALUES (?, ?, ?, ?, ?)",
        ((w, f, k, k[:1], len(k)) for w, f in rows.items() for k in (sound_key(w),) if k),
    )
    conn.execute(
        "INSERT OR REPLACE INTO sources (system, version, source_file, concepts, terms, licence, imported_at) "
        "VALUES ('ENGLISH', ?, ?, ?, ?, ?, ?)",
        ("en_50k 2018 + words_alpha", freq_file.name, common, len(rows), LICENCE_ENGLISH,
         datetime.now(timezone.utc).isoformat()),
    )
    return {"common English words": common, "English words total": len(rows)}


# ---------------------------------------------------------------------------
# Generic CSV (CDCI or any catalogue): you say which columns hold the code, name and synonyms.
# ---------------------------------------------------------------------------
def csv_rows(path: Path, code_col: str, name_col: str, synonym_cols: Sequence[str], category: str,
             delimiter: str) -> Iterator[ConceptRow]:
    with _open_text(path) as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        missing = [c for c in (code_col, name_col, *synonym_cols) if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"Columns not found in {path.name}: {missing}. Available: {reader.fieldnames}")
        for row in reader:
            code, name = (row.get(code_col) or "").strip(), (row.get(name_col) or "").strip()
            if not code or not name:
                continue
            names = [(name, "preferred")] + [(row[c].strip(), "synonym") for c in synonym_cols if (row.get(c) or "").strip()]
            yield code, name, category, names


def import_csv(conn: sqlite3.Connection, path: Path, system: str, code_col: str, name_col: str,
               synonym_cols: Sequence[str], category: str, version: str, licence: str, delimiter: str) -> Dict[str, int]:
    n, t = replace_system(conn, system, csv_rows(path, code_col, name_col, synonym_cols, category, delimiter),
                          version, path.name, licence)
    return {f"{system} concepts": n, f"{system} terms": t}
