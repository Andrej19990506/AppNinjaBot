from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import datetime as dt

# Схема для информации об авторе списания
class WriteOffAuthor(BaseModel):
    user_id: int = Field(..., description="Telegram ID пользователя")
    first_name: Optional[str] = Field(None, description="Имя пользователя")
    last_name: Optional[str] = Field(None, description="Фамилия пользователя")
    username: Optional[str] = Field(None, description="Username пользователя")
    photo_url: Optional[str] = Field(None, description="URL фото пользователя")

    class Config:
        from_attributes = True

class WriteOffBase(BaseModel):
    user_id: int = Field(..., description="ID пользователя (BigInt)")
    name: str = Field(..., description="Название списания")
    reason: str = Field(..., description="Причина списания")
    quantity: float = Field(..., description="Количество")
    description: Optional[str] = Field(None, description="Описание")
    unit_type: Literal['шт', 'гр'] = Field('шт', description="Единица измерения")
    photo_path: Optional[str] = Field(None, description="Путь к фото списания")
    date: Optional[dt.date] = Field(None, description="Дата списания (YYYY-MM-DD), по умолчанию сегодня")

class WriteOffCreate(WriteOffBase):
    pass

class WriteOffUpdate(BaseModel):
    name: Optional[str] = None
    reason: Optional[str] = None
    quantity: Optional[float] = None
    description: Optional[str] = None
    unit_type: Optional[Literal['шт', 'гр']] = None
    photo_path: Optional[str] = None
    date: Optional[dt.date] = None

class WriteOffInDB(WriteOffBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class WriteOffResponse(WriteOffInDB):
    author: Optional[WriteOffAuthor] = Field(None, description="Информация об авторе списания")
    
    class Config:
        from_attributes = True 