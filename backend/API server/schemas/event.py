# backend/API server/api/v1/schemas/event.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
from datetime import datetime

# --- Модели для Настроек Повтора ---
class RepeatSettingsBase(BaseModel):
    type: Literal['none', 'daily', 'weekly', 'monthly'] = 'none'
    weekdays: Optional[List[int]] = Field(None, description="Дни недели (0=Пн, 6=Вс) для еженедельного повтора")
    month_day: Optional[int] = Field(None, ge=1, le=31, description="День месяца для ежемесячного повтора")

    @validator('weekdays', always=True)
    def check_weekdays(cls, v, values):
        if values.get('type') == 'weekly' and not v:
            raise ValueError("Для еженедельного повтора необходимо указать 'weekdays'")
        if values.get('type') != 'weekly' and v:
            return None # Очищаем, если тип не weekly
        if v and not all(0 <= day <= 6 for day in v):
             raise ValueError("Дни недели должны быть в диапазоне от 0 до 6")
        return v

    @validator('month_day', always=True)
    def check_month_day(cls, v, values):
        if values.get('type') == 'monthly' and v is None:
            raise ValueError("Для ежемесячного повтора необходимо указать 'month_day'")
        if values.get('type') != 'monthly' and v is not None:
            return None # Очищаем, если тип не monthly
        return v

class RepeatSettingsCreate(RepeatSettingsBase):
    pass

class RepeatSettingsRead(RepeatSettingsBase):
    pass # На данный момент совпадает с Base

# --- Модели для Уведомлений ---
class NotificationBase(BaseModel):
    message: str = Field(..., max_length=500)
    time: int = Field(..., ge=0, description="Время уведомления в минутах до события")

class NotificationCreate(NotificationBase):
    pass

class NotificationRead(NotificationBase):
    pass # На данный момент совпадает с Base

# --- Модели для Статуса Планирования ---
class SchedulingStatus(BaseModel):
    active: bool = True

# --- Основные Модели События ---
class EventBase(BaseModel):
    description: Optional[str] = Field(None, max_length=1000)

class EventCreate(EventBase):
    description: str = Field(..., max_length=1000) # Обязательно при создании
    date: datetime
    repeat: RepeatSettingsCreate = Field(default_factory=RepeatSettingsCreate) # Значение по умолчанию 'none'
    notifications: List[NotificationCreate] = []
    chat_ids: List[int] = []

class EventUpdate(EventBase):
    # Все поля опциональны при обновлении
    date: Optional[datetime] = None
    repeat: Optional[RepeatSettingsCreate] = None
    notifications: Optional[List[NotificationCreate]] = None
    chat_ids: Optional[List[int]] = None
    # active: Optional[bool] = None # Можно добавить позже

class EventRead(EventBase):
    id: int
    description: str # Описание должно быть всегда при чтении
    date: datetime
    repeat: RepeatSettingsRead
    notifications: List[NotificationRead]
    chat_ids: List[int]
    scheduling_status: SchedulingStatus = Field(default_factory=SchedulingStatus) # Статус по умолчанию
    last_check: Optional[datetime] = None

    class Config:
        orm_mode = True # Для автоматического маппинга из SQLAlchemy моделей 