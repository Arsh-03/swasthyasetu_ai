"""
Readings taken outside the clinic, shown to the doctor with who measured them.

  POST /api/v1/vitals                     (patient) save a reading (heart rate from the phone camera)
  GET  /api/v1/vitals/me                  (patient) my recent readings
  GET  /api/v1/vitals/patient/{id}        (doctor) a patient's recent readings
ASHA workers record readings on home visits through /api/v1/asha (asha.py), using save_readings() below.

Kinds: heart_rate (bpm), blood_pressure (systolic `value` / diastolic `value2`, mmHg), blood_sugar (mg/dL,
details.timing = fasting | random | after_food), temperature (°F, `value_f`), weight (kg, `value_f`).
Heart rate from the phone camera is an estimate for the doctor's reference, not a diagnosis.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.models import AuditEvent, Encounter, PatientProfile, VitalReading
from app.services.auth_dependencies import require_doctor, require_patient
from app.services.connection_manager import ws_manager
from app.services.notifications import doctors_for_patient, notify
from app.services.serializers import as_aware

router = APIRouter(prefix="/vitals", tags=["vitals"])

UNITS = {"heart_rate": "bpm", "blood_pressure": "mmHg", "blood_sugar": "mg/dL", "temperature": "°F", "weight": "kg"}
# Anything outside these is a measuring or typing error, not a reading.
LIMITS = {"heart_rate": (30, 220), "blood_pressure": (50, 260), "blood_sugar": (20, 600),
          "temperature": (90, 110), "weight": (2, 250)}
LABELS = {"heart_rate": "Heart rate", "blood_pressure": "BP", "blood_sugar": "Blood sugar",
          "temperature": "Temperature", "weight": "Weight"}


def assess(kind: str, value: float, value2: Optional[float] = None, details: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """'normal' | 'high' | 'low' | 'urgent', with a short reason. Thresholds follow common Indian NCD guidance."""
    d = details or {}
    if kind == "blood_pressure":
        sys, dia = value, value2 or 0
        if sys >= 180 or dia >= 120:
            return {"level": "urgent", "reason": "Very high BP (180/120 or above)"}
        if sys < 90 or (dia and dia < 60):
            return {"level": "low", "reason": "Low BP (below 90/60)"}
        if sys >= 140 or dia >= 90:
            return {"level": "high", "reason": "High BP (140/90 or above)"}
        return {"level": "normal", "reason": ""}
    if kind == "blood_sugar":
        if value < 70:
            return {"level": "urgent", "reason": "Low sugar (below 70): give sugar or a sweet drink now"}
        if value >= 300:
            return {"level": "urgent", "reason": "Very high sugar (300 or above)"}
        fasting = d.get("timing") == "fasting"
        if (fasting and value >= 126) or (not fasting and value >= 200):
            return {"level": "high", "reason": "High sugar" + (" (fasting 126 or above)" if fasting else " (200 or above)")}
        return {"level": "normal", "reason": ""}
    if kind == "temperature":
        if value >= 104 or value < 95:
            return {"level": "urgent", "reason": "Very high fever (104 °F or above)" if value >= 104 else "Very low temperature (below 95 °F)"}
        if value >= 100.4:
            return {"level": "high", "reason": "Fever (100.4 °F or above)"}
        return {"level": "normal", "reason": ""}
    if kind == "heart_rate":
        if value < 45 or value > 120:
            return {"level": "high" if value > 120 else "low", "reason": "Outside the usual resting range (45-120 bpm)"}
        return {"level": "normal", "reason": ""}
    return {"level": "normal", "reason": ""}


def display_value(r: VitalReading) -> str:
    if r.kind == "blood_pressure":
        return f"{r.value}/{r.value2}"
    if r.value_f is not None:
        return f"{r.value_f:g}"
    return str(r.value)


def reading_out(r: VitalReading) -> Dict[str, Any]:
    raw = r.value_f if r.value_f is not None else r.value
    a = assess(r.kind, raw, r.value2, r.details_json or {})
    return {
        "reading_id": r.reading_id,
        "kind": r.kind,
        "value": r.value,
        "value2": r.value2,
        "value_f": r.value_f,
        "display": display_value(r),
        "unit": r.unit,
        "method": r.method,
        "confidence": r.confidence,
        "details": r.details_json or {},
        "level": a["level"],
        "reason": a["reason"],
        "out_of_range": a["level"] != "normal",
        "recorded_by_role": r.recorded_by_role or "patient",
        "recorded_by_name": r.recorded_by_name,
        "created_at": as_aware(r.created_at),
    }


async def latest_heart_rate(db: AsyncSession, patient_id: str) -> Optional[Dict[str, Any]]:
    r = (await db.execute(select(VitalReading).where(VitalReading.patient_id == patient_id, VitalReading.kind == "heart_rate")
                          .order_by(desc(VitalReading.created_at)).limit(1))).scalars().first()
    return reading_out(r) if r else None


async def latest_by_kind(db: AsyncSession, patient_id: str) -> Dict[str, Dict[str, Any]]:
    rows = (await db.execute(select(VitalReading).where(VitalReading.patient_id == patient_id)
                             .order_by(desc(VitalReading.created_at)).limit(60))).scalars().all()
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        out.setdefault(r.kind, reading_out(r))
    return out


class ReadingItem(BaseModel):
    kind: str
    value: float
    value2: Optional[float] = None
    details: Dict[str, Any] = {}


def validate_item(item: ReadingItem) -> None:
    if item.kind not in LIMITS:
        raise HTTPException(status_code=422, detail=f"Unknown reading type: {item.kind}")
    lo, hi = LIMITS[item.kind]
    if not lo <= item.value <= hi:
        raise HTTPException(status_code=422, detail=f"{LABELS[item.kind]} {item.value:g} is not plausible. Please check and measure again.")
    if item.kind == "blood_pressure":
        if item.value2 is None or not 30 <= item.value2 <= 160 or item.value2 >= item.value:
            raise HTTPException(status_code=422, detail="BP needs two numbers, the top one higher (e.g. 130/85).")


async def save_readings(db: AsyncSession, patient_id: str, items: Sequence[ReadingItem], *, method: str,
                        recorded_by: str, recorded_by_role: str, recorded_by_name: str, confidence: Optional[str] = None,
                        task_id: Optional[str] = None, client_id: Optional[str] = None,
                        measured_at: Optional[datetime] = None) -> List[VitalReading]:
    """Store readings (not committed), with an audit event each. Caller commits, then calls announce()."""
    enc = (await db.execute(select(Encounter).where(
        Encounter.patient_id == patient_id, Encounter.status.in_(["queued", "in_progress"])
    ).order_by(Encounter.start_time))).scalars().first()
    rows = []
    for i, item in enumerate(items):
        validate_item(item)
        decimal = item.kind in ("temperature", "weight")
        keep = ("quality", "irregularity", "seconds", "beats", "torch", "channel", "timing", "pulse", "readings_averaged")
        row = VitalReading(
            patient_id=patient_id, kind=item.kind, unit=UNITS[item.kind], method=method, confidence=confidence,
            value=int(round(item.value)), value2=int(round(item.value2)) if item.value2 is not None else None,
            value_f=round(item.value, 1) if decimal else None,
            details_json={k: item.details[k] for k in keep if k in item.details},
            encounter_id=enc.encounter_id if enc else None, recorded_by=recorded_by, recorded_by_role=recorded_by_role,
            recorded_by_name=recorded_by_name, task_id=task_id,
            client_id=f"{client_id}:{i}" if client_id else None,
        )
        if measured_at:
            row.created_at = measured_at
        db.add(row)
        a = assess(item.kind, item.value, item.value2, item.details)
        shown = f"{int(item.value)}/{int(item.value2)}" if item.kind == "blood_pressure" else f"{item.value:g}"
        db.add(AuditEvent(actor_id=f"{recorded_by_role}:{recorded_by}" if recorded_by_role != "patient" else f"patient:{patient_id}",
                          action="VITAL_READING_RECORDED", resource_id=patient_id,
                          outcome="ALERT" if a["level"] != "normal" else "SUCCESS",
                          purpose=f"{LABELS[item.kind]} {shown} {UNITS[item.kind]} ({recorded_by_name or recorded_by_role})"))
        rows.append(row)
    return rows


async def announce(patient_id: str, rows: Sequence[VitalReading], who: str) -> List[Dict[str, Any]]:
    """Tell the patient's doctors: live update, plus a notification (urgent readings as alerts)."""
    async with AsyncSessionLocal() as s:
        doctors = await doctors_for_patient(s, patient_id)
        profile = await s.get(PatientProfile, patient_id)
    name = profile.full_name if profile else "A patient"
    outs = [reading_out(r) for r in rows]
    for out in outs:
        await ws_manager.send_to(doctors, {"type": "vitals_recorded", "patient_id": patient_id, **out})
    flagged = [o for o in outs if o["level"] != "normal"]
    summary = ", ".join(f"{LABELS[o['kind']]} {o['display']}" for o in outs)
    if any(o["level"] == "urgent" for o in flagged):
        await notify(kind="alert", severity="critical", practitioner_ids=doctors, title=f"{name}: {summary}",
                     body="; ".join(o["reason"] for o in flagged) + f". Measured by {who}.",
                     link={"page": "patient", "patient_id": patient_id})
    elif flagged:
        await notify(kind="alert", severity="warning", practitioner_ids=doctors, title=f"{name}: {summary}",
                     body="; ".join(o["reason"] for o in flagged) + f". Measured by {who}.",
                     link={"page": "patient", "patient_id": patient_id})
    elif who != "the patient":
        await notify(kind="system", severity="info", practitioner_ids=doctors, title=f"{name}: {summary}",
                     body=f"Measured by {who}.", link={"page": "patient", "patient_id": patient_id})
    return outs


# ---------------------------------------------------------------------------
# Patient's own readings (heart rate from the phone camera)
# ---------------------------------------------------------------------------
class ReadingIn(BaseModel):
    kind: str = "heart_rate"
    value: int
    unit: str = "bpm"
    method: str = Field("camera_ppg", pattern="^(camera_ppg|manual)$")
    confidence: Optional[str] = Field(None, pattern="^(good|fair)$")
    details: Dict[str, Any] = {}


@router.post("")
async def save_reading(req: ReadingIn, current_patient: Dict[str, Any] = Depends(require_patient),
                       db: AsyncSession = Depends(get_db)):
    if req.kind != "heart_rate":
        raise HTTPException(status_code=422, detail="Patients can save heart rate here; other readings come from an ASHA worker.")
    pid = current_patient["user_id"]
    rows = await save_readings(db, pid, [ReadingItem(kind="heart_rate", value=req.value, details=req.details)],
                               method=req.method, recorded_by=pid, recorded_by_role="patient",
                               recorded_by_name=None, confidence=req.confidence)
    await db.commit()
    for r in rows:
        await db.refresh(r)
    outs = await announce(pid, rows, "the patient")
    return outs[0]


@router.get("/me")
async def my_readings(limit: int = Query(10, le=50), current_patient: Dict[str, Any] = Depends(require_patient),
                      db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(VitalReading).where(VitalReading.patient_id == current_patient["user_id"])
                             .order_by(desc(VitalReading.created_at)).limit(limit))).scalars().all()
    return [reading_out(r) for r in rows]


@router.get("/patient/{patient_id}")
async def patient_readings(patient_id: str, limit: int = Query(30, le=100),
                           current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(VitalReading).where(VitalReading.patient_id == patient_id)
                             .order_by(desc(VitalReading.created_at)).limit(limit))).scalars().all()
    return [reading_out(r) for r in rows]
