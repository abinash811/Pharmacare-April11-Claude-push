"""add print_pan toggle and digital free-text header/footer

Revision ID: 9a4e7f1c2b56
Revises: 7c33d8eec679
Create Date: 2026-08-19

"""
from alembic import op
import sqlalchemy as sa

revision = '9a4e7f1c2b56'
down_revision = '7c33d8eec679'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pharmacy_settings',
        sa.Column('print_pan', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'pharmacy_settings', sa.Column('digital_bill_header', sa.Text(), nullable=True)
    )
    op.add_column(
        'pharmacy_settings', sa.Column('digital_bill_footer', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('pharmacy_settings', 'digital_bill_footer')
    op.drop_column('pharmacy_settings', 'digital_bill_header')
    op.drop_column('pharmacy_settings', 'print_pan')
