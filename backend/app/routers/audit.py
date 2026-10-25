import hashlib
import hmac
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.config import settings
from app.models.models import AuditEvent, Practitioner, PatientProfile, RecordMetadata
from app.schemas.schemas import AuditEventOut
from app.services.auth_dependencies import get_current_user

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs", response_model=List[AuditEventOut])
async def get_audit_trail(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns immutable audit logs of all consent and record access actions (DPDP Act Compliance).
    Doctors see the full ledger; patients see only events about themselves.
    Actor and resource IDs are resolved to names, and each row carries an HMAC
    over its fields so tampering is detectable.
    """
    stmt = select(AuditEvent).order_by(desc(AuditEvent.timestamp)).limit(100)
    logs = (await db.execute(stmt)).scalars().all()

    practitioners = {p.practitioner_id: p for p in (await db.execute(select(Practitioner))).scalars().all()}
    patients = {p.patient_id: p for p in (await db.execute(select(PatientProfile))).scalars().all()}
    record_rows = (await db.execute(select(RecordMetadata))).scalars().all()
    records = {r.record_id: r.title for r in record_rows}
    record_owner = {r.record_id: r.patient_id for r in record_rows}

    def actor_name(actor_id: str) -> str:
        role_prefix = ""
        if ":" in actor_id:  # e.g. "patient:usr_ramesh_gowda"
            role_prefix, actor_id = actor_id.split(":", 1)
        if actor_id in practitioners:
            p = practitioners[actor_id]
            return f"{p.display_name} ({p.registration_number})"
        if actor_id in patients:
            label = "Representative" if role_prefix == "representative" else "Patient"
            return f"{patients[actor_id].full_name} ({label})"
        return actor_id

    def resource_label(resource_id: str) -> str:
        if resource_id in records:
            return f"{resource_id} ({records[resource_id]})"
        if resource_id in patients:
            return f"{resource_id} ({patients[resource_id].full_name})"
        return resource_id

    is_patient = current_user["role"] in ("patient", "representative")
    out = []
    for log in logs:
        if is_patient:
            mine = current_user["user_id"]
            about_me = (
                log.actor_id.split(":")[-1] == mine
                or log.resource_id == mine
                or record_owner.get(log.resource_id) == mine
            )
            if not about_me:
                continue
        signed = f"{log.event_id}|{log.actor_id}|{log.action}|{log.resource_id}|{log.outcome}|{log.timestamp}"
        sig = hmac.new(settings.SECRET_KEY.encode(), signed.encode(), hashlib.sha256).hexdigest()
        out.append(AuditEventOut(
            event_id=log.event_id,
            actor_id=log.actor_id,
            action=log.action,
            resource_id=log.resource_id,
            outcome=log.outcome,
            timestamp=log.timestamp,
            actor_name=actor_name(log.actor_id),
            resource_label=resource_label(log.resource_id),
            purpose=log.purpose,
            hmac_signature=f"hmac-sha256:{sig[:6]}...{sig[-4:]}",
        ))
    return out
