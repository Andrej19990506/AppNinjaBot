from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from datetime import date, datetime
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
import json
import logging
from fastapi import status

from db.session import get_db_session
import crud
import schemas
from models.reserve import Reserve
from models.group import Group
from models.member import Member
from models.group_member import GroupMember

# Настроим логгер (или убедимся, что он настроен глобально)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("", response_model=schemas.ReserveRead, status_code=201)
async def add_to_reserve(
    reserve_in: schemas.ReserveCreate,
    db: AsyncSession = Depends(get_db_session),
):
    """Добавляет пользователя в резерв на указанную дату."""
    # TODO: Добавить проверку прав доступа (например, только админ или сам пользователь)
    
    print(f"DEBUG: Создание резерва с данными: user_telegram_id={reserve_in.user_telegram_id}, group_telegram_id={reserve_in.group_telegram_id}, date={reserve_in.reserve_date}, type={type(reserve_in.reserve_date)}")
    
    # <<< НАЧАЛО ЯВНОЙ ПРОВЕРКИ И КОНВЕРТАЦИИ ДАТЫ >>>
    reserve_date_obj: date
    if isinstance(reserve_in.reserve_date, str):
        try:
            # Пробуем преобразовать строку в дату
            reserve_date_obj = datetime.strptime(reserve_in.reserve_date, '%Y-%m-%d').date()
            print(f"DEBUG: Дата была строкой, преобразована в {type(reserve_date_obj)}")
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")
    elif isinstance(reserve_in.reserve_date, date):
        # Если это уже объект date, просто используем его
        reserve_date_obj = reserve_in.reserve_date
        print(f"DEBUG: Дата уже имеет тип {type(reserve_date_obj)}")
    else:
        # Если тип неожиданный, выбрасываем ошибку
        raise HTTPException(status_code=422, detail=f"Unexpected type for date: {type(reserve_in.reserve_date)}")
    # <<< КОНЕЦ ЯВНОЙ ПРОВЕРКИ И КОНВЕРТАЦИИ ДАТЫ >>>

    # Проверяем, нет ли уже резерва у пользователя на эту дату
    # --- ДОБАВЛЯЕМ ЛОГИРОВАНИЕ ПЕРЕД ВЫЗОВОМ CRUD ---
    logger.info(f"Вызов check_existing_reserve с user_telegram_id={reserve_in.user_telegram_id}, group_telegram_id={reserve_in.group_telegram_id}, reserve_date={reserve_date_obj} (тип: {type(reserve_date_obj)})")
    # --- КОНЕЦ ЛОГИРОВАНИЯ ---
    existing_reserve = await crud.reserve.check_existing_reserve(
        db=db, 
        user_telegram_id=reserve_in.user_telegram_id,
        group_telegram_id=reserve_in.group_telegram_id,
        reserve_date=reserve_date_obj
    )
    
    if existing_reserve:
        print(f"DEBUG: Резерв уже существует с ID: {existing_reserve.id}")
        raise HTTPException(
            status_code=409, 
            detail="User is already in reserve for this date and group."
        )
    
    # Создаем новый резерв если существующего нет
    db_reserve = await crud.reserve.create_reserve(db=db, reserve_in=reserve_in)
    
    if db_reserve is None:
        print(f"DEBUG: Ошибка создания резерва - пользователь или группа не найдены")
        # Либо пользователь не найден, либо другая ошибка при создании
        raise HTTPException(
            status_code=404, 
            detail=f"User with telegram_id {reserve_in.user_telegram_id} not found or reserve creation failed."
        )
        
    print(f"DEBUG: Резерв создан с ID: {db_reserve.id}, member_id: {db_reserve.member_id}, group_id: {db_reserve.group_id}")
    print(f"DEBUG: Member загружен: {hasattr(db_reserve, 'member') and db_reserve.member is not None}")
    print(f"DEBUG: Group загружен: {hasattr(db_reserve, 'group') and db_reserve.group is not None}")
    
    # Проверяем, есть ли связанный пользователь (на всякий случай)
    if not hasattr(db_reserve, 'member') or not db_reserve.member:
         # Если member не загрузился, попробуем перезагрузить весь объект Reserve
         await db.refresh(db_reserve)
         await db.refresh(db_reserve.member)
         if not db_reserve.member:
              raise HTTPException(
                  status_code=500, 
                  detail="Failed to load member data for the created reserve."
              )
              
    # Проверка перед созданием схемы ReserveRead
    if not all([db_reserve.member.id, db_reserve.member.user_id]):
         raise HTTPException(
            status_code=500, 
            detail="Member data is incomplete for the created reserve."
         )
         
    # --- Отправка NOTIFY после создания --- >
    try:
        # Важно! Загружаем связанные данные ПЕРЕД отправкой уведомления,
        # чтобы в payload были полные данные, если схема их требует
        await db.refresh(db_reserve, attribute_names=['member', 'group'])
        
        # Преобразуем созданный объект в Pydantic схему ReserveRead
        # Это гарантирует правильный формат данных для JSON
        reserve_read_schema = schemas.ReserveRead.model_validate(db_reserve)
        # Преобразуем Pydantic модель в словарь
        reserve_data_dict = reserve_read_schema.model_dump(mode='json')
        
        notify_payload = json.dumps({
            "type": "reserve_added",
            # Передаем ТЕЛЕГРАМ ID группы
            "chat_id": str(reserve_in.group_telegram_id),
            "data": reserve_data_dict # Отправляем полные данные резерва
        })
        
        sql_command = text(f"NOTIFY websocket_channel, '{notify_payload}'")
        await db.execute(sql_command)
        
        # Коммит НЕ нужен после NOTIFY
        logger.info(f"Sent NOTIFY websocket_channel for reserve_added, chat_id {reserve_in.group_telegram_id}")
    except Exception as notify_err:
        # Логируем ошибку NOTIFY, но не прерываем основной ответ
        logger.error(f"Failed to send NOTIFY for reserve_added, chat_id {reserve_in.group_telegram_id}: {notify_err}", exc_info=True)
    # --- Конец блока NOTIFY ---
    
    return db_reserve

@router.get("", response_model=List[schemas.ReserveRead])
async def read_reserves(
    group_telegram_id: int = Query(..., description="Telegram ID группы для фильтрации резервов"),
    reserve_date: date = Query(None, description="Дата для фильтрации резервов (YYYY-MM-DD), если не указана - вернутся все резервы группы"),
    db: AsyncSession = Depends(get_db_session),
):
    """Получает список резервов для указанной группы, опционально фильтруя по дате."""
    # TODO: Добавить проверку прав доступа
    
    # Находим внутренний ID группы по Telegram ID
    group_result = await db.execute(select(Group.id).where(Group.group_id == group_telegram_id))
    group_id = group_result.scalar_one_or_none()
    
    if group_id is None:
        # Если группа не найдена, возвращаем пустой список
        print(f"DEBUG: Группа с Telegram ID {group_telegram_id} не найдена, возвращаем []")
        return []
    
    # Базовый запрос
    query = (
        select(Reserve)
        .where(Reserve.group_id == group_id)
        .options(
            selectinload(Reserve.member),
            selectinload(Reserve.group)
        )
    )
    
    # Если указана дата, добавляем фильтр по дате
    if reserve_date:
        print(f"DEBUG: Фильтруем резервы по дате {reserve_date}")
        query = query.where(Reserve.date == reserve_date)
    
    result = await db.execute(query.order_by(Reserve.date, Reserve.created_at))
    reserves = result.scalars().all()
    
    # Логирование для отладки
    print(f"DEBUG: Получено резервов: {len(reserves)}")
    for idx, reserve in enumerate(reserves):
        print(f"DEBUG: Резерв #{idx+1}:")
        print(f"  - ID: {reserve.id}")
        print(f"  - Date: {reserve.date}")
        print(f"  - Member ID: {reserve.member_id}")
        print(f"  - Group ID: {reserve.group_id}")
        print(f"  - Member loaded: {reserve.member is not None}")
        print(f"  - Group loaded: {reserve.group is not None}")
        if reserve.member:
            print(f"  - Member User ID: {reserve.member.user_id}")
            print(f"  - Member Name: {reserve.member.first_name} {reserve.member.last_name}")
        if reserve.group:
            print(f"  - Group Telegram ID: {reserve.group.group_id}")
            print(f"  - Group Title: {reserve.group.title}")
    
    return reserves

@router.get("/all", response_model=List[schemas.ReserveRead])
async def read_all_reserves(
    db: AsyncSession = Depends(get_db_session),
):
    """Получает список всех резервов в системе (только для отладки)."""
    result = await db.execute(
        select(Reserve)
        .options(
            selectinload(Reserve.member),
            selectinload(Reserve.group)
        )
        .order_by(Reserve.date, Reserve.created_at)
    )
    reserves = result.scalars().all()
    
    print(f"DEBUG: Получено всех резервов: {len(reserves)}")
    
    return reserves

@router.delete("/{reserve_id}", response_model=schemas.ReserveRead)
async def remove_from_reserve(
    reserve_id: UUID,
    requester_telegram_id: int = Query(..., description="Telegram ID of the user attempting the action (Sent by Frontend)"),
    db: AsyncSession = Depends(get_db_session),
):
    """Удаляет пользователя из резерва по ID записи резерва. Проверяет права старшего курьера."""
    
    logger.info(f"[Remove Reserve] Attempt by user {requester_telegram_id} to delete reserve {reserve_id}")
    
    # Находим резерв для удаления и связанные данные
    reserve_to_delete = await crud.reserve.get_reserve(db=db, reserve_id=reserve_id)
    if reserve_to_delete is None:
        logger.warning(f"[Remove Reserve] Reserve entry {reserve_id} not found.")
        raise HTTPException(status_code=404, detail="Reserve entry not found")

    # Убедимся, что группа загружена для проверки прав и для WebSocket
    if not hasattr(reserve_to_delete, 'group') or not reserve_to_delete.group:
         await db.refresh(reserve_to_delete, attribute_names=['group']) 
         if not reserve_to_delete.group:
              logger.error(f"[Remove Reserve] Не удалось загрузить группу для резерва {reserve_id} перед проверкой прав/удалением.")
              raise HTTPException(status_code=500, detail="Failed to load group data for the reserve.")
              
    target_group = reserve_to_delete.group
    group_telegram_id_for_event = str(target_group.group_id)
    deleted_reserve_id = str(reserve_to_delete.id) # Сохраняем ID для WebSocket
    
    # <<< НАЧАЛО: ПРОВЕРКА ПРАВ СТАРШЕГО КУРЬЕРА >>>
    # Находим пользователя по ID, присланному фронтом
    requester_member_result = await db.execute(
        select(Member).where(Member.user_id == requester_telegram_id)
    )
    requester_member: Member | None = requester_member_result.scalar_one_or_none()

    if requester_member is None:
        logger.warning(f"[Remove Reserve] Requester member {requester_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provided requester ID not found.")

    # Находим запись GroupMember для этого пользователя в группе этого резерва
    requester_gm_result = await db.execute(
        select(GroupMember).where(
            (GroupMember.member_id == requester_member.id) &
            (GroupMember.group_id == target_group.id) # Используем ID группы из резерва
        )
    )
    requester_gm: GroupMember | None = requester_gm_result.scalar_one_or_none()

    # Проверяем, является ли пользователь с ID из запроса старшим курьером
    if not requester_gm or not requester_gm.is_senior_courier:
        logger.warning(f"[Remove Reserve] User {requester_telegram_id} is NOT a senior courier in group {target_group.group_id}. Access denied for deleting reserve {reserve_id}.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action requires senior courier permissions."
        )
    
    logger.info(f"[Remove Reserve] User {requester_telegram_id} IS a senior courier in group {target_group.group_id}. Permissions granted.")
    # <<< КОНЕЦ: ПРОВЕРКА ПРАВ >>>

    # Теперь удаляем резерв
    await db.delete(reserve_to_delete)
    await db.commit() # Коммитим удаление
    logger.info(f"[Remove Reserve] Successfully deleted reserve {reserve_id}")

    # --- Отправка NOTIFY после удаления --- >
    if group_telegram_id_for_event:
        try:
            notify_payload = json.dumps({
                "type": "reserve_removed",
                "chat_id": group_telegram_id_for_event,
                "data": { 
                    "id": deleted_reserve_id
                }
            })
            
            sql_command = text(f"NOTIFY websocket_channel, '{notify_payload}'")
            await db.execute(sql_command)
            
            logger.info(f"Sent NOTIFY websocket_channel for reserve_removed, chat_id {group_telegram_id_for_event}, reserve_id {deleted_reserve_id}")
        except Exception as notify_err:
            logger.error(f"Failed to send NOTIFY for reserve_removed, chat_id {group_telegram_id_for_event}: {notify_err}", exc_info=True)
    else:
         logger.warning(f"Не отправлено WebSocket событие 'reserve_removed' для резерва {deleted_reserve_id}, так как не удалось определить chat_id.")
    # --- Конец блока NOTIFY ---   
     
    # Возвращаем данные удаленного резерва (для консистентности, хотя в DELETE часто возвращают 204)
    return reserve_to_delete 