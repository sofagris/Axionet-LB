"""Create dashboards table.

Revision ID: 0011_dashboards
Revises: 0010_vip_routed_mode
Create Date: 2026-07-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_dashboards"
down_revision: str | None = "0010_vip_routed_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dashboards",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("widgets", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dashboards_name", "dashboards", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_dashboards_name", table_name="dashboards")
    op.drop_table("dashboards")
