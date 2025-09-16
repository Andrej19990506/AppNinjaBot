# backend/API server/schemas/delivery.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class DeliveryItemBase(BaseModel):
    """Базовая схема для товара в поставке"""
    name: str = Field(..., description="Наименование товара")
    category: Optional[str] = Field(None, description="Категория товара")
    unit: Optional[str] = Field(None, description="Единица измерения")
    quantity: Optional[float] = Field(None, description="Количество")
    price: Optional[float] = Field(None, description="Цена за единицу")
    is_checked: bool = Field(default=False, description="Проверен ли товар")
    notes: Optional[str] = Field(None, description="Заметки к товару")

class DeliveryItemCreate(DeliveryItemBase):
    """Схема для создания товара в поставке"""
    pass

class DeliveryItemRead(DeliveryItemBase):
    """Схема для чтения товара в поставке"""
    id: int = Field(..., description="ID товара")
    delivery_id: int = Field(..., description="ID поставки")
    item_total: Optional[float] = Field(None, description="Стоимость позиции")
    
    class Config:
        from_attributes = True

class UserInfo(BaseModel):
    """Информация о пользователе, принявшем поставку"""
    name: str = Field(..., description="Полное имя пользователя")
    initials: str = Field(..., description="Инициалы пользователя")
    user_id: Optional[int] = Field(None, description="ID пользователя в системе")
    telegram_id: Optional[int] = Field(None, description="Telegram ID пользователя")

class DeliveryBase(BaseModel):
    """Базовая схема для поставки"""
    supplier: str = Field(..., description="Название поставщика")
    branch: Optional[str] = Field(None, description="Филиал/точка доставки")
    delivery_date: datetime = Field(..., description="Дата поставки")
    notes: Optional[str] = Field(None, description="Дополнительные заметки")

class DeliveryCreate(DeliveryBase):
    """Схема для создания поставки"""
    accepted_by: UserInfo = Field(..., description="Информация о принявшем пользователе")
    items: List[DeliveryItemCreate] = Field(..., description="Список товаров в поставке")
    
    @validator('items')
    def validate_items(cls, v):
        if not v:
            raise ValueError('Поставка должна содержать хотя бы один товар')
        return v

class DeliveryUpdate(BaseModel):
    """Схема для обновления поставки"""
    supplier: Optional[str] = None
    branch: Optional[str] = None
    delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class DeliveryRead(DeliveryBase):
    """Схема для чтения поставки"""
    id: int = Field(..., description="ID поставки")
    status: str = Field(..., description="Статус поставки")
    accepted_by_name: str = Field(..., description="Имя принявшего")
    accepted_by_initials: str = Field(..., description="Инициалы принявшего")
    accepted_by_user_id: Optional[int] = Field(None, description="ID пользователя")
    accepted_by_telegram_id: Optional[int] = Field(None, description="Telegram ID")
    accepted_at: datetime = Field(..., description="Время принятия поставки")
    total_items: int = Field(..., description="Общее количество позиций")
    checked_items: int = Field(..., description="Количество проверенных позиций")
    total_cost: Optional[float] = Field(None, description="Общая стоимость поставки")
    items: List[DeliveryItemRead] = Field(default_factory=list, description="Товары в поставке")
    
    # Вычисляемые поля
    @property
    def completion_rate(self) -> float:
        """Процент проверенных товаров"""
        if self.total_items == 0:
            return 0.0
        return (self.checked_items / self.total_items) * 100
    
    class Config:
        from_attributes = True

class DeliveryStats(BaseModel):
    """Статистика по поставкам"""
    total_deliveries: int = Field(..., description="Общее количество поставок")
    pending_deliveries: int = Field(..., description="Ожидающие обработки")
    completed_deliveries: int = Field(..., description="Завершенные поставки")
    total_items: int = Field(..., description="Общее количество товаров")
    total_cost: float = Field(..., description="Общая стоимость")
    suppliers: List[str] = Field(..., description="Список поставщиков")
    branches: List[str] = Field(..., description="Список филиалов")

class DeliveryListResponse(BaseModel):
    """Ответ для списка поставок"""
    deliveries: List[DeliveryRead] = Field(..., description="Список поставок")
    total: int = Field(..., description="Общее количество поставок")
    page: int = Field(..., description="Текущая страница")
    size: int = Field(..., description="Размер страницы")
    pages: int = Field(..., description="Общее количество страниц")
    stats: Optional[DeliveryStats] = Field(None, description="Статистика")

class DeliveryFilters(BaseModel):
    """Фильтры для поиска поставок"""
    supplier: Optional[str] = Field(None, description="Фильтр по поставщику")
    branch: Optional[str] = Field(None, description="Фильтр по филиалу")
    status: Optional[str] = Field(None, description="Фильтр по статусу")
    date_from: Optional[datetime] = Field(None, description="Дата с")
    date_to: Optional[datetime] = Field(None, description="Дата по")
    accepted_by: Optional[str] = Field(None, description="Кто принял")
    
class DeliveryAcceptRequest(BaseModel):
    """Запрос на принятие поставки"""
    supplier: str = Field(..., description="Название поставщика") 
    branch: Optional[str] = Field(None, description="Филиал")
    delivery_date: str = Field(..., description="Дата поставки в формате YYYY-MM-DD")
    items: List[DeliveryItemCreate] = Field(..., description="Список товаров")
    accepted_by: UserInfo = Field(..., description="Информация о принявшем")
    notes: Optional[str] = Field(None, description="Заметки")

class DeliveryAcceptResponse(BaseModel):
    """Ответ на принятие поставки"""
    delivery_id: int = Field(..., description="ID созданной поставки")
    message: str = Field(..., description="Сообщение о результате")
    delivery: DeliveryRead = Field(..., description="Данные поставки")
