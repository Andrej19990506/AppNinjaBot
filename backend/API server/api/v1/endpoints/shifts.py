from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import text
import json
import logging
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID

# Используем АБСОЛЮТНЫЕ импорты от /app
from db.session import get_db_session
from models.shift import Shift
from schemas.shift import ShiftRead, ShiftCreate, ShiftBase
from models.member import Member
from models.group import Group

# Добавляем схемы для создания и базовую
# Убираем дубликат импорта ShiftRead и ShiftBase
# from schemas.shift import ShiftRead, ShiftCreate, ShiftBase 

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
    
    return shifts

@router.post("", response_model=ShiftRead, status_code=status.HTTP_201_CREATED)
async def create_shift(
    shift_in: ShiftCreateTelegram, # <<< Используем новую схему
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

    # === НАЧАЛО: Логика удаления старых смен при allowMultipleShifts=False ===
    allow_multiple = group.access_settings.get('allowMultipleShifts', True) # По умолчанию разрешаем, если настройки нет
    
    if not allow_multiple:
        logger.info(f"[Create Shift] allowMultipleShifts is False for group {group.id}. Checking for existing shifts for member {member.id} on {shift_in.date}...")
        # Ищем существующие смены для этого пользователя на эту дату в этой группе
        stmt_find_existing = (
            select(Shift)
            .where(
                Shift.member_id == member.id,
                Shift.group_id == group.id,
                Shift.date == shift_in.date
            )
        )
        existing_shifts_result = await db.execute(stmt_find_existing)
        existing_shifts = existing_shifts_result.scalars().all()
        
        if existing_shifts:
            logger.info(f"[Create Shift] Found {len(existing_shifts)} existing shift(s) for member {member.id} on {shift_in.date}. Deleting them...")
            for existing_shift in existing_shifts:
                logger.debug(f"[Create Shift] Deleting existing shift ID: {existing_shift.id}")
                await db.delete(existing_shift)
            # Не вызываем commit здесь, он будет вызван после добавления новой смены
        else:
            logger.info(f"[Create Shift] No existing shifts found for member {member.id} on {shift_in.date}.")
    else:
         logger.info(f"[Create Shift] allowMultipleShifts is True for group {group.id}. Skipping check for existing shifts.")
    # === КОНЕЦ: Логика удаления старых смен ===

    # 3. Создать НОВУЮ смену, используя найденные внутренние ID
    logger.info(f"[Create Shift] Creating new shift entry for member {member.id}, group {group.id}, date {shift_in.date}, type {shift_in.shift_type}, slot {shift_in.slot_index}")
    db_shift = Shift(
        member_id=member.id, 
        group_id=group.id,   
        date=shift_in.date,
        shift_type=shift_in.shift_type,
        slot_index=shift_in.slot_index
    )
    
    db.add(db_shift)
    try:
        # Коммит применит и удаление старых (если были), и добавление новой смены
        await db.commit()
        logger.info(f"[Create Shift] Shift committed for member {member.id} in group {group.id} ({shift_in.group_telegram_id}) on {shift_in.date}")
        # Обновляем ID и timestamp для созданной смены
        await db.refresh(db_shift, attribute_names=['id', 'created_at', 'updated_at'])
        
        # --- Отправка NOTIFY после успешного коммита --- >
        try:
            # Загружаем связанного Member для ответа И ДЛЯ NOTIFY
            stmt = select(Shift).options(joinedload(Shift.member)).where(Shift.id == db_shift.id)
            result = await db.execute(stmt)
            created_shift_with_member: Shift | None = result.scalar_one_or_none()

            if created_shift_with_member:
                # ===> ИСПРАВЛЕНИЕ: Сначала конвертируем в Pydantic схему <===
                try:
                    # Используем ShiftRead.model_validate для Pydantic v2
                    # Явно указываем, что нужно валидировать из атрибутов объекта
                    pydantic_shift = ShiftRead.model_validate(created_shift_with_member, from_attributes=True)
                    # Теперь дампим Pydantic модель в словарь, СРАЗУ в JSON-совместимые типы
                    shift_data_dict = pydantic_shift.model_dump(exclude_none=True, mode='json')
                except Exception as pydantic_error:
                     logger.error(f"[Create Shift] Error converting SQLAlchemy Shift to Pydantic ShiftRead: {pydantic_error}", exc_info=True)
                     # Если конвертация не удалась, не сможем отправить полные данные
                     shift_data_dict = None # Или можно попытаться отправить только ID

                # Только если успешно получили словарь, отправляем NOTIFY
                if shift_data_dict:
                    # Формируем payload для NOTIFY
                    notify_payload_dict = {
                        "type": "shifts_updated",
                        "chat_id": str(shift_in.group_telegram_id),
                        "source": "shift_creation",
                        # Вкладываем полные данные смены (уже словарь)
                        "shift_data": shift_data_dict
                    }
                    notify_payload_json = json.dumps(notify_payload_dict)

                    # Проверяем размер payload (PostgreSQL имеет лимит ~8000 байт)
                    if len(notify_payload_json.encode('utf-8')) < 7900: # Оставляем запас
                        # Экранируем одинарные кавычки внутри JSON для безопасной вставки в SQL
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
            # Логируем ошибку NOTIFY, но не прерываем основной ответ
            logger.error(f"[Create Shift] Failed to send NOTIFY for chat_id {shift_in.group_telegram_id}: {notify_err}", exc_info=True)
        # --- Конец блока NOTIFY ---

        # Возвращаем созданный объект (он уже загружен)
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
    shift_id: UUID, # Получаем ID смены из пути
    # chat_id: Optional[int] = Query(None, description="Optional Telegram ID of the group for permission check"), # Опционально, если нужна проверка по чату
    db: AsyncSession = Depends(get_db_session)
):
    """Удаляет смену по её UUID."""
    
    logger.info(f"[Delete Shift] Attempting to delete shift with ID: {shift_id}")
    
    # Находим смену по ID И СРАЗУ ЗАГРУЖАЕМ ГРУППУ
    stmt = (
        select(Shift)
        .options(joinedload(Shift.group)) # <<< Загружаем связанную группу
        .where(Shift.id == shift_id)
    )
    result = await db.execute(stmt)
    db_shift: Shift | None = result.scalar_one_or_none()
    
    if db_shift is None:
        logger.warning(f"[Delete Shift] Shift with ID {shift_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift with ID {shift_id} not found"
        )
        
    # TODO: Добавить проверку прав доступа?
    # Например, может ли текущий пользователь (если есть аутентификация) 
    # или пользователь из чата (если передан chat_id) удалять эту смену.
    # if chat_id:
    #     # Логика проверки...
    #     pass
        
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
                    "type": "shifts_updated", # Используем тот же тип, фронт разберется по отсутствию данных?
                    "chat_id": str(group_telegram_id_to_notify),
                    "source": "shift_deletion",
                    "shift_id": str(shift_id) # Отправляем ID удаленной смены
                    # Можно добавить userId, date и т.д., если нужно фронту
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