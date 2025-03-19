import json
import os
from datetime import datetime
import logging
from pathlib import Path

# Настраиваем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Путь к файлу с данными
DATA_DIR = Path(__file__).parent
SHIFTS_FILE = DATA_DIR / 'shifts.json'

def _ensure_shifts_file():
    """Создает файл shifts.json если он не существует"""
    if not SHIFTS_FILE.exists():
        with open(SHIFTS_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f)

def _load_shifts():
    """Загружает смены из файла"""
    _ensure_shifts_file()
    try:
        with open(SHIFTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading shifts: {e}")
        return []

def _save_shifts(shifts):
    """Сохраняет смены в файл"""
    try:
        with open(SHIFTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(shifts, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving shifts: {e}")

def get_shifts():
    """Получает все смены"""
    return _load_shifts()

def book_shift(user_id, date, shift_type, slot_index, user_data):
    """Бронирует смену"""
    shifts = _load_shifts()
    
    # Проверяем, не записан ли уже пользователь на эту смену
    user_shifts = [s for s in shifts if s['user_id'] == user_id and s['date'] == date]
    if user_shifts:
        raise ValueError("User already has a shift on this date")

    # Проверяем количество записей на эту смену
    date_shifts = [s for s in shifts if s['date'] == date and s['shift_type'] == shift_type]
    max_slots = 4 if shift_type == 'day' else 2
    if len(date_shifts) >= max_slots:
        raise ValueError("No available slots for this shift")

    # Создаем новую смену
    new_shift = {
        'id': len(shifts) + 1,
        'user_id': user_id,
        'date': date,
        'shift_type': shift_type,
        'slot_index': slot_index,
        'avatar_url': user_data.get('photo_url'),
        'first_name': user_data.get('first_name'),
        'last_name': user_data.get('last_name'),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

    shifts.append(new_shift)
    _save_shifts(shifts)
    return new_shift

def cancel_shift(shift_id):
    """Отменяет смену"""
    shifts = _load_shifts()
    
    # Находим смену для удаления
    shift_index = None
    for i, shift in enumerate(shifts):
        if shift['id'] == shift_id:
            shift_index = i
            break
    
    if shift_index is None:
        raise ValueError("Shift not found")
    
    # Удаляем смену
    deleted_shift = shifts.pop(shift_index)
    _save_shifts(shifts)
    return deleted_shift 