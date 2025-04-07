import os
import logging
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import traceback
import psycopg2
from psycopg2.extras import RealDictCursor, Json

logger = logging.getLogger(__name__)

class DatabaseService:
    """Сервис для работы с базой данных PostgreSQL"""
    
    def __init__(self):
        """Инициализация сервиса для работы с базой данных"""
        self.db_host = os.getenv('POSTGRES_HOST', 'postgres')
        self.db_port = os.getenv('POSTGRES_PORT', '5432')
        self.db_name = os.getenv('POSTGRES_DB', 'appninjabot')
        self.db_user = os.getenv('POSTGRES_USER', 'postgres')
        self.db_password = os.getenv('POSTGRES_PASSWORD', 'postgres')
        
        self.connection_string = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
        self.conn = None
        self.initialize_connection()
        
        # Создаем необходимые таблицы при инициализации
        # self.create_tables() # <<< УБИРАЕМ СОЗДАНИЕ ТАБЛИЦ БОТОМ
        
        logger.info(f"✅ DatabaseService инициализирован. Подключение к базе: {self.db_host}:{self.db_port}/{self.db_name}")
    
    def initialize_connection(self):
        """Инициализирует соединение с базой данных"""
        try:
            self.conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                dbname=self.db_name,
                user=self.db_user,
                password=self.db_password
            )
            logger.info("✅ Соединение с базой данных установлено")
        except Exception as e:
            logger.error(f"❌ Ошибка подключения к базе данных: {e}")
            raise
    
    def create_tables(self):
        """Создает необходимые таблицы в базе данных, если они не существуют"""
        try:
            with self.conn.cursor() as cursor:
                # Таблица для групп
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS groups (
                        id SERIAL PRIMARY KEY,
                        chat_id VARCHAR(50) UNIQUE NOT NULL,
                        chat_title VARCHAR(255) NOT NULL,
                        group_type VARCHAR(50) NOT NULL,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        metadata JSONB DEFAULT '{}'::jsonb
                    )
                """)
                
                # Таблица для участников
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS members (
                        id SERIAL PRIMARY KEY,
                        user_id BIGINT NOT NULL,
                        username VARCHAR(255),
                        first_name VARCHAR(255),
                        last_name VARCHAR(255),
                        status VARCHAR(50) NOT NULL,
                        is_bot BOOLEAN DEFAULT FALSE,
                        is_senior_courier BOOLEAN DEFAULT FALSE,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        photo_url TEXT,
                        metadata JSONB DEFAULT '{}'::jsonb,
                        UNIQUE(user_id)
                    )
                """)
                
                # Связная таблица для участников и групп
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS group_members (
                        id SERIAL PRIMARY KEY,
                        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                        member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
                        role VARCHAR(50) DEFAULT 'member',
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        metadata JSONB DEFAULT '{}'::jsonb,
                        UNIQUE(group_id, member_id)
                    )
                """)
                
                # Создаем индексы для ускорения поиска
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_groups_chat_id ON groups(chat_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_groups_group_type ON groups(group_type)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_group_members_member_id ON group_members(member_id)")
                
                self.conn.commit()
                logger.info("✅ Таблицы базы данных успешно созданы/проверены")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Ошибка при создании таблиц: {e}")
            logger.error(traceback.format_exc())
    
    def determine_group_type(self, chat_title: str) -> str:
        """Определяет тип группы на основе её названия"""
        chat_title_lower = chat_title.lower()
        
        if "курьер" in chat_title_lower or "курьеры" in chat_title_lower:
            return "courier"
        elif any(word in chat_title_lower for word in ["повар", "повара", "поваров", "поварской", "поварская", "поварские", "повор", "повора"]):
            return "chef"
        else:
            return "general"
    
    def is_group_of_type(self, chat_title: str, group_type: str) -> bool:
        """Проверяет, относится ли группа к определенному типу"""
        determined_type = self.determine_group_type(chat_title)
        return determined_type == group_type
    
    def save_group(self, chat_id: str, chat_title: str, members: List[Dict], admins: List[Dict] = None) -> int:
        """Сохраняет группу и её участников в базе данных"""
        try:
            group_type = self.determine_group_type(chat_title)
            logger.info(f"=== Начинаю сохранение группы {chat_title} (ID: {chat_id}) в базу данных ===")
            logger.info(f"Тип группы: {group_type}")
            logger.info(f"Количество участников: {len(members)}")
            logger.info(f"Количество администраторов: {len(admins) if admins else 0}")
            
            # Сохраняем или обновляем группу
            with self.conn.cursor() as cursor:
                logger.info(f"Выполняю запрос на сохранение/обновление группы")
                cursor.execute(
                    """
                    INSERT INTO groups (group_id, title, group_type, metadata)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (group_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        group_type = EXCLUDED.group_type,
                        metadata = EXCLUDED.metadata
                    RETURNING id
                    """,
                    (
                        chat_id,
                        chat_title,
                        group_type,
                        Json({
                            "total_members": len(members),
                            "total_admins": len(admins) if admins else 0,
                            "created_at": datetime.now().isoformat()
                        })
                    )
                )
                group_id = cursor.fetchone()[0]
                logger.info(f"Группа сохранена с ID: {group_id}")
                
                # Сохраняем участников и связи с группой
                for i, member in enumerate(members):
                    logger.info(f"Обрабатываю участника {i+1}/{len(members)}: {member.get('username', member.get('user_id', 'Неизвестный'))}")
                    # Сохраняем или обновляем участника
                    cursor.execute(
                        """
                        INSERT INTO members (user_id, username, first_name, last_name, status, is_bot, is_senior_courier, photo_url, joined_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (user_id) DO UPDATE SET
                            username = EXCLUDED.username,
                            first_name = EXCLUDED.first_name,
                            last_name = EXCLUDED.last_name,
                            status = EXCLUDED.status,
                            is_bot = EXCLUDED.is_bot,
                            is_senior_courier = EXCLUDED.is_senior_courier,
                            photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url)
                        RETURNING id
                        """,
                        (
                            member['user_id'],
                            member.get('username'),
                            member.get('first_name', ''),
                            member.get('last_name', ''),
                            member.get('status', 'member'),
                            member.get('is_bot', False),
                            member.get('senior_courier') is True,
                            member.get('photo_url'),
                            datetime.fromisoformat(member.get('joined_date', datetime.now().isoformat()))
                        )
                    )
                    member_id = cursor.fetchone()[0]
                    logger.info(f"Участник сохранен с ID: {member_id}")
                    
                    # Определяем роль участника
                    role = 'member'
                    if admins and any(a['user_id'] == member['user_id'] for a in admins):
                        role = 'admin'
                    if member.get('senior_courier'):
                        role = 'senior_courier'
                    if group_type == 'chef' and member.get('senior_chef'):
                        role = 'senior_chef'
                    
                    logger.info(f"Роль участника: {role}")
                    
                    # Сохраняем связь между группой и участником
                    cursor.execute(
                        """
                        INSERT INTO group_members (group_id, member_id)
                        VALUES (%s, %s)
                        ON CONFLICT (group_id, member_id) DO NOTHING
                        """,
                        (
                            group_id,
                            member_id
                        )
                    )
                    logger.info(f"Связь между группой и участником сохранена")
                
                self.conn.commit()
                logger.info(f"✅ Группа {chat_title} (тип: {group_type}) успешно сохранена в базе данных")
                return group_id
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Ошибка при сохранении группы {chat_title}: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def get_group_data(self, chat_id: str) -> Optional[Dict]:
        """Получает данные группы из базы данных"""
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT g.*, array_agg(
                        json_build_object(
                            'id', m.id,
                            'user_id', m.user_id,
                            'username', m.username,
                            'first_name', m.first_name,
                            'last_name', m.last_name,
                            'status', m.status,
                            'is_bot', m.is_bot,
                            'photo_url', m.photo_url,
                            'role', gm.role
                        )
                    ) as members
                    FROM groups g
                    LEFT JOIN group_members gm ON g.id = gm.group_id
                    LEFT JOIN members m ON gm.member_id = m.id
                    WHERE g.chat_id = %s
                    GROUP BY g.id
                    """,
                    (chat_id,)
                )
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"❌ Ошибка при получении данных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None
    
    def get_groups_by_type(self, group_type: str) -> List[Dict]:
        """Получает список групп определенного типа"""
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT * FROM groups WHERE group_type = %s
                    """,
                    (group_type,)
                )
                results = cursor.fetchall()
                return [dict(row) for row in results]
        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка групп типа {group_type}: {e}")
            logger.error(traceback.format_exc())
            return []
    
    def delete_group(self, chat_id: str) -> bool:
        """Удаляет группу из базы данных"""
        try:
            with self.conn.cursor() as cursor:
                cursor.execute("DELETE FROM groups WHERE chat_id = %s", (chat_id,))
                deleted = cursor.rowcount > 0
                self.conn.commit()
                if deleted:
                    logger.info(f"✅ Группа {chat_id} успешно удалена из базы данных")
                return deleted
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Ошибка при удалении группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False
    
    def get_groups_by_user_id(self, user_id: int) -> List[Dict]:
        """Получает список групп, в которых состоит пользователь"""
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT g.id, g.chat_id, g.chat_title, g.group_type, g.last_updated, 
                           m.id as member_id, m.user_id, m.username, m.first_name, m.last_name, 
                           m.photo_url, gm.role
                    FROM groups g
                    JOIN group_members gm ON g.id = gm.group_id
                    JOIN members m ON gm.member_id = m.id
                    WHERE m.user_id = %s
                    """,
                    (user_id,)
                )
                results = cursor.fetchall()
                
                # Форматируем результаты для совместимости с существующим API
                user_groups = []
                user_data = None
                
                for row in results:
                    # Добавляем группу в список
                    user_groups.append({
                        'chat_id': row['chat_id'],
                        'chat_title': row['chat_title'],
                        'group_type': row['group_type']
                    })
                    
                    # Если данные пользователя еще не установлены
                    if user_data is None:
                        is_senior = row['role'] in ['senior_courier', 'senior_chef']
                        user_data = {
                            'user_id': row['user_id'],
                            'first_name': row['first_name'] or '',
                            'last_name': row['last_name'] or '',
                            'photo_url': row['photo_url'],
                            'is_senior_courier': is_senior and row['group_type'] == 'courier'
                        }
                
                logger.info(f"✅ Найдено {len(user_groups)} групп для пользователя {user_id}")
                return {
                    'success': True,
                    'groups': user_groups,
                    'user_data': user_data
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка при получении групп пользователя {user_id}: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'groups': [],
                'user_data': None
            }
    
    def migrate_from_json(self, courier_service, json_service) -> Dict:
        """Мигрирует данные из JSON-файлов в базу данных"""
        stats = {"groups": 0, "members": 0, "errors": 0}
        
        try:
            # Получаем все курьерские группы
            courier_groups = courier_service.get_all_courier_groups()
            
            for chat_id, group_data in courier_groups.items():
                try:
                    # Получаем данные группы
                    group = courier_service.get_group_data(chat_id)
                    if not group:
                        continue
                    
                    # Сохраняем группу в базе данных
                    self.save_group(
                        chat_id=chat_id,
                        chat_title=group.get('chat_title', 'Неизвестная группа'),
                        members=group.get('members', []),
                        admins=group.get('admins', [])
                    )
                    
                    stats["groups"] += 1
                    stats["members"] += len(group.get('members', []))
                    
                except Exception as e:
                    logger.error(f"❌ Ошибка при миграции группы {chat_id}: {e}")
                    stats["errors"] += 1
            
            logger.info(f"✅ Миграция завершена: {stats['groups']} групп, {stats['members']} участников, {stats['errors']} ошибок")
            return stats
            
        except Exception as e:
            logger.error(f"❌ Ошибка при миграции данных: {e}")
            logger.error(traceback.format_exc())
            return stats 