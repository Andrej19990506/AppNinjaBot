# backend/API server/models/delivery.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base

class Delivery(Base):
    """Модель поставки"""
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    
    # Основная информация о поставке
    supplier = Column(String, nullable=False, index=True, comment="Поставщик")
    branch = Column(String, nullable=True, index=True, comment="Филиал/точка доставки")
    delivery_date = Column(DateTime(timezone=True), nullable=False, index=True, comment="Дата поставки")
    status = Column(String, nullable=False, default="accepted", index=True, comment="Статус поставки")
    
    # Информация о принятии
    accepted_by_name = Column(String, nullable=False, comment="Имя принявшего")
    accepted_by_initials = Column(String, nullable=False, comment="Инициалы принявшего")
    accepted_by_user_id = Column(Integer, nullable=True, comment="ID пользователя в системе")
    accepted_by_telegram_id = Column(Integer, nullable=True, comment="Telegram ID пользователя")
    accepted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), comment="Время принятия")
    
    # Дополнительная информация
    notes = Column(Text, nullable=True, comment="Заметки к поставке")
    total_items = Column(Integer, nullable=False, default=0, comment="Общее количество позиций")
    checked_items = Column(Integer, nullable=False, default=0, comment="Количество проверенных позиций")
    total_cost = Column(Float, nullable=True, comment="Общая стоимость поставки")
    
    # Метки времени
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    items = relationship("DeliveryItem", back_populates="delivery", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Delivery(id={self.id}, supplier='{self.supplier}', date={self.delivery_date}, status='{self.status}')>"

class DeliveryItem(Base):
    """Модель товара в поставке"""
    __tablename__ = "delivery_items"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False, index=True)
    
    # Информация о товаре
    name = Column(String, nullable=False, comment="Наименование товара")
    category = Column(String, nullable=True, comment="Категория товара")
    unit = Column(String, nullable=True, comment="Единица измерения")
    quantity = Column(Float, nullable=True, comment="Количество")
    price = Column(Float, nullable=True, comment="Цена за единицу")
    item_total = Column(Float, nullable=True, comment="Стоимость позиции")
    
    # Статус проверки
    is_checked = Column(Boolean, nullable=False, default=False, index=True, comment="Проверен ли товар")
    
    # Метки времени
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    delivery = relationship("Delivery", back_populates="items")
    
    def __repr__(self):
        return f"<DeliveryItem(id={self.id}, name='{self.name}', quantity={self.quantity}, checked={self.is_checked})>"
