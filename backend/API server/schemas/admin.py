from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from models.admin_user import AdminRole


class AdminLoginRequest(BaseModel):
    """Схема для входа администратора"""
    email: EmailStr
    password: str


class AdminUserCreate(BaseModel):
    """Схема для создания администратора"""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Минимум 8 символов")
    name: Optional[str] = Field(None, max_length=255)
    role: AdminRole = Field(AdminRole.COMPANY_ADMIN, description="Роль администратора")
    company_bot_id: Optional[int] = Field(None, description="ID бота компании (только для COMPANY_ADMIN)")


class AdminUserUpdate(BaseModel):
    """Схема для обновления администратора"""
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, description="Минимум 8 символов")
    name: Optional[str] = Field(None, max_length=255)
    role: Optional[AdminRole] = None
    company_bot_id: Optional[int] = Field(None, description="ID бота компании (только для COMPANY_ADMIN)")
    is_active: Optional[bool] = None


class AdminUserResponse(BaseModel):
    """Схема ответа с информацией об администраторе"""
    id: int
    email: str
    name: Optional[str] = None
    role: AdminRole
    company_bot_id: Optional[int] = None
    is_active: bool
    created_at: str
    last_login: Optional[str] = None

    class Config:
        from_attributes = True


class AdminTokenResponse(BaseModel):
    """Схема ответа с токеном авторизации"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    admin: AdminUserResponse


class AdminRefreshRequest(BaseModel):
    """Схема для обновления токена"""
    refresh_token: str

