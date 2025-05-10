import os
import json
import logging
from pathlib import Path

# Настройка логгера
logger = logging.getLogger(__name__)

# Абсолютный путь к директории приложения
APP_DIR = Path('/app')  # Корневая директория приложения

def get_user_data(user_id):
    """Получает данные пользователя из файлов с группами курьеров"""
    try:
        courier_groups_dir = os.path.join(APP_DIR, 'telegramNinjaBot', 'data', 'courier_groups')
        
        if not os.path.exists(courier_groups_dir):
            return {'first_name': None, 'last_name': None, 'photo_url': None}
            
        for filename in os.listdir(courier_groups_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(courier_groups_dir, filename)
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    group_data = json.load(f)
                    
                    for member in group_data.get('members', []):
                        if str(member.get('user_id')) == str(user_id):
                            return {
                                'first_name': member.get('first_name'),
                                'last_name': member.get('last_name'),
                                'photo_url': member.get('photo_url')
                            }
        
        return {'first_name': None, 'last_name': None, 'photo_url': None}
    except Exception as e:
        logger.error(f'Error getting user data: {str(e)}')
        return {'first_name': None, 'last_name': None, 'photo_url': None}

def get_courier_status_in_chat(user_id, chat_id):
    """Получает статус курьера в определенном чате"""
    try:
        courier_groups_dir = os.path.join(APP_DIR, 'telegramNinjaBot', 'data', 'courier_groups')
        
        if not os.path.exists(courier_groups_dir):
            return {'is_senior_courier': False}
        
        # Проверяем файл конкретной группы
        group_file = os.path.join(courier_groups_dir, f'group_{chat_id}.json')
        if os.path.exists(group_file):
            with open(group_file, 'r', encoding='utf-8') as f:
                group_data = json.load(f)
                
                for member in group_data.get('members', []):
                    if str(member.get('user_id')) == str(user_id):
                        return {
                            'is_senior_courier': bool(member.get('senior_courier')),
                            'first_name': member.get('first_name'),
                            'last_name': member.get('last_name')
                        }
        
        # Если файл группы не найден или пользователь не найден
        return {'is_senior_courier': False}
    except Exception as e:
        logger.error(f'Error getting courier status: {str(e)}')
        return {'is_senior_courier': False}

def get_user_groups(user_id: int) -> dict:
    """Получает список групп, в которых состоит пользователь, и его данные"""
    try:
        user_groups = []
        user_data = None
        courier_groups_dir = os.path.join(APP_DIR, 'telegramNinjaBot', 'data', 'courier_groups')
        
        if not os.path.exists(courier_groups_dir):
            logger.warning(f'Директория групп не найдена: {courier_groups_dir}')
            return {'success': True, 'groups': [], 'user_data': None}

        logger.info(f'Поиск групп пользователя {user_id} в директории: {courier_groups_dir}')

        # Проверяем каждый файл группы
        for filename in os.listdir(courier_groups_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(courier_groups_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        group_data = json.load(f)
                        logger.info(f'Проверка файла группы: {filename}')
                        
                        # Ищем пользователя в списке участников
                        member = next(
                            (m for m in group_data.get('members', []) 
                             if str(m.get('user_id')) == str(user_id)),
                            None
                        )
                        
                        if member:
                            # Если это первая найденная группа, сохраняем данные пользователя
                            if user_data is None:
                                user_data = {
                                    'first_name': member.get('first_name', ''),
                                    'last_name': member.get('last_name', ''),
                                    'photo_url': member.get('photo_url'),
                                    'is_senior_courier': member.get('senior_courier', False)
                                }
                            
                            user_groups.append({
                                'chat_id': group_data.get('chat_id'),
                                'chat_title': group_data.get('chat_title'),
                                'group_type': 'courier'
                            })
                            logger.info(f'Пользователь найден в группе: {group_data.get("chat_title")}')
                except Exception as e:
                    logger.error(f'Ошибка при чтении файла {filename}: {str(e)}')
                    continue

        logger.info(f'Найдено групп: {len(user_groups)}')
        return {
            'success': True, 
            'groups': user_groups, 
            'user_data': user_data
        }
    except Exception as e:
        logger.error(f'Ошибка при получении групп пользователя: {str(e)}')
        return {'success': False, 'error': str(e)} 