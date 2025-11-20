"""Add default bot features

Revision ID: 000042
Revises: 000041
Create Date: 2025-11-16 02:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '000042'
down_revision: Union[str, None] = '000041'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем дефолтные функции бота, если их еще нет
    conn = op.get_bind()
    
    # Проверяем, есть ли уже функции
    result = conn.execute(sa.text("SELECT COUNT(*) FROM bot_features"))
    count = result.scalar()
    
    if count == 0:
        # Вставляем дефолтные функции
        conn.execute(sa.text("""
            INSERT INTO bot_features (feature_code, feature_name, description, icon, is_active)
            VALUES 
                ('inventory', 'Инвентаризация', 'Управление инвентаризацией товаров', '📦', true),
                ('write-off', 'Списание', 'Управление списанием товаров', '🗑️', true),
                ('shifts', 'Смены', 'Управление сменами сотрудников', '🕐', true),
                ('purchasing', 'Закупки', 'Управление закупками товаров', '🛒', true),
                ('notifications', 'Уведомления', 'Отправка уведомлений в группы', '🔔', true),
                ('events', 'События', 'Управление событиями', '📅', true),
                ('courier-schedule', 'Расписание курьеров', 'Запись на смены курьеров', '🚴', true)
            ON CONFLICT (feature_code) DO NOTHING
        """))
        conn.commit()


def downgrade() -> None:
    # Удаляем дефолтные функции (опционально, можно оставить)
    pass

