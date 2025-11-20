from typing import Optional
from pydantic import BaseModel, Field


class CompanyBotCreate(BaseModel):
    """Схема для создания бота компании"""
    bot_token: str = Field(..., min_length=10, description="Токен бота из BotFather")
    bot_username: Optional[str] = Field(None, max_length=100, description="Username бота (например, @NinjaSlovtsova_bot)")
    bot_id: Optional[int] = Field(None, description="ID бота (получается через getMe API)")
    group_id: Optional[int] = Field(None, description="ID группы, к которой привязан бот")
    company_name: Optional[str] = Field(None, max_length=255, description="Название компании")
    is_active: bool = Field(True, description="Активен ли бот")
    bot_metadata: Optional[str] = Field(None, description="Дополнительная информация в формате JSON")


class CompanyBotUpdate(BaseModel):
    """Схема для обновления бота компании"""
    bot_token: Optional[str] = Field(None, min_length=10, description="Токен бота")
    bot_username: Optional[str] = Field(None, max_length=100, description="Username бота")
    bot_id: Optional[int] = Field(None, description="ID бота")
    group_id: Optional[int] = Field(None, description="ID группы")
    company_name: Optional[str] = Field(None, max_length=255, description="Название компании")
    is_active: Optional[bool] = Field(None, description="Активен ли бот")
    bot_metadata: Optional[str] = Field(None, description="Дополнительная информация")


class CompanyBotResponse(BaseModel):
    """Схема ответа с информацией о боте компании"""
    id: int
    bot_token: str  # В реальности лучше не возвращать токен, но для админки можно
    bot_username: Optional[str] = None
    bot_id: Optional[int] = None
    group_id: Optional[int] = None
    company_name: Optional[str] = None
    is_active: bool
    bot_metadata: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

