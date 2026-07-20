from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


class AuditService:
    """Persist administrative actions for later review."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def record(
        self,
        *,
        event_type: str,
        resource_type: str,
        resource_id: str | None = None,
        actor: str = "system",
        payload: dict[str, Any] | None = None,
        result: str = "ok",
        commit: bool = False,
    ) -> AuditEvent:
        event = AuditEvent(
            event_type=event_type,
            actor=actor,
            resource_type=resource_type,
            resource_id=resource_id,
            payload=payload or {},
            result=result,
        )
        self._db.add(event)
        if commit:
            self._db.commit()
            self._db.refresh(event)
        else:
            self._db.flush()
        return event

    def list_events(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
        event_type: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> list[AuditEvent]:
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc())
        if event_type:
            stmt = stmt.where(AuditEvent.event_type == event_type)
        if resource_type:
            stmt = stmt.where(AuditEvent.resource_type == resource_type)
        if resource_id:
            stmt = stmt.where(AuditEvent.resource_id == resource_id)
        stmt = stmt.offset(max(offset, 0)).limit(min(max(limit, 1), 500))
        return list(self._db.scalars(stmt))
