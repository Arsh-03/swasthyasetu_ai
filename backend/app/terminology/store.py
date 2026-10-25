"""
Local terminology store: official clinical vocabularies in one SQLite file with full-text search.

- Separate from the app database (`settings.TERMINOLOGY_DB_PATH`), so it can be rebuilt or swapped
  without touching patient data.
- Read-only at runtime; written only by the import CLI (`python -m app.terminology ...`).
- No network access, ever. Releases are downloaded by an admin and imported offline.
- Light: SQLite reads from disk with a small page cache; nothing is preloaded into memory.
"""
import re
import sqlite3
import threading
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple

from app.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    system TEXT PRIMARY KEY,
    version TEXT,
    source_file TEXT,
    concepts INTEGER,
    terms INTEGER,
    licence TEXT,
    imported_at TEXT
);
CREATE TABLE IF NOT EXISTS concepts (
    id INTEGER PRIMARY KEY,
    system TEXT NOT NULL,
    code TEXT NOT NULL,
    display TEXT NOT NULL,
    category TEXT,
    UNIQUE (system, code)
);
CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY,
    concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    kind TEXT NOT NULL            -- preferred | synonym | fsn | short | alias
);
CREATE INDEX IF NOT EXISTS terms_concept ON terms(concept_id);
CREATE VIRTUAL TABLE IF NOT EXISTS terms_fts USING fts5(
    term, content='terms', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2', prefix='2 3 4'
);
CREATE TABLE IF NOT EXISTS code_maps (
    from_system TEXT NOT NULL,
    from_code TEXT NOT NULL,
    to_system TEXT NOT NULL,
    to_code TEXT NOT NULL,
    to_display TEXT,
    PRIMARY KEY (from_system, from_code, to_system, to_code)
);
CREATE TABLE IF NOT EXISTS words (
    word TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    first TEXT NOT NULL,
    len INTEGER NOT NULL,
    freq INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS words_lookup ON words(first, len);
-- Drug-drug interactions (e.g. DDInter). Drug names are stored lower-case; pairs are ordered (a < b).
CREATE TABLE IF NOT EXISTS interaction_drugs (
    name_norm TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    source_id TEXT
) WITHOUT ROWID;
-- General English words for spell-check. freq > 0 = common word (frequency list); 0 = valid but rare.
CREATE TABLE IF NOT EXISTS english_words (
    word TEXT PRIMARY KEY,
    freq INTEGER NOT NULL,
    key TEXT NOT NULL,
    first TEXT NOT NULL,
    len INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS english_lookup ON english_words(first, len, freq);
CREATE TABLE IF NOT EXISTS interactions (
    source TEXT NOT NULL,
    a TEXT NOT NULL,
    b TEXT NOT NULL,
    severity TEXT NOT NULL,          -- major | moderate | minor | unknown
    description TEXT,
    management TEXT,
    PRIMARY KEY (source, a, b)
) WITHOUT ROWID;
"""

# Human-readable labels and FHIR system URIs per code system.
SYSTEM_LABELS = {
    "SNOMED_CT": "SNOMED CT", "ICD_11": "ICD-11", "ICD_10": "ICD-10", "LOINC": "LOINC",
    "RxNorm": "RxNorm", "CDCI": "CDCI",
}
FHIR_SYSTEM_URIS = {
    "SNOMED_CT": "http://snomed.info/sct",
    "ICD_10": "http://hl7.org/fhir/sid/icd-10",
    "ICD_11": "http://id.who.int/icd/release/11/mms",
    "LOINC": "http://loinc.org",
    "RxNorm": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "CDCI": "https://www.nrces.in/cdci",
}

# Systems searched from the notepad. ICD-10 is kept for mapping, not offered as suggestions.
SEARCH_SYSTEMS = ("SNOMED_CT", "ICD_11", "LOINC", "RxNorm", "CDCI")

# Which categories a note section prefers (ranking boost only; nothing is filtered out).
SECTION_PREFERENCES = {
    "plan": {"drug"},
    "labs": {"lab", "observation"},
    "history": {"disorder", "diagnosis"},
    "assessment": {"disorder", "diagnosis"},
    "complaints": {"finding", "symptom", "disorder"},
    "exam": {"finding", "body", "observation"},
}

# Categories that make no sense in a section (medicines while writing a diagnosis or lab order).
SECTION_EXCLUDES = {"assessment": {"drug"}, "labs": {"drug"}}

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")
STAGE1_LIMIT = 400   # "starts with" candidates scored per search
STAGE2_LIMIT = 300   # "contains" candidates, only when stage 1 is thin
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]{3,}")


def db_path() -> Path:
    return Path(settings.TERMINOLOGY_DB_PATH)


# ---------------------------------------------------------------------------
# Writing (import CLI only)
# ---------------------------------------------------------------------------
@contextmanager
def writer() -> Iterator[sqlite3.Connection]:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    # Plain rollback-journal mode, so the app's read-only connections never need -wal/-shm files.
    # Switching modes needs exclusive access; if the app is reading right now, keep the current mode.
    try:
        conn.execute("PRAGMA journal_mode=DELETE")
    except sqlite3.OperationalError:
        pass
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA)
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


ConceptRow = Tuple[str, str, Optional[str], Sequence[Tuple[str, str]]]  # code, display, category, [(term, kind)]


def replace_system(conn: sqlite3.Connection, system: str, rows: Iterable[ConceptRow],
                   version: str, source_file: str, licence: str) -> Tuple[int, int]:
    """Replace every concept of `system` with `rows`. Returns (concepts, terms) imported."""
    conn.execute("DELETE FROM terms WHERE concept_id IN (SELECT id FROM concepts WHERE system = ?)", (system,))
    conn.execute("DELETE FROM concepts WHERE system = ?", (system,))
    n_concepts = n_terms = 0
    cur = conn.cursor()
    for code, display, category, names in rows:
        cur.execute(
            "INSERT OR IGNORE INTO concepts (system, code, display, category) VALUES (?, ?, ?, ?)",
            (system, code, display, category),
        )
        if not cur.rowcount:
            continue  # duplicate code in the release file
        concept_id = cur.lastrowid
        seen = set()
        for term, kind in names:
            key = term.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            cur.execute("INSERT INTO terms (concept_id, term, kind) VALUES (?, ?, ?)", (concept_id, term.strip(), kind))
            n_terms += 1
        n_concepts += 1
    conn.execute(
        "INSERT OR REPLACE INTO sources (system, version, source_file, concepts, terms, licence, imported_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (system, version, source_file, n_concepts, n_terms, licence, datetime.now(timezone.utc).isoformat()),
    )
    return n_concepts, n_terms


def replace_maps(conn: sqlite3.Connection, from_system: str, to_system: str,
                 rows: Iterable[Tuple[str, str, Optional[str]]]) -> int:
    conn.execute("DELETE FROM code_maps WHERE from_system = ? AND to_system = ?", (from_system, to_system))
    n = 0
    for from_code, to_code, to_display in rows:
        conn.execute(
            "INSERT OR IGNORE INTO code_maps (from_system, from_code, to_system, to_code, to_display) VALUES (?, ?, ?, ?, ?)",
            (from_system, from_code, to_system, to_code, to_display),
        )
        n += 1
    return n


def rebuild_indexes(conn: sqlite3.Connection) -> Dict[str, int]:
    """Rebuild full-text search and the spelling word list after any import."""
    from app.services.intellisense_engine import sound_key  # local import: avoids a cycle at startup

    conn.execute("INSERT INTO terms_fts(terms_fts) VALUES ('rebuild')")
    counts: Counter = Counter()
    for (term,) in conn.execute("SELECT term FROM terms"):
        for w in _WORD_RE.findall(term):
            if w.isalpha() or "-" in w or "'" in w:
                counts[w.lower()] += 1
    conn.execute("DELETE FROM words")
    conn.executemany(
        "INSERT INTO words (word, key, first, len, freq) VALUES (?, ?, ?, ?, ?)",
        ((w, k, k[:1], len(k), f) for w, f in counts.items() for k in (sound_key(w),) if k),
    )
    conn.execute("ANALYZE")
    return {"words": len(counts)}


# ---------------------------------------------------------------------------
# Reading (runtime)
# ---------------------------------------------------------------------------
class TerminologyStore:
    """Read-only access. One SQLite connection per thread (queries run in a thread pool)."""

    def __init__(self, path: Path):
        self.path = path
        self._local = threading.local()

    @property
    def available(self) -> bool:
        return self.path.is_file()

    def _conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(f"file:{self.path.as_posix()}?mode=ro", uri=True, check_same_thread=False)
            conn.execute("PRAGMA query_only=ON")
            conn.execute("PRAGMA cache_size=-8000")  # ~8 MB page cache per connection
            self._local.conn = conn
        return conn

    def status(self) -> Dict[str, Any]:
        if not self.available:
            return {"available": False, "sources": []}
        rows = self._conn().execute(
            "SELECT system, version, concepts, terms, imported_at FROM sources ORDER BY system"
        ).fetchall()
        return {
            "available": True,
            "sources": [
                {"system": s, "label": SYSTEM_LABELS.get(s, s), "version": v, "concepts": c, "terms": t, "imported_at": at}
                for s, v, c, t, at in rows
            ],
        }

    def search(self, query: str, systems: Sequence[str] = SEARCH_SYSTEMS, section: Optional[str] = None,
               limit: int = 8) -> List[Dict[str, Any]]:
        """Prefix search over every name of every concept. "chest p" -> Chest pain (SNOMED CT ...)."""
        if not self.available:
            return []
        tokens = [t.lower() for t in _TOKEN_RE.findall(query)]
        # A lone word needs 2+ characters; after another word one is enough ("Pan 4" -> Pan 40).
        if not tokens or (len(tokens) == 1 and len(tokens[0]) < 2):
            return []
        # One-letter words ("chest p") can't use the prefix index; they're checked in Python below.
        index_tokens = [t for t in tokens if len(t) >= 2] or tokens
        placeholders = ",".join("?" * len(systems))
        sql = f"""
            SELECT c.system, c.code, c.display, c.category, t.term, t.kind
            FROM terms_fts
            JOIN terms t ON t.id = terms_fts.rowid
            JOIN concepts c ON c.id = t.concept_id
            WHERE terms_fts MATCH ? AND c.system IN ({placeholders})
            LIMIT ?
        """
        conn = self._conn()
        # Stage 1: names that start with what the doctor typed (small, most relevant set).
        starts = '^"' + " ".join(index_tokens) + '"*' if index_tokens == tokens else '^"' + index_tokens[0] + '"*'
        rows = conn.execute(sql, (starts, *systems, STAGE1_LIMIT)).fetchall()
        # Stage 2: names containing all the typed words anywhere, only if stage 1 was thin.
        if len(rows) < limit * 4:
            anywhere = " ".join(f'"{t}"*' for t in index_tokens)
            rows += conn.execute(sql, (anywhere, *systems, STAGE2_LIMIT)).fetchall()

        typed = " ".join(tokens)
        preferred = SECTION_PREFERENCES.get(section or "", set())
        excluded = SECTION_EXCLUDES.get(section or "", set())
        obstetric = any(t.startswith(("pregn", "gestat", "neonat", "newborn", "fet", "infant", "perinat", "obstet", "labo"))
                        for t in tokens)
        best: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = {}
        for system, code, display, category, term, kind in rows:
            lower = term.lower()
            words = _TOKEN_RE.findall(lower)
            if not all(any(w.startswith(t) for w in words) for t in tokens):
                continue                                   # e.g. the one-letter word didn't match
            if category in excluded:
                continue
            score = 0.0
            if lower.startswith(typed):
                score += 6                                 # what the doctor is typing, from the start
            elif any(w.startswith(tokens[0]) for w in lower.split()[:1]):
                score += 2
            if kind in ("preferred", "alias"):
                score += 1.5
            if category in preferred:
                score += 3
            if system == "SNOMED_CT":
                score += 0.5                               # clinical notes vocabulary first
            score -= len(term) / 40                        # shorter, more general terms first
            if system in ("ICD_11", "ICD_10"):
                # Broader categories (1B1Z) before deep sub-codes (1B12.41).
                score -= 0.6 * code.count(".") + 0.3 * max(0, len(code.replace(".", "")) - 4)
                # Pregnancy (ICD-11 J*) and perinatal (K*) variants only when the doctor's words point there.
                if system == "ICD_11" and code[:1] in ("J", "K") and not obstetric:
                    score -= 2.5
            item = {
                "system": system, "code": code, "display": display, "category": category,
                "term": term, "label": SYSTEM_LABELS.get(system, system),
            }
            key = (system, code)
            if key not in best or score > best[key][0]:
                best[key] = (score, item)

        ranked = sorted(best.values(), key=lambda x: x[0], reverse=True)
        out: List[Dict[str, Any]] = []
        seen_names = set()
        for _, item in ranked:
            name = item["term"].lower()
            if name in seen_names:
                continue  # same wording from two systems: keep the higher-ranked one
            seen_names.add(name)
            out.append(item)
            if len(out) >= limit:
                break
        return out

    def map_codes(self, from_system: str, codes: Sequence[str], to_system: str) -> Dict[str, List[Dict[str, str]]]:
        if not self.available or not codes:
            return {}
        q = ",".join("?" * len(codes))
        rows = self._conn().execute(
            f"SELECT from_code, to_code, to_display FROM code_maps WHERE from_system = ? AND to_system = ? AND from_code IN ({q})",
            (from_system, to_system, *codes),
        ).fetchall()
        out: Dict[str, List[Dict[str, str]]] = {}
        for f, t, d in rows:
            out.setdefault(f, []).append({"system": to_system, "code": t, "display": d or ""})
        return out

    def is_known_word(self, lower: str) -> bool:
        if not self.available:
            return False
        return self._conn().execute("SELECT 1 FROM words WHERE word = ?", (lower,)).fetchone() is not None

    def english_word(self, lower: str) -> Optional[int]:
        """Frequency of an English word (0 = valid but rare), or None if not a known word."""
        if not self.available:
            return None
        try:
            row = self._conn().execute("SELECT freq FROM english_words WHERE word = ?", (lower,)).fetchone()
        except sqlite3.Error:
            return None
        return row[0] if row else None

    def english_candidates(self, key: str, length: int, limit: int = 3000) -> List[Tuple[str, str, int]]:
        """Common English words starting with the same sound and of similar length: (word, key, freq)."""
        if not self.available or not key:
            return []
        try:
            return self._conn().execute(
                "SELECT word, key, freq FROM english_words WHERE first = ? AND len BETWEEN ? AND ? AND freq > 0 "
                "ORDER BY freq DESC LIMIT ?",
                (key[0], length - 2, length + 2, limit),
            ).fetchall()
        except sqlite3.Error:
            return []

    def spelling_candidates(self, key: str, max_len_diff: int = 2, limit: int = 4000) -> List[Tuple[str, str]]:
        """Vocabulary words whose sound key starts with the same letter and has a similar length."""
        if not self.available or not key:
            return []
        return self._conn().execute(
            "SELECT word, key FROM words WHERE first = ? AND len BETWEEN ? AND ? ORDER BY freq DESC LIMIT ?",
            (key[0], len(key) - max_len_diff, len(key) + max_len_diff, limit),
        ).fetchall()


terminology = TerminologyStore(db_path())
