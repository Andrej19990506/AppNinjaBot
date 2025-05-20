import httpx
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from loguru import logger
from datetime import datetime # Добавлен datetime
from pydantic import ValidationError # <--- ДОБАВЛЕНО
from sqlalchemy import select
import schemas # Добавляем прямой импорт модуля schemas
import re # Добавляем импорт re

from schemas.retailiqa_schema import (
    RetailiQAReportApiResponse,
    RetailiQAReportItem,
    RetailiQACheckObjectsApiResponse,
    RetailiQACheckObject
)
from core.config import settings # Предполагаем, что настройки хранятся здесь
# Добавим импорт CRUD операций и схемы для Event
from crud import event as crud_event
from schemas import EventCreate, EventUpdate # Убедитесь, что импортируются корректные схемы
from models import Event # Прямой импорт модели Event для работы напрямую
from sqlalchemy.ext.asyncio import AsyncSession # Для AsyncSession type hint
# from db.session import AsyncSessionLocal # Для получения сессии БД, если сервис вызывается извне API роутов


class RetailiQAService:
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url or settings.RETAILIQA_API_BASE_URL
        self.api_token = token or settings.RETAILIQA_TOKEN
        # Токен теперь может быть None, если API не требует его для всех запросов
        # Проверка self.base_url остается
        if not self.base_url:
            raise ValueError("RETAILIQA_API_BASE_URL must be configured.")
        
        # Устанавливаем токен в заголовок по умолчанию для httpx клиента, если он есть
        self.headers = {}
        if self.api_token:
            # Проверяем, как именно RetailiQA ожидает токен.
            # Вариант 1: Bearer token
            # self.headers["Authorization"] = f"Bearer {self.api_token}"
            # Вариант 2: Прямой токен в специальном заголовке (часто X-Api-Key или просто Token)
            # RetailiQA, судя по документации, часто использует GET/POST параметры token или api_key.
            # Если токен должен быть в заголовке, раскомментируйте нужный вариант.
            # Пока оставим так, предполагая, что токен может передаваться в параметрах запроса,
            # или _request будет модифицирован для его добавления в параметры/тело.
            # Если токен ТОЛЬКО в заголовке, то:
            self.headers["Authorization"] = f"Token {self.api_token}" # Пример для "Token <value>"
            logger.info(f"RetailiQA Service initialized. Token set in headers: {'Yes' if self.api_token else 'No'}")


    async def _request(
        self, 
        method: str, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None
    ) -> Any:
        # Копируем заголовки по умолчанию
        request_headers = self.headers.copy()
        
        # Если API RetailiQA требует токен как параметр запроса (для GET) или в теле (для POST)
        # это нужно будет обрабатывать здесь или в вызывающих методах.
        # Например, для GET:
        # request_params = params.copy() if params else {}
        # if self.api_token and "token" not in request_params and "api_key" not in request_params:
        #     request_params["token"] = self.api_token # или "api_key"
        #
        # Для POST, токен может быть частью json_data
        # request_json_data = json_data.copy() if json_data else {}
        # if self.api_token and method.upper() == "POST" and "token" not in request_json_data:
        #    request_json_data["token"] = self.api_token

        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        logger.debug(f"RetailiQA API Request: {method} {url} | Headers: {request_headers} | Params: {params} | JSON: {json_data}")

        async with httpx.AsyncClient(timeout=settings.RETAILIQA_API_TIMEOUT) as client:
            try:
                response = await client.request(method, url, params=params, json=json_data, headers=request_headers)
                response.raise_for_status()
                logger.debug(f"RetailiQA API Response: {response.status_code} | Content: {response.text[:500]}...")
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"RetailiQA API HTTPStatusError: {e.response.status_code} for {e.request.url} - {e.response.text}")
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Error from RetailiQA API ({e.response.status_code}) for {e.request.url}: {e.response.text}"
                )
            except httpx.RequestError as e:
                logger.error(f"RetailiQA API RequestError for {e.request.url}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Could not connect to RetailiQA API ({e.request.url}): {e}"
                )
            except Exception as e:
                logger.error(f"RetailiQA API Generic Exception: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred while communicating with RetailiQA API."
                )

    async def get_reports(
        self, 
        date_from: Optional[str] = None, 
        date_to: Optional[str] = None, 
        limit: int = 100, 
        offset: int = 0,
        check_obj_name: Optional[str] = None,
        category_name: Optional[str] = None,
        insp_type_name: Optional[str] = None
    ) -> List[RetailiQAReportItem]:
        endpoint = "report/"
        # В RetailiQA API v2 /report/ часто используется POST для фильтров
        # Проверим документацию. Если GET, токен должен быть в params.
        # Если POST, токен и фильтры в json_data.
        
        # Предположим, что /report/ ожидает POST с фильтрами и токеном в теле
        payload: Dict[str, Any] = {"limit": limit, "offset": offset}
        if date_from:
            payload["from_date"] = date_from
        if date_to:
            payload["to_date"] = date_to
        if check_obj_name:
            payload["check_obj_name"] = check_obj_name
        if category_name:
            payload["category_name"] = category_name
        if insp_type_name:
            payload["insp_type_name"] = insp_type_name
        
        # Добавляем токен в тело запроса, если он не в заголовках и API этого требует
        if self.api_token and not self.headers.get("Authorization"):
             payload["token"] = self.api_token # или api_key, как указано в документации RetailiQA

        # Используем POST, как более вероятно для /report/ с фильтрами
        # raw_response = await self._request(method="GET", endpoint=endpoint, params=params) # Старый вариант
        raw_response = await self._request(method="POST", endpoint=endpoint, json_data=payload)

        # --- НАЧАЛО ВРЕМЕННОГО ДЕТАЛЬНОГО ЛОГИРОВАНИЯ ---
        # logger.info("!!! ВРЕМЕННОЕ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ RAW RESPONSE из get_reports !!!")
        # if isinstance(raw_response, dict):
        #     logger.info(f"Raw response (тип dict, первые 1000 символов): {str(raw_response)[:1000]}...")
            
        #     result_outer = raw_response.get('result')
        #     if isinstance(result_outer, dict):
        #         result_inner_list = result_outer.get('result')
        #         if isinstance(result_inner_list, list):
        #             logger.info(f"Найдено {len(result_inner_list)} элементов в raw_response['result']['result']")
        #             if not result_inner_list:
        #                 logger.info("Список raw_response['result']['result'] ПУСТ.")
        #             else:
        #                 logger.info("--- Детальное логирование каждого элемента из raw_response['result']['result'] (ключевые поля) ---")
        #                 for i, item_dict in enumerate(result_inner_list):
        #                     log_entry = {
        #                         "index": i,
        #                         "insp_id": item_dict.get("insp_id"),
        #                         "insp_scope": item_dict.get("insp_scope"), # Название пункта чек-листа
        #                         "task_answer": item_dict.get("task_answer"), # Оценка пункта
        #                         "task_pt": item_dict.get("task_pt"),         # Набранные баллы за пункт
        #                         "task_sum": item_dict.get("task_sum"),       # Сумма штрафных баллов за пункт
        #                         "task_comments": item_dict.get("task_comments") # Комментарии к пункту
        #                     }
        #                     logger.info(f"Элемент {i}: {log_entry}")
        #                 logger.info("--- Конец детального логирования элементов ---")
        #         else:
        #             logger.warning("raw_response['result']['result'] не является списком или отсутствует.")
        #     else:
        #         logger.warning("raw_response['result'] не является словарем или отсутствует.")
        # else:
        #     logger.warning(f"Raw_response не является словарем. Тип: {type(raw_response)}, Содержимое (первые 1000 символов): {str(raw_response)[:1000]}...")
        # logger.info("!!! КОНЕЦ ВРЕМЕННОГО ДЕТАЛЬНОГО ЛОГИРОВАНИЯ RAW RESPONSE !!!")
        # --- КОНЕЦ ВРЕМЕННОГО ДЕТАЛЬНОГО ЛОГИРОВАНИЯ ---

        # --- ДИАГНОСТИЧЕСКИЙ БЛОК ---
        logger.debug("--- Начало диагностического блока для raw_response ---")
        if isinstance(raw_response, dict):
            logger.debug("raw_response является словарем.")
            
            # Пытаемся получить доступ к 'result'
            result_outer = raw_response.get('result')
            if result_outer is None:
                logger.error("Ключ 'result' (внешний) отсутствует в raw_response!")
            elif not isinstance(result_outer, dict):
                logger.error(f"raw_response['result'] не является словарем, тип: {type(result_outer)}")
            else:
                logger.debug("raw_response['result'] (внешний) найден и является словарем.")
                
                # Пытаемся получить доступ к 'result' внутреннему
                result_inner_list = result_outer.get('result')
                if result_inner_list is None:
                    logger.error("Ключ 'result' (внутренний) отсутствует в raw_response['result']!")
                elif not isinstance(result_inner_list, list):
                    logger.error(f"raw_response['result']['result'] не является списком, тип: {type(result_inner_list)}")
                else:
                    logger.debug("raw_response['result']['result'] найден и является списком.")
                    if not result_inner_list:
                        logger.debug("Список raw_response['result']['result'] пуст.")
                    else:
                        logger.debug(f"Количество элементов в raw_response['result']['result']: {len(result_inner_list)}")
                        first_item_dict = result_inner_list[0]
                        if not isinstance(first_item_dict, dict):
                            logger.error(f"Первый элемент в raw_response['result']['result'] не словарь, тип: {type(first_item_dict)}")
                        else:
                            logger.debug(f"Первый элемент: {str(first_item_dict)[:200]}...")
                            # Теперь ищем ключ 'type', который вызывал ошибку (или любой другой для теста)
                            # Например, 'insp_id', который у нас точно есть в примере
                            test_insp_id = first_item_dict.get('insp_id')
                            if test_insp_id is None:
                                logger.error("Ключ 'insp_id' ОТСУТСТВУЕТ в первом элементе списка!")
                            else:
                                logger.debug(f"Ключ 'insp_id' в первом элементе найден: {test_insp_id}")

                                # ПРОВЕРКА НА КЛЮЧ 'type' (если он ожидается Pydantic)
                                # Pydantic может искать 'type' для дискриминированных объединений или других целей
                                test_type_field = first_item_dict.get('type') 
                                if test_type_field is None:
                                    logger.warning("!!! Ключ 'type' ОТСУТСТВУЕТ в первом элементе списка (first_item_dict) ДО модификации!!!")
                                else:
                                     logger.info(f"!!! Ключ 'type' в первом элементе НАЙДЕН ДО модификации: {test_type_field} !!!")
        else:
            logger.warning(f"raw_response не является словарем! Тип: {type(raw_response)}")
        logger.debug("--- Конец диагностического блока для raw_response ---")

        # --- Попытка добавить фиктивный ключ 'type' ВЕЗДЕ --- 
        logger.debug("!!! Попытка добавить фиктивный ключ 'type' ВЕЗДЕ !!!")
        if isinstance(raw_response, dict):
            if 'type' not in raw_response:
                raw_response['type'] = 'ApiResponseDefaultType' # Для RetailiQAReportApiResponse
            
            result_outer_mod = raw_response.get('result') # Берем уже из raw_response, куда могли добавить type
            if isinstance(result_outer_mod, dict):
                if 'type' not in result_outer_mod:
                    result_outer_mod['type'] = 'ApiResultDefaultType' # Для RetailiQAReportResult
                
                result_inner_list_mod = result_outer_mod.get('result')
                if isinstance(result_inner_list_mod, list):
                    for item_dict in result_inner_list_mod:
                        if isinstance(item_dict, dict) and 'type' not in item_dict:
                            item_dict['type'] = 'ReportItemDefaultType' # Для RetailiQAReportItem
            logger.debug(f"После добавления 'type' везде. Raw_response (до 200 символов): {str(raw_response)[:200]}")
            if isinstance(raw_response.get('result'), dict) and \
               isinstance(raw_response.get('result',{}).get('result'), list) and \
               raw_response['result']['result']:
                logger.debug(f"Пример первого элемента после модификации: {str(raw_response['result']['result'][0])[:200]}")
        else:
            logger.warning("Не удалось добавить фиктивный 'type' везде: raw_response не словарь.")

        try:
            logger.debug(f"Перед model_validate в get_reports. Raw response type: {type(raw_response)}, content: {str(raw_response)[:200]}")
            
            # --- ИЗМЕНЕНИЕ ПОДХОДА: ПРЯМОЙ ДОСТУП К ЭЛЕМЕНТАМ ВМЕСТО PYDANTIC ---
            if not isinstance(raw_response, dict) or 'result' not in raw_response:
                logger.error("raw_response не является словарем или не содержит 'result'")
                return []
                
            if not isinstance(raw_response['result'], dict) or 'result' not in raw_response['result']:
                logger.error("raw_response['result'] не является словарем или не содержит 'result'")
                return []
                
            result_items = raw_response['result']['result']
            if not isinstance(result_items, list):
                logger.error(f"raw_response['result']['result'] не является списком, тип: {type(result_items)}")
                return []
                
            # Конвертируем каждый элемент в Pydantic модель по отдельности, с улавливанием ошибок
            validated_items = []
            for idx, item_dict in enumerate(result_items):
                if not isinstance(item_dict, dict):
                    logger.warning(f"Элемент {idx} не является словарем, пропускаем")
                    continue
                    
                # Добавляем 'type' если его нет
                if 'type' not in item_dict:
                    item_dict['type'] = 'ReportItemDefaultType'
                    
                try:
                    # Используем model_validate вместо parse_obj (который устарел)
                    validated_item = RetailiQAReportItem.model_validate(item_dict)
                    validated_items.append(validated_item)
                except ValidationError as ve:
                    logger.error(f"Ошибка валидации для элемента {idx}: {ve.errors()}")
                    # Опционально можно попробовать использовать item_dict напрямую
                    # или создать объект с минимальным набором полей
                except Exception as e:
                    logger.error(f"Непредвиденная ошибка при валидации элемента {idx}: {e}")
                    
            logger.info(f"Успешно валидировано {len(validated_items)} из {len(result_items)} элементов")
            return validated_items
            
            # --- КОНЕЦ ИЗМЕНЕНИЯ ПОДХОДА ---
            
        except KeyError as ke: # <--- ЯВНЫЙ ПЕРЕХВАТ KEYERROR
            logger.error(f"RetailiQA API get_reports - CAUGHT KeyError: {ke} | Raw response: {raw_response!r}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"KeyError during RetailiQA API response processing (reports): {str(ke)}"
            )
        except ValidationError as ve: # <--- ЯВНЫЙ ПЕРЕХВАТ PYDANTIC VALIDATIONERROR
            logger.error(f"RetailiQA API get_reports - Pydantic ValidationError: {ve.errors()} | Raw response: {raw_response!r}", exc_info=True)
            # ve.errors() даст детальную структуру ошибок валидации
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Pydantic ValidationError during RetailiQA API response processing (reports): {ve.errors()}"
            )
        except Exception as e: 
            logger.error(f"RetailiQA API get_reports - Other Exception: {type(e).__name__} - {e} | Raw response: {raw_response!r}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to validate/process response from RetailiQA API (reports): {type(e).__name__} - {str(e)}"
            )
        except BaseException as be: 
            logger.critical(f"RetailiQA API get_reports - CAUGHT BASE EXCEPTION: {type(be).__name__} - {be} | Raw response: {raw_response!r}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Critical base error during RetailiQA API response processing (reports): {type(be).__name__} - {str(be)}"
            )

    async def get_check_objects(
        self, 
        name_filter: Optional[str] = None, 
        limit: int = 100, 
        offset: int = 0
    ) -> List[RetailiQACheckObject]: # Возвращаем список Pydantic моделей
        endpoint = "check_objects/"
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        
        effective_name_filter = name_filter # Сохраняем исходный фильтр для логов

        if name_filter:
            params["name"] = name_filter

        if self.api_token and not self.headers.get("Authorization"):
            params["token"] = self.api_token

        display_name_filter_value = name_filter if name_filter else "(нет)"
        logger.info(f"RetailiQA: Запрос объектов. Фильтр по имени: '{display_name_filter_value}', Limit: {limit}, Offset: {offset}")
        raw_response = await self._request(method="GET", endpoint=endpoint, params=params)

        # Проверяем, был ли применен фильтр и не пуст ли результат от API
        # Если фильтр был, а результат пуст, делаем второй запрос без фильтра имени
        if name_filter and isinstance(raw_response, dict) and not raw_response.get("result"): # count == 0 или result пустой
            logger.info(f"RetailiQA: Поиск по имени '{name_filter}' не дал результатов. Запрашиваем полный список объектов (страница 1)...")
            params_no_name_filter = {"limit": limit, "offset": offset} # offset лучше оставить 0 для первого запроса полного списка
            if self.api_token and not self.headers.get("Authorization"):
                params_no_name_filter["token"] = self.api_token
            
            effective_name_filter = None # Сбрасываем, так как фильтр не сработал на стороне API
            raw_response = await self._request(method="GET", endpoint=endpoint, params=params_no_name_filter)
            logger.info(f"RetailiQA: Получен ответ на запрос полного списка объектов.")
        
        try:
            # Валидируем Pydantic моделью. Предполагается, что RetailiQACheckObjectsApiResponse
            # имеет поле result: List[RetailiQACheckObject]
            validated_response = RetailiQACheckObjectsApiResponse.model_validate(raw_response)
            
            # Если первоначальный name_filter не сработал на стороне API (effective_name_filter is None)
            # и у нас есть исходный name_filter, то фильтруем результат на нашей стороне.
            if effective_name_filter is None and name_filter and validated_response.result:
                logger.info(f"RetailiQA: Фильтруем полученный полный список ({len(validated_response.result)} объектов) локально по ключу '{name_filter}'")
                filtered_locally = [
                    obj for obj in validated_response.result 
                    if name_filter.lower() in obj.name.lower()
                ]
                logger.info(f"RetailiQA: Локальная фильтрация оставила {len(filtered_locally)} объектов.")
                return filtered_locally
            
            return validated_response.result
        except ValidationError as ve:
            logger.error(f"RetailiQA API get_check_objects - Pydantic validation error: {ve.errors()} | Raw response: {str(raw_response)[:500]}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Pydantic validation error for check objects: {ve.errors()}"
            )
        except Exception as e:
            logger.error(f"RetailiQA API get_check_objects - Exception: {type(e).__name__} - {e} | Raw response: {str(raw_response)[:500]}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process response from RetailiQA API for check objects: {type(e).__name__}"
            )

    async def get_all_categories_for_check_type(self, check_type_name: str) -> List[str]:
        """
        Получает список всех уникальных категорий (scopes.category)
        для заданного типа проверки (check_type_name).
        Использует эндпоинт /api/v2/check_types/ с фильтром по имени.
        """
        endpoint = "check_types/"
        params = {"name": check_type_name}
        logger.info(f"Запрос всех категорий для типа чек-листа '{check_type_name}' с параметрами: {params}")

        try:
            raw_api_response = await self._request(method="GET", endpoint=endpoint, params=params)
            
            check_types_list = [] # Initialize to an empty list to store the actual list of check types

            if isinstance(raw_api_response, dict):
                result_data = raw_api_response.get('result')
                if isinstance(result_data, list):
                    check_types_list = result_data
                elif result_data is not None: # 'result' key exists but is not a list
                    logger.warning(
                        f"Ответ от /check_types/ API для '{check_type_name}' содержит ключ 'result', "
                        f"но его значение не является списком. Тип: {type(result_data)}. "
                        f"Данные: {str(result_data)[:500]}"
                    )
                    return [] # Treat as an error or no usable data
                else: # 'result' key is missing from the dictionary
                    logger.warning(
                        f"Ответ от /check_types/ API для '{check_type_name}' является словарем, "
                        f"но не содержит ожидаемый ключ 'result'. "
                        f"Данные: {str(raw_api_response)[:500]}"
                    )
                    return [] # Treat as an error or no usable data
            elif isinstance(raw_api_response, list):
                check_types_list = raw_api_response # API directly returned a list
            else: # Response is neither a dict nor a list
                logger.warning(
                    f"Ответ от /check_types/ API для '{check_type_name}' не является ни словарем, ни списком. "
                    f"Получено: {type(raw_api_response)}. Данные: {str(raw_api_response)[:500]}"
                )
                return []

            categories = set()
            # The original 'if not isinstance(response_data, list):' and 'if not response_data:' checks
            # are now effectively replaced by the logic above and the check below.
            
            if not check_types_list: # Handles if list is empty after attempted extraction or if API returned empty list
                logger.warning(f"Для типа чек-листа '{check_type_name}' не найдено записей в /check_types/ (ответ пустой, не содержит 'result' или структура не соответствует ожиданиям).")
                return []

            found_check_type = False
            for check_type_obj in check_types_list: # Iterate over the correctly extracted list
                if isinstance(check_type_obj, dict) and check_type_obj.get("name") == check_type_name:
                    found_check_type = True
                    scopes = check_type_obj.get("scopes")
                    if isinstance(scopes, list):
                        for scope in scopes:
                            if isinstance(scope, dict) and "category" in scope and scope["category"] is not None:
                                categories.add(scope["category"])
                            elif isinstance(scope, dict) and "category" not in scope:
                                logger.debug(f"Пункт (scope) в чек-листе '{check_type_name}' не имеет поля 'category'. Scope data: {str(scope)[:200]}")
                    else:
                        logger.warning(f"В объекте чек-листа '{check_type_name}' поле 'scopes' не список или отсутствует. Scopes: {scopes}")
                    break # Нашли нужный check_type_name, выходим из цикла по response_data
            
            if not found_check_type:
                logger.warning(f"Чек-лист с именем '{check_type_name}' не найден в ответе от /check_types/, хотя ответ не был пустым.")

            if not categories:
                logger.info(f"Для типа чек-листа '{check_type_name}' не найдено категорий в его пунктах (scopes), либо пункты отсутствуют, либо категории пустые.")
            
            return sorted(list(categories))

        except HTTPException as http_exc:
            logger.error(f"HTTPException при запросе категорий для '{check_type_name}': {http_exc.detail}")
            raise
        except Exception as e:
            logger.error(f"Ошибка при получении/обработке категорий для типа чек-листа '{check_type_name}': {e}", exc_info=True)
            return []

    async def process_new_reports(
        self, 
        db: AsyncSession, 
        check_obj_name_param: str, 
        date_from_param: Optional[str] = None, 
        date_to_param: Optional[str] = None, # Новый параметр
        max_pages: int = 1
    ) -> List[Event]:
        """
        Получает новые отчеты из RetailiQA, обрабатывает их и сохраняет/обновляет события в БД.
        check_obj_name_param: Имя объекта проверки в RetailiQA.
        date_from_param: дата начала периода в формате YYYY-MM-DD.
        date_to_param: дата окончания периода в формате YYYY-MM-DD.
        max_pages: максимальное количество страниц запросов к API
        """
        logger.info(f"Запуск обработки новых отчетов RetailiQA для объекта '{check_obj_name_param}' с {date_from_param=} по {date_to_param=}, максимум страниц: {max_pages}")
        processed_events: List[Event] = []
        
        try:
            all_report_items: List[RetailiQAReportItem] = []
            offset = 0
            page_limit = 100
            iteration = 0
            total_items_before_filtering = 0

            if not check_obj_name_param:
                logger.error("Ошибка: Имя объекта для RetailiQA (check_obj_name_param) не предоставлено.")
                raise ValueError("check_obj_name_param is required for process_new_reports")
            logger.info(f"Целевой объект для запроса к API RetailiQA: '{check_obj_name_param}'")

            # Логирование используемого диапазона дат
            if date_from_param and date_to_param:
                logger.info(f"Поиск отчетов будет производиться за период: с {date_from_param} по {date_to_param}")
            elif date_from_param: # Только date_from_param указан (поиск за один день)
                 logger.info(f"Поиск отчетов будет производиться за дату: {date_from_param} (используется для from_date и to_date)")
            else: # Ни одна из дат не указана (поиск без фильтра по дате, по логике RetailiQA API)
                logger.info("Поиск отчетов будет производиться без фильтра по дате (для получения последних отчетов согласно логике RetailiQA API).")

            while iteration < max_pages:
                iteration += 1
                log_date_from = date_from_param if date_from_param else 'не указана'
                log_date_to = date_to_param if date_to_param else 'не указана'
                
                logger.debug(
                    f"Запрос отчетов RetailiQA: limit={page_limit}, offset={offset}, "
                    f"from_date={log_date_from}, to_date={log_date_to}, "
                    f"check_obj_name='{check_obj_name_param}', "
                    f"insp_type_name='АТО_Производство_new', итерация={iteration}/{max_pages}"
                )
                report_batch = await self.get_reports(
                    date_from=date_from_param, 
                    date_to=date_to_param, 
                    limit=page_limit, 
                    offset=offset,
                    check_obj_name=check_obj_name_param,
                    insp_type_name="АТО_Производство_new"
                )
                
                if not report_batch:
                    logger.debug(f"Получен пустой report_batch на итерации {iteration}, выходим из цикла пагинации.")
                    break
                
                total_items_before_filtering += len(report_batch)

                logger.debug(f"Получен report_batch (длина: {len(report_batch)}, первые 3 элемента): {report_batch[:3]!r}")

                # --- ИЗМЕНЕННАЯ ФИЛЬТРАЦИЯ: ОТБОР РЕАЛЬНЫХ НАРУШЕНИЙ И ВАЖНЫХ ЗАМЕЧАНИЙ ---
                items_with_violations = [
                    item for item in report_batch 
                    if (item.task_answer and isinstance(item.task_answer, str) and item.task_answer.lower() == "нет") or \
                       (item.task_sum is not None and item.task_sum > 0) or \
                       (item.task_comments and len(item.task_comments.strip()) > 0)
                ]

                # Логируем результат новой фильтрации
                if report_batch and not items_with_violations:
                    logger.debug(f"На итерации {iteration} было {len(report_batch)} элементов, но ни один не определен как нарушение или важное замечание.")
                elif report_batch and items_with_violations:
                    logger.debug(f"На итерации {iteration} из {len(report_batch)} элементов отобрано {len(items_with_violations)} как нарушения или важные замечания.")
                
                all_report_items.extend(items_with_violations) # Собираем нарушения и важные замечания
                logger.debug(f"Добавлено {len(items_with_violations)} элементов-нарушений или важных замечаний в all_report_items на итерации {iteration}. Общее количество теперь: {len(all_report_items)}")

                if len(report_batch) < page_limit: # Проверяем длину исходного report_batch для логики пагинации
                    logger.debug(f"Длина исходного batch ({len(report_batch)}) меньше лимита ({page_limit}) на итерации {iteration}, выходим из цикла пагинации.")
                    break 
                
                offset += page_limit
            
            if iteration >= max_pages and report_batch and len(report_batch) == page_limit :
                logger.warning(f"Достигнуто максимальное количество запрашиваемых страниц ({max_pages}). Возможно, не все данные были загружены, так как последняя страница была полной.")
            
            # <--- ИЗМЕНЕНО: Обновленная строка лога для отражения НОВОЙ расширенной фильтрации
            logger.info(f"Всего было загружено {len(all_report_items)} элементов (нарушения и важные замечания, тип 'АТО_Производство_new' отфильтрован API) из RetailiQA API за {iteration} итераций.")

            if not all_report_items:
                logger.info("Новых пунктов отчетов (нарушений или важных замечаний) для обработки (тип 'АТО_Производство_new') нет.")
                return processed_events

            logger.debug(f"Содержимое all_report_items (первые 5 элементов, если есть): {all_report_items[:5]!r}")

            reports_by_insp_id: Dict[str, List[RetailiQAReportItem]] = {}
            for i, item in enumerate(all_report_items):
                logger.debug(f"Processing item {i}: type={type(item)}, content={item!r}") # Добавлено логирование
                try:
                    if item.insp_id not in reports_by_insp_id:
                        reports_by_insp_id[item.insp_id] = []
                    reports_by_insp_id[item.insp_id].append(item)
                except AttributeError as attr_err:
                    logger.error(f"AttributeError for item {i}: {attr_err}. Item content: {item!r}", exc_info=True)
                    # Можно пропустить этот элемент или перевыбросить ошибку
                    continue # Пропускаем "плохой" элемент
                except KeyError as key_err: # На случай если item все-таки dict
                    logger.error(f"KeyError for item {i}: {key_err}. Item content: {item!r}", exc_info=True)
                    continue # Пропускаем "плохой" элемент
            
            logger.info(f"Сгруппировано {len(reports_by_insp_id)} уникальных проверок (insp_id).")

            # Находим последнюю проверку текущего месяца
            now = datetime.now()
            # Получаем начало текущего месяца
            current_month_start = datetime(now.year, now.month, 1)
            
            # Находим последнюю проверку
            latest_insp_id = None
            latest_insp_date = None
            
            for insp_id, items in reports_by_insp_id.items():
                if not items:
                    continue
                
                first_item = items[0]
                try:
                    insp_date_str = first_item.insp_date
                    # Парсим дату из строки в формате DD.MM.YYYY
                    day, month, year = map(int, insp_date_str.split('.'))
                    insp_date = datetime(year, month, day)
                    
                    # Проверяем, что дата в текущем месяце
                    if insp_date >= current_month_start and (latest_insp_date is None or insp_date > latest_insp_date):
                        latest_insp_id = insp_id
                        latest_insp_date = insp_date
                except (ValueError, AttributeError, TypeError) as e:
                    logger.warning(f"Не удалось преобразовать дату для проверки {insp_id}: {first_item.insp_date}. Ошибка: {e}")
            
            # Если последняя проверка не найдена, выбираем самую последнюю из всех
            if latest_insp_id is None and reports_by_insp_id:
                logger.warning("Не найдена проверка за текущий месяц, выбираем самую последнюю из всех доступных проверок")
                for insp_id, items in reports_by_insp_id.items():
                    if not items:
                        continue
                    
                    first_item = items[0]
                    try:
                        insp_date_str = first_item.insp_date
                        # Парсим дату из строки в формате DD.MM.YYYY
                        day, month, year = map(int, insp_date_str.split('.'))
                        insp_date = datetime(year, month, day)
                        
                        if latest_insp_date is None or insp_date > latest_insp_date:
                            latest_insp_id = insp_id
                            latest_insp_date = insp_date
                    except (ValueError, AttributeError, TypeError) as e:
                        logger.warning(f"Не удалось преобразовать дату для проверки {insp_id}: {first_item.insp_date}. Ошибка: {e}")
            
            # Если после всех попыток не нашли проверку, возвращаем пустой результат
            if latest_insp_id is None:
                logger.warning("Не удалось найти ни одной подходящей проверки для обработки")
                return processed_events
            
            # Обрабатываем только последнюю найденную проверку
            # processed_insp_ids = [] # Эта переменная не используется, можно удалить или закомментировать
            
            # Меняем обработку всех отчетов на обработку только последнего
            # items = reports_by_insp_id.get(latest_insp_id, []) # Старая строка, items берутся из неполного скана
            # if not items:
            #     logger.warning(f"Странно: нашли ID {latest_insp_id}, но список элементов для него пуст")
            #     return processed_events
            # first_item = items[0] # first_item также брался из неполного скана

            # Сначала получим first_item из первоначального скана, чтобы знать детали проверки для полного запроса
            initial_items_for_latest_insp = reports_by_insp_id.get(latest_insp_id, [])
            if not initial_items_for_latest_insp:
                logger.warning(f"Для последней выбранной проверки {latest_insp_id} не найдено пунктов в первоначальном сканировании. Невозможно продолжить.")
                return processed_events # Если latest_insp_id был определен, но для него нет initial_items, что-то не так
            first_item = initial_items_for_latest_insp[0]
            
            # Определяем приемлемые статусы для обработки (этот блок был ниже, переносим выше для раннего выхода)
            acceptable_statuses = ["Закрыта", "Работа над ошибками", "Подписание"]
            if first_item.state_message not in acceptable_statuses:
                logger.info(f"Проверка {latest_insp_id} ({first_item.insp_obj}) имеет неприемлемый для обработки статус: '{first_item.state_message}' (is_closed: {first_item.is_closed}). Пропускаем.")
                return processed_events

            logger.info(f"Проверка {latest_insp_id} ({first_item.insp_obj}) в статусе '{first_item.state_message}' (is_closed: {first_item.is_closed}) будет обработана.")
            logger.info(f"Получение полного списка пунктов для проверки ID: {latest_insp_id} от {first_item.insp_date} для объекта '{first_item.insp_obj}'")

            try:
                check_date_obj = datetime.strptime(first_item.insp_date, "%d.%m.%Y")
                specific_insp_date_iso = check_date_obj.strftime("%Y-%m-%d")
            except ValueError:
                logger.warning(f"Не удалось распарсить insp_date '{first_item.insp_date}' для получения полного списка. Используем как есть.")
                specific_insp_date_iso = first_item.insp_date

            all_items_for_selected_inspection = await self.get_reports(
                date_from=specific_insp_date_iso,
                date_to=specific_insp_date_iso, # Убедимся, что запрашиваем только один день проверки
                limit=1000, # Достаточный лимит для всех пунктов одной проверки
                check_obj_name=first_item.insp_obj,
                insp_type_name="АТО_Производство_new" # Сохраняем фильтр по типу проверки
            )

            items_to_detail: List[RetailiQAReportItem]
            if not all_items_for_selected_inspection:
                logger.warning(f"Не удалось получить полный список пунктов для проверки {latest_insp_id} при повторном запросе. Будут использованы пункты из первоначального сканирования (если они прошли фильтр).")
                # В этом случае, items_to_detail будет состоять из initial_items_for_latest_insp,
                # которые уже являются результатом фильтра items_with_violations, примененного к report_batch.
                items_to_detail = initial_items_for_latest_insp
            else:
                logger.info(f"Успешно получено {len(all_items_for_selected_inspection)} пунктов для детального анализа проверки {latest_insp_id}.")
                # Применяем фильтр items_with_violations к ПОЛНОМУ списку пунктов этой конкретной проверки
                items_to_detail = [
                    item for item in all_items_for_selected_inspection
                    if (item.task_answer and isinstance(item.task_answer, str) and item.task_answer.lower() == "нет") or \
                       (item.task_sum is not None and item.task_sum > 0) or \
                       (item.task_comments and len(item.task_comments.strip()) > 0)
                ]
            
            logger.info(f"После фильтрации (повторно полученных или первоначальных) пунктов, {len(items_to_detail)} будет включено в detailed_violations_list.")

            # first_item уже определен из initial_items_for_latest_insp и остается актуальным для метаданных всей проверки.
            # Если items_to_detail пуст, но initial_items_for_latest_insp не был, first_item валиден.
            # Если items_to_detail не пуст, first_item все еще представляет всю проверку.

            if not items_to_detail and not initial_items_for_latest_insp: # Эта проверка может быть избыточной, т.к. first_item уже есть
                 logger.warning(f"Нет пунктов для детализации для проверки {latest_insp_id} ни после повторного запроса, ни в первоначальном скане. Обработка этой проверки прекращена.")
                 return processed_events
            elif not items_to_detail and initial_items_for_latest_insp:
                 logger.warning(f"После фильтрации полного (или первоначального) списка для {latest_insp_id} не осталось пунктов для детализации, хотя первоначальный скан содержал пункты. Это может быть нормально, если все они не прошли детальный фильтр.")
                 # Продолжаем, так как общая информация о проверке (баллы и т.д.) все еще может быть актуальна.
                 # detailed_violations_list будет пустым.

            # Далее используем 'items_to_detail' для формирования списков для события
            number_of_violations = len(items_to_detail)

            detailed_violations_list = []
            comments_for_event = []

            for item_detail in items_to_detail: # Итерация по items_to_detail
                violation_type = "нарушение" if item_detail.task_sum is not None and item_detail.task_sum > 0 else "замечание"
                
                # >>> Начало блока фильтрации комментариев
                if item_detail.task_comments and latest_insp_date: # latest_insp_date должно быть datetime объектом
                    original_comments_text = item_detail.task_comments
                    # Regex для извлечения: [Полное имя DD.MM.YYYY HH:MM] Текст комментария
                    # Группы: 1=Имя, 2=Дата DD.MM.YYYY, 3=Время HH:MM, 4=Текст комментария
                    # (?=\\n\\[|$) - позитивный просмотр вперед для корректного разделения многострочных комментариев
                    comment_pattern = re.compile(r"\[(.*?) (\d{2}\.\d{2}\.\d{4}) \d{2}:\d{2}\]\s*(.*?)(?=\\n\[|$)", re.DOTALL)
                    
                    filtered_comment_parts = []
                    for match in comment_pattern.finditer(original_comments_text):
                        author_and_time_info = match.group(1).strip() # Все до даты
                        comment_date_str = match.group(2)
                        comment_content = match.group(3).strip()
                        
                        try:
                            # Парсим дату комментария
                            day, month, year = map(int, comment_date_str.split('.'))
                            parsed_comment_date = datetime(year, month, day)
                            
                            # Сравниваем месяц и год с датой последней инспекции
                            if parsed_comment_date.year == latest_insp_date.year and \
                               parsed_comment_date.month == latest_insp_date.month:
                                # Собираем комментарий обратно в исходном формате, если он актуален
                                full_comment_line = match.group(0).strip() # Вся совпавшая строка
                                filtered_comment_parts.append(full_comment_line)
                        except ValueError:
                            logger.warning(f"Не удалось распарсить дату '{comment_date_str}' в комментарии: {match.group(0)}. Комментарий будет оставлен как есть.")
                            # Если не удалось распарсить, оставляем как есть, чтобы не потерять
                            filtered_comment_parts.append(match.group(0).strip())

                    if filtered_comment_parts:
                        item_detail.task_comments = "\\n".join(filtered_comment_parts)
                    elif original_comments_text and not filtered_comment_parts : # Если были комменты, но все отфильтровались
                        item_detail.task_comments = "" # Очищаем, если все комментарии неактуальны
                        logger.debug(f"Все комментарии для пункта '{item_detail.insp_scope}' были отфильтрованы как неактуальные.")
                    # Если изначально не было комментариев или regex ничего не нашел, item_detail.task_comments остается без изменений

                # <<< Конец блока фильтрации комментариев
                
                comment_text = item_detail.task_comments.strip() if item_detail.task_comments and item_detail.task_comments.strip() else "Штрафной пункт без комментария"
                
                # Парсим фотографии для конкретного пункта нарушения
                item_photos_list = []
                if item_detail.task_photos:
                    # Разделяем по запятой или точке с запятой, удаляем пробелы
                    raw_urls = re.split(r'[,;]', item_detail.task_photos)
                    item_photos_list = [url.strip() for url in raw_urls if url.strip()]

                violation_item_for_list = { # Переименовал, чтобы не конфликтовать с item из outer scope
                    "title": item_detail.insp_scope or "Без названия пункта",
                    "text": comment_text,
                    "penalty": item_detail.task_sum if item_detail.task_sum is not None else 0.0,
                    "type": violation_type,
                    "photos": item_photos_list # Добавляем список фотографий пункта
                }
                detailed_violations_list.append(violation_item_for_list)

                # Формируем строку для поля comments - используем тот же comment_text
                if (item_detail.task_comments and item_detail.task_comments.strip()) or (item_detail.task_sum is not None and item_detail.task_sum > 0):
                    comments_for_event.append(f"{item_detail.insp_scope or 'Пункт'}: {comment_text}")
            
            # current_inspection_total_penalty_sum теперь тоже логичнее считать из items_to_detail
            current_inspection_total_penalty_sum = sum(v_item.task_sum for v_item in items_to_detail if v_item.task_sum is not None)

            # Комментарии теперь из comments_for_event для поля retailiqa_comments
            # photos остаются как есть
            photos = []
            if items_to_detail: # Используем items_to_detail
                photos = [
                    photo_url.strip() 
                    for item_photo in items_to_detail # Переименовал переменную цикла
                    if item_photo.task_photos 
                    for photo_url in item_photo.task_photos.split(',') 
                    if photo_url.strip()
                ]
            
            # Конвертируем строку даты в datetime объект
            # Убедимся, что insp_completed всегда валидная ISO строка
            try:
                event_date = datetime.fromisoformat(first_item.insp_completed)
            except ValueError:
                logger.error(f"Некорректный формат даты insp_completed: {first_item.insp_completed} для insp_id: {latest_insp_id}. Используем текущее время.")
                event_date = datetime.now() # Или другое значение по умолчанию / пропуск

            # Получаем полный результат проверки через calculate_check_score
            # Извлекаем дату проверки для запроса (используем ту же, что для get_reports)
            score_data_date_iso = specific_insp_date_iso
            
            score_data = await self.calculate_check_score(
                check_obj_name=first_item.insp_obj, # first_item все еще актуален для имени объекта
                date_from=score_data_date_iso,
                date_to=score_data_date_iso
            )
            
            # Используем данные из полного расчета, если они доступны
            score_percentage = None
            total_possible_points = 0
            total_earned_points = 0
            # penalty_points будет взят из score_data или fallback на current_inspection_total_penalty_sum
            # (который теперь посчитан по items_to_detail)
            penalty_points_final = 0 # Переименовал для ясности

            if score_data.get("status") == "success":
                score_percentage = score_data.get("score_percentage")
                total_possible_points = score_data.get("max_points", 0)
                total_earned_points = score_data.get("earned_points", 0)
                penalty_points_final = score_data.get("penalty_points", current_inspection_total_penalty_sum)
                logger.info(f"Получены полные данные о проверке: проценты: {score_percentage}, макс: {total_possible_points}, набрано: {total_earned_points}, штрафы: {penalty_points_final}")
            else:
                # Если полный расчет не удался, используем расчет только по пунктам с комментариями как запасной вариант
                logger.warning(f"Не удалось получить полные данные о проверке из calculate_check_score: {score_data.get('message', 'Неизвестная ошибка')}. Используем расчет только по детализируемым пунктам.")
                # Расчет на основе items_to_detail (менее точный, но запасной)
                if any(itd.task_vp is not None for itd in items_to_detail):
                    temp_total_possible = sum(itd.task_vp for itd in items_to_detail if itd.task_vp is not None)
                    if temp_total_possible > 0: # Предотвращаем деление на ноль
                         # Используем current_inspection_total_penalty_sum, так как он посчитан по items_to_detail
                         score_percentage = round(((temp_total_possible - current_inspection_total_penalty_sum) / temp_total_possible) * 100)
                         # Обновляем total_possible_points и total_earned_points если они берутся из items_to_detail
                         total_possible_points = temp_total_possible
                         total_earned_points = sum(itd.task_pt for itd in items_to_detail if itd.task_pt is not None)
                penalty_points_final = current_inspection_total_penalty_sum # Штрафы из детализированных
                logger.info(f"Процент выполнения проверки {latest_insp_id} (только по детализируемым пунктам): {score_percentage if score_percentage is not None else 'N/A'}%")
            
            # Создаем словарь с данными события, убедившись что все поля корректно определены
            event_data_dict = {
                "description": f"Аудит RetailiQA: {first_item.insp_type} для {first_item.insp_obj}",
                "date": event_date,
                "event_type": "АТО",
                "retailiqa_insp_id": latest_insp_id, # Используем latest_insp_id
                "retailiqa_insp_obj_id": first_item.insp_obj_id,
                "retailiqa_insp_obj_name": first_item.insp_obj,
                "retailiqa_max_points": total_possible_points,
                "retailiqa_penalty_points": penalty_points_final, # Используем penalty_points_final
                "retailiqa_violation_count": number_of_violations, # Посчитано по items_to_detail
                "retailiqa_comments": comments_for_event, # Сформировано из items_to_detail
                "retailiqa_detailed_violations": [ # Уже готовый список словарей
                    viol for viol in detailed_violations_list
                ],
                "retailiqa_photos": photos, # Сформировано из items_to_detail
                "is_active": True,
                # Новые поля для информации о процентах
                "retailiqa_score_percentage": score_percentage,
                "retailiqa_earned_points": total_earned_points
            }

            existing_event = await crud_event.get_event_by_retailiqa_insp_id(db, retailiqa_insp_id=latest_insp_id) # Используем latest_insp_id

            if existing_event:
                logger.info(f"Событие для RetailiQA ID {latest_insp_id} уже существует (ID: {existing_event.id}). Обновляем...")
                try:
                    # Преобразуем данные в формат, который может быть сериализован в JSON
                    serializable_data = event_data_dict.copy()
                    
                    # Преобразуем структуры с объектами DetailedViolation в чистые словари
                    if "retailiqa_detailed_violations" in serializable_data:
                        serializable_data["retailiqa_detailed_violations"] = [
                            {
                                "title": viol["title"],
                                "text": viol["text"],
                                "penalty": viol["penalty"],
                                "type": viol.get("type", "нарушение" if viol["penalty"] > 0 else "замечание"),
                                "photos": viol.get("photos", [])  # Добавляем поле photos для сохранения ссылок на фотографии
                            } for viol in serializable_data["retailiqa_detailed_violations"]
                        ]
                    
                    # Печатаем ключи, чтобы увидеть доступные поля в объекте EventUpdate
                    logger.debug(f"Доступные ключи в EventUpdate: {list(schemas.EventUpdate.__annotations__.keys())}")
                    
                    # ИЗМЕНЕНИЕ: Обновляем поля Event объекта напрямую, а не через схему Pydantic
                    # Обновляем только если данные есть в serializable_data
                    if "description" in serializable_data:
                        existing_event.description = serializable_data["description"]
                    if "date" in serializable_data:
                        existing_event.date = serializable_data["date"]
                    if "event_type" in serializable_data:
                        existing_event.event_type = serializable_data["event_type"]
                    
                    # Обновляем все retailiqa_ поля
                    existing_event.retailiqa_insp_id = latest_insp_id
                    existing_event.retailiqa_insp_obj_id = first_item.insp_obj_id
                    existing_event.retailiqa_insp_obj_name = first_item.insp_obj
                    existing_event.retailiqa_max_points = total_possible_points
                    existing_event.retailiqa_penalty_points = penalty_points_final
                    existing_event.retailiqa_violation_count = number_of_violations
                    existing_event.retailiqa_comments = serializable_data.get("retailiqa_comments", [])
                    existing_event.retailiqa_detailed_violations = serializable_data.get("retailiqa_detailed_violations", [])
                    existing_event.retailiqa_photos = serializable_data.get("retailiqa_photos", [])
                    existing_event.retailiqa_score_percentage = score_percentage
                    existing_event.retailiqa_earned_points = total_earned_points
                    
                    # Сохраняем изменения
                    await db.commit()
                    await db.refresh(existing_event)
                    
                    processed_events.append(existing_event)
                    logger.info(f"Событие {existing_event.id} обновлено со всеми данными RetailiQA.")
                except Exception as update_error:
                    logger.error(f"Ошибка при обновлении события {existing_event.id} для RetailiQA ID {latest_insp_id}: {update_error}", exc_info=True)
                    # Откатываем транзакцию в случае ошибки
                    await db.rollback()
                    logger.info(f"Транзакция отката выполнена после ошибки обновления события {existing_event.id}")
                    
                    # Попробуем обновить только минимальный набор полей
                    try:
                        logger.info(f"Пробуем обновить событие {existing_event.id} с минимальным набором полей...")
                        # Получаем свежую копию объекта из БД
                        query = select(Event).where(Event.id == existing_event.id)
                        result = await db.execute(query)
                        event_to_update = result.scalar_one_or_none()
                        
                        if event_to_update:
                            # Обновляем только базовые поля
                            event_to_update.description = f"Аудит RetailiQA: {first_item.insp_type} для {first_item.insp_obj}"
                            event_to_update.date = event_date
                            event_to_update.event_type = "АТО"
                            event_to_update.retailiqa_insp_id = latest_insp_id
                            
                            await db.commit()
                            await db.refresh(event_to_update)
                            
                            processed_events.append(event_to_update)
                            logger.info(f"Обновлено упрощенное событие {event_to_update.id} после ошибки.")
                        else:
                            logger.error(f"Не удалось найти событие с ID {existing_event.id} для упрощенного обновления")
                    except Exception as fallback_error:
                        logger.error(f"Ошибка при упрощенном обновлении события {existing_event.id}: {fallback_error}", exc_info=True)
                        await db.rollback()
                        return processed_events
            else:
                logger.info(f"Создание нового события для RetailiQA ID {latest_insp_id}...")
                # Создаем EventCreate объект из словаря данных
                try:
                    # Преобразуем данные в формат, который может быть сериализован в JSON
                    serializable_data = event_data_dict.copy()
                    
                    # Преобразуем структуры с объектами DetailedViolation в чистые словари
                    if "retailiqa_detailed_violations" in serializable_data:
                        serializable_data["retailiqa_detailed_violations"] = [
                            {
                                "title": viol["title"],
                                "text": viol["text"],
                                "penalty": viol["penalty"],
                                "type": viol.get("type", "нарушение" if viol["penalty"] > 0 else "замечание"),
                                "photos": viol.get("photos", [])  # Добавляем поле photos для сохранения ссылок на фотографии
                            } for viol in serializable_data["retailiqa_detailed_violations"]
                        ]
                    
                    # Печатаем ключи, чтобы увидеть доступные поля в объекте EventCreate
                    logger.debug(f"Доступные ключи в EventCreate: {list(schemas.EventCreate.__annotations__.keys())}")
                    
                    # ИЗМЕНЕНИЕ: Не фильтруем поля, а создаем Event объект напрямую
                    # Сначала импортируем необходимый класс, если еще не импортирован
                    from models import Event as EventModel

                    # Создаем Event объект напрямую, минуя схему Pydantic, которая слишком ограничена
                    new_event = EventModel(
                        description=serializable_data.get("description", f"Аудит RetailiQA для {first_item.insp_obj}"),
                        date=serializable_data.get("date"),
                        event_type=serializable_data.get("event_type", "АТО"),
                        retailiqa_insp_id=latest_insp_id,
                        retailiqa_insp_obj_id=first_item.insp_obj_id,
                        retailiqa_insp_obj_name=first_item.insp_obj,
                        retailiqa_max_points=total_possible_points,
                        retailiqa_penalty_points=penalty_points_final,
                        retailiqa_violation_count=number_of_violations,
                        retailiqa_comments=serializable_data.get("retailiqa_comments", []),
                        retailiqa_detailed_violations=serializable_data.get("retailiqa_detailed_violations", []),
                        retailiqa_photos=serializable_data.get("retailiqa_photos", []),
                        retailiqa_score_percentage=score_percentage,
                        retailiqa_earned_points=total_earned_points,
                        is_active=True
                    )
                    
                    # Добавляем объект в сессию и коммитим изменения
                    db.add(new_event)
                    await db.commit()
                    await db.refresh(new_event)
                    
                    processed_events.append(new_event)
                    logger.info(f"Создано новое событие {new_event.id} с полными данными RetailiQA.")
                except Exception as create_error:
                    logger.error(f"Ошибка при создании события для RetailiQA ID {latest_insp_id}: {create_error}", exc_info=True)
                    # Откатываем транзакцию в случае ошибки
                    await db.rollback()
                    logger.info("Транзакция отката выполнена после ошибки создания")
                    
                    # Попробуем создать только с минимальным набором полей как запасной вариант
                    try:
                        logger.info("Пробуем создать событие с минимальным набором полей...")
                        simple_event = Event(
                            description=f"Аудит RetailiQA: {first_item.insp_type} для {first_item.insp_obj}",
                            date=event_date,
                            event_type="АТО",
                            retailiqa_insp_id=latest_insp_id,
                            is_active=True
                        )
                        db.add(simple_event)
                        await db.commit()
                        await db.refresh(simple_event)
                        
                        processed_events.append(simple_event)
                        logger.info(f"Создано упрощенное событие {simple_event.id} после ошибки.")
                    except Exception as fallback_error:
                        logger.error(f"Ошибка при создании упрощенного события: {fallback_error}", exc_info=True)
                        await db.rollback()
                        return processed_events

                # --- Добавляем создание уведомлений для нового события ---
                # Условие для создания уведомления: есть штрафные баллы ИЛИ есть комментарии к нарушениям
                if penalty_points_final > 0 or comments_for_event: # Используем comments_for_event для условия
                    logger.info(f"Создаем уведомления для события {new_event.id} (штрафные баллы: {penalty_points_final}, комментариев к нарушениям: {len(comments_for_event)})")
                    
                    # Находим группу Telegram, связанную с этим объектом RetailiQA
                    target_group_id = None
                    try:
                        from models import Group
                        # Запрос для поиска группы по имени объекта RetailiQA
                        group_query = select(Group).where(Group.retailiqa_object_name == first_item.insp_obj)
                        group_result = await db.execute(group_query)
                        group = group_result.scalars().first()
                        
                        if group:
                            # Получаем Telegram ID группы (group_id в модели Group - это и есть ID чата Telegram)
                            target_group_id = group.group_id
                            logger.info(f"Найдена группа для объекта '{first_item.insp_obj}': ID {target_group_id}")
                        else:
                            logger.warning(f"Не найдена группа для объекта '{first_item.insp_obj}'. Будет использован ID по умолчанию.")
                            # Если группа не найдена, используем группу по умолчанию или пропускаем создание уведомлений
                            target_group_id = -100  # Заглушка, нужно заменить на ID группы по умолчанию
                    except Exception as e:
                        logger.error(f"Ошибка при поиске группы Telegram для объекта '{first_item.insp_obj}': {e}", exc_info=True)
                        target_group_id = -100  # Заглушка в случае ошибки
                    
                    # Используем только валидные ID групп Telegram
                    if not target_group_id:
                        logger.error(f"Не удалось определить ID группы Telegram для объекта '{first_item.insp_obj}'. Уведомления не будут созданы.")
                        return processed_events

                    # Проверяем флаги для уведомлений (по умолчанию создавать не будем)
                    create_result_notification = event_data_dict.get('create_retailiqa_result_notification', False)
                    create_daily_reminder = event_data_dict.get('create_retailiqa_daily_reminder', False)
                    
                    # 1. Создаем одноразовое уведомление с результатами проверки, если указан флаг
                    if create_result_notification:
                        one_time_message = f"<b>🔵 Результаты проверки АТО от {event_date.strftime('%d.%m.%Y')}</b>\n\n"
                        one_time_message += f"<b>Объект:</b> {first_item.insp_obj}\n"
                        
                        # Добавляем информацию о проценте выполнения, если она доступна
                        if score_percentage is not None:
                            emoji = "🔵✓" if score_percentage >= 85 else "⚠️" if score_percentage >= 70 else "❌"
                            one_time_message += f"<b>Результат:</b> {emoji} {score_percentage:.1f}% выполнения\n"
                            one_time_message += f"<b>Баллы:</b> {total_earned_points} из {total_possible_points}\n"
                        
                        one_time_message += f"<b>Штрафные баллы:</b> {penalty_points_final}\n\n"
                        
                        # Используем detailed_violations_list для формирования сообщения
                        if detailed_violations_list:
                            one_time_message += "<b>⚠️ Замечания:</b>\n"
                            # Создаем HTML-таблицу
                            one_time_message += "<pre>┌───────────────────┬─────────────┬──────────┐\n"
                            one_time_message += "│       ПУНКТ       │ КОММЕНТАРИЙ │  ШТРАФ   │\n"
                            one_time_message += "├───────────────────┼─────────────┼──────────┤\n"
                            
                            for viol in detailed_violations_list:
                                point_name = viol['title']
                                point_comment = viol['text'] if viol['text'] else "-"
                                penalty_val = viol['penalty']

                                if len(point_name) > 17: point_name = point_name[:15] + ".."
                                if len(point_comment) > 11: point_comment = point_comment[:9] + ".."
                                
                                one_time_message += f"│ {point_name.ljust(17)} │ {point_comment.ljust(11)} │ {str(penalty_val).rjust(8)} │\n"
                            
                            one_time_message += "└───────────────────┴─────────────┴──────────┘</pre>\n\n"

                            one_time_message += "<b>Детали замечаний:</b>\n"
                            for i, viol in enumerate(detailed_violations_list, 1):
                                one_time_message += f"{i}. {viol['title']}"
                                if viol['text']:
                                    one_time_message += f": {viol['text']}"
                                one_time_message += f" (Штраф: {viol['penalty']})\n\n"
                        else:
                            one_time_message += "<b>✅ Замечаний нет</b>\n"
                        
                        one_time_notification = schemas.NotificationCreate(
                            message=one_time_message,
                            time=0,  # сразу
                            chat_ids=[target_group_id],  # ID группы Telegram
                            requires_confirmation=False,
                        )
                        
                        try:
                            await crud_event.create_event_notification(
                                db, 
                                notification_in=one_time_notification, 
                                event_id=new_event.id
                            )
                            logger.info(f"Создано одноразовое уведомление с результатами проверки для события {new_event.id}")
                        except Exception as e:
                            logger.error(f"Ошибка при создании одноразового уведомления: {e}", exc_info=True)
                    else:
                        logger.info(f"Одноразовое уведомление с результатами не создано (флаг не установлен) для события {new_event.id}")
                    
                    # 2. Создаем ежедневное уведомление-напоминание о проблемных пунктах, если указан флаг
                    if create_daily_reminder:
                        daily_message = f"<b>⚠️ Внимание! Обратите внимание на эти пункты АТО</b>\n\n"
                        daily_message += f"<b>Объект:</b> {first_item.insp_obj}\n\n"
                        daily_message += "<b>По этим пунктам были проблемы на прошлой проверке:</b>\n"
                        
                        for i, viol in enumerate(detailed_violations_list, 1):
                            daily_message += f"{i}. {viol['title']} (Штраф: {viol['penalty']})\n"
                        
                        # Создаем настройки для ежедневного повтора
                        repeat_settings = schemas.RepeatSettingsCreate(
                            type="daily",
                            weekdays=None,
                            month_day=None
                        )
                        
                        daily_notification = schemas.NotificationCreate(
                            message=daily_message,
                            time=480,  # 8 часов (минут)
                            chat_ids=[target_group_id],  # ID группы Telegram
                            requires_confirmation=True,
                            repeat=repeat_settings
                        )
                        
                        try:
                            await crud_event.create_event_notification(
                                db, 
                                notification_in=daily_notification, 
                                event_id=new_event.id
                            )
                            logger.info(f"Создано ежедневное уведомление-напоминание для события {new_event.id}")
                        except Exception as e:
                            logger.error(f"Ошибка при создании ежедневного уведомления: {e}", exc_info=True)
                    else:
                        logger.info(f"Ежедневное уведомление-напоминание не создано (флаг не установлен) для события {new_event.id}")
            
            logger.info(f"Обработка отчетов RetailiQA завершена. Обработано/создано событий: {len(processed_events)}")

            return processed_events
        except HTTPException as e:
            logger.error(f"RetailiQA Service HTTPException: {e.detail}", exc_info=True)
            raise e
        except Exception as e:
            logger.error(f"Непредвиденная ошибка во время обработки отчетов RetailiQA: {type(e).__name__} - {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred in process_new_reports: {type(e).__name__} - {str(e)}"
            )

    async def calculate_check_score(
        self, 
        check_obj_name: str, 
        date_from: str, 
        date_to: Optional[str] = None
    ) -> dict:
        """
        Получает отчеты для указанного объекта за указанный период
        и рассчитывает общий процент выполнения проверки.
        
        Args:
            check_obj_name: Название объекта проверки
            date_from: Дата начала периода в формате YYYY-MM-DD
            date_to: Дата окончания периода в формате YYYY-MM-DD (если не указано, то равно date_from)
            
        Returns:
            Словарь с данными о результатах проверки
        """
        logger.info(f"Расчет процента выполнения проверки для объекта '{check_obj_name}' с {date_from} по {date_to or date_from}")
        
        # Если date_to не указано, используем date_from
        effective_date_to = date_to or date_from
        
        try:
            # Получаем отчеты за указанный период
            report_items = await self.get_reports(
                date_from=date_from,
                date_to=effective_date_to,
                limit=500,  # Увеличиваем лимит, чтобы получить все пункты
                check_obj_name=check_obj_name,
                insp_type_name="АТО_Производство_new"
            )
            
            if not report_items:
                logger.info(f"Отчеты не найдены для объекта '{check_obj_name}' за период с {date_from} по {effective_date_to}")
                return {
                    "status": "error",
                    "message": f"Отчеты не найдены для объекта '{check_obj_name}' за указанный период"
                }
            
            # Группируем пункты по ID проверки
            reports_by_insp_id = {}
            for item in report_items:
                if item.insp_id not in reports_by_insp_id:
                    reports_by_insp_id[item.insp_id] = []
                reports_by_insp_id[item.insp_id].append(item)
            
            logger.info(f"Найдено {len(reports_by_insp_id)} проверок для объекта '{check_obj_name}'")
            
            # Возвращаем данные для последней проверки
            # Сортируем по дате, чтобы получить самую последнюю проверку
            latest_insp_id = None
            latest_insp_date = None
            
            for insp_id, items in reports_by_insp_id.items():
                first_item = items[0]
                try:
                    insp_date = datetime.fromisoformat(first_item.insp_date)
                    if latest_insp_date is None or insp_date > latest_insp_date:
                        latest_insp_id = insp_id
                        latest_insp_date = insp_date
                except (ValueError, TypeError):
                    logger.warning(f"Невозможно преобразовать дату для проверки {insp_id}: {first_item.insp_date}")
            
            if latest_insp_id is None:
                logger.warning(f"Не удалось найти последнюю проверку по датам")
                # Берем первую попавшуюся проверку
                latest_insp_id = next(iter(reports_by_insp_id))
            
            # Обрабатываем проверку
            items = reports_by_insp_id[latest_insp_id]
            first_item = items[0]
            logger.info(f"Анализ проверки {latest_insp_id} для объекта '{first_item.insp_obj}' от {first_item.insp_date}")
            
            # Рассчитываем общие баллы
            total_possible_points = sum(item.task_vp for item in items)
            total_earned_points = sum(item.task_pt for item in items)
            total_penalty_points = sum(item.task_sum for item in items)
            
            # Вычисляем процент выполнения
            score_percentage = None
            if total_possible_points > 0:
                score_percentage = ((total_possible_points - total_penalty_points) / total_possible_points) * 100
                # Округляем процент выполнения до целого числа по математическим правилам
                score_percentage = round(score_percentage)
                
                logger.info(f"РЕЗУЛЬТАТЫ ПРОВЕРКИ {latest_insp_id}:")
                logger.info(f"Объект: {first_item.insp_obj}")
                logger.info(f"Дата проверки: {first_item.insp_date}")
                logger.info(f"Статус: {first_item.state_message}")
                logger.info(f"Максимально возможные баллы: {total_possible_points}")
                logger.info(f"Набранные баллы: {total_earned_points}")
                logger.info(f"Штрафные баллы: {total_penalty_points}")
                logger.info(f"Процент выполнения: {score_percentage:.2f}%")
                
                print(f"\n===== РЕЗУЛЬТАТЫ ПРОВЕРКИ {latest_insp_id} =====")
                print(f"Объект: {first_item.insp_obj}")
                print(f"Дата проверки: {first_item.insp_date}")
                print(f"Статус: {first_item.state_message}")
                print(f"Максимально возможные баллы: {total_possible_points}")
                print(f"Набранные баллы: {total_earned_points}")
                print(f"Штрафные баллы: {total_penalty_points}")
                print(f"Процент выполнения: {score_percentage:.2f}%")
                print("=====================================\n")
                
                # Возвращаем результаты
                return {
                    "status": "success",
                    "object_name": first_item.insp_obj,
                    "insp_id": latest_insp_id,
                    "insp_date": first_item.insp_date,
                    "state_message": first_item.state_message,
                    "max_points": total_possible_points,
                    "earned_points": total_earned_points,
                    "penalty_points": total_penalty_points,
                    "score_percentage": score_percentage
                }
            else:
                logger.warning(f"Невозможно рассчитать процент выполнения: максимально возможные баллы равны 0")
                return {
                    "status": "error",
                    "message": "Невозможно рассчитать процент выполнения: максимально возможные баллы равны 0"
                }
        
        except Exception as e:
            logger.error(f"Ошибка при расчете процента выполнения: {e}", exc_info=True)
            return {
                "status": "error",
                "message": f"Ошибка при расчете процента выполнения: {str(e)}"
            }

# Пример использования (потребует настройки settings и AsyncSessionLocal)
# async def main_test_process_reports():
#     from db.session import AsyncSessionLocal # Убедитесь, что это корректный путь
#     # Убедитесь, что settings.RETAILIQA_API_BASE_URL и др. установлены
#     # например, через .env или напрямую в core/config.py
# 
#     db: AsyncSession = AsyncSessionLocal()
#     service = RetailiQAService()
#     try:
#         # Пример: получить отчеты за последние 7 дней
#         from datetime import timedelta
#         date_start = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
#         logger.info(f"Тестовый запуск process_new_reports с date_from={date_start}")
#         await service.process_new_reports(db=db, date_from=date_start)
#     except Exception as e:
#         logger.error(f"Ошибка в main_test_process_reports: {e}", exc_info=True)
#     finally:
#         await db.close()
# 
# if __name__ == "__main__":
#     import asyncio
#     # asyncio.run(main_test_process_reports()) 

# Тестовая функция для проверки расчета процента выполнения
async def test_calculate_check_score():
    service = RetailiQAService()
    
    # Укажите параметры для вашего объекта и даты проверки
    check_obj_name = "Нинздя пицца 6 Слоцова,4"  # Название объекта проверки
    date_from = "2023-05-05"  # Дата проверки в формате YYYY-MM-DD
    
    await service.calculate_check_score(check_obj_name, date_from)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_calculate_check_score()) 