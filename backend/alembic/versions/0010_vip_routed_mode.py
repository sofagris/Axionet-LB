"""Create service_vips mode and backend_ip columns.

Revision ID: 0010_vip_routed_mode
Revises: 0009_service_vips
Create Date: 2026-07-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_vip_routed_mode"
down_revision: str | None = "0009_service_vips"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "service_vips",
        sa.Column("mode", sa.String(length=32), nullable=False, server_default="same_l2"),
    )
    op.add_column(
        "service_vips",
        sa.Column("backend_ip", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "service_vips",
        sa.Column("dataplane_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("service_vips", "dataplane_ready")
    op.drop_column("service_vips", "backend_ip")
    op.drop_column("service_vips", "mode")
