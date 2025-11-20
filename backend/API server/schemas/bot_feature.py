from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BotFeatureBase(BaseModel):
    feature_code: str = Field(..., min_length=1, max_length=50, description="Код функции")
    feature_name: str = Field(..., min_length=1, max_length=100, description="Название функции")
    description: Optional[str] = Field(None, description="Описание функции")
    icon: Optional[str] = Field(None, max_length=50, description="Иконка функции")
    is_active: bool = Field(True, description="Активна ли функция")


class BotFeatureCreate(BotFeatureBase):
    pass


class BotFeatureUpdate(BaseModel):
    feature_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class BotFeatureResponse(BotFeatureBase):
    id: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

