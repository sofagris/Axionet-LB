"""Auth sources, UPN suffixes, app IdPs, user oidc fields.

Revision ID: 0014_auth_sources
Revises: 0013_users_groups
Create Date: 2026-08-02

"""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0014_auth_sources"
down_revision: str | None = "0013_users_groups"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOCAL_SOURCE_ID = "00000000-0000-4000-8000-000000000001"


def upgrade() -> None:
    op.create_table(
        "auth_sources",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("description", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("issuer_url", sa.String(length=512), nullable=True),
        sa.Column("client_id", sa.String(length=256), nullable=True),
        sa.Column("client_secret", sa.String(length=512), nullable=True),
        sa.Column("scopes", sa.String(length=256), nullable=False, server_default="openid profile email"),
        sa.Column("claim_username", sa.String(length=64), nullable=False, server_default="preferred_username"),
        sa.Column("claim_groups", sa.String(length=64), nullable=False, server_default="groups"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", name="uq_auth_sources_name"),
    )
    op.create_index("ix_auth_sources_name", "auth_sources", ["name"])

    op.create_table(
        "auth_upn_suffixes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("suffix", sa.String(length=255), nullable=False),
        sa.Column("auth_source_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["auth_source_id"], ["auth_sources.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("suffix", name="uq_auth_upn_suffixes_suffix"),
    )
    op.create_index("ix_auth_upn_suffixes_suffix", "auth_upn_suffixes", ["suffix"])

    op.create_table(
        "app_identity_providers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("customer_id", sa.String(length=64), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", name="uq_app_identity_providers_name"),
    )

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("oidc_sub", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("auth_source_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_users_auth_source_id",
            "auth_sources",
            ["auth_source_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_unique_constraint("uq_users_auth_source_oidc_sub", ["auth_source_id", "oidc_sub"])

    now = datetime.now(UTC)
    op.bulk_insert(
        sa.table(
            "auth_sources",
            sa.column("id", sa.String),
            sa.column("name", sa.String),
            sa.column("kind", sa.String),
            sa.column("enabled", sa.Boolean),
            sa.column("description", sa.String),
            sa.column("issuer_url", sa.String),
            sa.column("client_id", sa.String),
            sa.column("client_secret", sa.String),
            sa.column("scopes", sa.String),
            sa.column("claim_username", sa.String),
            sa.column("claim_groups", sa.String),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {
                "id": LOCAL_SOURCE_ID,
                "name": "Local",
                "kind": "local",
                "enabled": True,
                "description": "Built-in local user database (break-glass)",
                "issuer_url": None,
                "client_id": None,
                "client_secret": None,
                "scopes": "openid profile email",
                "claim_username": "preferred_username",
                "claim_groups": "groups",
                "created_at": now,
                "updated_at": now,
            }
        ],
    )
    op.bulk_insert(
        sa.table(
            "auth_upn_suffixes",
            sa.column("id", sa.String),
            sa.column("suffix", sa.String),
            sa.column("auth_source_id", sa.String),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {
                "id": str(uuid4()),
                "suffix": "internal",
                "auth_source_id": LOCAL_SOURCE_ID,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_auth_source_oidc_sub", type_="unique")
        batch.drop_constraint("fk_users_auth_source_id", type_="foreignkey")
        batch.drop_column("auth_source_id")
        batch.drop_column("oidc_sub")
    op.drop_table("app_identity_providers")
    op.drop_index("ix_auth_upn_suffixes_suffix", table_name="auth_upn_suffixes")
    op.drop_table("auth_upn_suffixes")
    op.drop_index("ix_auth_sources_name", table_name="auth_sources")
    op.drop_table("auth_sources")
