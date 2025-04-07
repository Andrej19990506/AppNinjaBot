from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

# Импортируем Base из модуля base в ЭТОЙ ЖЕ директории (models)
from .base import Base

class Shift(Base):
    __tablename__ = "shifts"

    # Используем UUID как первичный ключ, генерируемый Python
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Внешний ключ к таблице members (предполагаем, что user_id там int)
    # Если user_id в members тоже UUID, нужно изменить тип
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False) 
    
    # Внешний ключ к таблице groups (group_id там int)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False) 

    date = Column(String, nullable=False, index=True)
    shift_type = Column(String, nullable=False) # 'day' или 'night'
    slot_index = Column(Integer, nullable=False)
    
    # Поля, которые, возможно, дублируются из Member/Group, но могут быть полезны
    # Или их можно убрать и подтягивать через relationship
    # photo_url = Column(String, nullable=True)
    # first_name = Column(String, nullable=True)
    # last_name = Column(String, nullable=True)
    # is_senior_courier = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    json_metadata = Column(JSON, nullable=True) # Для дополнительных данных, если нужно

    # Связи (Relationships)
    member = relationship("Member", back_populates="shifts")
    group = relationship("Group", back_populates="shifts")

    def __repr__(self):
        return f"<Shift(id={self.id}, member_id={self.member_id}, group_id={self.group_id}, date='{self.date}', type='{self.shift_type}')>"

# Важно: Добавить back_populates="shifts" в модели Member и Group
# Пример для Member:
# shifts = relationship("Shift", back_populates="member")
# Пример для Group:
# shifts = relationship("Shift", back_populates="group") 