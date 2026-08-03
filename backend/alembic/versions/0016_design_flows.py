"""Create design_flows table.

Revision ID: 0016_design_flows
Revises: 0015_app_idp_bindings
Create Date: 2026-08-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_design_flows"
down_revision: str | None = "0015_app_idp_bindings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "design_flows",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("graph_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_design_flows_name", "design_flows", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_design_flows_name", table_name="design_flows")
    op.drop_table("design_flows")
