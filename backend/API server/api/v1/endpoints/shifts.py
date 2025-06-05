from fastapi import APIRouter, Depends, HTTPException, Query, status, Path as FastApiPath
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import text, Date as SQLDate, extract
import json
import logging
from typing import List, Optional, Dict, Set, Any, Tuple # <<< Добавляем Tuple
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime, timedelta, time, timezone 
from fastapi.responses import StreamingResponse
import openpyxl
from io import BytesIO
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
import os
import uuid
import httpx
from pathlib import Path
from fastapi import BackgroundTasks
import re # <<< Добавляем импорт для регулярных выражений

# Используем АБСОЛЮТНЫЕ импорты от /app
from db.session import get_db_session, AsyncSessionFactory
from models.shift import Shift
from schemas.shift import ShiftRead
from models.member import Member
from models.group import Group
from models.group_member import GroupMember
from models.reserve import Reserve
import schemas

# Инициализируем логгер
logger = logging.getLogger(__name__)

# Используем Path из pathlib
SHARED_FOLDER = Path("/app/shared/timesheets")
SHARED_FOLDER.mkdir(parents=True, exist_ok=True)

# <<< URL сервиса бота >>>
BOT_INTERNAL_URL = os.getenv("BOT_INTERNAL_URL", "http://bot:8003")

# <<< Новая вспомогательная функция для очистки имени файла >>>
def sanitize_filename(name: str) -> str:
    """Удаляет или заменяет недопустимые символы в имени файла."""
    # Удаляем символы, недопустимые в большинстве файловых систем
    name = re.sub(r'[<>:"/\|?*]', '_', name)
    # Заменяем множественные пробелы или подчеркивания на одно подчеркивание
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'_+', '_', name)
    # Убираем подчеркивания в начале/конце
    name = name.strip('_')
    # Ограничиваем длину, если нужно (например, 100 символов)
    return name[:100]

# <<< Новая схема для создания через Telegram ID >>>
class ShiftCreateTelegram(BaseModel):
    date: str # ISO string date only YYYY-MM-DD
    shift_type: str # 'day' or 'night'
    slot_index: int
    user_telegram_id: int # Telegram ID пользователя
    group_telegram_id: int # Telegram ID группы
    # is_drag_action: Optional[bool] = None # Если нужно передавать

# <<< Новая схема для НАЗНАЧЕНИЯ курьера старшим >>>
class ShiftAssignBySenior(BaseModel):
    assigner_telegram_id: int = Field(..., description="Telegram ID старшего курьера, выполняющего назначение")
    target_user_telegram_id: int = Field(..., description="Telegram ID курьера, которого назначают на смену")
    group_telegram_id: int = Field(..., description="Telegram ID группы, в которую происходит назначение")
    date: str = Field(..., description="Дата смены в формате YYYY-MM-DD")
    shift_type: str = Field(..., description="Тип смены ('day' или 'night')")
    slot_index: int = Field(..., description="Индекс слота (начиная с 0)")

router = APIRouter()

@router.get("", response_model=List[ShiftRead])
async def read_shifts(
    # Принимаем Telegram ID группы как параметр запроса
    group_telegram_id: int = Query(..., description="Telegram ID of the group to fetch shifts for"),
    db: AsyncSession = Depends(get_db_session)
):
    """Получает список всех смен для указанной группы (по Telegram ID)."""
    
    # 1. Найти внутренний ID группы по Telegram ID
    group_result = await db.execute(
        select(Group.id).where(Group.group_id == group_telegram_id)
    )
    group_internal_id = group_result.scalar_one_or_none()
    
    if group_internal_id is None:
        # Если группа не найдена по Telegram ID, возвращаем пустой список (или 404?)
        # Пока вернем пустой список, т.к. фронт может запрашивать для разных чатов
        logger.warning(f"[Shifts Endpoint] Group with Telegram ID {group_telegram_id} not found. Returning empty list.")
        return [] 
        # Либо: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group with Telegram ID {group_telegram_id} not found")

    # 2. Запрос для выбора смен по ВНУТРЕННЕМУ ID группы
    stmt = (
        select(Shift)
        .options(joinedload(Shift.member))
        .where(Shift.group_id == group_internal_id) # <<< Используем внутренний ID
        .order_by(Shift.date, Shift.shift_type, Shift.slot_index)
    )
    
    result = await db.execute(stmt)
    shifts = result.scalars().all()
    
    # <<< НАЧАЛО ИЗМЕНЕНИЙ: Добавляем статус старшего курьера >>>
    for shift in shifts:
        is_senior = False # По умолчанию False
        if shift.member:
            # Запрос статуса из group_members для этого member_id и group_internal_id
            gm_result = await db.execute(
                select(GroupMember.is_senior_courier)
                .where(
                    (GroupMember.member_id == shift.member.id) &
                    (GroupMember.group_id == group_internal_id)
                )
            )
            # Используем .scalar_one_or_none() и проверяем на None
            senior_status = gm_result.scalar_one_or_none()
            if senior_status is not None: # Если запись найдена
                 is_senior = senior_status

            # Добавляем полученный статус к объекту member, Pydantic его подхватит
            try:
                setattr(shift.member, 'is_senior_courier', is_senior)
            except AttributeError:
                 logger.warning(f"Could not set is_senior_courier on member {shift.member.id}")
                 # В этом случае схема возьмет свое дефолтное значение (None), что ок
                 pass # Просто пропускаем, если не удалось установить атрибут

    # <<< КОНЕЦ ИЗМЕНЕНИЙ >>>

    # Возвращаем исходный список shifts, т.к. мы модифицировали shift.member на месте
    return shifts

@router.post("", response_model=ShiftRead, status_code=status.HTTP_201_CREATED)
async def create_shift(
    shift_in: ShiftCreateTelegram,
    db: AsyncSession = Depends(get_db_session)
):
    """Создает новую запись о смене по Telegram ID пользователя и группы.
    Если запрошенный слот занят, пытается найти другой свободный слот того же типа.
    """
    logger.info(f"[Create Shift] Received request: {shift_in}")

    # --- Шаг 1: Найти пользователя и группу (ВНЕ ТРАНЗАКЦИИ) ---
    member_result = await db.execute(
        select(Member).where(Member.user_id == shift_in.user_telegram_id)
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        logger.error(f"[Create Shift] Member with Telegram ID {shift_in.user_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Member with Telegram ID {shift_in.user_telegram_id} not found")

    group_result = await db.execute(
        select(Group).where(Group.group_id == shift_in.group_telegram_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        logger.error(f"[Create Shift] Group with Telegram ID {shift_in.group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group with Telegram ID {shift_in.group_telegram_id} not found")

    # --- Шаг 2: Преобразовать дату (ВНЕ ТРАНЗАКЦИИ) ---
    try:
        date_obj = datetime.strptime(shift_in.date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid date format. Use YYYY-MM-DD.")

    # --- Логирование перед удалением резерва ---
    logger.info(f"[DEBUG][Create Shift] Попытка удалить резерв: member_id={member.id}, group_id={group.id}, date={date_obj} (type: {type(date_obj)})")
    all_reserves = await db.execute(
        select(Reserve).where(Reserve.group_id == group.id, Reserve.date == date_obj)
    )
    for r in all_reserves.scalars().all():
        logger.info(f"[DEBUG][Create Shift] Существующий резерв: id={r.id}, member_id={r.member_id}, date={r.date} (type: {type(r.date)})")

    # --- Шаг 3.1: Логика удаления старых смен при allowMultipleShifts=False ---
    allow_multiple = group.access_settings.get('allowMultipleShifts', True)
    if not allow_multiple:
        stmt_find_existing = (
            select(Shift)
            .where(
                Shift.member_id == member.id,
                Shift.group_id == group.id,
                Shift.date == date_obj
            )
        )
        existing_shifts_result = await db.execute(stmt_find_existing)
        existing_shifts = existing_shifts_result.scalars().all()

        if existing_shifts:
            for existing_shift in existing_shifts:
                await db.delete(existing_shift)

    # --- Удаление резерва ---
    stmt_find_existing_reserves = (
        select(Reserve)
        .where(
            Reserve.member_id == member.id,
            Reserve.group_id == group.id,
            Reserve.date == date_obj
        )
    )
    existing_reserves_result = await db.execute(stmt_find_existing_reserves)
    existing_reserves = existing_reserves_result.scalars().all()

    if existing_reserves:
        logger.info(f"[Create Shift] Found {len(existing_reserves)} existing reserve(s) for member {member.id} on {date_obj}. Deleting them...")
        for existing_reserve in existing_reserves:
            await db.delete(existing_reserve)
    else:
        logger.info(f"[Create Shift] No existing reserves found for member {member.id} on {date_obj}.")

    # --- Шаг 3.2: Проверка доступности слота и поиск свободного ---
    target_slot_index: Optional[int] = None

    # Сначала проверяем запрошенный слот
    requested_slot_stmt = (
        select(Shift.id)
        .where(
            Shift.group_id == group.id,
            Shift.date == date_obj,
            Shift.shift_type == shift_in.shift_type,
            Shift.slot_index == shift_in.slot_index
        )
        .limit(1) # Достаточно одной записи для проверки
    )
    requested_slot_result = await db.execute(requested_slot_stmt)
    is_requested_slot_occupied = requested_slot_result.scalar_one_or_none() is not None

    if not is_requested_slot_occupied:
        target_slot_index = shift_in.slot_index
        logger.info(f"[Create Shift] Requested slot {shift_in.shift_type} index {shift_in.slot_index} is free.")
    else:
        logger.warning(f"[Create Shift] Requested slot {shift_in.shift_type} index {shift_in.slot_index} is occupied. Searching for alternatives...")

        # Определяем лимиты слотов для данного типа смены
        # TODO: Перенести default_single_day_slot_config или определить значения здесь
        DEFAULT_MAX_DAY_SLOTS = 4
        DEFAULT_MAX_NIGHT_SLOTS = 2
        slot_config = group.slot_config or {}
        if shift_in.shift_type == 'day':
            max_slots = slot_config.get('maxDaySlots', DEFAULT_MAX_DAY_SLOTS)
        elif shift_in.shift_type == 'night':
            max_slots = slot_config.get('maxNightSlots', DEFAULT_MAX_NIGHT_SLOTS)
        else:
            logger.error(f"[Create Shift] Unknown shift_type: {shift_in.shift_type}")
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid shift type provided.")
            
        if max_slots <= 0:
             logger.warning(f"[Create Shift] No slots configured for {shift_in.shift_type} shifts in group {group.id}.")
             raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Для {shift_in.shift_type} смен не настроены слоты в этой группе.")

        # Ищем все занятые слоты этого типа на эту дату
        occupied_slots_stmt = (
            select(Shift.slot_index)
            .where(
                Shift.group_id == group.id,
                Shift.date == date_obj,
                Shift.shift_type == shift_in.shift_type
            )
        )
        occupied_slots_result = await db.execute(occupied_slots_stmt)
        occupied_indices = {row.slot_index for row in occupied_slots_result.all()}
        logger.info(f"[Create Shift] Occupied {shift_in.shift_type} slots on {date_obj}: {occupied_indices}. Max allowed: {max_slots}")

        # Ищем первый свободный слот
        for potential_index in range(max_slots):
            if potential_index not in occupied_indices:
                target_slot_index = potential_index
                logger.info(f"[Create Shift] Found free alternative slot: index {target_slot_index} (originally requested {shift_in.slot_index}).")
                break # Нашли свободный, выходим из цикла

        # Если после цикла не нашли свободный слот
        if target_slot_index is None:
            logger.warning(f"[Create Shift] No free {shift_in.shift_type} slots found on {date_obj} for group {group.id}.")
            shift_type_rus = "дневные" if shift_in.shift_type == 'day' else "ночные"
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Все {shift_type_rus} слоты на {date_obj.strftime('%d.%m.%Y')} уже заняты.")

    # --- Шаг 3.3: Создать НОВУЮ смену с найденным/подтвержденным слотом ---
    if target_slot_index is None: # Дополнительная проверка на всякий случай
            logger.error("[Create Shift] CRITICAL: target_slot_index is None after checks!")
            raise HTTPException(status_code=500, detail="Internal server error during slot assignment.")

    db_shift = Shift(
        member_id=member.id,
        group_id=group.id,
        date=date_obj,
        shift_type=shift_in.shift_type,
        slot_index=target_slot_index # <<< Используем target_slot_index
    )
    db.add(db_shift)

    # Flush, чтобы получить ID и данные для ответа/уведомления ДО коммита
    await db.flush()
    await db.refresh(db_shift, attribute_names=['id', 'created_at', 'updated_at', 'member']) # Обновляем с member

    logger.info(f"[Create Shift] Shift object created for member {member.id}, slot {db_shift.shift_type} index {db_shift.slot_index}. Ready for commit by session manager.")

    # --- Шаг 3.4: Подготовка данных для ответа и NOTIFY ---
    created_shift_with_member: Shift | None = db_shift # Переименуем для ясности

    if created_shift_with_member and created_shift_with_member.member:
        # Добавляем статус старшего курьера ПЕРЕД ВОЗВРАТОМ/УВЕДОМЛЕНИЕМ
        is_senior = False
        gm_result = await db.execute(
            select(GroupMember.is_senior_courier)
            .where(
                (GroupMember.member_id == created_shift_with_member.member.id) &
                (GroupMember.group_id == created_shift_with_member.group_id)
            )
        )
        senior_status = gm_result.scalar_one_or_none()
        if senior_status is not None:
            is_senior = senior_status
        try:
            setattr(created_shift_with_member.member, 'is_senior_courier', is_senior)
        except AttributeError:
            logger.warning(f"[Create Shift] Could not set is_senior_courier on response member {created_shift_with_member.member.id}")

        # Конвертируем в Pydantic схему
        try:
            pydantic_shift = ShiftRead.model_validate(created_shift_with_member, from_attributes=True)
            shift_data_dict = pydantic_shift.model_dump(exclude_none=True, mode='json')
        except Exception as pydantic_error:
             logger.error(f"[Create Shift] Error converting SQLAlchemy Shift to Pydantic ShiftRead: {pydantic_error}", exc_info=True)
             shift_data_dict = None

        # Отправляем NOTIFY, если данные готовы
        if shift_data_dict:
            notify_payload_dict = {
                "type": "shifts_updated",
                "chat_id": str(shift_in.group_telegram_id),
                "source": "shift_creation",
                "shift_data": shift_data_dict # Содержит актуальный slot_index
            }
            notify_payload_json = json.dumps(notify_payload_dict)

            if len(notify_payload_json.encode('utf-8')) < 7900:
                escaped_payload = notify_payload_json.replace("'", "''")
                sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                await db.execute(sql_command)
                logger.info(f"[Create Shift] Sent NOTIFY with FULL data for shift_id {db_shift.id} (slot {db_shift.slot_index}) in chat_id {shift_in.group_telegram_id}")
            else:
                logger.warning(f"[Create Shift] NOTIFY payload for shift_id {db_shift.id} is too large. Skipping NOTIFY.")
        else:
            logger.error(f"[Create Shift] Could not prepare shift_data_dict for NOTIFY (Shift ID: {db_shift.id})")
    else:
        logger.error(f"[Create Shift] Could not get created shift details with member after flush (Shift ID: {db_shift.id}). Cannot send NOTIFY.")

    # Коммит/rollback ожидается от управляющего контекста сессии

    # --- Шаг 4: Возвращаем результат ---
    # Мы уже сделали refresh, объект db_shift актуален
    logger.info(f"[Create Shift] Returning shift object for ID {db_shift.id}. Commit/rollback handled by session manager.")
    # Возвращаем объект SQLAlchemy, FastAPI/Pydantic позаботится о сериализации
    return db_shift

# ===> ДОБАВЛЯЕМ ЭНДПОИНТ ДЛЯ УДАЛЕНИЯ СМЕНЫ <===
@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(
    shift_id: UUID,
    # <<< ИЗМЕНЕНО: Получаем ID запрашивающего из Query параметра >>>
    requester_telegram_id: int = Query(..., description="Telegram ID of the user attempting the deletion (Sent by Frontend)"), 
    db: AsyncSession = Depends(get_db_session)
    # Убираем зависимость Depends(get_current_user_telegram_id)
):
    """Удаляет смену по её UUID.
    Проверяет, является ли пользователь с requester_telegram_id (ПРИСЛАННЫМ ФРОНТОМ) старшим курьером.
    !!! ВНИМАНИЕ: НЕБЕЗОПАСНО, если requester_telegram_id не верифицирован сервером! !!!
    """

    logger.info(f"[Delete Shift] Seniority Check: User ID {requester_telegram_id} (sent by frontend) attempting to delete shift ID: {shift_id}")

    # Находим смену и связанную группу
    stmt = (
        select(Shift)
        .options(joinedload(Shift.group)) 
        .where(Shift.id == shift_id)
    )
    result = await db.execute(stmt)
    db_shift: Shift | None = result.scalar_one_or_none()

    if db_shift is None or db_shift.group is None:
        logger.warning(f"[Delete Shift] Shift with ID {shift_id} or its group not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift with ID {shift_id} not found or group data missing"
        )
        
    # <<< ПРОВЕРКА ПРАВ СТАРШЕГО КУРЬЕРА (ИСПОЛЬЗУЯ ID ИЗ ЗАПРОСА) >>>

    # Находим пользователя по ID, присланному фронтом
    requester_member_result = await db.execute(
        select(Member).where(Member.user_id == requester_telegram_id)
    )
    requester_member: Member | None = requester_member_result.scalar_one_or_none()

    if requester_member is None:
        logger.warning(f"[Delete Shift] Requester member with Telegram ID {requester_telegram_id} (sent by frontend) not found in DB.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, # Меняем на 403, т.к. это проблема данных от клиента
            detail="Provided requester ID not found."
        ) 

    # Находим запись GroupMember для этого пользователя в группе этой смены
    requester_gm_result = await db.execute(
        select(GroupMember).where(
            (GroupMember.member_id == requester_member.id) &
            (GroupMember.group_id == db_shift.group_id)
        )
    )
    requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()

    # Проверяем, является ли пользователь с ID из запроса старшим курьером
    if not requester_gm or not requester_gm.is_senior_courier:
        logger.warning(f"[Delete Shift] User {requester_telegram_id} (sent by frontend) is NOT a senior courier in group {db_shift.group.group_id}. Access denied for deleting shift {shift_id}.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The provided user ID does not belong to a senior courier in this group."
        )
    
    logger.info(f"[Delete Shift] User {requester_telegram_id} (sent by frontend) IS a senior courier in group {db_shift.group.group_id}. Proceeding with deletion.")
    
    # <<< КОНЕЦ ПРОВЕРКИ ПРАВ >>>

    try:
        # Получаем group_telegram_id для NOTIFY (группа уже должна быть загружена)
        group_telegram_id_to_notify = db_shift.group.group_id if db_shift.group else None

        # Удаляем смену
        await db.delete(db_shift)
        await db.commit()
        logger.info(f"[Delete Shift] Shift with ID {shift_id} successfully deleted.")

        # --- Отправка NOTIFY после успешного удаления --- >
        if group_telegram_id_to_notify:
            try:
                notify_payload_dict = {
                    "type": "shifts_updated", 
                    "chat_id": str(group_telegram_id_to_notify),
                    "source": "shift_deletion",
                    "shift_id": str(shift_id) 
                }
                notify_payload_json = json.dumps(notify_payload_dict)
                
                if len(notify_payload_json.encode('utf-8')) < 7900:
                    escaped_payload = notify_payload_json.replace("'", "''")
                    sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                    await db.execute(sql_command)
                    logger.info(f"[Delete Shift] Sent NOTIFY for deleted shift_id {shift_id} in chat_id {group_telegram_id_to_notify}")
                else:
                    logger.warning(f"[Delete Shift] NOTIFY payload for deleted shift_id {shift_id} is too large. Skipping.")
                    
            except Exception as notify_err:
                logger.error(f"[Delete Shift] Failed to send NOTIFY for chat_id {group_telegram_id_to_notify}: {notify_err}", exc_info=True)
        else:
             logger.warning(f"[Delete Shift] Could not determine group_telegram_id for NOTIFY (Shift ID: {shift_id})")
        # --- Конец блока NOTIFY ---
        
        return # FastAPI автоматически вернет 204 No Content
        
    except Exception as e:
        await db.rollback()
        logger.error(f"[Delete Shift] Error during shift deletion or commit for ID {shift_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the shift."
        ) 

# Заглушка, если зависимости нет:
async def get_current_user_telegram_id() -> int:
    # ЗАМЕНИТЬ НА РЕАЛЬНУЮ ЛОГИКУ АУТЕНТИФИКАЦИИ!
    # Это ВРЕМЕННАЯ заглушка, возвращающая ID 12345.
    # В реальности здесь должна быть проверка токена и извлечение ID.
    logger.warning("Using STUB get_current_user_telegram_id! Replace with actual authentication.")
    return 12345 # Пример ID, ЗАМЕНИТЬ! 

# ===> НОВЫЙ ЭНДПОИНТ ДЛЯ ПЕРЕМЕЩЕНИЯ В РЕЗЕРВ <===
@router.post("/{shift_id}/move_to_reserve", response_model=schemas.ReserveRead, status_code=status.HTTP_200_OK)
async def move_shift_to_reserve(
    shift_id: UUID,
    requester_telegram_id: int = Query(..., description="Telegram ID of the user attempting the action (Sent by Frontend)"),
    db: AsyncSession = Depends(get_db_session)
):
    """Перемещает курьера из смены в резерв.
    
    1. Проверяет, является ли requester_telegram_id старшим курьером.
    2. Находит данные смены и курьера.
    3. Удаляет смену.
    4. Добавляет запись в резерв на ту же дату.
    5. Возвращает созданную запись резерва.
    """
    logger.info(f"[Move to Reserve] Attempting to move shift {shift_id} to reserve by user {requester_telegram_id}")

    async with db.begin(): # Используем транзакцию
        # 1. Находим смену, связанного курьера (member) и группу
        stmt_shift = (
            select(Shift)
            .options(
                joinedload(Shift.member),
                joinedload(Shift.group)
            )
            .where(Shift.id == shift_id)
        )
        result_shift = await db.execute(stmt_shift)
        db_shift: Shift | None = result_shift.scalar_one_or_none()

        if not db_shift or not db_shift.member or not db_shift.group:
            logger.warning(f"[Move to Reserve] Shift {shift_id} or related member/group not found.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shift {shift_id} or related member/group data missing"
            )
            
        target_member = db_shift.member
        target_group = db_shift.group
        reserve_date_obj = db_shift.date # Получаем дату из смены - ОЖИДАЕМ date
        
        # <<< НАЧАЛО: Логирование и проверка типа даты из смены >>>
        logger.info(f"[Move to Reserve] Date retrieved from shift: {reserve_date_obj}, TYPE: {type(reserve_date_obj)}")
        if not isinstance(reserve_date_obj, date):
            logger.error(f"[Move to Reserve] CRITICAL: Expected date object from db_shift.date, but got {type(reserve_date_obj)}. Shift ID: {shift_id}")
            raise HTTPException(status_code=500, detail="Internal Server Error: Incorrect date type retrieved from shift data.")
        # <<< КОНЕЦ: Логирование и проверка типа >>>

        logger.info(f"[Move to Reserve] Checking existing reserve for date string: '{reserve_date_obj}' (Original type: {type(reserve_date_obj)}) Target member: {target_member.id}, group: {target_group.id}")

        # 2. Проверяем права requester_telegram_id (аналогично delete_shift)
        requester_member_result = await db.execute(
            select(Member).where(Member.user_id == requester_telegram_id)
        )
        requester_member: Member | None = requester_member_result.scalar_one_or_none()

        if requester_member is None:
            logger.warning(f"[Move to Reserve] Requester member {requester_telegram_id} not found.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provided requester ID not found.")

        requester_gm_result = await db.execute(
            select(GroupMember).where(
                (GroupMember.member_id == requester_member.id) &
                (GroupMember.group_id == target_group.id)
            )
        )
        requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()

        if not requester_gm or not requester_gm.is_senior_courier:
            logger.warning(f"[Move to Reserve] User {requester_telegram_id} is NOT senior in group {target_group.group_id}. Access denied.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action requires senior courier permissions."
            )
            
        logger.info(f"[Move to Reserve] User {requester_telegram_id} IS senior in group {target_group.group_id}. Permissions granted.")

        # 3. Проверяем, нет ли уже резерва у целевого курьера на эту дату
        #    Возвращаем ORM запрос БЕЗ cast()
        existing_reserve_stmt = (
             select(Reserve.id)
             .where(
                 (Reserve.member_id == target_member.id) &
                 (Reserve.group_id == target_group.id) &
                 (Reserve.date == reserve_date_obj) # <<< ПРЯМОЕ СРАВНЕНИЕ date == date
             )
        )
        # Убираем выполнение через text()
        # sql_check_reserve = text(...)
        # existing_reserve_result = await db.execute(sql_check_reserve, {...})
        existing_reserve_result = await db.execute(existing_reserve_stmt)
        existing_reserve_id = existing_reserve_result.scalar_one_or_none()

        if existing_reserve_id:
            # Используем reserve_date_obj (который date) для лога
            logger.warning(f"[Move to Reserve] Target user {target_member.user_id} is already in reserve on {reserve_date_obj} in group {target_group.group_id}. Cannot move.")
            # Возвращаем 409 Conflict...
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Courier {target_member.first_name or target_member.user_id} is already in reserve on this date."
            )

        # 4. Удаляем смену
        await db.delete(db_shift)
        logger.info(f"[Move to Reserve] Deleted shift {shift_id}")

        # 5. Создаем резерв
        #    Передаем объект date reserve_date_obj
        new_reserve = Reserve(
            member_id=target_member.id,
            group_id=target_group.id,
            date=reserve_date_obj # <<< Передаем объект date
        )
        db.add(new_reserve)
        logger.info(f"[Move to Reserve] Added reserve entry for member {target_member.id} on {reserve_date_obj}")
        
        # Обновляем объект ...
        await db.flush()

    # Транзакция завершится (commit или rollback)
    
    # --- Отправка NOTIFY после успешной транзакции --- >
    try:
        # Данные уже загружены в new_reserve
        reserve_read_schema = schemas.ReserveRead.model_validate(new_reserve)
        reserve_data_dict = reserve_read_schema.model_dump(mode='json')
        
        # Отправляем два уведомления: удаление смены и добавление резерва
        
        # 1. Уведомление об удалении смены
        delete_notify_payload = json.dumps({
            "type": "shifts_updated", 
            "chat_id": str(target_group.group_id),
            "source": "shift_deletion", # Источник - удаление (через перемещение)
            "shift_id": str(shift_id) 
        })
        sql_delete_notify = text(f"NOTIFY websocket_channel, '{delete_notify_payload}'")
        await db.execute(sql_delete_notify)
        logger.info(f"[Move to Reserve] Sent NOTIFY for deleted shift {shift_id} in chat {target_group.group_id}")

        # 2. Уведомление о добавлении резерва
        add_notify_payload = json.dumps({
            "type": "reserve_added",
            "chat_id": str(target_group.group_id),
            "data": reserve_data_dict 
        })
        sql_add_notify = text(f"NOTIFY websocket_channel, '{add_notify_payload}'")
        await db.execute(sql_add_notify)
        logger.info(f"[Move to Reserve] Sent NOTIFY for added reserve {new_reserve.id} in chat {target_group.group_id}")

    except Exception as notify_err:
        logger.error(f"[Move to Reserve] Failed to send NOTIFY for chat_id {target_group.group_id}: {notify_err}", exc_info=True)
    # --- Конец блока NOTIFY ---

    logger.info(f"[Move to Reserve] Successfully moved shift {shift_id} to reserve for member {target_member.user_id}")
    return new_reserve # Возвращаем созданный объект резерва 

# ===> НОВЫЙ ЭНДПОИНТ ДЛЯ ИЗМЕНЕНИЯ ТИПА/СЛОТА СМЕНЫ СТАРШИМ <===
class ShiftUpdateSlotPayload(BaseModel):
    target_shift_type: str # 'day' или 'night'
    target_slot_index: int

@router.patch("/{shift_id}/move", response_model=ShiftRead, status_code=status.HTTP_200_OK)
async def update_shift_slot(
    shift_id: UUID,
    payload: ShiftUpdateSlotPayload,
    requester_telegram_id: int = Query(..., description="Telegram ID of the user attempting the action"),
    db: AsyncSession = Depends(get_db_session)
):
    """Обновляет тип и/или слот существующей смены. Требует прав старшего курьера."""
    logger.info(f"[Update Shift Slot] Attempt by user {requester_telegram_id} to move shift {shift_id} to type={payload.target_shift_type}, slot={payload.target_slot_index}")

    async with db.begin(): # Используем транзакцию
        # 1. Находим смену для обновления и связанные данные
        stmt_shift = (
            select(Shift)
            .options(
                joinedload(Shift.member),
                joinedload(Shift.group)
            )
            .where(Shift.id == shift_id)
        )
        result_shift = await db.execute(stmt_shift)
        db_shift: Shift | None = result_shift.scalar_one_or_none()

        if not db_shift or not db_shift.member or not db_shift.group:
            logger.warning(f"[Update Shift Slot] Shift {shift_id} or related member/group not found.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shift {shift_id} or related member/group data missing"
            )

        target_member = db_shift.member
        target_group = db_shift.group
        shift_date = db_shift.date # Дата смены не меняется

        logger.info(f"[Update Shift Slot] Found shift {shift_id} belonging to user {target_member.user_id} in group {target_group.group_id} on date {shift_date}")

        # 2. Проверяем права requester_telegram_id (должен быть старшим)
        requester_member_result = await db.execute(
            select(Member).where(Member.user_id == requester_telegram_id)
        )
        requester_member: Member | None = requester_member_result.scalar_one_or_none()

        if requester_member is None:
            logger.warning(f"[Update Shift Slot] Requester member {requester_telegram_id} not found.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provided requester ID not found.")

        requester_gm_result = await db.execute(
            select(GroupMember).where(
                (GroupMember.member_id == requester_member.id) &
                (GroupMember.group_id == target_group.id)
            )
        )
        requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()

        if not requester_gm or not requester_gm.is_senior_courier:
            logger.warning(f"[Update Shift Slot] User {requester_telegram_id} is NOT senior in group {target_group.group_id}. Access denied to move shift {shift_id}.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action requires senior courier permissions."
            )
            
        logger.info(f"[Update Shift Slot] User {requester_telegram_id} IS senior in group {target_group.group_id}. Permissions granted.")
        
        # 3. Проверяем, свободен ли целевой слот
        # (на ту же дату, с новым типом/слотом, но не та же самая смена!)
        target_slot_occupied_stmt = (
            select(Shift.id)
            .where(
                (Shift.group_id == target_group.id) &
                (Shift.date == shift_date) &
                (Shift.shift_type == payload.target_shift_type) &
                (Shift.slot_index == payload.target_slot_index) &
                (Shift.id != shift_id) # Убедимся, что это не та же самая смена
            )
        )
        target_slot_occupied_result = await db.execute(target_slot_occupied_stmt)
        occupied_shift_id = target_slot_occupied_result.scalar_one_or_none()

        if occupied_shift_id:
            logger.warning(f"[Update Shift Slot] Target slot (type={payload.target_shift_type}, index={payload.target_slot_index}) on {shift_date} is already occupied by shift {occupied_shift_id}. Cannot move shift {shift_id}.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Target slot {payload.target_shift_type} {payload.target_slot_index + 1} is already occupied."
            )
            
        # 4. Обновляем смену
        db_shift.shift_type = payload.target_shift_type
        db_shift.slot_index = payload.target_slot_index
        db_shift.updated_at = datetime.utcnow() # Обновляем время изменения
        
        logger.info(f"[Update Shift Slot] Updated shift {shift_id} to type={db_shift.shift_type}, slot={db_shift.slot_index}")
        
        # Неявно db.add(db_shift) не нужно, так как объект уже отслеживается сессией
        await db.flush() # Применяем изменения в сессии для получения обновленных данных
        await db.refresh(db_shift, attribute_names=['shift_type', 'slot_index', 'updated_at', 'member', 'group']) # Обновляем объект с нужными связями

    # Транзакция завершится (commit или rollback)

    # --- Отправка NOTIFY после успешной транзакции --- >
    try:
        # <<< ДОБАВЛЯЕМ СТАТУС СТАРШЕГО ПЕРЕД ОТПРАВКОЙ >>>
        # (Код аналогичен тому, что в create_shift и read_shifts)
        updated_member = db_shift.member
        if updated_member:
             is_senior = False 
             gm_result = await db.execute(
                 select(GroupMember.is_senior_courier)
                 .where(
                     (GroupMember.member_id == updated_member.id) &
                     (GroupMember.group_id == db_shift.group_id)
                 )
             )
             senior_status = gm_result.scalar_one_or_none()
             if senior_status is not None:
                 is_senior = senior_status
             try:
                 setattr(updated_member, 'is_senior_courier', is_senior)
             except AttributeError: pass # Игнорируем если не получилось
        
        # Преобразуем в Pydantic и отправляем
        pydantic_shift = ShiftRead.model_validate(db_shift, from_attributes=True)
        shift_data_dict = pydantic_shift.model_dump(exclude_none=True, mode='json')
        
        notify_payload_dict = {
            "type": "shifts_updated",
            "chat_id": str(target_group.group_id),
            "source": "shift_slot_update", # Новый источник
            "shift_data": shift_data_dict # Передаем полные обновленные данные
        }
        notify_payload_json = json.dumps(notify_payload_dict)

        if len(notify_payload_json.encode('utf-8')) < 7900:
            escaped_payload = notify_payload_json.replace("'", "''")
            sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
            await db.execute(sql_command)
            logger.info(f"[Update Shift Slot] Sent NOTIFY with updated data for shift_id {shift_id} in chat_id {target_group.group_id}")
        else:
            logger.warning(f"[Update Shift Slot] NOTIFY payload for shift_id {shift_id} is too large. Skipping NOTIFY.")

    except Exception as notify_err:
        logger.error(f"[Update Shift Slot] Failed to send NOTIFY for chat_id {target_group.group_id}: {notify_err}", exc_info=True)
    # --- Конец блока NOTIFY ---

    logger.info(f"[Update Shift Slot] Successfully updated shift {shift_id}")
    return db_shift # Возвращаем обновленный объект Shift (Pydantic сам преобразует в ShiftRead) 

# ===> НОВЫЙ ЭНДПОИНТ ДЛЯ НАЗНАЧЕНИЯ СМЕНЫ СТАРШИМ <===
@router.post("/assign", response_model=ShiftRead, status_code=status.HTTP_201_CREATED)
async def assign_shift_by_senior(
    assignment_data: ShiftAssignBySenior,
    db: AsyncSession = Depends(get_db_session)
):
    """Назначает указанного курьера на смену старшим курьером."""
    logger.info(f"[Assign Shift] Attempt by assigner {assignment_data.assigner_telegram_id} "
                f"to assign target {assignment_data.target_user_telegram_id} "
                f"to group {assignment_data.group_telegram_id} on {assignment_data.date} "
                f"slot {assignment_data.shift_type}-{assignment_data.slot_index}")

    async with db.begin(): # Используем транзакцию
        # 1. Найти группу и ее настройки
        group_result = await db.execute(
            select(Group).where(Group.group_id == assignment_data.group_telegram_id)
        )
        group: Group | None = group_result.scalar_one_or_none()
        if group is None:
            logger.error(f"[Assign Shift] Group {assignment_data.group_telegram_id} not found.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {assignment_data.group_telegram_id} not found")

        # 2. Проверить права назначающего (assigner)
        assigner_member_result = await db.execute(
            select(Member).where(Member.user_id == assignment_data.assigner_telegram_id)
        )
        assigner_member: Member | None = assigner_member_result.scalar_one_or_none()
        if assigner_member is None:
            logger.warning(f"[Assign Shift] Assigner member {assignment_data.assigner_telegram_id} not found.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assigner user ID not found.")

        assigner_gm_result = await db.execute(
            select(GroupMember.is_senior_courier).where(
                (GroupMember.member_id == assigner_member.id) &
                (GroupMember.group_id == group.id)
            )
        )
        is_assigner_senior = assigner_gm_result.scalar_one_or_none()
        if not is_assigner_senior:
            logger.warning(f"[Assign Shift] User {assignment_data.assigner_telegram_id} is NOT senior in group {group.group_id}. Assignment denied.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action requires senior courier permissions.")
        logger.info(f"[Assign Shift] Assigner {assignment_data.assigner_telegram_id} IS senior. Permissions granted.")

        # 3. Найти назначаемого пользователя (target)
        target_member_result = await db.execute(
            select(Member).where(Member.user_id == assignment_data.target_user_telegram_id)
        )
        target_member: Member | None = target_member_result.scalar_one_or_none()
        if target_member is None:
            logger.error(f"[Assign Shift] Target member {assignment_data.target_user_telegram_id} not found.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Target courier with ID {assignment_data.target_user_telegram_id} not found")

        # 4. Преобразовать дату
        try:
            date_obj = datetime.strptime(assignment_data.date, '%Y-%m-%d').date()
        except ValueError:
            logger.error(f"[Assign Shift] Invalid date format: {assignment_data.date}")
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid date format. Use YYYY-MM-DD.")

        # 5. Проверить, свободен ли целевой слот
        target_slot_occupied_stmt = (
            select(Shift.id)
            .where(
                (Shift.group_id == group.id) &
                (Shift.date == date_obj) &
                (Shift.shift_type == assignment_data.shift_type) &
                (Shift.slot_index == assignment_data.slot_index)
            )
        )
        target_slot_occupied_result = await db.execute(target_slot_occupied_stmt)
        occupied_shift_id = target_slot_occupied_result.scalar_one_or_none()
        if occupied_shift_id:
            logger.warning(f"[Assign Shift] Target slot {assignment_data.shift_type}-{assignment_data.slot_index} on {date_obj} is already occupied by shift {occupied_shift_id}.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Target slot {assignment_data.shift_type} {assignment_data.slot_index + 1} is already occupied."
            )

        # 6. Обработать существующие смены НАЗНАЧАЕМОГО курьера (если allowMultipleShifts=false)
        allow_multiple = group.access_settings.get('allowMultipleShifts', True)
        if not allow_multiple:
            logger.info(f"[Assign Shift] allowMultipleShifts is False. Checking existing shifts for target member {target_member.id} on {date_obj}...")
            stmt_find_target_existing = (
                select(Shift)
                .where(
                    Shift.member_id == target_member.id, # <<< Проверяем для target_member.id
                    Shift.group_id == group.id,
                    Shift.date == date_obj
                )
            )
            target_existing_shifts_result = await db.execute(stmt_find_target_existing)
            target_existing_shifts = target_existing_shifts_result.scalars().all()
            if target_existing_shifts:
                logger.info(f"[Assign Shift] Found {len(target_existing_shifts)} existing shift(s) for target member {target_member.id}. Deleting them...")
                for existing_shift in target_existing_shifts:
                    logger.debug(f"[Assign Shift] Deleting existing shift ID: {existing_shift.id} for target user.")
                    await db.delete(existing_shift)
            else:
                logger.info(f"[Assign Shift] No existing shifts found for target member {target_member.id} on {date_obj}.")

        # --- Удаляем резервы для этого пользователя на эту дату и группу ---
        stmt_find_existing_reserves = (
            select(Reserve)
            .where(
                Reserve.member_id == target_member.id,
                Reserve.group_id == group.id,
                Reserve.date == date_obj
            )
        )
        existing_reserves_result = await db.execute(stmt_find_existing_reserves)
        existing_reserves = existing_reserves_result.scalars().all()

        if existing_reserves:
            logger.info(f"[Assign Shift] Found {len(existing_reserves)} existing reserve(s) for member {target_member.id} on {date_obj}. Deleting them...")
            for existing_reserve in existing_reserves:
                await db.delete(existing_reserve)
        else:
            logger.info(f"[Assign Shift] No existing reserves found for member {target_member.id} on {date_obj}.")

        # 7. Создать новую смену для НАЗНАЧАЕМОГО курьера
        db_shift = Shift(
            member_id=target_member.id, # <<< Используем ID назначаемого
            group_id=group.id,
            date=date_obj,
            shift_type=assignment_data.shift_type,
            slot_index=assignment_data.slot_index
            # created_by можно добавить, если есть поле, указав assigner_member.id
        )
        db.add(db_shift)
        await db.flush() # Flush для получения ID новой смены
        await db.refresh(db_shift, attribute_names=['id', 'created_at', 'updated_at', 'member']) # Обновляем с нужными связями

    # Транзакция завершится (commit или rollback)

    # --- Отправка NOTIFY после успешной транзакции --- >
    try:
        # Добавляем статус старшего ПЕРЕД отправкой (для назначаемого курьера)
        if db_shift.member:
             is_target_senior = False 
             gm_target_result = await db.execute(
                 select(GroupMember.is_senior_courier)
                 .where(
                     (GroupMember.member_id == db_shift.member.id) &
                     (GroupMember.group_id == group.id)
                 )
             )
             target_senior_status = gm_target_result.scalar_one_or_none()
             if target_senior_status is not None:
                 is_target_senior = target_senior_status
             try:
                 setattr(db_shift.member, 'is_senior_courier', is_target_senior)
             except AttributeError: pass

        pydantic_shift = ShiftRead.model_validate(db_shift, from_attributes=True)
        shift_data_dict = pydantic_shift.model_dump(exclude_none=True, mode='json')

        notify_payload_dict = {
            "type": "shifts_updated",
            "chat_id": str(assignment_data.group_telegram_id),
            "source": "shift_assignment", # Новый источник
            "shift_data": shift_data_dict
        }
        notify_payload_json = json.dumps(notify_payload_dict)

        if len(notify_payload_json.encode('utf-8')) < 7900:
            escaped_payload = notify_payload_json.replace("'", "''")
            sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
            await db.execute(sql_command)
            logger.info(f"[Assign Shift] Sent NOTIFY for assigned shift_id {db_shift.id} in chat_id {assignment_data.group_telegram_id}")
        else:
            logger.warning(f"[Assign Shift] NOTIFY payload for assigned shift_id {db_shift.id} is too large. Skipping NOTIFY.")

    except Exception as notify_err:
        logger.error(f"[Assign Shift] Failed to send NOTIFY for chat_id {assignment_data.group_telegram_id}: {notify_err}", exc_info=True)
    # --- Конец блока NOTIFY ---

    logger.info(f"[Assign Shift] Successfully assigned shift {db_shift.id} for member {target_member.user_id}")
    return db_shift # Возвращаем созданный объект Shift


# ===> TIMESHEET ENDPOINTS <===

# --- Обновленные схемы для Timesheet ---
class CourierTimesheetData(BaseModel):
    """Данные по одному курьеру для табеля."""
    user_id: int
    courier_name: str
    # Ключ - дата 'YYYY-MM-DD', значение - строка с информацией о смене (пока тип смены)
    dates: Dict[str, Optional[str]] = Field(default_factory=dict)

class TimesheetResponse(BaseModel):
    """Структура ответа для эндпоинта табеля."""
    columns: List[str] 
    rows: List[CourierTimesheetData]

# <<< НОВАЯ СХЕМА ДЛЯ ДОСТУПНЫХ ПЕРИОДОВ >>>
class AvailablePeriod(BaseModel):
    year: int
    month: int # Месяц будет 1-12

# <<< Определяем типы и дефолтные значения для SlotConfig прямо здесь >>>
class SlotConfigForDay(BaseModel):
    """Описывает конфигурацию слотов для одного дня."""
    maxDaySlots: int
    maxNightSlots: int

default_single_day_slot_config = SlotConfigForDay(maxDaySlots=4, maxNightSlots=2)

# --- Вспомогательная функция для получения и форматирования данных табеля ---
# <<< ДОБАВЛЯЕМ ПАРАМЕТРЫ ПЕРИОДА, НО ПОКА НЕ ИСПОЛЬЗУЕМ ИХ >>>
async def get_formatted_timesheet_data(
    group_internal_id: int,
    group_telegram_id: int, 
    db: AsyncSession,
    year: Optional[int] = None,
    month: Optional[int] = None,
    is_weekly: bool = False,
    access_settings: Dict[str, Any] = {} # <<< Добавляем access_settings
) -> Tuple[TimesheetResponse, Optional[str], Optional[str]]:
    """Получает смены (с фильтрацией по периоду/неделе для записи), группирует и возвращает."""
    logger.info(f"[Timesheet Helper] Called for group {group_telegram_id}, period: year={year}, month={month}, weekly={is_weekly}",
                 extra={"access_settings_received": bool(access_settings)})

    filter_conditions = [Shift.group_id == group_internal_id]
    period_description = "all time"
    # <<< Переменные для хранения дат периода >>>
    start_date_str: Optional[str] = None
    end_date_str: Optional[str] = None 

    if is_weekly:
        try:
            KRT = timezone(timedelta(hours=7))
            
            # <<< Читаем день из настроек (0=Вс ... 5=Пт ...) >>>
            setting_start_day = int(access_settings.get('registrationStartDay', 0)) 
            # <<< Конвертируем в Python конвенцию (0=Пн ... 6=Вс) >>>
            python_start_day = (setting_start_day - 1 + 7) % 7 
            logger.info(f"[Timesheet Helper] Read setting start day {setting_start_day}, converted to Python weekday {python_start_day}")
            
            start_hour = int(access_settings.get('registrationStartHour', 0))
            start_minute = int(access_settings.get('registrationStartMinute', 0))
            offset_type = access_settings.get('offsetType', 'weeks') 
            offset_amount = int(access_settings.get('offsetAmount', 1))
            period_days = int(access_settings.get('periodLength', 7))
            
            now_krt = datetime.now(KRT) 
            today_krt = now_krt.date()
            # <<< Используем python_start_day в расчетах >>>
            current_weekday_krt = today_krt.weekday()
            days_since_last_start_day = (current_weekday_krt - python_start_day + 7) % 7
            last_registration_day_date_krt = today_krt - timedelta(days=days_since_last_start_day)
            
            registration_time_naive = time(start_hour, start_minute)
            registration_datetime_krt_today = datetime.combine(today_krt, registration_time_naive, tzinfo=KRT)
            last_registration_datetime_krt = datetime.combine(last_registration_day_date_krt, registration_time_naive, tzinfo=KRT)

            # <<< Сравнение времени в KRT (используем python_start_day) >>>
            if current_weekday_krt == python_start_day and now_krt < registration_datetime_krt_today:
                last_registration_datetime_krt -= timedelta(weeks=1)
                logger.info(f"[Timesheet Helper] Registration time {start_hour}:{start_minute:02d} KRT not yet passed today (weekday {current_weekday_krt} == start day {python_start_day}). Using previous registration time: {last_registration_datetime_krt}")
            else:
                 logger.info(f"[Timesheet Helper] Last registration time considered: {last_registration_datetime_krt}")
            
            last_registration_date_krt = last_registration_datetime_krt.date()
            
            # <<< Расчет периода (используем python_start_day) >>>
            if offset_type == 'weeks':
                start_of_registration_week = last_registration_date_krt - timedelta(days=last_registration_date_krt.weekday())
                start_of_booking_week = start_of_registration_week + timedelta(weeks=offset_amount)
                logger.info(f"[Timesheet Helper] Calculating booking week based on offsetType='weeks', offset={offset_amount}")
            elif offset_type == 'days':
                start_of_booking_week = last_registration_date_krt + timedelta(days=offset_amount)
                logger.info(f"[Timesheet Helper] Calculating booking week based on offsetType='days', offset={offset_amount}")
            else: 
                 start_of_registration_week = last_registration_date_krt - timedelta(days=last_registration_date_krt.weekday())
                 start_of_booking_week = start_of_registration_week
                 logger.info(f"[Timesheet Helper] Calculating booking week based on offsetType='{offset_type}' (no offset applied)")
            
            end_of_booking_week = start_of_booking_week + timedelta(days=period_days - 1)

            # <<< Сохраняем рассчитанные даты >>>
            start_date_str = start_of_booking_week.isoformat()
            end_date_str = end_of_booking_week.isoformat()

            filter_conditions.append(Shift.date.between(start_of_booking_week, end_of_booking_week))
            period_description = f"booking week ({start_date_str} to {end_date_str}) based on settings"
            logger.info(f"[Timesheet Helper] Applying booking week filter: {start_date_str} - {end_date_str}")
        except Exception as e:
             # ... (Fallback остается) ...
             logger.error(f"[Timesheet Helper] Error calculating booking week from access_settings: {e}. Falling back to current calendar week.", exc_info=True)
             today_fallback = date.today()
             start_of_week_fallback = today_fallback - timedelta(days=today_fallback.weekday())
             end_of_week_fallback = start_of_week_fallback + timedelta(days=6)
             filter_conditions.append(Shift.date.between(start_of_week_fallback, end_of_week_fallback))
             period_description = f"current calendar week (fallback) ({start_of_week_fallback.isoformat()} to {end_of_week_fallback.isoformat()})"
    elif year is not None and month is not None:
        # ... (логика год/месяц) ...
        if 1 <= month <= 12:
            # <<< Рассчитываем начало и конец месяца для этого случая >>>
            try:
                 first_day_of_month = date(year, month, 1)
                 # Находим последний день месяца
                 next_month = first_day_of_month.replace(day=28) + timedelta(days=4) # Гарантированно следующий месяц
                 last_day_of_month = next_month - timedelta(days=next_month.day)
                 start_date_str = first_day_of_month.isoformat()
                 end_date_str = last_day_of_month.isoformat()
            except ValueError: # Некорректный год/месяц
                 logger.warning(f"Invalid year/month for date range calculation: {year}-{month}")
                 pass # Даты останутся None
            
            filter_conditions.append(extract('year', Shift.date) == year)
            filter_conditions.append(extract('month', Shift.date) == month)
            period_description = f"year {year}, month {month}"
            logger.info(f"[Timesheet Helper] Applying monthly filter: year={year}, month={month}")
        else:
             logger.warning(f"[Timesheet Helper] Invalid month provided: {month}. Ignoring filter.")
             period_description = "all time (invalid month ignored)"

    # 1. Запрос смен с фильтрами
    stmt = (
        select(Shift)
        .options(joinedload(Shift.member))
        .where(*filter_conditions)
        .order_by(Shift.date, Shift.member_id, Shift.shift_type)
    )
    result = await db.execute(stmt)
    shifts = result.scalars().all()
    logger.info(f"[Timesheet Helper] Found {len(shifts)} shifts for group {group_telegram_id} (internal ID: {group_internal_id}) for period: {period_description}")

    if not shifts:
        # <<< Возвращаем пустой ответ и None для дат >>>
        return TimesheetResponse(columns=[], rows=[]), start_date_str, end_date_str

    # 2. Собрать данные по курьерам и уникальные даты (из отфильтрованных смен)
    courier_data: Dict[int, CourierTimesheetData] = {}
    unique_dates: Set[date] = set()

    for shift in shifts:
        unique_dates.add(shift.date) # Даты будут только из выбранного периода
        if not shift.member:
            logger.warning(f"[Timesheet Helper] Shift ID {shift.id} has no associated member. Skipping.")
            continue

        member_id = shift.member.id
        user_id = shift.member.user_id

        # Добавляем курьера, если его еще нет
        if user_id not in courier_data:
            courier_name = f"{shift.member.first_name or ''} {shift.member.last_name or ''}".strip()
            if not courier_name:
                courier_name = f"User {user_id}" # Fallback
            courier_data[user_id] = CourierTimesheetData(user_id=user_id, courier_name=courier_name)
        
        # Добавляем информацию о смене на эту дату
        date_str = shift.date.isoformat()
        
        # <<< Определяем значение для ячейки >>>
        if shift.shift_type == 'day':
            current_shift_info = '10' 
        elif shift.shift_type == 'night':
            current_shift_info = '18'
        else:
            current_shift_info = shift.shift_type.capitalize() # Fallback на всякий случай
            
        # TODO: Решить, как обрабатывать несколько смен в день (если возможно)
        # Пока просто записываем тип смены. Если запись уже есть, можно добавить через "/"
        existing_info = courier_data[user_id].dates.get(date_str)
        if existing_info:
            # Проверяем, чтобы не дублировать (если вдруг придут две одинаковые)
            if current_shift_info not in existing_info.split('/'):
                 courier_data[user_id].dates[date_str] = f"{existing_info}/{current_shift_info}"
        else:
            courier_data[user_id].dates[date_str] = current_shift_info

    # 3. Подготовить финальный ответ
    sorted_dates = sorted(list(unique_dates))
    sorted_date_strings = [d.isoformat() for d in sorted_dates]
    
    final_rows: List[CourierTimesheetData] = []
    sorted_courier_ids = sorted(courier_data.keys(), key=lambda uid: courier_data[uid].courier_name)

    for user_id in sorted_courier_ids:
        courier = courier_data[user_id]
        complete_dates = {date_str: courier.dates.get(date_str) for date_str in sorted_date_strings}
        courier.dates = complete_dates
        final_rows.append(courier)

    logger.info(f"[Timesheet Helper] Generated {len(final_rows)} rows and {len(sorted_date_strings)} columns for group {group_telegram_id} ({period_description})")
    
    # <<< Возвращаем данные и сохраненные даты периода >>>
    return TimesheetResponse(columns=sorted_date_strings, rows=final_rows), start_date_str, end_date_str

# --- Обновленный эндпоинт GET /timesheets ---
@router.get("/timesheets", 
            response_model=TimesheetResponse, 
            summary="Get Timesheet Data (Pivoted)",
            description="Retrieves timesheet data, pivoted by courier and date, optionally filtered by period.", 
            tags=["Timesheet"])
async def get_timesheet_data_pivoted(
    group_telegram_id: int = Query(..., description="Telegram ID of the group"),
    year: Optional[int] = Query(None, description="Filter by year (e.g., 2024)"),
    month: Optional[int] = Query(None, description="Filter by month (1-12)"),
    is_weekly: bool = Query(False, description="Filter by the current week (overrides year/month if true)"),
    db: AsyncSession = Depends(get_db_session)
):
    """Формирует и возвращает данные табеля, сгруппированные по курьерам и датам.
    Позволяет фильтровать по году/месяцу или по текущей неделе.
    """
    logger.info(f"[Timesheet Pivoted] GET /timesheets - Request received for group {group_telegram_id}", 
                 extra={"query_params": {"year": year, "month": month, "is_weekly": is_weekly}})
    
    # 1. Найти группу и ее access_settings
    group_result = await db.execute(
        # <<< Запрашиваем весь объект Group >>>
        select(Group).where(Group.group_id == group_telegram_id)
    )
    group = group_result.scalar_one_or_none()
    
    if group is None:
        logger.warning(f"[Timesheet Pivoted] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {group_telegram_id} not found")
        
    group_internal_id = group.id # Получаем ID из объекта
    access_settings = group.access_settings or {} # Получаем настройки (или пустой dict)
    logger.info(f"[Timesheet Pivoted] Found group {group.id} with access settings: {access_settings}")

    # 2. Получить отформатированные данные с помощью хелпера
    try:
        response_data, start_date_str, end_date_str = await get_formatted_timesheet_data(
            group_internal_id=group_internal_id, 
            group_telegram_id=group_telegram_id, 
            db=db,
            year=year,
            month=month,
            is_weekly=is_weekly,
            # <<< Передаем access_settings >>>
            access_settings=access_settings
        )
        logger.info(f"[Timesheet Pivoted] Successfully generated pivoted data for group {group_telegram_id}")
        return response_data
    except Exception as e:
        logger.error(f"[Timesheet Pivoted] Error getting formatted data for group {group_telegram_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing timesheet data")

# --- Вспомогательная функция для генерации и сохранения файла --- 
# <<< Обновляем возвращаемый тип >>>
async def generate_and_save_timesheet(group_telegram_id: int, db: AsyncSession,
                                      year: Optional[int] = None,
                                      month: Optional[int] = None,
                                      is_weekly: bool = False) -> Tuple[Optional[Path], Optional[str], Optional[str]]:
    """Генерирует табель Excel (с учетом периода) и сохраняет его во временный файл.
    Возвращает путь к файлу и строки дат начала/конца периода (если применимо).
    """
    logger.info(f"[Timesheet Gen & Save] Начало генерации для группы {group_telegram_id}",
                 extra={"period_params": {"year": year, "month": month, "is_weekly": is_weekly}})
    
    # <<< КОПИРУЕМ ОПРЕДЕЛЕНИЯ СТИЛЕЙ ИЗ download_timesheet_data_pivoted_xlsx >>>
    title_font = Font(bold=True, size=14)
    header_font = Font(bold=True)
    centered_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    data_alignment = Alignment(horizontal='center', vertical='center') 
    left_alignment = Alignment(horizontal='left', vertical='center')
    thin_border_side = Side(style='thin')
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    weekend_fill = PatternFill(start_color="E0E0E0", end_color="E0E0E0", fill_type="solid")
    weekdays_ru = {0: 'пн', 1: 'вт', 2: 'ср', 3: 'чт', 4: 'пт', 5: 'сб', 6: 'вс'}
    weekend_indices = {5, 6} 
    # <<< КОНЕЦ КОПИРОВАНИЯ СТИЛЕЙ >>>

    # Находим внутренний ID группы и получаем данные группы
    group_result = await db.execute(
        select(Group).where(Group.group_id == group_telegram_id)
    )
    db_group = group_result.scalar_one_or_none()
    
    if not db_group:
        logger.error(f"[Timesheet Gen & Save] Группа {group_telegram_id} не найдена.")
        return None, None, None 
        
    # <<< ИЗМЕНЕНИЕ: Получаем и slot_config тоже >>>
    group_title = db_group.title or f"Группа {group_telegram_id}"
    group_slot_config = db_group.slot_config or {}
    logger.info(f"[Timesheet Gen & Save] Got title '{group_title}' and slot config for group {group_telegram_id}")

    # Получаем данные табеля, передавая параметры периода
    try:
        # <<< Распаковываем результат >>>
        pivoted_data, start_date_str, end_date_str = await get_formatted_timesheet_data(
            group_internal_id=db_group.id, 
            group_telegram_id=group_telegram_id, 
            db=db,
            year=year, # <<< Передаем year
            month=month, # <<< Передаем month
            is_weekly=is_weekly, # <<< Передаем is_weekly
            access_settings=db_group.access_settings or {} # Передаем настройки доступа
        )
    except Exception as e:
        logger.error(f"[Timesheet Gen & Save] Ошибка получения pivoted_data для группы {group_telegram_id}: {e}", exc_info=True)
        # <<< Возвращаем None для всех значений >>>
        return None, None, None 

    # Генерируем XLSX файл в памяти...
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Timesheet"
    
    # <<< ИСПОЛЬЗУЕМ СКОПИРОВАННЫЕ СТИЛИ >>>

    # Добавляем строку с названием группы
    title_cell = sheet.cell(row=1, column=1, value=f"Табель для группы: {group_title}")
    title_cell.font = title_font # Используем title_font
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    table_width = 1 + len(pivoted_data.columns) 
    if table_width > 1:
        sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=table_width)
    
    # Заголовки основной таблицы теперь начинаются со строки 2
    header_row_idx = 2 
    weekend_columns = [] 
    
    headers = ["ФИ Курьера"]
    for col_idx, date_str in enumerate(pivoted_data.columns):
        try:
            dt_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            day_num = dt_obj.day
            weekday_num = dt_obj.weekday()
            weekday_str = weekdays_ru.get(weekday_num, '?') # Используем weekdays_ru
            header_val = f"{day_num}\n{weekday_str}"
            headers.append(header_val)
            if weekday_num in weekend_indices: # Используем weekend_indices
                weekend_columns.append(col_idx + 2)
        except ValueError:
            logger.warning(f"[Timesheet Gen & Save] Invalid date format: {date_str}.")
            headers.append(date_str)
            
    # Записываем заголовки в строку header_row_idx
    for col, header_value in enumerate(headers, start=1):
         sheet.cell(row=header_row_idx, column=col, value=header_value)

    # Применяем стили к заголовкам и устанавливаем ширину
    sheet.column_dimensions[get_column_letter(1)].width = 30 
    for col_idx, header_val in enumerate(headers):
        cell = sheet.cell(row=header_row_idx, column=col_idx + 1)
        cell.font = header_font # Используем header_font
        cell.alignment = centered_alignment # Используем centered_alignment
        cell.border = thin_border # Используем thin_border
        if col_idx > 0: 
            sheet.column_dimensions[get_column_letter(col_idx + 1)].width = 7 
            
    # <<< ОПРЕДЕЛЯЕМ ИНДЕКС СТРОКИ ЗАГОЛОВКОВ (как в download_timesheet_data_pivoted_xlsx) >>>
    # header_row_idx = 2 # Уже определено выше
    
    # <<< ДОБАВЛЕНЫ ЛОГИ ПЕРЕД ЗАПИСЬЮ ДАННЫХ >>>
    logger.info(f"[Timesheet Gen & Save] Перед записью данных в Excel. Найдено колонок: {len(pivoted_data.columns)}, Найдено строк: {len(pivoted_data.rows)}")

    # Записываем строки данных и применяем стили (начиная с header_row_idx + 1)
    if pivoted_data.rows:
        logger.info(f"[Timesheet Gen & Save] Вход в цикл записи строк данных (rows > 0).") # <<< ЛОГ
        for row_idx_offset, courier_row in enumerate(pivoted_data.rows):
            current_row_idx = header_row_idx + 1 + row_idx_offset
            date_values = [courier_row.dates.get(date_col) for date_col in pivoted_data.columns]
            row_to_append = [courier_row.courier_name] + [(val if val is not None else "") for val in date_values]
            # Записываем данные в нужную строку
            for col, value in enumerate(row_to_append, start=1):
                 sheet.cell(row=current_row_idx, column=col, value=value)
                 
            # Применяем стили к ячейкам строки
            for col_idx, value in enumerate(row_to_append, start=1):
                 cell = sheet.cell(row=current_row_idx, column=col_idx)
                 cell.alignment = data_alignment # <<< Используем data_alignment >>>
                 cell.border = thin_border # <<< Используем thin_border >>>
        logger.info(f"[Timesheet Gen & Save] Завершили цикл записи {len(pivoted_data.rows)} строк данных.") # <<< ЛОГ
    else:
        logger.info(f"[Timesheet Gen & Save] Нет строк данных для записи (pivoted_data.rows пуст).") # <<< ЛОГ
        sheet.append([]) 
        
    last_data_row = sheet.max_row 
    
    # Выделяем колонки выходных дней (до last_data_row)
    for col_idx_to_fill in weekend_columns:
        for row_idx in range(header_row_idx, last_data_row + 1): 
            sheet.cell(row=row_idx, column=col_idx_to_fill).fill = weekend_fill # Используем weekend_fill

    # 3. Добавляем Настройки Слотов с отступом
    start_row_for_slots = last_data_row + 6
    
    schedule_header_cell = sheet.cell(row=start_row_for_slots, column=1, value="Согласно расписания (День/Ночь)")
    schedule_header_cell.font = header_font # Используем header_font
    schedule_header_cell.border = thin_border # Используем thin_border
    schedule_header_cell.alignment = left_alignment # Используем left_alignment
    
    # Запись настроек для каждого дня недели НАЧИНАЯ СО ВТОРОЙ КОЛОНКИ
    for col_idx, date_str in enumerate(pivoted_data.columns): 
        excel_col_index = col_idx + 2 
        day_slots_str = "-"
        night_slots_str = "-"
        is_weekend_col = False
        try:
            dt_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            day_index = dt_obj.weekday()
            slot_config_key = str((day_index + 1) % 7)
            config_for_day_dict: Optional[Dict] = group_slot_config.get(slot_config_key)
            day_slots = config_for_day_dict.get('maxDaySlots') if config_for_day_dict else None
            night_slots = config_for_day_dict.get('maxNightSlots') if config_for_day_dict else None
            day_slots_str = str(day_slots) if day_slots is not None else str(default_single_day_slot_config.maxDaySlots)
            night_slots_str = str(night_slots) if night_slots is not None else str(default_single_day_slot_config.maxNightSlots)
            if day_index in weekend_indices:
                 is_weekend_col = True
        except ValueError:
             logger.warning(f"[Timesheet Gen & Save] Invalid date format in column {excel_col_index} for slot config row.")
        slot_value_str = f"{day_slots_str} / {night_slots_str}"
        slot_cell = sheet.cell(row=start_row_for_slots, column=excel_col_index, value=slot_value_str)
        slot_cell.border = thin_border # Используем thin_border
        slot_cell.alignment = centered_alignment # Используем centered_alignment
        if is_weekend_col:
             slot_cell.fill = weekend_fill # Используем weekend_fill
             
    # Устанавливаем ширину для колонок
    sheet.column_dimensions[get_column_letter(1)].width = 35 

    # 4. Сохраняем в файл
    # <<< ИЗМЕНЯЕМ ЛОГИКУ ГЕНЕРАЦИИ ИМЕНИ ФАЙЛА С УЧЕТОМ ПЕРИОДА >>>
    safe_group_title = sanitize_filename(db_group.title or f"group_{group_telegram_id}")
    period_str = "unknown_period"
    if is_weekly:
        # Попробуем получить даты из pivoted_data если они есть
        if pivoted_data.columns:
            first_date = pivoted_data.columns[0]
            try:
                 start_of_week = datetime.strptime(first_date, '%Y-%m-%d').date()
                 week_num = start_of_week.isocalendar()[1]
                 period_str = f"week_{start_of_week.year}-W{week_num:02d}"
            except ValueError: pass # Оставим unknown_period
        else:
             # Если нет данных, используем текущую неделю
             today = date.today()
             start_of_week = today - timedelta(days=today.weekday())
             week_num = start_of_week.isocalendar()[1]
             period_str = f"week_{start_of_week.year}-W{week_num:02d}_(no_data)" 
    elif year is not None and month is not None:
        period_str = f"{year}-{month:02d}"
    elif pivoted_data.columns:
        first_date = pivoted_data.columns[0]
        last_date = pivoted_data.columns[-1]
        period_str = f"{first_date}_to_{last_date}" if first_date != last_date else first_date
    else:
        period_str = datetime.now().strftime("%Y%m%d") + "_(no_data)"

    file_timestamp = datetime.now().strftime("%H%M%S")
    filename = f"Табель_{safe_group_title}_{period_str}_{file_timestamp}.xlsx"
    # <<< КОНЕЦ ИЗМЕНЕНИЙ В ГЕНЕРАЦИИ ИМЕНИ >>>
    
    filepath = SHARED_FOLDER / filename
    logger.info(f"[Timesheet Gen & Save] Попытка сохранить workbook в файл: {filepath}")
    try:
        workbook.save(filepath)
        logger.info(f"[Timesheet Gen & Save] workbook.save() выполнен для {filepath}. Проверяем размер файла...")
        
        # <<< ДОБАВЛЕНА ПРОВЕРКА РАЗМЕРА ФАЙЛА >>>
        try:
            if filepath.exists():
                file_size = filepath.stat().st_size
                logger.info(f"[Timesheet Gen & Save] Файл {filepath} существует. Размер: {file_size} байт.")
                if file_size == 0:
                     logger.warning(f"[Timesheet Gen & Save] ВНИМАНИЕ: Файл {filepath} сохранен с нулевым размером!")
            else:
                 logger.error(f"[Timesheet Gen & Save] ОШИБКА: Файл {filepath} не существует после сохранения!")
        except Exception as stat_err:
            logger.error(f"[Timesheet Gen & Save] Ошибка при проверке файла {filepath}: {stat_err}")
        # <<< КОНЕЦ ПРОВЕРКИ РАЗМЕРА >>>
            
        return filepath, start_date_str, end_date_str
    except Exception as e:
        logger.error(f"[Timesheet Gen & Save] Ошибка при вызове workbook.save({filepath}): {e}", exc_info=True)
        return None, None, None

# --- Фоновая задача для отправки боту --- 
# <<< Обновляем сигнатуру: добавляем параметры периода >>>
async def trigger_bot_to_send_timesheet(requester_telegram_id: int, group_telegram_id: int, destination: str,
                                      year: Optional[int] = None,
                                      month: Optional[int] = None,
                                      is_weekly: bool = False):
    """Фоновая задача: генерирует табель (с учетом периода) и просит бота отправить его."""
    logger.info(f"[BG Task] Запуск фоновой задачи для отправки табеля группы {group_telegram_id} (запросил {requester_telegram_id}, назначение: {destination})",
                 extra={"period_params": {"year": year, "month": month, "is_weekly": is_weekly}})
    filepath: Optional[Path] = None
    
    async with AsyncSessionFactory() as db:
        try:
            # <<< Передаем параметры периода в функцию генерации файла >>>
            # <<< Распаковываем результат, включающий даты >>>
            filepath, start_date_str, end_date_str = await generate_and_save_timesheet(
                group_telegram_id=group_telegram_id, 
                db=db,
                year=year,
                month=month,
                is_weekly=is_weekly
            )

            if not filepath:
                logger.error(f"[BG Task] Не удалось сгенерировать или сохранить файл для группы {group_telegram_id}. Отправка боту отменена.")
                return
            
            # <<< Логика определения target_chat_id и отправки боту остается прежней >>>
            target_chat_id: int
            if destination == 'group':
                target_chat_id = group_telegram_id
            else: 
                target_chat_id = requester_telegram_id
            logger.info(f"[BG Task] Файл {filepath.name} будет отправлен в чат {target_chat_id}")

            bot_endpoint = f"{BOT_INTERNAL_URL}/internal/send-file"
            payload = {
                "target_chat_id": target_chat_id, 
                "file_path": str(filepath),
                # <<< Передаем базовую информацию о периоде >>>
                "period_year": year, 
                "period_month": month, 
                "period_is_weekly": is_weekly,
                # <<< ДОБАВЛЯЕМ РАССЧИТАННЫЕ ДАТЫ (если они есть) >>>
                "period_start_date": start_date_str, 
                "period_end_date": end_date_str 
            }
            logger.info(f"[BG Task] Отправка запроса боту: {bot_endpoint} с payload: {payload}")

            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    response = await client.post(bot_endpoint, json=payload)
                    response.raise_for_status() 
                    logger.info(f"[BG Task] Успешный ответ от бота (статус {response.status_code}) для файла {filepath}")
                    # <<< ДОБАВЛЯЕМ УДАЛЕНИЕ ФАЙЛА ПОСЛЕ УСПЕШНОЙ ОТПРАВКИ >>>
                    try:
                        filepath.unlink()
                        logger.info(f"[BG Task] Временный файл {filepath} удален.")
                    except OSError as unlink_err:
                        logger.error(f"[BG Task] Ошибка при удалении файла {filepath}: {unlink_err}")
                except Exception as e:
                    logger.error(f"[BG Task] Ошибка при взаимодействии с ботом ({bot_endpoint}): {e}", exc_info=True)
                    # TODO: Отправить уведомление об ошибке запросившему пользователю?

        except Exception as e:
            logger.error(f"[BG Task] Непредвиденная ошибка в фоновой задаче для группы {group_telegram_id}: {e}", exc_info=True)
            # TODO: Отправить уведомление об ошибке запросившему пользователю?

# --- Новый эндпоинт для запроса отправки через бота --- 
@router.post("/groups/{group_telegram_id}/timesheet/send-to-bot", 
             status_code=status.HTTP_202_ACCEPTED,
             summary="Request Timesheet via Bot",
             description="Initiates background generation and sending of the timesheet Excel file via Telegram bot to the requesting user or the group, optionally filtered by period.", # <<< Обновляем описание
             tags=["Timesheet"])
async def request_timesheet_via_bot(
    background_tasks: BackgroundTasks,
    group_telegram_id: int = FastApiPath(..., description="Telegram ID of the group"),
    requester_telegram_id: int = Query(..., description="Telegram ID of the user requesting the timesheet"),
    destination: str = Query('user', description="Куда отправить файл: 'user' (в ЛС) или 'group' (в чат группы)", pattern="^(user|group)$" ), 
    # <<< Добавляем параметры периода >>>
    year: Optional[int] = Query(None, description="Filter by year (e.g., 2024)"),
    month: Optional[int] = Query(None, description="Filter by month (1-12)"),
    is_weekly: bool = Query(False, description="Filter by the current week (overrides year/month if true)"),
):
    logger.info(f"[Send To Bot] User {requester_telegram_id} requested timesheet for group {group_telegram_id} via bot. Destination: {destination}",
                 extra={"period_params": {"year": year, "month": month, "is_weekly": is_weekly}})

    # Добавляем фоновую задачу, передавая параметры периода
    background_tasks.add_task(
        trigger_bot_to_send_timesheet,
        requester_telegram_id=requester_telegram_id,
        group_telegram_id=group_telegram_id,
        destination=destination, 
        year=year, # <<< Передаем year
        month=month, # <<< Передаем month
        is_weekly=is_weekly # <<< Передаем is_weekly
    )

    return {"status": "accepted", "message": f"Табель формируется и скоро будет отправлен {( 'вам в ЛС' if destination == 'user' else 'в чат группы')} ботом."}


# --- Существующий эндпоинт GET /timesheet/download --- 
@router.get("/groups/{group_telegram_id}/timesheet/download", 
            summary="Download Pivoted Timesheet Data as XLSX",
            description="Retrieves pivoted timesheet data and returns it as an Excel (.xlsx) file.",
            tags=["Timesheet"])
async def download_timesheet_data_pivoted_xlsx(
    group_telegram_id: int = FastApiPath(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"[Timesheet Download XLSX] GET /groups/{group_telegram_id}/timesheet/download - Request received")
    
    # 1. Получаем внутренний ID группы
    group_result = await db.execute(
        select(Group.id).where(Group.group_id == group_telegram_id)
    )
    group_internal_id = group_result.scalar_one_or_none()
    if group_internal_id is None:
        logger.warning(f"[Timesheet Download XLSX] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {group_telegram_id} not found")
        
    # 1.5 Получаем данные табеля И данные группы (slot_config и title)
    try:
        pivoted_data = await get_formatted_timesheet_data(
            group_internal_id=group_internal_id, 
            group_telegram_id=group_telegram_id, 
            db=db
        )
        
        # <<< Запрашиваем и title, и slot_config >>>
        group_data_result = await db.execute(
             select(Group.title, Group.slot_config).where(Group.id == group_internal_id)
        )
        group_data = group_data_result.first() # Получаем кортеж (title, slot_config)
        group_title = group_data.title if group_data else "Неизвестная группа"
        group_slot_config = group_data.slot_config if group_data and group_data.slot_config else {}
        logger.info(f"[Timesheet Download XLSX] Got title '{group_title}' and slot config for group {group_telegram_id}")

    except Exception as e:
         logger.error(f"[Timesheet Download XLSX] Error getting formatted data or group config for group {group_telegram_id}: {e}", exc_info=True)
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error retrieving data")

    # 2. Генерируем XLSX файл в памяти
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Timesheet"
    
    # Определяем стили
    title_font = Font(bold=True, size=14)
    header_font = Font(bold=True)
    centered_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    data_alignment = Alignment(horizontal='center', vertical='center') 
    left_alignment = Alignment(horizontal='left', vertical='center') # Для названий дней недели
    thin_border_side = Side(style='thin')
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    weekend_fill = PatternFill(start_color="E0E0E0", end_color="E0E0E0", fill_type="solid")

    # <<< Добавляем строку с названием группы >>>
    title_cell = sheet.cell(row=1, column=1, value=f"Табель для группы: {group_title}")
    title_cell.font = title_font
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    # Объединяем ячейки на всю ширину будущей таблицы
    # Ширина = 1 (ФИО) + кол-во дат
    table_width = 1 + len(pivoted_data.columns) 
    if table_width > 1:
        sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=table_width)
    
    # <<< Заголовки основной таблицы теперь начинаются со строки 2 >>>
    header_row_idx = 2
    weekdays_ru = {0: 'пн', 1: 'вт', 2: 'ср', 3: 'чт', 4: 'пт', 5: 'сб', 6: 'вс'}
    weekend_indices = {5, 6} 
    weekend_columns = [] 
    
    headers = ["ФИ Курьера"]
    for col_idx, date_str in enumerate(pivoted_data.columns):
        try:
            dt_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            day_num = dt_obj.day
            weekday_num = dt_obj.weekday() # 0 для Пн, 6 для Вс
            weekday_str = weekdays_ru.get(weekday_num, '?')
            header_val = f"{day_num}\n{weekday_str}"
            headers.append(header_val)
            if weekday_num in weekend_indices:
                weekend_columns.append(col_idx + 2)
        except ValueError:
            logger.warning(f"[Timesheet Download XLSX] Invalid date format: {date_str}.")
            headers.append(date_str)
            
    # <<< Записываем заголовки в строку header_row_idx >>>
    sheet.append(headers) # Это запишет в следующую свободную строку, нужно явно указать
    for col, header_value in enumerate(headers, start=1):
         sheet.cell(row=header_row_idx, column=col, value=header_value)

    # Применяем стили к заголовкам и устанавливаем ширину
    sheet.column_dimensions[get_column_letter(1)].width = 30 
    for col_idx, header_val in enumerate(headers):
        cell = sheet.cell(row=header_row_idx, column=col_idx + 1)
        cell.font = header_font
        cell.alignment = centered_alignment
        cell.border = thin_border
        if col_idx > 0: 
            sheet.column_dimensions[get_column_letter(col_idx + 1)].width = 7 

    # Записываем строки данных и применяем стили (начиная с header_row_idx + 1)
    if pivoted_data.rows:
        for row_idx_offset, courier_row in enumerate(pivoted_data.rows):
            current_row_idx = header_row_idx + 1 + row_idx_offset
            date_values = [courier_row.dates.get(date_col) for date_col in pivoted_data.columns]
            row_to_append = [courier_row.courier_name] + [(val if val is not None else "") for val in date_values]
            # Записываем данные в нужную строку
            for col, value in enumerate(row_to_append, start=1):
                 sheet.cell(row=current_row_idx, column=col, value=value)
                 
            # Применяем стили к ячейкам строки
            for col_idx, value in enumerate(row_to_append, start=1):
                 cell = sheet.cell(row=current_row_idx, column=col_idx)
                 cell.alignment = data_alignment 
                 cell.border = thin_border
    else:
        logger.info(f"[Timesheet Download XLSX] No data rows to write for group {group_telegram_id}")
        # Добавим пустую строку, если данных нет, чтобы настройки слотов не прилипли к заголовку
        sheet.append([]) # Добавит строку после заголовка
        
    last_data_row = sheet.max_row # Обновляем последнюю строку
    
    # Выделяем колонки выходных дней (до last_data_row)
    for col_idx_to_fill in weekend_columns:
        # Начинаем со строки заголовков таблицы
        for row_idx in range(header_row_idx, last_data_row + 1): 
            sheet.cell(row=row_idx, column=col_idx_to_fill).fill = weekend_fill

    # 3. Добавляем Настройки Слотов с отступом
    start_row_for_slots = last_data_row + 6
    
    # Заголовок в первой колонке
    schedule_header_cell = sheet.cell(row=start_row_for_slots, column=1, value="Согласно расписания (День/Ночь)")
    schedule_header_cell.font = header_font 
    schedule_header_cell.border = thin_border
    schedule_header_cell.alignment = left_alignment
    
    # Запись настроек для каждого дня недели НАЧИНАЯ СО ВТОРОЙ КОЛОНКИ
    for col_idx, date_str in enumerate(pivoted_data.columns): 
        excel_col_index = col_idx + 2 
        
        day_slots_str = "-"
        night_slots_str = "-"
        is_weekend_col = False
        
        try:
            dt_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            day_index = dt_obj.weekday() # Получаем индекс 0=Пн ... 6=Вс
            
            # <<< Возвращаем конвертацию индекса (0=Пн -> 1, ..., 6=Вс -> 0) >>>
            slot_config_key = str((day_index + 1) % 7)
            config_for_day_dict: Optional[Dict] = group_slot_config.get(slot_config_key)
            
            day_slots = config_for_day_dict.get('maxDaySlots') if config_for_day_dict else None
            night_slots = config_for_day_dict.get('maxNightSlots') if config_for_day_dict else None
            
            day_slots_str = str(day_slots) if day_slots is not None else str(default_single_day_slot_config.maxDaySlots)
            night_slots_str = str(night_slots) if night_slots is not None else str(default_single_day_slot_config.maxNightSlots)
            
            if day_index in weekend_indices:
                 is_weekend_col = True
                 
        except ValueError:
             logger.warning(f"[Timesheet Download XLSX] Invalid date format in column {excel_col_index} for slot config row.")
        
        slot_value_str = f"{day_slots_str} / {night_slots_str}"
        
        # Записываем значение слотов в нужную колонку
        slot_cell = sheet.cell(row=start_row_for_slots, column=excel_col_index, value=slot_value_str) # <<< Используем start_row_for_slots
        slot_cell.border = thin_border
        slot_cell.alignment = centered_alignment 
        if is_weekend_col:
             slot_cell.fill = weekend_fill 
             
    # Устанавливаем ширину для колонок (если нужно скорректировать)
    sheet.column_dimensions[get_column_letter(1)].width = 35 # Пошире для заголовка строки
    # Ширина остальных колонок уже установлена при обработке заголовков дат

    # 4. Сохраняем в буфер и возвращаем
    excel_buffer = BytesIO()
    workbook.save(excel_buffer)
    excel_buffer.seek(0)
    
    filename = f"timesheet_pivoted_{group_telegram_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    logger.info(f"[Timesheet Download XLSX] Sending XLSX file: {filename} for group {group_telegram_id}")
    return StreamingResponse(
        excel_buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    ) 

# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ДОСТУПНЫХ ПЕРИОДОВ --- 
@router.get("/available-periods", 
            response_model=List[AvailablePeriod], 
            summary="Get Available Timesheet Periods",
            description="Retrieves a list of unique year/month combinations for which shifts exist in the specified group.",
            tags=["Timesheet"])
async def get_available_timesheet_periods(
    group_telegram_id: int = Query(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    """Возвращает список доступных для выбора месяцев/годов для табеля группы."""
    logger.info(f"[Available Periods] GET /available-periods - Request received for group {group_telegram_id}")

    # 1. Найти внутренний ID группы
    group_result = await db.execute(
        select(Group.id).where(Group.group_id == group_telegram_id)
    )
    group_internal_id = group_result.scalar_one_or_none()
    if group_internal_id is None: 
        logger.warning(f"[Available Periods] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {group_telegram_id} not found")

    # 2. Запрос уникальных пар год/месяц из таблицы shifts
    try:
        stmt = (
            select(
                extract('year', Shift.date).label('year'), 
                extract('month', Shift.date).label('month')
            )
            .where(Shift.group_id == group_internal_id)
            .distinct()
            .order_by(extract('year', Shift.date).desc(), extract('month', Shift.date).desc())
        )
        result = await db.execute(stmt)
        # Получаем результат как список кортежей (year, month)
        period_rows = result.all() 

        # Преобразуем в список словарей/объектов Pydantic
        available_periods = [
            AvailablePeriod(year=row.year, month=row.month) 
            for row in period_rows
            if row.year is not None and row.month is not None # Доп. проверка на None
        ]
        
        logger.info(f"[Available Periods] Found {len(available_periods)} distinct periods for group {group_telegram_id}")
        return available_periods
    
    except Exception as e:
        logger.error(f"[Available Periods] Error fetching available periods for group {group_telegram_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error retrieving available periods")