from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID

# Базовая схема для комментария
class MaterialCommentBase(BaseModel):
    material_id: int = Field(..., description="ID обучающего материала")
    message: str = Field(..., min_length=1, max_length=2000, description="Текст комментария")
    reply_to: Optional[UUID] = Field(None, description="ID комментария для ответа")

# Схема для создания комментария
class MaterialCommentCreate(MaterialCommentBase):
    pass

# Схема для обновления комментария
class MaterialCommentUpdate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="Новый текст комментария")

# Базовая схема автора
class CommentAuthor(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    
    class Config:
        from_attributes = True

# Схема для чтения комментария
class MaterialCommentRead(MaterialCommentBase):
    id: UUID
    user_id: int
    edited: bool = False
    created_at: datetime
    updated_at: datetime
    author: CommentAuthor
    replies: List['MaterialCommentRead'] = []
    
    class Config:
        from_attributes = True

# Обновляем forward reference
MaterialCommentRead.model_rebuild()

# Схема для списка комментариев
class MaterialCommentsResponse(BaseModel):
    comments: List[MaterialCommentRead]
    total: int = Field(..., description="Общее количество комментариев") 