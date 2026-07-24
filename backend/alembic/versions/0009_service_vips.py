"""Create service_vips table.

Revision ID: 0009_service_vips
Revises: 0008_users
Create Date: 2026-07-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_service_vips"
down_revision: str | None = "0008_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "service_vips",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("address", sa.String(length=64), nullable=False),
        sa.Column("haproxy_instance_id", sa.String(length=36), nullable=False),
        sa.Column("frr_instance_id", sa.String(length=36), nullable=False),
        sa.Column("network_id", sa.String(length=36), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("advertise", sa.Boolean(), nullable=False),
        sa.Column("attached", sa.Boolean(), nullable=False),
        sa.Column("advertised", sa.Boolean(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["haproxy_instance_id"], ["service_instances.id"]),
        sa.ForeignKeyConstraint(["frr_instance_id"], ["service_instances.id"]),
        sa.ForeignKeyConstraint(["network_id"], ["networks.id"]),
    )
    op.create_index("ix_service_vips_name", "service_vips", ["name"], unique=True)
    op.create_index("ix_service_vips_haproxy_instance_id", "service_vips", ["haproxy_instance_id"])
    op.create_index("ix_service_vips_frr_instance_id", "service_vips", ["frr_instance_id"])
    op.create_index("ix_service_vips_network_id", "service_vips", ["network_id"])


def downgrade() -> None:
    op.drop_index("ix_service_vips_network_id", table_name="service_vips")
    op.drop_index("ix_service_vips_frr_instance_id", table_name="service_vips")
    op.drop_index("ix_service_vips_haproxy_instance_id", table_name="service_vips")
    op.drop_index("ix_service_vips_name", table_name="service_vips")
    op.drop_table("service_vips")
