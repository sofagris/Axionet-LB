from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class DesiredState(StrEnum):
    RUNNING = "running"
    STOPPED = "stopped"
    DELETED = "deleted"


class ActualState(StrEnum):
    UNKNOWN = "unknown"
    PENDING = "pending"
    CREATING = "creating"
    STARTING = "starting"
    RUNNING = "running"
    DEGRADED = "degraded"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"
    DELETING = "deleting"


class HealthStatus(StrEnum):
    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"


class ServiceInstance(Base):
    __tablename__ = "service_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    service_type: Mapped[str] = mapped_column(String(64), nullable=False, default="haproxy")
    desired_state: Mapped[str] = mapped_column(String(16), nullable=False, default=DesiredState.STOPPED.value)
    actual_state: Mapped[str] = mapped_column(String(16), nullable=False, default=ActualState.UNKNOWN.value)
    image: Mapped[str] = mapped_column(String(256), nullable=False, default="haproxy:3.2.6")
    image_version: Mapped[str] = mapped_column(String(64), nullable=False, default="3.2.6")
    restart_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="unless-stopped")
    configuration: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    container_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    container_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    health_status: Mapped[str] = mapped_column(String(16), nullable=False, default=HealthStatus.UNKNOWN.value)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
