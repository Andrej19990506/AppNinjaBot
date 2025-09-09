"""Rename json_inventory_additions to json_inventory_notes

Revision ID: 000031
Revises: 000030
Create Date: 2025-01-09 18:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000031'
down_revision: Union[str, None] = '000030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Переименовываем колонку json_inventory_additions в json_inventory_notes
    op.alter_column(
        'groups',
        'json_inventory_additions',
        new_column_name='json_inventory_notes',
        comment='Stores item notes that persist across inventory template resets'
    )


def downgrade() -> None:
    # Возвращаем старое название колонки
    op.alter_column(
        'groups',
        'json_inventory_notes',
        new_column_name='json_inventory_additions',
        comment='Group-specific item additions (JSON object)'
    )
