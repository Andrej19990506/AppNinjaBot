"""Change shifts.date column type from String to Date

Revision ID: 000008
Revises: 000007
Create Date: 2024-04-27 10:00:00.000000 # Placeholder time

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000008'
down_revision: Union[str, None] = '000007' # Указываем предыдущую ревизию
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Меняем тип колонки shifts.date с VARCHAR на DATE."""
    op.alter_column(
        'shifts',
        'date',
        existing_type=sa.String(),
        type_=sa.Date(),
        nullable=False,
        # Используем postgresql_using для явного преобразования данных
        # Убедитесь, что все строки в shifts.date имеют формат 'YYYY-MM-DD'
        postgresql_using='date::date'
    )


def downgrade() -> None:
    """Возвращаем тип колонки shifts.date обратно на VARCHAR."""
    op.alter_column(
        'shifts',
        'date',
        existing_type=sa.Date(),
        type_=sa.String(),
        nullable=False,
        # Преобразуем DATE обратно в VARCHAR (текстовое представление)
        postgresql_using='date::text'
    ) 