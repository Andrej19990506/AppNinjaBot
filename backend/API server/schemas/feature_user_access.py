from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FeatureUserAccessBase(BaseModel):
    role_feature_mapping_id: int = Field(..., description="ID привязки роли и функционала")
    group_id: int = Field(..., description="Telegram ID группы")
    user_id: int = Field(..., description="Telegram user_id пользователя, которому выдан доступ")
    granted_by_user_id: int = Field(..., description="Telegram user_id делегата, который выдал доступ")


class FeatureUserAccessCreate(FeatureUserAccessBase):
    expires_at: Optional[datetime] = Field(None, description="Срок действия доступа (опционально)")


class FeatureUserAccessResponse(FeatureUserAccessBase):
    id: int
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True

