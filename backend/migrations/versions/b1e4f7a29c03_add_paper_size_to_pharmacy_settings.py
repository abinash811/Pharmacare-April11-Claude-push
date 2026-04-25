"""add paper_size to pharmacy_settings

Revision ID: b1e4f7a29c03
Revises: a3f8c2d14e90
Create Date: 2026-04-25

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1e4f7a29c03'
down_revision = 'a3f8c2d14e90'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pharmacy_settings',
        sa.Column('paper_size', sa.String(10), nullable=False, server_default='80mm'),
    )


def downgrade() -> None:
    op.drop_column('pharmacy_settings', 'paper_size')
