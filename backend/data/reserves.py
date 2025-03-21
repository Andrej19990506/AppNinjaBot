import json
import os
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import logging

# Настраиваем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Путь к файлу с данными
DATA_DIR = Path(__file__).parent
RESERVES_FILE = DATA_DIR / 'reserves.json'

def init_reserves_file():
    """Создает файл reserves.json если он не существует"""
    if not RESERVES_FILE.exists():
        with open(RESERVES_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)

def load_reserves() -> List[Dict]:
    """Загружает все резервы из файла"""
    init_reserves_file()
    try:
        with open(RESERVES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        # Попробуем загрузить резервную копию, если основной файл поврежден
        backup_file = f"{RESERVES_FILE}.bak"
        if os.path.exists(backup_file):
            try:
                with open(backup_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return []
    except Exception as e:
        logger.error(f"Error loading reserves: {e}")
        return []

def save_reserves(reserves: List[Dict]):
    """Сохраняет все резервы в файл с атомарной записью"""
    try:
        # Создаем резервную копию текущего файла (если он существует)
        if os.path.exists(RESERVES_FILE):
            try:
                shutil.copy2(RESERVES_FILE, f"{RESERVES_FILE}.bak")
            except Exception as e:
                logger.error(f"Ошибка при создании резервной копии: {e}")
        
        # Атомарная запись через временный файл
        try:
            # Создаем временный файл в том же каталоге для атомарной записи
            directory = os.path.dirname(RESERVES_FILE)
            fd, temp_path = tempfile.mkstemp(dir=directory)
            
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    json.dump(reserves, f, ensure_ascii=False, indent=2)
                
                # На Windows может потребоваться удалить целевой файл перед переименованием
                if os.name == 'nt' and os.path.exists(RESERVES_FILE):
                    os.replace(temp_path, RESERVES_FILE)
                else:
                    # Атомарная операция переименования
                    os.rename(temp_path, RESERVES_FILE)
                    
            except Exception as e:
                os.unlink(temp_path)  # Удаляем временный файл в случае ошибки
                raise e
                
        except Exception as e:
            logger.error(f"Ошибка при сохранении файла резервов: {e}")
            raise e
    except Exception as e:
        logger.error(f"Error saving reserves: {e}")

def get_all_reserves() -> List[Dict]:
    """Получает все резервы"""
    return load_reserves()

def get_reserves_by_chat(chat_id: str) -> List[Dict]:
    """Получает все резервы для конкретного чата"""
    reserves = load_reserves()
    return [r for r in reserves if r.get('chat_id') == chat_id]

def get_reserves_by_date(date: str, chat_id: str = None) -> List[Dict]:
    """Получает все резервы на указанную дату с опциональной фильтрацией по чату"""
    reserves = load_reserves()
    if chat_id:
        return [r for r in reserves if r['date'] == date and r.get('chat_id') == chat_id]
    return [r for r in reserves if r['date'] == date]

def add_reserve(reserve_data: Dict) -> Dict:
    """Добавляет новый резерв"""
    reserves = load_reserves()
    
    # Проверяем обязательные поля
    required_fields = ['user_id', 'date', 'chat_id']
    for field in required_fields:
        if field not in reserve_data:
            raise ValueError(f"Missing required field: {field}")
    
    # Проверяем, не записан ли уже пользователь в резерв на эту дату в этом чате
    user_id = reserve_data['user_id']
    date = reserve_data['date']
    chat_id = reserve_data['chat_id']
    
    existing_reserve = next((r for r in reserves 
                            if r['user_id'] == user_id 
                            and r['date'] == date 
                            and r.get('chat_id') == chat_id), None)
    
    if existing_reserve:
        return existing_reserve  # Пользователь уже в резерве
    
    # Генерируем ID для нового резерва
    max_id = 0
    for reserve in reserves:
        try:
            reserve_id = int(reserve['id'])
            if reserve_id > max_id:
                max_id = reserve_id
        except (ValueError, TypeError):
            continue
    
    reserve_data['id'] = max_id + 1
    
    # Добавляем временную метку
    if 'created_at' not in reserve_data:
        reserve_data['created_at'] = datetime.now().isoformat()
    
    reserves.append(reserve_data)
    save_reserves(reserves)
    return reserve_data

def get_reserve(reserve_id: int) -> Optional[Dict]:
    """Получает резерв по ID"""
    reserves = load_reserves()
    for reserve in reserves:
        if int(reserve['id']) == int(reserve_id):
            return reserve
    return None

def update_reserve(reserve_id: int, update_data: Dict) -> Optional[Dict]:
    """Обновляет существующий резерв"""
    reserves = load_reserves()
    
    for i, reserve in enumerate(reserves):
        if int(reserve['id']) == int(reserve_id):
            # Обновляем данные
            for key, value in update_data.items():
                reserve[key] = value
            
            # Обновляем временную метку
            reserve['updated_at'] = datetime.now().isoformat()
            
            save_reserves(reserves)
            return reserve
    
    return None

def delete_reserve(reserve_id: int) -> bool:
    """Удаляет резерв по ID"""
    reserves = load_reserves()
    initial_length = len(reserves)
    
    # Находим резерв для удаления
    reserve_index = None
    for i, reserve in enumerate(reserves):
        if int(reserve['id']) == int(reserve_id):
            reserve_index = i
            break
    
    if reserve_index is None:
        return False
    
    # Удаляем резерв
    reserves.pop(reserve_index)
    save_reserves(reserves)
    return True

def delete_user_reserve(user_id: str, date: str, chat_id: str) -> Optional[Dict]:
    """Удаляет резерв пользователя на конкретную дату в конкретном чате"""
    reserves = load_reserves()
    
    # Находим резерв для удаления
    reserve_index = None
    deleted_reserve = None
    
    for i, reserve in enumerate(reserves):
        if (reserve['user_id'] == user_id and 
            reserve['date'] == date and 
            reserve.get('chat_id') == chat_id):
            reserve_index = i
            deleted_reserve = reserve
            break
    
    if reserve_index is None:
        return None
    
    # Удаляем резерв
    reserves.pop(reserve_index)
    save_reserves(reserves)
    return deleted_reserve

# Инициализируем файл при импорте модуля
init_reserves_file() 