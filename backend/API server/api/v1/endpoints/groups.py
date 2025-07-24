from fastapi import APIRouter, Depends, Query, HTTPException, status, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
import os
import httpx
import json
from datetime import datetime 

# Используем абсолютные импорты от корня /app
from db.session import get_db_session
from models.group import Group
from schemas.group import GroupRead # Схема для ответа
from models.group_member import GroupMember 
from models.member import Member 
from schemas.group_settings import GroupSettings, GroupSettingsUpdate
import logging

# --- НОВЫЕ ИМПОРТЫ для /chats ---
from sqlalchemy import func # Для агрегации
from sqlalchemy.orm import selectinload # Для эффективной загрузки связей
from schemas.user import UserSimple # Простая схема для админов
from pydantic import Field # Для описания полей
# --- -------------------------- ---

# --- НОВЫЕ СХЕМЫ для ответа /chats ---
class AdminInfo(UserSimple):
    pass

class MemberInfo(UserSimple):
    pass

class ChatWithAdmins(GroupRead):
    admins: List[AdminInfo] = Field(default_factory=list)
    members: List[MemberInfo] = Field(default_factory=list)
    # Добавляем недостающие поля, которые ожидает ChatItem на фронте
    chat_id: str # Убедимся, что это строка
    metadata: Optional[Dict[str, Any]] = None # Добавим метаданные




logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()



@router.get(
    "/", # Путь относительно префикса /groups, заданного в api.py
    response_model=List[GroupRead], # Ожидаем список групп
    summary="Get List of Groups",
    description="Retrieves a list of all groups, optionally filtered by type.",
    tags=["Groups"] # Тег для Swagger
)
async def read_groups(
    group_type: Optional[str] = Query(None, description="Filter groups by type (e.g., 'courier', 'chef')"),
    db: AsyncSession = Depends(get_db_session)
):
    query = select(Group)
    
    if group_type:
        query = query.where(Group.group_type == group_type)
        
    result = await db.execute(query.order_by(Group.title)) # Сортируем по названию для порядка
    groups = result.scalars().all()
    
    # Pydantic автоматически преобразует объекты Group в GroupRead
    return groups
@router.get(
    "/chats", # <--- НОВЫЙ ЭНДПОИНТ
    response_model=List[ChatWithAdmins],
    summary="Get List of Chats for Inventory/Actions",
    description="Retrieves a list of chats accessible to the user for specific actions, including admins.",
    tags=["Chats"] # Новый тег
)
async def read_chats_for_user(
    user_id: int = Query(..., description="Telegram ID of the user requesting the chat list"),
    group_type: Optional[str] = Query(None, description="Filter chats by group type (e.g., 'chef', 'courier')"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Fetches a list of chats the user is a member of, including administrators for each chat.
    """
    logger.info(f"[read_chats_for_user] GET /chats for user_id: {user_id}")

    # 1. Найти Member ID по Telegram user_id
    member_query = select(Member.id).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member_id = member_result.scalar_one_or_none()

    if not member_id:
        logger.warning(f"[read_chats_for_user] Member not found for user_id: {user_id}")
        # Возвращаем пустой список, а не 404, т.к. пользователь может быть в системе,
        # но еще не добавлен ни в одну группу через Member
        return []

    # 2. Найти все группы, где состоит данный member_id
    # Используем selectinload для загрузки связанных админов (GroupMember -> Member)
    # Загружаем все связи GroupMember для нужных групп, а затем фильтруем админов
    groups_query = (
        select(Group)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.member_id == member_id)
        .options(
            selectinload(Group.members).selectinload(GroupMember.member) # Загружаем всех участников и их Member данные
        )
        .order_by(Group.title)
    )

    # NEW: Apply group_type filter if provided
    if group_type:
        groups_query = groups_query.where(Group.group_type == group_type)

    result = await db.execute(groups_query)
    groups = result.unique().scalars().all() # unique() чтобы избежать дублей из-за JOIN

    # <<< ДОБАВИТЬ ЛОГ ЗДЕСЬ >>>
    logger.info(f"[read_chats_for_user] Found groups from DB query (user_id={user_id}, group_type={group_type}): {[g.group_id for g in groups]}")
    # <<< ------------------- >>>

    response_list: List[ChatWithAdmins] = []
    for group in groups:
        admins_list: List[AdminInfo] = []
        members_list: List[MemberInfo] = []
        if group.members: # Проверяем, что участники загружены
            for gm in group.members:
                # Проверяем роль и наличие данных участника
                if gm.member:
                    # ВРУЧНУЮ создаем словарь для участника
                    member_data = {
                        "id": gm.member.id,
                        "user_id": gm.member.user_id,
                        "first_name": gm.member.first_name,
                        "last_name": gm.member.last_name,
                        "username": gm.member.username,
                        "photo_url": gm.member.photo_url # Pydantic сам обработает None и HttpUrl
                    }
                    
                    # Разделяем админов и обычных участников
                    if gm.role in ['administrator', 'creator']:
                        # Передаем словарь в AdminInfo
                        admins_list.append(AdminInfo(**member_data))
                    else:
                        # Передаем словарь в MemberInfo для обычных участников
                        members_list.append(MemberInfo(**member_data))

        # Формируем ответ ЯВНО, выбирая нужные поля из group
        # Убедимся, что все поля, ожидаемые ChatWithAdmins (унаследованные от GroupRead)
        # присутствуют и имеют правильный тип
        response_list.append(
            ChatWithAdmins(
                # Поля, унаследованные от GroupRead/GroupBase:
                id=group.id, 
                chat_id=str(group.group_id), # Преобразуем в строку
                title=group.title,
                group_type=group.group_type,
                created_at=group.created_at,
                # Поля, добавленные в GroupRead/ChatWithAdmins:
                admins=admins_list,
                members=members_list,
                metadata=group.json_metadata, # Используем json_metadata из модели Group
                slot_config=group.slot_config, # Добавляем slot_config
                access_settings=group.access_settings # Добавляем access_settings
                # Убедись, что is_senior_courier не нужен на уровне группы в этом ответе
                # Если нужен, его надо как-то получить (например, из GroupMember запрашивающего?)
            )
        )

    logger.info(f"[read_chats_for_user] Found {len(response_list)} chats for user_id: {user_id}")
    
    # Добавляем детальную информацию для отладки
    for chat in response_list:
        logger.info(f"[read_chats_for_user] Chat {chat.chat_id}: {len(chat.admins)} admins, {len(chat.members)} members")
    
    return response_list
# Можно добавить и другие ручки сюда, например, для получения одной группы по ID

@router.get(
    "/{group_db_id}", 
    response_model=GroupRead,
    summary="Get Group by Database ID",
    description="Retrieves a specific group by its internal database ID.",
    tags=["Groups"]
)
async def read_group_by_db_id(
    group_db_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    group = await db.get(Group, group_db_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group with DB ID {group_db_id} not found")
    return group 

# --- Эндпоинты настроек (перенесено из group_settings.py) --- 

# Вспомогательная функция для получения группы по Telegram ID (если еще не существует)
async def get_group_by_telegram_id(db: AsyncSession, group_telegram_id: int) -> Group | None:
    """Вспомогательная функция для получения группы по Telegram ID."""
    logger.info(f"[get_group_by_telegram_id] Ищем группу с group_id = {group_telegram_id} (тип: {type(group_telegram_id)})")
    query = select(Group).where(Group.group_id == group_telegram_id)
    logger.info(f"[get_group_by_telegram_id] SQLAlchemy Query: {query}")
    try:
        result = await db.execute(query)
        group = result.scalar_one_or_none()
        logger.info(f"[get_group_by_telegram_id] Результат scalar_one_or_none(): {group}")
        return group
    except Exception as e:
        logger.exception(f"[get_group_by_telegram_id] Ошибка при выполнении запроса к БД для group_id={group_telegram_id}")
        raise

@router.get("/{group_telegram_id}/settings", response_model=GroupSettings)
async def read_group_settings(
    group_telegram_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Получает настройки доступа к сменам для указанной группы.
       Читает данные **только** из нового поля `access_settings`.
    """
    logger.info(f"[read_group_settings] Вход GET /groups/{group_telegram_id}/settings")
    db_group = await get_group_by_telegram_id(db, group_telegram_id)
    logger.info(f"[read_group_settings] Результат поиска группы: {db_group}")

    if db_group is None:
        logger.warning(f"[read_group_settings] Группа {group_telegram_id} не найдена! Возвращаем 404.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Берем данные ТОЛЬКО из нового поля
    settings_data = db_group.access_settings
    source_field = "access_settings"

    # Если в access_settings пусто (None), используем пустой словарь
    settings_data = settings_data or {}
    settings_data['group_id'] = db_group.group_id
    logger.info(f"[read_group_settings] Настройки взяты из '{source_field}': {settings_data}")

    try:
        response_model = GroupSettings(**settings_data)
        logger.info(f"[read_group_settings] Успешно возвращаем настройки для группы {group_telegram_id}")
        return response_model
    except Exception as e:
        # Ошибка теперь может быть только при парсинге данных из access_settings
        logger.exception(f"[read_group_settings] Ошибка парсинга настроек из '{source_field}' для группы {group_telegram_id}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid settings data in database")

@router.put("/{group_telegram_id}/settings", response_model=GroupSettings)
async def update_group_settings(
    group_telegram_id: int,
    settings: GroupSettingsUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """Обновляет настройки доступа к сменам для указанной группы.
       Всегда записывает данные в новое поле `access_settings`.
    """
    logger.info(f"[update_group_settings] Вход PUT /groups/{group_telegram_id}/settings с данными: {settings.model_dump()}")
    db_group = await get_group_by_telegram_id(db, group_telegram_id)
    logger.info(f"[update_group_settings] Результат поиска группы: {db_group}")

    if db_group is None:
        logger.warning(f"[update_group_settings] Группа {group_telegram_id} не найдена! Возвращаем 404.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    update_data = settings.model_dump(exclude_unset=True)
    logger.info(f"[update_group_settings] Данные для обновления поля 'access_settings': {update_data}")
    # Записываем всегда в новое поле
    db_group.access_settings = update_data

    try:
        await db.commit()
        await db.refresh(db_group)
        logger.info(f"[update_group_settings] Настройки для группы {group_telegram_id} успешно сохранены в 'access_settings'.")
    except Exception as e:
        await db.rollback()
        logger.exception(f"[update_group_settings] Ошибка при сохранении настроек в 'access_settings' для группы {group_telegram_id}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update settings")

    # В ответе используем данные из обновленного поля access_settings
    response_data = db_group.access_settings or {}
    response_data['group_id'] = db_group.group_id
    logger.info(f"[update_group_settings] Успешно возвращаем обновленные настройки для группы {group_telegram_id} из 'access_settings'")

    # --- Вызов API шедулера --- 
    try:
        scheduler_url = os.getenv("SCHEDULER_API_URL", "http://scheduler:8002")
        endpoint_url = f"{scheduler_url}/scheduler/availability/access-settings"
        async with httpx.AsyncClient() as client:
            schedule_payload = {"chat_id": str(group_telegram_id)}
            logger.info(f"[update_group_settings] Отправка запроса на применение настроек в шедулер: {endpoint_url} с payload: {schedule_payload}")
            response = await client.post(endpoint_url, json=schedule_payload, timeout=10.0)
            response.raise_for_status()
            logger.info(f"[update_group_settings] Ответ от шедулера ({response.status_code}): {response.json()}")
    except httpx.RequestError as exc:
        logger.error(f"[update_group_settings] Ошибка при вызове API шедулера (RequestError): {exc}")
    except httpx.HTTPStatusError as exc:
        logger.error(f"[update_group_settings] Ошибка от API шедулера (HTTPStatusError {exc.response.status_code}): {exc.response.text}")
    except Exception as exc:
        logger.exception("[update_group_settings] Неизвестная ошибка при вызове API шедулера")

    return GroupSettings(**response_data) 

# Импортируем Path и типы для словарей
# from fastapi import Path # Уже импортирован
# from typing import Dict, Any # Уже импортирован
# Импортируем BaseModel из Pydantic (если еще не импортирован)
from pydantic import BaseModel

# --- Модели Pydantic для Slot Config ---
# (Лучше вынести в schemas/slot_config.py, но пока добавим сюда)

class DaySlotConfig(BaseModel):
    maxDaySlots: int
    maxNightSlots: int
    hasSeniorSlot: Optional[bool] = False
    # Время начала и конца дневной смены
    dayShiftStartTime: Optional[str] = "10:00"  # формат "HH:mm"
    dayShiftEndTime: Optional[str] = "18:00"    # формат "HH:mm"
    # Время начала и конца ночной смены
    nightShiftStartTime: Optional[str] = "18:00"  # формат "HH:mm"
    nightShiftEndTime: Optional[str] = "02:00"    # формат "HH:mm"

class SlotConfigUpdate(BaseModel):
    # Ключи - это индексы дня '0'-'6'
    config: Dict[str, DaySlotConfig] 

class SlotConfigResponse(BaseModel):
    # Ключи - это индексы дня '0'-'6'
    config: Dict[str, DaySlotConfig]

# --- Эндпоинты для Slot Config ---

@router.put(
    "/{group_telegram_id}/slot_config",
    response_model=SlotConfigResponse,
    summary="Update Slot Configuration",
    description="Updates the slot configuration for the specified group by its Telegram ID.",
    tags=["Groups", "Slot Config"] # Добавляем тег Slot Config
)
async def update_slot_config(
    slot_config_update: SlotConfigUpdate,
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет конфигурацию слотов для группы.
    Перезаписывает все поле `slot_config`.
    """
    logger.info(f"[update_slot_config] PUT /groups/{group_telegram_id}/slot_config data: {slot_config_update.model_dump()}")
    db_group = await get_group_by_telegram_id(db, group_telegram_id)
    if not db_group:
        logger.warning(f"[update_slot_config] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Преобразуем DaySlotConfig объекты в словари перед сохранением
    config_to_save = {
        day: day_config.model_dump() 
        for day, day_config in slot_config_update.config.items()
    }
    db_group.slot_config = config_to_save

    try:
        await db.commit()
        await db.refresh(db_group) # <<< Раскомментируем refresh
        logger.info(f"[update_slot_config] Slot config for group {group_telegram_id} updated successfully.")
        # Возвращаем данные ИЗ ОБЪЕКТА ПОСЛЕ REFRESH (т.е. из БД)
        return SlotConfigResponse(config=db_group.slot_config or {})
    except Exception as e:
        await db.rollback()
        logger.exception(f"[update_slot_config] Error updating slot config for group {group_telegram_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update slot configuration"
        )

@router.get(
    "/{group_telegram_id}/slot_config",
    response_model=SlotConfigResponse,
    summary="Get Slot Configuration",
    description="Retrieves the slot configuration for the specified group by its Telegram ID.",
    tags=["Groups", "Slot Config"]
)
async def get_slot_config(
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает конфигурацию слотов для группы.
    Возвращает {"config": {}} если конфигурация не установлена.
    """
    logger.info(f"[get_slot_config] GET /groups/{group_telegram_id}/slot_config")
    db_group = await get_group_by_telegram_id(db, group_telegram_id)
    if not db_group:
        logger.warning(f"[get_slot_config] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Возвращаем данные из поля slot_config, или пустой словарь, если оно None/null
    slot_config_data = db_group.slot_config or {}
    logger.info(f"[get_slot_config] Returning slot config for group {group_telegram_id}: {slot_config_data}")
    return SlotConfigResponse(config=slot_config_data)

# --- Эндпоинт для получения участников группы ---
class GroupMemberInfo(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_position: str
    user_department: str
    role: str
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True

@router.get(
    "/{group_telegram_id}/members",
    response_model=List[GroupMemberInfo],
    summary="Get Group Members",
    description="Retrieves a list of all members in the specified group.",
    tags=["Groups", "Members"]
)
async def get_group_members(
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список всех участников группы.
    """
    logger.info(f"[get_group_members] GET /groups/{group_telegram_id}/members")
    
    # Находим группу по telegram_id
    group = await get_group_by_telegram_id(db, group_telegram_id)
    if not group:
        logger.warning(f"[get_group_members] Группа {group_telegram_id} не найдена")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    
    # Запрос для получения участников группы
    members_query = (
        select(GroupMember, Member)
        .join(Member, GroupMember.member_id == Member.id)
        .where(GroupMember.group_id == group.id)
        .order_by(Member.first_name, Member.last_name)
    )
    
    result = await db.execute(members_query)
    members_data = result.all()
    
    # Формируем ответ
    members_list = []
    for group_member, member in members_data:
        # Формируем полное имя
        full_name = f"{member.first_name or ''} {member.last_name or ''}".strip()
        if not full_name:
            full_name = member.username or f"User {member.user_id}"
        
        members_list.append(GroupMemberInfo(
            id=group_member.id,
            user_id=member.user_id,
            user_name=full_name,
            user_position=member.first_name or "Участник",  # Можно добавить поле position в Member
            user_department=member.last_name or "Отдел",    # Можно добавить поле department в Member
            role=group_member.role,
            photo_url=member.photo_url
        ))
    
    logger.info(f"[get_group_members] Found {len(members_list)} members in group {group_telegram_id}")
    return members_list

# --- Модели Pydantic для обновления статуса старшего --- 
class SeniorityUpdate(BaseModel):
    is_senior_courier: bool # Статус не может быть null при явном обновлении

class SeniorityResponse(BaseModel):
    group_id: int
    member_id: int
    is_senior_courier: Optional[bool] # В ответе может быть null, если еще не установлен
    role: str

# ---ЭНДПОИНТ ДЛЯ ОБНОВЛЕНИЯ СТАТУСА СТАРШЕГО --- 
@router.put(
    "/{group_telegram_id}/members/{user_telegram_id}/seniority",
    response_model=SeniorityResponse, 
    summary="Update Senior Courier Status for a Member in a Group",
    description="Sets or unsets the senior courier status for a specific member within a specific group.",
    tags=["Groups", "Members"]
)
async def update_member_seniority(
    # Аргументы пути
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    user_telegram_id: int = Path(..., description="Telegram ID of the user (member)"), 
    # Тело запроса (с явным указанием Body)
    seniority_data: SeniorityUpdate = Body(...), 
    # Зависимость
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates the is_senior_courier flag for a specific GroupMember association.
    """
    # Находим группу по group_telegram_id
    group = await get_group_by_telegram_id(db, group_telegram_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Находим участника по user_telegram_id
    member_query = select(Member).where(Member.user_id == user_telegram_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Находим связь group_member по group.id и member.id
    group_member_query = (
        select(GroupMember)
        .where(GroupMember.group_id == group.id)
        .where(GroupMember.member_id == member.id)
    )
    group_member_result = await db.execute(group_member_query)
    group_member = group_member_result.scalars().first()

    if not group_member:
        # Этой ситуации не должно быть, если пользователь есть в группе, но на всякий случай
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of this group")

    # Обновляем флаг is_senior_courier
    group_member.is_senior_courier = seniority_data.is_senior_courier

    try:
        await db.commit()
        await db.refresh(group_member)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update senior status: {e}"
        )

    # Возвращаем обновленные данные связи
    return SeniorityResponse(
        group_id=group.id, # Внутренний ID группы
        member_id=member.id, # Внутренний ID участника
        is_senior_courier=group_member.is_senior_courier,
        role=group_member.role
    )

# --- Модель для ответа со списком курьеров ---
class CourierInfo(BaseModel):
    id: int
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    is_senior_courier: Optional[bool] = None
    role: Optional[str] = None
    username: Optional[str] = None

    class Config:
        from_attributes = True

@router.get(
    "/{group_telegram_id}/couriers",
    response_model=List[CourierInfo],
    summary="Get All Couriers in Group",
    description="Retrieves a list of all couriers in the specified group. Only accessible to senior couriers and group creators.",
    tags=["Groups", "Couriers"]
)
async def get_group_couriers(
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    requester_id: int = Query(..., description="Telegram ID of the user requesting the data"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список всех курьеров в группе.
    Доступно только для старших курьеров и создателей группы.
    """
    logger.info(f"[get_group_couriers] GET /groups/{group_telegram_id}/couriers (requester: {requester_id})")
    
    # Находим группу по telegram_id
    group = await get_group_by_telegram_id(db, group_telegram_id)
    if not group:
        logger.warning(f"[get_group_couriers] Группа {group_telegram_id} не найдена")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    
    # Находим запрашивающего участника по user_id
    requester_member_query = select(Member).where(Member.user_id == requester_id)
    requester_member_result = await db.execute(requester_member_query)
    requester_member = requester_member_result.scalars().first()
    
    if not requester_member:
        logger.warning(f"[get_group_couriers] Пользователь {requester_id} не найден")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requester not found")
    
    # Проверяем авторизацию - является ли запрашивающий старшим курьером или создателем группы
    group_member_query = (
        select(GroupMember)
        .where(GroupMember.group_id == group.id)
        .where(GroupMember.member_id == requester_member.id)
    )
    group_member_result = await db.execute(group_member_query)
    requester_group_membership = group_member_result.scalars().first()
    
    if not requester_group_membership:
        logger.warning(f"[get_group_couriers] Пользователь {requester_id} не является членом группы {group_telegram_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of this group")
    
    # Проверяем, является ли запрашивающий старшим курьером или создателем
    is_authorized = (
        requester_group_membership.is_senior_courier or 
        requester_group_membership.role == 'creator'
    )
    
    if not is_authorized:
        logger.warning(f"[get_group_couriers] Доступ запрещен для пользователя {requester_id} (не старший курьер/не создатель)")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only senior couriers and group creators can access this endpoint")
    
    # Получаем всех участников группы
    # Создаем JOIN запрос, чтобы получить данные из GroupMember и Member одновременно
    couriers_query = (
        select(GroupMember, Member)
        .join(Member, GroupMember.member_id == Member.id)
        .where(GroupMember.group_id == group.id)
        .where(Member.user_id != requester_id)  # Исключаем запрашивающего пользователя из результатов
    )
    
    couriers_result = await db.execute(couriers_query)
    couriers_data = couriers_result.all()
    
    # Преобразуем результат в список CourierInfo
    couriers_list = []
    for group_member, member in couriers_data:
        courier_info = {
            "id": member.id,
            "user_id": member.user_id,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "photo_url": member.photo_url,
            "username": member.username,
            "is_senior_courier": group_member.is_senior_courier,
            "role": group_member.role
        }
        couriers_list.append(CourierInfo(**courier_info))
    
    logger.info(f"[get_group_couriers] Успешно получен список курьеров для группы {group_telegram_id}: {len(couriers_list)} записей")
    return couriers_list


