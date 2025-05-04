# backend/API server/models/notification.py
import uuid
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, BigInteger, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import sqlalchemy as sa
from typing import Optional, Dict, Any

from .base import Base # Используем относительный импорт .base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    time = Column(Integer, nullable=False, comment="Minutes before the event")
    repeat_type = Column(String, nullable=False, server_default='none', comment="Repeat type: none, daily, weekly, monthly")
    repeat_config = Column(JSONB, nullable=True, comment="Additional repeat configuration (e.g., weekdays, month day)")
    chat_ids = Column(ARRAY(BigInteger), nullable=True, comment="List of chat IDs to send the notification to")
    requires_confirmation = Column(Boolean, nullable=False, server_default=sa.text("false"), comment="Does this notification require user confirmation?")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Связь с событием (один-ко-многим: много уведомлений у одного события)
    event = relationship("Event", back_populates="notifications")

    @property
    def repeat(self) -> Optional[Dict[str, Any]]:
        """Собирает объект настроек повтора для сериализации Pydantic."""
        if self.repeat_type and self.repeat_type != 'none':
            repeat_data = {'type': self.repeat_type}
            if self.repeat_config: # repeat_config может быть None или {}
                # Безопасно проверяем наличие ключей
                if 'weekdays' in self.repeat_config:
                    repeat_data['weekdays'] = self.repeat_config.get('weekdays')
                if 'month_day' in self.repeat_config:
                    repeat_data['month_day'] = self.repeat_config.get('month_day')
            return repeat_data
        else:
            # Возвращаем структуру для типа 'none' или None, если поле опционально
            # Зависит от того, как определено поле repeat в схеме NotificationRead
            # Если Optional[RepeatSettingsRead], то можно вернуть None
            # Если RepeatSettingsRead (не опционально), то нужно вернуть {'type': 'none'}
            return {'type': 'none'} # Возвращаем словарь для типа 'none' 