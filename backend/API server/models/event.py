# backend/API server/models/event.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Text, Float, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

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

    # --- Поля для типа события и интеграции с RetailiQA (АТО) ---
    event_type = Column(String, index=True, nullable=True) # Например: "АТО", "Зарплата"

    retailiqa_insp_id = Column(String, unique=True, index=True, nullable=True) # ID проверки из RetailiQA
    retailiqa_insp_obj_id = Column(String, index=True, nullable=True) # ID объекта проверки из RetailiQA
    retailiqa_insp_obj_name = Column(String, nullable=True) # Название объекта проверки
    retailiqa_total_points = Column(Float, nullable=True) # Общий набранный балл АТО
    retailiqa_penalty_points = Column(Float, nullable=True) # Общий штрафной балл АТО
    retailiqa_comments = Column(JSON, nullable=True) # Замечания АТО (например, список строк или объектов)
    retailiqa_photos = Column(JSON, nullable=True) # Фото АТО (список URL)
    
    # --- Новые поля для результатов проверки RetailiQA ---
    retailiqa_score_percentage = Column(Float, nullable=True) # Процент выполнения проверки
    retailiqa_max_points = Column(Float, nullable=True) # Максимально возможные баллы
    retailiqa_earned_points = Column(Float, nullable=True) # Набранные баллы
    
    # --- Новые поля для детальной информации о нарушениях ---
    retailiqa_violation_count = Column(Integer, nullable=True) # Количество нарушений
    retailiqa_detailed_violations = Column(JSON, nullable=True) # Детальная информация о нарушениях
    # --- Конец полей для RetailiQA ---

    # <<< ДОБАВЛЕНО: Связь с уведомлениями >>>
    notifications = relationship(
        "Notification", 
        back_populates="event", 
        cascade="all, delete-orphan", # Удалять уведомления при удалении события
        lazy="selectin" # Загружать уведомления сразу вместе с событием (эффективно для "один-ко-многим")
    )

    # --- Поля для chat_ids --- Изменяем тип на JSON
    chat_ids = Column(JSON, nullable=True) # Поле для хранения списка ID чатов как JSON

    def __repr__(self):
        return f"<Event(id={self.id}, type='{self.event_type}', description='{self.description[:20]}...', date='{self.date}')>"

    # --- Дополнительные свойства для маппинга на Pydantic (если нужно) ---
    # Pydantic модель ожидает вложенные объекты repeat и scheduling_status
    # Мы можем создать их "на лету" с помощью property, 
    # чтобы orm_mode в Pydantic сработал без дополнительных преобразований в коде API.
    
    @property
    def scheduling_status(self):
        return {"active": self.is_active} 