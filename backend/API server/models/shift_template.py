from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON, Time
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from .base import Base

class ShiftTemplate(Base):
    __tablename__ = "shift_templates"

    # Используем UUID как первичный ключ
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Внешний ключ к таблице groups (chat_id)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    
    # Название шаблона
    name = Column(String(255), nullable=False)
    
    # Описание шаблона (необязательно)
    description = Column(String(1000), nullable=True)
    
    # Время начала смены
    start_time = Column(Time, nullable=False)
    
    # Время окончания смены
    end_time = Column(Time, nullable=False)
    
    # Максимальное количество слотов
    max_slots = Column(Integer, nullable=False, default=1)
    
    # Есть ли слот для старшего курьера
    has_senior_slot = Column(Boolean, default=False)
    
    # Метаданные для дополнительных настроек
    template_metadata = Column(JSON, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи (Relationships)
    group = relationship("Group", back_populates="shift_templates")
    days = relationship("ShiftTemplateDay", back_populates="template", cascade="all, delete-orphan")
    shifts = relationship("Shift", back_populates="template")

    def __repr__(self):
        return f"<ShiftTemplate(id={self.id}, name='{self.name}', group_id={self.group_id}, start_time='{self.start_time}', end_time='{self.end_time}')>"


class ShiftTemplateDay(Base):
    """Связь между шаблонами смен и днями недели"""
    __tablename__ = "shift_template_days"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Внешний ключ к шаблону смены
    template_id = Column(UUID(as_uuid=True), ForeignKey("shift_templates.id"), nullable=False)
    
    # Внешний ключ к группе
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    
    # День недели (0 = понедельник, 6 = воскресенье)
    day_of_week = Column(Integer, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    template = relationship("ShiftTemplate", back_populates="days")
    group = relationship("Group")

    def __repr__(self):
        return f"<ShiftTemplateDay(id={self.id}, template_id={self.template_id}, group_id={self.group_id}, day_of_week={self.day_of_week})>"
