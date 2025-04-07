from pydantic import BaseModel, Field
from typing import List, Optional

# Схема для информации о группе (используется в /context и возможно в /profile)
class GroupBase(BaseModel):
    id: int # Добавляем ID группы, если он есть в модели Group
    chat_id: str
    chat_title: str
    group_type: Optional[str] = None

    class Config:
        orm_mode = True # Позволяет Pydantic читать данные из ORM моделей

# Схема для основных данных пользователя (использовалась в заглушке)
class UserDataBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    is_senior_courier: bool = False

# Модель для полного ответа API /context (было UserContextResponse)
class UserGroupsContextResponse(BaseModel):
    # success: bool = True # Убрали success, API вернет 200 OK или ошибку
    groups: List[GroupBase] = []
    # user_data: UserDataBase # Убрали user_data, т.к. /context возвращает только группы

# --- НОВАЯ СХЕМА ДЛЯ /profile --- 
class UserProfileResponse(BaseModel):
    id: int # ID пользователя в нашей БД (например, Member.id)
    user_id: int # Telegram ID пользователя (Member.user_id)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    is_senior_courier: bool = False
    # Добавьте другие поля профиля, если они есть в вашей модели Member
    # is_admin: bool = False 
    # created_at: datetime? и т.д.

    class Config:
        orm_mode = True

# Модели для запросов (если понадобятся)
# class UserCreate(BaseModel):
#     user_id: int
#     username: Optional[str] = None

# class UserUpdate(BaseModel):
#     first_name: Optional[str] = None
#     last_name: Optional[str] = None
#     photo_url: Optional[str] = None
#     is_senior_courier: Optional[bool] = None

# Можно добавить другие модели по мере необходимости
# Например, модель для создания/обновления пользователя и т.д. 