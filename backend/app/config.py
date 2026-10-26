import os
import secrets
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load `.env` from the current dir, backend dir, or workspace root (first one found).
# load_dotenv never overrides a value that is already set in the environment.
_dirs = [Path("."), Path(__file__).resolve().parent.parent, Path(__file__).resolve().parent.parent.parent]
for _dir in _dirs:
    if (_dir / ".env").is_file():
        load_dotenv(dotenv_path=_dir / ".env")
        break

class Settings(BaseModel):
    APP_NAME: str = "CareBridge India (SwasthyaSetu AI)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY") or secrets.token_hex(32)
    DEFAULT_TOKEN_TTL_SECONDS: int = int(os.getenv("DEFAULT_TOKEN_TTL_SECONDS", "3600"))
    # Neon Postgres: pooled URL for app traffic, direct (unpooled) URL for schema changes.
    # Falls back to local SQLite when no DATABASE_URL is set.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./carebridge.db")
    DATABASE_URL_UNPOOLED: str = os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./carebridge.db")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

    # Local clinical terminology store (SNOMED CT, ICD-11, LOINC, RxNorm, CDCI). Built by `python -m app.terminology`.
    TERMINOLOGY_DB_PATH: str = os.getenv(
        "TERMINOLOGY_DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "terminology.db")
    )

    # Consultation call minutes (speech-to-text + AI gap check). See docs/09_call_minutes.
    # SCRIBE_ASR_PROVIDER: "auto" = your Whisper server (SCRIBE_ASR_URL, e.g. the Colab gateway) when it is online,
    # else the scripted demo conversation; "stub" = always demo; "http" = always your server; "" = off.
    SCRIBE_ASR_PROVIDER: str = os.getenv("SCRIBE_ASR_PROVIDER", "auto").strip().lower()
    SCRIBE_ASR_URL: str = os.getenv("SCRIBE_ASR_URL", "")
    SCRIBE_ASR_MODEL: str = os.getenv("SCRIBE_ASR_MODEL", "whisper-large-v3")
    SCRIBE_ASR_LANGUAGE: str = os.getenv("SCRIBE_ASR_LANGUAGE", "")          # "" = auto-detect
    SCRIBE_ASR_TRANSLATE: bool = os.getenv("SCRIBE_ASR_TRANSLATE", "true").lower() in ("true", "1", "yes")
    SCRIBE_ASR_TIMEOUT_S: float = float(os.getenv("SCRIBE_ASR_TIMEOUT_S", "60"))
    # Minutes extraction: "" = built-in rules only, "local" = also your own Ollama model (INTELLISENSE_LOCAL_URL).
    SCRIBE_LLM_PROVIDER: str = os.getenv("SCRIBE_LLM_PROVIDER", "").strip().lower()
    SCRIBE_LLM_MODEL: str = os.getenv("SCRIBE_LLM_MODEL", "")

    # IntelliSense Tier 3 (self-hosted language-model completion; see docs/07_ai_intellisense_feature/07_*).
    # "" = off, "stub" = canned suggestions for development, "local" = your own Ollama server.
    INTELLISENSE_LLM_PROVIDER: str = os.getenv("INTELLISENSE_LLM_PROVIDER", "").strip().lower()
    INTELLISENSE_LLM_TIMEOUT_S: float = float(os.getenv("INTELLISENSE_LLM_TIMEOUT_S", "6"))
    INTELLISENSE_LLM_MAX_CONCURRENCY: int = int(os.getenv("INTELLISENSE_LLM_MAX_CONCURRENCY", "1"))
    INTELLISENSE_STUB_DELAY_MS: int = int(os.getenv("INTELLISENSE_STUB_DELAY_MS", "300"))
    INTELLISENSE_LOCAL_URL: str = os.getenv("INTELLISENSE_LOCAL_URL", "http://127.0.0.1:11434")
    INTELLISENSE_LOCAL_MODEL: str = os.getenv("INTELLISENSE_LOCAL_MODEL", "")
    INTELLISENSE_LOCAL_KEEP_ALIVE: str = os.getenv("INTELLISENSE_LOCAL_KEEP_ALIVE", "30m")
    INTELLISENSE_LOCAL_NUM_CTX: int = int(os.getenv("INTELLISENSE_LOCAL_NUM_CTX", "2048"))
    INTELLISENSE_LOCAL_NUM_THREAD: int = int(os.getenv("INTELLISENSE_LOCAL_NUM_THREAD", "0"))  # 0 = auto
    # How often the model server is health-checked. Raise it (e.g. 300) behind a tunnel with a request quota.
    INTELLISENSE_HEALTH_INTERVAL_S: int = int(os.getenv("INTELLISENSE_HEALTH_INTERVAL_S", "30"))

    # Shared secret for a remote AI gateway (e.g. the Colab GPU notebook in docs/10_remote_gpu_colab).
    # Sent as "Authorization: Bearer <token>" on every speech-to-text and language-model request.
    AI_GATEWAY_TOKEN: str = os.getenv("AI_GATEWAY_TOKEN", "").strip()
    # SETU-Shield (services/privacy_gateway.py): who runs the AI servers. "self_hosted" (ours, e.g. Colab) or
    # "third_party" (an outside API). Voice is never sent to a third party.
    AI_TEXT_DESTINATION: str = os.getenv("AI_TEXT_DESTINATION", "self_hosted").strip().lower()
    AI_SPEECH_DESTINATION: str = os.getenv("AI_SPEECH_DESTINATION", "self_hosted").strip().lower()

    # Text AI provider for every feature (services/ai_client.py): "ollama" (your server, the default when
    # INTELLISENSE_LOCAL_MODEL is set), "gemini", "openai" or "openai_compatible".
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "").strip().lower()
    AI_API_KEY: str = (os.getenv("AI_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
    AI_MODEL: str = os.getenv("AI_MODEL", "").strip()
    AI_API_BASE: str = os.getenv("AI_API_BASE", "").strip()
    AI_MAX_RPM: int = int(os.getenv("AI_MAX_RPM", "0"))          # requests per minute; 0 = provider default

settings = Settings()


def ai_headers() -> dict:
    """Headers for requests to our own AI servers (speech-to-text, Ollama)."""
    if not settings.AI_GATEWAY_TOKEN:
        return {}
    # The second header skips ngrok's browser warning page, which would otherwise replace the API response.
    return {"Authorization": f"Bearer {settings.AI_GATEWAY_TOKEN}", "ngrok-skip-browser-warning": "1"}
