from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CompanyRoleBase(BaseModel):
    role_name: str = Field(..., min_length=1, max_length=100, description="Название роли")
    role_code: str = Field(..., min_length=1, max_length=50, description="Внутренний код роли")
    description: Optional[str] = Field(None, description="Описание роли")
    icon: Optional[str] = Field(None, max_length=50, description="Иконка роли")
    color: Optional[str] = Field(None, max_length=20, description="Цвет роли (hex)")
    display_order: int = Field(0, ge=0, description="Порядок отображения")
    is_active: bool = Field(True, description="Активна ли роль")
    permissions: Optional[str] = Field(None, description="JSON с дополнительными настройками")


class CompanyRoleCreate(CompanyRoleBase):
    company_bot_id: int = Field(..., description="ID бота компании")


class CompanyRoleUpdate(BaseModel):
    role_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role_code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    display_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    permissions: Optional[str] = None


class CompanyRoleResponse(CompanyRoleBase):
    id: int
    company_bot_id: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

