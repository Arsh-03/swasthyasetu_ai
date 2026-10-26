"""
SETU-Shield endpoints: the standard itself, what left the server for AI (without content), and a preview of
exactly what the AI would see for the doctor's current note.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Encounter, PatientProfile
from app.services import call_minutes as cm
from app.services import privacy_gateway as pg
from app.services.auth_dependencies import require_doctor
from app.services.llm_completion import SYSTEM_PROMPT, CompletionContext, build_prompt

router = APIRouter(prefix="/privacy", tags=["Privacy (SETU-Shield)"])


class PreviewIn(BaseModel):
    encounter_id: str
    text: str = Field(default="", max_length=20000)


@router.get("/standard")
async def standard(current_doctor: Dict[str, Any] = Depends(require_doctor)):
    """The steps, what each feature may send, and where AI requests go."""
    return {
        "standard": pg.STANDARD, "steps": pg.STEPS,
        "purposes": [{"id": k, "label": v["label"], "fields": list(v["fields"])} for k, v in pg.PURPOSES.items()],
        "destinations": {"text": pg.destination("text"), "speech": pg.destination("speech")},
        "rules": ["Voice is never sent to a third party.",
                  "AI requests come only from the hospital server, never from a phone or browser.",
                  "If the final check finds personal data, the request is not sent and the feature uses offline rules."],
    }


@router.get("/ledger")
async def ledger(encounter_id: Optional[str] = None, current_doctor: Dict[str, Any] = Depends(require_doctor)):
    """Recent AI requests (no content): purpose, destination, fields, identifiers masked, size, fingerprint."""
    return {"standard": pg.STANDARD, "items": pg.ledger_for(encounter_id)}


@router.post("/preview")
async def preview(req: PreviewIn, current_doctor: Dict[str, Any] = Depends(require_doctor),
                  db: AsyncSession = Depends(get_db)):
    """Exactly what the notepad autocomplete would send for this note. Nothing is sent."""
    enc = await db.get(Encounter, req.encounter_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Consultation not found")
    patient = await db.get(PatientProfile, enc.patient_id)
    demo = (patient.demographics_json or {}) if patient else {}
    shield = await pg.shield_for_encounter(db, enc)
    note = req.text[-1500:]
    conversation = cm.conversation_for(enc.encounter_id)
    given = {"note": note, "conversation": conversation, "age": demo.get("age"), "sex": demo.get("sex") or demo.get("gender"),
             "section": None, "patient_name": patient.full_name if patient else None, "district": demo.get("district"),
             "patient_id": enc.patient_id, "encounter_id": enc.encounter_id}
    sent = shield.prepare("notepad_autocomplete", given)
    prompt = build_prompt(CompletionContext(text_before=sent.get("note", ""), section=None,
                                            patient={"age_band": sent.get("age_band"), "sex": sent.get("sex")},
                                            conversation=sent.get("conversation", "")))
    leaks = shield.scan({"system": SYSTEM_PROMPT, "prompt": prompt})
    masked = shield.deid.summary()
    dropped = sorted(k for k in given if k not in pg.PURPOSES["notepad_autocomplete"]["fields"] and k != "age")
    checks = [
        {"id": "S1", "ok": True, "detail": f"Kept: {', '.join(sorted(sent))}. Dropped: {', '.join(dropped)}."},
        {"id": "S2", "ok": True, "detail": ", ".join(f"{n} {k.lower()}" for k, n in masked.items()) or "Nothing to mask."},
        {"id": "S3", "ok": True, "detail": f"Age {demo.get('age')} → {sent.get('age_band') or 'not sent'}."},
        {"id": "S4", "ok": not any(i in prompt for i in (enc.patient_id, enc.encounter_id, enc.practitioner_id or "#")),
         "detail": "No patient, doctor or consultation IDs in the request."},
        {"id": "S5", "ok": not leaks, "detail": "No personal data found." if not leaks else "Would be blocked: " + ", ".join(leaks)},
        {"id": "S6", "ok": True, "detail": f"Fingerprint {pg._fingerprint({'system': SYSTEM_PROMPT, 'prompt': prompt})[:16]}, "
                                           f"{len(prompt)} characters."},
        {"id": "S7", "ok": True, "detail": "Placeholders in the answer are swapped back only on your screen."},
    ]
    return {"standard": pg.STANDARD, "destination": pg.destination("text"), "original": note, "sent": sent,
            "prompt": prompt, "checks": checks, "blocked": bool(leaks), "leaks": leaks}
