"""remove customer credit_limit_paise column

Revision ID: 63a47ad0f7eb
Revises: f98d8a9caeee
Create Date: 2026-09-26 03:14:40.656069

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63a47ad0f7eb'
down_revision: Union[str, None] = 'f98d8a9caeee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Due bills (the only thing this column ever gated) were removed Sep
    # 19, 2026 — a new bill can never be left partially paid, so a
    # customer's credit limit can never be checked against anything again.
    # Pre-launch (docs/13_DEPLOYMENT.md), no real pharmacy has ever set
    # this — confirmed 0 due bills in the dev database before dropping it.
    op.drop_column('customers', 'credit_limit_paise')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('customers', sa.Column(
        'credit_limit_paise', sa.Integer(), nullable=False, server_default='0'))
