from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
import logging
import uuid
import os
import httpx
from datetime import datetime, timedelta, date
from services.retailiqa_service import RetailiQAService
from db.session import get_db_session # Используем get_db_session, как определено в session.py

# --- АБСОЛЮТНЫЕ ИМПОРТЫ (Новая попытка) ---
import schemas          # Из /app/schemas/event.py
import crud # <<< ДОБАВЛЕНО: Импорт CRUD операций
# --- Импортируем нашу утилиту --- 
from utils.scheduler_client import notify_scheduler

# --- Импорт для получения группы ---
from api.v1.endpoints.groups import get_group_by_telegram_id # <--- ДОБАВЛЕНО
from models.group import Group # <--- УБЕДИМСЯ, ЧТО ЭТОТ ИМПОРТ ЕСТЬ ИЛИ ДОБАВИМ

# Функция для безопасного преобразования SQLAlchemy объектов в словари
def sqlalchemy_obj_to_dict(obj, exclude_attrs=None) -> Dict[str, Any]:
    """
    Преобразует объект SQLAlchemy в словарь, безопасный для сериализации.
    
    Args:
        obj: Объект SQLAlchemy для преобразования
        exclude_attrs: Список атрибутов, которые следует исключить из результата
    
    Returns:
        Dict[str, Any]: Словарь с атрибутами объекта
    """
    if exclude_attrs is None:
        exclude_attrs = ['_sa_instance_state']
    
    result = {}
    for key, value in obj.__dict__.items():
        if key not in exclude_attrs:
            # Преобразуем datetime в строку ISO
            if isinstance(value, (datetime, date)):
                result[key] = value.isoformat()
            else:
                result[key] = value
    return result

# Удаляем заглушки
# class EventRead: ...
# class Event: ...
# def get_db(): ...

logger = logging.getLogger(__name__)

router = APIRouter()

# Используем EventRead напрямую
@router.get("/", response_model=List[schemas.EventRead], summary="Получить список всех событий") 
async def read_events(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список событий с пагинацией.
    Уведомления для каждого события также подгружаются.
    """
    logger.info(f"Запрос на получение списка событий (skip={skip}, limit={limit})")
    try:
        db_events = await crud.event.get_events(db=db, skip=skip, limit=limit)
        logger.info(f"Найдено {len(db_events)} событий")
        
        # Добавляем подробное логирование для проверки наличия фотографий в АТО событиях
        for event in db_events:
            if hasattr(event, 'event_type') and event.event_type == 'АТО' and hasattr(event, 'retailiqa_detailed_violations'):
                event_info = f"[ОТЛАДКА АТО] Событие ID {event.id}: "
                
                # Проверяем, есть ли retailiqa_detailed_violations и это список
                if not event.retailiqa_detailed_violations:
                    logger.warning(f"{event_info} retailiqa_detailed_violations отсутствует или пустой")
                    continue
                    
                if not isinstance(event.retailiqa_detailed_violations, list):
                    logger.warning(f"{event_info} retailiqa_detailed_violations не является списком: {type(event.retailiqa_detailed_violations)}")
                    continue
                
                logger.info(f"{event_info} имеет {len(event.retailiqa_detailed_violations)} детализированных нарушений")
                
                # Подсчет количества фотографий и логирование для каждого нарушения
                violations_with_photos = 0
                total_photos = 0
                
                for i, violation in enumerate(event.retailiqa_detailed_violations):
                    violation_info = f"{event_info} Нарушение #{i+1}"
                    
                    # Проверяем наличие поля photos
                    if 'photos' not in violation:
                        logger.warning(f"{violation_info} не имеет поля photos")
                        violation['photos'] = []
                    elif not isinstance(violation['photos'], list):
                        logger.warning(f"{violation_info} поле photos не является списком: {type(violation['photos'])}")
                        violation['photos'] = []
                    else:
                        photos_count = len(violation['photos'])
                        if photos_count > 0:
                            violations_with_photos += 1
                            total_photos += photos_count
                            logger.info(f"{violation_info} имеет {photos_count} фото: {violation['photos']}")
                    
                    # Проверка наличия поля type и его установка
                    if 'type' not in violation:
                        logger.warning(f"{violation_info} не имеет поля type")
                        violation['type'] = 'нарушение' if violation.get('penalty', 0) > 0 else 'замечание'
                
                logger.info(f"{event_info} ИТОГО: {violations_with_photos} нарушений с фотографиями, всего {total_photos} фотографий")
        
        # Проверка наличия поля photos в detailed_violations
        for event in db_events:
            if hasattr(event, 'retailiqa_detailed_violations') and event.retailiqa_detailed_violations:
                # Проверяем, что это список
                if isinstance(event.retailiqa_detailed_violations, list):
                    # Проверяем каждое нарушение
                    for violation in event.retailiqa_detailed_violations:
                        # Добавляем поле photos, если его нет
                        if 'photos' not in violation:
                            violation['photos'] = []
                        # Проверяем, что поле type установлено
                        if 'type' not in violation:
                            # Устанавливаем тип на основе penalty
                            violation['type'] = 'нарушение' if violation.get('penalty', 0) > 0 else 'замечание'
                            
        return db_events
    except Exception as e:
        logger.exception("Ошибка при получении списка событий:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при получении событий"
        )

# --- Эндпоинт для создания события --- 
@router.post(
    "/", 
    response_model=schemas.EventRead, 
    status_code=status.HTTP_201_CREATED, # Возвращаем 201 при успешном создании
    summary="Создать новое событие"
)
async def create_event(
    event_in: schemas.EventCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое событие.
    Принимает `description` и `date`.
    """
    logger.info(f"Запрос на создание нового события: {event_in.description}")
    try:
        db_event = await crud.event.create_event(db=db, event_in=event_in)
        logger.info(f"Событие создано с ID: {db_event.id}")
        # Важно: чтобы в ответе были уведомления (пустой список), 
        # нужно снова запросить событие или использовать refresh с options,
        # но для POST проще вернуть созданный объект как есть.
        # Pydantic сам создаст пустой список notifications.
        return db_event 
    except Exception as e:
        logger.exception("Ошибка при создании события:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при создании события"
        )

# --- Эндпоинт для удаления события --- 
@router.delete(
    "/{event_id}", 
    response_model=schemas.EventRead, # Возвращаем удаленный объект
    summary="Удалить событие по ID"
)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Удаляет событие и все связанные с ним уведомления.
    Возвращает удаленное событие или 404, если не найдено.
    """
    logger.info(f"Запрос на удаление события с ID: {event_id}")
    try:
        deleted_event = await crud.event.delete_event(db=db, event_id=event_id)
        if not deleted_event:
            logger.warning(f"Событие с ID {event_id} не найдено для удаления")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие не найдено")
        logger.info(f"Событие с ID {event_id} успешно удалено")
        return deleted_event
    except HTTPException: # Пробрасываем HTTP исключения (например, 404)
        raise
    except Exception as e:
        logger.exception(f"Ошибка при удалении события {event_id}:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при удалении события"
        )

# --- Эндпоинт для создания уведомления для события --- 
@router.post(
    "/{event_id}/notifications", 
    response_model=schemas.NotificationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить уведомление к событию"
)
async def create_notification_for_event(
    event_id: int,
    notification_in: schemas.NotificationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создает новое уведомление для события с указанным `event_id`.
    После успешного создания отправляет задачу в Шедулер.
    """
    logger.info(f"Запрос на добавление уведомления к событию {event_id}")
    
    # Отладочное логирование входящих параметров
    logger.info(f"Входящие параметры уведомления: send_now={notification_in.send_now}, use_absolute_time={notification_in.use_absolute_time}, time={notification_in.time}")
    
    event = await crud.event.get_event(db=db, event_id=event_id)
    if not event:
        logger.warning(f"Событие с ID {event_id} не найдено для добавления уведомления")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие не найдено")
        
    try:
        # --- Создаем уведомление в БД --- 
        db_notification = await crud.event.create_event_notification(
            db=db, notification_in=notification_in, event_id=event_id
        )
        await db.commit()
        await db.refresh(db_notification)
        logger.info(f"Уведомление создано с ID: {db_notification.id} для события {event_id}")
        
        # --- Преобразуем SQLAlchemy в Pydantic и добавляем event_time --- 
        try:
            notification_pydantic = schemas.NotificationRead.from_orm(db_notification)
            # Отладочное логирование преобразованных параметров
            logger.info(f"Параметры после преобразования: send_now={notification_pydantic.send_now}, use_absolute_time={notification_pydantic.use_absolute_time}, time={notification_pydantic.time}")
            
            logger.info(f"Добавление фоновой задачи для отправки уведомления {db_notification.id} в Шедулер")
            # --- ИЗМЕНЕНИЕ: Передаем Pydantic объект и дату события --- 
            background_tasks.add_task(notify_scheduler, notification_pydantic, event.date)
        except Exception as pydantic_error:
            logger.error(f"Ошибка подготовки данных для Шедулера (уведомление {db_notification.id}): {pydantic_error}", exc_info=True)

        return db_notification
    except Exception as e:
        await db.rollback()
        logger.exception(f"Ошибка при создании уведомления {notification_id} или отправке в Шедулер для события {event_id}:", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при создании уведомления"
        )

# --- Эндпоинт для обновления уведомления события --- 
@router.put(
    "/{event_id}/notifications/{notification_id}", 
    response_model=schemas.NotificationRead,
    summary="Обновить существующее уведомление события"
)
async def update_notification_for_event(
    event_id: int,
    notification_id: uuid.UUID,
    notification_in: schemas.NotificationUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет существующее уведомление по его ID и ID события.
    После успешного обновления отправляет задачу в Шедулер.
    """
    logger.info(f"Запрос на обновление уведомления {notification_id} для события {event_id}")
    try:
        # --- Обновляем уведомление в БД --- 
        updated_notification = await crud.event.update_event_notification(
            db=db, 
            event_id=event_id, 
            notification_id=notification_id, 
            notification_in=notification_in
        )
        if not updated_notification:
            logger.warning(f"Уведомление {notification_id} не найдено или не принадлежит событию {event_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Уведомление не найдено или не принадлежит этому событию"
            )
        await db.commit()
        await db.refresh(updated_notification)
        logger.info(f"Уведомление {notification_id} успешно обновлено")

        # --- ВАЖНО: Загружаем событие, чтобы получить его время --- 
        # Мы можем либо модифицировать crud.update_event_notification, чтобы он возвращал 
        # обновленное уведомление С предзагруженным событием (через joinedload), 
        # либо запросить событие здесь отдельно. Запросим отдельно для простоты.
        event = await crud.event.get_event(db=db, event_id=event_id)
        if not event:
             # Если событие вдруг удалили между проверкой и этим моментом
             logger.error(f"Событие {event_id} не найдено после обновления уведомления {notification_id}. Невозможно отправить event_time.")
             # Можно либо падать, либо отправлять без event_time, либо не отправлять вообще
             # Пока что просто залогируем и продолжим
             pass
             
        await db.commit()
        await db.refresh(updated_notification)
        logger.info(f"Уведомление {notification_id} успешно обновлено")

        # --- Преобразуем SQLAlchemy в Pydantic и добавляем event_time --- 
        try:
            notification_pydantic = schemas.NotificationRead.from_orm(updated_notification)
            logger.info(f"Добавление фоновой задачи для отправки обновления уведомления {updated_notification.id} в Шедулер")
            # --- ИЗМЕНЕНИЕ: Передаем Pydantic объект и дату события --- 
            background_tasks.add_task(notify_scheduler, notification_pydantic, event.date)
        except Exception as pydantic_error:
            logger.error(f"Ошибка подготовки данных для Шедулера (уведомление {updated_notification.id}): {pydantic_error}", exc_info=True)

        return updated_notification
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.exception(f"Ошибка при обновлении уведомления {notification_id} или отправке в Шедулер для события {event_id}:", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при обновлении уведомления"
        )

# --- Эндпоинт для запуска обработки отчетов RetailiQA ---
@router.post(
    "/groups/{group_telegram_id}/process-retailiqa-reports", # <--- ИЗМЕНЕН URL
    response_model=List[dict], # Изменяем тип ответа на List[dict], так как мы добавляем score_info
    summary="Запустить обработку отчетов из RetailiQA для конкретной группы и создать события",
    description="Запускает процесс получения отчетов из RetailiQA для указанной группы (по ее Telegram ID), их обработки и создания/обновления событий типа 'АТО' в системе.",
    tags=["Events", "RetailiQA", "Groups"] # Добавляем тег RetailiQA для группировки в документации
)
async def trigger_process_retailiqa_reports_in_events(
    group_telegram_id: int, # <--- ДОБАВЛЕН параметр пути
    date_from: Optional[str] = Query(None, description="Начальная дата для фильтрации отчетов в формате YYYY-MM-DD. Если не указана, используется начало текущего месяца."), # Формат YYYY-MM-DD
    date_to: Optional[str] = Query(None, description="Конечная дата для фильтрации отчетов в формате YYYY-MM-DD. Если не указана, используется текущий день."), # Формат YYYY-MM-DD
    max_pages: Optional[int] = Query(1, description="Максимальное количество страниц для запроса к API RetailiQA.", ge=1, le=100),
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"Запрос на запуск обработки отчетов RetailiQA для группы {group_telegram_id} с {date_from=}, {date_to=}, {max_pages=}")

    group = await get_group_by_telegram_id(db=db, group_telegram_id=group_telegram_id)
    if not group:
        logger.warning(f"Группа с Telegram ID {group_telegram_id} не найдена.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Группа с Telegram ID {group_telegram_id} не найдена."
        )

    check_obj_name: Optional[str] = group.retailiqa_object_name

    if check_obj_name:
        logger.info(f"Название объекта RetailiQA '{check_obj_name}' найдено в поле retailiqa_object_name группы {group_telegram_id}.")
    else:
        logger.info(f"Поле retailiqa_object_name для группы {group_telegram_id} не заполнено. Попытка авто-определения...")
        
        keyword_to_search = None
        title_lower = group.title.lower()
        if title_lower.startswith("повара ") and len(group.title.split(" ")) > 1:
            keyword_to_search = group.title.split(" ", 1)[1].replace(',', '').strip()
        elif title_lower.startswith("курьеры ") and len(group.title.split(" ")) > 1:
            keyword_to_search = group.title.split(" ", 1)[1].replace(',', '').strip()
        

        if not keyword_to_search:
            name_parts = group.title.replace(',', '').split(" ")
            if len(name_parts) > 1: # Берем последнее слово или несколько, если они могут быть частью адреса
                 # Эвристика: если есть "Ниндзя пицца", то берем то, что после номера
                if "пицца" in title_lower and name_parts.index("пицца") + 2 < len(name_parts):
                     keyword_to_search = " ".join(name_parts[name_parts.index("пицца") + 2:])
                else: # Иначе просто последние слова
                    keyword_to_search = name_parts[-1] # Можно взять name_parts[-2:] и соединить, если адрес из двух слов
                    if len(name_parts) > 2 and name_parts[-2].lower() not in ["повара", "курьеры"]: # Простой фильтр
                         keyword_to_search = f"{name_parts[-2]} {name_parts[-1]}"


        if keyword_to_search:
            logger.info(f"Извлечено ключевое слово '{keyword_to_search}' из названия группы '{group.title}'.")
            
            retailiqa_token = os.getenv("RETAILIQA_TOKEN")
            if not retailiqa_token:
                logger.error("Токен RETAILIQA_TOKEN не найден в переменных окружения. Авто-определение объекта RetailiQA невозможно.")
                # Не прерываем выполнение, но check_obj_name останется None
            else:
                retailiqa_service_instance = RetailiQAService(token=retailiqa_token) # Создаем экземпляр
                try:
                    found_objects = await retailiqa_service_instance.get_check_objects(name_filter=keyword_to_search)

                    if len(found_objects) == 1:
                        selected_object = found_objects[0]
                        check_obj_name_candidate = selected_object.name
                        if check_obj_name_candidate:
                            check_obj_name = check_obj_name_candidate # Присваиваем найденное имя
                            logger.info(f"Автоматически определен объект RetailiQA: '{check_obj_name}' для группы '{group.title}'.")
                            
                            # Сохраняем найденное имя в поле group.retailiqa_object_name
                            group.retailiqa_object_name = check_obj_name
                            try:
                                db.add(group)
                                await db.commit()
                                await db.refresh(group)
                                logger.info(f"Поле retailiqa_object_name для группы {group_telegram_id} обновлено: {check_obj_name}")
                            except Exception as e_save:
                                await db.rollback()
                                logger.error(f"Ошибка при сохранении retailiqa_object_name для группы {group_telegram_id}: {e_save}", exc_info=True)
                                # check_obj_name все еще установлен для текущего вызова, но не сохранен
                        else:
                            logger.warning(f"Найденный объект RetailiQA для '{keyword_to_search}' не имеет поля 'name'.")
                    elif len(found_objects) > 1:
                        object_names = [obj.name if obj.name is not None else "N/A" for obj in found_objects]
                        logger.warning(f"Найдено несколько объектов RetailiQA ({len(found_objects)}) для ключевого слова '{keyword_to_search}' (группа '{group.title}'): {object_names}. Требуется ручная установка retailiqa_object_name.")
                    else: # 0 объектов найдено
                        logger.warning(f"Не удалось автоматически определить объект RetailiQA по ключевому слову '{keyword_to_search}' (группа '{group.title}'). Объекты не найдены.")
                except Exception as e_rq_get:
                    logger.error(f"Ошибка при запросе объектов из RetailiQA для авто-определения (группа '{group.title}', ключ '{keyword_to_search}'): {e_rq_get}", exc_info=True)
        else:
            logger.info(f"Не удалось извлечь ключевое слово из названия группы '{group.title}' для авто-определения объекта RetailiQA.")

    if not check_obj_name:
        logger.error(f"Не удалось определить retailiqa_object_name для группы {group_telegram_id} (ни из БД, ни автоматически).")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, # Можно использовать 422 Unprocessable Entity если это ошибка валидации входных данных/состояния
            detail=f"Имя объекта RetailiQA для группы {group_telegram_id} не настроено и не может быть определено автоматически. Пожалуйста, проверьте название группы или установите 'retailiqa_object_name' для группы вручную."
        )

    # Инициализация сервиса RetailiQA (если не был инициализирован ранее для авто-определения)
    # Убедимся, что токен есть, иначе дальнейшая работа невозможна
    final_retailiqa_token = os.getenv("RETAILIQA_TOKEN")
    if not final_retailiqa_token:
        logger.critical("Токен RETAILIQA_TOKEN не найден. Обработка отчетов RetailiQA невозможна.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка конфигурации сервера: отсутствует токен для RetailiQA."
        )
    
    # Используем существующий экземпляр если он был создан, или создаем новый
    # (На самом деле, retailiqa_service_instance создавался бы выше, если токен есть. Этот блок можно упростить)
    # Для простоты, всегда создаем новый экземпляр сервиса здесь для основной логики
    retailiqa_service = RetailiQAService(token=final_retailiqa_token)

    # ВРЕМЕННО: Логирование для категорий (можно будет убрать или сделать DEBUG)
    # ... (код получения категорий, если он нужен здесь, или он внутри process_new_reports)
    try:
        # --- Определение дат для фильтрации ---
        effective_date_from_iso: Optional[str] = None
        effective_date_to_iso: Optional[str] = None
        today = datetime.now().date()

        if date_from:
            try:
                parsed_date_from = datetime.strptime(date_from, "%Y-%m-%d").date()
                effective_date_from_iso = parsed_date_from.isoformat()
            except ValueError:
                logger.error(f"Некорректный формат date_from: '{date_from}'. Ожидается YYYY-MM-DD.")
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный формат date_from. Ожидается YYYY-MM-DD.")
        else:
            # Если date_from не указан, берем начало текущего месяца
            first_day_of_month = today.replace(day=1)
            effective_date_from_iso = first_day_of_month.isoformat()
            logger.info(f"Параметр 'date_from' не указан, используется начало текущего месяца: {effective_date_from_iso}")

        if date_to:
            try:
                parsed_date_to = datetime.strptime(date_to, "%Y-%m-%d").date()
                effective_date_to_iso = parsed_date_to.isoformat()
                if parsed_date_from and parsed_date_to < parsed_date_from: # Проверка если date_from тоже был указан
                     logger.error(f"Ошибка в датах: date_to ({effective_date_to_iso}) не может быть раньше date_from ({effective_date_from_iso}).")
                     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_to не может быть раньше date_from.")
            except ValueError:
                logger.error(f"Некорректный формат date_to: '{date_to}'. Ожидается YYYY-MM-DD.")
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный формат date_to. Ожидается YYYY-MM-DD.")
        else:
            # Если date_to не указан
            if date_from: # date_from указан, а date_to нет -> ищем за один день date_from
                effective_date_to_iso = effective_date_from_iso 
                logger.info(f"Параметр 'date_to' не указан, но 'date_from' ({effective_date_from_iso}) указан. Поиск будет за один день.")
            else: # Ни date_from, ни date_to не указаны -> date_from уже установлен на начало месяца, date_to ставим на сегодня
                effective_date_to_iso = today.isoformat()
                logger.info(f"Параметр 'date_to' не указан (и date_from не был указан), используется текущий день: {effective_date_to_iso}")
        
        logger.info(f"Вызов process_new_reports с check_obj_name_param='{check_obj_name}', date_from_param='{effective_date_from_iso}', date_to_param='{effective_date_to_iso}', max_pages={max_pages}")
        
        processed_events = await retailiqa_service.process_new_reports(
            db=db, 
            check_obj_name_param=check_obj_name,
            date_from_param=effective_date_from_iso,
            date_to_param=effective_date_to_iso,
            max_pages=max_pages
        )
        
        # Дополнительно вызываем calculate_check_score для получения процента выполнения
        score_data = {}
        try:
            # Получаем данные о результатах проверки
            score_data = await retailiqa_service.calculate_check_score(
                check_obj_name=check_obj_name,
                date_from=effective_date_from_iso,
                date_to=effective_date_to_iso
            )
            
            if score_data.get("status") == "success":
                logger.info(f"Результаты проверки АТО для объекта '{check_obj_name}': "
                           f"Процент выполнения: {score_data.get('score_percentage', 0):.2f}%, "
                           f"Макс. баллы: {score_data.get('max_points', 0)}, "
                           f"Набрано: {score_data.get('earned_points', 0)}, "
                           f"Штрафы: {score_data.get('penalty_points', 0)}")
            else:
                logger.warning(f"Не удалось получить результаты проверки: {score_data.get('message', 'Неизвестная ошибка')}")
        except Exception as e:
            logger.error(f"Ошибка при вызове calculate_check_score: {e}", exc_info=True)
        
        if not processed_events:
            logger.info(f"Не найдено новых отчетов для обработки для объекта '{check_obj_name}' (группа {group_telegram_id}).")
            # Если есть данные о процентах выполнения, возвращаем их даже при отсутствии событий
            if score_data:
                logger.info(f"Возвращаем только информацию о проценте выполнения без событий.")
                return [{"score_info": score_data, "object_name": check_obj_name}]
            # Возвращаем пустой список, если нет событий и данных о процентах
            return []

        # Добавляем информацию о проценте выполнения к первому событию в списке, если она доступна
        if processed_events and score_data:
            # Преобразуем первое событие в словарь для добавления score_info
            response_events = []
            for i, event in enumerate(processed_events):
                # Используем безопасное преобразование в словарь
                event_dict = sqlalchemy_obj_to_dict(event)
                
                # Добавляем score_info только к первому событию
                if i == 0:
                    event_dict["score_info"] = score_data
                
                response_events.append(event_dict)
                
            logger.info(f"Успешно обработано и создано/обновлено {len(processed_events)} событий для объекта '{check_obj_name}' (группа {group_telegram_id}). Добавлена информация о проценте выполнения.")
            return response_events

        logger.info(f"Успешно обработано и создано/обновлено {len(processed_events)} событий для объекта '{check_obj_name}' (группа {group_telegram_id}).")
        return processed_events

    except HTTPException as http_exc: # Пробрасываем HTTPException дальше
        raise http_exc
    except Exception as e:
        logger.exception(f"Критическая ошибка при обработке отчетов RetailiQA для группы {group_telegram_id} (объект '{check_obj_name}'): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при обработке отчетов RetailiQA: {str(e)}"
        )

# --- Новый эндпоинт для расчета процента выполнения проверки RetailiQA ---
@router.get(
    "/groups/{group_telegram_id}/retailiqa-score", 
    response_model=dict,
    summary="Рассчитать процент выполнения проверки RetailiQA для указанной группы",
    description="Получает данные о проверке RetailiQA для объекта, связанного с указанной группой, и рассчитывает процент выполнения."
)
async def calculate_retailiqa_score(
    group_telegram_id: int,
    date: str = Query(..., description="Дата проверки в формате YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"Запрос на расчет процента выполнения проверки RetailiQA для группы {group_telegram_id} на дату {date}")
    
    # Получаем группу по Telegram ID
    group = await get_group_by_telegram_id(db=db, group_telegram_id=group_telegram_id)
    if not group:
        logger.warning(f"Группа с Telegram ID {group_telegram_id} не найдена.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Группа с Telegram ID {group_telegram_id} не найдена."
        )

    # Получаем имя объекта RetailiQA
    check_obj_name: Optional[str] = group.retailiqa_object_name
    if not check_obj_name:
        logger.error(f"Не удалось определить retailiqa_object_name для группы {group_telegram_id}.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Имя объекта RetailiQA для группы {group_telegram_id} не настроено. Пожалуйста, установите 'retailiqa_object_name' для группы."
        )
    
    # Проверяем формат даты
    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        logger.error(f"Некорректный формат date: '{date}'. Ожидается YYYY-MM-DD.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный формат date. Ожидается YYYY-MM-DD."
        )
    
    # Инициализируем сервис RetailiQA
    retailiqa_token = os.getenv("RETAILIQA_TOKEN")
    if not retailiqa_token:
        logger.critical("Токен RETAILIQA_TOKEN не найден. Расчет процента выполнения проверки RetailiQA невозможен.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка конфигурации сервера: отсутствует токен для RetailiQA."
        )
    
    retailiqa_service = RetailiQAService(token=retailiqa_token)
    
    # Создаем StringIO объект для перехвата вывода print
    import io
    import sys
    from contextlib import redirect_stdout
    
    output = io.StringIO()
    report_data = {}
    
    try:
        # Перехватываем вывод функции calculate_check_score
        with redirect_stdout(output):
            await retailiqa_service.calculate_check_score(
                check_obj_name=check_obj_name,
                date_from=date
            )
        
        # Получаем вывод и обрабатываем его
        output_str = output.getvalue()
        logger.info(f"Результат расчета процента выполнения проверки RetailiQA: {output_str}")
        
        # Ищем в выводе информацию о результатах проверки
        import re
        
        # Ищем ID проверки
        insp_id_match = re.search(r"РЕЗУЛЬТАТЫ ПРОВЕРКИ (\S+)", output_str)
        if insp_id_match:
            report_data["insp_id"] = insp_id_match.group(1)
        
        # Ищем объект
        object_match = re.search(r"Объект: (.+)$", output_str, re.MULTILINE)
        if object_match:
            report_data["object_name"] = object_match.group(1).strip()
        
        # Ищем дату проверки
        date_match = re.search(r"Дата проверки: (.+)$", output_str, re.MULTILINE)
        if date_match:
            report_data["check_date"] = date_match.group(1).strip()
        
        # Ищем статус
        status_match = re.search(r"Статус: (.+)$", output_str, re.MULTILINE)
        if status_match:
            report_data["status"] = status_match.group(1).strip()
        
        # Ищем максимально возможные баллы
        total_points_match = re.search(r"Максимально возможные баллы: (\d+\.?\d*)", output_str)
        if total_points_match:
            report_data["total_points"] = float(total_points_match.group(1))
        
        # Ищем набранные баллы
        earned_points_match = re.search(r"Набранные баллы: (\d+\.?\d*)", output_str)
        if earned_points_match:
            report_data["earned_points"] = float(earned_points_match.group(1))
        
        # Ищем штрафные баллы
        penalty_points_match = re.search(r"Штрафные баллы: (\d+\.?\d*)", output_str)
        if penalty_points_match:
            report_data["penalty_points"] = float(penalty_points_match.group(1))
        
        # Ищем проценты выполнения
        method1_match = re.search(r"Процент выполнения \(метод 1\): (\d+\.\d+)%", output_str)
        if method1_match:
            report_data["score_method1"] = float(method1_match.group(1))
        
        method2_match = re.search(r"Процент выполнения \(метод 2\): (\d+\.\d+)%", output_str)
        if method2_match:
            report_data["score_method2"] = float(method2_match.group(1))
        
        # Если не удалось найти основные данные, возвращаем ошибку
        if not report_data.get("score_method1") and not report_data.get("score_method2"):
            logger.warning(f"Не удалось получить данные о проценте выполнения проверки.")
            if "Отчеты не найдены" in output_str:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Отчеты для объекта '{check_obj_name}' на дату {date} не найдены."
                )
            else:
                return {"message": "Не удалось рассчитать процент выполнения проверки.", "raw_output": output_str}
        
        return report_data
    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.exception(f"Ошибка при расчете процента выполнения проверки RetailiQA: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при расчете процента выполнения проверки RetailiQA: {str(e)}"
        )

# --- Эндпоинт для получения событий по дате и типу АТО ---
@router.get("/ato-by-date", response_model=List[schemas.EventRead], summary="Получить события АТО по дате")
async def get_ato_events_by_date(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получает список событий типа АТО в указанном диапазоне дат.
    """
    logger.info(f"Запрос на получение событий типа АТО в диапазоне дат с date_from={date_from}, date_to={date_to}")
    try:
        events = await crud.event.get_ato_events_by_date(db=db, date_from=date_from, date_to=date_to)
        logger.info(f"Найдено {len(events)} событий типа АТО")
        return events
    except Exception as e:
        logger.exception("Ошибка при получении событий типа АТО:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Внутренняя ошибка сервера при получении событий типа АТО"
        )

@router.put(
    "/{event_id}", 
    response_model=schemas.EventRead,
    summary="Обновить существующее событие"
)
async def update_event(
    event_id: int,
    event_in: schemas.EventUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет существующее событие по его ID.
    Можно обновить параметры события, включая настройки уведомлений RetailiQA.
    """
    logger.info(f"Запрос на обновление события {event_id}")
    
    # Проверяем существование события
    event = await crud.event.get_event(db=db, event_id=event_id)
    if not event:
        logger.warning(f"Событие с ID {event_id} не найдено для обновления")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Событие не найдено")
    
    try:
        # Обновляем событие
        updated_event = await crud.event.update_event(db=db, db_event=event, event_in=event_in)
        await db.commit()
        
        # Проверяем настройки уведомлений RetailiQA
        if (event.event_type == "АТО" and 
            (event_in.create_retailiqa_result_notification or event_in.create_retailiqa_daily_reminder) and
            event.retailiqa_comments):
            
            logger.info(f"Обрабатываем настройки уведомлений RetailiQA для события {event_id}")
            
            # Находим группу Telegram, связанную с этим объектом RetailiQA
            target_group_id = None
            try:
                group_query = select(Group).where(Group.retailiqa_object_name == event.retailiqa_insp_obj_name)
                group_result = await db.execute(group_query)
                group = group_result.scalars().first()
                
                if group:
                    target_group_id = group.group_id
                    logger.info(f"Найдена группа для объекта '{event.retailiqa_insp_obj_name}': ID {target_group_id}")
                else:
                    logger.warning(f"Не найдена группа для объекта '{event.retailiqa_insp_obj_name}'. Уведомления не будут созданы.")
                    return updated_event
            except Exception as e:
                logger.error(f"Ошибка при поиске группы Telegram: {e}", exc_info=True)
                return updated_event
            
            # Создаем уведомления согласно настройкам
            if event_in.create_retailiqa_result_notification:
                # Создаем одноразовое уведомление с результатами проверки
                one_time_message = f"<b>🔵 Результаты проверки АТО</b>\n\n"
                one_time_message += f"<b>Объект:</b> {event.retailiqa_insp_obj_name}\n"
                
                # Добавляем информацию о проценте выполнения, если она доступна
                if event.retailiqa_score_percentage is not None:
                    score_percentage = event.retailiqa_score_percentage
                    emoji = "🔵✓" if score_percentage >= 85 else "⚠️" if score_percentage >= 70 else "❌"
                    one_time_message += f"<b>Результат:</b> {emoji} {score_percentage:.1f}% выполнения\n"
                    one_time_message += f"<b>Баллы:</b> {event.retailiqa_earned_points} из {event.retailiqa_max_points}\n"
                
                one_time_message += f"<b>Штрафные баллы:</b> {event.retailiqa_penalty_points}\n\n"
                
                if event.retailiqa_comments and len(event.retailiqa_comments) > 0:
                    one_time_message += "<b>⚠️ Замечания:</b>\n"
                    
                    # Создаем HTML-таблицу вместо простого списка
                    one_time_message += "<pre>┌─────────────────────────────────┐\n"
                    one_time_message += "│           ЗАМЕЧАНИЯ АТО           │\n"
                    one_time_message += "├─────────────────┬─────────────────┤\n"
                    one_time_message += "│     ПУНКТ       │   КОММЕНТАРИЙ   │\n"
                    one_time_message += "├─────────────────┼─────────────────┤\n"
                    
                    for comment in event.retailiqa_comments:
                        # Разделяем комментарий на пункт и содержание
                        parts = comment.split(':', 1)
                        if len(parts) == 2:
                            point_name = parts[0].strip()
                            point_comment = parts[1].strip()
                            
                            # Ограничиваем длину для лучшего вида в таблице
                            if len(point_name) > 15:
                                point_name = point_name[:13] + "..."
                            if len(point_comment) > 15:
                                point_comment = point_comment[:13] + "..."
                            
                            one_time_message += f"│ {point_name.ljust(15)} │ {point_comment.ljust(15)} │\n"
                        else:
                            # Если нет разделения на пункт и комментарий
                            comment_short = comment
                            if len(comment_short) > 31:
                                comment_short = comment_short[:29] + "..."
                            one_time_message += f"│ {comment_short.ljust(31)} │\n"
                    
                    one_time_message += "└─────────────────┴─────────────────┘</pre>\n\n"
                    
                    # Добавляем полный текст замечаний для удобства
                    one_time_message += "<b>Детали замечаний:</b>\n"
                    for i, comment in enumerate(event.retailiqa_comments, 1):
                        one_time_message += f"{i}. {comment}\n\n"
                else:
                    one_time_message += "<b>✅ Замечаний нет</b>\n"
                
                one_time_notification = schemas.NotificationCreate(
                    message=one_time_message,
                    time=0,  # сразу
                    chat_ids=[target_group_id],
                    requires_confirmation=False,
                )
                
                try:
                    await crud.event.create_event_notification(
                        db, 
                        notification_in=one_time_notification, 
                        event_id=event_id
                    )
                    logger.info(f"Создано одноразовое уведомление с результатами проверки для события {event_id}")
                except Exception as e:
                    logger.error(f"Ошибка при создании одноразового уведомления: {e}", exc_info=True)
            
            if event_in.create_retailiqa_daily_reminder:
                # Создаем ежедневное уведомление-напоминание о проблемных пунктах
                daily_message = f"<b>⚠️ Внимание! Обратите внимание на эти пункты АТО</b>\n\n"
                daily_message += f"<b>Объект:</b> {event.retailiqa_insp_obj_name}\n\n"
                daily_message += "<b>По этим пунктам были проблемы на прошлой проверке:</b>\n"
                
                for i, comment in enumerate(event.retailiqa_comments, 1):
                    # Извлекаем только название пункта перед двоеточием
                    parts = comment.split(':', 1)
                    point_name = parts[0].strip()
                    daily_message += f"{i}. {point_name}\n"
                
                # Создаем настройки для ежедневного повтора
                repeat_settings = schemas.RepeatSettingsCreate(
                    type="daily",
                    weekdays=None,
                    month_day=None
                )
                
                daily_notification = schemas.NotificationCreate(
                    message=daily_message,
                    time=480,  # 8 часов (минут)
                    chat_ids=[target_group_id],
                    requires_confirmation=True,
                    repeat=repeat_settings
                )
                
                try:
                    await crud.event.create_event_notification(
                        db, 
                        notification_in=daily_notification, 
                        event_id=event_id
                    )
                    logger.info(f"Создано ежедневное уведомление-напоминание для события {event_id}")
                except Exception as e:
                    logger.error(f"Ошибка при создании ежедневного уведомления: {e}", exc_info=True)
        
        return updated_event
    except Exception as e:
        await db.rollback()
        logger.exception(f"Ошибка при обновлении события {event_id}:", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Внутренняя ошибка сервера при обновлении события: {str(e)}"
        )

# --- Эндпоинт для обновления статуса уведомления ---
@router.patch(
    "/notifications/{notification_id}/status",
    response_model=schemas.NotificationRead,
    summary="Обновить статус уведомления"
)
async def update_notification_status(
    notification_id: uuid.UUID,
    status_update: dict,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет статус уведомления по его ID.
    Используется шедулером для отметки выполненных уведомлений.
    """
    logger.info(f"Запрос на обновление статуса уведомления {notification_id}: {status_update}")
    
    try:
        # Получаем уведомление
        notification = await crud.event.get_notification_by_id(db, notification_id)
        
        if not notification:
            logger.warning(f"Уведомление {notification_id} не найдено")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Уведомление не найдено"
            )
        
        # Обновляем статус и время выполнения
        notification.status = status_update.get("status", notification.status)
        
        # Если в запросе есть completed_at, обновляем его
        if "completed_at" in status_update:
            try:
                completed_at = datetime.fromisoformat(status_update["completed_at"])
                notification.completed_at = completed_at
            except ValueError:
                logger.warning(f"Некорректный формат даты для completed_at: {status_update.get('completed_at')}")
        
        # Если статус 'completed', но completed_at не указан, устанавливаем текущее время
        if notification.status == 'completed' and not notification.completed_at:
            notification.completed_at = datetime.now()
        
        # Сохраняем изменения
        await db.commit()
        await db.refresh(notification)
        
        logger.info(f"Статус уведомления {notification_id} успешно обновлен на '{notification.status}'")
        
        return notification
    
    except Exception as e:
        await db.rollback()
        logger.exception(f"Ошибка при обновлении статуса уведомления {notification_id}:", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Внутренняя ошибка сервера при обновлении статуса уведомления: {str(e)}"
        )

# TODO: Добавить эндпоинты для обновления (PUT /id), получения одного (GET /id) событий,
# и, возможно, для удаления уведомлений.
