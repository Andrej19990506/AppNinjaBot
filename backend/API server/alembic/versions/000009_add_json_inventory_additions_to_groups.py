"""Add json_inventory_additions to groups table

Revision ID: 9a8b7c6d5e4f
Revises: 000008_change_shifts_date_type
Create Date: 2024-05-16 15:00:00.000000 # Можешь поставить актуальную дату/время

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9a8b7c6d5e4f' # Сгенерированный ID
down_revision: Union[str, None] = '000008' # <-- Указываем ID предыдущей ревизии
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем колонку json_inventory_additions типа JSONB, nullable=True
    op.add_column(
        'groups',
        sa.Column(
            'json_inventory_additions',
            postgresql.JSONB(astext_type=sa.Text()), # Используем JSONB для эффективности
            nullable=True,
            comment='Group-specific item additions (JSON object)' # Добавляем комментарий
        )
    )
    # Можно добавить индекс, если предполагается частый поиск по этому полю,
    # но для начала можно обойтись без него.
    # op.create_index(op.f('ix_groups_json_inventory_additions'), 'groups', ['json_inventory_additions'], unique=False, postgresql_using='gin')


def downgrade() -> None:
    # Удаляем индекс, если создавали его в upgrade
    # op.drop_index(op.f('ix_groups_json_inventory_additions'), table_name='groups')
    # Удаляем колонку
    op.drop_column('groups', 'json_inventory_additions')
