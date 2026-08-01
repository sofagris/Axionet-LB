"""App IdP bindings to customer/application soft refs.

Revision ID: 0015_app_idp_bindings
Revises: 0014_auth_sources
Create Date: 2026-08-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_app_idp_bindings"
down_revision: str | None = "0014_auth_sources"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_idp_bindings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("app_identity_provider_id", sa.String(length=36), nullable=False),
        sa.Column("customer_id", sa.String(length=64), nullable=False),
        sa.Column("application_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["app_identity_provider_id"],
            ["app_identity_providers.id"],
            name="fk_app_idp_bindings_provider",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_app_idp_bindings_customer_id",
        "app_idp_bindings",
        ["customer_id"],
    )
    op.create_index(
        "ix_app_idp_bindings_provider_id",
        "app_idp_bindings",
        ["app_identity_provider_id"],
    )
    op.create_index(
        "ix_app_idp_bindings_customer_app",
        "app_idp_bindings",
        ["customer_id", "application_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_app_idp_bindings_customer_app", table_name="app_idp_bindings")
    op.drop_index("ix_app_idp_bindings_provider_id", table_name="app_idp_bindings")
    op.drop_index("ix_app_idp_bindings_customer_id", table_name="app_idp_bindings")
    op.drop_table("app_idp_bindings")
