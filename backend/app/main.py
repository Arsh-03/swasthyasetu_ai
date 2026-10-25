import json
from contextlib import asynccontextmanager
from typing import List, Dict
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.seed_data import seed_database
from app.routers import auth, consents, records, encounters, cdss, scribe, fhir, audit, translate, patients, appointments, careplan
from app.services.connection_manager import ws_manager
from app.services.auth_dependencies import decode_access_token

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
app.include_router(patients.router, prefix=settings.API_V1_STR)
app.include_router(appointments.router, prefix=settings.API_V1_STR)
app.include_router(careplan.router, prefix=settings.API_V1_STR)

@app.websocket("/ws/telehealth")
async def telehealth_signaling_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time WebRTC media signaling and consent notifications.
    """
    # Identify the user from their login token (?token=...), so call signaling can be
    # delivered to one person instead of every connected client.
    user_id = None
    token = websocket.query_params.get("token")
    if token:
        try:
            user_id = decode_access_token(token).get("sub")
        except HTTPException:
            user_id = None

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
            except json.JSONDecodeError:
                continue
            if not isinstance(data, dict):
                continue
            target = data.get("to")
            if target:
                # Targeted frame (call invite, WebRTC offer/answer/ICE, hang-up): only signed-in
                # senders may send these, and "from" is stamped by the server so it can't be faked.
                if not user_id:
                    continue
                data["from"] = user_id
                await ws_manager.send_to_user(str(target), data)
            else:
                # Untargeted frames keep the old broadcast behaviour (minus an echo to the sender)
                await ws_manager.broadcast(data, exclude=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "compliance": ["ABDM", "DPDP Act 2023", "NMC Telemedicine Guidelines 2020"]
    }
