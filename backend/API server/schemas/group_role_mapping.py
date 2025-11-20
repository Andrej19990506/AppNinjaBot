from pydantic import BaseModel, Field
from typing import Optional


class GroupRoleMappingBase(BaseModel):
    group_id: int = Field(..., description="ID группы Telegram")
    company_role_id: int = Field(..., description="ID роли компании")
    is_working_group: bool = Field(True, description="Рабочая группа (бот работает) или только уведомления")


class GroupRoleMappingCreate(GroupRoleMappingBase):
    pass


class GroupRoleMappingUpdate(BaseModel):
    company_role_id: Optional[int] = None
    is_working_group: Optional[bool] = None


class GroupRoleMappingResponse(GroupRoleMappingBase):
    id: int

    class Config:
        from_attributes = True

