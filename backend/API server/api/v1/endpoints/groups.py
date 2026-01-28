from fastapi import APIRouter, Depends, Query, HTTPException, status, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
import os
import httpx
import json
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo 

# Используем абсолютные импорты от корня /app
from db.session import get_db_session
from models.group import Group
from schemas.group import GroupRead # Схема для ответа
from models.group_member import GroupMember 
from models.member import Member
from models.group_role_mapping import GroupRoleMapping
from models.company_role import CompanyRole
from models.role_feature_mapping import RoleFeatureMapping
from models.bot_feature import BotFeature
from models.shift import Shift
from schemas.bot_feature import BotFeatureResponse
from api.dependencies.auth import get_current_member 
from schemas.group_settings import GroupSettings, GroupSettingsUpdate
from models.shift_template import ShiftTemplate, ShiftTemplateDay
from schemas.shift_template import ShiftTemplateRead
import logging

# --- НОВЫЕ ИМПОРТЫ для /chats ---
from sqlalchemy import func, or_ # Для агрегации и условий
from sqlalchemy.orm import selectinload # Для эффективной загрузки связей
from schemas.user import UserSimple # Простая схема для админов
from pydantic import Field # Для описания полей
# --- -------------------------- ---

# --- НОВЫЕ СХЕМЫ для ответа /chats ---
class AdminInfo(UserSimple):
    is_senior_courier: Optional[bool] = None  # НОВОЕ: добавляем поле для старшего курьера

class MemberInfo(UserSimple):
    is_senior_courier: Optional[bool] = None  # НОВОЕ: добавляем поле для старшего курьера

class ChatWithAdmins(GroupRead):
    admins: List[AdminInfo] = Field(default_factory=list)
    members: List[MemberInfo] = Field(default_factory=list)
    # Добавляем недостающие поля, которые ожидает ChatItem на фронте
    chat_id: str # Убедимся, что это строка
    metadata: Optional[Dict[str, Any]] = None # Добавим метаданные




logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()

# Хелпер для вычисления статуса доступа
def calculate_access_status(settings_data: dict) -> dict:
    """Вычисляет accessStatus и nextOpeningDate на основе настроек группы."""
    tz = ZoneInfo(os.getenv("TIMEZONE", "Europe/Moscow"))
    now = datetime.now(tz)
    
    registration_day = settings_data.get('registrationStartDay')
    registration_hour = settings_data.get('registrationStartHour', 0)
    registration_minute = settings_data.get('registrationStartMinute', 0)
    is_blocked = settings_data.get('isAccessBlocked', False)
    
    # Вычисляем nextOpeningDate независимо от статуса блокировки
    if registration_day is not None:
        # Вычисляем следующую дату открытия
        target_weekday = (registration_day - 1) % 7
        current_weekday = now.weekday()
        
        if current_weekday == target_weekday:
            days_until_next = 0
            target_datetime = now.replace(hour=registration_hour, minute=registration_minute, second=0, microsecond=0)
            if now >= target_datetime:
                days_until_next = 7
        elif current_weekday < target_weekday:
            days_until_next = target_weekday - current_weekday
        else:
            days_until_next = 7 - (current_weekday - target_weekday)
        
        next_opening = now + timedelta(days=days_until_next)
        next_opening = next_opening.replace(hour=registration_hour, minute=registration_minute, second=0, microsecond=0)
        
        if next_opening <= now:
            next_opening += timedelta(days=7)
        
        settings_data['nextOpeningDate'] = next_opening.isoformat()
        
        # Определяем статус (учитываем блокировку)
        if is_blocked:
            settings_data['accessStatus'] = 'blocked'
        else:
            active_start = settings_data.get('activeStartDate')
            if active_start:
                try:
                    active_date = datetime.fromisoformat(active_start).replace(tzinfo=tz)
                    period_length = settings_data.get('periodLength', 7)
                    active_end = active_date + timedelta(days=period_length)
                    
                    if active_date <= now < active_end:
                        settings_data['accessStatus'] = 'active'
                    else:
                        settings_data['accessStatus'] = 'pending'
                except:
                    settings_data['accessStatus'] = 'pending'
            else:
                settings_data['accessStatus'] = 'pending'
    else:
        # Если нет registrationStartDay
        if is_blocked:
            settings_data['accessStatus'] = 'blocked'
        else:
            settings_data['accessStatus'] = 'active'
    
    logger.info(f"[calculate_access_status] Результат: accessStatus={settings_data.get('accessStatus')}, nextOpeningDate={settings_data.get('nextOpeningDate')}, isBlocked={is_blocked}")
    return settings_data


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

# --- ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ СПИСКА ЧАТОВ ПОЛЬЗОВАТЕЛЯ ---
@router.get(
    "/chats", 
    response_model=List[ChatWithAdmins],
    summary="Получить список чатов для пользователя",
    description="Возвращает список чатов/групп, в которых состоит пользователь, включая информацию об админах и участниках.",
    tags=["Chats"]
)
async def read_chats_for_user(
    user_id: int = Query(..., description="Telegram ID пользователя, для которого запрашивается список чатов"),
    group_type: Optional[str] = Query(None, description="Фильтр по типу группы (например, 'chef', 'courier')"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    ОСНОВНАЯ ФУНКЦИЯ: Получает список всех чатов/групп, в которых состоит указанный пользователь.
    
    АЛГОРИТМ РАБОТЫ:
    1. По Telegram user_id находит внутренний ID пользователя в таблице members
    2. Ищет все группы, где этот пользователь является участником
    3. Для каждой найденной группы загружает полную информацию об участниках
    4. Разделяет участников на админов и обычных участников
    5. Применяет специальную логику фильтрации в зависимости от типа группы
    6. Возвращает структурированный список с полной информацией о каждом чате
    
    ОСОБЕННОСТИ:
    - Использует эффективную загрузку связанных данных (selectinload)
    - Разная логика для курьерских и других типов групп
    - Возвращает пустой список если пользователь не найден (вместо ошибки 404)
    """
    logger.info(f"[read_chats_for_user] Запрос GET /chats для пользователя: {user_id}")

    # ШАГ 1: ПОИСК ВНУТРЕННЕГО ID ПОЛЬЗОВАТЕЛЯ В СИСТЕМЕ
    # Таблица Member содержит связку между Telegram user_id и внутренним ID системы
    # Нам нужен внутренний ID для поиска групп через таблицу связей group_members
    member_query = select(Member.id).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member_id = member_result.scalar_one_or_none()

    if not member_id:
        logger.warning(f"[read_chats_for_user] Пользователь с user_id={user_id} не найден в таблице members")
        # ВАЖНО: Возвращаем пустой список вместо ошибки 404, так как:
        # - Пользователь может существовать в Telegram, но еще не быть зарегистрированным в нашей системе
        # - Или быть зарегистрированным, но не состоять ни в одной группе
        # Это позволяет фронтенду корректно обработать ситуацию "нет доступных чатов"
        return []

    # ШАГ 2: ПОИСК ВСЕХ ГРУПП, ГДЕ ПОЛЬЗОВАТЕЛЬ ЯВЛЯЕТСЯ УЧАСТНИКОМ
    # Используем сложный запрос с JOIN и предзагрузкой связанных данных
    groups_query = (
        select(Group)
        .join(GroupMember, Group.id == GroupMember.group_id)  # JOIN с таблицей связей группа-участник
        .where(GroupMember.member_id == member_id)            # Фильтр: только группы где состоит наш пользователь
        .options(
            # КРИТИЧЕСКИ ВАЖНО: предзагружаем всех участников группы и их данные из таблицы members
            # selectinload делает это эффективно одним дополнительным запросом вместо N+1 запросов
            # Group.members -> GroupMember -> GroupMember.member -> Member
            selectinload(Group.members).selectinload(GroupMember.member)
        )
        .order_by(Group.title)  # Сортируем группы по названию для консистентности вывода
    )

    # ШАГ 3: ПРИМЕНЕНИЕ ФИЛЬТРА ПО ТИПУ ГРУППЫ (ОПЦИОНАЛЬНО)
    # Если клиент запросил только определенный тип групп (например, только курьерские)
    if group_type:
        groups_query = groups_query.where(Group.group_type == group_type)
        logger.info(f"[read_chats_for_user] Применен фильтр по типу группы: {group_type}")

    # Выполняем запрос к базе данных
    result = await db.execute(groups_query)
    # unique() критически важен для устранения дубликатов, которые могут возникнуть из-за JOIN
    groups = result.unique().scalars().all()

    logger.info(f"[read_chats_for_user] Найдено групп в БД (user_id={user_id}, тип={group_type}): {[g.group_id for g in groups]}")

    # ШАГ 4: ОБРАБОТКА КАЖДОЙ ГРУППЫ И ФОРМИРОВАНИЕ СТРУКТУРИРОВАННОГО ОТВЕТА
    response_list: List[ChatWithAdmins] = []
    
    for group in groups:
        # Создаем отдельные списки для разных типов участников
        admins_list: List[AdminInfo] = []       # Администраторы и создатели группы
        members_list: List[MemberInfo] = []     # Обычные участники (с особой логикой для разных типов групп)
        
        # Обрабатываем всех участников текущей группы
        # Данные уже предзагружены благодаря selectinload, поэтому никаких дополнительных запросов к БД не будет
        if group.members:
            for group_member in group.members:
                # Проверяем что связанные данные пользователя действительно загружены
                if group_member.member:
                    # Формируем базовый словарь с данными участника для создания Pydantic моделей
                    member_data = {
                        "id": group_member.member.id,                    # Внутренний ID в системе
                        "user_id": group_member.member.user_id,          # Telegram ID пользователя
                        "first_name": group_member.member.first_name,    # Имя
                        "last_name": group_member.member.last_name,      # Фамилия
                        "username": group_member.member.username,        # Username в Telegram
                        "photo_url": group_member.member.photo_url,      # URL фотографии профиля
                        "is_senior_courier": group_member.is_senior_courier  # НОВОЕ: статус старшего курьера
                    }
                    
                    # КЛАССИФИКАЦИЯ УЧАСТНИКОВ ПО РОЛЯМ:
                    if group_member.role in ['administrator', 'creator']:
                        # Администраторы и создатели всегда попадают в список админов
                        admins_list.append(AdminInfo(**member_data))
                    
                    # СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ РАЗНЫХ ТИПОВ ГРУПП:
                    elif (group.group_type == 'courier' and group_member.role in ['member', 'courier']) or \
                         (group.group_type != 'courier' and group_member.role not in ['administrator', 'creator']):
                        # ДЛЯ КУРЬЕРСКИХ ГРУПП: добавляем в список участников только тех, кто имеет роль 'member' или 'courier'
                        # ДЛЯ ОСТАЛЬНЫХ ТИПОВ ГРУПП: добавляем всех, кто не является администратором или создателем
                        # Это позволяет фронтенду показывать разные списки людей для разных типов операций
                        members_list.append(MemberInfo(**member_data))
        
        # ШАГ 5: СОЗДАНИЕ ОБЪЕКТА ОТВЕТА ДЛЯ ТЕКУЩЕЙ ГРУППЫ
        # Собираем всю информацию о группе в единый объект ответа
        chat_response = ChatWithAdmins(
            id=group.id,                                    # Внутренний ID группы в БД
            chat_id=str(group.group_id),                   # Telegram ID группы (конвертируем в строку для фронтенда)
            title=group.title,                             # Название группы/чата
            group_type=group.group_type,                   # Тип группы (courier, chef, general, etc.)
            created_at=group.created_at,                   # Дата создания группы в системе
            admins=admins_list,                            # Список всех администраторов
            members=members_list,                          # Список участников (с учетом типа группы)
            metadata=group.json_metadata,                  # Дополнительные метаданные группы
            slot_config=group.slot_config,                 # Конфигурация слотов для планирования смен
            access_settings=group.access_settings          # Настройки доступа к функциям группы
        )
        response_list.append(chat_response)

    # ШАГ 6: ФИНАЛЬНОЕ ЛОГИРОВАНИЕ И ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
    logger.info(f"[read_chats_for_user] Итого сформировано чатов для пользователя {user_id}: {len(response_list)}")
    
    # Выводим детальную информацию о каждом чате для помощи в отладке
    for chat in response_list:
        logger.info(f"[read_chats_for_user] Чат '{chat.title}' (ID: {chat.chat_id}, тип: {chat.group_type}): "
                   f"{len(chat.admins)} админов, {len(chat.members)} участников")
    
    return response_list



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

    # Проверяем есть ли конфликтные смены и автоматически устанавливаем блокировку
    active_start_str = settings_data.get('activeStartDate')
    offset_amount = settings_data.get('offsetAmount', 0)
    period_length = settings_data.get('periodLength', 7)
    
    if active_start_str:
        try:
            from datetime import date
            active_start_date = datetime.fromisoformat(active_start_str).date()
            
            # Вычисляем период смен
            new_period_start = active_start_date + timedelta(days=offset_amount)
            new_period_end = new_period_start + timedelta(days=period_length)
            
            # Считаем смены в будущем, которые НЕ попадают в период
            today = date.today()
            conflicting_shifts_query = select(func.count(Shift.id)).where(
                Shift.group_id == db_group.id,
                Shift.date > today,
                or_(
                    Shift.date < new_period_start,
                    Shift.date >= new_period_end
                )
            )
            result = await db.execute(conflicting_shifts_query)
            conflicting_shifts_count = result.scalar() or 0
            
            if conflicting_shifts_count > 0:
                # Есть конфликтные смены - автоматически блокируем доступ
                settings_data['isAccessBlocked'] = True
                settings_data['hasExistingShifts'] = True
                settings_data['existingShiftsCount'] = conflicting_shifts_count
                logger.info(f"[read_group_settings] ⚠️ Обнаружено {conflicting_shifts_count} конфликтных смен, автоматически установлен isAccessBlocked=True")
            else:
                # Нет конфликтов - снимаем блокировку если она была установлена ранее
                if settings_data.get('isAccessBlocked') and not settings_data.get('transitionStrategy') == 'hard':
                    settings_data['isAccessBlocked'] = False
                    logger.info(f"[read_group_settings] ✅ Конфликтов нет, снята блокировка доступа")
        except Exception as e:
            logger.error(f"[read_group_settings] Ошибка при проверке конфликтных смен: {e}")

    # Вычисляем статус доступа
    settings_data = calculate_access_status(settings_data)

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
    
    # Получаем текущие настройки из БД для сравнения
    current_settings = db_group.access_settings or {}
    
    # Определяем нужно ли пересчитать activeStartDate
    should_recalculate_active_start = False
    
    # Флаг и счетчик для существующих смен
    has_existing_shifts = False
    existing_shifts_count = 0
    
    # Случай 1: registrationStartDay изменился
    if 'registrationStartDay' in update_data:
        new_day = update_data['registrationStartDay']
        old_day = current_settings.get('registrationStartDay')
        if new_day != old_day:
            logger.info(f"[update_group_settings] День регистрации изменился: {old_day} → {new_day}")
            should_recalculate_active_start = True
            
            # НЕ проверяем смены при изменении дня регистрации
            # Проверку конфликтов делаем после вычисления нового периода
            pass
    
    # Случай 2: activeStartDate отсутствует
    if update_data.get('activeStartDate') is None or current_settings.get('activeStartDate') is None:
        logger.info(f"[update_group_settings] activeStartDate отсутствует")
        should_recalculate_active_start = True
    
    # Случай 3: activeStartDate не совпадает с registrationStartDay (день недели)
    if not should_recalculate_active_start and update_data.get('activeStartDate'):
        try:
            active_start_date = datetime.fromisoformat(update_data['activeStartDate'])
            active_start_weekday = active_start_date.weekday()  # Python формат (0=Пн)
            
            registration_day = update_data.get('registrationStartDay') or current_settings.get('registrationStartDay')
            if registration_day is not None:
                target_weekday = (registration_day - 1) % 7  # JS → Python
                
                if active_start_weekday != target_weekday:
                    logger.info(f"[update_group_settings] День недели activeStartDate ({active_start_weekday}) не совпадает с registrationStartDay ({target_weekday}). Пересчитываем.")
                    should_recalculate_active_start = True
        except:
            logger.warning(f"[update_group_settings] Ошибка парсинга activeStartDate, пересчитываем.")
            should_recalculate_active_start = True
    
    # Пересчитываем activeStartDate если нужно
    if should_recalculate_active_start:
        # Берём параметры регистрации из update_data (приоритет) или из БД
        registration_start_day = update_data.get('registrationStartDay') or current_settings.get('registrationStartDay')
        registration_hour = update_data.get('registrationStartHour') or current_settings.get('registrationStartHour', 0)
        registration_minute = update_data.get('registrationStartMinute') or current_settings.get('registrationStartMinute', 0)
        period_length = update_data.get('periodLength') or current_settings.get('periodLength', 7)
        
        logger.info(f"[update_group_settings] 🔍 Параметры для пересчёта: registrationDay={registration_start_day}, hour={registration_hour}, minute={registration_minute}, periodLength={period_length}")
        
        if registration_start_day is not None:
            # Конвертируем из JS формата (0=Вс, 1=Пн, ...) в Python (0=Пн, 1=Вт, ...)
            target_weekday = (registration_start_day - 1) % 7
            
            # Используем timezone-aware datetime для корректной работы
            tz = ZoneInfo(os.getenv("TIMEZONE", "Europe/Moscow"))
            now = datetime.now(tz)
            current_weekday = now.weekday()
            
            logger.info(f"[update_group_settings] 🌍 Timezone: {tz}, Сейчас: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            
            # Шаг 1: Находим целевой день в ТЕКУЩЕЙ неделе
            if current_weekday == target_weekday:
                # Сегодня - целевой день
                days_to_target = 0
            elif current_weekday < target_weekday:
                # Целевой день будет в этой неделе (вперёд)
                days_to_target = target_weekday - current_weekday
            else:
                # Целевой день был в этой неделе (назад)
                days_to_target = -(current_weekday - target_weekday)
            
            target_date_this_week = now + timedelta(days=days_to_target)
            target_datetime_this_week = target_date_this_week.replace(
                hour=registration_hour, 
                minute=registration_minute, 
                second=0, 
                microsecond=0
            )
            
            # Шаг 2: Проверяем прошло ли время регистрации
            logger.info(f"[update_group_settings] 🕐 Сейчас: {now.isoformat()}")
            logger.info(f"[update_group_settings] 🎯 Целевое время: {target_datetime_this_week.isoformat()}")
            
            if now >= target_datetime_this_week:
                # Время УЖЕ ПРОШЛО в текущей неделе → используем эту дату
                active_start = target_date_this_week.date()
                logger.info(f"[update_group_settings] ✅ Время регистрации уже прошло в текущей неделе. activeStartDate = {active_start.isoformat()}")
            else:
                # Время ЕЩЁ НЕ НАСТУПИЛО → отматываем на periodLength
                active_start_datetime = target_datetime_this_week - timedelta(days=period_length)
                active_start = active_start_datetime.date()
                logger.info(f"[update_group_settings] ⏪ Время регистрации ещё не наступило. Отматываем: {target_date_this_week.date()} - {period_length} дней = {active_start.isoformat()}")
            
            update_data['activeStartDate'] = active_start.isoformat()
            logger.info(f"[update_group_settings] ✅ Автоматически установлен activeStartDate = {active_start.isoformat()} (день недели Python: {target_weekday}, JS: {registration_start_day})")
    
    # Проверяем конфликтные смены ПОСЛЕ вычисления нового периода
    if 'registrationStartDay' in update_data and update_data.get('registrationStartDay') != current_settings.get('registrationStartDay'):
        # Вычисляем период смен на основе НОВЫХ настроек
        active_start_str = update_data.get('activeStartDate')
        offset_amount = update_data.get('offsetAmount') or current_settings.get('offsetAmount', 0)
        period_length = update_data.get('periodLength') or current_settings.get('periodLength', 7)
        
        if active_start_str:
            try:
                from datetime import date
                active_start_date = datetime.fromisoformat(active_start_str).date()
                
                # Вычисляем начало и конец НОВОГО периода смен
                new_period_start = active_start_date + timedelta(days=offset_amount)
                new_period_end = new_period_start + timedelta(days=period_length)
                
                logger.info(f"[update_group_settings] 📅 Новый период смен: {new_period_start.isoformat()} - {new_period_end.isoformat()}")
                
                # Считаем смены в будущем, которые НЕ попадают в новый период
                today = date.today()
                conflicting_shifts_query = select(func.count(Shift.id)).where(
                    Shift.group_id == db_group.id,
                    Shift.date > today,
                    or_(
                        Shift.date < new_period_start,
                        Shift.date >= new_period_end
                    )
                )
                result = await db.execute(conflicting_shifts_query)
                existing_shifts_count = result.scalar() or 0
                
                if existing_shifts_count > 0:
                    has_existing_shifts = True
                    logger.warning(f"[update_group_settings] ⚠️ Обнаружено {existing_shifts_count} конфликтных смен вне нового периода [{new_period_start} - {new_period_end})!")
                else:
                    logger.info(f"[update_group_settings] ✅ Все будущие смены попадают в новый период, конфликтов нет")
            except Exception as e:
                logger.error(f"[update_group_settings] Ошибка при проверке конфликтных смен: {e}")
    
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
    
    # Добавляем информацию о существующих сменах, если день регистрации изменился
    if has_existing_shifts:
        response_data['hasExistingShifts'] = True
        response_data['existingShiftsCount'] = existing_shifts_count
        logger.info(f"[update_group_settings] ⚠️ В ответ добавлена информация о {existing_shifts_count} существующих сменах")
    
    # Вычисляем статус доступа и дату следующего открытия
    response_data = calculate_access_status(response_data)
    
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

from pydantic import BaseModel


class DaySlotConfig(BaseModel):
    maxDaySlots: int
    maxNightSlots: int
    hasSeniorSlot: Optional[bool] = False
    # Время начала и конца дневной смены
    dayShiftStartTime: Optional[str] = "10:00"  # формат "HH:mm"
    dayShiftEndTime: Optional[str] = "23:40"    # формат "HH:mm"
    # Время начала и конца ночной смены
    nightShiftStartTime: Optional[str] = "17:00"  # формат "HH:mm"
    nightShiftEndTime: Optional[str] = "23:40"    # формат "HH:mm"
    # Шаблоны смен для этого дня недели
    shiftTemplates: Optional[List[Dict[str, Any]]] = None

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
    Теперь также включает примененные шаблоны смен для каждого дня недели.
    """
    logger.info(f"[get_slot_config] GET /groups/{group_telegram_id}/slot_config")
    db_group = await get_group_by_telegram_id(db, group_telegram_id)
    if not db_group:
        logger.warning(f"[get_slot_config] Group {group_telegram_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Получаем базовую конфигурацию слотов
    slot_config_data = db_group.slot_config or {}
    
    # Загружаем шаблоны смен для каждого дня недели
    templates_by_day = {}
    for day_index in range(7):  # 0-6 (понедельник-воскресенье)
        try:
            # Получаем шаблоны для конкретного дня недели
            templates_result = await db.execute(
                select(ShiftTemplate)
                .join(ShiftTemplateDay)
                .where(
                    ShiftTemplateDay.group_id == db_group.id,
                    ShiftTemplateDay.day_of_week == day_index
                )
            )
            templates = templates_result.scalars().all()
            
            # Преобразуем шаблоны в словари для JSON сериализации
            templates_dict = []
            for template in templates:
                template_dict = {
                    "id": str(template.id),
                    "name": template.name,
                    "description": template.description,
                    "startTime": template.start_time.isoformat(),
                    "endTime": template.end_time.isoformat(),
                    "maxSlots": template.max_slots,
                    "hasSeniorSlot": template.has_senior_slot,
                    "isActive": True,
                    "createdAt": template.created_at.isoformat(),
                    "updatedAt": template.updated_at.isoformat()
                }
                templates_dict.append(template_dict)
            
            templates_by_day[str(day_index)] = templates_dict
        except Exception as e:
            logger.error(f"[get_slot_config] Error loading templates for day {day_index}: {str(e)}")
            templates_by_day[str(day_index)] = []
    
    # Объединяем конфигурацию слотов с шаблонами
    enhanced_config = {}
    for day_index in range(7):
        day_key = str(day_index)
        day_config = slot_config_data.get(day_key, {})
        
        # Добавляем шаблоны к конфигурации дня
        enhanced_config[day_key] = {
            **day_config,
            "shiftTemplates": templates_by_day.get(day_key, [])
        }
    
    logger.info(f"[get_slot_config] Returning enhanced slot config for group {group_telegram_id}")
    return SlotConfigResponse(config=enhanced_config)

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
    description="Retrieves a list of all couriers in the specified courier group.",
    tags=["Groups", "Couriers"]
)
async def get_group_couriers(
    group_telegram_id: int = Path(..., description="Telegram ID of the group"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список всех курьеров в курьерской группе.
    Доступно для всех участников группы.
    """
    logger.info(f"[get_group_couriers] GET /groups/{group_telegram_id}/couriers")
    
    # Находим группу по telegram_id
    group = await get_group_by_telegram_id(db, group_telegram_id)
    if not group:
        logger.warning(f"[get_group_couriers] Группа {group_telegram_id} не найдена")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    
    # Проверяем, что это курьерская группа
    if group.group_type != 'courier':
        logger.warning(f"[get_group_couriers] Группа {group_telegram_id} не является курьерской (тип: {group.group_type})")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This endpoint is only available for courier groups")
    
    # Получаем всех участников группы
    # Создаем JOIN запрос, чтобы получить данные из GroupMember и Member одновременно
    couriers_query = (
        select(GroupMember, Member)
        .join(Member, GroupMember.member_id == Member.id)
        .where(GroupMember.group_id == group.id)
        .order_by(Member.first_name, Member.last_name)
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


@router.get(
    "/{group_id}/features",
    response_model=List[BotFeatureResponse],
    summary="Get Group Features",
    description="Получает список доступных функций для указанной группы. Доступно только для участников группы.",
    tags=["Groups", "Features"]
)
async def get_group_features_public(
    group_id: int = Path(..., description="Telegram Group ID"),
    current_member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Получает список доступных функций для указанной группы.
    Функции определяются через: Group → GroupRoleMapping → CompanyRole → RoleFeatureMapping → BotFeature
    
    Доступно только для участников группы.
    """
    # Проверяем существование группы
    stmt = select(Group).where(Group.group_id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID {group_id} not found",
        )
    
    # Проверяем, что текущий пользователь состоит в этой группе
    member_group_stmt = (
        select(GroupMember)
        .where(GroupMember.group_id == group.id)
        .where(GroupMember.member_id == current_member.id)
    )
    member_group_result = await db.execute(member_group_stmt)
    member_group = member_group_result.scalar_one_or_none()
    
    if not member_group:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group",
        )
    
    # Получаем привязку группы к роли
    stmt = select(GroupRoleMapping).where(GroupRoleMapping.group_id == group_id)
    result = await db.execute(stmt)
    group_mapping = result.scalar_one_or_none()
    
    if not group_mapping:
        # Группа не привязана к роли - возвращаем пустой список
        return []
    
    # Получаем информацию о роли
    stmt = select(CompanyRole).where(CompanyRole.id == group_mapping.company_role_id)
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    
    # Получаем функции роли (только включенные)
    stmt = (
        select(BotFeature)
        .join(RoleFeatureMapping, RoleFeatureMapping.bot_feature_id == BotFeature.id)
        .where(
            RoleFeatureMapping.company_role_id == role.id,
            RoleFeatureMapping.is_enabled == True,
            BotFeature.is_active == True
        )
    )
    result = await db.execute(stmt)
    features = result.scalars().all()
    
    return [
        BotFeatureResponse(
            id=feature.id,
            feature_code=feature.feature_code,
            feature_name=feature.feature_name,
            description=feature.description,
            icon=feature.icon,
            is_active=feature.is_active,
            created_at=feature.created_at.isoformat() if feature.created_at else "",
            updated_at=feature.updated_at.isoformat() if feature.updated_at else "",
        )
        for feature in features
    ]