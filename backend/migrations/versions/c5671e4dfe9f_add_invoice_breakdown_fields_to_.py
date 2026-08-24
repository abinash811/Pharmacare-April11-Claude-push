"""add invoice breakdown fields to purchases

Revision ID: c5671e4dfe9f
Revises: d2b4ac9c191e
Create Date: 2026-08-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'c5671e4dfe9f'
down_revision = 'd2b4ac9c191e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PurchaseNew's InvoiceBreakdownModal has always let the user enter
    # Total Discount, CESS, Adjusted CN/Voucher, TCS, Extra Charges, and
    # Adjustment Amount, and shows a live Net Amount computed from them —
    # but none of it ever reached the backend. PurchaseCreate had no
    # fields to receive them, and create_purchase/update_purchase
    # recomputed the total from raw items only, silently discarding
    # whatever the pharmacist entered. total_discount_paise already
    # existed (also unused until now); this adds the other five.
    op.add_column('purchases', sa.Column('cess_paise', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('purchases', sa.Column('adjusted_cn_paise', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('purchases', sa.Column('tcs_paise', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('purchases', sa.Column('extra_charges_paise', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('purchases', sa.Column('adjustment_amount_paise', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('purchases', 'adjustment_amount_paise')
    op.drop_column('purchases', 'extra_charges_paise')
    op.drop_column('purchases', 'tcs_paise')
    op.drop_column('purchases', 'adjusted_cn_paise')
    op.drop_column('purchases', 'cess_paise')
