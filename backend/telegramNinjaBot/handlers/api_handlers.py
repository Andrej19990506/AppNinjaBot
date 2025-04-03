import logging
from flask import jsonify, request
from typing import Any

logger = logging.getLogger(__name__)

class ApiHandler:
    """Обработчик API эндпоинтов"""
    
    def __init__(self, app: Any, bot: Any):
        self.app = app
        self.bot = bot
        self.register_endpoints()
        
    def register_endpoints(self) -> None:
        """Регистрирует все API эндпоинты"""
        
        @self.app.route('/api/send_message', methods=['POST'])
        async def send_message():
            """Отправка сообщения через Telegram бота"""
            try:
                data = await request.get_json()
                logger.info(f"Получен запрос на отправку сообщения: {data}")
                
                chat_id = data.get('chat_id')
                text = data.get('text')
                parse_mode = data.get('parse_mode', 'HTML')
                
                if not chat_id or not text:
                    logger.error("Не указан chat_id или текст сообщения")
                    return jsonify({"error": "Не указан chat_id или текст сообщения"}), 400
                
                # Отправляем сообщение через бота
                try:
                    await self.bot.send_message(
                        chat_id=chat_id,
                        text=text,
                        parse_mode=parse_mode
                    )
                    logger.info(f"✅ Сообщение успешно отправлено в чат {chat_id}")
                    return jsonify({"success": True, "message": "Сообщение успешно отправлено"})
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке сообщения в чат {chat_id}: {str(e)}")
                    return jsonify({"error": f"Ошибка при отправке сообщения: {str(e)}"}), 500
                    
            except Exception as e:
                logger.error(f"❌ Ошибка при обработке запроса: {str(e)}")
                return jsonify({"error": f"Ошибка при обработке запроса: {str(e)}"}), 500 