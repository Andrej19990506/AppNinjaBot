from typing import List, Optional

from pydantic import BaseModel, Field


class TelegramWebAppAuthRequest(BaseModel):
    init_data: str = Field(..., min_length=1, description="Telegram WebApp initData string")


class AuthTokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_expires_in: int
    refresh_expires_in: int


class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class DevAuthRequest(BaseModel):
    user_id: int = Field(..., description="Telegram user ID for dev authentication")


class AuthenticatedUser(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None


class AuthenticatedGroup(BaseModel):
    group_id: str
    title: Optional[str] = None
    group_type: Optional[str] = None
    role: Optional[str] = None
    is_senior_courier: Optional[bool] = None


class TelegramAuthResponse(BaseModel):
    tokens: AuthTokenPair
    user: AuthenticatedUser
    groups: List[AuthenticatedGroup] = []


class BotTokenStoreRequest(BaseModel):
    token: str = Field(..., min_length=16, description="One-time authentication token")
    user_id: int = Field(..., description="Telegram user ID")
    expires_in: int = Field(300, ge=60, le=3600, description="Token expiration time in seconds")
    session_id: Optional[str] = Field(None, description="Browser session ID for WebSocket real-time notification")


class BotTokenAuthRequest(BaseModel):
    token: str = Field(..., min_length=16, description="One-time authentication token from bot")

