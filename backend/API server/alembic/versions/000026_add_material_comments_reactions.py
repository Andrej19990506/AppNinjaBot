"""Add material comments and reactions tables

Revision ID: 000026
Revises: 000025
Create Date: 2025-01-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000026'
down_revision: Union[str, None] = '000025'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Создаем таблицу material_comments
    op.create_table('material_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False, comment='ID обучающего материала'),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False, comment='Текст комментария'),
        sa.Column('reply_to', postgresql.UUID(as_uuid=True), nullable=True, comment='ID комментария-родителя для ответов'),
        sa.Column('edited', sa.Boolean(), nullable=False, server_default='false', comment='Был ли комментарий отредактирован'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        # Внешние ключи
        sa.ForeignKeyConstraint(['user_id'], ['members.user_id'], name=op.f('fk_material_comments_user_id_members')),
        sa.ForeignKeyConstraint(['reply_to'], ['material_comments.id'], name=op.f('fk_material_comments_reply_to_material_comments')),
        
        # Первичный ключ
        sa.PrimaryKeyConstraint('id', name=op.f('pk_material_comments'))
    )
    
    # Индексы для material_comments
    op.create_index('ix_material_comments_material_id', 'material_comments', ['material_id'], unique=False)
    op.create_index('ix_material_comments_user_id', 'material_comments', ['user_id'], unique=False)
    op.create_index('ix_material_comments_reply_to', 'material_comments', ['reply_to'], unique=False)
    op.create_index('ix_material_comments_created_at', 'material_comments', ['created_at'], unique=False)

    # Создаем таблицу material_reactions
    op.create_table('material_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False, comment='ID обучающего материала'),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('emoji', sa.String(length=10), nullable=False, comment='Эмодзи реакции (❤️, 👍, 🔥, etc.)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        # Внешние ключи
        sa.ForeignKeyConstraint(['user_id'], ['members.user_id'], name=op.f('fk_material_reactions_user_id_members')),
        
        # Первичный ключ
        sa.PrimaryKeyConstraint('id', name=op.f('pk_material_reactions')),
        
        # Ограничение уникальности: один пользователь - одна реакция на материал
        sa.UniqueConstraint('material_id', 'user_id', name='uq_material_reaction_user')
    )
    
    # Индексы для material_reactions
    op.create_index('ix_material_reactions_material_id', 'material_reactions', ['material_id'], unique=False)
    op.create_index('ix_material_reactions_user_id', 'material_reactions', ['user_id'], unique=False)
    op.create_index('ix_material_reactions_emoji', 'material_reactions', ['emoji'], unique=False)
    op.create_index('ix_material_reactions_created_at', 'material_reactions', ['created_at'], unique=False)


def downgrade() -> None:
    # Удаляем таблицы в обратном порядке
    op.drop_table('material_reactions')
    op.drop_table('material_comments') 