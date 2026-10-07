import os
from pydantic import BaseModel

class Settings(BaseModel):
    APP_NAME: str = "CareBridge India (SwasthyaSetu AI)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "carebridge-secure-hmac-key-india-abdm-2026")
    DEFAULT_TOKEN_TTL_SECONDS: int = 3600  # 60 minutes
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./carebridge.db")
    DEBUG: bool = True

settings = Settings()
