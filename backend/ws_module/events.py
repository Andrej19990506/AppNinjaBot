"""
Обработчики событий Socket.IO
"""
from flask import request, current_app
from flask_socketio import emit, join_room, leave_room
import json
from datetime import datetime
import os
from pathlib import Path

from config import logger, DATA_DIR
# Прямой импорт, чтобы обойти проблему с null bytes
# Удаляем создание локального экземпляра socketio
# from flask_socketio import SocketIO
# socketio = SocketIO()
# from core.extensions import socketio
from .rooms import (
    join_user_to_room, update_user_in_room, remove_user_from_room,
    get_room_name, active_users, GLOBAL_ROOM, CHAT_ROOM_PREFIX
)

# Регистрация обработчиков будет происходить через функции, которые импортируются в app.py
def register_handlers(socketio):
    """
    Регистрирует все обработчики событий на экземпляре socketio
    """
    
    @socketio.on('connect')
    def handle_connect():
        """
        Обработчик подключения клиента
        """
        logger.info('🔌 WebSocket подключение установлено')
        logger.info(f'👤 Сессия: {request.sid}')
        emit('connected', {'status': 'success', 'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        """
        Обработчик отключения клиента
        """
        logger.info('🔌 WebSocket отключение')
        logger.info(f'👤 Сессия: {request.sid}')
        
        # Удаляем пользователя из всех комнат
        for room in list(active_users.keys()):  # Создаем копию ключей словаря
            for user_id, user_info in list(active_users[room].items()):
                if request.sid == user_info.get('socket_id'):
                    del active_users[room][user_id]
                    logger.info(f'👋 Пользователь {user_info.get("first_name")} покинул комнату {room}')
                    
                    # Оповещаем остальных
                    emit('user_left', {
                        'user': user_info,
                        'active_users': list(active_users[room].values())
                    }, room=room)
                    
                    # Удаляем пустую комнату
                    if not active_users[room]:
                        del active_users[room]
                        logger.info(f'🗑️ Комната {room} удалена')
                    break

    @socketio.on('error')
    def handle_error(error):
        """
        Обработчик ошибок
        """
        logger.error('❌ Ошибка WebSocket')
        logger.error(f'👤 Сессия: {request.sid}')
        logger.error(f'Описание: {error}')

    @socketio.on('join')
    def handle_join(data):
        """
        Обработчик присоединения к комнате
        """
        try:
            logger.info(f'🔄 Получено событие JOIN: {json.dumps(data, ensure_ascii=False)}')
            chat_id = data.get('chat_id')
            user_id = data.get('user_id')
            user_info = data.get('user', {}) or data.get('user_info', {})
            force = data.get('force', False) or data.get('force_rejoin', False)
            refresh = data.get('refresh', False)
            
            if not chat_id or not user_id and not user_info.get('id'):
                # Извлекаем user_id из user_info, если он не передан напрямую
                if not user_id and user_info and user_info.get('id'):
                    user_id = user_info.get('id')
                else:
                    logger.error('❌ Ошибка присоединения к комнате: отсутствуют обязательные данные')
                    return {
                        'status': 'error',
                        'message': 'Не указаны обязательные параметры'
                    }
            
            # Логируем дополнительные параметры    
            logger.info(f'🔧 Параметры подключения: force={force}, refresh={refresh}')
            
            # Определяем комнату
            room = get_room_name(chat_id)
            
            # Если force=True, то всегда переподключаем пользователя
            if force:
                logger.info(f'🔄 Принудительное переподключение пользователя к комнате {room}')
                room_info = join_user_to_room(chat_id, user_id, user_info, True)
                
                # Отправляем подтверждение
                emit('joined', {
                    'status': 'success',
                    'chat_id': chat_id,
                    'room': room,
                    'active_users': room_info['active_users'],
                    'user_id': user_id,
                    'forced': True
                })
                return
            
            # Если refresh=True, просто отправляем актуальные данные без переподключения
            if refresh:
                logger.info(f'🔄 Обновление данных о комнате {room} без переподключения')
                room_info = update_user_in_room(chat_id, user_id, user_info)
                
                # Отправляем подтверждение с актуальными данными
                emit('joined', {
                    'status': 'success',
                    'chat_id': chat_id,
                    'room': room,
                    'active_users': room_info['active_users'],
                    'user_id': user_id,
                    'refreshed': True
                })
                return
            
            # Стандартное присоединение к комнате
            room_info = join_user_to_room(chat_id, user_id, user_info, False)
            
            # Проверяем наличие сохраненных уведомлений для пользователя
            try:
                # Путь к файлу уведомлений
                chat_data_dir = DATA_DIR / 'chats' / chat_id
                notifications_path = chat_data_dir / 'notifications.json'
                
                if notifications_path.exists():
                    with open(notifications_path, 'r', encoding='utf-8') as f:
                        try:
                            notifications = json.load(f)
                            if notifications:
                                logger.info(f'📩 Найдено {len(notifications)} сохраненных уведомлений для пользователя')
                                # Отправляем каждое уведомление пользователю
                                for notification in notifications:
                                    emit('inventory_notification', notification)
                                logger.info('✅ Сохраненные уведомления отправлены пользователю')
                                
                                # Очищаем файл уведомлений после успешной отправки
                                with open(notifications_path, 'w', encoding='utf-8') as f:
                                    json.dump([], f)
                        except json.JSONDecodeError:
                            logger.error(f'❌ Ошибка чтения файла уведомлений: {notifications_path}')
            except Exception as e:
                logger.error(f'❌ Ошибка при проверке уведомлений: {str(e)}')
        
        except Exception as e:
            logger.error(f'❌ Ошибка при обработке присоединения к комнате: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('leave')
    def handle_leave(data):
        """
        Обработчик покидания комнаты
        """
        # Получаем данные пользователя
        chat_id = data.get('chat_id')
        user_id = data.get('user_id')
        
        # Проверяем обязательные параметры
        if not chat_id or not user_id:
            logger.error(f'❌ Не указаны обязательные параметры для покидания комнаты: chat_id={chat_id}, user_id={user_id}')
            return {
                'status': 'error',
                'message': 'Не указаны обязательные параметры'
            }
        
        # Удаляем пользователя из комнаты
        remove_user_from_room(chat_id, user_id)

    @socketio.on('ping')
    def handle_ping(data):
        """
        Обработчик пинга от клиента
        """
        # Обновляем активность пользователя
        chat_id = data.get('chat_id')
        user_id = data.get('user_id')
        user_info = data.get('user', {})
        
        # Проверяем обязательные параметры
        if chat_id and user_id:
            # Обновляем информацию о пользователе
            update_user_in_room(chat_id, user_id, user_info)

    @socketio.on('inventory_update')
    def handle_inventory_update(data):
        """
        Обработчик обновления инвентаря
        """
        try:
            logger.info('=== 📦 Получено обновление инвентаря через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }

            # Получаем данные запроса
            chat_id = data.get('chat_id')
            inventory_data = data.get('data')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'📦 Данные: {json.dumps(inventory_data, ensure_ascii=False)}')
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from ws_module.broadcasters import broadcast_inventory_update
            
            # Рассылаем обновление всем в комнате, кроме отправителя
            broadcast_inventory_update(chat_id, inventory_data)
            
            return {
                'status': 'success',
                'message': 'Обновление отправлено'
            }
            
        except Exception as e:
            logger.error('❌ Ошибка обработки обновления инвентаря')
            logger.error(f'Описание: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('admin_update')
    def handle_admin_update(data):
        """
        Обработчик обновления данных админа
        """
        try:
            logger.info('=== 🛠️ Получено обновление данных админа через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }

            # Получаем данные запроса
            chat_id = data.get('chat_id')
            admin_data = data.get('data')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'👤 Данные админа: {json.dumps(admin_data, ensure_ascii=False)}')
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from ws_module.broadcasters import broadcast_admin_update
            
            # Рассылаем обновление всем в комнате
            broadcast_admin_update(chat_id, admin_data)
            
            return {
                'status': 'success',
                'message': 'Обновление отправлено'
            }
            
        except Exception as e:
            logger.error('❌ Ошибка обработки обновления данных админа')
            logger.error(f'Описание: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('writeoff_update')
    def handle_writeoff_update(data):
        """
        Обработчик обновления списаний
        """
        try:
            logger.info('=== 📝 Получено обновление списаний через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }

            # Получаем данные запроса
            chat_id = data.get('chat_id')
            writeoff_data = data.get('data')
            action = data.get('action', 'update')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'🔄 Действие: {action}')
            logger.info(f'📝 Данные списания: {json.dumps(writeoff_data, ensure_ascii=False)}')
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from ws_module.broadcasters import broadcast_write_off_update
            
            # Рассылаем обновление всем в комнате, кроме отправителя
            broadcast_write_off_update(chat_id, writeoff_data, action)
            
            return {
                'status': 'success',
                'message': 'Обновление отправлено'
            }
            
        except Exception as e:
            logger.error('❌ Ошибка обработки обновления списаний')
            logger.error(f'Описание: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('shift_update')
    def handle_shift_update(data):
        """
        Обработчик обновления смен
        """
        try:
            logger.info('=== 🕒 Получено обновление смен через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            logger.info(f'📊 Полные данные запроса: {json.dumps(data, ensure_ascii=False)}')

            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }

            # Получаем данные запроса
            chat_id = data.get('chat_id')
            shift_data = data.get('data', {})
            action = data.get('action', 'update')
            
            # Если data не передан, используем данные из самого объекта
            if not shift_data and isinstance(data, dict):
                shift_data = data
                logger.info('ℹ️ Используем данные из самого объекта запроса как shift_data')
            
            if not chat_id:
                # Пробуем извлечь chat_id из shift_data, если он не передан напрямую
                chat_id = shift_data.get('chat_id')
                logger.info(f'ℹ️ Извлечен chat_id из shift_data: {chat_id}')
                if not chat_id:
                    logger.error('❌ Не указан ID чата')
                    return {
                        'status': 'error',
                        'message': 'Не указан ID чата'
                    }
            
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'🔄 Действие: {action}')
            logger.info(f'🕒 Данные смены: {json.dumps(shift_data, ensure_ascii=False)}')
            
            # Обработка перетаскивания смены (drag-and-drop)
            if shift_data.get('is_drag_action') or action == 'update':
                logger.info('➡️ Обрабатываем drag-and-drop или обновление смены')
                shift_id = shift_data.get('shift_id')
                if shift_id:
                    logger.info(f'📝 Найден ID смены для обновления: {shift_id}')
                    # Импортируем функцию для обновления смены
                    from data.shifts import update_shift, get_shift, _get_shifts_file_path, _ensure_shifts_file
                    
                    # Проверяем доступность файла смен
                    shifts_file_path = _get_shifts_file_path()
                    logger.info(f'📂 Путь к файлу смен: {shifts_file_path}')
                    
                    # Обеспечиваем наличие файла смен
                    _ensure_shifts_file()
                    logger.info('✅ Проверка файла смен выполнена')
                    
                    logger.info('📚 Функции импортированы, проверяем текущую смену...')
                    
                    # Получаем текущую смену для проверки
                    current_shift = get_shift(shift_id)
                    logger.info(f'🔍 Результат get_shift: {json.dumps(current_shift, ensure_ascii=False) if current_shift else "Смена не найдена"}')
                    
                    if not current_shift:
                        logger.error(f'❌ Смена с ID {shift_id} не найдена')
                        return {
                            'status': 'error',
                            'message': f'Смена с ID {shift_id} не найдена'
                        }
                    
                    # Формируем данные для обновления
                    update_data = {
                        'shift_type': shift_data.get('shift_type', current_shift.get('shift_type')),
                        'slot_index': shift_data.get('slot_index', current_shift.get('slot_index')),
                        'updated_at': datetime.now().isoformat()
                    }
                    logger.info(f'🔄 Данные для обновления: {json.dumps(update_data, ensure_ascii=False)}')
                    
                    # Сравниваем, есть ли реальные изменения
                    has_changes = False
                    for key, value in update_data.items():
                        if key != 'updated_at' and str(current_shift.get(key)) != str(value):
                            has_changes = True
                            logger.info(f'📊 Обнаружено изменение в {key}: {current_shift.get(key)} -> {value}')
                    
                    if not has_changes:
                        logger.info('ℹ️ Реальных изменений в смене не обнаружено, но обновим временную метку')
                    
                    # Если это обновление от старшего курьера, добавляем метаданные
                    if shift_data.get('is_senior_update'):
                        update_data['last_modified_by'] = shift_data.get('user_id', 'unknown')
                        update_data['modified_by_senior'] = True
                        logger.info('👑 Добавлены метаданные обновления старшим курьером')
                    
                    # Обновляем смену
                    try:
                        logger.info('🔄 Вызываем функцию update_shift...')
                        # Делаем несколько попыток обновления в случае ошибок
                        max_attempts = 3
                        updated_shift = None
                        
                        for attempt in range(1, max_attempts + 1):
                            try:
                                logger.info(f'📝 Попытка обновления #{attempt}')
                                updated_shift = update_shift(shift_id, update_data)
                                
                                if updated_shift:
                                    logger.info(f'✅ Смена успешно обновлена: {json.dumps(updated_shift, ensure_ascii=False)}')
                                    break
                                else:
                                    logger.error(f'❌ Попытка #{attempt}: Не удалось обновить смену')
                                    if attempt < max_attempts:
                                        logger.info(f'🔄 Ждем перед следующей попыткой...')
                                        import time
                                        time.sleep(0.5)  # Небольшая пауза перед следующей попыткой
                            except Exception as attempt_error:
                                logger.error(f'❌ Ошибка при попытке #{attempt}: {str(attempt_error)}')
                                import traceback
                                logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
                                
                                if attempt < max_attempts:
                                    logger.info(f'🔄 Ждем перед следующей попыткой...')
                                    import time
                                    time.sleep(0.5)
                                else:
                                    raise attempt_error
                        
                        if not updated_shift:
                            logger.error(f'❌ Все попытки обновления смены с ID {shift_id} не удались')
                            return {
                                'status': 'error',
                                'message': f'Не удалось обновить смену с ID {shift_id} после {max_attempts} попыток'
                            }
                            
                    except Exception as update_error:
                        logger.error(f'❌ Критическая ошибка при обновлении смены: {str(update_error)}')
                        import traceback
                        logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
                        return {
                            'status': 'error',
                            'message': f'Ошибка обновления: {str(update_error)}'
                        }
                else:
                    logger.warning('⚠️ Не указан ID смены (shift_id) для обновления')
            else:
                logger.info('ℹ️ Это не drag-and-drop и не обновление, пропускаем вызов update_shift')
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from ws_module.broadcasters import broadcast_shift_update
            
            # Рассылаем обновление всем в комнате, кроме отправителя
            logger.info('📢 Рассылаем обновление через broadcast_shift_update...')
            broadcast_shift_update(chat_id, shift_data, action)
            logger.info('✅ Обновление успешно разослано')
            
            return {
                'status': 'success',
                'message': 'Обновление отправлено и сохранено',
                'shift': updated_shift if 'updated_shift' in locals() else None
            }
            
        except Exception as e:
            logger.error('❌ Ошибка обработки обновления смен')
            logger.error(f'Описание: {str(e)}')
            import traceback
            logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('reserve_update')
    def handle_reserve_update(data):
        """
        Обработчик обновления резервов
        """
        try:
            logger.info('=== 🔒 Получено обновление резервов через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }

            # Получаем данные запроса
            chat_id = data.get('chat_id')
            reserve_data = data.get('data')
            action = data.get('action', 'add')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'🔄 Действие: {action}')
            logger.info(f'🔒 Данные резерва: {json.dumps(reserve_data, ensure_ascii=False)}')
            
            # Импортируем функции для работы с резервами
            from data.reserves import add_reserve, delete_user_reserve, delete_reserve
            
            # Обрабатываем действия
            result = None
            if action == 'add':
                # Проверяем наличие обязательных полей
                if not reserve_data.get('user_id') or not reserve_data.get('date'):
                    logger.error('❌ Не указаны обязательные поля (user_id, date)')
                    return {
                        'status': 'error',
                        'message': 'Необходимо указать user_id и date'
                    }
                
                # Добавляем chat_id в данные резерва, если его там нет
                if 'chat_id' not in reserve_data:
                    reserve_data['chat_id'] = chat_id
                
                # Сохраняем резерв в файл
                try:
                    logger.info('💾 Сохраняем резерв в файл...')
                    result = add_reserve(reserve_data)
                    logger.info(f'✅ Резерв успешно добавлен: {json.dumps(result, ensure_ascii=False)}')
                except Exception as add_err:
                    logger.error(f'❌ Ошибка при добавлении резерва: {str(add_err)}')
                    import traceback
                    logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
                    return {
                        'status': 'error',
                        'message': f'Ошибка добавления резерва: {str(add_err)}'
                    }
            elif action == 'remove':
                # Проверяем что нам передали: ID резерва или user_id + date
                reserve_id = reserve_data.get('id') or reserve_data.get('reserve_id')
                user_id = reserve_data.get('user_id')
                date = reserve_data.get('date')
                
                if reserve_id:
                    # Если передан ID резерва, удаляем по нему
                    logger.info(f'🗑️ Удаляем резерв по ID: {reserve_id}')
                    success = delete_reserve(reserve_id)
                    if success:
                        logger.info(f'✅ Резерв с ID {reserve_id} успешно удален')
                        result = {'id': reserve_id, 'deleted': True}
                    else:
                        logger.warning(f'⚠️ Резерв с ID {reserve_id} не найден')
                        # Возвращаем положительный результат для совместимости с клиентом
                        result = {'id': reserve_id, 'deleted': True, 'not_found': True}
                elif user_id and date:
                    # Если передан user_id и date, удаляем по этим параметрам
                    logger.info(f'🗑️ Удаляем резерв по user_id: {user_id} и date: {date}')
                    deleted_reserve = delete_user_reserve(user_id, date, chat_id)
                    if deleted_reserve:
                        logger.info(f'✅ Резерв пользователя {user_id} на дату {date} успешно удален')
                        result = deleted_reserve
                    else:
                        logger.warning(f'⚠️ Резерв пользователя {user_id} на дату {date} не найден')
                        # Возвращаем положительный результат для совместимости с клиентом
                        result = {'user_id': user_id, 'date': date, 'chat_id': chat_id, 'deleted': True, 'not_found': True}
                else:
                    logger.error('❌ Недостаточно данных для удаления резерва')
                    return {
                        'status': 'error',
                        'message': 'Для удаления резерва необходимо указать либо id, либо user_id и date'
                    }
            else:
                logger.warning(f'⚠️ Неизвестное действие: {action}')
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from ws_module.broadcasters import broadcast_reserve_update
            
            # Если действие было успешным, рассылаем обновление всем в комнате
            if result:
                # Рассылаем обновление всем в комнате, кроме отправителя
                broadcast_reserve_update(chat_id, result or reserve_data, action)
                
                return {
                    'status': 'success',
                    'message': f'Резерв успешно {action == "add" and "добавлен" or "удален"}',
                    'data': result
                }
            else:
                return {
                    'status': 'error',
                    'message': 'Операция с резервом не выполнена'
                }
            
        except Exception as e:
            logger.error('❌ Ошибка обработки обновления резервов')
            logger.error(f'Описание: {str(e)}')
            import traceback
            logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('history_update')
    def handle_history_update(data):
        """
        Обработчик обновления истории
        """
        try:
            logger.info('=== 📜 Получено обновление истории через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')

            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }

            # Получаем данные запроса
            chat_id = data.get('chat_id')
            history_data = data.get('data')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            logger.info(f'🏠 Чат: {chat_id}')
            logger.info(f'📜 Данные истории: {json.dumps(history_data, ensure_ascii=False)}')
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from ws_module.broadcasters import broadcast_history_update
            
            # Рассылаем обновление всем в комнате, кроме отправителя
            broadcast_history_update(chat_id, history_data)
            
            return {
                'status': 'success',
                'message': 'Обновление отправлено'
            }
            
        except Exception as e:
            logger.error('❌ Ошибка обработки обновления истории')
            logger.error(f'Описание: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('book_shift')
    def handle_book_shift(data):
        """
        Обработчик бронирования смены через WebSocket
        """
        try:
            logger.info('=== 📅 Получено бронирование смены через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            logger.info(f'📊 Данные смены: {json.dumps(data, ensure_ascii=False)}')
            
            # Проверяем формат данных
            if not data or not isinstance(data, dict):
                logger.error('❌ Некорректный формат данных')
                return {
                    'status': 'error',
                    'message': 'Некорректный формат данных'
                }
            
            # Извлекаем обязательные поля
            user_id = data.get('user_id')
            date = data.get('date')
            shift_type = data.get('shift_type')
            slot_index = data.get('slot_index')
            chat_id = data.get('chat_id')
            
            if not all([user_id, date, shift_type is not None, slot_index is not None, chat_id]):
                logger.error('❌ Не все обязательные поля предоставлены')
                return {
                    'status': 'error',
                    'message': 'Необходимо предоставить user_id, date, shift_type, slot_index, chat_id'
                }
            
            # Создаем объект user_data из полученных данных
            user_data = {
                'photo_url': data.get('photo_url'),
                'first_name': data.get('first_name'),
                'last_name': data.get('last_name'),
                'is_senior_courier': data.get('is_senior_courier', False)
            }
            
            # Импортируем функцию для бронирования смены
            from data.shifts import book_shift
            
            # Бронируем смену
            try:
                new_shift = book_shift(user_id, date, shift_type, slot_index, chat_id, user_data)
                logger.info(f'✅ Смена успешно забронирована: {json.dumps(new_shift, ensure_ascii=False)}')
                
                # Удаляем пользователя из резерва, если он там был
                try:
                    from data.reserves import delete_user_reserve
                    deleted_reserve = delete_user_reserve(user_id, date, chat_id)
                    if deleted_reserve:
                        logger.info(f'ℹ️ Пользователь {user_id} удален из резерва на дату {date}')
                except Exception as reserve_err:
                    logger.error(f'❌ Ошибка при удалении из резерва: {str(reserve_err)}')
                
                # Импортируем функцию для рассылки обновлений
                from ws_module.broadcasters import broadcast_shift_update
                
                # Оповещаем всех об обновлении смен
                event_data = {
                    'id': new_shift['id'],
                    'date': date,
                    'shift_type': shift_type,
                    'slot_index': slot_index,
                    'user_id': user_id
                }
                broadcast_shift_update(chat_id, event_data, 'book')
                
                # Отправляем событие shift_booked конкретному пользователю
                socketio.emit('shift_booked', new_shift)
                
                return {
                    'status': 'success',
                    'message': 'Смена успешно забронирована',
                    'shift': new_shift
                }
                
            except ValueError as ve:
                logger.error(f'❌ Ошибка валидации при бронировании смены: {str(ve)}')
                return {
                    'status': 'error',
                    'message': str(ve)
                }
                
        except Exception as e:
            logger.error('❌ Ошибка при бронировании смены')
            logger.error(f'Описание: {str(e)}')
            import traceback
            logger.error(traceback.format_exc())
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('update_shift')
    def handle_update_shift(data):
        """
        Обработчик обновления смен для совместимости с фронтендом,
        который отправляет событие update_shift вместо shift_update
        """
        try:
            logger.info('=== 🔄 Получено событие update_shift через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            logger.info(f'📊 Полные данные запроса: {json.dumps(data, ensure_ascii=False)}')
            
            # Перенаправляем запрос в основной обработчик
            return handle_shift_update(data)
            
        except Exception as e:
            logger.error('❌ Ошибка обработки update_shift')
            logger.error(f'Описание: {str(e)}')
            import traceback
            logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('add_to_reserve')
    def handle_add_to_reserve(data):
        """
        Обработчик добавления в резерв для совместимости с фронтендом
        """
        try:
            logger.info('=== 🔒 Получено событие add_to_reserve через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            logger.info(f'📊 Полные данные запроса: {json.dumps(data, ensure_ascii=False)}')
            
            # Преобразуем данные в формат, ожидаемый reserve_update
            reserve_data = {
                'chat_id': data.get('chat_id'),
                'data': data,  # Передаем все данные как есть
                'action': 'add'  # Явно указываем действие add
            }
            
            # Перенаправляем запрос в основной обработчик
            return handle_reserve_update(reserve_data)
            
        except Exception as e:
            logger.error('❌ Ошибка обработки add_to_reserve')
            logger.error(f'Описание: {str(e)}')
            import traceback
            logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('remove_from_reserve')
    def handle_remove_from_reserve(data):
        """
        Обработчик удаления из резерва для совместимости с фронтендом
        """
        try:
            logger.info('=== 🔓 Получено событие remove_from_reserve через WebSocket ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            logger.info(f'📊 Полные данные запроса: {json.dumps(data, ensure_ascii=False)}')
            
            # Преобразуем данные в формат, ожидаемый reserve_update
            reserve_data = {
                'chat_id': data.get('chat_id'),
                'data': data,  # Передаем все данные как есть
                'action': 'remove'  # Явно указываем действие remove
            }
            
            # Перенаправляем запрос в основной обработчик
            return handle_reserve_update(reserve_data)
            
        except Exception as e:
            logger.error('❌ Ошибка обработки remove_from_reserve')
            logger.error(f'Описание: {str(e)}')
            import traceback
            logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('join_shifts_room')
    def handle_join_shifts_room(data):
        """
        Обработчик присоединения к комнате смен
        """
        try:
            chat_id = data.get('chatId') or data.get('chat_id')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата для присоединения к комнате смен')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            # Получаем идентификатор комнаты смен
            room = get_room_name(f'shifts_{chat_id}')
            
            # Присоединяем пользователя к комнате
            logger.info(f'👋 Пользователь присоединяется к комнате смен {room}')
            join_room(room)
            
            # Логируем информацию о присоединении
            logger.info(f'👤 Socket ID: {request.sid}')
            logger.info(f'🏠 Чат ID: {chat_id}')
            logger.info(f'🏠 Комната: {room}')
            
            # Отправляем подтверждение
            logger.info(f'✅ Успешно присоединились к комнате {room}')
            emit('joined_shifts_room', {
                'status': 'success',
                'chat_id': chat_id,
                'room': room
            })
            
            return {
                'status': 'success',
                'message': f'Присоединился к комнате {room}'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка при присоединении к комнате смен: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('leave_shifts_room')
    def handle_leave_shifts_room(data):
        """
        Обработчик покидания комнаты смен
        """
        try:
            chat_id = data.get('chatId') or data.get('chat_id')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата для покидания комнаты смен')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            # Получаем идентификатор комнаты смен
            room = get_room_name(f'shifts_{chat_id}')
            
            # Присоединяем пользователя к комнате
            logger.info(f'👋 Пользователь покидает комнату смен {room}')
            leave_room(room)
            
            return {
                'status': 'success',
                'message': f'Покинул комнату {room}'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка при покидании комнаты смен: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }
            
    @socketio.on('join_reserves_room')
    def handle_join_reserves_room(data):
        """
        Обработчик присоединения к комнате резервов
        """
        try:
            chat_id = data.get('chatId') or data.get('chat_id')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата для присоединения к комнате резервов')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            # Получаем идентификатор комнаты резервов
            room = get_room_name(f'reserves_{chat_id}')
            
            # Присоединяем пользователя к комнате
            logger.info(f'👋 Пользователь присоединяется к комнате резервов {room}')
            join_room(room)
            
            # Логируем информацию о присоединении
            logger.info(f'👤 Socket ID: {request.sid}')
            logger.info(f'🏠 Чат ID: {chat_id}')
            logger.info(f'🏠 Комната: {room}')
            
            # Отправляем подтверждение
            logger.info(f'✅ Успешно присоединились к комнате {room}')
            emit('joined_reserves_room', {
                'status': 'success',
                'chat_id': chat_id,
                'room': room
            })
            
            return {
                'status': 'success',
                'message': f'Присоединился к комнате {room}'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка при присоединении к комнате резервов: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('leave_reserves_room')
    def handle_leave_reserves_room(data):
        """
        Обработчик покидания комнаты резервов
        """
        try:
            chat_id = data.get('chatId') or data.get('chat_id')
            
            if not chat_id:
                logger.error('❌ Не указан ID чата для покидания комнаты резервов')
                return {
                    'status': 'error',
                    'message': 'Не указан ID чата'
                }
            
            # Получаем идентификатор комнаты резервов
            room = get_room_name(f'reserves_{chat_id}')
            
            # Отсоединяем пользователя от комнаты
            logger.info(f'👋 Пользователь покидает комнату резервов {room}')
            leave_room(room)
            
            return {
                'status': 'success',
                'message': f'Покинул комнату {room}'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка при покидании комнаты резервов: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('ping_reserves_room')
    def handle_ping_reserves_room(data):
        """
        Обработчик проверки подключения к комнате резервов
        """
        try:
            logger.info('=== 🔔 Получен пинг комнаты резервов ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            
            chat_id = data.get('chatId') or data.get('chat_id')
            room = get_room_name(f'reserves_{chat_id}')
            
            logger.info(f'📊 Данные пинга: {json.dumps(data, ensure_ascii=False)}')
            logger.info(f'🏠 Комната: {room}')
            
            # Отправляем ответ всем в этой комнате
            emit('pong_reserves_room', {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'original_message': data.get('message', ''),
                'room': room,
                'chat_id': chat_id
            }, room=room)
            
            # Также отправляем личный ответ отправителю
            emit('pong_reserves_room_private', {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'original_message': data.get('message', ''),
                'room': room,
                'chat_id': chat_id,
                'to': 'only_sender'
            })
            
            return {
                'status': 'success',
                'message': 'Пинг получен и обработан'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка обработки пинга комнаты резервов: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }
            
    @socketio.on('echo')
    def handle_echo(data):
        """
        Эхо-обработчик для тестирования соединения
        """
        try:
            logger.info('=== 🔊 Получен эхо-запрос ===')
            logger.info(f'👤 Отправитель (Socket ID): {request.sid}')
            logger.info(f'📊 Данные запроса: {json.dumps(data, ensure_ascii=False)}')
            
            # Добавляем серверные метаданные
            response_data = {
                **data,
                'server_timestamp': datetime.now().isoformat(),
                'server_sid': request.sid,
                'echo': True
            }
            
            # Отправляем ответ отправителю
            emit('echo_response', response_data)
            
            return {
                'status': 'success',
                'message': 'Эхо-запрос обработан'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка обработки эхо-запроса: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            } 