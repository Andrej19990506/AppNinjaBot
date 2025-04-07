"""add group_type column to groups table

Revision ID: a91108c08bf8
Revises: b95b5dc5a6f4
Create Date: 2024-03-31 19:34:31.442724

"""
from alembic import op
import sqlalchemy as sa
from typing import Union


# revision identifiers, used by Alembic.
revision: str = 'a91108c08bf8'
down_revision: Union[str, None] = 'b95b5dc5a6f4'
branch_labels = None
depends_on = None


def upgrade():
    # Сначала проверяем наличие таблицы groups и создаем ее если нет
    try:
        connection = op.get_bind()
        result = connection.execute(sa.text("SELECT to_regclass('public.groups')"))
        if result.scalar() is None:
            # Таблица не существует, создаем ее
            op.create_table('groups',
            sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
            sa.Column('group_id', sa.BIGINT(), autoincrement=False, nullable=False),
            sa.Column('title', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
            sa.Column('username', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
            sa.Column('description', sa.VARCHAR(), autoincrement=False, nullable=True),
            sa.Column('members_count', sa.INTEGER(), autoincrement=False, nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
            sa.Column('metadata', sa.JSON(), autoincrement=False, nullable=True),
            sa.PrimaryKeyConstraint('id', name='groups_pkey'),
            sa.UniqueConstraint('group_id', name='uq_group_group_id')
            )
            
            # Создаем таблицу members если не существует
            connection.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS members (
                    id SERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL UNIQUE,
                    username VARCHAR(255),
                    first_name VARCHAR(255),
                    last_name VARCHAR(255),
                    status VARCHAR(50) NOT NULL,
                    is_bot BOOLEAN DEFAULT FALSE,
                    is_senior_courier BOOLEAN DEFAULT FALSE,
                    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    photo_url TEXT,
                    metadata JSONB DEFAULT '{}'::jsonb
                )
            """))
            
            # Создаем таблицу group_members если не существует
            connection.execute(sa.text("""
                CREATE TABLE IF NOT EXISTS group_members (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
                    role VARCHAR(50) DEFAULT 'member',
                    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    UNIQUE(group_id, member_id)
                )
            """))
    except Exception as e:
        print(f"Error checking or creating tables: {e}")
        # Продолжаем выполнение, даже если произошла ошибка
        
    # Добавляем столбец group_type
    try:
        op.add_column('groups', sa.Column('group_type', sa.String(length=50), nullable=True))
        op.execute("UPDATE groups SET group_type = 'general' WHERE group_type IS NULL")
        op.alter_column('groups', 'group_type', nullable=False)
    except Exception as e:
        print(f"Error adding group_type column: {e}")
        # Продолжаем выполнение, даже если произошла ошибка


def downgrade():
    op.drop_column('groups', 'group_type') 