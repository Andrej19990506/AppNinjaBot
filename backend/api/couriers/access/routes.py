"""
Маршруты для управления доступом курьеров к сменам
"""
from flask import request, jsonify
import logging
import requests
from . import access_bp
from services.access_settings_service import AccessSettingsService

# Настраиваем логирование
logger = logging.getLogger(__name__)

@access_bp.route('/settings', methods=['GET'])
def get_access_settings():
    """Получение настроек доступа к сменам"""
    try:
        # Получаем chat_id из запроса, если есть
        chat_id = request.args.get('chat_id')
        logger.info(f"📝 Запрос настроек доступа: chat_id={chat_id}")

        # Проверяем существование таблицы
        if not AccessSettingsService.table_exists():
            logger.error("❌ Таблица настроек не существует")
            return jsonify({
                "error": "Таблица настроек не существует",
                "code": "TABLE_NOT_EXISTS"
            }), 500
        
        # Загружаем настройки
        settings = AccessSettingsService.load_settings(chat_id)
        
        if not settings:
            logger.warning(f"⚠️ Настройки не найдены для chat_id={chat_id}")
            return jsonify({
                "error": f"Настройки не найдены для chat_id={chat_id}",
                "code": "SETTINGS_NOT_FOUND"
            }), 404
            
        logger.info(f"✅ Настройки загружены: {len(settings)} полей")
        return jsonify(settings)
        
    except Exception as e:
        logger.error(f"❌ Ошибка при получении настроек доступа: {str(e)}")
        return jsonify({
            "error": str(e),
            "code": "INTERNAL_ERROR"
        }), 500

@access_bp.route('/settings', methods=['POST'])
def update_access_settings():
    """Обновление настроек доступа к сменам"""
    try:
        new_settings = request.json
        if not new_settings:
            logger.error("❌ Ошибка: Отсутствуют данные настроек")
            return jsonify({
                "error": "Не предоставлены данные для обновления",
                "code": "NO_DATA"
            }), 400
        
        # Подробное логирование полученных данных
        logger.info("📝 Получены данные для обновления настроек доступа:")
        logger.info(f"🔑 Ключи в запросе: {list(new_settings.keys())}")
        
        # Получаем chat_id из запроса
        chat_id = new_settings.get('chat_id')
        if not chat_id:
            logger.error("❌ Ошибка: Отсутствует chat_id")
            return jsonify({
                "error": "Не указан chat_id",
                "code": "NO_CHAT_ID"
            }), 400
        
        # Проверяем существование таблицы
        if not AccessSettingsService.table_exists():
            logger.error("❌ Таблица настроек не существует")
            return jsonify({
                "error": "Таблица настроек не существует",
                "code": "TABLE_NOT_EXISTS"
            }), 500
        
        # Получаем ID пользователя из запроса, если есть
        user_id = request.headers.get('X-User-ID')
        
        try:
            # Обновляем настройки используя сервис
            updated_settings = AccessSettingsService.update_settings(new_settings, user_id)
            
            # Логируем результат
            logger.info("✅ Настройки успешно обновлены")
            logger.info(f"🔑 Ключи в обновленных настройках: {list(updated_settings.keys())}")
            
            # Делаем запрос к шедулеру для применения новых настроек
            try:
                from flask import current_app

                # Получаем URL шедулера из конфигурации или используем стандартный
                scheduler_url = current_app.config.get('SCHEDULER_URL', 'http://scheduler:8002')
                
                # Запрос на применение настроек доступа
                logger.info(f"📤 Отправка запроса на применение настроек с chat_id={chat_id}")
                apply_response = requests.post(
                    f"{scheduler_url}/apply-access-settings",
                    json={'chat_id': chat_id}
                )
                
                if apply_response.ok:
                    logger.info(f"✅ Запрос на применение настроек успешно отправлен")
                else:
                    logger.warning(f"⚠️ Ошибка при отправке запроса на применение настроек: {apply_response.status_code}")
                
                # Запрос на перезагрузку задач
                logger.info(f"📤 Отправка запроса на перезагрузку задач")
                reload_response = requests.post(f"{scheduler_url}/scheduler/reload-tasks")
                
                if reload_response.ok:
                    logger.info(f"✅ Запрос на перезагрузку задач успешно отправлен")
                else:
                    logger.warning(f"⚠️ Ошибка при отправке запроса на перезагрузку задач: {reload_response.status_code}")
                    
            except Exception as scheduler_error:
                logger.warning(f"⚠️ Не удалось отправить запрос к шедулеру: {str(scheduler_error)}")
                # Продолжаем выполнение, так как обновление настроек уже выполнено успешно
            
            return jsonify(updated_settings)
            
        except Exception as update_error:
            error_message = str(update_error)
            if "Настройки для chat_id" in error_message and "не существуют" in error_message:
                return jsonify({
                    "error": error_message,
                    "code": "SETTINGS_NOT_FOUND"
                }), 404
            else:
                raise update_error
    
    except Exception as e:
        logger.error(f"❌ Ошибка при обновлении настроек доступа: {str(e)}")
        return jsonify({
            "error": str(e),
            "code": "INTERNAL_ERROR"
        }), 500

@access_bp.route('/available-dates', methods=['GET'])
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

@access_bp.route('/available-dates/<date_str>', methods=['GET'])
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