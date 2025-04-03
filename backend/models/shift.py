from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import logging
import uuid
import json
from typing import Dict, List, Any
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from models.database import db

# Настройка логирования
logger = logging.getLogger(__name__)

class Shift(BaseModel):
    """Модель смены курьера"""
    id: str
    user_id: str
    date: str
    shift_type: str
    slot_index: int
    chat_id: str
    photo_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ShiftBase(BaseModel):
    date: str
    shift_type: str
    slot_index: int

class ShiftCreate(ShiftBase):
    user_id: int

class ShiftResponse(ShiftBase):
    id: int
    user_id: int
    avatar_url: Optional[str] = None
    first_name: str
    last_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ShiftDB(ShiftBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ShiftModel:
    """Модель для работы со сменами в PostgreSQL"""
    
    @staticmethod
    def create_tables(conn):
        """Создает таблицу shifts, если она не существует"""
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shifts (
                        id VARCHAR(50) PRIMARY KEY,
                        user_id VARCHAR(50) NOT NULL,
                        date VARCHAR(50) NOT NULL,
                        shift_type VARCHAR(20) NOT NULL,
                        slot_index INTEGER NOT NULL,
                        chat_id VARCHAR(50) NOT NULL,
                        photo_url TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        is_senior_courier BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        metadata JSONB DEFAULT '{}'::jsonb
                    );
                    
                    -- Индексы для быстрого поиска
                    CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
                    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
                    CREATE INDEX IF NOT EXISTS idx_shifts_chat_id ON shifts(chat_id);
                """)
                conn.commit()
                logger.info("✅ Таблица shifts успешно создана или уже существует")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при создании таблицы shifts: {e}")
            conn.rollback()
            return False
    
    @staticmethod
    def get_all_shifts() -> List[Dict]:
        """Получает все смены из базы данных"""
        try:
            conn = db.get_db()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT * FROM shifts ORDER BY date, shift_type, slot_index")
                shifts = cursor.fetchall()
                # Преобразуем RealDictRow в обычные словари
                return [dict(shift) for shift in shifts]
        except Exception as e:
            logger.error(f"❌ Ошибка при получении всех смен: {e}")
            return []
    
    @staticmethod
    def get_shifts_by_chat(chat_id: str) -> List[Dict]:
        """Получает смены по ID чата"""
        try:
            conn = db.get_db()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT * FROM shifts WHERE chat_id = %s ORDER BY date, shift_type, slot_index",
                    (chat_id,)
                )
                shifts = cursor.fetchall()
                return [dict(shift) for shift in shifts]
        except Exception as e:
            logger.error(f"❌ Ошибка при получении смен для чата {chat_id}: {e}")
            return []
    
    @staticmethod
    def get_shift(shift_id: str) -> Optional[Dict]:
        """Получает смену по ID"""
        try:
            conn = db.get_db()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT * FROM shifts WHERE id = %s", (shift_id,))
                shift = cursor.fetchone()
                return dict(shift) if shift else None
        except Exception as e:
            logger.error(f"❌ Ошибка при получении смены {shift_id}: {e}")
            return None
    
    @staticmethod
    def book_shift(user_id: str, date: str, shift_type: str, 
                  slot_index: int, chat_id: str, user_data: Dict = None) -> Dict:
        """Бронирует смену и сохраняет ее в базу данных"""
        try:
            conn = db.get_db()
            # Создаем уникальный ID для смены
            shift_id = str(uuid.uuid4())
            
            # Подготавливаем данные пользователя
            user_data = user_data or {}
            
            # Формируем данные смены
            shift_data = {
                "id": shift_id,
                "user_id": user_id,
                "date": date,
                "shift_type": shift_type,
                "slot_index": slot_index,
                "chat_id": chat_id,
                "photo_url": user_data.get('photo_url'),
                "first_name": user_data.get('first_name', ''),
                "last_name": user_data.get('last_name', ''),
                "is_senior_courier": user_data.get('is_senior_courier', False),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            # Сохраняем в базу данных
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO shifts (
                        id, user_id, date, shift_type, slot_index, chat_id,
                        photo_url, first_name, last_name, is_senior_courier
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                """, (
                    shift_data["id"], shift_data["user_id"], shift_data["date"],
                    shift_data["shift_type"], shift_data["slot_index"], shift_data["chat_id"],
                    shift_data["photo_url"], shift_data["first_name"], shift_data["last_name"],
                    shift_data["is_senior_courier"]
                ))
                conn.commit()
                
                # Логируем успешное создание
                logger.info(f"✅ Успешно создана новая смена {shift_id} для пользователя {user_id}")
                
                return shift_data
                
        except Exception as e:
            logger.error(f"❌ Ошибка при бронировании смены: {e}")
            if conn:
                conn.rollback()
            raise
    
    @staticmethod
    def update_shift(shift_id: str, update_data: Dict) -> Optional[Dict]:
        """Обновляет смену в базе данных"""
        try:
            conn = db.get_db()
            # Получаем текущие данные смены
            current_shift = ShiftModel.get_shift(shift_id)
            if not current_shift:
                logger.error(f"❌ Смена {shift_id} не найдена для обновления")
                return None
            
            # Обновляем в базе данных только переданные поля
            set_values = []
            params = []
            
            # Добавляем поля для обновления
            for key, value in update_data.items():
                if key in ["user_id", "date", "shift_type", "slot_index", "chat_id", 
                           "photo_url", "first_name", "last_name", "is_senior_courier"]:
                    set_values.append(f"{key} = %s")
                    params.append(value)
            
            # Всегда обновляем updated_at
            set_values.append("updated_at = NOW()")
            
            # Если нет полей для обновления, возвращаем текущую смену
            if not set_values:
                return current_shift
            
            # Формируем SQL запрос
            sql = f"UPDATE shifts SET {', '.join(set_values)} WHERE id = %s RETURNING *"
            params.append(shift_id)
            
            # Выполняем обновление
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(sql, params)
                updated_shift = cursor.fetchone()
                conn.commit()
                
                if updated_shift:
                    logger.info(f"✅ Успешно обновлена смена {shift_id}")
                    return dict(updated_shift)
                else:
                    logger.error(f"❌ Смена {shift_id} не найдена при возврате обновлённых данных")
                    return None
                
        except Exception as e:
            logger.error(f"❌ Ошибка при обновлении смены {shift_id}: {e}")
            if conn:
                conn.rollback()
            return None
    
    @staticmethod
    def cancel_shift(shift_id: str) -> Optional[Dict]:
        """Отменяет смену по ID, удаляя ее из базы данных"""
        try:
            conn = db.get_db()
            # Получаем текущие данные смены перед удалением
            current_shift = ShiftModel.get_shift(shift_id)
            if not current_shift:
                logger.error(f"❌ Смена {shift_id} не найдена для отмены")
                return None
            
            # Удаляем смену
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM shifts WHERE id = %s", (shift_id,))
                deleted_count = cursor.rowcount
                conn.commit()
                
                if deleted_count > 0:
                    logger.info(f"✅ Успешно отменена смена {shift_id}")
                    return current_shift
                else:
                    logger.error(f"❌ Смена {shift_id} не найдена при удалении")
                    return None
                
        except Exception as e:
            logger.error(f"❌ Ошибка при отмене смены {shift_id}: {e}")
            if conn:
                conn.rollback()
            return None
            
    @staticmethod
    def cancel_user_shift(user_id: str, date: str, chat_id: str) -> Optional[Dict]:
        """Отменяет смену пользователя на определенную дату в определенном чате"""
        try:
            conn = db.get_db()
            # Находим смену пользователя
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT * FROM shifts WHERE user_id = %s AND date = %s AND chat_id = %s",
                    (user_id, date, chat_id)
                )
                shift = cursor.fetchone()
                
                if not shift:
                    logger.warning(f"⚠️ Смена пользователя {user_id} на дату {date} в чате {chat_id} не найдена")
                    return None
                
                # Сохраняем копию смены
                canceled_shift = dict(shift)
                
                # Удаляем смену
                cursor.execute(
                    "DELETE FROM shifts WHERE user_id = %s AND date = %s AND chat_id = %s",
                    (user_id, date, chat_id)
                )
                conn.commit()
                
                logger.info(f"✅ Успешно отменена смена пользователя {user_id} на {date} в чате {chat_id}")
                return canceled_shift
                
        except Exception as e:
            logger.error(f"❌ Ошибка при отмене смены пользователя {user_id} на {date}: {e}")
            if conn:
                conn.rollback()
            return None 