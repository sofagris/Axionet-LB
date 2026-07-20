from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class ValidationStatus(StrEnum):
    VALID = "valid"
    INVALID = "invalid"
    UNKNOWN = "unknown"


class DeploymentStatus(StrEnum):
    PENDING = "pending"
    DEPLOYED = "deployed"
    FAILED = "failed"
    SUPERSEDED = "superseded"


class ConfigRevision(Base):
    __tablename__ = "config_revisions"
    __table_args__ = (
        UniqueConstraint(
            "service_instance_id",
            "revision_number",
            name="uq_config_revisions_instance_number",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service_instance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    rendered_configuration: Mapped[str] = mapped_column(Text, nullable=False, default="")
    validation_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=ValidationStatus.UNKNOWN.value,
    )
    validation_output: Mapped[str] = mapped_column(Text, nullable=False, default="")
    deployment_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=DeploymentStatus.PENDING.value,
    )
    created_by: Mapped[str] = mapped_column(String(128), nullable=False, default="system")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
