"""
Утилиты для расчета периодов записи на смены
"""
from datetime import datetime, date, timedelta, time
from typing import Dict, Any, Optional
from zoneinfo import ZoneInfo


def calculate_next_period_start_date(access_settings: Dict[str, Any], current_date: Optional[date] = None) -> date:
    """
    Вычисляет дату начала следующего периода регистрации на основе настроек доступа.
    
    Args:
        access_settings: Словарь с настройками доступа (registrationStartDay, offsetAmount, periodLength, offsetType)
        current_date: Текущая дата (по умолчанию сегодня)
    
    Returns:
        Дата начала следующего периода регистрации
    """
    if current_date is None:
        current_date = date.today()
    
    # Получаем настройки
    registration_day = access_settings.get('registrationStartDay', 4)  # 0=Вс, 4=Чт
    registration_hour = access_settings.get('registrationStartHour', 12)
    registration_minute = access_settings.get('registrationStartMinute', 0)
    offset_type = access_settings.get('offsetType', 'weeks')
    offset_amount = access_settings.get('offsetAmount', 1)
    period_length = access_settings.get('periodLength', 7)
    
    # Конвертируем день регистрации в Python формат (0=Пн, 6=Вс)
    # В настройках: 0=Вс, 1=Пн, ..., 6=Сб
    # В Python: 0=Пн, 1=Вт, ..., 6=Вс
    python_start_day = (registration_day - 1 + 7) % 7
    
    # Текущее время в KRT (для расчета)
    KRT = ZoneInfo("Asia/Krasnoyarsk")
    now_krt = datetime.now(KRT)
    today_krt = now_krt.date()
    
    # Находим СЛЕДУЮЩИЙ день регистрации (не последний!)
    current_weekday_krt = today_krt.weekday()
    registration_time_naive = time(registration_hour, registration_minute)
    registration_datetime_krt_today = datetime.combine(today_krt, registration_time_naive, tzinfo=KRT)
    
    # Вычисляем количество дней до следующего дня регистрации
    if current_weekday_krt < python_start_day:
        days_until_next = python_start_day - current_weekday_krt
    elif current_weekday_krt > python_start_day:
        days_until_next = 7 - (current_weekday_krt - python_start_day)
    else:  # current_weekday_krt == python_start_day
        # Если сегодня день регистрации
        if now_krt >= registration_datetime_krt_today:
            # Время уже прошло - следующий день регистрации через неделю
            days_until_next = 7
        else:
            # Время еще не наступило - следующий день регистрации сегодня
            days_until_next = 0
    
    next_registration_day_date_krt = today_krt + timedelta(days=days_until_next)
    
    # Рассчитываем начало следующего периода от следующего дня регистрации
    if offset_type == 'weeks':
        start_of_registration_week = next_registration_day_date_krt - timedelta(days=next_registration_day_date_krt.weekday())
        start_of_booking_week = start_of_registration_week + timedelta(weeks=offset_amount)
    elif offset_type == 'days':
        start_of_booking_week = next_registration_day_date_krt + timedelta(days=offset_amount)
    else:  # 'none'
        start_of_registration_week = next_registration_day_date_krt - timedelta(days=next_registration_day_date_krt.weekday())
        start_of_booking_week = start_of_registration_week
    
    return start_of_booking_week


def calculate_current_period_dates(access_settings: Dict[str, Any], current_date: Optional[date] = None) -> tuple[date, date]:
    """
    Вычисляет даты текущего периода записи.
    
    Returns:
        Кортеж (start_date, end_date) текущего периода
    """
    if current_date is None:
        current_date = date.today()
    
    registration_day = access_settings.get('registrationStartDay', 4)
    registration_hour = access_settings.get('registrationStartHour', 12)
    registration_minute = access_settings.get('registrationStartMinute', 0)
    offset_type = access_settings.get('offsetType', 'weeks')
    offset_amount = access_settings.get('offsetAmount', 1)
    period_length = access_settings.get('periodLength', 7)
    
    python_start_day = (registration_day - 1 + 7) % 7
    
    KRT = ZoneInfo("Asia/Krasnoyarsk")
    now_krt = datetime.now(KRT)
    today_krt = now_krt.date()
    
    current_weekday_krt = today_krt.weekday()
    days_since_last_start_day = (current_weekday_krt - python_start_day + 7) % 7
    
    last_registration_day_date_krt = today_krt - timedelta(days=days_since_last_start_day)
    
    registration_time_naive = time(registration_hour, registration_minute)
    registration_datetime_krt_today = datetime.combine(today_krt, registration_time_naive, tzinfo=KRT)
    last_registration_datetime_krt = datetime.combine(last_registration_day_date_krt, registration_time_naive, tzinfo=KRT)
    
    if current_weekday_krt == python_start_day and now_krt < registration_datetime_krt_today:
        last_registration_datetime_krt -= timedelta(weeks=1)
        last_registration_day_date_krt = last_registration_datetime_krt.date()
    
    # Рассчитываем начало текущего периода
    if offset_type == 'weeks':
        start_of_registration_week = last_registration_day_date_krt - timedelta(days=last_registration_day_date_krt.weekday())
        start_of_booking_week = start_of_registration_week + timedelta(weeks=offset_amount)
    elif offset_type == 'days':
        start_of_booking_week = last_registration_day_date_krt + timedelta(days=offset_amount)
    else:
        start_of_registration_week = last_registration_day_date_krt - timedelta(days=last_registration_day_date_krt.weekday())
        start_of_booking_week = start_of_registration_week
    
    end_of_booking_week = start_of_booking_week + timedelta(days=period_length - 1)
    
    return start_of_booking_week, end_of_booking_week

