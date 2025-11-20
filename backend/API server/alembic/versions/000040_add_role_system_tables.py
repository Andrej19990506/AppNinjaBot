"""Add role system tables (bot_features, company_roles, group_role_mappings, role_feature_mappings, group_feature_notifications)

Revision ID: 000040
Revises: 000039
Create Date: 2025-11-16 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000040'
down_revision: Union[str, None] = '000039'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблиц
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # 1. Создаем таблицу bot_features
    if 'bot_features' not in existing_tables:
        op.create_table('bot_features',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('feature_code', sa.String(length=50), nullable=False),
            sa.Column('feature_name', sa.String(length=100), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('icon', sa.String(length=50), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_bot_features'))
        )
        op.create_index(op.f('ix_bot_features_id'), 'bot_features', ['id'], unique=False)
        op.create_index(op.f('ix_bot_features_feature_code'), 'bot_features', ['feature_code'], unique=True)
    
    # 2. Создаем таблицу company_roles
    if 'company_roles' not in existing_tables:
        op.create_table('company_roles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('company_bot_id', sa.Integer(), nullable=False),
            sa.Column('role_name', sa.String(length=100), nullable=False),
            sa.Column('role_code', sa.String(length=50), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('icon', sa.String(length=50), nullable=True),
            sa.Column('color', sa.String(length=20), nullable=True),
            sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('permissions', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['company_bot_id'], ['company_bots.id'], name=op.f('fk_company_roles_company_bot_id_company_bots'), ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_company_roles'))
        )
        op.create_index(op.f('ix_company_roles_id'), 'company_roles', ['id'], unique=False)
        op.create_index(op.f('ix_company_roles_company_bot_id'), 'company_roles', ['company_bot_id'], unique=False)
        op.create_index(op.f('ix_company_roles_role_code'), 'company_roles', ['role_code'], unique=False)
        op.create_index('ix_company_roles_company_bot_code', 'company_roles', ['company_bot_id', 'role_code'], unique=True)
        op.create_index('ix_company_roles_company_bot_name', 'company_roles', ['company_bot_id', 'role_name'], unique=False)
    
    # 3. Создаем таблицу group_role_mappings
    if 'group_role_mappings' not in existing_tables:
        op.create_table('group_role_mappings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.BigInteger(), nullable=False),
            sa.Column('company_role_id', sa.Integer(), nullable=False),
            sa.Column('is_working_group', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['group_id'], ['groups.group_id'], name=op.f('fk_group_role_mappings_group_id_groups'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['company_role_id'], ['company_roles.id'], name=op.f('fk_group_role_mappings_company_role_id_company_roles'), ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_group_role_mappings')),
            sa.UniqueConstraint('group_id', 'company_role_id', name='uq_group_role_mapping')
        )
        op.create_index(op.f('ix_group_role_mappings_id'), 'group_role_mappings', ['id'], unique=False)
        op.create_index('ix_group_role_mappings_group_id', 'group_role_mappings', ['group_id'], unique=False)
        op.create_index('ix_group_role_mappings_company_role_id', 'group_role_mappings', ['company_role_id'], unique=False)
        op.create_index('ix_group_role_mappings_is_working_group', 'group_role_mappings', ['is_working_group'], unique=False)
    
    # 4. Создаем таблицу role_feature_mappings
    if 'role_feature_mappings' not in existing_tables:
        op.create_table('role_feature_mappings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('company_role_id', sa.Integer(), nullable=False),
            sa.Column('bot_feature_id', sa.Integer(), nullable=False),
            sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['company_role_id'], ['company_roles.id'], name=op.f('fk_role_feature_mappings_company_role_id_company_roles'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['bot_feature_id'], ['bot_features.id'], name=op.f('fk_role_feature_mappings_bot_feature_id_bot_features'), ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_role_feature_mappings')),
            sa.UniqueConstraint('company_role_id', 'bot_feature_id', name='uq_role_feature_mapping')
        )
        op.create_index(op.f('ix_role_feature_mappings_id'), 'role_feature_mappings', ['id'], unique=False)
        op.create_index('ix_role_feature_mappings_company_role_id', 'role_feature_mappings', ['company_role_id'], unique=False)
        op.create_index('ix_role_feature_mappings_bot_feature_id', 'role_feature_mappings', ['bot_feature_id'], unique=False)
    
    # 5. Создаем таблицу group_feature_notifications
    if 'group_feature_notifications' not in existing_tables:
        op.create_table('group_feature_notifications',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('bot_feature_id', sa.Integer(), nullable=False),
            sa.Column('working_group_id', sa.BigInteger(), nullable=False),
            sa.Column('notification_group_id', sa.BigInteger(), nullable=False),
            sa.Column('notification_type', sa.String(length=50), nullable=True, server_default='excel'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['bot_feature_id'], ['bot_features.id'], name=op.f('fk_group_feature_notifications_bot_feature_id_bot_features'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['working_group_id'], ['groups.group_id'], name=op.f('fk_group_feature_notifications_working_group_id_groups'), ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['notification_group_id'], ['groups.group_id'], name=op.f('fk_group_feature_notifications_notification_group_id_groups'), ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_group_feature_notifications')),
            sa.UniqueConstraint('bot_feature_id', 'working_group_id', 'notification_group_id', name='uq_group_feature_notification')
        )
        op.create_index(op.f('ix_group_feature_notifications_id'), 'group_feature_notifications', ['id'], unique=False)
        op.create_index('ix_group_feature_notifications_bot_feature_id', 'group_feature_notifications', ['bot_feature_id'], unique=False)
        op.create_index('ix_group_feature_notifications_working_group_id', 'group_feature_notifications', ['working_group_id'], unique=False)
        op.create_index('ix_group_feature_notifications_notification_group_id', 'group_feature_notifications', ['notification_group_id'], unique=False)


def downgrade() -> None:
    # Удаляем таблицы в обратном порядке
    op.drop_table('group_feature_notifications')
    op.drop_table('role_feature_mappings')
    op.drop_table('group_role_mappings')
    op.drop_table('company_roles')
    op.drop_table('bot_features')









