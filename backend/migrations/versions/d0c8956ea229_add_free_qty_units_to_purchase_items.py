"""add free_qty_units to purchase_items

Revision ID: d0c8956ea229
Revises: d81f3b0c6a4e
Create Date: 2026-08-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'd0c8956ea229'
down_revision = 'd81f3b0c6a4e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PurchaseItemCreate.free_qty_units has always been accepted by
    # POST/PUT /purchases, but no column ever backed it — silently
    # discarded, real margin-accuracy risk (bonus units received free but
    # priced as if paid for). This is the missing column; purchases.py
    # wires it into both the response and stock creation on confirm.
    op.add_column(
        'purchase_items',
        sa.Column('free_qty_units', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('purchase_items', 'free_qty_units')
