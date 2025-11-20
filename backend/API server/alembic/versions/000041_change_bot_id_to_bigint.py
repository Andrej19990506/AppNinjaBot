"""Change bot_id to BigInteger in company_bots table

Revision ID: 000041
Revises: 000040
Create Date: 2025-11-16 01:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '000041'
down_revision: Union[str, None] = '000040'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Проверяем существование таблицы company_bots
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'company_bots' in inspector.get_table_names():
        # Получаем информацию о колонке bot_id
        columns = inspector.get_columns('company_bots')
        bot_id_column = next((col for col in columns if col['name'] == 'bot_id'), None)
        
        if bot_id_column:
            # Проверяем текущий тип колонки
            current_type = str(bot_id_column['type'])
            
            # Если тип INTEGER, меняем на BIGINT
            if 'INTEGER' in current_type.upper() or 'INT' in current_type.upper():
                # Удаляем индекс перед изменением типа (если он существует)
                try:
                    op.drop_index('ix_company_bots_bot_id', table_name='company_bots')
                except:
                    pass
                
                # Меняем тип колонки на BIGINT
                op.alter_column('company_bots', 'bot_id',
                              existing_type=sa.Integer(),
                              type_=sa.BigInteger(),
                              existing_nullable=True)
                
                # Восстанавливаем индекс
                op.create_index('ix_company_bots_bot_id', 'company_bots', ['bot_id'], unique=True)


def downgrade() -> None:
    # Откатываем изменение: меняем BIGINT обратно на INTEGER
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'company_bots' in inspector.get_table_names():
        columns = inspector.get_columns('company_bots')
        bot_id_column = next((col for col in columns if col['name'] == 'bot_id'), None)
        
        if bot_id_column:
            current_type = str(bot_id_column['type'])
            
            # Если тип BIGINT, меняем обратно на INTEGER
            if 'BIGINT' in current_type.upper():
                # Удаляем индекс перед изменением типа
                try:
                    op.drop_index('ix_company_bots_bot_id', table_name='company_bots')
                except:
                    pass
                
                # Меняем тип колонки обратно на INTEGER
                op.alter_column('company_bots', 'bot_id',
                              existing_type=sa.BigInteger(),
                              type_=sa.Integer(),
                              existing_nullable=True)
                
                # Восстанавливаем индекс
                op.create_index('ix_company_bots_bot_id', 'company_bots', ['bot_id'], unique=True)

