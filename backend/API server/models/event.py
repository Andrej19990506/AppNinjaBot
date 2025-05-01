# backend/API server/models/event.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy import sql as sa

# Импортируем базовый класс для моделей из твоего проекта
from .base import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    
    description = Column(Text, nullable=False)
    
    # Используем DateTime(timezone=True) для хранения информации о часовом поясе, если это важно
    # Иначе можно использовать просто DateTime
    date = Column(DateTime(timezone=True), nullable=False, index=True) 
    
    # --- Поля статуса и времени последней проверки ---
    is_active = Column(Boolean, default=True, server_default='t', nullable=False, index=True)
    last_check = Column(DateTime(timezone=True), nullable=True) # Время последней обработки планировщиком

    # --- Временные метки (необязательно, но полезно) ---
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # <<< ДОБАВЛЕНО: Связь с уведомлениями >>>
    notifications = relationship(
        "Notification", 
        back_populates="event", 
        cascade="all, delete-orphan", # Удалять уведомления при удалении события
        lazy="selectin" # Загружать уведомления сразу вместе с событием (эффективно для "один-ко-многим")
    )

    def __repr__(self):
        return f"<Event(id={self.id}, description='{self.description[:20]}...', date='{self.date}')>"

    # --- Дополнительные свойства для маппинга на Pydantic (если нужно) ---
    # Pydantic модель ожидает вложенные объекты repeat и scheduling_status
    # Мы можем создать их "на лету" с помощью property, 
    # чтобы orm_mode в Pydantic сработал без дополнительных преобразований в коде API.
    
    @property
    def scheduling_status(self):
        return {"active": self.is_active} 