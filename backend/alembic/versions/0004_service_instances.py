"""Create service_instances and network_attachments.

Revision ID: 0004_service_instances
Revises: 0003_networks
Create Date: 2026-07-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_service_instances"
down_revision: str | None = "0003_networks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "service_instances",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("service_type", sa.String(length=64), nullable=False),
        sa.Column("desired_state", sa.String(length=16), nullable=False),
        sa.Column("actual_state", sa.String(length=16), nullable=False),
        sa.Column("image", sa.String(length=256), nullable=False),
        sa.Column("image_version", sa.String(length=64), nullable=False),
        sa.Column("restart_policy", sa.String(length=32), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False),
        sa.Column("container_id", sa.String(length=64), nullable=True),
        sa.Column("container_name", sa.String(length=128), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("health_status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_service_instances_name", "service_instances", ["name"], unique=True)

    op.create_table(
        "network_attachments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("service_instance_id", sa.String(length=36), nullable=False),
        sa.Column("network_id", sa.String(length=36), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("gateway", sa.String(length=64), nullable=True),
        sa.Column("interface_alias", sa.String(length=64), nullable=True),
        sa.Column("attachment_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["network_id"], ["networks.id"]),
        sa.ForeignKeyConstraint(["service_instance_id"], ["service_instances.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_network_attachments_service_instance_id",
        "network_attachments",
        ["service_instance_id"],
    )
    op.create_index("ix_network_attachments_network_id", "network_attachments", ["network_id"])


def downgrade() -> None:
    op.drop_index("ix_network_attachments_network_id", table_name="network_attachments")
    op.drop_index("ix_network_attachments_service_instance_id", table_name="network_attachments")
    op.drop_table("network_attachments")
    op.drop_index("ix_service_instances_name", table_name="service_instances")
    op.drop_table("service_instances")
