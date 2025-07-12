"""add photo_path to write_offs

Revision ID: 000021
Revises: 000020
Create Date: 2024-01-15 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '000021'
down_revision = '000020'
branch_labels = None
depends_on = None

def upgrade():
    # Add photo_path column to write_offs table
    op.add_column('write_offs', 
        sa.Column('photo_path', sa.String(500), nullable=True, comment='Путь к фото списания')
    )

def downgrade():
    # Remove photo_path column from write_offs table
    op.drop_column('write_offs', 'photo_path') 