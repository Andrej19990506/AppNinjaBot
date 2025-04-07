from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, Any

# Базовая схема для Group
class GroupBase(BaseModel):
    # Используем alias, чтобы в JSON поле называлось chat_id
    group_id: int = Field(..., alias="chat_id", description="Telegram Group ID")
    title: str
    group_type: str
    username: Optional[str] = None
    description: Optional[str] = None
    members_count: Optional[int] = None
    json_metadata: Optional[dict[str, Any]] = None

    # Добавляем конфигурацию для использования alias при сериализации
    model_config = ConfigDict(populate_by_name=True)

# Схема для создания Group (если понадобится)
class GroupCreate(GroupBase):
    pass

# Схема для чтения Group
class GroupRead(GroupBase):
    id: int
    created_at: datetime

    # Наследуем и расширяем model_config
    model_config = ConfigDict(from_attributes=True, populate_by_name=True) 