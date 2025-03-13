import json
import os
import tempfile
import shutil
from datetime import datetime
from typing import List, Dict, Optional

WRITE_OFFS_FILE = "data/write_offs.json"

def ensure_write_offs_file():
    """Убеждаемся, что файл существует"""
    if not os.path.exists(WRITE_OFFS_FILE):
        os.makedirs(os.path.dirname(WRITE_OFFS_FILE), exist_ok=True)
        with open(WRITE_OFFS_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)

def load_write_offs() -> Dict:
    """Загружаем все списания"""
    ensure_write_offs_file()
    try:
        with open(WRITE_OFFS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        # Попробуем загрузить резервную копию, если основной файл поврежден
        backup_file = f"{WRITE_OFFS_FILE}.bak"
        if os.path.exists(backup_file):
            try:
                with open(backup_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {}

def save_write_offs(write_offs: Dict):
    """
    Сохраняем списания в файл с атомарной записью и созданием резервной копии
    для предотвращения повреждения данных.
    """
    # Создаем резервную копию текущего файла (если он существует)
    if os.path.exists(WRITE_OFFS_FILE):
        try:
            shutil.copy2(WRITE_OFFS_FILE, f"{WRITE_OFFS_FILE}.bak")
        except Exception as e:
            print(f"Ошибка при создании резервной копии: {e}")
    
    # Атомарная запись через временный файл
    try:
        # Создаем временный файл в том же каталоге для атомарной записи
        directory = os.path.dirname(WRITE_OFFS_FILE)
        fd, temp_path = tempfile.mkstemp(dir=directory)
        
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(write_offs, f, ensure_ascii=False, indent=2)
            
            # На Windows может потребоваться удалить целевой файл перед переименованием
            if os.name == 'nt' and os.path.exists(WRITE_OFFS_FILE):
                os.replace(temp_path, WRITE_OFFS_FILE)
            else:
                # Атомарная операция переименования
                os.rename(temp_path, WRITE_OFFS_FILE)
                
        except Exception as e:
            os.unlink(temp_path)  # Удаляем временный файл в случае ошибки
            raise e
            
    except Exception as e:
        print(f"Ошибка при сохранении файла списаний: {e}")
        raise e

def get_chat_write_offs(chat_id: str) -> List[Dict]:
    """Получаем списания для конкретного чата"""
    write_offs = load_write_offs()
    return write_offs.get(chat_id, [])

def add_write_off(chat_id: str, write_off_data: Dict) -> Dict:
    """Добавляем новое списание"""
    write_offs = load_write_offs()
    
    if chat_id not in write_offs:
        write_offs[chat_id] = []
    
    # Добавляем метаданные
    write_off_data.update({
        "id": f"wo_{len(write_offs[chat_id]) + 1}_{int(datetime.now().timestamp())}",
        "created_at": datetime.now().isoformat(),
        "status": "active"
    })
    
    write_offs[chat_id].insert(0, write_off_data)  # Добавляем в начало списка
    save_write_offs(write_offs)
    
    return write_off_data

def update_write_off(chat_id: str, write_off_id: str, update_data: Dict) -> Optional[Dict]:
    """Обновляем существующее списание"""
    write_offs = load_write_offs()
    
    if chat_id not in write_offs:
        return None
    
    for write_off in write_offs[chat_id]:
        if write_off["id"] == write_off_id:
            write_off.update(update_data)
            write_off["updated_at"] = datetime.now().isoformat()
            save_write_offs(write_offs)
            return write_off
    
    return None

def delete_write_off(chat_id: str, write_off_id: str) -> bool:
    """Удаляем списание"""
    print(f"Начинаем процесс удаления списания: chat_id={chat_id}, write_off_id={write_off_id}")
    
    try:
        write_offs = load_write_offs()
        
        if chat_id not in write_offs:
            print(f"Чат {chat_id} не найден в списке списаний")
            return False
        
        # Проверяем существование списания перед удалением
        write_off_exists = False
        for wo in write_offs[chat_id]:
            if wo["id"] == write_off_id:
                write_off_exists = True
                break
                
        if not write_off_exists:
            print(f"Списание {write_off_id} не найдено в чате {chat_id}")
            return False
        
        # Запоминаем начальную длину списка
        initial_length = len(write_offs[chat_id])
        print(f"Начальное количество списаний в чате: {initial_length}")
        
        # Фильтруем списания, исключая указанное
        write_offs[chat_id] = [wo for wo in write_offs[chat_id] if wo["id"] != write_off_id]
        
        # Проверяем, уменьшилось ли количество списаний
        new_length = len(write_offs[chat_id])
        print(f"Новое количество списаний: {new_length}")
        
        if new_length < initial_length:
            # Сохраняем обновленный список
            try:
                save_write_offs(write_offs)
                print(f"Списание {write_off_id} успешно удалено из чата {chat_id}")
                
                # Проверка целостности файла после сохранения
                verify_write_offs = load_write_offs()
                if chat_id in verify_write_offs:
                    verify_length = len(verify_write_offs[chat_id])
                    if verify_length == new_length:
                        print(f"Проверка целостности успешна: {verify_length} списаний")
                    else:
                        print(f"ВНИМАНИЕ: Обнаружено несоответствие длины списка после сохранения: {verify_length} vs {new_length}")
                
                return True
            except Exception as e:
                print(f"ОШИБКА при сохранении после удаления: {e}")
                return False
        
        print(f"Длина списка не изменилась, удаление не выполнено")
        return False
        
    except Exception as e:
        print(f"ОШИБКА при удалении списания: {e}")
        return False 