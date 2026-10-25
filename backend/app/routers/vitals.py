"""
Readings patients take at home, shown to their doctor.

  POST /api/v1/vitals                     (patient) save a reading
  GET  /api/v1/vitals/me                  (patient) my recent readings
  GET  /api/v1/vitals/patient/{id}        (doctor) a patient's recent readings

Heart rate from the phone camera is an estimate for the doctor's reference, not a diagnosis. A resting
reading outside 45-120 bpm tells the doctor (a warning, not an emergency alert), and the patient app
advises calling 108 if they feel unwell.
"""
from typing import Any, Dict, Optional

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

LIMITS = {"heart_rate": (30, 220)}  # anything outside is a measuring error
RESTING_RANGE = {"heart_rate": (45, 120)}


def reading_out(r: VitalReading) -> Dict[str, Any]:
    lo, hi = RESTING_RANGE.get(r.kind, (None, None))
    return {
        "reading_id": r.reading_id,
        "kind": r.kind,
        "value": r.value,
        "unit": r.unit,
        "method": r.method,
        "confidence": r.confidence,
        "details": r.details_json or {},
        "out_of_range": lo is not None and not (lo <= r.value <= hi),
        "created_at": as_aware(r.created_at),
    }


async def latest_heart_rate(db: AsyncSession, patient_id: str) -> Optional[Dict[str, Any]]:
    r = (await db.execute(select(VitalReading).where(VitalReading.patient_id == patient_id, VitalReading.kind == "heart_rate")
                          .order_by(desc(VitalReading.created_at)).limit(1))).scalars().first()
    return reading_out(r) if r else None


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
    if req.kind not in LIMITS:
        raise HTTPException(status_code=422, detail="Unknown reading type")
    lo, hi = LIMITS[req.kind]
    if not lo <= req.value <= hi:
        raise HTTPException(status_code=422, detail="This reading is not plausible. Please measure again.")
    pid = current_patient["user_id"]
    enc = (await db.execute(select(Encounter).where(
        Encounter.patient_id == pid, Encounter.status.in_(["queued", "in_progress"])
    ).order_by(Encounter.start_time))).scalars().first()
    keep = ("quality", "irregularity", "seconds", "beats", "torch", "channel")
    reading = VitalReading(
        patient_id=pid, kind=req.kind, value=req.value, unit=req.unit, method=req.method, confidence=req.confidence,
        details_json={k: req.details[k] for k in keep if k in req.details}, encounter_id=enc.encounter_id if enc else None,
    )
    db.add(reading)
    lo_r, hi_r = RESTING_RANGE[req.kind]
    out_of_range = not (lo_r <= req.value <= hi_r)
    how = "camera estimate" if req.method == "camera_ppg" else "entered by patient"
    db.add(AuditEvent(actor_id=f"patient:{pid}", action="VITAL_READING_RECORDED", resource_id=pid,
                      outcome="ALERT" if out_of_range else "SUCCESS", purpose=f"Heart rate {req.value} bpm ({how})"))
    await db.commit()
    await db.refresh(reading)
    out = reading_out(reading)

    async with AsyncSessionLocal() as s:
        doctors = await doctors_for_patient(s, pid)
    await ws_manager.send_to(doctors, {"type": "vitals_recorded", "patient_id": pid, **out})
    if out_of_range:
        profile = await db.get(PatientProfile, pid)
        name = profile.full_name if profile else "A patient"
        await notify(kind="alert", severity="warning", practitioner_ids=doctors,
                     title=f"{name}: heart rate {req.value} bpm ({how})",
                     body="Outside the usual resting range (45-120 bpm). The patient was advised to call 108 if they feel unwell.",
                     link={"page": "patient", "patient_id": pid})
    return out


@router.get("/me")
async def my_readings(limit: int = Query(10, le=50), current_patient: Dict[str, Any] = Depends(require_patient),
                      db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(VitalReading).where(VitalReading.patient_id == current_patient["user_id"])
                             .order_by(desc(VitalReading.created_at)).limit(limit))).scalars().all()
    return [reading_out(r) for r in rows]


@router.get("/patient/{patient_id}")
async def patient_readings(patient_id: str, limit: int = Query(20, le=100),
                           current_doctor: Dict[str, Any] = Depends(require_doctor), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(VitalReading).where(VitalReading.patient_id == patient_id)
                             .order_by(desc(VitalReading.created_at)).limit(limit))).scalars().all()
    return [reading_out(r) for r in rows]
