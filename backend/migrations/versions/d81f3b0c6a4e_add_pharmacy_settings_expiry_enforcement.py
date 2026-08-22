"""add block_expired_stock and allow_near_expiry_sale to pharmacy_settings

Revision ID: d81f3b0c6a4e
Revises: c4a8e1f92d05
Create Date: 2026-08-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'd81f3b0c6a4e'
down_revision = 'c4a8e1f92d05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # InventoryTab.jsx already renders "Block expired stock from billing" and
    # "Allow selling near-expiry products" checkboxes, and GET /settings
    # already returned them — but as hardcoded `True` literals, not real
    # columns, and PUT /settings silently dropped both on save. Nothing in
    # billing.py checked either one. This is the missing persistence;
    # billing.py's create_bill/update_bill now enforce it for real.
    # Both default True to match the value every pharmacy already saw.
    op.add_column(
        'pharmacy_settings',
        sa.Column('block_expired_stock', sa.Boolean(), nullable=False, server_default='true'),
    )
    op.add_column(
        'pharmacy_settings',
        sa.Column('allow_near_expiry_sale', sa.Boolean(), nullable=False, server_default='true'),
    )


def downgrade() -> None:
    op.drop_column('pharmacy_settings', 'allow_near_expiry_sale')
    op.drop_column('pharmacy_settings', 'block_expired_stock')
