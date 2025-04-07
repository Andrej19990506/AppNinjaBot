"""add is_senior_courier column to members table

Revision ID: 63dc19a320b9
Revises: b95b5dc5a6f4
Create Date: 2024-03-31 19:20:12.442724

"""
from alembic import op
import sqlalchemy as sa
from typing import Union


# revision identifiers, used by Alembic.
revision: str = '63dc19a320b9'
down_revision: Union[str, None] = 'b95b5dc5a6f4'
branch_labels = None
depends_on = None


def upgrade():
    # Пропускаем удаление несуществующих индексов и таблиц
    try:
        # Проверяем, существует ли таблица members
        connection = op.get_bind()
        result = connection.execute(sa.text("SELECT to_regclass('public.members')"))
        if result.scalar() is None:
            # Создаем таблицу members если не существует
            op.create_table('members',
                sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
                sa.Column('user_id', sa.BIGINT(), autoincrement=False, nullable=False),
                sa.Column('username', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
                sa.Column('first_name', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
                sa.Column('last_name', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
                sa.Column('status', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
                sa.Column('is_bot', sa.BOOLEAN(), autoincrement=False, nullable=True),
                sa.Column('joined_at', sa.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
                sa.Column('photo_url', sa.TEXT(), autoincrement=False, nullable=True),
                sa.Column('metadata', sa.JSON(), autoincrement=False, nullable=True),
                sa.PrimaryKeyConstraint('id', name='members_pkey'),
                sa.UniqueConstraint('user_id', name='members_user_id_key')
            )
            
        # Добавляем колонку is_senior_courier если она не существует
        columns = connection.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'is_senior_courier'"))
        if not columns.fetchone():
            op.add_column('members', sa.Column('is_senior_courier', sa.Boolean(), nullable=True, server_default='false'))
    except Exception as e:
        print(f"Error in migration: {e}")
        # Продолжаем выполнение


def downgrade():
    # Удаляем колонку is_senior_courier
    try:
        op.drop_column('members', 'is_senior_courier')
    except Exception as e:
        print(f"Error in downgrade: {e}") 