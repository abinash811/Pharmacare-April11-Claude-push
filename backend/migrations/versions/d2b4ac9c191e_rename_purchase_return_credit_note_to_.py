"""rename purchase_returns.credit_note_number to debit_note_number

Revision ID: d2b4ac9c191e
Revises: d0c8956ea229
Create Date: 2026-08-24

"""
from alembic import op

revision = 'd2b4ac9c191e'
down_revision = 'd0c8956ea229'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A pharmacy returning goods to a supplier issues a debit note (it
    # reduces what the pharmacy owes the supplier) — a credit note is the
    # reverse direction, issued by a supplier to a customer. This column
    # was named credit_note_number, matching sales_returns.py's genuinely
    # correct credit-note terminology by copy-paste, not by design. Marg
    # ERP labels this exact flow "Debit Note". Backend-only rename — no
    # frontend code reads this field.
    op.alter_column('purchase_returns', 'credit_note_number', new_column_name='debit_note_number')


def downgrade() -> None:
    op.alter_column('purchase_returns', 'debit_note_number', new_column_name='credit_note_number')
