"""Add slot_config to groups

Revision ID: 000002
Revises: 000001
Create Date: 2025-04-08 11:00:00.000000 # Можешь поставить актуальное время

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000002'
down_revision: Union[str, None] = '000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add slot_config column to groups table."""
    op.add_column('groups', 
        sa.Column('slot_config', 
                  postgresql.JSONB(astext_type=sa.Text()), 
                  nullable=True, 
                  server_default=sa.text("'{}'::jsonb")
                 )
    )


def downgrade() -> None:
    """Remove slot_config column from groups table."""
    op.drop_column('groups', 'slot_config')
