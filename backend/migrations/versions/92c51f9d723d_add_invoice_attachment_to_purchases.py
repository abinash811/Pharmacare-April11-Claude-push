"""add invoice attachment fields to purchases

Revision ID: 92c51f9d723d
Revises: e026d25e65d5
Create Date: 2026-08-24

A scanned distributor invoice/bill, stored as a base64 data: URL —
mirrors the only existing file-upload precedent in this codebase
(Settings/components/LogoUpload.tsx, client-side base64, no backend
upload endpoint). Nullable, no default needed — every existing purchase
simply has no attachment.
"""
from alembic import op
import sqlalchemy as sa

revision = '92c51f9d723d'
down_revision = 'e026d25e65d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('purchases', sa.Column('invoice_attachment_data', sa.Text(), nullable=True))
    op.add_column('purchases', sa.Column('invoice_attachment_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('purchases', 'invoice_attachment_name')
    op.drop_column('purchases', 'invoice_attachment_data')
