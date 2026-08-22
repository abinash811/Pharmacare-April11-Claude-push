"""add discount_percent to products

Revision ID: c4a8e1f92d05
Revises: b2f6a9d31e77
Create Date: 2026-08-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'c4a8e1f92d05'
down_revision = 'b2f6a9d31e77'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # BulkUpdateModal.jsx already offers "Discount %" as a bulk-editable
    # product field, and InventoryTable.jsx already renders
    # item.product.discount_percent — but no column ever backed either one,
    # so every bulk-discount-update request 400'd. This is the missing
    # column; POST /products/bulk-update and GET /inventory wire it up.
    op.add_column(
        'products',
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('products', 'discount_percent')
