import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Dict
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.seed_data import seed_database
from app.routers import auth, consents, records, encounters, cdss, scribe, fhir, audit, translate, intellisense, terminology, calls
from app.services.connection_manager import ws_manager
from app.services.auth_dependencies import decode_access_token
from app.services.llm_completion import completion_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed database
    await seed_database()
    await completion_service.start()  # Tier 3 health checks (no-op when disabled)
    yield
    # Shutdown
    await completion_service.stop()

app = FastAPI(
    title=settings.APP_NAME,
    description="Digital Healthcare Infrastructure & Telemedicine Consent Layer for ABDM",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(consents.router, prefix=settings.API_V1_STR)
app.include_router(records.router, prefix=settings.API_V1_STR)
app.include_router(encounters.router, prefix=settings.API_V1_STR)
app.include_router(cdss.router, prefix=settings.API_V1_STR)
app.include_router(scribe.router, prefix=settings.API_V1_STR)
app.include_router(fhir.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(translate.router, prefix=settings.API_V1_STR)
app.include_router(intellisense.router, prefix=settings.API_V1_STR)
app.include_router(terminology.router, prefix=settings.API_V1_STR)
app.include_router(calls.router, prefix=settings.API_V1_STR)
app.include_router(calls.ws_router)
app.include_router(intellisense.ws_router)

@app.websocket("/ws/telehealth")
async def telehealth_notifications_ws(websocket: WebSocket):
    """
    Real-time notifications for the signed-in user (consent requests and decisions, history updates).
    First frame must be {"type": "AUTH", "token": ...}. Listen-only: messages from clients are ignored,
    so nobody can push events to other users.
    """
    await websocket.accept()
    try:
        first = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        token = first.get("token", "") if isinstance(first, dict) and first.get("type") == "AUTH" else ""
        claims = decode_access_token(token) if token else None
    except WebSocketDisconnect:
        return
    except (asyncio.TimeoutError, HTTPException, ValueError):
        claims = None
    user_id = (claims or {}).get("sub")
    if not user_id:
        await websocket.close(code=4401)
        return
    ws_manager.add(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()          # ignored (keep-alive only)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.remove(user_id, websocket)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "compliance": ["ABDM", "DPDP Act 2023", "NMC Telemedicine Guidelines 2020"]
    }
