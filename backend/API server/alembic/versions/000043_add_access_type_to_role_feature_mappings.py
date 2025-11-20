"""Add access_type to role_feature_mappings table

Revision ID: 000043
Revises: 000042
Create Date: 2025-11-16 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000043'
down_revision: Union[str, None] = '000042'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблицы role_feature_mappings
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'role_feature_mappings' in inspector.get_table_names():
        # Проверяем, существует ли уже колонка access_type
        columns = inspector.get_columns('role_feature_mappings')
        has_access_type = any(col['name'] == 'access_type' for col in columns)
        
        if not has_access_type:
            # Добавляем колонку access_type с дефолтным значением 'open'
            op.add_column('role_feature_mappings',
                sa.Column('access_type', sa.String(length=20), nullable=False, server_default='open')
            )
            
            # Создаем индекс для быстрого поиска по типу доступа
            op.create_index('ix_role_feature_mappings_access_type', 'role_feature_mappings', ['access_type'])


def downgrade() -> None:
    # Удаляем колонку access_type
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'role_feature_mappings' in inspector.get_table_names():
        columns = inspector.get_columns('role_feature_mappings')
        has_access_type = any(col['name'] == 'access_type' for col in columns)
        
        if has_access_type:
            # Удаляем индекс
            try:
                op.drop_index('ix_role_feature_mappings_access_type', table_name='role_feature_mappings')
            except:
                pass
            
            # Удаляем колонку
            op.drop_column('role_feature_mappings', 'access_type')

