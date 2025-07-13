from alembic import op
import sqlalchemy as sa
from typing import Sequence, Union

# revision identifiers
revision: str = '000023'
down_revision: Union[str, None] = '000022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    """Remove status column from write_offs table."""
    op.drop_column('write_offs', 'status')

def downgrade():
    """Add status column back to write_offs table."""
    op.add_column('write_offs', sa.Column('status', sa.String(32), nullable=False, server_default='pending')) 