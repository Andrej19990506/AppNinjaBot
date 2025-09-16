"""add notes to delivery_items

Revision ID: 000034
Revises: 000033
Create Date: 2025-01-17 06:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '000034'
down_revision = '000033'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем колонку notes в таблицу delivery_items
    op.add_column('delivery_items', 
        sa.Column('notes', sa.Text(), nullable=True, comment='Заметки к товару')
    )


def downgrade():
    # Удаляем колонку notes из таблицы delivery_items
    op.drop_column('delivery_items', 'notes')
