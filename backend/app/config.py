import os
import secrets
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Search for .env in current directory, backend dir, or workspace root dir
env_candidates = [
    Path(".env"),
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env"
]
for env_candidate in env_candidates:
    if env_candidate.is_file():
        load_dotenv(dotenv_path=env_candidate)
        break

class Settings(BaseModel):
    APP_NAME: str = "CareBridge India (SwasthyaSetu AI)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY") or secrets.token_hex(32)
    DEFAULT_TOKEN_TTL_SECONDS: int = int(os.getenv("DEFAULT_TOKEN_TTL_SECONDS", "3600"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./carebridge.db")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

settings = Settings()
