"""add_pharmacy_settings_gst_print_notification_fields

Revision ID: a3f8c2d14e90
Revises: 95d13d1508dc
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f8c2d14e90'
down_revision: Union[str, None] = '95d13d1508dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Notification alert columns
    op.add_column('pharmacy_settings', sa.Column('alert_low_stock_enabled',   sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('pharmacy_settings', sa.Column('alert_near_expiry_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('pharmacy_settings', sa.Column('alert_drug_license_enabled',sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('pharmacy_settings', sa.Column('drug_license_alert_days',   sa.Integer(), nullable=False, server_default=sa.text('90')))

    # GST columns
    op.add_column('pharmacy_settings', sa.Column('is_composition_scheme', sa.Boolean(),     nullable=False, server_default=sa.text('false')))
    op.add_column('pharmacy_settings', sa.Column('default_hsn_medicines', sa.String(10),    nullable=False, server_default=sa.text("'3004'")))
    op.add_column('pharmacy_settings', sa.Column('default_hsn_surgical',  sa.String(10),    nullable=False, server_default=sa.text("'9018'")))
    op.add_column('pharmacy_settings', sa.Column('auto_apply_hsn',        sa.Boolean(),     nullable=False, server_default=sa.text('true')))
    op.add_column('pharmacy_settings', sa.Column('gst_type',              sa.String(20),    nullable=False, server_default=sa.text("'intrastate'")))
    op.add_column('pharmacy_settings', sa.Column('round_off_amount',      sa.Boolean(),     nullable=False, server_default=sa.text('true')))
    op.add_column('pharmacy_settings', sa.Column('print_gst_summary',     sa.Boolean(),     nullable=False, server_default=sa.text('true')))

    # Print columns
    op.add_column('pharmacy_settings', sa.Column('print_gstin',    sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('pharmacy_settings', sa.Column('print_fssai',    sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('pharmacy_settings', sa.Column('print_signature',sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('pharmacy_settings', sa.Column('bill_header',    sa.Text(),    nullable=True))
    op.add_column('pharmacy_settings', sa.Column('bill_footer',    sa.Text(),    nullable=True,  server_default=sa.text("'Thank you for your purchase!'")))


def downgrade() -> None:
    op.drop_column('pharmacy_settings', 'bill_footer')
    op.drop_column('pharmacy_settings', 'bill_header')
    op.drop_column('pharmacy_settings', 'print_signature')
    op.drop_column('pharmacy_settings', 'print_fssai')
    op.drop_column('pharmacy_settings', 'print_gstin')
    op.drop_column('pharmacy_settings', 'print_gst_summary')
    op.drop_column('pharmacy_settings', 'round_off_amount')
    op.drop_column('pharmacy_settings', 'gst_type')
    op.drop_column('pharmacy_settings', 'auto_apply_hsn')
    op.drop_column('pharmacy_settings', 'default_hsn_surgical')
    op.drop_column('pharmacy_settings', 'default_hsn_medicines')
    op.drop_column('pharmacy_settings', 'is_composition_scheme')
    op.drop_column('pharmacy_settings', 'drug_license_alert_days')
    op.drop_column('pharmacy_settings', 'alert_drug_license_enabled')
    op.drop_column('pharmacy_settings', 'alert_near_expiry_enabled')
    op.drop_column('pharmacy_settings', 'alert_low_stock_enabled')
