from fastapi import APIRouter, Depends, Query, HTTPException, status, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
import os
import httpx

# Используем абсолютные импорты от корня /app
from db.session import get_db_session
from models.group import Group
from schemas.group import GroupRead # Схема для ответа
from models.group_member import GroupMember # <-- Добавляем импорт GroupMember
from models.member import Member # <-- Добавляем импорт Member

# Импорты, необходимые для настроек (проверь дубликаты)
from schemas.group_settings import GroupSettings, GroupSettingsUpdate
import logging

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
    # Старое поле json_metadata больше не трогаем для настроек
    # db_group.json_metadata = update_data # <-- УДАЛЕНО

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
