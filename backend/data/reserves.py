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
        logger.info(f"💾 Сохранение {len(reserves)} резервов в файл {RESERVES_FILE}")
        
        # Выводим первые 3 резерва для отладки
        sample_reserves = reserves[:min(3, len(reserves))] if reserves else []
        logger.info(f"📊 Примеры резервов для сохранения: {json.dumps(sample_reserves, ensure_ascii=False)}")
        
        # Создаем резервную копию текущего файла (если он существует)
        if os.path.exists(RESERVES_FILE):
            try:
                backup_path = str(RESERVES_FILE) + '.bak'
                shutil.copy2(RESERVES_FILE, backup_path)
                logger.info(f"📑 Создана резервная копия файла резервов: {backup_path}")
            except Exception as e:
                logger.error(f"❌ Ошибка при создании резервной копии: {e}")
        
        # Проверяем, существует ли директория, и создаем её при необходимости
        directory = os.path.dirname(RESERVES_FILE)
        logger.info(f"📁 Директория для сохранения: {directory}")
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            logger.info(f"📁 Создана директория для хранения резервов: {directory}")
            
        # Атомарная запись через временный файл
        try:
            # Создаем временный файл в том же каталоге для атомарной записи
            fd, temp_path = tempfile.mkstemp(dir=directory, suffix='.json.tmp')
            logger.info(f"📄 Создан временный файл для атомарной записи: {temp_path}")
            
            try:
                # Подготавливаем JSON данные
                json_data = json.dumps(reserves, ensure_ascii=False, indent=2)
                logger.info(f"📊 Размер JSON данных: {len(json_data)} байт")
                
                # Записываем данные в файл
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write(json_data)
                    f.flush()  # Принудительная запись на диск
                    os.fsync(f.fileno())  # Синхронизация с диском
                    logger.info(f"✅ Данные успешно записаны во временный файл")
                
                # Проверяем, что временный файл создан и содержит данные
                if os.path.exists(temp_path):
                    temp_size = os.path.getsize(temp_path)
                    logger.info(f"✅ Временный файл создан, размер: {temp_size} байт")
                    
                    # Проверяем содержимое временного файла
                    try:
                        with open(temp_path, 'r', encoding='utf-8') as f:
                            temp_content = f.read()
                            # Проверяем базовый размер
                            if len(temp_content) < 10 and len(reserves) > 0:
                                logger.error(f"❌ Подозрительно маленький размер временного файла: {len(temp_content)} байт")
                                raise ValueError("Неполная запись временного файла")
                            
                            # Проверяем валидность JSON
                            json.loads(temp_content)
                            logger.info("✅ Валидация JSON прошла успешно")
                    except json.JSONDecodeError as json_err:
                        logger.error(f"❌ Временный файл содержит невалидный JSON: {json_err}")
                        raise json_err
                else:
                    logger.error(f"❌ Временный файл не существует после записи: {temp_path}")
                    raise IOError("Временный файл не создан")
                
                # Атомарная операция переименования с учетом платформы
                try:
                    # На Windows может потребоваться удалить целевой файл перед переименованием
                    if os.name == 'nt' and os.path.exists(RESERVES_FILE):
                        logger.info(f"🔄 Используем os.replace для Windows")
                        # Проверяем существование целевого файла перед удалением
                        if os.path.exists(RESERVES_FILE):
                            # На всякий случай делаем еще одну резервную копию перед заменой
                            try:
                                emergency_backup = str(RESERVES_FILE) + '.emergency'
                                shutil.copy2(RESERVES_FILE, emergency_backup)
                                logger.info(f"📑 Создана экстренная копия перед заменой: {emergency_backup}")
                            except Exception as bk_err:
                                logger.warning(f"⚠️ Не удалось создать экстренную копию: {bk_err}")
                        
                        os.replace(temp_path, RESERVES_FILE)
                        logger.info(f"✅ Файл успешно заменен (Windows)")
                    else:
                        # Атомарная операция переименования на POSIX
                        logger.info(f"🔄 Используем os.rename для POSIX")
                        os.rename(temp_path, RESERVES_FILE)
                        logger.info(f"✅ Файл успешно переименован (POSIX)")
                except Exception as rename_err:
                    logger.error(f"❌ Ошибка при переименовании файла: {rename_err}")
                    # Пробуем аварийное копирование содержимого
                    try:
                        logger.info(f"🔄 Пробуем аварийное копирование содержимого...")
                        with open(temp_path, 'r', encoding='utf-8') as src:
                            content = src.read()
                        with open(RESERVES_FILE, 'w', encoding='utf-8') as dst:
                            dst.write(content)
                            dst.flush()
                            os.fsync(dst.fileno())
                        logger.info(f"✅ Аварийное копирование успешно выполнено")
                    except Exception as copy_err:
                        logger.error(f"❌ Ошибка при аварийном копировании: {copy_err}")
                        raise copy_err
                
                # Проверяем, что файл действительно был создан/обновлен
                if os.path.exists(RESERVES_FILE):
                    file_size = os.path.getsize(RESERVES_FILE)
                    logger.info(f"✅ Файл резервов успешно сохранен, размер: {file_size} байт")
                    
                    # Читаем сохраненный файл и проверяем содержимое
                    try:
                        with open(RESERVES_FILE, 'r', encoding='utf-8') as f:
                            saved_data = json.load(f)
                            logger.info(f"✅ Успешно прочитано {len(saved_data)} резервов из сохраненного файла")
                    except Exception as read_err:
                        logger.error(f"❌ Ошибка при чтении сохраненного файла: {read_err}")
                else:
                    logger.error(f"❌ Файл {RESERVES_FILE} не существует после сохранения!")
                    
            except Exception as e:
                logger.error(f"❌ Ошибка при записи в файл: {e}")
                if os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)  # Удаляем временный файл в случае ошибки
                        logger.info(f"🧹 Временный файл {temp_path} удален после ошибки")
                    except Exception as unlink_err:
                        logger.warning(f"⚠️ Не удалось удалить временный файл: {unlink_err}")
                import traceback
                logger.error(f"📊 Трассировка ошибки:\n{traceback.format_exc()}")
                raise e
                
        except Exception as e:
            logger.error(f"❌ Ошибка при создании временного файла: {e}")
            
            # Попытка прямой записи при сбое временного файла
            try:
                logger.info(f"🔄 Пробуем прямую запись в файл без временного файла...")
                with open(RESERVES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(reserves, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                logger.info(f"✅ Прямая запись успешно выполнена")
            except Exception as direct_err:
                logger.error(f"❌ Ошибка при прямой записи: {direct_err}")
                raise direct_err
    except Exception as e:
        logger.error(f"❌ Критическая ошибка при сохранении резервов: {e}")
        import traceback
        logger.error(f"📊 Полная трассировка ошибки:\n{traceback.format_exc()}")

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
    
    # Создаем новый резерв с сохранением всех данных пользователя
    new_reserve = {
        'id': max_id + 1,
        'user_id': user_id,
        'userId': user_id,  # Для совместимости с фронтендом
        'date': date,
        'chat_id': chat_id,
        'created_at': datetime.now().isoformat(),
        # Сохраняем все поля пользователя, поддерживая оба формата (camelCase и snake_case)
        'photo_url': reserve_data.get('photo_url'),
        'firstName': reserve_data.get('firstName') or reserve_data.get('first_name'),
        'lastName': reserve_data.get('lastName') or reserve_data.get('last_name'),
        'isSeniorCourier': reserve_data.get('isSeniorCourier') or reserve_data.get('is_senior_courier', False),
        # Дополнительные поля для совместимости
        'first_name': reserve_data.get('first_name') or reserve_data.get('firstName'),
        'last_name': reserve_data.get('last_name') or reserve_data.get('lastName'),
        'is_senior_courier': reserve_data.get('is_senior_courier') or reserve_data.get('isSeniorCourier', False)
    }
    
    # Логируем созданный резерв для отладки
    logger.info(f'📝 Создан новый резерв: {json.dumps(new_reserve, ensure_ascii=False)}')
    
    reserves.append(new_reserve)
    save_reserves(reserves)
    return new_reserve

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