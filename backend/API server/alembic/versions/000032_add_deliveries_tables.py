"""add deliveries tables

Revision ID: 000032
Revises: 000031
Create Date: 2025-01-16 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '000032'
down_revision = '000031'
branch_labels = None
depends_on = None


def upgrade():
    # Создаем таблицу deliveries (поставки)
    op.create_table('deliveries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('supplier', sa.String(), nullable=False, comment='Поставщик'),
        sa.Column('branch', sa.String(), nullable=True, comment='Филиал/точка доставки'),
        sa.Column('delivery_date', sa.DateTime(timezone=True), nullable=False, comment='Дата поставки'),
        sa.Column('status', sa.String(), nullable=False, server_default='accepted', comment='Статус поставки'),
        
        # Информация о принятии
        sa.Column('accepted_by_name', sa.String(), nullable=False, comment='Имя принявшего'),
        sa.Column('accepted_by_initials', sa.String(), nullable=False, comment='Инициалы принявшего'),
        sa.Column('accepted_by_user_id', sa.Integer(), nullable=True, comment='ID пользователя в системе'),
        sa.Column('accepted_by_telegram_id', sa.Integer(), nullable=True, comment='Telegram ID пользователя'),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'), comment='Время принятия'),
        
        # Дополнительная информация
        sa.Column('notes', sa.Text(), nullable=True, comment='Заметки к поставке'),
        sa.Column('total_items', sa.Integer(), nullable=False, server_default='0', comment='Общее количество позиций'),
        sa.Column('checked_items', sa.Integer(), nullable=False, server_default='0', comment='Количество проверенных позиций'),
        sa.Column('total_cost', sa.Float(), nullable=True, comment='Общая стоимость поставки'),
        
        # Метки времени
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id')
    )
    
    # Создаем индексы для таблицы deliveries
    op.create_index(op.f('ix_deliveries_id'), 'deliveries', ['id'], unique=False)
    op.create_index(op.f('ix_deliveries_supplier'), 'deliveries', ['supplier'], unique=False)
    op.create_index(op.f('ix_deliveries_branch'), 'deliveries', ['branch'], unique=False)
    op.create_index(op.f('ix_deliveries_delivery_date'), 'deliveries', ['delivery_date'], unique=False)
    op.create_index(op.f('ix_deliveries_status'), 'deliveries', ['status'], unique=False)
    
    # Создаем таблицу delivery_items (товары в поставке)
    op.create_table('delivery_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('delivery_id', sa.Integer(), nullable=False),
        
        # Информация о товаре
        sa.Column('name', sa.String(), nullable=False, comment='Наименование товара'),
        sa.Column('category', sa.String(), nullable=True, comment='Категория товара'),
        sa.Column('unit', sa.String(), nullable=True, comment='Единица измерения'),
        sa.Column('quantity', sa.Float(), nullable=True, comment='Количество'),
        sa.Column('price', sa.Float(), nullable=True, comment='Цена за единицу'),
        sa.Column('item_total', sa.Float(), nullable=True, comment='Стоимость позиции'),
        
        # Статус проверки
        sa.Column('is_checked', sa.Boolean(), nullable=False, server_default='false', comment='Проверен ли товар'),
        
        # Метки времени
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        
        sa.ForeignKeyConstraint(['delivery_id'], ['deliveries.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Создаем индексы для таблицы delivery_items
    op.create_index(op.f('ix_delivery_items_id'), 'delivery_items', ['id'], unique=False)
    op.create_index(op.f('ix_delivery_items_delivery_id'), 'delivery_items', ['delivery_id'], unique=False)
    op.create_index(op.f('ix_delivery_items_is_checked'), 'delivery_items', ['is_checked'], unique=False)


def downgrade():
    # Удаляем индексы и таблицы в обратном порядке
    op.drop_index(op.f('ix_delivery_items_is_checked'), table_name='delivery_items')
    op.drop_index(op.f('ix_delivery_items_delivery_id'), table_name='delivery_items')
    op.drop_index(op.f('ix_delivery_items_id'), table_name='delivery_items')
    op.drop_table('delivery_items')
    
    op.drop_index(op.f('ix_deliveries_status'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_delivery_date'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_branch'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_supplier'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_id'), table_name='deliveries')
    op.drop_table('deliveries')
