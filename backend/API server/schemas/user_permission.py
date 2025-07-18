from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

# Базовая схема для создания разрешения
class UserPermissionCreate(BaseModel):
    user_id: int = Field(..., description="ID пользователя (Telegram ID)")
    group_id: int = Field(..., description="ID группы (Telegram ID)")
    permission_type: Literal['inventory', 'writeoff', 'events'] = Field(..., description="Тип разрешения")
    duration_hours: int = Field(..., ge=1, le=168, description="Продолжительность в часах (1-168)")

# Схема для отзыва разрешения
class UserPermissionRevoke(BaseModel):
    user_id: int = Field(..., description="ID пользователя")
    group_id: int = Field(..., description="ID группы")
    permission_type: Literal['inventory', 'writeoff', 'events'] = Field(..., description="Тип разрешения")

# Схема для ответа API
class UserPermissionResponse(BaseModel):
    id: int
    user_id: int
    group_id: int
    permission_type: str
    granted_by: int
    granted_at: datetime
    expires_at: datetime
    is_active: bool
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[int] = None
    
    # Информация о пользователях (если нужно)
    user_name: Optional[str] = None
    granted_by_name: Optional[str] = None
    revoked_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Схема для списка разрешений
class UserPermissionList(BaseModel):
    permissions: List[UserPermissionResponse]
    total: int
    active_count: int
    expired_count: int

# Схема для проверки прав
class UserPermissionCheck(BaseModel):
    user_id: int
    group_id: int
    permission_type: Literal['inventory', 'writeoff', 'events']

# Схема для ответа проверки прав
class UserPermissionCheckResponse(BaseModel):
    has_permission: bool
    is_admin: bool = False
    permission_source: Literal['administrator', 'temporary', 'none'] = 'none'
    expires_at: Optional[datetime] = None
    remaining_hours: Optional[int] = None 