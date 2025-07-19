from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict
from uuid import UUID

# Базовая схема для реакции
class MaterialReactionBase(BaseModel):
    material_id: int = Field(..., description="ID обучающего материала")
    emoji: str = Field(..., min_length=1, max_length=10, description="Эмодзи реакции")

# Схема для создания/обновления реакции
class MaterialReactionCreate(MaterialReactionBase):
    pass

# Базовая схема автора реакции
class ReactionAuthor(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    
    class Config:
        from_attributes = True

# Схема для чтения реакции
class MaterialReactionRead(MaterialReactionBase):
    id: UUID
    user_id: int
    created_at: datetime
    author: ReactionAuthor
    
    class Config:
        from_attributes = True

# Схема для группировки реакций по эмодзи
class GroupedReaction(BaseModel):
    emoji: str
    count: int = Field(..., description="Количество реакций")
    users: List[ReactionAuthor] = Field(..., description="Пользователи, поставившие реакцию")

# Схема для ответа со всеми реакциями материала
class MaterialReactionsResponse(BaseModel):
    reactions: List[GroupedReaction] = Field(..., description="Группированные реакции")
    user_reaction: Optional[str] = Field(None, description="Реакция текущего пользователя")
    total: int = Field(..., description="Общее количество реакций") 