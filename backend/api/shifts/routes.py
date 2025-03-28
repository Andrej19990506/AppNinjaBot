from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
import json
import os
from flask_cors import cross_origin
from services.access_settings_service import AccessSettingsService
import logging

# Настраиваем логирование
logger = logging.getLogger(__name__)

shifts_bp = Blueprint('shifts', __name__)

# Путь к JSON файлу для хранения смен
SHIFTS_FILE = os.path.join('data', 'shifts.json')

# Функция для получения текущего времени в ISO формате
def get_current_time():
    return datetime.now().isoformat()

# Функция для загрузки данных из JSON файла
def load_data(file_path):
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as file:
                return json.load(file)
        else:
            # Если файл не существует, возвращаем пустой список
            return []
    except Exception as e:
        logger.error(f"Error loading data from {file_path}: {str(e)}")
        return []

# Функция для сохранения данных в JSON файл
def save_data(data, file_path):
    try:
        # Создаем директорию, если она не существует
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving data to {file_path}: {str(e)}")
        return False

# Маршрут для получения списка смен
@shifts_bp.route('', methods=['GET'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def get_shifts():
    """Получение списка всех смен или смен для конкретного чата"""
    chat_id = request.args.get('chat_id')
    shifts = load_data(SHIFTS_FILE)
    
    if chat_id:
        shifts = [shift for shift in shifts if shift.get('chat_id') == chat_id]
    
    return jsonify(shifts)

# Маршрут для бронирования смены
@shifts_bp.route('', methods=['POST'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def book_shift():
    """Бронирование новой смены"""
    try:
        data = request.json
        
        # Проверяем обязательные поля
        required_fields = ['user_id', 'date', 'shift_type', 'slot_index', 'chat_id']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({'error': f"Missing required fields: {', '.join(missing_fields)}"}), 400
        
        # Загружаем существующие смены
        shifts = load_data(SHIFTS_FILE)
        
        # Получаем настройки доступа с использованием нового сервиса
        settings = AccessSettingsService.load_settings()
        
        # ID пользователя может быть строкой или числом
        user_id = str(data['user_id'])
        
        # Проверяем, если пользователь в списке ограниченных
        if 'restrictedUsers' in settings and user_id in [str(uid) for uid in settings.get('restrictedUsers', [])]:
            return jsonify({'error': 'User is restricted from booking shifts'}), 403
        
        # Проверяем доступность даты
        if not AccessSettingsService.is_date_available(data['date'], user_id):
            return jsonify({'error': 'This date is not available for booking'}), 400
        
        # Проверяем, есть ли уже смены у этого пользователя на эту дату
        user_shifts_on_date = [
            shift for shift in shifts 
            if str(shift.get('user_id')) == user_id and shift.get('date') == data['date']
        ]
        
        # Если у пользователя уже есть смена на эту дату и не разрешено несколько смен
        if user_shifts_on_date and not settings.get('allowMultipleShifts', False):
            return jsonify({'error': 'User already has a shift on this date'}), 400
        
        # Создаем новую запись о смене
        new_shift = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'date': data['date'],
            'shift_type': data['shift_type'],
            'slot_index': data['slot_index'],
            'chat_id': data['chat_id'],
            'photo_url': data.get('photo_url'),
            'first_name': data.get('first_name', ''),
            'last_name': data.get('last_name', ''),
            'is_senior_courier': data.get('is_senior_courier', False),
            'created_at': get_current_time(),
            'updated_at': get_current_time()
        }
        
        shifts.append(new_shift)
        
        # Сохраняем обновленный список смен
        if save_data(shifts, SHIFTS_FILE):
            return jsonify(new_shift), 201
        else:
            return jsonify({'error': 'Failed to save shift data'}), 500
    
    except Exception as e:
        logger.error(f"Error booking shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для обновления смены
@shifts_bp.route('/<shift_id>', methods=['PUT'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def update_shift(shift_id):
    """Обновление существующей смены"""
    try:
        data = request.json
        shifts = load_data(SHIFTS_FILE)
        
        # Ищем смену по ID
        shift_index = next((i for i, shift in enumerate(shifts) if shift.get('id') == shift_id), None)
        
        if shift_index is None:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Обновляем данные смены
        for key, value in data.items():
            if key not in ['id', 'created_at']:  # Не обновляем эти поля
                shifts[shift_index][key] = value
        
        # Обновляем дату изменения
        shifts[shift_index]['updated_at'] = get_current_time()
        
        # Сохраняем обновленный список смен
        if save_data(shifts, SHIFTS_FILE):
            return jsonify(shifts[shift_index])
        else:
            return jsonify({'error': 'Failed to save updated shift data'}), 500
    
    except Exception as e:
        logger.error(f"Error updating shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для отмены смены
@shifts_bp.route('/<shift_id>', methods=['DELETE'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def cancel_shift(shift_id):
    """Отмена (удаление) смены"""
    try:
        shifts = load_data(SHIFTS_FILE)
        
        # Ищем смену по ID
        shift_index = next((i for i, shift in enumerate(shifts) if shift.get('id') == shift_id), None)
        
        if shift_index is None:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Удаляем смену из списка
        deleted_shift = shifts.pop(shift_index)
        
        # Сохраняем обновленный список смен
        if save_data(shifts, SHIFTS_FILE):
            return jsonify({'success': True, 'deleted_shift': deleted_shift})
        else:
            return jsonify({'error': 'Failed to save updated shift data'}), 500
    
    except Exception as e:
        logger.error(f"Error canceling shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для подтверждения смены
@shifts_bp.route('/<shift_id>/confirm', methods=['POST'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def confirm_shift(shift_id):
    """Подтверждение смены (для будущего функционала)"""
    try:
        shifts = load_data(SHIFTS_FILE)
        
        # Ищем смену по ID
        shift_index = next((i for i, shift in enumerate(shifts) if shift.get('id') == shift_id), None)
        
        if shift_index is None:
            return jsonify({'error': 'Shift not found'}), 404
        
        # Добавляем статус подтверждения
        shifts[shift_index]['confirmed'] = True
        shifts[shift_index]['confirmed_at'] = get_current_time()
        
        # Если есть данные о том, кто подтвердил
        if request.json and 'confirmed_by' in request.json:
            shifts[shift_index]['confirmed_by'] = request.json['confirmed_by']
        
        # Сохраняем обновленный список смен
        if save_data(shifts, SHIFTS_FILE):
            return jsonify(shifts[shift_index])
        else:
            return jsonify({'error': 'Failed to save confirmation data'}), 500
    
    except Exception as e:
        logger.error(f"Error confirming shift: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Маршрут для получения настроек доступа к сменам
@shifts_bp.route('/access-settings', methods=['GET'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def get_access_settings():
    """Получение настроек доступа к сменам"""
    try:
        # Получаем chat_id из запроса, если есть
        chat_id = request.args.get('chat_id')
        logger.info(f"📝 Запрос настроек доступа: chat_id={chat_id}")
        
        # Загружаем настройки, передавая chat_id
        settings = AccessSettingsService.load_settings(chat_id)
        logger.info(f"✅ Настройки загружены: {len(settings)} полей")
        
        # Также добавляем chat_id в ответ, если он был использован
        if chat_id:
            settings['chat_id'] = chat_id
            
        return jsonify(settings)
    except Exception as e:
        logger.error(f"❌ Ошибка при получении настроек доступа: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Маршрут для обновления настроек доступа к сменам
@shifts_bp.route('/access-settings', methods=['POST'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def update_access_settings():
    """Обновление настроек доступа к сменам"""
    try:
        new_settings = request.json
        if not new_settings:
            logger.error("❌ Ошибка: Отсутствуют данные настроек")
            return jsonify({"error": "No settings data provided"}), 400
        
        # Подробное логирование полученных данных
        logger.info("📝 Получены данные для обновления настроек доступа:")
        logger.info(f"🔑 Ключи в запросе: {list(new_settings.keys())}")
        logger.info(f"📊 Количество полей: {len(new_settings)}")
        logger.info(f"📄 Полные данные запроса: {json.dumps(new_settings, ensure_ascii=False, indent=2)}")
        
        # Получаем chat_id из запроса
        chat_id = new_settings.get('chat_id')
        logger.info(f"🆔 Полученный chat_id: {chat_id}")
        
        # Проверяем параметр chat_id с подробным логированием
        if not chat_id:
            logger.warning("⚠️ chat_id отсутствует в запросе. Используем режим обратной совместимости")
            # В режиме обратной совместимости используем значение по умолчанию или генерируем временный ID
            chat_id = "default_chat"
            new_settings['chat_id'] = chat_id
            logger.info(f"🔄 Установлен chat_id по умолчанию: {chat_id}")
            # return jsonify({"error": "chat_id not provided"}), 400
        
        # Получаем ID пользователя из запроса, если есть
        user_id = request.headers.get('X-User-ID')
        logger.info(f"👤 ID пользователя: {user_id}")
        
        # Обновляем настройки используя сервис, передаем chat_id
        updated_settings = AccessSettingsService.update_settings(new_settings, user_id)
        
        # Логируем результат
        logger.info("✅ Настройки успешно обновлены")
        logger.info(f"🔑 Ключи в обновленных настройках: {list(updated_settings.keys())}")
        
        # Делаем запрос к шедулеру для применения новых настроек и планирования задачи
        try:
            import requests
            from flask import current_app

            # Получаем URL шедулера из конфигурации или используем стандартный
            scheduler_url = current_app.config.get('SCHEDULER_URL', 'http://scheduler:8002')
            
            # Запрос на применение настроек доступа с передачей chat_id
            logger.info(f"📤 Отправка запроса на применение настроек с chat_id={chat_id}")
            apply_response = requests.post(f"{scheduler_url}/apply-access-settings", json={'chat_id': chat_id})
            
            if apply_response.ok:
                logger.info(f"✅ Запрос на применение настроек успешно отправлен: {apply_response.json()}")
            else:
                logger.warning(f"⚠️ Ошибка при отправке запроса на применение настроек: {apply_response.status_code} - {apply_response.text}")
            
            # Запрос на перезагрузку задач
            logger.info(f"📤 Отправка запроса на перезагрузку задач")
            reload_response = requests.post(f"{scheduler_url}/scheduler/reload-tasks")
            
            if reload_response.ok:
                logger.info(f"✅ Запрос на перезагрузку задач успешно отправлен: {reload_response.json()}")
            else:
                logger.warning(f"⚠️ Ошибка при отправке запроса на перезагрузку задач: {reload_response.status_code} - {reload_response.text}")
                
        except Exception as e:
            logger.warning(f"⚠️ Не удалось отправить запрос к шедулеру: {str(e)}")
            # Продолжаем выполнение, так как обновление настроек доступа уже выполнено успешно
        
        return jsonify(updated_settings)
    
    except Exception as e:
        logger.error(f"❌ Ошибка при обновлении настроек доступа: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Новый маршрут для получения доступных для записи дат
@shifts_bp.route('/available-dates', methods=['GET'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def get_available_dates():
    """Получение списка доступных для записи дат"""
    try:
        # Получаем ID пользователя из запроса, если есть
        user_id = request.args.get('user_id')
        
        # Получаем список доступных дат
        available_dates = AccessSettingsService.calculate_available_dates(user_id)
        
        return jsonify({
            'dates': available_dates,
            'count': len(available_dates)
        })
    
    except Exception as e:
        logger.error(f"Error getting available dates: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Маршрут для проверки доступности конкретной даты
@shifts_bp.route('/available-dates/<date_str>', methods=['GET'])
@cross_origin(origins=["https://reform-hand-simple-invisible.trycloudflare.com", "https://pearl-roy-hugo-equity.trycloudflare.com", "http://localhost:3000", "http://localhost:8000", "http://localhost:5000"])
def check_date_availability(date_str):
    """Проверка доступности конкретной даты для записи"""
    try:
        # Получаем ID пользователя из запроса, если есть
        user_id = request.args.get('user_id')
        
        # Проверяем доступность даты
        is_available = AccessSettingsService.is_date_available(date_str, user_id)
        
        return jsonify({
            'date': date_str,
            'is_available': is_available
        })
    
    except Exception as e:
        logger.error(f"Error checking date availability: {str(e)}")
        return jsonify({"error": str(e)}), 500 