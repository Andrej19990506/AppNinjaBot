"""Add user_permissions table for temporary user permissions

Revision ID: 000025
Revises: 000023
Create Date: 2025-01-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000025'
down_revision: Union[str, None] = '000023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблицы user_permissions
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'user_permissions' not in inspector.get_table_names():
        # Создаем таблицу user_permissions только если она не существует
        op.create_table('user_permissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.BigInteger(), nullable=False),
            sa.Column('group_id', sa.BigInteger(), nullable=False),
            sa.Column('permission_type', sa.String(50), nullable=False),
            sa.Column('granted_by', sa.BigInteger(), nullable=False),
            sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('revoked_by', sa.BigInteger(), nullable=True),
            
            # Внешние ключи
            sa.ForeignKeyConstraint(['user_id'], ['members.user_id'], name=op.f('fk_user_permissions_user_id_members'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['group_id'], ['groups.group_id'], name=op.f('fk_user_permissions_group_id_groups'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['granted_by'], ['members.user_id'], name=op.f('fk_user_permissions_granted_by_members'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['revoked_by'], ['members.user_id'], name=op.f('fk_user_permissions_revoked_by_members'), ondelete='SET NULL'),
            
            # Первичный ключ
            sa.PrimaryKeyConstraint('id', name=op.f('pk_user_permissions'))
        )
        
        # Создаем индексы для быстрого поиска
        op.create_index(op.f('ix_user_permissions_id'), 'user_permissions', ['id'], unique=False)
        op.create_index(op.f('ix_user_permissions_user_id'), 'user_permissions', ['user_id'], unique=False)
        op.create_index(op.f('ix_user_permissions_group_id'), 'user_permissions', ['group_id'], unique=False)
        op.create_index(op.f('ix_user_permissions_permission_type'), 'user_permissions', ['permission_type'], unique=False)
        op.create_index(op.f('ix_user_permissions_expires_at'), 'user_permissions', ['expires_at'], unique=False)
        op.create_index(op.f('ix_user_permissions_is_active'), 'user_permissions', ['is_active'], unique=False)
        
        # Составной индекс для быстрого поиска активных прав пользователя в группе
        op.create_index('ix_user_permissions_user_group_active', 'user_permissions', ['user_id', 'group_id', 'is_active'], unique=False)
        
        # Ограничение на допустимые типы разрешений
        op.create_check_constraint(
            'ck_user_permissions_permission_type_values',
            'user_permissions',
            "permission_type IN ('inventory', 'writeoff', 'events')"
        )


def downgrade() -> None:
    # Удаляем таблицу user_permissions
    op.drop_table('user_permissions') 