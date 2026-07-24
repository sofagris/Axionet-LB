from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ServiceVip(Base):
    __tablename__ = "service_vips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    address: Mapped[str] = mapped_column(String(64), nullable=False)
    mode: Mapped[str] = mapped_column(String(32), nullable=False, default="same_l2")
    backend_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    haproxy_instance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("service_instances.id"),
        nullable=False,
        index=True,
    )
    frr_instance_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("service_instances.id"),
        nullable=False,
        index=True,
    )
    network_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("networks.id"),
        nullable=False,
        index=True,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    advertise: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    attached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dataplane_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    advertised: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
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
