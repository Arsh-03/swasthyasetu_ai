"""
Clinical terminology API (local store only; no external lookups).

  GET /api/v1/terminology/status            Imported systems, versions and counts
  GET /api/v1/terminology/search?q=...       Prefix search across SNOMED CT / ICD-11 / LOINC / RxNorm / CDCI
"""
import asyncio
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query

from app.services.auth_dependencies import require_doctor
from app.terminology.store import SEARCH_SYSTEMS, terminology

router = APIRouter(prefix="/terminology", tags=["terminology"])

MAX_QUERY_WORDS = 4


def _with_mapped_codes(item: Dict[str, Any]) -> Dict[str, Any]:
    """Codes to attach when the doctor accepts a result: its own code, plus the ICD-10/ICD-11 counterpart."""
    codes = [{"system": item["system"], "code": item["code"], "display": item["display"]}]
    if item["system"] == "ICD_11":
        codes += terminology.map_codes("ICD_11", [item["code"]], "ICD_10").get(item["code"], [])[:1]
    return {**item, "codes": codes}


def notepad_search(query: str, section: Optional[str], limit: int = 5) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Search for what the doctor is typing. Tries the longest run of trailing words first, so
    "type 2 diab" matches "Type 2 diabetes mellitus" as a whole rather than just "diab".
    Returns (number of trailing words the results replace, results).
    """
    words = query.split()[-MAX_QUERY_WORDS:]
    fallback: Tuple[int, List[Dict[str, Any]]] = (1, [])
    for n in range(len(words), 0, -1):
        phrase = " ".join(words[-n:])
        results = terminology.search(phrase, SEARCH_SYSTEMS, section, limit)
        starting = [r for r in results if r["term"].lower().startswith(phrase.lower())]
        if starting:
            return n, [_with_mapped_codes(r) for r in starting]
        if n == 1:
            fallback = (1, [_with_mapped_codes(r) for r in results])
    return fallback


@router.get("/status")
async def terminology_status(current_doctor: Dict[str, Any] = Depends(require_doctor)):
    return await asyncio.to_thread(terminology.status)


@router.get("/search")
async def terminology_search(
    q: str = Query(..., min_length=2, max_length=200),
    section: Optional[str] = None,
    limit: int = Query(5, ge=1, le=25),
    current_doctor: Dict[str, Any] = Depends(require_doctor),
):
    span, results = await asyncio.to_thread(notepad_search, q, section, limit)
    return {"span_words": span, "results": results}
