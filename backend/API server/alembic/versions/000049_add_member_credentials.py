"""add member login/password fields

Revision ID: 000049
Revises: 000048
Create Date: 2026-03-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '000049'
down_revision: Union[str, None] = '000048'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('members', sa.Column('login', sa.String(length=255), nullable=True))
    op.add_column('members', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.create_index('ix_members_login', 'members', ['login'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_members_login', table_name='members')
    op.drop_column('members', 'password_hash')
    op.drop_column('members', 'login')

