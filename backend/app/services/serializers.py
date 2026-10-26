"""Shared helpers that turn database rows into the shapes the two frontends use."""
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

from app.models.models import Appointment, Consent

URGENCY_RANK = {"high": 0, "follow_up": 1, "routine": 2}


def as_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite returns naive datetimes; treat them as UTC so comparisons work everywhere."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def wait_label(since: Optional[datetime]) -> str:
    since = as_aware(since)
    if not since:
        return "Just joined"
    minutes = max(0, int((datetime.now(timezone.utc) - since).total_seconds() // 60))
    if minutes < 60:
        return f"{minutes}m wait"
    if minutes < 60 * 24:
        return f"{minutes // 60}h wait"
    return f"{minutes // (60 * 24)}d wait"


def remaining_label(expires_at: Optional[datetime]) -> Optional[str]:
    expires_at = as_aware(expires_at)
    if not expires_at:
        return None
    minutes = int((expires_at - datetime.now(timezone.utc)).total_seconds() // 60)
    return f"{minutes} mins remaining" if minutes > 0 else None


def consent_is_active(consent: Consent) -> bool:
    """An approved consent counts until its expiry time passes."""
    if consent.status != "approved":
        return False
    expires_at = as_aware(consent.expires_at)
    return expires_at is None or expires_at > datetime.now(timezone.utc)


def consent_display_status(consent: Consent) -> str:
    """'approved' | 'expired' | 'revoked' | 'declined' | 'requested'"""
    if consent.status == "approved" and not consent_is_active(consent):
        return "expired"
    return consent.status


def active_consent_for_record(consents: Iterable[Consent], record_id: str) -> Optional[Consent]:
    """Most recent live consent covering this record (or a blanket ABHA-link consent)."""
    live = [
        c for c in consents
        if consent_is_active(c) and c.record_id in (record_id, "all_abdm_records")
    ]
    live.sort(key=lambda c: as_aware(c.expires_at) or datetime.max.replace(tzinfo=timezone.utc), reverse=True)
    return live[0] if live else None


def appointment_to_dict(apt: Appointment) -> Dict[str, Any]:
    """Shape used by the doctor chart (UpcomingAppointment) and the patient home card."""
    return {
        "appointmentId": apt.appointment_id,
        "patientId": apt.patient_id,
        "date": apt.date_label,
        "time": apt.time_label,
        "relativeTime": apt.relative_label or "",
        "mode": apt.mode,
        "doctorName": apt.doctor_name or "",
        "specialty": apt.specialty or "",
        "facility": apt.facility or "",
        "agenda": apt.agenda or "",
        "status": apt.status,
        "instructionsForPatient": apt.instructions_json or [],
        "isRescheduled": bool(apt.is_rescheduled),
        "meetingCode": apt.meeting_code,
        "scheduledAt": as_aware(apt.scheduled_at).isoformat() if apt.scheduled_at else None,
        "durationMinutes": apt.duration_minutes or 20,
    }
