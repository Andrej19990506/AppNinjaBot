"""
add group_type to events
"""
from alembic import op
import sqlalchemy as sa
from typing import Sequence, Union

revision: str = '000019'
down_revision: Union[str, None] = '000018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.add_column('events', sa.Column('group_type', sa.String(length=50), nullable=True, index=True, comment='Тип группы (chef, courier, admin и т.д.)'))

def downgrade():
    op.drop_column('events', 'group_type')