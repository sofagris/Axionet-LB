"""Create app_meta table.

Revision ID: 0001_app_meta
Revises:
Create Date: 2026-07-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_app_meta"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_meta",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.execute(
        sa.text(
            "INSERT INTO app_meta (key, value, updated_at) "
            "VALUES ('schema_bootstrap', 'milestone-1', CURRENT_TIMESTAMP)"
        )
    )


def downgrade() -> None:
    op.drop_table("app_meta")
