"""add competitions tables

Revision ID: 000024
Revises: 000023
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '000027'
down_revision = '000026'
branch_labels = None
depends_on = None


def upgrade():
    # Создаем enum для статуса конкурса
    competition_status = postgresql.ENUM('draft', 'announcement', 'active', 'completed', 'cancelled', name='competitionstatus')
    competition_status.create(op.get_bind())
    
    # Создаем таблицу competitions
    op.create_table('competitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('full_description', sa.Text(), nullable=True),
        sa.Column('status', postgresql.ENUM('draft', 'announcement', 'active', 'completed', 'cancelled', name='competitionstatus', create_type=False), nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('registration_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('prize', sa.String(length=255), nullable=True),
        sa.Column('dynamic_prize_config', sa.JSON(), nullable=True),
        sa.Column('max_participants', sa.Integer(), nullable=True),
        sa.Column('current_participants', sa.Integer(), nullable=False, default=0),
        sa.Column('competition_data', sa.JSON(), nullable=True),
        sa.Column('rules', sa.JSON(), nullable=True),
        sa.Column('evaluation_criteria', sa.JSON(), nullable=True),
        sa.Column('target_groups', sa.JSON(), nullable=True),
        sa.Column('target_chat_ids', sa.JSON(), nullable=True),
        sa.Column('images', sa.JSON(), nullable=True),
        sa.Column('attachments', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competitions_id'), 'competitions', ['id'], unique=False)
    op.create_index(op.f('ix_competitions_title'), 'competitions', ['title'], unique=False)
    op.create_index(op.f('ix_competitions_status'), 'competitions', ['status'], unique=False)
    op.create_index(op.f('ix_competitions_start_date'), 'competitions', ['start_date'], unique=False)
    op.create_index(op.f('ix_competitions_end_date'), 'competitions', ['end_date'], unique=False)
    op.create_index(op.f('ix_competitions_created_by'), 'competitions', ['created_by'], unique=False)
    
    # Создаем таблицу competition_participants
    op.create_table('competition_participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('competition_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),  # Может быть ID пользователя или группы
        sa.Column('participant_type', sa.String(length=50), nullable=False, default='individual'),
        sa.Column('status', sa.String(length=50), nullable=False, default='registered'),
        sa.Column('user_name', sa.String(length=255), nullable=True),
        sa.Column('user_position', sa.String(length=255), nullable=True),
        sa.Column('user_department', sa.String(length=255), nullable=True),
        sa.Column('branch_name', sa.String(length=255), nullable=True),
        sa.Column('branch_id', sa.String(length=100), nullable=True),
        sa.Column('participant_data', sa.JSON(), nullable=True),
        sa.Column('result_score', sa.Integer(), nullable=True),
        sa.Column('result_time', sa.Integer(), nullable=True),
        sa.Column('ranking_position', sa.Integer(), nullable=True),
        sa.Column('result_accuracy', sa.Float(), nullable=True),
        sa.Column('result_secondary_score', sa.Float(), nullable=True),
        sa.Column('external_data_source', sa.String(length=100), nullable=True),
        sa.Column('external_data_id', sa.String(length=255), nullable=True),
        sa.Column('registered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['competition_id'], ['competitions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competition_participants_id'), 'competition_participants', ['id'], unique=False)
    op.create_index(op.f('ix_competition_participants_competition_id'), 'competition_participants', ['competition_id'], unique=False)
    op.create_index(op.f('ix_competition_participants_user_id'), 'competition_participants', ['user_id'], unique=False)
    op.create_index(op.f('ix_competition_participants_status'), 'competition_participants', ['status'], unique=False)
    
    # Создаем таблицу competition_winners
    op.create_table('competition_winners',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('competition_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('place', sa.Integer(), nullable=False),
        sa.Column('prize', sa.String(length=255), nullable=True),
        sa.Column('user_name', sa.String(length=255), nullable=True),
        sa.Column('user_position', sa.String(length=255), nullable=True),
        sa.Column('user_department', sa.String(length=255), nullable=True),
        sa.Column('winner_data', sa.JSON(), nullable=True),
        sa.Column('long_term_status', sa.Boolean(), nullable=False, default=False),
        sa.Column('status_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('announced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['competition_id'], ['competitions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competition_winners_id'), 'competition_winners', ['id'], unique=False)
    op.create_index(op.f('ix_competition_winners_competition_id'), 'competition_winners', ['competition_id'], unique=False)
    op.create_index(op.f('ix_competition_winners_user_id'), 'competition_winners', ['user_id'], unique=False)


def downgrade():
    # Удаляем таблицы в обратном порядке
    op.drop_index(op.f('ix_competition_winners_user_id'), table_name='competition_winners')
    op.drop_index(op.f('ix_competition_winners_competition_id'), table_name='competition_winners')
    op.drop_index(op.f('ix_competition_winners_id'), table_name='competition_winners')
    op.drop_table('competition_winners')
    
    op.drop_index(op.f('ix_competition_participants_status'), table_name='competition_participants')
    op.drop_index(op.f('ix_competition_participants_user_id'), table_name='competition_participants')
    op.drop_index(op.f('ix_competition_participants_competition_id'), table_name='competition_participants')
    op.drop_index(op.f('ix_competition_participants_id'), table_name='competition_participants')
    op.drop_table('competition_participants')
    
    op.drop_index(op.f('ix_competitions_created_by'), table_name='competitions')
    op.drop_index(op.f('ix_competitions_end_date'), table_name='competitions')
    op.drop_index(op.f('ix_competitions_start_date'), table_name='competitions')
    op.drop_index(op.f('ix_competitions_status'), table_name='competitions')
    op.drop_index(op.f('ix_competitions_title'), table_name='competitions')
    op.drop_index(op.f('ix_competitions_id'), table_name='competitions')
    op.drop_table('competitions')
    
    # Удаляем enum
    competition_status = postgresql.ENUM(name='competitionstatus')
    competition_status.drop(op.get_bind()) 