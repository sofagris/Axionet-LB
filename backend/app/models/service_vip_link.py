from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.service_vip import ServiceVip


class ServiceVipLink(Base):
    """One dataplane edge for a VIP: FRR instance + network (M9.3 ECMP)."""

    __tablename__ = "service_vip_links"
    __table_args__ = (
        UniqueConstraint(
            "vip_id",
            "frr_instance_id",
            "network_id",
            name="uq_service_vip_links_vip_frr_net",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vip_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("service_vips.id", ondelete="CASCADE"),
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
    attached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dataplane_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    advertised: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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

    vip: Mapped[ServiceVip] = relationship("ServiceVip", back_populates="links")
