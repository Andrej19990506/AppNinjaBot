import json
import os
from datetime import datetime
import logging
from pathlib import Path
import tempfile
import shutil
from typing import List, Dict, Optional

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
            json.dump([], f, ensure_ascii=False, indent=2)

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
    """Сохраняет смены в файл с атомарной записью для предотвращения повреждения данных"""
    try:
        # Создаем резервную копию текущего файла (если он существует)
        if SHIFTS_FILE.exists():
            try:
                shutil.copy2(SHIFTS_FILE, str(SHIFTS_FILE) + '.bak')
            except Exception as e:
                logger.error(f"Ошибка при создании резервной копии: {e}")
        
        # Атомарная запись через временный файл
        try:
            # Создаем временный файл в том же каталоге для атомарной записи
            directory = os.path.dirname(SHIFTS_FILE)
            fd, temp_path = tempfile.mkstemp(dir=directory)
            
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    json.dump(shifts, f, ensure_ascii=False, indent=2)
                
                # На Windows может потребоваться удалить целевой файл перед переименованием
                if os.name == 'nt' and SHIFTS_FILE.exists():
                    os.replace(temp_path, SHIFTS_FILE)
                else:
                    # Атомарная операция переименования
                    os.rename(temp_path, SHIFTS_FILE)
                    
            except Exception as e:
                os.unlink(temp_path)  # Удаляем временный файл в случае ошибки
                raise e
                
        except Exception as e:
            logger.error(f"Ошибка при сохранении файла смен: {e}")
            raise e
    except Exception as e:
        logger.error(f"Error saving shifts: {e}")

def get_all_shifts():
    """Получает все смены"""
    return _load_shifts()

def get_shifts_by_chat(chat_id: str) -> List[Dict]:
    """Получает все смены для конкретного чата"""
    shifts = _load_shifts()
    return [s for s in shifts if s.get('chat_id') == chat_id]

def get_shift(shift_id: int) -> Optional[Dict]:
    """Получает смену по ID"""
    shifts = _load_shifts()
    for shift in shifts:
        if int(shift['id']) == int(shift_id):
            return shift
    return None

def book_shift(user_id: str, date: str, shift_type: str, slot_index: int, 
              chat_id: str, user_data: Dict = None) -> Dict:
    """Бронирует смену с привязкой к чату"""
    shifts = _load_shifts()
    
    # Проверяем, не записан ли уже пользователь на эту смену в этом чате
    user_shifts = [s for s in shifts if s['user_id'] == user_id and 
                   s['date'] == date and s.get('chat_id') == chat_id]
    if user_shifts:
        raise ValueError("User already has a shift on this date in this chat")

    # Проверяем количество записей на эту смену в этом чате
    date_shifts = [s for s in shifts if s['date'] == date and 
                  s['shift_type'] == shift_type and s.get('chat_id') == chat_id]
    max_slots = 4 if shift_type == 'day' else 2
    if len(date_shifts) >= max_slots:
        raise ValueError("No available slots for this shift in this chat")

    # Находим максимальный ID
    max_id = 0
    for shift in shifts:
        try:
            shift_id = int(shift['id'])
            if shift_id > max_id:
                max_id = shift_id
        except (ValueError, TypeError):
            continue

    # Создаем новую смену
    new_shift = {
        'id': max_id + 1,
        'user_id': user_id,
        'date': date,
        'shift_type': shift_type,
        'slot_index': slot_index,
        'chat_id': chat_id,
        'photo_url': user_data.get('photo_url') if user_data else None,
        'first_name': user_data.get('first_name') if user_data else None,
        'last_name': user_data.get('last_name') if user_data else None,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

    shifts.append(new_shift)
    _save_shifts(shifts)
    return new_shift

def update_shift(shift_id: int, update_data: Dict) -> Optional[Dict]:
    """Обновляет существующую смену"""
    shifts = _load_shifts()
    
    # Находим смену для обновления
    for i, shift in enumerate(shifts):
        if int(shift['id']) == int(shift_id):
            # Обновляем данные
            for key, value in update_data.items():
                shift[key] = value
            
            # Обновляем временную метку
            shift['updated_at'] = datetime.now().isoformat()
            
            _save_shifts(shifts)
            return shift
    
    return None

def cancel_shift(shift_id: int) -> Optional[Dict]:
    """Отменяет смену по ID"""
    shifts = _load_shifts()
    
    # Находим смену для удаления
    shift_index = None
    deleted_shift = None
    
    for i, shift in enumerate(shifts):
        if int(shift['id']) == int(shift_id):
            shift_index = i
            deleted_shift = shift
            break
    
    if shift_index is None:
        return None
    
    # Удаляем смену
    shifts.pop(shift_index)
    _save_shifts(shifts)
    return deleted_shift

def cancel_user_shift(user_id: str, date: str, chat_id: str) -> Optional[Dict]:
    """Отменяет смену пользователя на конкретную дату в конкретном чате"""
    shifts = _load_shifts()
    
    # Находим смену для удаления
    shift_index = None
    deleted_shift = None
    
    for i, shift in enumerate(shifts):
        if (shift['user_id'] == user_id and 
            shift['date'] == date and 
            shift.get('chat_id') == chat_id):
            shift_index = i
            deleted_shift = shift
            break
    
    if shift_index is None:
        return None
    
    # Удаляем смену
    shifts.pop(shift_index)
    _save_shifts(shifts)
    return deleted_shift 