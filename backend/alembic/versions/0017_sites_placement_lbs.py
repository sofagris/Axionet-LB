"""Create sites, placement_domains, load_balancers.

Revision ID: 0017_sites_placement_lbs
Revises: 0016_design_flows
Create Date: 2026-08-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_sites_placement_lbs"
down_revision: str | None = "0016_design_flows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sites_name", "sites", ["name"], unique=True)

    op.create_table(
        "placement_domains",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=32), nullable=True),
        sa.Column("site_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_placement_domains_name", "placement_domains", ["name"], unique=True)
    op.create_index("ix_placement_domains_site_id", "placement_domains", ["site_id"])

    op.create_table(
        "load_balancers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("site_id", sa.String(length=36), nullable=True),
        sa.Column("is_local", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_load_balancers_name", "load_balancers", ["name"])
    op.create_index("ix_load_balancers_site_id", "load_balancers", ["site_id"])


def downgrade() -> None:
    op.drop_index("ix_load_balancers_site_id", table_name="load_balancers")
    op.drop_index("ix_load_balancers_name", table_name="load_balancers")
    op.drop_table("load_balancers")
    op.drop_index("ix_placement_domains_site_id", table_name="placement_domains")
    op.drop_index("ix_placement_domains_name", table_name="placement_domains")
    op.drop_table("placement_domains")
    op.drop_index("ix_sites_name", table_name="sites")
    op.drop_table("sites")
