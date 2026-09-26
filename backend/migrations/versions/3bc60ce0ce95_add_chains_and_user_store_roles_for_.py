"""add chains and user_store_roles for multi-chain phase 2

Revision ID: 3bc60ce0ce95
Revises: 63a47ad0f7eb
Create Date: 2026-09-26 09:20:45.678734

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3bc60ce0ce95'
down_revision: Union[str, None] = '63a47ad0f7eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'chains',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('owner_user_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Nullable, no default needed — every existing pharmacy is a standalone
    # single-store pharmacy and stays that way (chain_id = NULL) until
    # explicitly added to a chain. Zero data migration for existing rows.
    op.add_column('pharmacies', sa.Column('chain_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'pharmacies', 'chains', ['chain_id'], ['id'])

    op.create_table(
        'user_store_roles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('pharmacy_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['pharmacy_id'], ['pharmacies.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'pharmacy_id'),
    )

    # Backfill: every existing user gets exactly one row here, mirroring
    # their current users.pharmacy_id/role_id exactly — preserves today's
    # single-store access as-is, not a redesign. Uses INSERT..SELECT
    # (one statement, not a per-row Python loop) so it stays correct and
    # fast regardless of how many users already exist.
    op.execute("""
        INSERT INTO user_store_roles (id, user_id, pharmacy_id, role_id, created_at, updated_at)
        SELECT gen_random_uuid(), id, pharmacy_id, role_id, now(), now()
        FROM users
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('user_store_roles')
    op.drop_column('pharmacies', 'chain_id')
    op.drop_table('chains')
