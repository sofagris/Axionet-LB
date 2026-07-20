"""Add is_management to physical_interfaces.

Revision ID: 0006_interface_management
Revises: 0005_config_revisions
Create Date: 2026-07-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_interface_management"
down_revision: str | None = "0005_config_revisions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("physical_interfaces") as batch:
        batch.add_column(
            sa.Column("is_management", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    with op.batch_alter_table("physical_interfaces") as batch:
        batch.drop_column("is_management")
