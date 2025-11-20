"""Add company_bots table

Revision ID: 000038_company_bots
Revises: 000037
Create Date: 2025-11-15 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000038_company_bots'
down_revision: Union[str, None] = '000037'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблицы company_bots
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'company_bots' not in inspector.get_table_names():
        # Создаем таблицу company_bots
        op.create_table('company_bots',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('bot_token', sa.String(length=255), nullable=False),
            sa.Column('bot_username', sa.String(length=100), nullable=True),
            sa.Column('bot_id', sa.Integer(), nullable=True),
            sa.Column('group_id', sa.BigInteger(), nullable=True),
            sa.Column('company_name', sa.String(length=255), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('metadata', sa.Text(), nullable=True),  # В БД колонка называется metadata, но в модели используется bot_metadata
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            
            # Внешний ключ
            sa.ForeignKeyConstraint(['group_id'], ['groups.group_id'], name=op.f('fk_company_bots_group_id_groups'), ondelete='SET NULL'),
            
            # Первичный ключ
            sa.PrimaryKeyConstraint('id', name=op.f('pk_company_bots'))
        )
        
        # Создаем индексы
        op.create_index(op.f('ix_company_bots_id'), 'company_bots', ['id'], unique=False)
        op.create_index(op.f('ix_company_bots_bot_token'), 'company_bots', ['bot_token'], unique=True)
        op.create_index(op.f('ix_company_bots_bot_username'), 'company_bots', ['bot_username'], unique=True)
        op.create_index(op.f('ix_company_bots_bot_id'), 'company_bots', ['bot_id'], unique=True)
        op.create_index(op.f('ix_company_bots_group_id'), 'company_bots', ['group_id'], unique=False)


def downgrade() -> None:
    # Удаляем таблицу company_bots
    op.drop_table('company_bots')

