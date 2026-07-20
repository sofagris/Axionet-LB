from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NetworkType(StrEnum):
    MANAGEMENT = "management"
    BRIDGE = "bridge"
    IPVLAN_L2 = "ipvlan-l2"
    IPVLAN_L3 = "ipvlan-l3"
    MACVLAN = "macvlan"
    UNTAGGED_ACCESS = "untagged-access"


class Network(Base):
    __tablename__ = "networks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    network_type: Mapped[str] = mapped_column(String(32), nullable=False)
    parent_interface_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("physical_interfaces.id"),
        nullable=True,
    )
    vlan_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subnet: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_range: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mtu: Mapped[int | None] = mapped_column(Integer, nullable=True)
    docker_network_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    docker_network_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    parent_device: Mapped[str | None] = mapped_column(String(128), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
