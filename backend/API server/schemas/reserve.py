import uuid
from datetime import datetime, date
from pydantic import BaseModel, Field
from typing import Optional

# Базовая схема для Резерва (общие поля)
class ReserveBase(BaseModel):
    user_telegram_id: int = Field(..., description="Telegram ID пользователя")
    group_telegram_id: int = Field(..., description="Telegram ID группы")
    reserve_date: date = Field(..., description="Дата резерва в формате YYYY-MM-DD")

# Схема для создания Резерва (то, что приходит в POST запросе)
class ReserveCreate(ReserveBase):
    pass

# Схема для чтения данных пользователя внутри Резерва
class ReserveMember(BaseModel):
    id: int
    user_id: int # Telegram ID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    is_senior_courier: bool = False
    username: Optional[str] = None
    status: Optional[str] = None
    is_bot: bool = False

    class Config:
        from_attributes = True # Для совместимости с SQLAlchemy

# Схема для чтения данных группы внутри Резерва
class ReserveGroup(BaseModel):
    id: int
    group_id: int
    title: str
    group_type: str

    class Config:
        from_attributes = True

# Схема для чтения Резерва (то, что возвращается API)
class ReserveRead(BaseModel):
    id: uuid.UUID
    member_id: int # ID пользователя из БД
    group_id: int # ID группы из БД
    date: date
    created_at: datetime
    member: ReserveMember # Вложенные данные пользователя
    group: ReserveGroup # Вложенные данные группы

    class Config:
        from_attributes = True # Для совместимости с SQLAlchemy 