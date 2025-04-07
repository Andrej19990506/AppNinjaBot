"""link reserve to member instead of user

Revision ID: ccca6cbe861b
Revises: abc894d43a47
Create Date: 2024-03-31 19:25:44.442724

"""
from alembic import op
import sqlalchemy as sa
from typing import Union


# revision identifiers, used by Alembic.
revision: str = 'ccca6cbe861b'
down_revision: Union[str, None] = 'abc894d43a47'
branch_labels = None
depends_on = None


def upgrade():
    # Пропускаем удаление несуществующих индексов и таблиц
    try:
        # Проверяем, существует ли таблица reserve
        connection = op.get_bind()
        result = connection.execute(sa.text("SELECT to_regclass('public.reserve')"))
        
        if result.scalar() is not None:
            # Добавляем колонку member_id если она не существует
            columns = connection.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name = 'reserve' AND column_name = 'member_id'"))
            if not columns.fetchone():
                op.add_column('reserve', sa.Column('member_id', sa.Integer(), nullable=True))
                
                # Создаем связь с member
                op.create_foreign_key(
                    'fk_reserve_member_id', 'reserve', 'members',
                    ['member_id'], ['id'], ondelete='CASCADE'
                )
    except Exception as e:
        print(f"Error in migration: {e}")
        # Продолжаем выполнение


def downgrade():
    # Удаляем связи и колонки
    try:
        op.drop_constraint('fk_reserve_member_id', 'reserve', type_='foreignkey')
        op.drop_column('reserve', 'member_id')
    except Exception as e:
        print(f"Error in downgrade: {e}") 