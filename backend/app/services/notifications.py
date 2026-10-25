"""
Doctor bell notifications: stored (so they survive a reload) and pushed live over the WebSocket.

Each notification carries a `link` the portal opens on click, e.g.
  {"page": "patient", "patient_id": "...", "tab": "visits"}
  {"page": "meeting", "appointment_id": "..."}
The event behind a notification is also in the audit trail (the caller writes that AuditEvent).
"""
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.models import Appointment, Encounter, Notification, Practitioner
from app.services.connection_manager import ws_manager


def notification_to_dict(n: Notification) -> Dict[str, Any]:
    return {
        "notification_id": n.notification_id,
        "kind": n.kind,
        "severity": n.severity,
        "title": n.title,
        "body": n.body or "",
        "link": n.link_json or {},
        "created_at": n.created_at,
        "read": n.read_at is not None,
    }


async def doctors_for_patient(session, patient_id: str) -> list[str]:
    """Doctors with an appointment or consultation for this patient; every doctor if there are none."""
    ids = set((await session.execute(
        select(Appointment.practitioner_id).where(Appointment.patient_id == patient_id))).scalars())
    ids |= set((await session.execute(
        select(Encounter.practitioner_id).where(Encounter.patient_id == patient_id))).scalars())
    ids.discard(None)
    if not ids:
        ids = set((await session.execute(select(Practitioner.practitioner_id))).scalars())
    return sorted(ids)


async def notify(
    *,
    kind: str,
    title: str,
    body: str = "",
    severity: str = "info",
    link: Optional[Dict[str, Any]] = None,
    practitioner_ids: Optional[Iterable[str]] = None,
    patient_id: Optional[str] = None,
) -> None:
    """Store a notification for each doctor (given, or the patient's doctors) and push it live.
    Never raises: a failed notification must not fail the request that caused it."""
    try:
        async with AsyncSessionLocal() as session:
            if practitioner_ids is None:
                practitioner_ids = await doctors_for_patient(session, patient_id) if patient_id else []
            rows = [
                Notification(practitioner_id=pid, kind=kind, severity=severity, title=title[:200],
                             body=body, link_json=link or {})
                for pid in practitioner_ids if pid
            ]
            session.add_all(rows)
            await session.commit()
            for n in rows:
                await ws_manager.send_to([n.practitioner_id], {"type": "notification", **notification_to_dict(n)})
    except Exception as exc:  # noqa: BLE001
        print(f"[notifications] could not store notification '{title}': {exc}")
