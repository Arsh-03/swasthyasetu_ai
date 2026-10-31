import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Dict
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import settings
from app.seed_data import seed_database
from app.routers import auth, consents, records, encounters, cdss, scribe, fhir, audit, translate, patients, appointments, careplan, intellisense, terminology, calls, doctor, chat, vitals, asha, privacy, lab, partner, care, hiecm
from app.routers.hiecm import ensure_hiecm_tables
from app.services.connection_manager import ws_manager
from app.services.auth_dependencies import decode_access_token
from app.services.llm_completion import completion_service

from sqlalchemy import text
from app.database import AsyncSessionLocal

async def _pool_warmup_keepalive():
    """Keeps connection pool warm and prevents Neon serverless compute cold-starts."""
    while True:
        try:
            await asyncio.sleep(45)
            async with AsyncSessionLocal() as s:
                await s.execute(text("SELECT 1"))
        except asyncio.CancelledError:
            break
        except Exception:
            pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed database (non-blocking if already initialized)
    try:
        await seed_database()
    except Exception as e:
        print(f"Startup notice: seed_database skipped: {e}")
    try:
        from app.care_network import ensure_care_network
        await ensure_care_network()
    except Exception as e:
        print(f"Startup notice: ensure_care_network skipped: {e}")
    try:
        await ensure_hiecm_tables()
    except Exception as e:
        print(f"Startup notice: ensure_hiecm_tables skipped: {e}")
    await completion_service.start()  # Tier 3 health checks (no-op when disabled)
    keepalive_task = asyncio.create_task(_pool_warmup_keepalive())
    yield
    # Shutdown
    keepalive_task.cancel()
    await completion_service.stop()

app = FastAPI(
    title=settings.APP_NAME,
    description="Digital Healthcare Infrastructure & Telemedicine Consent Layer for ABDM",
    version="1.0.0",
    lifespan=lifespan
)

# Response compression for payloads > 500 bytes (reduces transfer time over network)
app.add_middleware(GZipMiddleware, minimum_size=500)

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
app.include_router(intellisense.router, prefix=settings.API_V1_STR)
app.include_router(terminology.router, prefix=settings.API_V1_STR)
app.include_router(calls.router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(vitals.router, prefix=settings.API_V1_STR)
app.include_router(asha.router, prefix=settings.API_V1_STR)
app.include_router(privacy.router, prefix=settings.API_V1_STR)
app.include_router(lab.router, prefix=settings.API_V1_STR)
app.include_router(partner.router, prefix=settings.API_V1_STR)
app.include_router(care.router, prefix=settings.API_V1_STR)
app.include_router(hiecm.router, prefix="/api/hiecm")
app.include_router(hiecm.router, prefix=f"{settings.API_V1_STR}/hiecm")
app.include_router(calls.ws_router)
app.include_router(intellisense.ws_router)

CALL_RELAY_TYPES = {"call_invitation", "call_event"}   # used by the Doctor / Patient apps' call screens
_last_invited: Dict[str, str] = {}                     # doctor id -> patient id of their latest call invitation


@app.websocket("/ws/telehealth")
async def telehealth_notifications_ws(websocket: WebSocket):
    """
    Real-time notifications for the signed-in user (consent requests and decisions, appointments,
    history updates). First frame must be {"type": "AUTH", "token": ...}; each message goes only to the
    users it concerns. Clients may only send call signalling (CALL_RELAY_TYPES): a doctor's message goes
    to the patient it names, a patient's message to doctors, stamped with the sender's real identity.
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
    role = {"doctor": "doctor", "practitioner": "doctor"}.get(claims.get("role", ""), claims.get("role", ""))
    ws_manager.add(user_id, websocket, role)
    try:
        while True:
            try:
                msg = json.loads(await websocket.receive_text())
            except ValueError:
                continue
            if not isinstance(msg, dict) or msg.get("type") not in CALL_RELAY_TYPES:
                continue                             # anything else (e.g. fake consent events) is ignored
            if role == "doctor":
                # "call_ended" from the Doctor app names no patient: use the one this doctor last invited.
                patient_id = msg.get("patient_id") or _last_invited.get(user_id)
                if msg.get("type") == "call_invitation" and patient_id:
                    _last_invited[user_id] = patient_id
                if patient_id:
                    await ws_manager.send_to([patient_id], {**msg, "patient_id": patient_id, "doctor_id": user_id})
            elif role in ("patient", "representative"):
                await ws_manager.send_to_role("doctor", {**msg, "patient_id": user_id})
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
