"""
CareBridge Partner API v1: our consent layer, SETU-Shield and note parsing as a service for other apps.

Auth: `X-API-Key: cb_live_<prefix>_<secret>` (only the key's SHA-256 is stored). Each key has scopes and a
per-minute limit; every call is logged without bodies (partner_usage). Keys are made with
`python -m app.partner_admin create ...` and shown once.

Scopes
  consent:request   ask a patient (by ABHA address) for purpose-bound access; they decide in the CareBridge app
  consent:read      read a request's status (the grant token is returned once, after approval) and verify tokens
  privacy:deidentify  SETU-Shield: mask, generalise and verify any clinical text before it goes to an AI
  notes:parse       turn a free-text consultation note into structured data (CareBridge note format)
"""
import hashlib
import hmac
import json
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.models import AuditEvent, PartnerClient, PartnerConsent, PartnerKey, PartnerUsage, PatientProfile
from app.services import privacy_gateway as pg
from app.services.connection_manager import ws_manager
from app.services.deidentify import Deidentifier
from app.services.note_format import FORMAT_VERSION, parse_note
from app.services.serializers import as_aware

router = APIRouter(prefix="/partner/v1", tags=["Partner API v1"])

SCOPES = {
    "consent:request": "Ask a patient for purpose-bound access to their data",
    "consent:read": "Read consent status and verify grant tokens",
    "privacy:deidentify": "SETU-Shield de-identification of clinical text",
    "notes:parse": "Structured data from a consultation note",
}
DATA_TYPES = {"prescriptions", "lab_reports", "vitals", "visit_summaries", "allergies", "diagnoses", "imaging"}
_calls: Dict[str, Deque[float]] = defaultdict(deque)


def new_key() -> Dict[str, str]:
    prefix = secrets.token_hex(4)
    secret = secrets.token_urlsafe(24)
    full = f"cb_live_{prefix}_{secret}"
    return {"key": full, "prefix": prefix, "hash": hashlib.sha256(full.encode()).hexdigest()}


class Caller:
    def __init__(self, client: PartnerClient, key: PartnerKey):
        self.client, self.key = client, key
        self.scopes = set(key.scopes_json or [])


def require(scope: str):
    """Dependency: a valid, unrevoked key with this scope, inside its rate limit. Logs the call."""
    async def dep(request: Request, x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
                  db: AsyncSession = Depends(get_db)) -> Caller:
        if not x_api_key or not x_api_key.startswith("cb_live_"):
            raise HTTPException(status_code=401, detail="Missing or malformed X-API-Key")
        try:
            prefix = x_api_key.split("_")[2]
        except IndexError:
            raise HTTPException(status_code=401, detail="Malformed API key")
        key = (await db.execute(select(PartnerKey).where(PartnerKey.prefix == prefix))).scalars().first()
        if not key or key.revoked_at or not hmac.compare_digest(key.key_hash, hashlib.sha256(x_api_key.encode()).hexdigest()):
            raise HTTPException(status_code=401, detail="Invalid or revoked API key")
        client = await db.get(PartnerClient, key.client_id)
        if not client or client.status != "active":
            raise HTTPException(status_code=403, detail="Partner account is not active")
        if scope not in set(key.scopes_json or []):
            raise HTTPException(status_code=403, detail=f"This key lacks the '{scope}' scope")
        window = _calls[key.key_id]
        now = time.time()
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= (key.rate_per_min or 60):
            raise HTTPException(status_code=429, detail="Rate limit exceeded", headers={"Retry-After": "60"})
        window.append(now)
        key.last_used_at = datetime.now(timezone.utc)
        db.add(PartnerUsage(client_id=client.client_id, key_id=key.key_id, route=f"{request.method} {request.url.path}"[:120]))
        await db.commit()
        return Caller(client, key)
    return dep


# ----------------------------------------------------------------------------------------------------- account
@router.get("/me")
async def me(caller: Caller = Depends(require("consent:read")), db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=1)
    calls = (await db.execute(select(PartnerUsage).where(PartnerUsage.client_id == caller.client.client_id,
                                                         PartnerUsage.at >= since))).scalars().all()
    return {"client_id": caller.client.client_id, "name": caller.client.name, "org_type": caller.client.org_type,
            "scopes": sorted(caller.scopes), "rate_per_min": caller.key.rate_per_min, "calls_last_24h": len(calls)}


@router.get("/scopes")
async def scopes():
    return {"scopes": SCOPES, "data_types": sorted(DATA_TYPES), "note_format": FORMAT_VERSION}


# ----------------------------------------------------------------------------------------------------- consent
class ConsentIn(BaseModel):
    abha_address: str = Field(max_length=100)
    purpose: str = Field(min_length=5, max_length=255)
    data_types: List[str] = Field(default_factory=lambda: ["prescriptions"])
    valid_hours: int = Field(default=24, ge=1, le=24 * 30)
    external_ref: Optional[str] = Field(default=None, max_length=100)


def _consent_out(c: PartnerConsent, token: Optional[str] = None) -> Dict[str, Any]:
    out = {"consent_id": c.consent_id, "status": c.status, "purpose": c.purpose, "data_types": c.data_types_json or [],
           "valid_hours": c.valid_hours, "external_ref": c.external_ref, "created_at": as_aware(c.created_at),
           "decided_at": as_aware(c.decided_at), "expires_at": as_aware(c.expires_at)}
    if token:
        out["grant_token"] = token
    return out


@router.post("/consents", status_code=201)
async def request_consent(req: ConsentIn, caller: Caller = Depends(require("consent:request")),
                          db: AsyncSession = Depends(get_db)):
    bad = [d for d in req.data_types if d not in DATA_TYPES]
    if bad or not req.data_types:
        raise HTTPException(status_code=422, detail=f"Unknown data types: {bad}. Allowed: {sorted(DATA_TYPES)}")
    patient = (await db.execute(select(PatientProfile).where(PatientProfile.abha_address == req.abha_address.strip().lower()))).scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="No CareBridge patient with this ABHA address")
    c = PartnerConsent(consent_id=f"pc_{secrets.token_hex(6)}", client_id=caller.client.client_id,
                       patient_id=patient.patient_id, purpose=req.purpose.strip(),
                       data_types_json=req.data_types, valid_hours=req.valid_hours, external_ref=req.external_ref)
    db.add(c)
    db.add(AuditEvent(actor_id=f"partner:{caller.client.client_id}", action="PARTNER_CONSENT_REQUESTED",
                      resource_id=c.consent_id, outcome="SUCCESS", purpose=f"{caller.client.name}: {req.purpose[:120]}"))
    await db.commit()
    # The patient app shows it with the other consent requests (consents.py merges partner requests in).
    await ws_manager.send_to([patient.patient_id], {"type": "consent_request", "consent_id": c.consent_id,
                                                    "requester": caller.client.name, "purpose": c.purpose})
    return _consent_out(c)


@router.get("/consents/{consent_id}")
async def consent_status(consent_id: str, caller: Caller = Depends(require("consent:read")),
                         db: AsyncSession = Depends(get_db)):
    c = await db.get(PartnerConsent, consent_id)
    if not c or c.client_id != caller.client.client_id:
        raise HTTPException(status_code=404, detail="Consent request not found")
    if c.status == "approved" and c.expires_at and as_aware(c.expires_at) < datetime.now(timezone.utc):
        c.status = "expired"
        await db.commit()
    return _consent_out(c)


class VerifyIn(BaseModel):
    grant_token: str = Field(max_length=200)


@router.post("/consents/verify")
async def verify_grant(req: VerifyIn, caller: Caller = Depends(require("consent:read")), db: AsyncSession = Depends(get_db)):
    """Is this grant token valid right now, for what purpose and data? (Call before every use of the data.)"""
    h = hashlib.sha256(req.grant_token.encode()).hexdigest()
    c = (await db.execute(select(PartnerConsent).where(PartnerConsent.grant_token_hash == h))).scalars().first()
    if not c or c.client_id != caller.client.client_id:
        return {"valid": False, "reason": "unknown_token"}
    if c.status != "approved":
        return {"valid": False, "reason": c.status}
    if c.expires_at and as_aware(c.expires_at) < datetime.now(timezone.utc):
        c.status = "expired"
        await db.commit()
        return {"valid": False, "reason": "expired"}
    return {"valid": True, "consent_id": c.consent_id, "purpose": c.purpose, "data_types": c.data_types_json or [],
            "expires_at": as_aware(c.expires_at)}


# Called by consents.py when the patient decides or revokes in the CareBridge app.
async def apply_patient_decision(db: AsyncSession, consent: PartnerConsent, approved: Optional[bool], revoked: bool = False) -> Optional[str]:
    now = datetime.now(timezone.utc)
    token = None
    if revoked:
        consent.status = "revoked"          # the token hash stays, so verify can say "revoked"
        event = "consent.revoked"
    elif approved:
        token = f"cbg_{secrets.token_urlsafe(32)}"
        consent.status = "approved"
        consent.grant_token_hash = hashlib.sha256(token.encode()).hexdigest()
        consent.expires_at = now + timedelta(hours=consent.valid_hours or 24)
        event = "consent.approved"
    else:
        consent.status = "declined"
        event = "consent.declined"
    consent.decided_at = now
    db.add(AuditEvent(actor_id=f"patient:{consent.patient_id}", action=f"PARTNER_{event.split('.')[1].upper()}",
                      resource_id=consent.consent_id, outcome="SUCCESS" if approved else "DENIED"))
    await db.commit()
    client = await db.get(PartnerClient, consent.client_id)
    if client and client.webhook_url:
        payload = {"event": event, "consent": _consent_out(consent, token)}
        await _webhook(client, payload)
    elif token:
        _pending_tokens[consent.consent_id] = token          # no webhook: the next status read returns it once
    return token


_pending_tokens: Dict[str, str] = {}


@router.get("/consents/{consent_id}/token")
async def collect_token(consent_id: str, caller: Caller = Depends(require("consent:read")), db: AsyncSession = Depends(get_db)):
    """The grant token, once, for partners without a webhook."""
    c = await db.get(PartnerConsent, consent_id)
    if not c or c.client_id != caller.client.client_id:
        raise HTTPException(status_code=404, detail="Consent request not found")
    token = _pending_tokens.pop(consent_id, None)
    if not token:
        raise HTTPException(status_code=410, detail="No token waiting (not approved yet, or already collected)")
    return {"consent_id": consent_id, "grant_token": token, "expires_at": as_aware(c.expires_at)}


async def _webhook(client: PartnerClient, payload: Dict[str, Any]) -> None:
    body = json.dumps(payload, default=str, separators=(",", ":")).encode()
    sig = hmac.new((client.webhook_secret or "").encode(), body, hashlib.sha256).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=8.0) as http:
            await http.post(client.webhook_url, content=body, headers={"Content-Type": "application/json",
                                                                        "X-CareBridge-Signature": f"sha256={sig}"})
    except httpx.HTTPError:
        pass          # the partner can always read the status


# ----------------------------------------------------------------------------------------------------- SETU-Shield
class DeidIn(BaseModel):
    text: str = Field(max_length=20000)
    names: List[str] = Field(default_factory=list, max_length=50)
    places: List[str] = Field(default_factory=list, max_length=50)
    identifiers: List[str] = Field(default_factory=list, max_length=50)
    return_map: bool = False


@router.post("/privacy/deidentify")
async def deidentify(req: DeidIn, caller: Caller = Depends(require("privacy:deidentify"))):
    """Mask names (incl. misspellings), numbers, IDs, places and dates; band ages; then verify nothing is left."""
    shield = pg.Shield("partner", Deidentifier(req.names, [], req.places), req.identifiers, req.names + req.places)
    masked = shield.mask(req.text)
    leaks = shield.scan(masked)
    out = {"standard": pg.STANDARD, "text": masked, "removed": shield.deid.summary(), "verified": not leaks, "leaks": leaks}
    if req.return_map:
        out["restore_map"] = shield.deid.mapping          # keep it on your side; never send it to the AI
    return out


# ----------------------------------------------------------------------------------------------------- notes
class NoteIn(BaseModel):
    note: str = Field(max_length=20000)


@router.post("/notes/parse")
async def parse(req: NoteIn, caller: Caller = Depends(require("notes:parse"))):
    return parse_note(req.note)
