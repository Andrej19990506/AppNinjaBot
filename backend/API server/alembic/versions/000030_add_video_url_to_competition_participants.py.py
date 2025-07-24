"""Add video_url to competition_participants

Revision ID: 000027
Revises: 000026
Create Date: 2025-07-24 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '000030'
down_revision = '000029'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('competition_participants',
        sa.Column('video_url', sa.String(length=500), nullable=True, comment='Ссылка на видео участника')
    )

def downgrade():
    op.drop_column('competition_participants', 'video_url') 