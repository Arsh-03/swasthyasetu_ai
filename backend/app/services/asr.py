"""
Speech-to-text for consultation calls. Audio is processed in memory and never written to disk.

Providers (SCRIBE_ASR_PROVIDER):
  "stub"  A scripted demo consultation (Hindi / Kannada / English with English translations).
          No model needed: lets the whole minutes pipeline run on a laptop.
  "http"  Your own speech-to-text server exposing the common /v1/audio/transcriptions API
          (e.g. faster-whisper / speaches, whisper.cpp server, vLLM). Self-hosted only.
  ""      Off: recording can't be enabled.

Each speaker records their own microphone, so every chunk already belongs to one speaker:
no voice-based speaker separation is needed.
"""
import itertools
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

import httpx

from app.config import ai_headers, settings


@dataclass
class Segment:
    speaker: str                # "doctor" | "patient"
    start_ms: int
    end_ms: int
    text: str                   # as spoken (may be Hindi, Kannada, English or mixed)
    english: str                # English version used for analysis
    language: str = "en"

    def to_dict(self) -> Dict:
        return asdict(self)


class ASRError(Exception):
    pass


# A realistic demo consultation (fever / URTI), with code-mixed patient speech and an identifier
# the de-identifier must remove. Each audio chunk from a speaker yields their next line.
DEMO_SCRIPT = {
    "doctor": [
        ("Namaste Ramesh ji, tell me what problem you are facing today?", None, "en"),
        ("Since when do you have the fever? Does it come with chills?", None, "en"),
        ("Are you allergic to any medicine?", None, "en"),
        ("Are you taking any medicines regularly?", None, "en"),
        ("Take paracetamol 650 if the fever is above 100, drink plenty of fluids, and come back after 3 days if you are not better.",
         None, "en"),
    ],
    "patient": [
        ("Doctor, mujhe teen din se bukhar hai, gale mein dard hai aur khansi bhi hai.",
         "Doctor, I have had fever for three days, a sore throat and also a cough.", "hi"),
        ("Raat ko bukhar zyada ho jaata hai, aur sar dard bhi hai.",
         "The fever gets worse at night, and I also have a headache.", "hi"),
        ("Haan doctor, penicillin se mujhe rashes aate hain.",
         "Yes doctor, I get rashes from penicillin.", "hi"),
        ("Sugar ki goli leta hoon, metformin, roz subah. Mere pitaji ko bhi sugar thi.",
         "I take a sugar tablet, metformin, every morning. My father also had sugar.", "hi"),
        ("ಮೈ ಕೈ ನೋವು ಕೂಡ ಇದೆ. ನನ್ನ ನಂಬರ್ 98450 12345.",
         "I also have body ache. My number is 98450 12345.", "kn"),
    ],
}


class StubASR:
    name = "stub"

    def __init__(self):
        self._cursor: Dict[str, Dict[str, itertools.count]] = {}

    async def transcribe(self, session_id: str, speaker: str, audio: bytes, mime: str, offset_ms: int,
                         duration_ms: int) -> List[Segment]:
        counters = self._cursor.setdefault(session_id, {})
        n = next(counters.setdefault(speaker, itertools.count()))
        lines = DEMO_SCRIPT.get(speaker, [])
        if n >= len(lines):
            return []
        text, english, lang = lines[n]
        return [Segment(speaker, offset_ms, offset_ms + duration_ms, text, english or text, lang)]

    def forget(self, session_id: str) -> None:
        self._cursor.pop(session_id, None)

    async def health(self) -> bool:
        return True


class HttpASR:
    """Self-hosted server with the common /v1/audio/transcriptions (+ /translations) API."""
    name = "http"

    def __init__(self, base_url: str, model: str, language: str, translate: bool, timeout_s: float):
        self._base = base_url.rstrip("/")
        self._model = model
        self._language = language
        self._translate = translate
        self._client = httpx.AsyncClient(timeout=timeout_s, headers=ai_headers())

    async def _post(self, path: str, audio: bytes, mime: str, extra: Dict[str, str]) -> Dict:
        files = {"file": (f"chunk.{'webm' if 'webm' in mime else 'ogg'}", audio, mime)}
        data = {"model": self._model, "response_format": "verbose_json", **extra}
        try:
            res = await self._client.post(f"{self._base}{path}", files=files, data=data)
            res.raise_for_status()
            return res.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ASRError(f"speech-to-text server error: {type(exc).__name__}") from exc

    async def transcribe(self, session_id: str, speaker: str, audio: bytes, mime: str, offset_ms: int,
                         duration_ms: int) -> List[Segment]:
        extra = {"language": self._language} if self._language else {}
        result = await self._post("/v1/audio/transcriptions", audio, mime, extra)
        text = (result.get("text") or "").strip()
        if not text:
            return []
        language = (result.get("language") or self._language or "").lower()[:2] or "en"
        english = text
        if self._translate and language != "en":
            english = ((await self._post("/v1/audio/translations", audio, mime, {})).get("text") or text).strip()
        return [Segment(speaker, offset_ms, offset_ms + duration_ms, text, english, language)]

    def forget(self, session_id: str) -> None:
        return None

    async def health(self) -> bool:
        """Is the speech-to-text server reachable? (Any HTTP answer counts, except a tunnel's "offline" page.)"""
        try:
            res = await self._client.get(f"{self._base}/health", timeout=6.0)
        except httpx.HTTPError:
            return False
        return res.status_code < 500 and "ngrok-error-code" not in res.headers


def _build() -> Optional[object]:
    kind = settings.SCRIBE_ASR_PROVIDER
    if kind == "stub":
        return StubASR()
    if kind == "http" and settings.SCRIBE_ASR_URL:
        return HttpASR(settings.SCRIBE_ASR_URL, settings.SCRIBE_ASR_MODEL, settings.SCRIBE_ASR_LANGUAGE,
                       settings.SCRIBE_ASR_TRANSLATE, settings.SCRIBE_ASR_TIMEOUT_S)
    return None


asr = _build()


def asr_info() -> Dict[str, object]:
    return {"enabled": asr is not None, "provider": getattr(asr, "name", None)}
