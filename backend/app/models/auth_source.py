from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

LOCAL_AUTH_SOURCE_ID = "00000000-0000-4000-8000-000000000001"
LOCAL_UPN_SUFFIX = "internal"


class AuthSource(Base):
    __tablename__ = "auth_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # local | oidc
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    issuer_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    client_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    client_secret: Mapped[str | None] = mapped_column(String(512), nullable=True)
    scopes: Mapped[str] = mapped_column(String(256), nullable=False, default="openid profile email")
    claim_username: Mapped[str] = mapped_column(String(64), nullable=False, default="preferred_username")
    claim_groups: Mapped[str] = mapped_column(String(64), nullable=False, default="groups")
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

    upn_suffixes: Mapped[list[AuthUpnSuffix]] = relationship(
        "AuthUpnSuffix",
        back_populates="auth_source",
    )


class AuthUpnSuffix(Base):
    __tablename__ = "auth_upn_suffixes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    suffix: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    auth_source_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("auth_sources.id", ondelete="RESTRICT"),
        nullable=False,
    )
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

    auth_source: Mapped[AuthSource] = relationship("AuthSource", back_populates="upn_suffixes")


class AppIdentityProvider(Base):
    __tablename__ = "app_identity_providers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # oidc | saml
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
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
