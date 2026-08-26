"""add notes to suppliers

Revision ID: 6f51c99eca91
Revises: 92c51f9d723d
Create Date: 2026-08-26

Backend Pydantic schemas (SupplierCreate/SupplierUpdate) and the frontend
SupplierFormModal notes textarea already existed, but the column was
never added — notes were silently dropped on save. Nullable, no default
needed — every existing supplier simply has no notes.
"""
from alembic import op
import sqlalchemy as sa

revision = '6f51c99eca91'
down_revision = '92c51f9d723d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('suppliers', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('suppliers', 'notes')
