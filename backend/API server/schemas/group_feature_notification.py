from pydantic import BaseModel, Field
from typing import Optional


class GroupFeatureNotificationBase(BaseModel):
    bot_feature_id: int = Field(..., description="ID функции бота")
    working_group_id: int = Field(..., description="ID рабочей группы")
    notification_group_id: int = Field(..., description="ID группы для уведомлений")
    notification_type: str = Field(..., description="Тип уведомления: excel, message, file")


class GroupFeatureNotificationCreate(GroupFeatureNotificationBase):
    pass


class GroupFeatureNotificationUpdate(BaseModel):
    notification_group_id: Optional[int] = None
    notification_type: Optional[str] = None


class GroupFeatureNotificationResponse(GroupFeatureNotificationBase):
    id: int

    class Config:
        from_attributes = True

