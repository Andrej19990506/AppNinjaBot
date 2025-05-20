"""Add time fields to notifications table

Revision ID: 000016
Revises: 000015
Create Date: 2025-05-19 02:48:18.621280+07:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '000016'
down_revision = '000015'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем поля для управления временем отправки уведомлений
    op.add_column('notifications', sa.Column('send_now', sa.Boolean(), server_default='false', nullable=False, 
                                            comment='Send notification immediately after creation'))
    op.add_column('notifications', sa.Column('use_absolute_time', sa.Boolean(), server_default='false', nullable=False, 
                                            comment='Use absolute time instead of relative to event time'))
    op.add_column('notifications', sa.Column('absolute_time', sa.TIMESTAMP(timezone=True), nullable=True, 
                                            comment='Absolute time for notification if use_absolute_time is true'))
    
    # Индекс для быстрого поиска "немедленных" уведомлений
    op.create_index(op.f('ix_notifications_send_now'), 'notifications', ['send_now'], unique=False)


def downgrade():
    # Удаляем добавленные поля в обратном порядке
    op.drop_index(op.f('ix_notifications_send_now'), table_name='notifications')
    op.drop_column('notifications', 'absolute_time')
    op.drop_column('notifications', 'use_absolute_time')
    op.drop_column('notifications', 'send_now') 