from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.group import UserGroup


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("auth_source_id", "oidc_sub", name="uq_users_auth_source_oidc_sub"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="admin")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    auth_source: Mapped[str] = mapped_column(String(32), nullable=False, default="local")
    auth_source_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("auth_sources.id", ondelete="SET NULL"),
        nullable=True,
    )
    oidc_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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

    group_memberships: Mapped[list[UserGroup]] = relationship(
        "UserGroup",
        back_populates="user",
        cascade="all, delete-orphan",
    )
