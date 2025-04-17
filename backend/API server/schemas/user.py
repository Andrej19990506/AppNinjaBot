from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
import datetime

# --- НОВАЯ ПРОСТАЯ СХЕМА --- 
class UserSimple(BaseModel):
    id: int # Внутренний ID из таблицы Member
    user_id: int # Telegram ID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[HttpUrl] = None

    class Config:
        from_attributes = True # Используем новый синтаксис Pydantic V2
# --- --------------------- ---

# Схема для информации о группе (используется в /context и возможно в /profile)
class GroupBase(BaseModel):
    id: int # Добавляем ID группы, если он есть в модели Group
    chat_id: str
    chat_title: str
    group_type: Optional[str] = None
    is_senior_courier: Optional[bool] = None

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

# Схема для чтения Group (возможно, уже существует)
class GroupRead(GroupBase):
    metadata: Optional[Dict[str, Any]] = None
    slot_config: Optional[Dict[str, Any]] = None
    access_settings: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

# Полная схема для пользователя (вероятно, уже существует)
class User(BaseModel):
    id: int # Telegram ID пользователя
    first_name: str = ""
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[HttpUrl] = None
    language_code: Optional[str] = None
    isAdmin: bool = False
    adminRights: Optional[Dict[str, Any]] = None # Права админа, если есть
    groups: List[GroupRead] = [] # Используем GroupRead для вложенных групп
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# Схема для обновления профиля (вероятно, уже существует)
class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[HttpUrl] = None

# Схема для ответа профиля (вероятно, уже существует)
class UserProfileResponse(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[HttpUrl] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True 