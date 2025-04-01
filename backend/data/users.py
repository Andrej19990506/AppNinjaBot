import os
import json
import logging
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Настройка логгера
logger = logging.getLogger(__name__)

# Абсолютный путь к директории приложения
APP_DIR = Path('/app')  # Корневая директория приложения

def get_postgres_connection():
    """Создает соединение с PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host="postgres",
            port=5432,
            database="appninjabot",
            user="postgres",
            password="postgres"
        )
        return conn
    except Exception as e:
        logger.error(f"Ошибка при подключении к PostgreSQL: {str(e)}")
        return None

def get_user_data(user_id):
    """Получает данные пользователя из базы данных"""
    try:
        conn = get_postgres_connection()
        if not conn:
            return {'first_name': None, 'last_name': None, 'photo_url': None}
            
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Ищем пользователя в базе данных
            cursor.execute("""
                SELECT first_name, last_name, photo_url 
                FROM members 
                WHERE user_id = %s 
                LIMIT 1
            """, (user_id,))
            
            user_data = cursor.fetchone()
            if user_data:
                return {
                    'first_name': user_data.get('first_name'),
                    'last_name': user_data.get('last_name'),
                    'photo_url': user_data.get('photo_url')
                }
            
            # Если пользователь не найден в базе данных, возвращаем пустые значения
            return {'first_name': None, 'last_name': None, 'photo_url': None}
    except Exception as e:
        logger.error(f'Error getting user data from database: {str(e)}')
        return {'first_name': None, 'last_name': None, 'photo_url': None}
    finally:
        if conn:
            conn.close()

def get_courier_status_in_chat(user_id, chat_id):
    """Получает статус курьера в определенном чате из базы данных"""
    try:
        conn = get_postgres_connection()
        if not conn:
            return {'is_senior_courier': False}
        
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Сначала получаем ID участника по user_id
            cursor.execute("SELECT id FROM members WHERE user_id = %s", (user_id,))
            member = cursor.fetchone()
            
            if not member:
                return {'is_senior_courier': False}
            
            member_id = member['id']
            
            # Затем получаем ID группы по chat_id
            cursor.execute("SELECT id FROM groups WHERE chat_id = %s", (chat_id,))
            group = cursor.fetchone()
            
            if not group:
                return {'is_senior_courier': False}
            
            group_id = group['id']
            
            # Теперь ищем связь между участником и группой
            cursor.execute("""
                SELECT gm.role, m.first_name, m.last_name 
                FROM group_members gm
                JOIN members m ON gm.member_id = m.id
                WHERE gm.member_id = %s AND gm.group_id = %s
            """, (member_id, group_id))
            
            relation = cursor.fetchone()
            
            if relation:
                # Определяем, является ли участник старшим курьером
                is_senior = relation.get('role') in ['senior_courier', 'admin', 'creator']
                return {
                    'is_senior_courier': is_senior,
                    'first_name': relation.get('first_name', ''),
                    'last_name': relation.get('last_name', '')
                }
        
        # Если связь не найдена
        return {'is_senior_courier': False}
    except Exception as e:
        logger.error(f'Error getting courier status from database: {str(e)}')
        return {'is_senior_courier': False}
    finally:
        if conn:
            conn.close()

def get_groups_from_database():
    """Получает все группы из базы данных"""
    conn = get_postgres_connection()
    if not conn:
        return []
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT * FROM groups")
            groups = cursor.fetchall()
            return groups
    except Exception as e:
        logger.error(f"Ошибка при запросе групп из базы данных: {str(e)}")
        return []
    finally:
        conn.close()

def get_user_groups(user_id: int) -> dict:
    """Получает список групп, в которых состоит пользователь, и его данные"""
    try:
        user_groups = []
        
        # Получаем данные из базы данных PostgreSQL
        logger.info(f"Получение групп пользователя {user_id} из базы данных PostgreSQL")
        
        conn = get_postgres_connection()
        if not conn:
            logger.error("Не удалось подключиться к базе данных PostgreSQL")
            return {'success': False, 'error': 'Ошибка подключения к базе данных'}
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Сначала получаем ID участника
                cursor.execute("SELECT id, first_name, last_name, photo_url FROM members WHERE user_id = %s", (user_id,))
                member = cursor.fetchone()
                
                if member:
                    member_id = member['id']
                    
                    # Сохраняем данные пользователя
                    user_data = {
                        'first_name': member.get('first_name', ''),
                        'last_name': member.get('last_name', ''),
                        'photo_url': member.get('photo_url'),
                        'is_senior_courier': None  # Будет обновлено ниже
                    }
                    
                    # Получаем группы пользователя
                    cursor.execute("""
                        SELECT g.id, g.chat_id, g.chat_title, g.group_type, gm.role
                        FROM groups g
                        JOIN group_members gm ON g.id = gm.group_id
                        WHERE gm.member_id = %s
                    """, (member_id,))
                    
                    user_memberships = cursor.fetchall()
                    logger.info(f"Найдено {len(user_memberships)} групп для пользователя {user_id}")
                    
                    if user_memberships:
                        # Проверяем, является ли пользователь старшим курьером хотя бы в одной группе
                        for membership in user_memberships:
                            if membership.get('role') in ['senior_courier', 'admin', 'creator'] and user_data['is_senior_courier'] is None:
                                user_data['is_senior_courier'] = True
                        
                        # Собираем список групп
                        for membership in user_memberships:
                            user_groups.append({
                                'chat_id': membership.get('chat_id'),
                                'chat_title': membership.get('chat_title'),
                                'group_type': membership.get('group_type')
                            })
                            logger.info(f"Пользователь найден в группе: {membership.get('chat_title')} (тип: {membership.get('group_type')})")
                else:
                    # Если пользователь не найден в базе данных, возвращаем пустые данные
                    user_data = {
                        'first_name': '',
                        'last_name': '',
                        'photo_url': None,
                        'is_senior_courier': None
                    }
        finally:
            conn.close()
        
        # Если is_senior_courier не был установлен, устанавливаем его в False
        if user_data.get('is_senior_courier') is None:
            user_data['is_senior_courier'] = False
        
        logger.info(f'Найдено групп: {len(user_groups)}')
        return {
            'success': True, 
            'groups': user_groups, 
            'user_data': user_data
        }
    except Exception as e:
        logger.error(f'Ошибка при получении групп пользователя из базы данных: {str(e)}')
        return {'success': False, 'error': str(e)}

def add_member_to_database(user_id, username, first_name, last_name, photo_url, status='member'):
    """Добавляет нового участника в базу данных"""
    try:
        conn = get_postgres_connection()
        if not conn:
            logger.error("Не удалось подключиться к базе данных PostgreSQL")
            return None
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Проверяем, существует ли участник
                cursor.execute("SELECT id FROM members WHERE user_id = %s", (user_id,))
                existing_member = cursor.fetchone()
                
                if existing_member:
                    # Если участник существует, обновляем его данные
                    cursor.execute("""
                        UPDATE members 
                        SET username = %s, first_name = %s, last_name = %s, photo_url = %s, status = %s
                        WHERE user_id = %s
                        RETURNING id
                    """, (
                        username,
                        first_name,
                        last_name,
                        photo_url,
                        status,
                        user_id
                    ))
                    member = cursor.fetchone()
                else:
                    # Если участник не существует, создаем его
                    cursor.execute("""
                        INSERT INTO members 
                        (user_id, username, first_name, last_name, status, photo_url)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        user_id,
                        username,
                        first_name,
                        last_name,
                        status,
                        photo_url
                    ))
                    member = cursor.fetchone()
                
                conn.commit()
                return member['id'] if member else None
        except Exception as e:
            conn.rollback()
            logger.error(f"Ошибка при добавлении участника в базу данных: {str(e)}")
            return None
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
        return None

def add_group_to_database(chat_id, chat_title, group_type, metadata=None):
    """Добавляет новую группу в базу данных"""
    try:
        conn = get_postgres_connection()
        if not conn:
            logger.error("Не удалось подключиться к базе данных PostgreSQL")
            return None
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Проверяем, существует ли группа
                cursor.execute("SELECT id FROM groups WHERE chat_id = %s", (chat_id,))
                existing_group = cursor.fetchone()
                
                if existing_group:
                    # Если группа существует, обновляем ее данные
                    cursor.execute("""
                        UPDATE groups 
                        SET chat_title = %s, group_type = %s, last_updated = CURRENT_TIMESTAMP, metadata = %s
                        WHERE chat_id = %s
                        RETURNING id
                    """, (
                        chat_title,
                        group_type,
                        metadata or {},
                        chat_id
                    ))
                    group = cursor.fetchone()
                else:
                    # Если группа не существует, создаем ее
                    cursor.execute("""
                        INSERT INTO groups 
                        (chat_id, chat_title, group_type, metadata)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                    """, (
                        chat_id,
                        chat_title,
                        group_type,
                        metadata or {}
                    ))
                    group = cursor.fetchone()
                
                conn.commit()
                return group['id'] if group else None
        except Exception as e:
            conn.rollback()
            logger.error(f"Ошибка при добавлении группы в базу данных: {str(e)}")
            return None
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
        return None

def add_member_to_group(member_id, group_id, role='member'):
    """Добавляет участника в группу"""
    try:
        conn = get_postgres_connection()
        if not conn:
            logger.error("Не удалось подключиться к базе данных PostgreSQL")
            return False
        
        try:
            with conn.cursor() as cursor:
                # Проверяем, существует ли связь
                cursor.execute(
                    "SELECT id FROM group_members WHERE member_id = %s AND group_id = %s", 
                    (member_id, group_id)
                )
                existing_relation = cursor.fetchone()
                
                if existing_relation:
                    # Если связь существует, обновляем ее
                    cursor.execute(
                        "UPDATE group_members SET role = %s WHERE member_id = %s AND group_id = %s", 
                        (role, member_id, group_id)
                    )
                else:
                    # Если связи нет, создаем ее
                    cursor.execute(
                        "INSERT INTO group_members (member_id, group_id, role) VALUES (%s, %s, %s)", 
                        (member_id, group_id, role)
                    )
                
                conn.commit()
                return True
        except Exception as e:
            conn.rollback()
            logger.error(f"Ошибка при добавлении участника в группу: {str(e)}")
            return False
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
        return False

def save_chat_members_to_database(chat_id, chat_title, members, group_type='courier'):
    """Сохраняет участников чата в базу данных"""
    try:
        # Добавляем группу в базу данных
        metadata = {
            'created_at': str(datetime.now().isoformat()),
            'total_members': len(members),
            'total_admins': sum(1 for m in members if m.get('status') in ['administrator', 'creator'])
        }
        
        group_id = add_group_to_database(chat_id, chat_title, group_type, metadata)
        
        if not group_id:
            logger.error(f"Не удалось добавить группу {chat_title} в базу данных")
            return False
        
        # Добавляем каждого участника в базу данных и связываем с группой
        for member in members:
            user_id = member.get('user_id')
            username = member.get('username')
            first_name = member.get('first_name', '')
            last_name = member.get('last_name', '')
            photo_url = member.get('photo_url')
            status = member.get('status', 'member')
            
            # Определяем роль в группе
            role = 'member'
            if status == 'creator':
                role = 'creator'
            elif status == 'administrator':
                role = 'admin'
            elif member.get('senior_courier'):
                role = 'senior_courier'
            
            # Добавляем участника в базу данных
            member_id = add_member_to_database(user_id, username, first_name, last_name, photo_url, status)
            
            if not member_id:
                logger.error(f"Не удалось добавить участника {first_name} {last_name} в базу данных")
                continue
            
            # Связываем участника с группой
            success = add_member_to_group(member_id, group_id, role)
            
            if not success:
                logger.error(f"Не удалось связать участника {first_name} {last_name} с группой {chat_title}")
        
        return True
    except Exception as e:
        logger.error(f"Ошибка при сохранении участников чата в базу данных: {str(e)}")
        return False 