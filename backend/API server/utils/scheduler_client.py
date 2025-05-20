# backend/API server/utils/scheduler_client.py
import os
import httpx
import logging
from typing import Dict, Any, Optional
import json
from datetime import datetime

# Импортируем Pydantic схему, чтобы указать тип
from schemas.event import NotificationRead

logger = logging.getLogger(__name__)

# --- Функция для отправки уведомления Шедулеру ---
async def notify_scheduler(notification_pydantic: NotificationRead, event_date: Optional[datetime]):
    """
    Отправляет данные уведомления в Шедулер для планирования.
    Принимает Pydantic модель уведомления и дату события.
    Вызывается как фоновая задача из API эндпоинтов.
    """
    try:
        scheduler_url = os.getenv("SCHEDULER_API_URL", "http://scheduler:8002")
        endpoint_url = f"{scheduler_url}/scheduler/notifications/schedule"

        # --- ИЗМЕНЕНИЕ: Создаем payload здесь с помощью model_dump --- 
        try:
            # Используем mode='json' для правильной сериализации datetime внутри модели
            payload = notification_pydantic.model_dump(mode='json')
            
            # Улучшенное логирование исходных данных для отладки проблемы send_now
            logger.info(f"[notify_scheduler] Исходные данные notification_pydantic: send_now={notification_pydantic.send_now}, use_absolute_time={notification_pydantic.use_absolute_time}")
            
            # --- ИСПРАВЛЕНИЕ: Переименовываем ключи для соответствия ожиданиям schedule() --- 
            # 1. notification_id
            if 'id' in payload:
                payload['notification_id'] = payload.pop('id') 
            
            # 2. event_date (уже строка ISO)
            if event_date:
                payload['event_date'] = event_date.isoformat()
            else:
                payload['event_date'] = None
            # Удаляем старый ключ event_time, если он был в Pydantic модели (а его не было)
            # payload.pop('event_time', None) 
                
            # 3. time_before
            if 'time' in payload:
                 payload['time_before'] = payload.pop('time')
            
            # 4. Проверяем и передаем новые параметры времени
            # Уже есть в payload с теми же именами:
            # - use_absolute_time 
            # - absolute_time (уже сериализован как ISO строка)
            # - send_now
            
            # Явно проверяем, что send_now существует и правильно преобразуем в bool
            if 'send_now' in payload:
                payload['send_now'] = bool(payload['send_now'])
                # Логируем для отладки
                logger.info(f"[notify_scheduler] Установлен параметр send_now={payload['send_now']} в payload")
            else:
                # Если поле отсутствует, добавляем его явно из исходной модели
                payload['send_now'] = bool(notification_pydantic.send_now)
                logger.info(f"[notify_scheduler] Добавлен параметр send_now={payload['send_now']} в payload из модели")
            
            # Логируем режим времени для дебага
            if payload.get('send_now'):
                logger.info(f"[notify_scheduler] Уведомление {payload.get('notification_id')} будет отправлено немедленно")
            elif payload.get('use_absolute_time'):
                logger.info(f"[notify_scheduler] Уведомление {payload.get('notification_id')} будет отправлено в абсолютное время: {payload.get('absolute_time')}")
            else:
                logger.info(f"[notify_scheduler] Уведомление {payload.get('notification_id')} будет отправлено относительно времени события: за {payload.get('time_before')} мин до {payload.get('event_date')}")
            # ----------------------------------------------------------------------------

        except Exception as dump_error:
            logger.error(f"Ошибка при создании payload для Шедулера (уведомление {getattr(notification_pydantic, 'id', 'N/A')}): {dump_error}", exc_info=True)
            return # Прерываем выполнение, если не можем создать payload

        logger.info(f"[notify_scheduler] Подготовка к отправке данных уведомления {payload.get('notification_id')} в Шедулер: {endpoint_url}")
        
        # Подробно логируем весь payload перед отправкой
        logger.info(f"[notify_scheduler] Полный payload для отправки в шедулер: {json.dumps(payload, default=str)}")

        async with httpx.AsyncClient() as client:
            logger.info(f"[notify_scheduler] Отправка POST запроса на {endpoint_url}")
            response = await client.post(endpoint_url, json=payload, timeout=15.0)
            response.raise_for_status()
            logger.info(f"[notify_scheduler] Успешный ответ от Шедулера ({response.status_code}): {response.text}")

    except httpx.RequestError as exc:
        logger.error(f"[notify_scheduler] Ошибка при вызове API Шедулера (RequestError) для уведомления {payload.get('notification_id', 'N/A')}: {exc}")
    except httpx.HTTPStatusError as exc:
        logger.error(f"[notify_scheduler] Ошибка от API Шедулера (HTTPStatusError {exc.response.status_code}) для уведомления {payload.get('notification_id', 'N/A')}: {exc.response.text}")
    except Exception as exc:
        logger.exception(f"[notify_scheduler] Неизвестная ошибка при отправке уведомления {payload.get('notification_id', 'N/A')} в Шедулер") 