from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import text, Date as SQLDate
import json
import logging
from typing import List, Optional, Dict, Set
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime
import io
import csv
from fastapi.responses import StreamingResponse
import openpyxl
from io import BytesIO
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

# Используем АБСОЛЮТНЫЕ импорты от /app
from db.session import get_db_session
from models.shift import Shift
from schemas.shift import ShiftRead, ShiftCreate, ShiftBase
from models.member import Member
from models.group import Group
from models.group_member import GroupMember
from models.reserve import Reserve
import schemas # <<< ДОБАВИТЬ ЭТОТ ИМПОРТ

# Инициализируем логгер
logger = logging.getLogger(__name__)

# <<< Новая схема для создания через Telegram ID >>>
class ShiftCreateTelegram(BaseModel):
    date: str # ISO string date only YYYY-MM-DD
    shift_type: str # 'day' or 'night'
    slot_index: int
    user_telegram_id: int # Telegram ID пользователя
    group_telegram_id: int # Telegram ID группы
    # is_drag_action: Optional[bool] = None # Если нужно передавать

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
    """Создает новую запись о смене по Telegram ID пользователя и группы."""
    
    # 1. Найти пользователя (Member) ...
    member_result = await db.execute(
        select(Member).where(Member.user_id == shift_in.user_telegram_id)
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        logger.error(f"[Create Shift] Member with Telegram ID {shift_in.user_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Member with Telegram ID {shift_in.user_telegram_id} not found")
        
    # 2. Найти группу (Group) и ее настройки
    group_result = await db.execute(
        select(Group).where(Group.group_id == shift_in.group_telegram_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        logger.error(f"[Create Shift] Group with Telegram ID {shift_in.group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group with Telegram ID {shift_in.group_telegram_id} not found")

    # === НАЧАЛО: Преобразование строки даты в объект date ===
    try:
        date_obj = datetime.strptime(shift_in.date, '%Y-%m-%d').date()
    except ValueError:
        logger.error(f"[Create Shift] Invalid date format received: {shift_in.date}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid date format. Use YYYY-MM-DD.")
    # === КОНЕЦ: Преобразование ===

    # === НАЧАЛО: Логика удаления старых смен при allowMultipleShifts=False ===
    allow_multiple = group.access_settings.get('allowMultipleShifts', True) # По умолчанию разрешаем, если настройки нет
    
    if not allow_multiple:
        logger.info(f"[Create Shift] allowMultipleShifts is False for group {group.id}. Checking for existing shifts for member {member.id} on {date_obj}...")
        # Ищем существующие смены для этого пользователя на эту дату в этой группе
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
            logger.info(f"[Create Shift] Found {len(existing_shifts)} existing shift(s) for member {member.id} on {date_obj}. Deleting them...")
            for existing_shift in existing_shifts:
                logger.debug(f"[Create Shift] Deleting existing shift ID: {existing_shift.id}")
                await db.delete(existing_shift)
            # Не вызываем commit здесь, он будет вызван после добавления новой смены
        else:
            logger.info(f"[Create Shift] No existing shifts found for member {member.id} on {date_obj}.")
    else:
         logger.info(f"[Create Shift] allowMultipleShifts is True for group {group.id}. Skipping check for existing shifts.")
    # === КОНЕЦ: Логика удаления старых смен ===

    # 3. Создать НОВУЮ смену
    db_shift = Shift(
        member_id=member.id, 
        group_id=group.id,   
        date=date_obj,
        shift_type=shift_in.shift_type,
        slot_index=shift_in.slot_index
    )
    
    db.add(db_shift)
    try:
        await db.commit()
        logger.info(f"[Create Shift] Shift committed for member {member.id} in group {group.id} ({shift_in.group_telegram_id}) on {date_obj}")
        await db.refresh(db_shift, attribute_names=['id', 'created_at', 'updated_at'])
        
        # --- Отправка NOTIFY после успешного коммита --- >
        try:
            # Загружаем связанного Member для ответа И ДЛЯ NOTIFY
            stmt = select(Shift).options(joinedload(Shift.member)).where(Shift.id == db_shift.id)
            result = await db.execute(stmt)
            created_shift_with_member: Shift | None = result.scalar_one_or_none()

            if created_shift_with_member and created_shift_with_member.member:
                # <<< НАЧАЛО ИЗМЕНЕНИЯ: Добавляем статус старшего курьера ПЕРЕД ВОЗВРАТОМ >>>
                is_senior = False # По умолчанию
                gm_result = await db.execute(
                    select(GroupMember.is_senior_courier)
                    .where(
                        (GroupMember.member_id == created_shift_with_member.member.id) &
                        (GroupMember.group_id == created_shift_with_member.group_id) # group_id есть у Shift
                    )
                )
                senior_status = gm_result.scalar_one_or_none()
                if senior_status is not None:
                    is_senior = senior_status

                try:
                    setattr(created_shift_with_member.member, 'is_senior_courier', is_senior)
                    logger.info(f"[Create Shift] Added is_senior_courier={is_senior} to response member {created_shift_with_member.member.id}")
                except AttributeError:
                    logger.warning(f"[Create Shift] Could not set is_senior_courier on response member {created_shift_with_member.member.id}")
                    pass
                # <<< КОНЕЦ ИЗМЕНЕНИЯ >>>
                
                # ===> ИСПРАВЛЕНИЕ: Сначала конвертируем в Pydantic схему <===
                try:
                    pydantic_shift = ShiftRead.model_validate(created_shift_with_member, from_attributes=True)
                    shift_data_dict = pydantic_shift.model_dump(exclude_none=True, mode='json')
                except Exception as pydantic_error:
                     logger.error(f"[Create Shift] Error converting SQLAlchemy Shift to Pydantic ShiftRead: {pydantic_error}", exc_info=True)
                     shift_data_dict = None

                # Только если успешно получили словарь, отправляем NOTIFY
                if shift_data_dict:
                    notify_payload_dict = {
                        "type": "shifts_updated",
                        "chat_id": str(shift_in.group_telegram_id),
                        "source": "shift_creation",
                        "shift_data": shift_data_dict
                    }
                    notify_payload_json = json.dumps(notify_payload_dict)

                    if len(notify_payload_json.encode('utf-8')) < 7900:
                        escaped_payload = notify_payload_json.replace("'", "''")
                        sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                        await db.execute(sql_command)
                        logger.info(f"[Create Shift] Sent NOTIFY with FULL data for shift_id {db_shift.id} in chat_id {shift_in.group_telegram_id}")
                    else:
                        logger.warning(f"[Create Shift] NOTIFY payload for shift_id {db_shift.id} is too large ({len(notify_payload_json.encode('utf-8'))} bytes). Skipping NOTIFY.")
                else:
                    logger.error(f"[Create Shift] Could not prepare shift_data_dict for NOTIFY (Shift ID: {db_shift.id})")

            else:
                logger.error(f"[Create Shift] Could not fetch created shift details after commit (Shift ID: {db_shift.id}). Cannot send NOTIFY.")

        except Exception as notify_err:
            logger.error(f"[Create Shift] Failed to send NOTIFY for chat_id {shift_in.group_telegram_id}: {notify_err}", exc_info=True)
        # --- Конец блока NOTIFY ---

        # Возвращаем созданный объект (он уже загружен и модифицирован)
        return created_shift_with_member

    except Exception as e:
        await db.rollback()
        logger.error(f"[Create Shift] Error during shift creation or commit: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the shift."
        ) 

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
    columns: List[str] # Список дат YYYY-MM-DD в качестве колонок
    rows: List[CourierTimesheetData]

# <<< Определяем типы и дефолтные значения для SlotConfig прямо здесь >>>
class SlotConfigForDay(BaseModel):
    """Описывает конфигурацию слотов для одного дня."""
    maxDaySlots: int
    maxNightSlots: int

default_single_day_slot_config = SlotConfigForDay(maxDaySlots=4, maxNightSlots=2)

# --- Вспомогательная функция для получения и форматирования данных табеля ---
async def get_formatted_timesheet_data(
    group_internal_id: int,
    group_telegram_id: int, # Добавляем для логирования
    db: AsyncSession
) -> TimesheetResponse:
    """Получает смены, группирует их и возвращает в формате TimesheetResponse."""
    
    # 1. Получить все смены для этой группы с данными курьеров
    stmt = (
        select(Shift)
        .options(joinedload(Shift.member))
        .where(Shift.group_id == group_internal_id)
        .order_by(Shift.date, Shift.member_id, Shift.shift_type)
    )
    result = await db.execute(stmt)
    shifts = result.scalars().all()
    logger.info(f"[Timesheet Helper] Found {len(shifts)} shifts for group {group_telegram_id} (internal ID: {group_internal_id})")

    if not shifts:
        return TimesheetResponse(columns=[], rows=[]) # Возвращаем пустой ответ, если смен нет

    # 2. Собрать данные по курьерам и уникальные даты
    courier_data: Dict[int, CourierTimesheetData] = {}
    unique_dates: Set[date] = set()

    for shift in shifts:
        unique_dates.add(shift.date)
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
    # Сортируем курьеров по имени для порядка
    sorted_courier_ids = sorted(courier_data.keys(), key=lambda uid: courier_data[uid].courier_name)

    for user_id in sorted_courier_ids:
        courier = courier_data[user_id]
        # Убедимся, что у каждого курьера есть запись для каждой даты
        complete_dates = {date_str: courier.dates.get(date_str) for date_str in sorted_date_strings}
        courier.dates = complete_dates
        final_rows.append(courier)

    logger.info(f"[Timesheet Helper] Generated {len(final_rows)} rows and {len(sorted_date_strings)} columns for group {group_telegram_id}")
    return TimesheetResponse(columns=sorted_date_strings, rows=final_rows)

# --- Обновленный эндпоинт GET /timesheet ---
@router.get("/groups/{group_telegram_id}/timesheet", 
            response_model=TimesheetResponse, # <<< Используем новую схему ответа
            summary="Get Timesheet Data (Pivoted)",
            description="Retrieves timesheet data, pivoted by courier and date.",
            tags=["Timesheet"])
async def get_timesheet_data_pivoted(
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    """Формирует и возвращает данные табеля, сгруппированные по курьерам и датам."""
    logger.info(f"[Timesheet Pivoted] GET /groups/{group_telegram_id}/timesheet - Request received")
    
    # 1. Найти внутренний ID группы
    group_result = await db.execute(
        select(Group.id).where(Group.group_id == group_telegram_id)
    )
    group_internal_id = group_result.scalar_one_or_none()
    
    if group_internal_id is None:
        logger.warning(f"[Timesheet Pivoted] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {group_telegram_id} not found")

    # 2. Получить отформатированные данные с помощью хелпера
    try:
        response_data = await get_formatted_timesheet_data(
            group_internal_id=group_internal_id, 
            group_telegram_id=group_telegram_id, 
            db=db
        )
        logger.info(f"[Timesheet Pivoted] Successfully generated pivoted data for group {group_telegram_id}")
        return response_data
    except Exception as e:
        logger.error(f"[Timesheet Pivoted] Error getting formatted data for group {group_telegram_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing timesheet data")

# --- Новый эндпоинт GET /timesheet/download для Excel --- 
@router.get("/groups/{group_telegram_id}/timesheet/download", 
            summary="Download Pivoted Timesheet Data as XLSX",
            description="Retrieves pivoted timesheet data and returns it as an Excel (.xlsx) file.",
            tags=["Timesheet"])
async def download_timesheet_data_pivoted_xlsx(
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
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