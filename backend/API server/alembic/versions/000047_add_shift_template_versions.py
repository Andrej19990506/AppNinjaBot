"""add shift_template_versions table

Revision ID: 000047
Revises: 000046
Create Date: 2025-11-20 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000047'
down_revision: Union[str, None] = '000046'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Создаем таблицу версий шаблонов
    op.create_table(
        'shift_template_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('valid_from_date', sa.Date(), nullable=False),
        sa.Column('valid_to_date', sa.Date(), nullable=True),
        sa.Column('max_slots', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('has_senior_slot', sa.Boolean(), default=False),
        sa.Column('template_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['shift_templates.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('template_id', 'version_number', name='uq_template_version')
    )
    
    # Создаем индексы для быстрого поиска
    op.create_index(
        'idx_template_versions_template_date',
        'shift_template_versions',
        ['template_id', 'valid_from_date', 'valid_to_date']
    )


def downgrade() -> None:
    # Удаляем индексы
    op.drop_index('idx_template_versions_template_date', table_name='shift_template_versions')
    
    # Удаляем таблицу
    op.drop_table('shift_template_versions')

