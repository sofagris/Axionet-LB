"""Create service_vip_links and backfill from service_vips.

Revision ID: 0012_vip_links
Revises: 0011_dashboards
Create Date: 2026-07-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_vip_links"
down_revision: str | None = "0011_dashboards"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "service_vip_links",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("vip_id", sa.String(length=36), nullable=False),
        sa.Column("frr_instance_id", sa.String(length=36), nullable=False),
        sa.Column("network_id", sa.String(length=36), nullable=False),
        sa.Column("attached", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("dataplane_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("advertised", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["vip_id"], ["service_vips.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["frr_instance_id"], ["service_instances.id"]),
        sa.ForeignKeyConstraint(["network_id"], ["networks.id"]),
        sa.UniqueConstraint(
            "vip_id",
            "frr_instance_id",
            "network_id",
            name="uq_service_vip_links_vip_frr_net",
        ),
    )
    op.create_index("ix_service_vip_links_vip_id", "service_vip_links", ["vip_id"])
    op.create_index(
        "ix_service_vip_links_frr_instance_id",
        "service_vip_links",
        ["frr_instance_id"],
    )
    op.create_index("ix_service_vip_links_network_id", "service_vip_links", ["network_id"])

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, frr_instance_id, network_id, attached, dataplane_ready, advertised, "
            "created_at, updated_at FROM service_vips"
        )
    ).fetchall()
    for row in rows:
        conn.execute(
            sa.text(
                "INSERT INTO service_vip_links "
                "(id, vip_id, frr_instance_id, network_id, attached, dataplane_ready, "
                "advertised, created_at, updated_at) "
                "VALUES (:id, :vip_id, :frr_instance_id, :network_id, :attached, "
                ":dataplane_ready, :advertised, :created_at, :updated_at)"
            ),
            {
                "id": str(__import__("uuid").uuid4()),
                "vip_id": row[0],
                "frr_instance_id": row[1],
                "network_id": row[2],
                "attached": bool(row[3]),
                "dataplane_ready": bool(row[4]),
                "advertised": bool(row[5]),
                "created_at": row[6],
                "updated_at": row[7],
            },
        )


def downgrade() -> None:
    op.drop_index("ix_service_vip_links_network_id", table_name="service_vip_links")
    op.drop_index("ix_service_vip_links_frr_instance_id", table_name="service_vip_links")
    op.drop_index("ix_service_vip_links_vip_id", table_name="service_vip_links")
    op.drop_table("service_vip_links")
