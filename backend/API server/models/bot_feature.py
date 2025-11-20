from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class BotFeature(Base):
    """
    Модель для хранения функционала бота.
    Определяет, какие функции доступны в системе (инвентаризация, смены, закупки и т.д.)
    """
    __tablename__ = "bot_features"

    id = Column(Integer, primary_key=True, index=True)
    
    # Код функции (например, "inventory", "shifts", "purchasing", "notifications")
    feature_code = Column(String(50), unique=True, nullable=False, index=True)
    
    # Название функции (например, "Инвентаризация", "Смены", "Закупки")
    feature_name = Column(String(100), nullable=False)
    
    # Описание функции
    description = Column(Text, nullable=True)
    
    # Иконка функции (опционально, для UI)
    icon = Column(String(50), nullable=True)
    
    # Активна ли функция
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    role_mappings = relationship("RoleFeatureMapping", back_populates="bot_feature", cascade="all, delete-orphan")
    notifications = relationship("GroupFeatureNotification", back_populates="bot_feature", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<BotFeature(id={self.id}, feature_code='{self.feature_code}', feature_name='{self.feature_name}')>"

