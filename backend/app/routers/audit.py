from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.models import AuditEvent
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
    """
    res = await db.execute(select(AuditEvent).order_by(desc(AuditEvent.timestamp)).limit(50))
    logs = res.scalars().all()
    return [
        AuditEventOut(
            event_id=log.event_id,
            actor_id=log.actor_id,
            action=log.action,
            resource_id=log.resource_id,
            outcome=log.outcome,
            timestamp=log.timestamp
        )
        for log in logs
    ]
