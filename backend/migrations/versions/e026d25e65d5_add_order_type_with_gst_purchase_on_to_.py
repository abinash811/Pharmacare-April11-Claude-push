"""add order_type, with_gst, purchase_on to purchases

Revision ID: e026d25e65d5
Revises: c5671e4dfe9f
Create Date: 2026-08-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'e026d25e65d5'
down_revision = 'c5671e4dfe9f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PurchaseCreate has always accepted order_type/with_gst/purchase_on —
    # with_gst genuinely affects GST calculation at creation time and
    # purchase_on affects payment_status/due_date, but neither was ever
    # persisted, and order_type was accepted but never used anywhere at
    # all. PurchaseNew's own edit-load effect already reads
    # p.order_type/p.with_gst/p.purchase_on from the API response — since
    # neither the column nor the response field existed, editing a draft
    # silently reset all three to their defaults every time.
    op.add_column('purchases', sa.Column('order_type', sa.String(length=20), nullable=False, server_default='direct'))
    op.add_column('purchases', sa.Column('with_gst', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('purchases', sa.Column('purchase_on', sa.String(length=20), nullable=False, server_default='credit'))


def downgrade() -> None:
    op.drop_column('purchases', 'purchase_on')
    op.drop_column('purchases', 'with_gst')
    op.drop_column('purchases', 'order_type')
