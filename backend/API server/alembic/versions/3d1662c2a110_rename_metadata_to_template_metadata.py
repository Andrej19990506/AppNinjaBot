"""rename metadata to template_metadata

Revision ID: 3d1662c2a110
Revises: 000035
Create Date: 2025-10-23 02:43:07.883076

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '3d1662c2a110'
down_revision: Union[str, None] = '000035'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    result = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'shift_templates'
              AND column_name = 'metadata'
            """
        )
    ).first()

    if result:
        op.alter_column('shift_templates', 'metadata', new_column_name='template_metadata')


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    result = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'shift_templates'
              AND column_name = 'template_metadata'
            """
        )
    ).first()

    if result:
        op.alter_column('shift_templates', 'template_metadata', new_column_name='metadata')
