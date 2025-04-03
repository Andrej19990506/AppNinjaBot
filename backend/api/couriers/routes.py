"""
Маршруты для работы с курьерами
"""
import json
import logging
import traceback
import os
import datetime
from flask import request, jsonify, current_app
from typing import Dict, Any, Optional
from psycopg2.extras import RealDictCursor

from . import couriers_bp
from data.users import get_user_data, get_courier_status_in_chat, get_user_groups, get_postgres_connection

# Получаем глобальный экземпляр group_service
try:
    from telegramNinjaBot.bot import group_service as glob_group_service
except ImportError:
    # Для случаев, когда импорт невозможен
    glob_group_service = None

# Логгер
logger = logging.getLogger(__name__)

@couriers_bp.route('/<int:user_id>/groups', methods=['GET'])
def get_user_groups_route(user_id):
    """Получение списка групп, в которых состоит пользователь"""
    try:
        logger.info(f'Получение групп пользователя {user_id}')
        
        # Проверяем наличие group_service 
        if hasattr(current_app, 'group_service') and current_app.group_service:
            logger.info('Используем current_app.group_service для получения групп пользователя')
            result = current_app.group_service.get_groups_by_user_id(user_id)
        elif glob_group_service:
            # Используем глобальный экземпляр group_service
            logger.info('Используем глобальный group_service для получения групп пользователя')
            result = glob_group_service.get_groups_by_user_id(user_id)
        else:
            # Для обратной совместимости используем старый метод
            logger.info('group_service не найден, используем get_user_groups напрямую')
            result = get_user_groups(user_id)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f'Ошибка при получении групп пользователя: {str(e)}')
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@couriers_bp.route('/<int:courier_id>/status', methods=['GET'])
def get_courier_status(courier_id):
    """Получение статуса курьера"""
    try:
        # Получаем chat_id из параметров запроса
        request_chat_id = request.args.get('chat_id')
        logger.info(f"=== Получение статуса курьера {courier_id} ===")
        logger.info(f"Chat ID из запроса: {request_chat_id}")
        
        # Подключаемся к базе данных
        conn = get_postgres_connection()
        if not conn:
            return jsonify({'error': 'Ошибка подключения к базе данных'}), 500

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Получаем данные пользователя
                cursor.execute("""
                    SELECT m.id, m.user_id, m.first_name, m.last_name, m.username, m.photo_url,
                           gm.role, g.chat_id
                    FROM members m
                    LEFT JOIN group_members gm ON m.id = gm.member_id
                    LEFT JOIN groups g ON gm.group_id = g.id
                    WHERE m.user_id = %s
                    AND (g.chat_id = %s OR %s IS NULL)
                    LIMIT 1
                """, (courier_id, request_chat_id, request_chat_id))
                
                user_data = cursor.fetchone()
                
                if not user_data:
                    logger.error(f"Пользователь {courier_id} не найден")
                    return jsonify({
                        'error': 'User not found',
                        'status': 'not_found'
                    }), 404

                # Определяем статус пользователя
                is_senior_courier = user_data.get('role') in ['senior_courier', 'admin', 'creator']
                is_admin = user_data.get('role') in ['admin', 'creator']
                
                # Формируем ответ
                response = {
                    'user_id': courier_id,
                    'first_name': user_data.get('first_name', ''),
                    'last_name': user_data.get('last_name', ''),
                    'username': user_data.get('username', ''),
                    'photo_url': user_data.get('photo_url', ''),
                    'chat_id': user_data.get('chat_id'),
                    'is_admin': is_admin,
                    'is_senior_courier': is_senior_courier,
                    'active_session': None,
                    'wallet': {
                        'balance': 0,
                        'transactions_count': 0
                    },
                    'status': 'active'
                }
                
                logger.info(f"Возвращаем статус курьера: {response}")
                return jsonify(response)
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error getting courier status for courier {courier_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/<int:courier_id>/promote', methods=['POST'])
def promote_courier(courier_id):
    """Повышение курьера до администратора"""
    try:
        # Проверяем аутентификацию
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not auth_token:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Подключаемся к базе данных
        conn = get_postgres_connection()
        if not conn:
            return jsonify({'error': 'Ошибка подключения к базе данных'}), 500

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Получаем данные пользователя
                cursor.execute("""
                    SELECT m.id, m.first_name, m.last_name,
                           g.id as group_id, g.chat_id
                    FROM members m
                    JOIN group_members gm ON m.id = gm.member_id
                    JOIN groups g ON gm.group_id = g.id
                    WHERE m.user_id = %s
                    LIMIT 1
                """, (courier_id,))
                
                user_data = cursor.fetchone()
                
                if not user_data:
                    return jsonify({'error': 'User not found'}), 404

                # Проверяем, является ли пользователь уже админом
                cursor.execute("""
                    SELECT role
                    FROM group_members
                    WHERE member_id = %s AND group_id = %s
                """, (user_data['id'], user_data['group_id']))
                
                member_role = cursor.fetchone()
                
                if member_role and member_role['role'] in ['admin', 'creator']:
                    return jsonify({
                        'status': 'already_admin',
                        'message': 'User is already an admin'
                    })

                # Обновляем роль пользователя
                cursor.execute("""
                    UPDATE group_members
                    SET role = 'admin'
                    WHERE member_id = %s AND group_id = %s
                    RETURNING role
                """, (user_data['id'], user_data['group_id']))
                
                conn.commit()
                
                return jsonify({
                    'status': 'success',
                    'message': 'User promoted to admin successfully'
                })
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error promoting courier {courier_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/<int:courier_id>/demote', methods=['POST'])
def demote_courier(courier_id):
    """Понижение курьера из администраторов"""
    try:
        # Проверяем аутентификацию
        auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not auth_token:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Подключаемся к базе данных
        conn = get_postgres_connection()
        if not conn:
            return jsonify({'error': 'Ошибка подключения к базе данных'}), 500

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Получаем данные пользователя
                cursor.execute("""
                    SELECT m.id, m.first_name, m.last_name,
                           g.id as group_id, g.chat_id
                    FROM members m
                    JOIN group_members gm ON m.id = gm.member_id
                    JOIN groups g ON gm.group_id = g.id
                    WHERE m.user_id = %s
                    LIMIT 1
                """, (courier_id,))
                
                user_data = cursor.fetchone()
                
                if not user_data:
                    return jsonify({'error': 'User not found'}), 404

                # Проверяем, является ли пользователь админом
                cursor.execute("""
                    SELECT role
                    FROM group_members
                    WHERE member_id = %s AND group_id = %s
                """, (user_data['id'], user_data['group_id']))
                
                member_role = cursor.fetchone()
                
                if not member_role or member_role['role'] not in ['admin']:
                    return jsonify({
                        'status': 'not_admin',
                        'message': 'User is not an admin'
                    })

                # Понижаем пользователя до обычного курьера
                cursor.execute("""
                    UPDATE group_members
                    SET role = 'courier'
                    WHERE member_id = %s AND group_id = %s
                """, (user_data['id'], user_data['group_id']))
                
                conn.commit()

                # Отправляем уведомление в бот
                try:
                    # Получаем данные админа, который выполняет понижение
                    cursor.execute("""
                        SELECT first_name
                        FROM members
                        WHERE user_id = %s
                    """, (auth_token,))
                    
                    admin_data = cursor.fetchone()
                    admin_name = admin_data['first_name'] if admin_data else 'Admin'
                    
                    message = f"⬇️ {user_data['first_name']} {user_data['last_name']} был(а) понижен(а) из администраторов пользователем {admin_name}"
                    current_app.send_telegram_message(user_data['chat_id'], message)
                except Exception as e:
                    logger.error(f"Error sending notification to Telegram: {str(e)}")

                return jsonify({
                    'status': 'success',
                    'message': 'User demoted from admin successfully'
                })
        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error demoting courier {courier_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/profile/<int:user_id>', methods=['PUT', 'OPTIONS'])
def update_courier_profile(user_id):
    """Обновление профиля курьера"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'PUT')
        return response

    try:
        data = request.get_json()
        first_name = data.get('firstName')
        last_name = data.get('lastName')
        is_senior_courier = data.get('isSeniorCourier', False)

        if not first_name or not last_name:
            return jsonify({'error': 'Необходимо указать имя и фамилию'}), 400

        # Подключаемся к базе данных
        conn = get_postgres_connection()
        if not conn:
            return jsonify({'error': 'Ошибка подключения к базе данных'}), 500

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Проверяем существование пользователя
                cursor.execute("""
                    SELECT id, first_name, last_name, photo_url
                    FROM members 
                    WHERE user_id = %s
                """, (user_id,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'error': 'Пользователь не найден'}), 404

                # Обновляем данные пользователя
                cursor.execute("""
                    UPDATE members 
                    SET first_name = %s, last_name = %s
                    WHERE user_id = %s
                    RETURNING id, first_name, last_name, photo_url
                """, (first_name, last_name, user_id))
                
                conn.commit()
                updated_user = cursor.fetchone()

                # Если пользователь является старшим курьером, обновляем его роль во всех группах
                if is_senior_courier:
                    cursor.execute("""
                        UPDATE group_members
                        SET role = 'senior_courier'
                        WHERE member_id = %s AND role = 'courier'
                    """, (user['id'],))
                    conn.commit()

                return jsonify({
                    'status': 'success',
                    'message': 'Профиль успешно обновлен',
                    'user': {
                        'user_id': user_id,
                        'first_name': updated_user['first_name'],
                        'last_name': updated_user['last_name'],
                        'photo_url': updated_user['photo_url'],
                        'is_senior_courier': is_senior_courier
                    }
                })

        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error updating courier profile for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/password/change-request/<int:user_id>', methods=['POST'])
def courier_password_change_request(user_id):
    """Запрос на смену пароля курьера"""
    try:
        data = request.get_json()
        
        # Генерируем код подтверждения
        import random
        confirmation_code = str(random.randint(100000, 999999))
        
        # Загружаем данные пользователя
        user_data = get_user_data(user_id)
        
        if not user_data:
            return jsonify({'error': 'Пользователь не найден'}), 404
            
        chat_id = user_data.get('chat_id')
        
        # Загружаем/создаем данные кодов подтверждения
        from pathlib import Path
        data_dir = Path(current_app.config.get('APP_DIR', '')) / 'telegramNinjaBot' / 'data'
        codes_file = data_dir / 'confirmation_codes.json'
        
        codes_data = {}
        if codes_file.exists():
            with open(codes_file, 'r', encoding='utf-8') as f:
                try:
                    codes_data = json.load(f)
                except json.JSONDecodeError:
                    codes_data = {}
        
        # Сохраняем код для пользователя
        codes_data[str(user_id)] = {
            'code': confirmation_code,
            'timestamp': int(datetime.datetime.now().timestamp()),
            'type': 'password_change'
        }
        
        with open(codes_file, 'w', encoding='utf-8') as f:
            json.dump(codes_data, f, ensure_ascii=False, indent=2)
        
        # Отправляем код пользователю через бот
        try:
            message = f"🔐 Код подтверждения для смены пароля: {confirmation_code}\n\nЕсли вы не запрашивали смену пароля, проигнорируйте это сообщение."
            current_app.send_telegram_message(user_id, message, is_user_id=True)
            
            return jsonify({
                'status': 'success',
                'message': 'Код подтверждения отправлен'
            })
        except Exception as e:
            logger.error(f"Error sending confirmation code to user {user_id}: {str(e)}")
            return jsonify({'error': 'Не удалось отправить код подтверждения'}), 500
    except Exception as e:
        logger.error(f"Error processing password change request for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@couriers_bp.route('/password/verify', methods=['POST'])
def verify_courier_password():
    """Проверка кода подтверждения для смены пароля"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        confirmation_code = data.get('code')
        new_password = data.get('new_password')
        
        if not user_id or not confirmation_code or not new_password:
            return jsonify({'error': 'Не указаны обязательные параметры'}), 400
        
        # Загружаем данные кодов подтверждения
        from pathlib import Path
        import datetime
        
        data_dir = Path(current_app.config.get('APP_DIR', '')) / 'telegramNinjaBot' / 'data'
        codes_file = data_dir / 'confirmation_codes.json'
        
        if not codes_file.exists():
            return jsonify({'error': 'Код подтверждения не найден'}), 404
        
        with open(codes_file, 'r', encoding='utf-8') as f:
            try:
                codes_data = json.load(f)
            except json.JSONDecodeError:
                return jsonify({'error': 'Код подтверждения не найден'}), 404
        
        # Проверяем код пользователя
        user_code_data = codes_data.get(str(user_id))
        
        if not user_code_data:
            return jsonify({'error': 'Код подтверждения не найден'}), 404
        
        if user_code_data.get('type') != 'password_change':
            return jsonify({'error': 'Неверный тип кода подтверждения'}), 400
        
        # Проверяем время действия кода (30 минут)
        timestamp = user_code_data.get('timestamp', 0)
        now = int(datetime.datetime.now().timestamp())
        
        if now - timestamp > 30 * 60:
            return jsonify({'error': 'Код подтверждения истек'}), 400
        
        # Проверяем сам код
        if user_code_data.get('code') != confirmation_code:
            return jsonify({'error': 'Неверный код подтверждения'}), 400
        
        # Обновляем пароль пользователя
        passwords_file = data_dir / 'passwords.json'
        
        passwords_data = {}
        if passwords_file.exists():
            with open(passwords_file, 'r', encoding='utf-8') as f:
                try:
                    passwords_data = json.load(f)
                except json.JSONDecodeError:
                    passwords_data = {}
        
        # Хешируем пароль
        import hashlib
        password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        
        # Сохраняем новый пароль
        passwords_data[str(user_id)] = {
            'hash': password_hash,
            'updated_at': now
        }
        
        with open(passwords_file, 'w', encoding='utf-8') as f:
            json.dump(passwords_data, f, ensure_ascii=False, indent=2)
        
        # Удаляем использованный код
        del codes_data[str(user_id)]
        
        with open(codes_file, 'w', encoding='utf-8') as f:
            json.dump(codes_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'status': 'success',
            'message': 'Пароль успешно изменен'
        })
    except Exception as e:
        logger.error(f"Error verifying password change: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500 