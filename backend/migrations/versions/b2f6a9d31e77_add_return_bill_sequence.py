"""add configurable Sales Return (credit note) bill sequence

Revision ID: b2f6a9d31e77
Revises: 9a4e7f1c2b56
Create Date: 2026-08-19

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2f6a9d31e77'
down_revision = '9a4e7f1c2b56'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pharmacy_settings',
        sa.Column('return_prefix', sa.String(length=10), nullable=False, server_default='CN'),
    )
    op.add_column(
        'pharmacy_settings',
        sa.Column('return_sequence_number', sa.Integer(), nullable=False, server_default='1'),
    )
    op.add_column(
        'pharmacy_settings',
        sa.Column('return_number_length', sa.Integer(), nullable=False, server_default='5'),
    )

    # Sales returns were already numbered "CN-00001" etc, just not through a
    # counter — the next number was derived on the fly from MAX(return_number).
    # Backfill return_sequence_number from any existing return numbers so the
    # new atomic counter continues from where the old query-then-increment
    # logic left off, instead of restarting at 1 and colliding with real data.
    op.execute("""
        UPDATE pharmacy_settings ps
        SET return_sequence_number = sub.max_seq + 1
        FROM (
            SELECT pharmacy_id, MAX(CAST(SPLIT_PART(return_number, '-', 2) AS INTEGER)) AS max_seq
            FROM sales_returns
            WHERE return_number LIKE 'CN-%'
              AND SPLIT_PART(return_number, '-', 2) ~ '^[0-9]+$'
            GROUP BY pharmacy_id
        ) sub
        WHERE ps.pharmacy_id = sub.pharmacy_id
    """)


def downgrade() -> None:
    op.drop_column('pharmacy_settings', 'return_number_length')
    op.drop_column('pharmacy_settings', 'return_sequence_number')
    op.drop_column('pharmacy_settings', 'return_prefix')
