"""Create config_revisions table.

Revision ID: 0005_config_revisions
Revises: 0004_service_instances
Create Date: 2026-07-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_config_revisions"
down_revision: str | None = "0004_service_instances"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "config_revisions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("service_instance_id", sa.String(length=36), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False),
        sa.Column("rendered_configuration", sa.Text(), nullable=False),
        sa.Column("validation_status", sa.String(length=16), nullable=False),
        sa.Column("validation_output", sa.Text(), nullable=False),
        sa.Column("deployment_status", sa.String(length=16), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["service_instance_id"], ["service_instances.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "service_instance_id",
            "revision_number",
            name="uq_config_revisions_instance_number",
        ),
    )
    op.create_index(
        "ix_config_revisions_service_instance_id",
        "config_revisions",
        ["service_instance_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_config_revisions_service_instance_id", table_name="config_revisions")
    op.drop_table("config_revisions")
