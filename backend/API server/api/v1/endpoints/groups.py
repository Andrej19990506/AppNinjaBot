from fastapi import APIRouter, Depends, Query, HTTPException, status, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
import os
import httpx
import json

# Используем абсолютные импорты от корня /app
from db.session import get_db_session
from models.group import Group
from schemas.group import GroupRead # Схема для ответа
from models.group_member import GroupMember # <-- Добавляем импорт GroupMember
from models.member import Member # <-- Добавляем импорт Member
from models.inventory_history import InventoryHistory # <--- ДОБАВЛЯЕМ ИМПОРТ ИСТОРИИ

# Импорты, необходимые для настроек (проверь дубликаты)
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
    # Можно добавить роль, если нужно
    # role: str
    pass

class ChatWithAdmins(GroupRead):
    admins: List[AdminInfo] = Field(default_factory=list)
    # Добавляем недостающие поля, которые ожидает ChatItem на фронте
    chat_id: str # Убедимся, что это строка
    metadata: Optional[Dict[str, Any]] = None # Добавим метаданные

    # Конфигурация для преобразования group_id в chat_id при валидации
    # или сделаем это при формировании ответа
# --- ----------------------------- ---

# --- НОВЫЕ ИМПОРТЫ для /inventory/{chat_id} ---
from schemas.inventory import InventoryData # ПРЕДПОЛАГАЕМАЯ СХЕМА
from schemas.inventory import InventoryUpdatePayload 
# from crud.inventory import get_inventory_by_chat_id # ПРЕДПОЛАГАЕМЫЙ CRUD
# ------------------------------------------

# Убедись, что логгер настроен или используй существующий, если он есть в groups.py
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
    """
    Fetches a list of groups, optionally filtered by group_type.
    """
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

    response_list: List[ChatWithAdmins] = []
    for group in groups:
        admins_list: List[AdminInfo] = []
        if group.members: # Проверяем, что участники загружены
            for gm in group.members:
                # Проверяем роль и наличие данных участника
                if gm.role in ['admin', 'creator'] and gm.member:
                    # ВРУЧНУЮ создаем словарь для AdminInfo
                    admin_data = {
                        "id": gm.member.id,
                        "user_id": gm.member.user_id,
                        "first_name": gm.member.first_name,
                        "last_name": gm.member.last_name,
                        "username": gm.member.username,
                        "photo_url": gm.member.photo_url # Pydantic сам обработает None и HttpUrl
                    }
                    # Передаем словарь в AdminInfo
                    admins_list.append(AdminInfo(**admin_data))

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
                metadata=group.json_metadata, # Используем json_metadata из модели Group
                slot_config=group.slot_config, # Добавляем slot_config
                access_settings=group.access_settings # Добавляем access_settings
                # Убедись, что is_senior_courier не нужен на уровне группы в этом ответе
                # Если нужен, его надо как-то получить (например, из GroupMember запрашивающего?)
            )
        )

    logger.info(f"[read_chats_for_user] Found {len(response_list)} chats for user_id: {user_id}")
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
from fastapi import Path
from typing import Dict, Any
# Импортируем BaseModel из Pydantic (если еще не импортирован)
from pydantic import BaseModel

# --- Модели Pydantic для Slot Config ---
# (Лучше вынести в schemas/slot_config.py, но пока добавим сюда)

class DaySlotConfig(BaseModel):
    maxDaySlots: int
    maxNightSlots: int

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

# --- Модели Pydantic для обновления статуса старшего --- 
class SeniorityUpdate(BaseModel):
    is_senior_courier: bool # Статус не может быть null при явном обновлении

class SeniorityResponse(BaseModel):
    group_id: int
    member_id: int
    is_senior_courier: Optional[bool] # В ответе может быть null, если еще не установлен
    role: str

# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ОБНОВЛЕНИЯ СТАТУСА СТАРШЕГО --- 
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

# <<< НОВЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ШАБЛОНА ИНВЕНТАРЯ >>>
@router.get(
    "/inventory/template",
    response_model=Dict[str, Any], # Возвращаем просто словарь JSON
    summary="Get Inventory Template",
    description="Retrieves the default inventory template structure from a JSON file.",
    tags=["Inventory", "Templates"]
)
async def get_inventory_template():
    """
    Reads and returns the inventory template from the predefined JSON file.
    """
    # ИЗМЕНЕНО: Используем абсолютный путь внутри контейнера
    template_path = "/app/data/templates/inventory_template.json"
    # Старый код для относительного пути:
    # template_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "templates", "inventory_template.json")
    # template_path = os.path.normpath(template_path)
    logger.info(f"[get_inventory_template] Attempting to read template from: {template_path}")

    if not os.path.exists(template_path):
        logger.error(f"[get_inventory_template] Template file not found at: {template_path}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Inventory template file not found on server.")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = json.load(f)
        logger.info(f"[get_inventory_template] Template loaded successfully.")
        return template_data
    except json.JSONDecodeError as e:
        logger.error(f"[get_inventory_template] Error decoding JSON template file: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error reading inventory template file.")
    except Exception as e:
        logger.exception(f"[get_inventory_template] An unexpected error occurred while reading the template file")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

# <<< НОВЫЙ ЭНДПОИНТ ДЛЯ ИНВЕНТАРЯ >>>
@router.get(
    "/inventory/{chat_id}", # Используем строковый chat_id, как на фронте
    # response_model=InventoryData, # <<< УБРАНО response_model
    summary="Get Inventory Data for a Chat",
    description="Retrieves the current inventory data, metadata, and admins for a specific chat by its Telegram ID.",
    tags=["Inventory"] # Новый тег
)
async def read_inventory_for_chat(
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session) # Используем существующую зависимость
):
    """
    Fetches inventory data for a specific chat.
    """
    logger.info(f"[read_inventory_for_chat] GET /inventory/{chat_id}")

    # 1. Найти группу по chat_id (group_id в модели), чтобы получить ID базы данных
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
         logger.error(f"[read_inventory_for_chat] Invalid chat_id format: {chat_id}")
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        # Получаем группу
        group_query = select(Group).where(Group.group_id == group_telegram_id)
        group_result = await db.execute(group_query)
        group = group_result.scalar_one_or_none()

        if not group:
            logger.warning(f"[read_inventory_for_chat] Group not found for chat_id: {chat_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")
            
        # <<< ДОБАВЛЕНА ПРОВЕРКА ТИПА ГРУППЫ >>>
        if group.group_type != 'chef':
            logger.warning(f"[read_inventory_for_chat] Inventory access denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory data is only available for groups of type 'chef'")

        # 2. Получить данные инвентаря (из JSON поля)
        inventory_data = group.json_inventory or {}

        # 3. Получить метаданные (из JSON поля)
        metadata = group.json_metadata or {}
        last_updated = metadata.get("lastUpdated")
        progress = metadata.get("progress", 0) # По умолчанию 0

        # 4. Получить список админов - отдельным запросом
        admins_query = (
            select(Member)
            .join(GroupMember, GroupMember.member_id == Member.id)
            .where(
                GroupMember.group_id == group.id,
                GroupMember.role.in_(['admin', 'creator'])
            )
        )
        admins_result = await db.execute(admins_query)
        admins = admins_result.scalars().all()
        
        # Создаем список словарей с информацией об админах
        admins_list_of_dicts = []
        for admin in admins:
            admin_data = {
                "id": admin.id,
                "user_id": admin.user_id,
                "first_name": admin.first_name,
                "last_name": admin.last_name,
                "username": admin.username,
                "photo_url": str(admin.photo_url) if admin.photo_url else None
            }
            admins_list_of_dicts.append(admin_data)

        # 5. Сформировать ОТВЕТНЫЙ СЛОВАРЬ вручную
        response_dict = {
            "inventory": inventory_data,
            "metadata": {
                "lastUpdated": last_updated,
                "progress": progress,
                "chat_id": chat_id
            },
            "chat_title": group.title,
            "admins": admins_list_of_dicts
        }

        logger.info(f"[read_inventory_for_chat] Successfully retrieved inventory for chat_id: {chat_id}")

        # Возвращаем простой словарь
        return response_dict
        
    except Exception as e:
        logger.exception(f"[read_inventory_for_chat] Error retrieving inventory for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not retrieve inventory data")

# <<< НОВЫЙ ЭНДПОИНТ ДЛЯ СОХРАНЕНИЯ ИНВЕНТАРЯ >>>
@router.post(
    "/inventory/{chat_id}",
    response_model=InventoryData, # Возвращаем обновленные данные
    summary="Update Inventory Data for a Chat",
    description="Updates the inventory data and metadata for a specific chat. Only available for 'chef' groups.",
    tags=["Inventory"]
)
async def update_inventory_for_chat(
    payload: InventoryUpdatePayload, # Данные из тела запроса
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates inventory data for a specific chat, only if it's a 'chef' group.
    """
    logger.info(f"[update_inventory_for_chat] POST /inventory/{chat_id}")

    # 1. Найти группу по chat_id
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[update_inventory_for_chat] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        group_query = select(Group).where(Group.group_id == group_telegram_id)
        group_result = await db.execute(group_query)
        group = group_result.scalar_one_or_none()

        if not group:
            logger.warning(f"[update_inventory_for_chat] Group not found for chat_id: {chat_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

        # 2. Проверить тип группы <<< ВАЖНО >>>
        if group.group_type != 'chef':
            logger.warning(f"[update_inventory_for_chat] Inventory update denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory data can only be updated for groups of type 'chef'")

        # 3. Обновить данные инвентаря и метаданные
        logger.info(f"Updating inventory for chat_id: {chat_id}")
        group.json_inventory = payload.inventory # Перезаписываем инвентарь
        group.metadata = payload.metadata

        # --- ДОБАВЛЯЕМ СОХРАНЕНИЕ ИСТОРИИ --- 
        new_history_record = None # Инициализируем переменную
        if payload.history:
            history_data = payload.history
            author_member_id = payload.metadata.get('currentUser', {}).get('id')

            # --- ЛОГИКА ОПРЕДЕЛЕНИЯ itemType --- 
            category = history_data.get('category')
            item_name = history_data.get('itemName')
            # ВОЗВРАЩАЕМ: Ожидаем ключ 'itemType' из history payload
            item_type_from_history = history_data.get('itemType') 
            # --- УБИРАЕМ ЛОГИРОВАНИЕ ПОЛУЧЕННОГО ТИПА (оно не сработало) ---
            # logger.info(f"[update_inventory_for_chat]   Raw value from history_data.get('itemType'): '{item_type_from_history}' (type: {type(item_type_from_history)})")
            # ---------------------------------------------------------
            final_item_type = None

            if item_type_from_history in ['raw', 'semifinished']:
                final_item_type = item_type_from_history
            else:
                # ИСПРАВЛЕНО: Используем 'itemType' в тексте лога
                if item_type_from_history is not None:
                    logger.warning(f"[update_inventory_for_chat] Invalid 'itemType' value ('{item_type_from_history}') in history payload for chat_id {chat_id}. Attempting to infer from inventory.")
                else:
                     logger.warning(f"[update_inventory_for_chat] Missing 'itemType' key in history payload for chat_id {chat_id}. Attempting to infer from inventory.")
                
                # Пытаемся найти тип в данных инвентаря
                if category and item_name and payload.inventory:
                    item_in_inventory = payload.inventory.get(category, {}).get(item_name, {})
                    if item_in_inventory:
                        # Здесь в инвентаре ключ называется itemType
                        item_type_from_inventory = item_in_inventory.get('itemType') 
                        if item_type_from_inventory in ['raw', 'semifinished']:
                            final_item_type = item_type_from_inventory
                            logger.info(f"[update_inventory_for_chat] Inferred itemType '{final_item_type}' for {category}/{item_name} from inventory data.")
                        else:
                             logger.warning(f"[update_inventory_for_chat] Found item {category}/{item_name} in inventory, but its itemType ('{item_type_from_inventory}') is invalid or missing.")
                    else:
                         logger.warning(f"[update_inventory_for_chat] Could not find item {category}/{item_name} in inventory payload to infer itemType.")
                else:
                    logger.warning("[update_inventory_for_chat] Cannot infer itemType: Missing category, itemName, or inventory data in payload.")

            # Финальная проверка - удалось ли определить тип?
            if final_item_type is None:
                # ИСПРАВЛЕНО: Используем 'itemType' в тексте лога
                logger.error(f"[update_inventory_for_chat] Could not determine a valid itemType for history record: category='{category}', item='{item_name}'. Received itemType from history: '{item_type_from_history}'")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Could not determine a valid itemType ('raw' or 'semifinished') for the history record of item '{item_name}'."
                )
            # --- КОНЕЦ ЛОГИКИ ОПРЕДЕЛЕНИЯ itemType ---
                
            # Пытаемся найти Member ID автора в БД
            member_db_id = None
            if author_member_id:
                member_query = select(Member.id).where(Member.user_id == author_member_id)
                member_result = await db.execute(member_query)
                member_db_id = member_result.scalar_one_or_none()
                if not member_db_id:
                    logger.warning(f"[update_inventory_for_chat] Author member with Telegram ID {author_member_id} not found in DB for history record.")
                    # Пока не указываем автора (author_id=None)
            
            # --- ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ПЕРЕД СОЗДАНИЕМ ИСТОРИИ ---
            logger.info(f"[update_inventory_for_chat] Preparing to create InventoryHistory record.")
            logger.info(f"[update_inventory_for_chat]   group_id: {group.id} (type: {type(group.id)})")
            logger.info(f"[update_inventory_for_chat]   category: '{category}' (type: {type(category)})")
            logger.info(f"[update_inventory_for_chat]   item_name: '{item_name}' (type: {type(item_name)})")
            logger.info(f"[update_inventory_for_chat]   action: '{history_data.get('action')}' (type: {type(history_data.get('action'))})")
            logger.info(f"[update_inventory_for_chat]   type (final_item_type): '{final_item_type}' (type: {type(final_item_type)})")
            logger.info(f"[update_inventory_for_chat]   old_quantity: {history_data.get('oldQuantity')} (type: {type(history_data.get('oldQuantity'))})")
            logger.info(f"[update_inventory_for_chat]   new_quantity: {history_data.get('newQuantity')} (type: {type(history_data.get('newQuantity'))})")
            logger.info(f"[update_inventory_for_chat]   author_id: {member_db_id} (type: {type(member_db_id)})")
            # ----------------------------------------------------------

            # Создаем объект истории (ошибки здесь будут пойманы основным try...except)
            new_history_record = InventoryHistory(
                group_id=group.id, # Используем ID группы из БД
                category=category, # Используем полученную категорию
                item_name=item_name, # Используем полученное имя
                action=history_data.get('action'),
                type=final_item_type, # <-- Используем финально определенный тип
                old_quantity=history_data.get('oldQuantity'),
                new_quantity=history_data.get('newQuantity'),
                author_id=member_db_id # ID автора из таблицы Member (если найден)
            )
            db.add(new_history_record) # Добавляем в сессию
            logger.info(f"[update_inventory_for_chat] Prepared history record for item: {item_name} with type: {final_item_type}")
        else:
            logger.warning("[update_inventory_for_chat] History data not found in payload.")
        # --- КОНЕЦ ДОБАВЛЕНИЯ ИСТОРИИ ---

        # 4. Сохранить изменения (включая историю, если она была добавлена)
        await db.commit()
        
        # Обновляем объект group из БД, чтобы получить актуальные данные для ответа
        # (Это также обновит new_history_record, если он был создан и если есть relationship)
        await db.refresh(group)
        if new_history_record:
             try:
                 # Попытка обновить объект истории, если он был создан
                 await db.refresh(new_history_record)
             except Exception as refresh_exc:
                 # Ошибка при обновлении возможна, если коммит прошел, но объект не найден
                 logger.warning(f"[update_inventory_for_chat] Could not refresh history record after commit: {refresh_exc}")
        
        logger.info(f"[update_inventory_for_chat] Inventory updated successfully for chat_id: {chat_id}")

        # 5. Получаем админов для ответа
        admins_query = (
            select(Member)
            .join(GroupMember, GroupMember.member_id == Member.id)
            .where(
                GroupMember.group_id == group.id,
                GroupMember.role.in_(['admin', 'creator'])
            )
        )
        admins_result = await db.execute(admins_query)
        admins = admins_result.scalars().all()
        
        admins_list = [AdminInfo.model_validate(admin) for admin in admins]

        response_data = InventoryData(
            inventory=group.json_inventory or {},
            metadata={
                "lastUpdated": (group.json_metadata or {}).get("lastUpdated"),
                "progress": (group.json_metadata or {}).get("progress", 0),
                "chat_id": chat_id
            },
            chat_title=group.title,
            admins=admins_list
        )
        return response_data
        
    except Exception as e:
        await db.rollback()
        logger.exception(f"[update_inventory_for_chat] Error processing inventory for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not process inventory data")

# --- НОВЫЙ ЭНДПОИНТ ИСТОРИИ --- 
from models.inventory_history import InventoryHistory # <-- Возвращаем исходный импорт
from sqlalchemy import desc # <-- Импорт для сортировки
from typing import Dict, Any # <-- Импорт типов

# Роут для истории конкретного товара
@router.get(
    "/inventory/history/{chat_id}/{category}/{item_name}",
    response_model=List[Dict[str, Any]], # Возвращаем список словарей
    summary="Get Item History",
    description="Retrieves the history of changes for a specific item in a chat.",
    tags=["Inventory", "History"]
)
async def get_item_history(
    chat_id: str = Path(..., description="Telegram ID of the chat"),
    category: str = Path(..., description="Category name"),
    item_name: str = Path(..., description="Item name"),
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"[get_item_history] Request for history: chat={chat_id}, category={category}, item={item_name}")
    try:
        # Найти группу по chat_id (Telegram ID)
        # Преобразуем chat_id в int для поиска группы, обрабатываем возможную ошибку
        try:
            group_telegram_id = int(chat_id)
        except ValueError:
             logger.warning(f"[get_item_history] Invalid chat_id format: {chat_id}")
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")
             
        group = await get_group_by_telegram_id(db, group_telegram_id) 
        if not group:
            logger.warning(f"[get_item_history] Group not found for chat_id: {chat_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

        # Запрос к таблице истории с загрузкой автора
        history_query = (
            select(InventoryHistory)
            .options(selectinload(InventoryHistory.author_member)) # Загружаем связанного автора
            .where(
                InventoryHistory.group_id == group.id, # Используем ID группы из БД
                InventoryHistory.category == category,
                InventoryHistory.item_name == item_name
            )
            .order_by(desc(InventoryHistory.timestamp)) # Сортируем по убыванию времени
        )

        result = await db.execute(history_query)
        history_records = result.scalars().all()

        logger.info(f"[get_item_history] Found {len(history_records)} records for chat={chat_id}, category={category}, item={item_name}")

        # Преобразовать записи в словари
        response_data = []
        for record in history_records:
            author_data = None
            if record.author_member: # Если связь с автором (Member) загружена
                 # Используем AdminInfo или создаем словарь вручную
                 author_data = {
                     # "id": record.author_member.id, # Не обязательно для фронта?
                     "user_id": record.author_member.user_id,
                     "first_name": record.author_member.first_name,
                     "photo_url": str(record.author_member.photo_url) if record.author_member.photo_url else None
                 }

            response_data.append({
                "id": record.id,
                "group_id": record.group_id,
                "category": record.category,
                "item_name": record.item_name,
                "action": record.action,
                "type": record.type,
                "old_quantity": record.old_quantity,
                "new_quantity": record.new_quantity,
                "timestamp": record.timestamp.isoformat(), # Преобразовать datetime в строку ISO
                "author": author_data
            })

        return response_data

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.exception(f"[get_item_history] Error fetching history for chat={chat_id}, item={item_name}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch item history")

# --- КОНЕЦ ФАЙЛА groups.py ---


