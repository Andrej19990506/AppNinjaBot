import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

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
    with open(RESERVES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_reserves(reserves: List[Dict]):
    """Сохраняет все резервы в файл"""
    with open(RESERVES_FILE, 'w', encoding='utf-8') as f:
        json.dump(reserves, f, ensure_ascii=False, indent=2)

def get_reserves_by_date(date: str) -> List[Dict]:
    """Получает все резервы на указанную дату"""
    reserves = load_reserves()
    return [r for r in reserves if r['date'] == date]

def add_reserve(reserve_data: Dict) -> Dict:
    """Добавляет новый резерв"""
    reserves = load_reserves()
    
    # Генерируем ID для нового резерва
    max_id = max([r['id'] for r in reserves]) if reserves else 0
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
        if reserve['id'] == reserve_id:
            return reserve
    return None

def delete_reserve(reserve_id: int) -> bool:
    """Удаляет резерв по ID"""
    reserves = load_reserves()
    initial_length = len(reserves)
    reserves = [r for r in reserves if r['id'] != reserve_id]
    
    if len(reserves) < initial_length:
        save_reserves(reserves)
        return True
    return False

# Инициализируем файл при импорте модуля
init_reserves_file() 