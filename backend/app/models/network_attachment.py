from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NetworkAttachment(Base):
    __tablename__ = "network_attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service_instance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    network_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("networks.id"),
        nullable=False,
        index=True,
    )
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(64), nullable=True)
    interface_alias: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attachment_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
