from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy import func
from .base import Base
from models.member import Member # Импортируем Member для связи

class InventoryHistory(Base):
    __tablename__ = 'inventory_history'

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('groups.id', ondelete='CASCADE'), nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    item_name = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False) # e.g., 'add', 'remove', 'update', 'add_option', 'remove_option'
    type = Column(String, nullable=False, index=True) # 'raw' or 'semifinished'
    old_quantity = Column(Float, nullable=True) # Может быть null при первом добавлении
    new_quantity = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # ID автора изменения (ссылка на таблицу members)
    author_id = Column(Integer, ForeignKey('members.id', ondelete='SET NULL'), nullable=True, index=True)

    # Связи (Relationships)
    group = relationship("Group") # Связь с группой (опционально, если нужно)
    author_member = relationship("Member") # Связь с автором

    # Дополнительные поля, если нужны (например, описание, причина)
    # description = Column(Text, nullable=True)

    # Добавляем ограничение на допустимые значения type
    __table_args__ = (
        CheckConstraint(
            type.in_(['raw', 'semifinished']),
            name='check_valid_type'
        ),
    ) 