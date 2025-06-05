from alembic import op
import sqlalchemy as sa
from typing import Sequence, Union

revision: str = '000020'
down_revision: Union[str, None] = '000019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.create_table(
        'write_offs',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('group_id', sa.BigInteger, sa.ForeignKey('groups.group_id'), nullable=False),
        sa.Column('user_id', sa.BigInteger, sa.ForeignKey('members.user_id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('reason', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Float, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('unit_type', sa.String(10), nullable=False, server_default='шт'),
        sa.Column('status', sa.String(32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

def downgrade():
    op.drop_table('write_offs') 