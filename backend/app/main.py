import json
from contextlib import asynccontextmanager
from typing import List, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.seed_data import seed_database
from app.routers import auth, consents, records, encounters, cdss, scribe, fhir, audit, translate
from app.services.connection_manager import ws_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed database
    await seed_database()
    yield
    # Shutdown

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

@app.websocket("/ws/telehealth")
async def telehealth_signaling_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time WebRTC media signaling and consent notifications.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
                # Broadcast signaling frames (offer, answer, candidate, consent_event, network_tier)
                await ws_manager.broadcast(data)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "compliance": ["ABDM", "DPDP Act 2023", "NMC Telemedicine Guidelines 2020"]
    }
