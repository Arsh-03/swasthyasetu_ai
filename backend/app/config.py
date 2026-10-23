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

settings = Settings()
