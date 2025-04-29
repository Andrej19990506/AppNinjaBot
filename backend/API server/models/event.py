# backend/API server/models/event.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Text
from sqlalchemy.sql import func
# Импортируем базовый класс для моделей из твоего проекта
from .base import Base  

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    
    description = Column(Text, nullable=False)
    
    # Используем DateTime(timezone=True) для хранения информации о часовом поясе, если это важно
    # Иначе можно использовать просто DateTime
    date = Column(DateTime(timezone=True), nullable=False, index=True) 
    
    # --- Поля для настроек повтора ---
    # Вместо вложенного объекта храним тип отдельно
    repeat_type = Column(String(50), nullable=False, default='none', server_default='none', index=True) 
    # Дни недели и день месяца храним в JSON или ARRAY (если поддерживается)
    repeat_weekdays = Column(JSON, nullable=True) # Список int [0-6]
    repeat_month_day = Column(Integer, nullable=True) # int 1-31
    
    # --- Поля для уведомлений и чатов ---
    notifications = Column(JSON, nullable=False, default=[], server_default='[]') # Список объектов {"message": str, "time": int}
    chat_ids = Column(JSON, nullable=False, default=[], server_default='[]') # Список int
    
    # --- Поля статуса и времени последней проверки ---
    is_active = Column(Boolean, default=True, server_default='t', nullable=False, index=True)
    last_check = Column(DateTime(timezone=True), nullable=True) # Время последней обработки планировщиком

    # --- Временные метки (необязательно, но полезно) ---
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Event(id={self.id}, description='{self.description[:20]}...', date='{self.date}')>"

    # --- Дополнительные свойства для маппинга на Pydantic (если нужно) ---
    # Pydantic модель ожидает вложенные объекты repeat и scheduling_status
    # Мы можем создать их "на лету" с помощью property, 
    # чтобы orm_mode в Pydantic сработал без дополнительных преобразований в коде API.
    
    @property
    def repeat(self):
        return {
            "type": self.repeat_type,
            "weekdays": self.repeat_weekdays,
            "month_day": self.repeat_month_day
        }

    @property
    def scheduling_status(self):
        return {"active": self.is_active} 