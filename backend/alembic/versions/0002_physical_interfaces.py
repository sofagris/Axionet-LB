"""Create physical_interfaces table.

Revision ID: 0002_physical_interfaces
Revises: 0001_app_meta
Create Date: 2026-07-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_physical_interfaces"
down_revision: str | None = "0001_app_meta"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "physical_interfaces",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("mac_address", sa.String(length=32), nullable=True),
        sa.Column("pci_address", sa.String(length=64), nullable=True),
        sa.Column("numa_node", sa.Integer(), nullable=True),
        sa.Column("speed_mbps", sa.Integer(), nullable=True),
        sa.Column("driver", sa.String(length=64), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mtu", sa.Integer(), nullable=True),
        sa.Column("link_state", sa.String(length=16), nullable=False),
        sa.Column("administrative_state", sa.String(length=16), nullable=False),
        sa.Column("exclusive_use", sa.Boolean(), nullable=False),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_physical_interfaces_name", "physical_interfaces", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_physical_interfaces_name", table_name="physical_interfaces")
    op.drop_table("physical_interfaces")
