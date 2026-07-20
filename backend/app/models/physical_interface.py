from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LinkState(StrEnum):
    UP = "up"
    DOWN = "down"
    UNKNOWN = "unknown"


class AdministrativeState(StrEnum):
    ENABLED = "enabled"
    DISABLED = "disabled"


class PhysicalInterface(Base):
    __tablename__ = "physical_interfaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    mac_address: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pci_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    numa_node: Mapped[int | None] = mapped_column(Integer, nullable=True)
    speed_mbps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    driver: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mtu: Mapped[int | None] = mapped_column(Integer, nullable=True)
    link_state: Mapped[str] = mapped_column(String(16), nullable=False, default=LinkState.UNKNOWN.value)
    administrative_state: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=AdministrativeState.ENABLED.value,
    )
    exclusive_use: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_management: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    discovered_at: Mapped[datetime] = mapped_column(
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
