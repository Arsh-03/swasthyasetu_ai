"""
Download the freely licensed clinical datasets and import them into the local terminology store.

    python scripts/fetch_open_datasets.py              # download what's missing, then import
    python scripts/fetch_open_datasets.py --only icd   # just one: icd | rxnorm | ddinter | english
    python scripts/fetch_open_datasets.py --refresh    # re-download even if files exist

Datasets (all downloadable without an account):
  - WHO ICD-11 MMS "Simple Tabulation" + ICD-10<->ICD-11 mapping tables (CC BY-ND 3.0 IGO)
  - NLM RxNorm "Current Prescribable Content" (no licence required)
  - DDInter 2.0 drug-drug interactions (CC BY-NC-SA 4.0: non-commercial use, attribution required)
  - English word lists for spell-check: FrequencyWords en_50k (CC BY-SA 4.0) + dwyl words_alpha (public domain)

SNOMED CT, LOINC and CDCI need accounts; import them by hand (docs/08_standards_integration).
Files are kept in backend/data/releases/ (git-ignored) so re-imports don't download again.
Uses only the Python standard library.
"""
import argparse
import re
import sys
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
RELEASES = BACKEND / "data" / "releases"
sys.path.insert(0, str(BACKEND))

ICD_PAGE = "https://icd.who.int/browse/latest-release/mms/en"
RXNORM_PAGE = "https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html"
DDINTER_BASE = "https://ddinter2.scbdd.com/static/media/download/ddinter_downloads_code_{}.csv"
DDINTER_CODES = "ABDHLPRV"
ENGLISH_FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt"
ENGLISH_WORDS_URL = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
HEADERS = {"User-Agent": "CareBridge-dataset-fetcher/1.0 (academic project)"}
READ_TIMEOUT_S = 60   # give up on a stalled connection after this long, then resume
MAX_ATTEMPTS = 8


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")


def download(url: str, dest: Path, refresh: bool) -> Path:
    if dest.exists() and dest.stat().st_size > 0 and not refresh:
        print(f"   have {dest.name}")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    if refresh and part.exists():
        part.unlink()
    print(f"   downloading {dest.name} ...", end="", flush=True)
    # Some release servers stall mid-download: retry, resuming from where the last attempt stopped.
    for attempt in range(1, MAX_ATTEMPTS + 1):
        have = part.stat().st_size if part.exists() else 0
        headers = dict(HEADERS, **({"Range": f"bytes={have}-"} if have else {}))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=READ_TIMEOUT_S) as r:
                resumed = have and r.status == 206
                with open(part, "ab" if resumed else "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
            break
        except OSError as exc:  # includes timeouts and dropped connections
            if attempt == MAX_ATTEMPTS:
                print()
                raise
            done = part.stat().st_size / 1e6 if part.exists() else 0
            print(f"\n   stalled at {done:.1f} MB ({exc}); retrying {attempt + 1}/{MAX_ATTEMPTS} ...", end="", flush=True)
    part.replace(dest)
    print(f" {dest.stat().st_size / 1e6:.1f} MB")
    return dest


def get_icd(refresh: bool) -> list:
    page = fetch_text(ICD_PAGE)
    tab = re.search(r'href="([^"]*SimpleTabulation-ICD-11-MMS-en\.zip)"', page)
    maps = re.search(r'href="([^"]*/mapping\.zip)"', page)
    if not tab or not maps:
        raise SystemExit("Couldn't find the ICD-11 release files on the WHO page; download them by hand (see docs).")
    release = re.search(r"releasefiles/([^/]+)/", tab.group(1))
    folder = RELEASES / "icd11" / (release.group(1) if release else "latest")
    t = download(tab.group(1), folder / "SimpleTabulation-ICD-11-MMS-en.zip", refresh)
    m = download(maps.group(1), folder / "mapping.zip", refresh)
    return ["icd", "--tabulation", str(t), "--map-10to11", str(m), "--map-11to10", str(m)]


def get_rxnorm(refresh: bool) -> list:
    page = fetch_text(RXNORM_PAGE)
    hit = re.search(r'href="([^"]*RxNorm_full_prescribe_(\d{2})(\d{2})(\d{4})\.zip)"', page)
    if not hit:
        raise SystemExit("Couldn't find the RxNorm prescribable release on the NLM page; download it by hand.")
    url, mm, dd, yyyy = hit.groups()
    z = download(url, RELEASES / "rxnorm" / url.rsplit("/", 1)[1], refresh)
    return ["rxnorm", str(z), "--version", f"{yyyy}-{mm}-{dd}"]


def get_ddinter(refresh: bool) -> list:
    folder = RELEASES / "ddinter"
    for code in DDINTER_CODES:
        download(DDINTER_BASE.format(code), folder / f"ddinter_downloads_code_{code}.csv", refresh)
    return ["ddinter", str(folder), "--version", "2.0"]


def get_english(refresh: bool) -> list:
    folder = RELEASES / "english"
    freq = download(ENGLISH_FREQ_URL, folder / "en_50k.txt", refresh)
    words = download(ENGLISH_WORDS_URL, folder / "words_alpha.txt", refresh)
    return ["english", "--freq", str(freq), "--words", str(words)]


SOURCES = {"icd": get_icd, "rxnorm": get_rxnorm, "ddinter": get_ddinter, "english": get_english}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", choices=sorted(SOURCES), action="append", help="Limit to one dataset (repeatable)")
    ap.add_argument("--refresh", action="store_true", help="Download again even if the files exist")
    args = ap.parse_args()

    from app.terminology.__main__ import main as terminology_cli  # after sys.path is set

    failed = []
    for name in args.only or list(SOURCES):
        print(f"==> {name}")
        try:
            terminology_cli(SOURCES[name](args.refresh))
        except (OSError, SystemExit) as exc:  # network problems shouldn't stop the other datasets
            print(f"   !! {name} failed: {exc}")
            failed.append(name)
    print()
    terminology_cli(["status"])
    if failed:
        print(f"\nNot imported: {', '.join(failed)}. Check your internet connection and run again.")
        return 1
    print("\nDDInter data is CC BY-NC-SA 4.0: non-commercial use only; credit DDInter where alerts are shown.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
