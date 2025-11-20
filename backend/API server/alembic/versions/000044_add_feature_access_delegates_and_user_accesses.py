"""Add feature_access_delegates and feature_user_accesses tables

Revision ID: 000044
Revises: 000043
Create Date: 2025-11-16 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000044'
down_revision: Union[str, None] = '000043'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблиц
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # 1. Создаем таблицу feature_access_delegates
    if 'feature_access_delegates' not in existing_tables:
        op.create_table('feature_access_delegates',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('role_feature_mapping_id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.BigInteger(), nullable=False),
            sa.Column('delegate_user_id', sa.BigInteger(), nullable=False),
            sa.Column('created_by_user_id', sa.BigInteger(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['role_feature_mapping_id'], ['role_feature_mappings.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['group_id'], ['groups.group_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_feature_access_delegates')),
            sa.UniqueConstraint('role_feature_mapping_id', 'group_id', 'delegate_user_id', name='uq_feature_access_delegate')
        )
        op.create_index('ix_feature_access_delegates_role_feature_mapping_id', 'feature_access_delegates', ['role_feature_mapping_id'])
        op.create_index('ix_feature_access_delegates_group_id', 'feature_access_delegates', ['group_id'])
        op.create_index('ix_feature_access_delegates_delegate_user_id', 'feature_access_delegates', ['delegate_user_id'])
    
    # 2. Создаем таблицу feature_user_accesses
    if 'feature_user_accesses' not in existing_tables:
        op.create_table('feature_user_accesses',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('role_feature_mapping_id', sa.Integer(), nullable=False),
            sa.Column('group_id', sa.BigInteger(), nullable=False),
            sa.Column('user_id', sa.BigInteger(), nullable=False),
            sa.Column('granted_by_user_id', sa.BigInteger(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['role_feature_mapping_id'], ['role_feature_mappings.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['group_id'], ['groups.group_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_feature_user_accesses')),
            sa.UniqueConstraint('role_feature_mapping_id', 'group_id', 'user_id', name='uq_feature_user_access')
        )
        op.create_index('ix_feature_user_accesses_role_feature_mapping_id', 'feature_user_accesses', ['role_feature_mapping_id'])
        op.create_index('ix_feature_user_accesses_group_id', 'feature_user_accesses', ['group_id'])
        op.create_index('ix_feature_user_accesses_user_id', 'feature_user_accesses', ['user_id'])
        op.create_index('ix_feature_user_accesses_granted_by_user_id', 'feature_user_accesses', ['granted_by_user_id'])


def downgrade() -> None:
    # Удаляем таблицы в обратном порядке
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'feature_user_accesses' in existing_tables:
        op.drop_table('feature_user_accesses')
    
    if 'feature_access_delegates' in existing_tables:
        op.drop_table('feature_access_delegates')

