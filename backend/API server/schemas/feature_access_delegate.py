from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FeatureAccessDelegateBase(BaseModel):
    role_feature_mapping_id: int = Field(..., description="ID привязки роли и функционала")
    group_id: int = Field(..., description="Telegram ID группы")
    delegate_user_id: int = Field(..., description="Telegram user_id делегата")


class FeatureAccessDelegateCreate(FeatureAccessDelegateBase):
    created_by_user_id: Optional[int] = Field(None, description="Telegram user_id того, кто назначил делегата")


class FeatureAccessDelegateResponse(FeatureAccessDelegateBase):
    id: int
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

