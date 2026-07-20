"""Create networks table.

Revision ID: 0003_networks
Revises: 0002_physical_interfaces
Create Date: 2026-07-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_networks"
down_revision: str | None = "0002_physical_interfaces"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "networks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("network_type", sa.String(length=32), nullable=False),
        sa.Column("parent_interface_id", sa.String(length=36), nullable=True),
        sa.Column("vlan_id", sa.Integer(), nullable=True),
        sa.Column("subnet", sa.String(length=64), nullable=True),
        sa.Column("gateway", sa.String(length=64), nullable=True),
        sa.Column("ip_range", sa.String(length=64), nullable=True),
        sa.Column("mtu", sa.Integer(), nullable=True),
        sa.Column("docker_network_id", sa.String(length=64), nullable=True),
        sa.Column("docker_network_name", sa.String(length=128), nullable=True),
        sa.Column("parent_device", sa.String(length=128), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["parent_interface_id"], ["physical_interfaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_networks_name", "networks", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_networks_name", table_name="networks")
    op.drop_table("networks")
