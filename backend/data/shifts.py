import json
import os
from datetime import datetime
import logging
from pathlib import Path
import tempfile
import shutil
from typing import List, Dict, Optional
import uuid

# Настраиваем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Пути к файлам с данными смен и резервов
DATA_DIR = Path(__file__).parent.parent / 'data'
SHIFTS_FILE = DATA_DIR / 'shifts.json'
RESERVES_FILE = DATA_DIR / 'reserves.json'

# Альтернативные пути для проверки
ALT_DATA_DIRS = [
    Path('/app/data'),
    Path('/app/backend/data'),
    Path(os.getcwd()) / 'data',
    Path('.')
]

logger.info(f"Основной путь к файлу смен: {SHIFTS_FILE}")
for alt_dir in ALT_DATA_DIRS:
    logger.info(f"Альтернативный путь: {alt_dir / 'shifts.json'}")

def _get_shifts_file_path():
    """Определяет доступный путь к файлу смен"""
    # Проверяем основной путь
    if SHIFTS_FILE.exists():
        return SHIFTS_FILE
    
    # Проверяем, можно ли создать файл по основному пути
    try:
        if not SHIFTS_FILE.parent.exists():
            os.makedirs(SHIFTS_FILE.parent, exist_ok=True)
        with open(SHIFTS_FILE, 'a') as f:
            pass  # Пробуем создать пустой файл
        logger.info(f"Создан новый файл смен по пути: {SHIFTS_FILE}")
        return SHIFTS_FILE
    except (IOError, PermissionError) as e:
        logger.warning(f"Не удается использовать основной путь {SHIFTS_FILE}: {e}")
    
    # Проверяем альтернативные пути
    for alt_dir in ALT_DATA_DIRS:
        alt_file = alt_dir / 'shifts.json'
        logger.info(f"Проверка альтернативного пути: {alt_file}")
        
        try:
            if not alt_dir.exists():
                os.makedirs(alt_dir, exist_ok=True)
                logger.info(f"Создана директория: {alt_dir}")
                
            # Проверяем доступность для записи
            if alt_file.exists():
                logger.info(f"Найден существующий файл: {alt_file}")
                return alt_file
            
            # Пробуем создать файл
            with open(alt_file, 'a') as f:
                pass
            logger.info(f"Создан новый файл смен по пути: {alt_file}")
            return alt_file
        except (IOError, PermissionError) as e:
            logger.warning(f"Не удается использовать альтернативный путь {alt_file}: {e}")
    
    # Если все пути недоступны, используем временный файл
    temp_file = Path(tempfile.gettempdir()) / 'shifts.json'
    logger.warning(f"Все пути недоступны, используем временный файл: {temp_file}")
    return temp_file

def _ensure_shifts_file():
    """Проверяет существование файла смен и создает его при необходимости"""
    shifts_file = _get_shifts_file_path()
    
    if not shifts_file.exists():
        try:
            with open(shifts_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            logger.info(f"Создан пустой файл смен: {shifts_file}")
        except Exception as e:
            logger.error(f"Ошибка создания файла смен: {e}")

def _load_shifts():
    """Загружает смены из файла"""
    _ensure_shifts_file()
    shifts_file = _get_shifts_file_path()
    
    try:
        with open(shifts_file, 'r', encoding='utf-8') as f:
            logger.info(f"Загрузка смен из файла: {shifts_file}")
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Ошибка декодирования JSON: {e}")
        logger.warning("Возвращаем пустой список из-за ошибки JSON")
        return []
    except Exception as e:
        logger.error(f"Ошибка загрузки смен: {e}")
        return []

def _save_shifts(shifts):
    """Сохраняет смены в файл с атомарной записью для предотвращения повреждения данных"""
    try:
        shifts_file = _get_shifts_file_path()
        logger.info(f"💾 Сохранение {len(shifts)} смен в файл {shifts_file}")
        
        # Выводим первые 3 смены для отладки
        sample_shifts = shifts[:min(3, len(shifts))] if shifts else []
        logger.info(f"📊 Примеры смен для сохранения: {json.dumps(sample_shifts, ensure_ascii=False)}")
        
        # Создаем резервную копию текущего файла (если он существует)
        if shifts_file.exists():
            try:
                backup_path = str(shifts_file) + '.bak'
                shutil.copy2(shifts_file, backup_path)
                logger.info(f"📑 Создана резервная копия файла смен: {backup_path}")
            except Exception as e:
                logger.error(f"❌ Ошибка при создании резервной копии: {e}")
        
        # Проверяем, существует ли директория, и создаем её при необходимости
        directory = os.path.dirname(shifts_file)
        logger.info(f"📁 Директория для сохранения: {directory}")
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            logger.info(f"📁 Создана директория для хранения смен: {directory}")
            
        # Атомарная запись через временный файл
        try:
            # Создаем временный файл в том же каталоге для атомарной записи
            fd, temp_path = tempfile.mkstemp(dir=directory, suffix='.json.tmp')
            logger.info(f"📄 Создан временный файл для атомарной записи: {temp_path}")
            
            try:
                # Подготавливаем JSON данные
                json_data = json.dumps(shifts, ensure_ascii=False, indent=2)
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
                            if len(temp_content) < 10 and len(shifts) > 0:
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
                    if os.name == 'nt' and os.path.exists(shifts_file):
                        logger.info(f"🔄 Используем os.replace для Windows")
                        # Проверяем существование целевого файла перед удалением
                        if os.path.exists(shifts_file):
                            # На всякий случай делаем еще одну резервную копию перед заменой
                            try:
                                emergency_backup = str(shifts_file) + '.emergency'
                                shutil.copy2(shifts_file, emergency_backup)
                                logger.info(f"📑 Создана экстренная копия перед заменой: {emergency_backup}")
                            except Exception as bk_err:
                                logger.warning(f"⚠️ Не удалось создать экстренную копию: {bk_err}")
                        
                        os.replace(temp_path, shifts_file)
                        logger.info(f"✅ Файл успешно заменен (Windows)")
                    else:
                        # Атомарная операция переименования на POSIX
                        logger.info(f"🔄 Используем os.rename для POSIX")
                        os.rename(temp_path, shifts_file)
                        logger.info(f"✅ Файл успешно переименован (POSIX)")
                except Exception as rename_err:
                    logger.error(f"❌ Ошибка при переименовании файла: {rename_err}")
                    # Пробуем аварийное копирование содержимого
                    try:
                        logger.info(f"🔄 Пробуем аварийное копирование содержимого...")
                        with open(temp_path, 'r', encoding='utf-8') as src:
                            content = src.read()
                        with open(shifts_file, 'w', encoding='utf-8') as dst:
                            dst.write(content)
                            dst.flush()
                            os.fsync(dst.fileno())
                        logger.info(f"✅ Аварийное копирование успешно выполнено")
                    except Exception as copy_err:
                        logger.error(f"❌ Ошибка при аварийном копировании: {copy_err}")
                        raise copy_err
                
                # Проверяем, что файл действительно был создан/обновлен
                if os.path.exists(shifts_file):
                    file_size = os.path.getsize(shifts_file)
                    logger.info(f"✅ Файл смен успешно сохранен, размер: {file_size} байт")
                    
                    # Читаем сохраненный файл и проверяем содержимое
                    try:
                        with open(shifts_file, 'r', encoding='utf-8') as f:
                            saved_data = json.load(f)
                            logger.info(f"✅ Успешно прочитано {len(saved_data)} смен из сохраненного файла")
                    except Exception as read_err:
                        logger.error(f"❌ Ошибка при чтении сохраненного файла: {read_err}")
                else:
                    logger.error(f"❌ Файл {shifts_file} не существует после сохранения!")
                    
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
                with open(shifts_file, 'w', encoding='utf-8') as f:
                    json.dump(shifts, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                logger.info(f"✅ Прямая запись успешно выполнена")
            except Exception as direct_err:
                logger.error(f"❌ Ошибка при прямой записи: {direct_err}")
                raise direct_err
    except Exception as e:
        logger.error(f"❌ Критическая ошибка при сохранении смен: {e}")
        import traceback
        logger.error(f"📊 Полная трассировка ошибки:\n{traceback.format_exc()}")

def get_all_shifts():
    """Получает все смены"""
    return _load_shifts()

def get_shifts_by_chat(chat_id: str) -> List[Dict]:
    """Получает все смены для конкретного чата"""
    shifts = _load_shifts()
    return [s for s in shifts if s.get('chat_id') == chat_id]

def get_shift(shift_id) -> Optional[Dict]:
    """Получает смену по ID (поддерживает как числовые, так и строковые ID)"""
    shifts = _load_shifts()
    
    # Преобразуем shift_id к строке для сравнения
    str_shift_id = str(shift_id)
    
    for shift in shifts:
        # Сравниваем строковые представления ID для надежности
        if str(shift['id']) == str_shift_id:
            return shift
            
    logger.warning(f"Смена с ID '{shift_id}' не найдена")
    return None

def book_shift(user_id: str, date: str, shift_type: str, slot_index: int, 
              chat_id: str, user_data: Dict = None) -> Dict:
    """Бронирует смену с привязкой к чату"""
    shifts = _load_shifts()
    
    # Проверяем, не записан ли уже пользователь на эту смену в этом чате
    user_shifts = [s for s in shifts if str(s['user_id']) == str(user_id) and 
                   s['date'] == date and str(s.get('chat_id')) == str(chat_id)]
    if user_shifts:
        raise ValueError("User already has a shift on this date in this chat")

    # Проверяем количество записей на эту смену в этом чате
    date_shifts = [s for s in shifts if s['date'] == date and 
                  s['shift_type'] == shift_type and str(s.get('chat_id')) == str(chat_id)]
    max_slots = 4 if shift_type == 'day' else 2
    if len(date_shifts) >= max_slots:
        raise ValueError("No available slots for this shift in this chat")

    # Используем UUID для генерации уникального ID смены
    shift_id = str(uuid.uuid4())
    
    # Логируем подробную информацию о создании новой смены
    logger.info(f"Создание новой смены: ID={shift_id}, пользователь={user_id}, дата={date}, "
                f"тип={shift_type}, слот={slot_index}, чат={chat_id}")

    # Создаем новую смену с UUID в качестве ID
    new_shift = {
        'id': shift_id,
        'user_id': str(user_id),
        'date': date,
        'shift_type': shift_type,
        'slot_index': int(slot_index),
        'chat_id': str(chat_id),
        'photo_url': user_data.get('photo_url') if user_data else None,
        'first_name': user_data.get('first_name') if user_data else None,
        'last_name': user_data.get('last_name') if user_data else None,
        'is_senior_courier': bool(user_data.get('is_senior_courier', False)) if user_data else False,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

    # Логируем полные данные новой смены
    logger.info(f"Данные новой смены: {json.dumps(new_shift, ensure_ascii=False)}")

    shifts.append(new_shift)
    _save_shifts(shifts)
    
    logger.info(f"Смена успешно добавлена в список и сохранена в файл")
    return new_shift

def update_shift(shift_id, update_data: Dict) -> Optional[Dict]:
    """Обновляет существующую смену (поддерживает как числовые, так и строковые ID)"""
    logger.info(f"🔍 Вызов update_shift с ID: {shift_id}")
    logger.info(f"📊 Данные обновления: {json.dumps(update_data, ensure_ascii=False)}")
    
    try:
        shifts = _load_shifts()
        logger.info(f"📋 Загружено {len(shifts)} смен из файла")
        
        # Проверяем наличие смен в файле
        if not shifts:
            logger.warning("⚠️ Загружен пустой список смен!")
        else:
            # Выводим ID первых 5 смен для отладки
            shift_ids = [str(s.get('id')) for s in shifts[:5]]
            logger.info(f"🔑 Примеры ID смен: {', '.join(shift_ids)}")
        
        # Преобразуем shift_id к строке для сравнения
        str_shift_id = str(shift_id)
        
        # Ведем подробный лог обновления
        logger.info(f"🔄 Обновление смены с ID '{str_shift_id}'")
        logger.info(f"📊 Данные для обновления: {json.dumps(update_data, ensure_ascii=False)}")
        
        # Находим смену для обновления
        found_shift = False
        for i, shift in enumerate(shifts):
            # Выводим текущий проверяемый ID
            current_id = str(shift.get('id', 'no_id'))
            logger.info(f"🔍 Проверяем смену #{i}, ID: {current_id} == {str_shift_id}? {current_id == str_shift_id}")
            
            # Сравниваем строковые представления ID для надежности
            if str(shift.get('id', '')) == str_shift_id:
                found_shift = True
                logger.info(f"✅ Найдена смена для обновления (индекс {i})")
                
                # Создаем глубокую копию перед обновлением для логирования
                old_shift = dict(shift)
                
                # Обновляем данные
                for key, value in update_data.items():
                    shift[key] = value
                    logger.info(f"🔄 Обновлено поле {key}: {value}")
                
                # Обновляем временную метку, если она не была установлена в update_data
                if 'updated_at' not in update_data:
                    shift['updated_at'] = datetime.now().isoformat()
                    logger.info(f"🕒 Обновлена временная метка: {shift['updated_at']}")
                
                # Логируем обновленную смену
                logger.info(f"📄 Смена до обновления: {json.dumps(old_shift, ensure_ascii=False)}")
                logger.info(f"📄 Смена после обновления: {json.dumps(shift, ensure_ascii=False)}")
                
                # Сохраняем изменения
                logger.info("💾 Вызываем _save_shifts для сохранения...")
                _save_shifts(shifts)
                
                logger.info(f"✅ Смена с ID '{str_shift_id}' успешно обновлена")
                return shift
        
        if not found_shift:
            logger.warning(f"⚠️ Смена с ID '{str_shift_id}' не найдена среди {len(shifts)} смен")
            
        # Выводим все ID смен для отладки, если смена не найдена
        all_shift_ids = [str(s.get('id', 'no_id')) for s in shifts]
        logger.info(f"🔑 Все ID смен в файле: {', '.join(all_shift_ids)}")
            
        logger.warning(f"❌ Смена с ID '{str_shift_id}' не найдена для обновления")
        return None
        
    except Exception as e:
        logger.error(f"❌ Ошибка в функции update_shift: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def cancel_shift(shift_id) -> Optional[Dict]:
    """Отменяет смену по ID (поддерживает как числовые, так и строковые ID)"""
    shifts = _load_shifts()
    
    # Преобразуем shift_id к строке для сравнения
    str_shift_id = str(shift_id)
    
    # Ведем подробный лог отмены
    logger.info(f"Отмена смены с ID '{str_shift_id}'")
    
    # Находим смену для удаления
    shift_index = None
    deleted_shift = None
    
    for i, shift in enumerate(shifts):
        # Сравниваем строковые представления ID для надежности
        if str(shift['id']) == str_shift_id:
            shift_index = i
            deleted_shift = shift
            break
    
    if shift_index is None:
        logger.warning(f"Смена с ID '{str_shift_id}' не найдена для отмены")
        return None
    
    # Логируем отменяемую смену
    logger.info(f"Удаляемая смена: {json.dumps(deleted_shift, ensure_ascii=False)}")
    
    # Удаляем смену
    shifts.pop(shift_index)
    _save_shifts(shifts)
    
    logger.info(f"Смена с ID '{str_shift_id}' успешно отменена")
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