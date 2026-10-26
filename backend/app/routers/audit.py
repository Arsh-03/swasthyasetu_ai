import hashlib
import hmac
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.config import settings
from app.models.models import Appointment, AuditEvent, Consent, Encounter, Practitioner, PatientProfile, RecordMetadata
from app.schemas.schemas import AuditEventOut
from app.services.auth_dependencies import get_current_user, require_doctor
from app.services.serializers import as_aware

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


# ---------------------------------------------------------------------------
# Filterable audit trail for the doctor portal
# ---------------------------------------------------------------------------

# Outcomes that mean something went wrong or needs a look (PENDING etc. are normal steps).
PROBLEM_OUTCOMES = {"DENIED", "ALERT", "REVOKED", "EXPIRED", "FAILED", "DECLINED", "BLOCKED", "REJECTED", "ERROR"}
AUDIT_CATEGORIES = ("appointments", "consultations", "messages", "consent_records", "alerts", "account")


def audit_category(action: str) -> str:
    if action.startswith("APPOINTMENT_"):
        return "appointments"
    if action == "VITAL_READING_RECORDED" or action.startswith("ASHA_READINGS"):
        return "consultations"
    if action == "ASHA_RECORDING_CONSENT_GIVEN":
        return "consent_records"
    if action.startswith("CHAT_"):
        return "alerts" if action == "CHAT_MESSAGE_URGENT" else "messages"
    if action in ("RECOVERY_CHECKIN",) or action.startswith("ALERT_") or action.startswith("UNAUTHORIZED_"):
        return "alerts"
    if action in ("SYMPTOM_INTAKE_SUBMITTED", "CARE_PLAN_SIGNED_AND_ISSUED", "NOTEPAD_DRAFT_SAVED",
                  "CONSULTATION_OPENED") or action.startswith("CALL_") or action.startswith("AI_"):
        return "consultations"
    if any(k in action for k in ("CONSENT", "ABHA", "RECORD", "DPDP", "VAULT", "MEDICAL_HISTORY")):
        return "consent_records"
    return "account"


@router.get("/events")
async def filtered_audit_trail(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    category: Optional[str] = Query(None, description="Comma-separated: " + ", ".join(AUDIT_CATEGORIES)),
    outcome: Optional[str] = Query(None, description="'ok' (success) or 'problem' (denied, alerts, revoked...)"),
    patient_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_doctor: Dict[str, Any] = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    """Audit events, newest first, with a category and a `link` to the page each one is about."""
    stmt = select(AuditEvent).order_by(desc(AuditEvent.timestamp))
    if start:
        stmt = stmt.where(AuditEvent.timestamp >= as_aware(start))
    if end:
        stmt = stmt.where(AuditEvent.timestamp < as_aware(end))
    logs = (await db.execute(stmt.limit(5000))).scalars().all()

    practitioners = {p.practitioner_id: p for p in (await db.execute(select(Practitioner))).scalars().all()}
    patients = {p.patient_id: p for p in (await db.execute(select(PatientProfile))).scalars().all()}
    records = {r.record_id: r for r in (await db.execute(select(RecordMetadata))).scalars().all()}
    encounters = {e.encounter_id: e.patient_id for e in (await db.execute(select(Encounter))).scalars().all()}
    appointments = {a.appointment_id: a.patient_id for a in (await db.execute(select(Appointment))).scalars().all()}
    consents = {c.consent_id: c.patient_id for c in (await db.execute(select(Consent))).scalars().all()}

    def subject(log: AuditEvent) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        """(patient_id, link) for the thing this event is about."""
        rid = log.resource_id
        if rid in encounters:
            return encounters[rid], {"page": "visit", "patient_id": encounters[rid], "encounter_id": rid}
        if rid in appointments:
            return appointments[rid], {"page": "patient", "patient_id": appointments[rid], "tab": "visits"}
        if rid in records:
            return records[rid].patient_id, {"page": "patient", "patient_id": records[rid].patient_id, "tab": "records"}
        if rid in consents:
            return consents[rid], {"page": "patient", "patient_id": consents[rid], "tab": "records"}
        if rid in patients:
            return rid, {"page": "patient", "patient_id": rid}
        actor = log.actor_id.split(":")[-1]
        if actor in patients:
            return actor, {"page": "patient", "patient_id": actor}
        return None, None

    def actor_label(actor_id: str) -> str:
        prefix, _, uid = actor_id.rpartition(":")
        if uid in practitioners:
            return practitioners[uid].display_name
        if uid in patients:
            return f"{patients[uid].full_name}{' (representative)' if prefix == 'representative' else ''}"
        return actor_id

    wanted = {c for c in (category or "").split(",") if c}
    needle = (q or "").strip().lower()
    counts: Dict[str, int] = {c: 0 for c in AUDIT_CATEGORIES}
    matched = []
    for log in logs:
        cat = audit_category(log.action)
        pid, link = subject(log)
        if patient_id and pid != patient_id:
            continue
        problem = log.outcome.upper() in PROBLEM_OUTCOMES
        if outcome == "ok" and problem or outcome == "problem" and not problem:
            continue
        actor = actor_label(log.actor_id)
        patient_name = patients[pid].full_name if pid in patients else None
        if needle and needle not in " ".join(
                filter(None, [log.action.lower().replace("_", " "), actor.lower(), (patient_name or "").lower(),
                              (log.purpose or "").lower(), log.resource_id.lower()])):
            continue
        counts[cat] += 1
        if wanted and cat not in wanted:
            continue
        matched.append({
            "event_id": log.event_id,
            "action": log.action,
            "category": cat,
            "outcome": log.outcome,
            "problem": problem,
            "timestamp": as_aware(log.timestamp),
            "actor_name": actor,
            "patient_id": pid,
            "patient_name": patient_name,
            "detail": log.purpose or "",
            "resource_id": log.resource_id,
            "link": link,
        })
    return {"items": matched[offset:offset + limit], "total": len(matched), "category_counts": counts}
