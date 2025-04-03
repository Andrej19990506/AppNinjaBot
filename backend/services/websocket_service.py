import requests
import logging
from config.settings import WEBSOCKET_SERVER_URL

logger = logging.getLogger(__name__)

class WebSocketService:
    def __init__(self):
        self.base_url = WEBSOCKET_SERVER_URL.rstrip('/')
        
    def _make_request(self, method, endpoint, data=None):
        """Общий метод для отправки запросов к WebSocket серверу"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        try:
            response = requests.request(method, url, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка при обращении к WebSocket серверу: {str(e)}")
            return None

    def send_notification(self, chat_id, event_type, data):
        """Отправляет уведомление через WebSocket сервер"""
        endpoint = "api/notifications/send"
        payload = {
            "chat_id": chat_id,
            "event_type": event_type,
            "data": data
        }
        return self._make_request("POST", endpoint, payload)

    def broadcast_to_room(self, room, event, data):
        """Отправляет событие всем пользователям в комнате"""
        endpoint = "api/broadcast"
        payload = {
            "room": room,
            "event": event,
            "data": data
        }
        return self._make_request("POST", endpoint, payload)

    def get_room_users(self, room):
        """Получает список пользователей в комнате"""
        endpoint = f"api/rooms/{room}/users"
        return self._make_request("GET", endpoint)

    def join_user_to_room(self, room, user_id, user_info):
        """Добавляет пользователя в комнату"""
        endpoint = "api/rooms/join"
        payload = {
            "room": room,
            "user_id": user_id,
            "user_info": user_info
        }
        return self._make_request("POST", endpoint, payload)

    def remove_user_from_room(self, room, user_id):
        """Удаляет пользователя из комнаты"""
        endpoint = "api/rooms/leave"
        payload = {
            "room": room,
            "user_id": user_id
        }
        return self._make_request("POST", endpoint, payload)

# Создаем глобальный экземпляр сервиса
websocket_service = WebSocketService() 