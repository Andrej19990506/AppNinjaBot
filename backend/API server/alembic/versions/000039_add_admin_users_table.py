"""Add admin_users table for admin panel authentication

Revision ID: 000039
Revises: 000038_company_bots
Create Date: 2025-11-15 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000039'
down_revision: Union[str, None] = '000038_company_bots'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблицы admin_users
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'admin_users' not in inspector.get_table_names():
        # Создаем enum для роли администратора
        admin_role_enum = postgresql.ENUM('super_admin', 'company_admin', name='adminrole')
        admin_role_enum.create(op.get_bind(), checkfirst=True)
        
        # Создаем таблицу admin_users
        op.create_table('admin_users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('role', postgresql.ENUM('super_admin', 'company_admin', name='adminrole', create_type=False), nullable=False, server_default='company_admin'),
            sa.Column('company_bot_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(length=255), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
            
            # Внешний ключ
            sa.ForeignKeyConstraint(['company_bot_id'], ['company_bots.id'], name=op.f('fk_admin_users_company_bot_id_company_bots'), ondelete='CASCADE'),
            
            # Первичный ключ
            sa.PrimaryKeyConstraint('id', name=op.f('pk_admin_users'))
        )
        
        # Создаем индексы
        op.create_index(op.f('ix_admin_users_id'), 'admin_users', ['id'], unique=False)
        op.create_index(op.f('ix_admin_users_email'), 'admin_users', ['email'], unique=True)
        op.create_index(op.f('ix_admin_users_company_bot_id'), 'admin_users', ['company_bot_id'], unique=False)


def downgrade() -> None:
    # Удаляем таблицу admin_users
    op.drop_table('admin_users')
    
    # Удаляем enum (если больше не используется)
    # Внимание: проверьте, что enum не используется в других таблицах
    try:
        op.execute("DROP TYPE IF EXISTS adminrole")
    except Exception:
        pass

