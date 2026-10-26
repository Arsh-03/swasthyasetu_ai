"""
ASHA worker (community health worker) API: home-visit readings for patients who have no device of their own.

  GET  /api/v1/asha/me                       her profile
  GET  /api/v1/asha/tasks                    doctors' requests waiting for her (e.g. "BP before Thursday")
  GET  /api/v1/asha/patients?q=              patients she can record for (search by name, phone or ABHA)
  GET  /api/v1/asha/patients/{id}            one patient: consent status, open requests, recent readings
  POST /api/v1/asha/consent                  the patient agrees she may add readings (asked once, 90 days)
  POST /api/v1/asha/readings                 save readings from a visit (safe to re-send after being offline)

The patient's consent is required before anything is recorded, and every step is in the audit trail.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    AuditEvent, CareTask, HealthWorker, PatientProfile, Practitioner, User, VitalReading, WorkerConsent,
)
from app.routers.vitals import ReadingItem, announce, assess, reading_out, save_readings
from app.services.auth_dependencies import require_asha
from app.services.serializers import as_aware

router = APIRouter(prefix="/asha", tags=["asha"])

CONSENT_DAYS = 90


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _worker(db: AsyncSession, current: Dict[str, Any]) -> HealthWorker:
    w = await db.get(HealthWorker, current["user_id"])
    if not w:
        raise HTTPException(status_code=403, detail="Health worker profile not found.")
    return w


async def _active_consent(db: AsyncSession, patient_id: str, worker_id: str) -> Optional[WorkerConsent]:
    rows = (await db.execute(select(WorkerConsent).where(
        WorkerConsent.patient_id == patient_id, WorkerConsent.worker_id == worker_id, WorkerConsent.revoked_at.is_(None),
    ).order_by(desc(WorkerConsent.granted_at)))).scalars().all()
    now = now_utc()
    return next((c for c in rows if not c.expires_at or as_aware(c.expires_at) > now), None)


def _patient_brief(p: PatientProfile, user: Optional[User]) -> Dict[str, Any]:
    demo = p.demographics_json or {}
    chart = p.chart_json or {}
    return {
        "patient_id": p.patient_id, "full_name": p.full_name, "age": demo.get("age"), "gender": demo.get("gender"),
        "district": demo.get("district"), "phone_number": (user.phone_number if user else "") or "",
        "preferred_language": p.preferred_language or "kn", "avatar_url": p.avatar_url,
        "conditions": [c.get("name") for c in chart.get("chronicConditions", []) if c.get("status") != "Resolved"][:3],
    }


def _task_out(t: CareTask, doctor: Optional[Practitioner]) -> Dict[str, Any]:
    return {
        "task_id": t.task_id, "patient_id": t.patient_id, "kinds": t.kinds_json or [], "note": t.note or "",
        "due_at": as_aware(t.due_at), "status": t.status, "doctor_name": doctor.display_name if doctor else None,
        "created_at": as_aware(t.created_at),
    }


@router.get("/me")
async def me(current: Dict[str, Any] = Depends(require_asha), db: AsyncSession = Depends(get_db)):
    w = await _worker(db, current)
    return {"worker_id": w.worker_id, "display_name": w.display_name, "worker_code": w.worker_code,
            "area": w.area, "facility": w.facility}


@router.get("/tasks")
async def my_tasks(current: Dict[str, Any] = Depends(require_asha), db: AsyncSession = Depends(get_db)):
    w = await _worker(db, current)
    tasks = (await db.execute(select(CareTask).where(
        CareTask.status == "open", or_(CareTask.worker_id == w.worker_id, CareTask.worker_id.is_(None)),
    ).order_by(CareTask.due_at))).scalars().all()
    out = []
    for t in tasks:
        p = await db.get(PatientProfile, t.patient_id)
        if not p:
            continue
        u = await db.get(User, t.patient_id)
        d = await db.get(Practitioner, t.practitioner_id) if t.practitioner_id else None
        out.append({**_task_out(t, d), "patient": _patient_brief(p, u),
                    "consent": (await _active_consent(db, t.patient_id, w.worker_id)) is not None})
    return out


@router.get("/patients")
async def find_patients(q: str = Query("", max_length=60), current: Dict[str, Any] = Depends(require_asha),
                        db: AsyncSession = Depends(get_db)):
    """Patients with an open request for her, plus a search (name, phone or ABHA; at least 3 characters)."""
    w = await _worker(db, current)
    term = q.strip()
    if len(term) >= 3:
        like = f"%{term}%"
        rows = (await db.execute(select(PatientProfile, User).join(User, User.user_id == PatientProfile.patient_id).where(
            or_(PatientProfile.full_name.ilike(like), PatientProfile.abha_address.ilike(like), User.phone_number.ilike(like))
        ).limit(50))).all()
        # Only patients in her area, or ones a doctor asked her to visit: she can't browse the whole registry.
        area = (w.area or "").split(",")[0].strip().lower()
        asked = set((await db.execute(select(CareTask.patient_id).where(
            CareTask.status == "open", or_(CareTask.worker_id == w.worker_id, CareTask.worker_id.is_(None))))).scalars())
        rows = [(p, u) for p, u in rows
                if p.patient_id in asked or (area and area in str((p.demographics_json or {}).get("district", "")).lower())][:20]
    else:
        ids = set((await db.execute(select(CareTask.patient_id).where(
            CareTask.status == "open", or_(CareTask.worker_id == w.worker_id, CareTask.worker_id.is_(None))))).scalars())
        ids |= set((await db.execute(select(VitalReading.patient_id).where(VitalReading.recorded_by == w.worker_id))).scalars())
        rows = (await db.execute(select(PatientProfile, User).join(User, User.user_id == PatientProfile.patient_id)
                                 .where(PatientProfile.patient_id.in_(list(ids) or [""])))).all()
    return [_patient_brief(p, u) for p, u in rows]


@router.get("/patients/{patient_id}")
async def patient_for_visit(patient_id: str, current: Dict[str, Any] = Depends(require_asha),
                            db: AsyncSession = Depends(get_db)):
    w = await _worker(db, current)
    p = await db.get(PatientProfile, patient_id)
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    u = await db.get(User, patient_id)
    consent = await _active_consent(db, patient_id, w.worker_id)
    tasks = (await db.execute(select(CareTask).where(CareTask.patient_id == patient_id, CareTask.status == "open",
                                                     or_(CareTask.worker_id == w.worker_id, CareTask.worker_id.is_(None)))
                              .order_by(CareTask.due_at))).scalars().all()
    # Only readings she took herself: she has no access to the rest of the record.
    mine = (await db.execute(select(VitalReading).where(VitalReading.patient_id == patient_id, VitalReading.recorded_by == w.worker_id)
                             .order_by(desc(VitalReading.created_at)).limit(10))).scalars().all()
    docs = {}
    for t in tasks:
        if t.practitioner_id and t.practitioner_id not in docs:
            docs[t.practitioner_id] = await db.get(Practitioner, t.practitioner_id)
    return {
        "patient": _patient_brief(p, u),
        "consent": {"granted": True, "method": consent.method, "expires_at": as_aware(consent.expires_at)} if consent else {"granted": False},
        "tasks": [_task_out(t, docs.get(t.practitioner_id)) for t in tasks],
        "my_readings": [reading_out(r) for r in mine],
    }


class ConsentIn(BaseModel):
    patient_id: str
    method: str = Field("tap", pattern="^(tap|thumb|verbal)$")


@router.post("/consent")
async def give_consent(req: ConsentIn, current: Dict[str, Any] = Depends(require_asha), db: AsyncSession = Depends(get_db)):
    w = await _worker(db, current)
    if not await db.get(PatientProfile, req.patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    existing = await _active_consent(db, req.patient_id, w.worker_id)
    if existing:
        return {"granted": True, "method": existing.method, "expires_at": as_aware(existing.expires_at)}
    c = WorkerConsent(patient_id=req.patient_id, worker_id=w.worker_id, method=req.method,
                      expires_at=now_utc() + timedelta(days=CONSENT_DAYS))
    db.add(c)
    how = {"tap": "tapped Agree on the ASHA worker's phone", "thumb": "gave a thumb impression",
           "verbal": "agreed verbally (recorded by the ASHA worker)"}[req.method]
    db.add(AuditEvent(actor_id=f"patient:{req.patient_id}", action="ASHA_RECORDING_CONSENT_GIVEN", resource_id=req.patient_id,
                      outcome="SUCCESS", purpose=f"Patient {how}: {w.display_name} ({w.worker_code}) may add readings for {CONSENT_DAYS} days"))
    await db.commit()
    return {"granted": True, "method": c.method, "expires_at": as_aware(c.expires_at)}


class VisitReadingsIn(BaseModel):
    patient_id: str
    items: List[ReadingItem] = Field(..., min_length=1, max_length=6)
    task_id: Optional[str] = None
    measured_at: Optional[datetime] = None   # when measured (the app may send it later, after being offline)
    client_id: Optional[str] = Field(None, max_length=48)  # same id on a re-send = stored once


@router.post("/readings")
async def save_visit_readings(req: VisitReadingsIn, current: Dict[str, Any] = Depends(require_asha),
                              db: AsyncSession = Depends(get_db)):
    w = await _worker(db, current)
    if not await _active_consent(db, req.patient_id, w.worker_id):
        raise HTTPException(status_code=403, detail="The patient's consent is needed before recording readings.")
    if req.client_id:
        already = (await db.execute(select(VitalReading).where(VitalReading.client_id.like(f"{req.client_id}:%")))).scalars().all()
        if already:
            return {"saved": [reading_out(r) for r in already], "duplicate": True,
                    "alerts": [{"kind": r.kind, **assess(r.kind, r.value_f if r.value_f is not None else r.value, r.value2, r.details_json)}
                               for r in already]}
    measured = req.measured_at if req.measured_at and req.measured_at <= now_utc() + timedelta(minutes=5) else None
    task = await db.get(CareTask, req.task_id) if req.task_id else None
    if task and task.patient_id != req.patient_id:
        raise HTTPException(status_code=422, detail="This request is for another patient.")
    rows = await save_readings(db, req.patient_id, req.items, method="asha_device", recorded_by=w.worker_id,
                               recorded_by_role="asha", recorded_by_name=w.display_name,
                               task_id=task.task_id if task else None, client_id=req.client_id or uuid.uuid4().hex,
                               measured_at=measured)
    if task and task.status == "open":
        task.status = "done"
        task.completed_at = now_utc()
    await db.commit()
    for r in rows:
        await db.refresh(r)
    outs = await announce(req.patient_id, rows, f"ASHA {w.display_name}")
    return {"saved": outs, "duplicate": False,
            "alerts": [{"kind": o["kind"], "level": o["level"], "reason": o["reason"]} for o in outs if o["level"] != "normal"]}
