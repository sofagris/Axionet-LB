"""Extend users and add groups / user_groups.

Revision ID: 0013_users_groups
Revises: 0012_vip_links
Create Date: 2026-08-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_users_groups"
down_revision: str | None = "0012_vip_links"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(length=128), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "auth_source",
            sa.String(length=32),
            nullable=False,
            server_default="local",
        ),
    )
    with op.batch_alter_table("users") as batch:
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)

    op.create_table(
        "groups",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="viewer"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", name="uq_groups_name"),
    )
    op.create_index("ix_groups_name", "groups", ["name"])

    op.create_table(
        "user_groups",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("group_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "group_id"),
    )


def downgrade() -> None:
    op.drop_table("user_groups")
    op.drop_index("ix_groups_name", table_name="groups")
    op.drop_table("groups")
    with op.batch_alter_table("users") as batch:
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
        batch.drop_column("auth_source")
        batch.drop_column("display_name")
        batch.drop_column("email")
