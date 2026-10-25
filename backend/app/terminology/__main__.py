"""
Terminology import CLI. Run from the backend folder:

  python -m app.terminology status
  python -m app.terminology icd --tabulation SimpleTabulation-ICD-11-MMS-en.zip \\
        --map-10to11 mapping.zip --map-11to10 mapping.zip
  python -m app.terminology rxnorm RxNorm_full_prescribe_10052026.zip --version 2026-10-05
  python -m app.terminology snomed SnomedCT_Release.zip [--all-hierarchies]
  python -m app.terminology loinc Loinc_2.80.zip --version 2.80

The official release zips can be passed directly (only the needed files are extracted, to a temporary
folder that is deleted afterwards). Already-extracted files and folders work too.
  python -m app.terminology csv cdci.csv --system CDCI --code-col "CDCI Code" --name-col "Drug Name" \\
        --synonym-cols "Brand Name" --category drug --version 2026-01 --licence "NRCeS CDCI"
  python -m app.terminology remove LOINC

Imports run offline and replace that system's previous data. The app only reads the result.
"""
import argparse
import sys
import tempfile
import time
import zipfile
from fnmatch import fnmatch
from pathlib import Path

from app.terminology import importers
from typing import Optional

from app.terminology.store import db_path, rebuild_indexes, terminology, writer


def _existing_file(p: str) -> Path:
    path = Path(p)
    if not path.exists():
        raise argparse.ArgumentTypeError(f"not found: {p}")
    return path


def _from_zip(path: Optional[Path], pattern: str, tmp: Path, many: bool = False) -> Optional[Path]:
    """If `path` is a zip, extract the member(s) matching `pattern` into `tmp` and return the file
    (or, with many=True, the folder they were extracted to). Other paths are returned unchanged."""
    if path is None or path.suffix.lower() != ".zip":
        return path
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if fnmatch(n.lower(), pattern.lower()) and not n.endswith("/")]
        if not names:
            raise SystemExit(f"{path.name}: no file matching '{pattern}' inside the zip")
        dest = tmp / path.stem
        for n in (names if many else names[:1]):
            z.extract(n, dest)
        return dest if many else dest / names[0]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.terminology", description="Import official clinical terminologies.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="Show imported terminologies")

    p = sub.add_parser("icd", help="WHO ICD-11 MMS (+ ICD-10 and ICD-10<->11 maps)")
    p.add_argument("--tabulation", type=_existing_file, required=True, help="SimpleTabulation-ICD-11-MMS-en.txt")
    p.add_argument("--map-10to11", type=_existing_file, help="10To11MapToOneCategory.txt")
    p.add_argument("--map-11to10", type=_existing_file, help="11To10MapToOneCategory.txt")

    p = sub.add_parser("rxnorm", help="NLM RxNorm RXNCONSO.RRF")
    p.add_argument("file", type=_existing_file)
    p.add_argument("--version", required=True)

    p = sub.add_parser("snomed", help="SNOMED CT RF2 Snapshot folder")
    p.add_argument("folder", type=_existing_file)
    p.add_argument("--version")
    p.add_argument("--all-hierarchies", action="store_true", help="Include every hierarchy, not only clinical ones")

    p = sub.add_parser("loinc", help="LOINC table Loinc.csv")
    p.add_argument("file", type=_existing_file)
    p.add_argument("--version", required=True)
    p.add_argument("--all-classes", action="store_true", help="Include claims attachments and surveys")

    p = sub.add_parser("csv", help="Any catalogue as CSV (e.g. CDCI)")
    p.add_argument("file", type=_existing_file)
    p.add_argument("--system", required=True, help="System id, e.g. CDCI")
    p.add_argument("--code-col", required=True)
    p.add_argument("--name-col", required=True)
    p.add_argument("--synonym-cols", default="", help="Comma-separated column names")
    p.add_argument("--category", default="drug")
    p.add_argument("--version", required=True)
    p.add_argument("--licence", default="")
    p.add_argument("--delimiter", default=",")

    p = sub.add_parser("ddinter", help="DDInter 2.0 interaction CSVs (files, a folder, or a zip)")
    p.add_argument("paths", type=_existing_file, nargs="+")
    p.add_argument("--version", required=True)

    p = sub.add_parser("english", help="English word lists for spell-check")
    p.add_argument("--freq", type=_existing_file, required=True, help="en_50k.txt (word count per line)")
    p.add_argument("--words", type=_existing_file, help="words_alpha.txt (one word per line)")

    p = sub.add_parser("remove", help="Remove one system")
    p.add_argument("system")

    args = ap.parse_args(argv)

    if args.cmd == "status":
        st = terminology.status()
        print(f"Database: {db_path()} ({'present' if st['available'] else 'not created yet'})")
        if st["available"]:
            print(f"Size: {db_path().stat().st_size / 1e6:.1f} MB")
        for s in st["sources"]:
            print(f"  {s['label']:<10} {s['version']:<28} {s['concepts']:>8} concepts {s['terms']:>9} terms  ({s['imported_at'][:19]})")
        return 0

    started = time.time()
    with tempfile.TemporaryDirectory(prefix="terminology-import-") as tmp_name, writer() as conn:
        tmp = Path(tmp_name)
        if args.cmd == "icd":
            result = importers.import_icd(
                conn,
                _from_zip(args.tabulation, "*SimpleTabulation*.txt", tmp),
                _from_zip(args.map_10to11, "*10To11MapToOneCategory.txt", tmp),
                _from_zip(args.map_11to10, "*11To10MapToOneCategory.txt", tmp),
            )
        elif args.cmd == "rxnorm":
            result = importers.import_rxnorm(conn, _from_zip(args.file, "*RXNCONSO.RRF", tmp), args.version)
        elif args.cmd == "snomed":
            folder = _from_zip(args.folder, "*Snapshot*/*.txt", tmp, many=True)
            result = importers.import_snomed(conn, folder, args.version, args.all_hierarchies)
        elif args.cmd == "loinc":
            result = importers.import_loinc(conn, _from_zip(args.file, "*Loinc.csv", tmp), args.version, args.all_classes)
        elif args.cmd == "ddinter":
            files = []
            for p in args.paths:
                if p.is_dir():
                    files += sorted(p.glob("ddinter_downloads_code_*.csv"))
                elif p.suffix.lower() == ".zip":
                    files += sorted(_from_zip(p, "*ddinter_downloads_code_*.csv", tmp, many=True).rglob("*.csv"))
                else:
                    files.append(p)
            if not files:
                raise SystemExit("No ddinter_downloads_code_*.csv files found")
            result = importers.import_ddinter(conn, files, args.version)
        elif args.cmd == "english":
            result = importers.import_english(conn, args.freq, args.words)
        elif args.cmd == "csv":
            cols = [c.strip() for c in args.synonym_cols.split(",") if c.strip()]
            result = importers.import_csv(conn, args.file, args.system, args.code_col, args.name_col, cols,
                                          args.category, args.version, args.licence, args.delimiter)
        else:  # remove
            conn.execute("DELETE FROM terms WHERE concept_id IN (SELECT id FROM concepts WHERE system = ?)", (args.system,))
            conn.execute("DELETE FROM concepts WHERE system = ?", (args.system,))
            conn.execute("DELETE FROM code_maps WHERE from_system = ? OR to_system = ?", (args.system, args.system))
            conn.execute("DELETE FROM sources WHERE system = ?", (args.system,))
            conn.execute("DELETE FROM interactions WHERE source = ?", (args.system,))
            conn.execute("DELETE FROM interaction_drugs WHERE source = ?", (args.system,))
            result = {"removed": args.system}
        print("Rebuilding search index ...", flush=True)
        result.update(rebuild_indexes(conn))
    for k, v in result.items():
        print(f"  {k}: {v}")
    print(f"Done in {time.time() - started:.0f}s. Database: {db_path()} ({db_path().stat().st_size / 1e6:.1f} MB)")
    print("The running backend picks up the new data on its next lookup; no restart needed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
