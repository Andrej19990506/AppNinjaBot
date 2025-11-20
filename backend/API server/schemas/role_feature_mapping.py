from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AccessType(str, Enum):
    """Тип доступа к функционалу"""
    OPEN = "open"  # Открыт для всех участников группы
    RESTRICTED = "restricted"  # Только для уполномоченных (админы/создатели)


class RoleFeatureMappingBase(BaseModel):
    company_role_id: int = Field(..., description="ID роли компании")
    bot_feature_id: int = Field(..., description="ID функции бота")
    is_enabled: bool = Field(True, description="Включена ли функция для роли")
    access_type: AccessType = Field(AccessType.OPEN, description="Тип доступа: open - для всех, restricted - только для уполномоченных")


class RoleFeatureMappingCreate(RoleFeatureMappingBase):
    pass


class RoleFeatureMappingUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    access_type: Optional[AccessType] = None


class RoleFeatureMappingResponse(RoleFeatureMappingBase):
    id: int

    class Config:
        from_attributes = True

