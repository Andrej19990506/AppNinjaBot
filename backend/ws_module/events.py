"""
Обработчики событий Socket.IO
"""
from flask import request, current_app, g
from flask_socketio import emit, join_room, leave_room
import json
from datetime import datetime
import os
from pathlib import Path
import traceback  # Убедимся, что traceback импортирован в начале файла
import inspect

from config import logger, DATA_DIR
# Прямой импорт, чтобы обойти проблему с null bytes
# Удаляем создание локального экземпляра socketio
# from flask_socketio import SocketIO
# socketio = SocketIO()
# from core.extensions import socketio
from .rooms import (
    join_user_to_room, update_user_in_room, remove_user_from_room,
    get_room_name, active_users, GLOBAL_ROOM, CHAT_ROOM_PREFIX, 
    get_courier_room_name
)

# Логируем загрузку модуля
logger.info("========== МОДУЛЬ СОБЫТИЙ WS_MODULE/EVENTS.PY ЗАГРУЖЕН ==========")

# Тестовый обработчик для проверки работы socketio
def test_socketio_handler(socketio):
    @socketio.on('test_event')
    def handle_test_event(data):
        logger.info(f"===== ПОЛУЧЕНО ТЕСТОВОЕ СОБЫТИЕ: {data} =====")
        emit('test_response', {'status': 'success', 'message': 'Тестовое событие получено'})

# Проверка наличия обработчика join_courier_room
def check_handlers(socketio):
    if hasattr(socketio, 'handlers'):
        logger.info(f"===== ЗАРЕГИСТРИРОВАННЫЕ ОБРАБОТЧИКИ: {socketio.handlers} =====")
    else:
        logger.info("===== НЕ УДАЛОСЬ ПОЛУЧИТЬ ИНФОРМАЦИЮ О ЗАРЕГИСТРИРОВАННЫХ ОБРАБОТЧИКАХ =====")

# Регистрация обработчиков будет происходить через функции, которые импортируются в app.py
def register_handlers(socketio):
    """
    Регистрирует все обработчики событий на экземпляре socketio
    """
    
    # Добавляем тестовый обработчик
    test_socketio_handler(socketio)
    
    # Регистрируем перехватчик всех событий
    register_catch_all_handler(socketio)
    
    # Логируем информацию об объекте socketio для отладки
    logger.info(f"===== РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ НА ОБЪЕКТЕ {id(socketio)} =====")
    logger.info(f"===== ТИП ОБЪЕКТА SOCKETIO: {type(socketio)} =====")
    
    # Явно логируем регистрацию каждого обработчика
    logger.info("===== РЕГИСТРАЦИЯ ОБРАБОТЧИКА handle_connect =====")
    
    # Получаем список всех функций-обработчиков в текущем модуле
    import inspect
    import sys
    
    # Получаем все функции из текущего модуля
    current_module = sys.modules[__name__]
    handlers = [name for name, obj in inspect.getmembers(current_module) 
               if name.startswith('handle_') and callable(obj)]
    
    logger.info(f"Доступные обработчики: {handlers}")
    
    # Проверяем, есть ли handle_join_courier_room среди доступных обработчиков
    if 'handle_join_courier_room' in handlers:
        logger.info("===== ОБРАБОТЧИК handle_join_courier_room НАЙДЕН =====")
        # Явная регистрация обработчика
        @socketio.on('join_courier_room')
        def _handle_join_courier_room(data):
            return current_module.handle_join_courier_room(data)
    else:
        logger.error("===== ОБРАБОТЧИК handle_join_courier_room НЕ НАЙДЕН =====")
    
    # Логируем информацию о регистрации обработчиков
    logger.info(f"Регистрация обработчиков на экземпляре socketio {id(socketio)}")
    
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
            
            # Обработка перетаскивания смены (drag-and-drop) или создания новой смены
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
                else:
                    logger.info('ℹ️ Создаем новую смену')
                    # Импортируем функцию для создания смены
                    from data.shifts import book_shift
                    
                    # Извлекаем необходимые данные
                    user_id = shift_data.get('user_id')
                    date = shift_data.get('date')
                    shift_type = shift_data.get('shift_type')
                    slot_index = shift_data.get('slot_index')
                    
                    if not all([user_id, date, shift_type, slot_index is not None]):
                        logger.error('❌ Не все обязательные поля предоставлены для создания смены')
                        return {
                            'status': 'error',
                            'message': 'Необходимо предоставить user_id, date, shift_type, slot_index'
                        }
                    
                    # Создаем объект user_data
                    user_data = {
                        'photo_url': shift_data.get('photo_url'),
                        'first_name': shift_data.get('first_name'),
                        'last_name': shift_data.get('last_name'),
                        'is_senior_courier': shift_data.get('is_senior_courier', False)
                    }
                    
                    # Создаем новую смену
                    try:
                        new_shift = book_shift(user_id, date, shift_type, slot_index, chat_id, user_data)
                        logger.info(f'✅ Смена успешно создана: {json.dumps(new_shift, ensure_ascii=False)}')
                        
                        # Обновляем shift_data с данными новой смены
                        shift_data.update(new_shift)
                        
                    except Exception as book_error:
                        logger.error(f'❌ Ошибка при создании смены: {str(book_error)}')
                        import traceback
                        logger.error(f'📊 Трассировка ошибки:\n{traceback.format_exc()}')
                        return {
                            'status': 'error',
                            'message': f'Ошибка создания смены: {str(book_error)}'
                        }
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
                'shift': updated_shift if 'updated_shift' in locals() else shift_data
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

    @socketio.on('access_settings_update')
    def handle_access_settings_update(data):
        """
        Обработчик обновления настроек доступа
        """
        try:
            logger.info(f'🔄 Получено событие ACCESS_SETTINGS_UPDATE: {json.dumps(data, ensure_ascii=False)}')
            
            # Получаем данные
            chat_id = data.get('chat_id')
            user_id = data.get('user_id')
            settings = data.get('settings', {})
            
            # Проверяем наличие данных
            if not chat_id:
                logger.error('❌ Ошибка обновления настроек доступа: отсутствует chat_id')
                emit('access_settings_updated', {
                    'status': 'error',
                    'message': 'Отсутствует chat_id'
                })
                return
            
            # Добавляем информацию о том, кто обновил настройки
            if not settings.get('updatedBy') and user_id:
                settings['updatedBy'] = user_id
            
            # Добавляем таймстамп обновления
            settings['lastUpdated'] = datetime.now().isoformat()
            
            # Формируем данные для отправки
            event_data = {
                'status': 'success',
                'chat_id': chat_id,
                'settings': settings,
                'timestamp': datetime.now().isoformat(),
                'user_id': user_id
            }
            
            # Получаем имена комнат
            room = get_room_name(chat_id)
            room_shifts = get_room_name(f'shifts_{chat_id}')
            
            # Отправляем данные в комнату смен
            logger.info(f'🔄 Отправка данных в комнату смен {room_shifts}')
            emit('access_settings_updated', event_data, room=room_shifts)
            
            # Отправляем данные в основную комнату чата
            logger.info(f'🔄 Отправка данных в комнату чата {room}')
            emit('access_settings_updated', event_data, room=room)
            
            return {
                'status': 'success',
                'message': 'Настройки доступа обновлены'
            }
        except Exception as e:
            logger.error(f'❌ Ошибка обновления настроек доступа: {str(e)}')
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }
    
    @socketio.on('check_dates_availability')
    def handle_check_dates_availability(data):
        """
        Обработчик проверки доступности дат
        """
        try:
            logger.info(f"🔄 Получена команда на обновление календаря: {data}")
            
            if not isinstance(data, dict):
                logger.error(f"❌ Неверный формат данных команды: {data}")
                emit('error', {'status': 'error', 'message': 'Неверный формат данных'})
                return
                
            # Получаем chat_id из данных или из комнаты отправителя
            chat_id = data.get('chat_id')
            
            # Если chat_id не передан в данных, пытаемся найти его в комнатах отправителя
            if not chat_id:
                # Получаем все комнаты, в которых находится отправитель
                rooms = socketio.server.manager.rooms.get(request.sid, [])
                logger.info(f"🔍 Поиск chat_id в комнатах отправителя: {rooms}")
                
                # Ищем комнату курьеров
                for room in rooms:
                    if room.startswith('courier_'):
                        chat_id = room.replace('courier_', '')
                        logger.info(f"✅ Найден chat_id из комнаты курьеров: {chat_id}")
                        break
                    elif room.startswith('shifts_'):
                        chat_id = room.replace('shifts_', '')
                        logger.info(f"✅ Найден chat_id из комнаты смен: {chat_id}")
                        break
                    elif room.startswith('reserves_'):
                        chat_id = room.replace('reserves_', '')
                        logger.info(f"✅ Найден chat_id из комнаты резервов: {chat_id}")
                        break
            
            if not chat_id:
                logger.error("❌ Не удалось определить chat_id")
                emit('error', {'status': 'error', 'message': 'Не удалось определить chat_id'})
                return
            
            # Получаем имена комнат
            room = get_room_name(chat_id)
            room_shifts = get_room_name(f'shifts_{chat_id}')
            
            # Отправляем событие обновления в комнату смен
            logger.info(f"🔄 Отправка события обновления в комнату смен {room_shifts}")
            emit('calendar_update', {
                'status': 'success',
                'chat_id': chat_id,
                'timestamp': datetime.now().isoformat()
            }, room=room_shifts)
            
            # Отправляем событие обновления в основную комнату чата
            logger.info(f"🔄 Отправка события обновления в комнату чата {room}")
            emit('calendar_update', {
                'status': 'success',
                'chat_id': chat_id,
                'timestamp': datetime.now().isoformat()
            }, room=room)
            
            return {
                'status': 'success',
                'message': 'Событие обновления календаря отправлено'
            }
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке команды обновления календаря: {str(e)}")
            return {
                'status': 'error',
                'message': f'Ошибка: {str(e)}'
            }

    @socketio.on('join_courier_room')
    def handle_join_courier_room(data):
        """
        Обработчик присоединения к комнате курьеров
        """
        try:
            # Получаем данные из запроса
            chat_id = data.get('chat_id')
            user_info = data.get('user_info', {})
            
            if not chat_id:
                logger.error("Не указан идентификатор чата (chat_id) в данных запроса")
                return {"status": "error", "message": "Не указан идентификатор чата"}
            
            logger.info(f"===== ПРИСОЕДИНЕНИЕ К КОМНАТЕ КУРЬЕРОВ =====")
            logger.info(f"Chat ID: {chat_id}")
            logger.info(f"Пользователь: {user_info}")
            
            # Получаем имя комнаты курьеров
            room = get_courier_room_name(chat_id)
            logger.info(f"Имя комнаты курьеров: {room}")
            
            # Проверяем, есть ли у пользователя ID
            user_id = user_info.get('id')
            if not user_id:
                # Если нет ID, создаем случайный
                import uuid
                user_id = str(uuid.uuid4())
                user_info['id'] = user_id
                logger.info(f"Создан временный ID пользователя: {user_id}")
            
            # Добавляем socket_id в информацию о пользователе
            user_info['socket_id'] = request.sid
            
            # Проверяем текущее состояние комнаты
            logger.info(f"📊 Состояние комнаты до присоединения:")
            logger.info(f"🔍 Комната существует: {room in active_users}")
            if room in active_users:
                logger.info(f"👥 Количество пользователей: {len(active_users[room])}")
                logger.info(f"📋 Список пользователей: {json.dumps(list(active_users[room].values()), ensure_ascii=False)}")
            
            # Добавляем пользователя в комнату
            join_room(room)
            logger.info(f"Пользователь присоединен к комнате {room}")
            
            # Добавляем пользователя в список активных пользователей комнаты
            # Используем force_rejoin=True только для тестовых подключений
            force_rejoin = data.get('test', False)
            join_result = join_user_to_room(room, user_id, user_info, force_rejoin)
            
            # Проверяем состояние комнаты после присоединения
            logger.info(f"📊 Состояние комнаты после присоединения:")
            logger.info(f"🔍 Комната существует: {room in active_users}")
            if room in active_users:
                logger.info(f"👥 Количество пользователей: {len(active_users[room])}")
                logger.info(f"📋 Список пользователей: {json.dumps(list(active_users[room].values()), ensure_ascii=False)}")
            
            # Отправляем подтверждение о присоединении к комнате
            response = {
                "status": "success",
                "message": f"Вы присоединились к комнате {room}",
                "room": room,
                "chat_id": chat_id,
                "active_users": join_result['active_users']
            }
            
            # Отправляем всем пользователям в комнате информацию об обновлении списка участников
            emit('room_users_updated', {
                'chat_id': chat_id,
                "room": room, 
                'active_users': join_result['active_users'],
                'user_count': len(join_result['active_users'])
            }, room=room)
            
            logger.info(f"Ответ: {response}")
            logger.info(f"===== УСПЕШНОЕ ПРИСОЕДИНЕНИЕ К КОМНАТЕ КУРЬЕРОВ =====")
            
            return response
        except Exception as e:
            logger.error(f"Ошибка при присоединении к комнате курьеров: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"status": "error", "message": str(e)}

    @socketio.on('leave_courier_room')
    def handle_leave_courier_room(data):
        """
        Обработчик покидания комнаты курьеров
        """
        try:
            logger.info(f"===== ОБРАБОТКА ЗАПРОСА НА ПОКИДАНИЕ КОМНАТЫ КУРЬЕРОВ =====")
            logger.info(f"Данные запроса: {data}")
            
            # Получаем информацию о пользователе из запроса
            user_info = data.get('user_info', {})
            user_id = user_info.get('id')
            
            # Проверка всех возможных источников chat_id с подробным логированием
            logger.info(f"Проверка всех возможных источников chat_id...")
            
            chat_id = None
            
            # Варианты извлечения chat_id
            chat_id_sources = [
                ('chatId', data.get('chatId')),
                ('chat_id', data.get('chat_id')),
                ('chat', data.get('chat')),
                ('room', data.get('room')),
                ('roomId', data.get('roomId'))
            ]
            
            # Проверяем каждый возможный источник
            for source_name, source_value in chat_id_sources:
                logger.info(f"Проверка источника '{source_name}': {source_value}")
                if source_value:
                    chat_id = source_value
                    logger.info(f"Найден chat_id в источнике '{source_name}': {chat_id}")
                    break
            
            if not chat_id:
                logger.error("Не указан идентификатор чата (chat_id) в данных запроса")
                return {"status": "error", "message": "Не указан идентификатор чата"}
            
            logger.info(f"===== ПОКИДАНИЕ КОМНАТЫ КУРЬЕРОВ =====")
            logger.info(f"Chat ID: {chat_id}")
            logger.info(f"Пользователь: {user_info}")
            
            # Получаем имя комнаты курьеров
            room = get_courier_room_name(f'courier_{chat_id}')
            logger.info(f"Имя комнаты курьеров: {room}")
            
            # Покидаем комнату
            leave_room(room)
            logger.info(f"Пользователь покинул комнату {room}")
            
            # Удаляем пользователя из списка активных, если есть его ID
            if user_id and room in active_users and user_id in active_users[room]:
                user = active_users[room][user_id]
                del active_users[room][user_id]
                logger.info(f"👤 Пользователь {user.get('first_name', 'Неизвестный')} с ID {user_id} удален из комнаты {room}")
                
                # Формируем список оставшихся активных пользователей
                active_users_in_room = list(active_users[room].values())
                users_count = len(active_users_in_room)
                
                logger.info(f"👥 Количество пользователей в комнате {room} после выхода: {users_count}")
                
                # Оповещаем остальных пользователей об уходе участника
                emit('courier_user_left', {
                    'user': user,
                    'room': room,
                    'active_users': active_users_in_room,
                    'timestamp': datetime.now().isoformat()
                }, room=room)
                
                # Если комната пуста, удаляем ее
                if not active_users[room]:
                    del active_users[room]
                    logger.info(f"🗑️ Комната {room} удалена (нет активных пользователей)")
            
            logger.info(f"===== УСПЕШНОЕ ПОКИДАНИЕ КОМНАТЫ КУРЬЕРОВ =====")
            
            return {
                "status": "success",
                "message": f"Вы покинули комнату {room}",
                "room": room,
                "chat_id": chat_id
            }
        except Exception as e:
            logger.error(f"Ошибка при покидании комнаты курьеров: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"status": "error", "message": str(e)}

    # Добавляем новый обработчик для уведомлений о доступности
    @socketio.on('availability_update')
    def handle_availability_update(data):
        """
        Обработчик получения уведомления о доступности дат.
        Отправляет уведомление в комнату курьеров.
        Данные должны содержать:
        - chat_id: id чата
        - message: сообщение о доступности
        - date_range: диапазон дат
        """
        try:
            logger.info(f"📅 Получено уведомление о доступности: {data}")
            
            if not isinstance(data, dict):
                logger.error(f"❌ Неверный формат данных уведомления: {data}")
                emit('error', {'status': 'error', 'message': 'Неверный формат данных'})
                return
                
            chat_id = data.get('chat_id')
            if not chat_id:
                logger.error("❌ Не указан chat_id в уведомлении о доступности")
                emit('error', {'status': 'error', 'message': 'Не указан chat_id'})
                return

            # Загружаем актуальные настройки доступности
            try:
                settings_path = DATA_DIR / 'access_settings' / f'settings_{chat_id}.json'
                if settings_path.exists():
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        settings = json.load(f)
                else:
                    logger.error(f"❌ Файл настроек не найден: {settings_path}")
                    settings = {}
            except Exception as e:
                logger.error(f"❌ Ошибка при загрузке настроек: {str(e)}")
                settings = {}
                
            # Создаем данные для отправки
            notification_data = {
                'type': 'notification',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'data': {
                    'message': data.get('message', 'Обновлены настройки доступности дат'),
                    'parse_mode': 'HTML',
                    'sent_at': datetime.now().isoformat(),
                    'source': data.get('source', 'scheduler'),
                    'status': 'success'
                }
            }

            # Создаем данные обновления календаря
            calendar_update_data = {
                'type': 'calendar_update',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'settings': settings,  # Отправляем актуальные настройки
                'refresh_required': True,
                'date_range': data.get('date_range', {}),
                'source': data.get('source', 'scheduler')
            }
            
            # Получаем имя комнаты для курьеров
            room_name = get_courier_room_name(chat_id)
            logger.info(f"📡 Отправка данных в комнату {room_name}")
            
            # Отправляем уведомление в комнату курьеров
            emit('notification', notification_data, room=room_name)
            logger.info(f"✅ Уведомление отправлено в комнату {room_name}")

            # Отправляем обновление календаря
            emit('calendar_update', calendar_update_data, room=room_name)
            logger.info(f"✅ Обновление календаря отправлено в комнату {room_name}")
            
            # Отправляем в индивидуальную комнату отправителя
            emit('availability_update_sent', {'status': 'success', 'room': room_name})
            
            return {'status': 'success'}
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке уведомления о доступности: {str(e)}")
            logger.error(traceback.format_exc())
            emit('error', {'status': 'error', 'message': f'Ошибка: {str(e)}'})
            return {'status': 'error', 'message': str(e)}

    # Обработчик прямых команд на обновление календаря
    @socketio.on('refresh_calendar')
    def handle_refresh_calendar(data):
        """
        Обработчик команды на обновление календаря.
        Отправляет команду клиентам в указанной комнате.
        """
        try:
            logger.info(f"🔄 Получена команда на обновление календаря: {data}")
            
            if not isinstance(data, dict):
                logger.error(f"❌ Неверный формат данных команды: {data}")
                emit('error', {'status': 'error', 'message': 'Неверный формат данных'})
                return
                
            # Получаем chat_id из данных или из комнаты отправителя
            chat_id = data.get('chat_id')
            
            # Если chat_id не передан в данных, пытаемся найти его в комнатах отправителя
            if not chat_id:
                # Получаем все комнаты, в которых находится отправитель
                rooms = socketio.server.manager.rooms.get(request.sid, [])
                logger.info(f"🔍 Поиск chat_id в комнатах отправителя: {rooms}")
                
                # Ищем комнату курьеров
                for room in rooms:
                    if room.startswith('courier_'):
                        chat_id = room.replace('courier_', '')
                        logger.info(f"✅ Найден chat_id из комнаты курьеров: {chat_id}")
                        break
                    elif room.startswith('shifts_'):
                        chat_id = room.replace('shifts_', '')
                        logger.info(f"✅ Найден chat_id из комнаты смен: {chat_id}")
                        break
                    elif room.startswith('reserves_'):
                        chat_id = room.replace('reserves_', '')
                        logger.info(f"✅ Найден chat_id из комнаты резервов: {chat_id}")
                        break
                
                if not chat_id:
                    logger.error("❌ Не удалось определить chat_id из комнат отправителя")
                    emit('error', {'status': 'error', 'message': 'Не удалось определить chat_id'})
                    return
            
            # Загружаем актуальные настройки доступности
            try:
                settings_path = DATA_DIR / 'access_settings' / f'settings_{chat_id}.json'
                if settings_path.exists():
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        settings = json.load(f)
                        logger.info(f"✅ Загружены настройки для чата {chat_id}")
                else:
                    logger.error(f"❌ Файл настроек не найден: {settings_path}")
                    settings = {}
            except Exception as e:
                logger.error(f"❌ Ошибка при загрузке настроек: {str(e)}")
                settings = {}
            
            # Создаем данные обновления календаря
            calendar_update_data = {
                'type': 'calendar_update',
                'timestamp': datetime.now().isoformat(),
                'chat_id': chat_id,
                'settings': settings,
                'refresh_required': True,
                'source': data.get('source', 'api'),
                'force': data.get('force', False)
            }
            
            # Получаем имя комнаты
            room_name = get_courier_room_name(chat_id)
            logger.info(f"📡 Отправка обновления календаря в комнату {room_name}")
            
            # Отправляем обновление календаря
            emit('calendar_update', calendar_update_data, room=room_name)
            logger.info(f"✅ Обновление календаря отправлено в комнату {room_name}")
            
            # Подтверждаем отправителю
            emit('refresh_command_sent', {
                'status': 'success', 
                'room': room_name,
                'chat_id': chat_id,
                'timestamp': datetime.now().isoformat()
            })
            
            return {'status': 'success'}
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке команды обновления календаря: {str(e)}")
            logger.error(traceback.format_exc())
            emit('error', {'status': 'error', 'message': f'Ошибка: {str(e)}'})
            return {'status': 'error', 'message': str(e)}

# Простая проверка, существует ли функция handle_join_courier_room
try:
    # Пытаемся получить функцию из текущего модуля
    import inspect
    import sys
    
    current_module = sys.modules[__name__]
    handle_join_courier_room_exists = hasattr(current_module, 'handle_join_courier_room') and callable(getattr(current_module, 'handle_join_courier_room'))
    
    logger.info(f"===== ПРОВЕРКА СУЩЕСТВОВАНИЯ handle_join_courier_room: {handle_join_courier_room_exists} =====")
    
    # Если функции нет, определяем её
    if not handle_join_courier_room_exists:
        logger.warning("===== ФУНКЦИЯ handle_join_courier_room НЕ НАЙДЕНА, СОЗДАЁМ ЕЁ =====")
        
        def handle_join_courier_room(data):
            """
            Обработчик для присоединения к комнате курьеров
            """
            try:
                logger.info(f"===== ОБРАБОТКА ЗАПРОСА НА ПРИСОЕДИНЕНИЕ К КОМНАТЕ КУРЬЕРОВ =====")
                logger.info(f"Данные запроса: {data}")
                
                # Получаем информацию о пользователе из запроса
                user_info = data.get('user_info', {})
                
                # Проверка всех возможных источников chat_id с подробным логированием
                logger.info(f"Проверка всех возможных источников chat_id...")
                
                chat_id = None
                
                # Варианты извлечения chat_id
                chat_id_sources = [
                    ('chatId', data.get('chatId')),
                    ('chat_id', data.get('chat_id')),
                    ('chat', data.get('chat')),
                    ('room', data.get('room')),
                    ('roomId', data.get('roomId'))
                ]
                
                # Проверяем каждый возможный источник
                for source_name, source_value in chat_id_sources:
                    logger.info(f"Проверка источника '{source_name}': {source_value}")
                    if source_value:
                        chat_id = source_value
                        logger.info(f"Найден chat_id в источнике '{source_name}': {chat_id}")
                        break
                
                if not chat_id:
                    logger.error("Не указан идентификатор чата (chat_id) в данных запроса")
                    return {"status": "error", "message": "Не указан идентификатор чата"}
                
                logger.info(f"===== ПРИСОЕДИНЕНИЕ К КОМНАТЕ КУРЬЕРОВ =====")
                logger.info(f"Chat ID: {chat_id}")
                logger.info(f"Пользователь: {user_info}")
                
                # Получаем имя комнаты курьеров
                room_name = get_courier_room_name(chat_id)
                logger.info(f"Имя комнаты курьеров: {room_name}")
                
                # Проверяем, есть ли у пользователя ID
                user_id = user_info.get('id')
                if not user_id:
                    # Если нет ID, создаем случайный
                    import uuid
                    user_id = str(uuid.uuid4())
                    user_info['id'] = user_id
                    logger.info(f"Создан временный ID пользователя: {user_id}")
                
                # Добавляем socket_id в информацию о пользователе
                user_info['socket_id'] = request.sid
                
                # Добавляем пользователя в комнату
                join_room(room_name)
                logger.info(f"Пользователь присоединен к комнате {room_name}")
                
                # Добавляем пользователя в список активных пользователей комнаты
                # Используем force_rejoin=True только для тестовых подключений
                force_rejoin = data.get('test', False)
                join_result = join_user_to_room(f'courier_{chat_id}', user_id, user_info, force_rejoin)
                
                # Отправляем подтверждение о присоединении к комнате
                response = {
                    "status": "success",
                    "message": f"Вы присоединились к комнате {room_name}",
                    "room": room_name,
                    "chat_id": chat_id,
                    "active_users": join_result['active_users']
                }
                
                # Отправляем всем пользователям в комнате информацию об обновлении списка участников
                emit('room_users_updated', {
                    'chat_id': chat_id,
                    "room": room_name, 
                    'active_users': join_result['active_users'],
                    'user_count': len(join_result['active_users'])
                }, room=room_name)
                
                logger.info(f"Ответ: {response}")
                logger.info(f"===== УСПЕШНОЕ ПРИСОЕДИНЕНИЕ К КОМНАТЕ КУРЬЕРОВ =====")
                
                return response
            except Exception as e:
                logger.error(f"Ошибка при присоединении к комнате курьеров: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
                return {"status": "error", "message": str(e)}
        
        # Делаем функцию видимой глобально в модуле
        globals()['handle_join_courier_room'] = handle_join_courier_room
        
        logger.info("===== ФУНКЦИЯ handle_join_courier_room СОЗДАНА =====")
except Exception as e:
    logger.error(f"Ошибка при проверке функции handle_join_courier_room: {str(e)}")
    import traceback
    logger.error(traceback.format_exc()) 

# Функция для регистрации глобального обработчика всех событий
def register_catch_all_handler(socketio):
    """
    Регистрирует обработчик, который перехватывает все события
    """
    @socketio.on('*')
    def catch_all_handler(event, data):
        """
        Обрабатывает все события, даже если для них нет специального обработчика
        """
        from flask import request
        
        logger.info(f"🔄 RECEIVED EVENT: {event}")
        logger.info(f"📊 DATA: {data}")
        logger.info(f"🆔 CLIENT: {request.sid}")
        
        # Для событий присоединения к комнате
        if 'join' in event:
            logger.info(f"🚪 ПОПЫТКА ПРИСОЕДИНЕНИЯ К КОМНАТЕ: {event}")
            
            try:
                from json import dumps
                logger.info(f"📦 ДАННЫЕ: {dumps(data, ensure_ascii=False)}")
            except:
                logger.info(f"📦 ДАННЫЕ (не JSON): {data}")
            
            # Проверяем наличие chat_id
            chat_id = None
            
            if isinstance(data, dict):
                for key in ['chatId', 'chat_id', 'roomId', 'room_id', 'id']:
                    if key in data and data[key]:
                        chat_id = data[key]
                        logger.info(f"🔑 НАЙДЕН ИДЕНТИФИКАТОР КОМНАТЫ: {chat_id} (ключ: {key})")
                        break
            
            if not chat_id:
                logger.warning(f"⚠️ НЕ НАЙДЕН ИДЕНТИФИКАТОР КОМНАТЫ В СОБЫТИИ {event}")
        
        # Для пользовательских событий
        return {"status": "received"}