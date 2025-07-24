"""Add victory_description to competitions table

Revision ID: 000029
Revises: 000028
Create Date: 2025-01-21 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '000029'
down_revision: Union[str, None] = '000028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем колонку victory_description в таблицу competitions
    op.add_column('competitions', 
        sa.Column('victory_description', sa.Text(), nullable=True, 
                  comment='Описание победы (показывается после завершения конкурса)')
    )


def downgrade() -> None:
    # Удаляем колонку victory_description
    op.drop_column('competitions', 'victory_description') 