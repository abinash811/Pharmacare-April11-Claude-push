"""add digital receipt template fields to pharmacy_settings

Revision ID: 7c33d8eec679
Revises: b1e4f7a29c03
Create Date: 2026-08-19

"""
from alembic import op
import sqlalchemy as sa

revision = '7c33d8eec679'
down_revision = 'b1e4f7a29c03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pharmacy_settings',
        sa.Column(
            'digital_use_default_header', sa.Boolean(), nullable=False, server_default='true'
        ),
    )
    op.add_column(
        'pharmacy_settings', sa.Column('digital_header_image_url', sa.Text(), nullable=True)
    )
    op.add_column(
        'pharmacy_settings', sa.Column('digital_footer_image_url', sa.Text(), nullable=True)
    )
    op.add_column(
        'pharmacy_settings',
        sa.Column('digital_header_height_px', sa.Integer(), nullable=False, server_default='100'),
    )
    op.add_column(
        'pharmacy_settings',
        sa.Column('digital_footer_height_px', sa.Integer(), nullable=False, server_default='60'),
    )


def downgrade() -> None:
    op.drop_column('pharmacy_settings', 'digital_footer_height_px')
    op.drop_column('pharmacy_settings', 'digital_header_height_px')
    op.drop_column('pharmacy_settings', 'digital_footer_image_url')
    op.drop_column('pharmacy_settings', 'digital_header_image_url')
    op.drop_column('pharmacy_settings', 'digital_use_default_header')
