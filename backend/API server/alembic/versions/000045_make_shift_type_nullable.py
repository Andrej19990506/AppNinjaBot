"""make shift_type nullable in shifts table

Revision ID: 000045
Revises: 000044
Create Date: 2025-11-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '000045'
down_revision = '000044'
branch_labels = None
depends_on = None


def upgrade():
    # Проверяем существование таблицы shifts
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'shifts' not in existing_tables:
        print("Table 'shifts' does not exist, skipping migration")
        return
    
    # Получаем информацию о колонке shift_type
    columns = inspector.get_columns('shifts')
    shift_type_column = next((col for col in columns if col['name'] == 'shift_type'), None)
    
    if shift_type_column is None:
        print("Column 'shift_type' does not exist in 'shifts' table, skipping migration")
        return
    
    # Если колонка уже nullable, ничего не делаем
    if shift_type_column['nullable']:
        print("Column 'shift_type' is already nullable, skipping migration")
        return
    
    # Изменяем колонку shift_type на nullable
    # В PostgreSQL нужно использовать ALTER COLUMN
    op.alter_column('shifts', 'shift_type',
                    existing_type=sa.String(),
                    nullable=True,
                    existing_nullable=False)


def downgrade():
    # Проверяем существование таблицы shifts
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'shifts' not in existing_tables:
        print("Table 'shifts' does not exist, skipping downgrade")
        return
    
    # Получаем информацию о колонке shift_type
    columns = inspector.get_columns('shifts')
    shift_type_column = next((col for col in columns if col['name'] == 'shift_type'), None)
    
    if shift_type_column is None:
        print("Column 'shift_type' does not exist in 'shifts' table, skipping downgrade")
        return
    
    # Если колонка уже not nullable, ничего не делаем
    if not shift_type_column['nullable']:
        print("Column 'shift_type' is already not nullable, skipping downgrade")
        return
    
    # ВНИМАНИЕ: При откате миграции нужно установить значение по умолчанию для NULL значений
    # Устанавливаем 'day' для всех NULL значений перед изменением колонки
    op.execute("""
        UPDATE shifts 
        SET shift_type = 'day' 
        WHERE shift_type IS NULL
    """)
    
    # Изменяем колонку shift_type обратно на not nullable
    op.alter_column('shifts', 'shift_type',
                    existing_type=sa.String(),
                    nullable=False,
                    existing_nullable=True)

