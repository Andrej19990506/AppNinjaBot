"""Add events table

Revision ID: 000010 # Оставь этот ID или сгенерируй новый, если нужно
Revises: 9a8b7c6d5e4f
Create Date: 2024-07-27 12:00:00.000000 # Замени на актуальную дату/время

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
# Импортируем JSONB для PostgreSQL
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000010' # Или новый уникальный ID
down_revision: Union[str, None] = '9a8b7c6d5e4f' # ID предыдущей миграции
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('events',
        sa.Column('id', sa.Integer(), nullable=False, comment='Уникальный идентификатор события'),
        sa.Column('description', sa.Text(), nullable=False, comment='Описание события'),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False, comment='Дата и время события (с таймзоной)'),
        sa.Column('repeat_type', sa.String(length=50), server_default='none', nullable=False, comment='Тип повтора (none, daily, weekly, monthly)'),
        sa.Column('repeat_weekdays', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Дни недели для еженедельного повтора (JSONB массив int [0-6])'),
        sa.Column('repeat_month_day', sa.Integer(), nullable=True, comment='День месяца для ежемесячного повтора (int 1-31)'),
        sa.Column('notifications', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False, comment='Настройки уведомлений (JSONB массив объектов {"message": str, "time": int})'),
        sa.Column('chat_ids', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False, comment='Список ID чатов для отправки (JSONB массив int)'),
        sa.Column('is_active', sa.Boolean(), server_default='t', nullable=False, comment='Флаг активности события для планировщика'),
        sa.Column('last_check', sa.DateTime(timezone=True), nullable=True, comment='Время последней проверки/обработки планировщиком'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Время создания записи'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()'), comment='Время последнего обновления записи'), # Добавил onupdate через sa.text
        sa.PrimaryKeyConstraint('id')
    )
    # Создаем индексы
    op.create_index(op.f('ix_events_date'), 'events', ['date'], unique=False)
    op.create_index(op.f('ix_events_id'), 'events', ['id'], unique=False) # Индекс по PK обычно создается автоматически, но для единообразия можно оставить
    op.create_index(op.f('ix_events_is_active'), 'events', ['is_active'], unique=False)
    op.create_index(op.f('ix_events_repeat_type'), 'events', ['repeat_type'], unique=False)


def downgrade() -> None:
    # Удаляем индексы
    op.drop_index(op.f('ix_events_repeat_type'), table_name='events')
    op.drop_index(op.f('ix_events_is_active'), table_name='events')
    op.drop_index(op.f('ix_events_id'), table_name='events')
    op.drop_index(op.f('ix_events_date'), table_name='events')
    # Удаляем таблицу
    op.drop_table('events')
