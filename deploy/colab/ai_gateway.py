"""CareBridge AI gateway: one token-protected endpoint for speech-to-text and the language model.

Runs next to the GPU (e.g. a Google Colab T4) and is exposed through a single tunnel.

  POST /v1/audio/transcriptions   faster-whisper, OpenAI-compatible (what SCRIBE_ASR_PROVIDER=http calls)
  POST /v1/audio/translations     same, translated to English
  *    /api/...                   passed through to the local Ollama server (Tier 3 + call minutes)
  GET  /health                    no token needed; reports nothing about patients

Nothing is written to disk and request bodies are never logged.

Environment:
  GATEWAY_TOKEN   required shared secret (the backend's AI_GATEWAY_TOKEN)
  WHISPER_MODEL   default "large-v3"
  WHISPER_DEVICE  "cuda" (default) or "cpu"
  OLLAMA_URL      default http://127.0.0.1:11434
"""
import asyncio
import hmac
import io
import os
import threading
import traceback

import httpx
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

TOKEN = os.environ.get("GATEWAY_TOKEN", "")
if len(TOKEN) < 16:
    raise SystemExit("Set GATEWAY_TOKEN to a random secret of at least 16 characters.")

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cuda")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
MAX_AUDIO_BYTES = 8 * 1024 * 1024

app = FastAPI(title="CareBridge AI gateway", docs_url=None, redoc_url=None, openapi_url=None)
_whisper = None
_whisper_error = ""                   # set when the startup self-test fails (e.g. missing CUDA libraries)
_whisper_lock = threading.Lock()      # one transcription at a time on the GPU
_ollama = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=5.0))


def _load_whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        compute = "float16" if WHISPER_DEVICE == "cuda" else "int8"
        _whisper = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=compute)
    return _whisper


def _self_test() -> None:
    """Run one second of silence through the full GPU + audio-decoding path, so problems show at startup."""
    global _whisper_error
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(bytes(32000))
    try:
        segments, _ = _load_whisper().transcribe(io.BytesIO(buf.getvalue()), beam_size=1, language="en")
        list(segments)
        _whisper_error = ""
    except Exception as exc:
        traceback.print_exc()
        _whisper_error = f"{type(exc).__name__}: {str(exc)[:200]}"


@app.on_event("startup")
async def _startup() -> None:
    await asyncio.to_thread(_self_test)


@app.middleware("http")
async def _require_token(request: Request, call_next):
    if request.url.path != "/health":
        sent = request.headers.get("authorization", "")
        if not hmac.compare_digest(sent.encode(), f"Bearer {TOKEN}".encode()):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/health")
async def health():
    try:
        ollama_ok = (await _ollama.get(f"{OLLAMA_URL}/api/version", timeout=3.0)).status_code == 200
    except httpx.HTTPError:
        ollama_ok = False
    return {"whisper": _whisper is not None and not _whisper_error, "whisper_model": WHISPER_MODEL,
            "whisper_error": _whisper_error or None, "ollama": ollama_ok}


def _run_whisper(audio: bytes, task: str, language: str | None):
    model = _load_whisper()
    with _whisper_lock:
        segments, info = model.transcribe(
            io.BytesIO(audio), task=task, language=language or None,
            beam_size=5, vad_filter=True, condition_on_previous_text=False,
        )
        segs = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
    return {
        "text": "".join(s["text"] for s in segs).strip(),
        "language": info.language,
        "duration": info.duration,
        "segments": segs,
    }


async def _audio_endpoint(task: str, file: UploadFile, language: str | None):
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio:
        return JSONResponse({"error": "empty audio"}, status_code=400)
    if len(audio) > MAX_AUDIO_BYTES:
        return JSONResponse({"error": "audio too large"}, status_code=413)
    try:
        return await asyncio.to_thread(_run_whisper, audio, task, language)
    except Exception as exc:  # undecodable audio etc.; the traceback goes to gateway.log, never the audio
        traceback.print_exc()
        return JSONResponse({"error": f"transcription failed: {type(exc).__name__}: {str(exc)[:200]}"},
                            status_code=422)


@app.post("/v1/audio/transcriptions")
async def transcriptions(file: UploadFile = File(...), model: str = Form(""), language: str = Form(""),
                         response_format: str = Form("json")):
    return await _audio_endpoint("transcribe", file, language)


@app.post("/v1/audio/translations")
async def translations(file: UploadFile = File(...), model: str = Form(""), response_format: str = Form("json")):
    return await _audio_endpoint("translate", file, None)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "DELETE"])
async def ollama_proxy(path: str, request: Request):
    """Pass-through to Ollama, streaming, so the backend can stop generation by closing the connection."""
    req = _ollama.build_request(
        request.method, f"{OLLAMA_URL}/api/{path}", content=await request.body(),
        headers={"content-type": request.headers.get("content-type", "application/json")},
    )
    try:
        upstream = await _ollama.send(req, stream=True)
    except httpx.HTTPError:
        return JSONResponse({"error": "ollama unavailable"}, status_code=502)
    return StreamingResponse(
        upstream.aiter_raw(), status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"), background=BackgroundTask(upstream.aclose),
    )

