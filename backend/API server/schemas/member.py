from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from datetime import datetime
from typing import Optional, Any

# Базовая схема для Member - общие поля
class MemberBase(BaseModel):
    user_id: int = Field(..., description="Telegram User ID") # Используем int, т.к. Pydantic работает с Python типами
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: str = 'member'
    is_bot: bool = False
    photo_url: Optional[HttpUrl] = None # Валидация URL
    json_metadata: Optional[dict[str, Any]] = Field(default=None, alias="metadata")

# Схема для создания Member (если понадобится) - пока просто наследуем Base
class MemberCreate(MemberBase):
    pass # Возможно, в будущем тут будут специфичные поля для создания

# Схема для чтения Member - добавляем поля, генерируемые БД
class MemberRead(MemberBase):
    id: int # ID из базы данных
    joined_at: datetime # Дата добавления

    model_config = ConfigDict(from_attributes=True) # Для совместимости с ORM объектами 