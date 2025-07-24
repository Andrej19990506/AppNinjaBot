"""Add group_id to competition_winners table

Revision ID: 000028
Revises: 000027
Create Date: 2025-01-21 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '000028'
down_revision: Union[str, None] = '000027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем колонку group_id в таблицу competition_winners
    op.add_column('competition_winners', 
        sa.Column('group_id', sa.BigInteger(), nullable=True, index=True, 
                  comment='ID группы (может быть null для пользователей)')
    )
    
    # Делаем user_id nullable, так как теперь может быть либо user_id, либо group_id
    op.alter_column('competition_winners', 'user_id',
                    existing_type=sa.BigInteger(),
                    nullable=True,
                    comment='ID пользователя (может быть null для групп)')


def downgrade() -> None:
    # Возвращаем user_id как NOT NULL
    op.alter_column('competition_winners', 'user_id',
                    existing_type=sa.BigInteger(),
                    nullable=False)
    
    # Удаляем колонку group_id
    op.drop_column('competition_winners', 'group_id') 