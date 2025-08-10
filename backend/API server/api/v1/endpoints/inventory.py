from fastapi import APIRouter, Depends, Query, HTTPException, status, Path, Body, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, text # <-- ДОБАВЛЕН ИМПОРТ text
from sqlalchemy.orm import selectinload # <--- ДОБАВЛЕН ИМПОРТ selectinload
from sqlalchemy.orm.attributes import flag_modified # <--- ДОБАВЛЕН ИМПОРТ flag_modified
from typing import List, Optional, Dict, Any, Tuple
import os
import json
from datetime import datetime, timezone
import logging
import tempfile
import uuid
import asyncio
import subprocess
from urllib.parse import unquote

# Используем абсолютные импорты от корня /app
from db.session import get_db_session, async_engine
from sqlalchemy.ext.asyncio import AsyncSession # Добавляем импорт AsyncSession
from models.group import Group
from models.member import Member # Для поиска админов и автора истории
from models.group_member import GroupMember # Для поиска админов
from models.inventory_history import InventoryHistory # Для истории
from schemas.inventory import InventoryData, InventoryUpdatePayload, InventoryItemUpdatePayload # Схемы для POST/GET и точечный PUT
from schemas.user import UserSimple # Для информации об админах
# Добавим импорт Pydantic для полей админов
from pydantic import Field, BaseModel
# ---> ДОБАВЛЕНИЕ: импорты для кэша и зависимостей < ---
import redis.asyncio as redis # Типизация для клиента
from core.dependencies import get_redis_client # Импортируем из нового файла
from fastapi import Depends # Обновляем импорт Depends, чтобы он включал нашу зависимость
import uuid
import httpx # Для асинхронных HTTP запросов к боту
from pathlib import Path as FilePath # <--- Переименовано для избежания конфликта с fastapi.Path

from typing import List, Dict, Tuple, Any 

from services.inventory.excel_generator import generate_inventory_excel
from services.inventory.inventory_adapter import InventoryAdapter

logger = logging.getLogger(__name__)


router = APIRouter()



# Вспомогательная функция для получения группы по Telegram ID
async def get_group_by_telegram_id(db: AsyncSession, group_telegram_id: int) -> Group | None:
    """Вспомогательная функция для получения группы по Telegram ID."""
    logger.info(f"[get_group_by_telegram_id] Ищем группу с group_id = {group_telegram_id} (тип: {type(group_telegram_id)})")
    query = select(Group).where(Group.group_id == group_telegram_id)
    logger.debug(f"[get_group_by_telegram_id] SQLAlchemy Query: {query}")
    try:
        result = await db.execute(query)
        group = result.scalar_one_or_none()
        logger.debug(f"[get_group_by_telegram_id] Результат scalar_one_or_none(): {group}")
        return group
    except Exception as e:
        logger.exception(f"[get_group_by_telegram_id] Ошибка при выполнении запроса к БД для group_id={group_telegram_id}")
        raise

# Python version of calculateInventoryProgress
def calculate_inventory_progress_py(inventory: Dict[str, Any] | None) -> int:
    if not inventory:
        return 0
    total_items = 0
    filled_items = 0
    try:
        for category_data in inventory.values():
            if not isinstance(category_data, dict):
                continue # Skip if category data is not a dict
            for item in category_data.values():
                if not isinstance(item, dict):
                     continue # Skip if item data is not a dict
                # Check raw item
                raw = item.get('raw')
                if isinstance(raw, dict):
                    total_items += 1
                    if raw.get('filled') or raw.get('quantity', 0) > 0 or raw.get('isOutOfStock'):
                        filled_items += 1
                # Check semifinished item
                semifinished = item.get('semifinished')
                if isinstance(semifinished, dict):
                    total_items += 1
                    # Semifinished doesn't have isOutOfStock usually
                    if semifinished.get('filled') or semifinished.get('quantity', 0) > 0:
                        filled_items += 1
    except Exception as e:
        logger.error(f"Error calculating progress: {e}. Inventory structure might be invalid.")
        return 0 # Return 0 on error

    if total_items == 0:
        return 0

    progress = round((filled_items / total_items) * 100)
    # logger.debug(f"Calculated progress: {progress}% ({filled_items}/{total_items})") # Optional debug log
    return progress

def _deep_merge_inventory_preserving_existing(base: Dict[str, Any] | None, incoming: Dict[str, Any] | None) -> Dict[str, Any]:
    """Безопасный мёрдж по категориям/товарам: не удаляет отсутствующие позиции из базы."""
    if not isinstance(base, dict):
        base = {}
    if not isinstance(incoming, dict):
        return json.loads(json.dumps(base))
    merged: Dict[str, Any] = json.loads(json.dumps(base))
    for category_name, items in incoming.items():
        if not isinstance(items, dict):
            continue
        if category_name not in merged or not isinstance(merged.get(category_name), dict):
            merged[category_name] = {}
        for item_name, item_data in items.items():
            merged[category_name][item_name] = item_data
    return merged

# --- Pydantic модели для AdminInfo (если не вынесены в schemas) ---
class AdminInfo(UserSimple):
    # Можно добавить роль, если нужно
    # role: str
    pass

# --- ЭНДПОИНТЫ ИНВЕНТАРЯ ---

@router.get(
    "/template",
    response_model=Dict[str, Any], # Возвращаем просто словарь JSON
    summary="Get Inventory Template",
    description="Retrieves the default inventory template structure from a JSON file.",
    tags=["Inventory", "Templates"]
)
async def get_inventory_template():
    """
    Reads and returns the inventory template from the predefined JSON file.
    """
    template_path = "/app/data/templates/inventory_template.json"
    logger.info(f"[get_inventory_template] Attempting to read template from: {template_path}")

    if not os.path.exists(template_path):
        logger.error(f"[get_inventory_template] Template file not found at: {template_path}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Inventory template file not found on server.")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = json.load(f)
        logger.info(f"[get_inventory_template] Template loaded successfully.")
        return template_data
    except json.JSONDecodeError as e:
        logger.error(f"[get_inventory_template] Error decoding JSON template file: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error reading inventory template file.")
    except Exception as e:
        logger.exception(f"[get_inventory_template] An unexpected error occurred while reading the template file")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.get(
    "/{chat_id}",
    # response_model=InventoryData, # Убрано, возвращаем словарь
    summary="Get Inventory Data for a Chat",
    description="Retrieves the current inventory data, metadata, and admins for a specific chat by its Telegram ID. Only for 'chef' groups.",
    tags=["Inventory"]
)
async def read_inventory_for_chat(
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session),
    # ---> ДОБАВЛЕНО: Зависимость клиента кэша < ---
    redis_client: redis.Redis = Depends(get_redis_client) 
    # ---> КОНЕЦ ДОБАВЛЕНИЯ < ---
):
    """
    Fetches inventory data for a specific chat. Only for 'chef' groups.
    Caches the result for a short period.
    """
    logger.info(f"[read_inventory_for_chat] GET /inventory/{chat_id}")
    cache_key = f"inventory:{chat_id}"
    cache_ttl_seconds = 10 # Время жизни кэша в секундах

    # ---> НАЧАЛО: Проверка кэша < ---
    if redis_client:
        try:
            cached_data_json = await redis_client.get(cache_key)
            if cached_data_json:
                logger.info(f"[read_inventory_for_chat] Cache HIT for key: {cache_key}")
                try:
                    # Пытаемся распарсить JSON из кэша
                    cached_data = json.loads(cached_data_json)
                    # Важно: Проверить, что структура соответствует ожиданиям (хотя бы наличие ключа 'inventory')
                    if isinstance(cached_data, dict) and "inventory" in cached_data:
                        return cached_data
                    else:
                         logger.warning(f"[read_inventory_for_chat] Invalid data structure found in cache for key {cache_key}. Proceeding to fetch from DB.")
                except json.JSONDecodeError:
                     logger.warning(f"[read_inventory_for_chat] Failed to decode JSON from cache for key {cache_key}. Proceeding to fetch from DB.")
            else:
                 logger.info(f"[read_inventory_for_chat] Cache MISS for key: {cache_key}")
        except Exception as e:
            logger.error(f"[read_inventory_for_chat] Error accessing cache for key {cache_key}: {e}. Proceeding to fetch from DB.")
    else:
        logger.warning("[read_inventory_for_chat] Redis client is not available. Skipping cache check.")
    # ---> КОНЕЦ: Проверка кэша < ---

    # ---> Если кэш не сработал, идем в базу данных < ---
    logger.info(f"[read_inventory_for_chat] Fetching data from database for chat_id: {chat_id}")
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
         logger.error(f"[read_inventory_for_chat] Invalid chat_id format: {chat_id}")
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        # Получаем группу
        group = await get_group_by_telegram_id(db, group_telegram_id)

        if not group:
            logger.warning(f"[read_inventory_for_chat] Group not found for chat_id: {chat_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

        if group.group_type != 'chef':
            logger.warning(f"[read_inventory_for_chat] Inventory access denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory data is only available for groups of type 'chef'")

        # ---> НАЧАЛО НОВОЙ ЛОГИКИ <--- 
        # 1. Получаем основной инвентарь из БД
        base_inventory = group.json_inventory 

        # 2. Если основной инвентарь пустой, загружаем шаблон
        if not base_inventory:
            logger.info(f"[read_inventory_for_chat] Inventory for chat {chat_id} is empty. Loading template.")
            try:
                # Используем существующую функцию для загрузки шаблона
                template_inventory = await get_inventory_template()
                # Создаем копию шаблона, чтобы не изменять оригинал
                base_inventory = json.loads(json.dumps(template_inventory))
                 # Сразу сохраняем шаблон в базу, чтобы он там был для будущих запросов
                 # Делаем это в отдельной транзакции, чтобы не блокировать чтение
                async with AsyncSession(async_engine) as update_db:
                     async with update_db.begin():
                          # Получаем группу еще раз для обновления
                          group_to_update = await update_db.get(Group, group.id)
                          if group_to_update:
                              group_to_update.json_inventory = base_inventory
                              await update_db.flush()
                              logger.info(f"[read_inventory_for_chat] Saved template to DB for chat {chat_id}")
                          else:
                               logger.warning(f"[read_inventory_for_chat] Could not find group {chat_id} again to save template.")

            except HTTPException as template_exc:
                # Если шаблон не найден, возвращаем пустой инвентарь (или можно кинуть ошибку)
                logger.error(f"[read_inventory_for_chat] Error loading template: {template_exc.detail}")
                base_inventory = {}
            except Exception as e:
                logger.exception(f"[read_inventory_for_chat] Unexpected error loading template for chat {chat_id}")
                base_inventory = {}
        else:
             # Важно: если инвентарь НЕ пустой, работаем с его копией, чтобы не изменить в БД
             base_inventory = json.loads(json.dumps(group.json_inventory))

        # 3. Получаем специфичные добавления для группы
        group_additions = group.json_inventory_additions or {}

        # 4. Сливаем добавления в базовый инвентарь
        if group_additions:
            logger.info(f"[read_inventory_for_chat] Merging {len(group_additions)} group-specific additions for chat {chat_id}")
            for category, items in group_additions.items():
                if not isinstance(items, dict):
                     logger.warning(f"[read_inventory_for_chat] Invalid format in json_inventory_additions for category '{category}' in chat {chat_id}. Skipping.")
                     continue
                 
                if category not in base_inventory:
                    base_inventory[category] = {}
                    logger.debug(f"[read_inventory_for_chat] Added new category '{category}' from additions.")
                
                for item_name, item_data in items.items():
                     if not isinstance(item_data, dict):
                         logger.warning(f"[read_inventory_for_chat] Invalid item data format for item '{item_name}' in category '{category}' additions. Skipping.")
                         continue
                     
                     # Проверяем, существует ли товар с таким именем в базовом инвентаре этой категории
                     if item_name not in base_inventory[category]:
                          # Создаем стандартную структуру товара
                          new_item = {
                              "name": item_name,
                              "raw": {"quantity": 0, "filled": False, "isOutOfStock": False},
                              "itemType": "raw" # По умолчанию
                          }
                          # Добавляем semifinished, если указано в item_data ('has_semifinished')
                          if item_data.get('has_semifinished') is True:
                              new_item["semifinished"] = {"quantity": 0, "filled": False}
                              new_item["itemType"] = "both"
                          
                          base_inventory[category][item_name] = new_item
                          logger.debug(f"[read_inventory_for_chat] Added new item '{item_name}' to category '{category}' from additions.")
                     else:
                          # Если товар уже есть, можно логировать или ничего не делать
                          # logger.debug(f"[read_inventory_for_chat] Item '{item_name}' in category '{category}' already exists in base inventory. Skipping addition.")
                          pass 
        # ---> КОНЕЦ НОВОЙ ЛОГИКИ <--- 

        # Используем результат слияния (base_inventory) для ответа
        final_inventory_data = base_inventory

        # Получаем метаданные и админов как раньше
        metadata = group.json_metadata or {}
        last_updated = metadata.get("lastUpdated")
        # Важно: Пересчитываем прогресс на основе финального инвентаря (base_inventory)
        progress = calculate_inventory_progress_py(final_inventory_data)

        admins_query = (
            select(Member)
            .join(GroupMember, GroupMember.member_id == Member.id)
            .where(
                GroupMember.group_id == group.id,
                GroupMember.role.in_(['administrator', 'creator'])
            )
        )
        admins_result = await db.execute(admins_query)
        admins = admins_result.scalars().all()

        admins_list_of_dicts = []
        for admin in admins:
            admin_data = {
                "id": admin.id,
                "user_id": admin.user_id,
                "first_name": admin.first_name,
                "last_name": admin.last_name,
                "username": admin.username,
                "photo_url": str(admin.photo_url) if admin.photo_url else None
            }
            admins_list_of_dicts.append(admin_data)

        # Формируем ответ, используя final_inventory_data и пересчитанный progress
        # Важно: сохраняем ВСЕ поля из метаданных, включая lastTemplateUpdate
        full_metadata = group.json_metadata or {}
        full_metadata.update({
            "lastUpdated": last_updated, # Обновляем время последнего обновления
            "progress": progress, # Обновляем пересчитанный прогресс
            "chat_id": chat_id # Убеждаемся, что chat_id присутствует
        })
        
        # Декодируем ключи инвентаря перед отправкой фронтенду
        from urllib.parse import unquote
        decoded_inventory_data = {}
        
        if final_inventory_data:
            for category_key, category_items in final_inventory_data.items():
                # Декодируем имя категории
                try:
                    decoded_category = unquote(category_key)
                    # Проверяем, нужно ли декодировать еще раз (двойное кодирование)
                    if decoded_category.count('%') > 0:
                        decoded_category = unquote(decoded_category)
                except Exception:
                    decoded_category = category_key  # Fallback к оригинальному
                
                decoded_inventory_data[decoded_category] = {}
                
                if isinstance(category_items, dict):
                    for item_key, item_data in category_items.items():
                        # Декодируем имя товара
                        try:
                            decoded_item = unquote(item_key)
                            # Проверяем, нужно ли декодировать еще раз
                            if decoded_item.count('%') > 0:
                                decoded_item = unquote(decoded_item)
                        except Exception:
                            decoded_item = item_key  # Fallback к оригинальному
                        
                        decoded_inventory_data[decoded_category][decoded_item] = item_data
                else:
                    # На случай, если category_items не словарь
                    decoded_inventory_data[decoded_category] = category_items
                    
            logger.info(f"[read_inventory_for_chat] Decoded inventory keys for frontend for chat_id: {chat_id}")
        else:
            decoded_inventory_data = final_inventory_data

        response_dict = {
            "inventory": decoded_inventory_data,
            "metadata": full_metadata, # Используем ПОЛНЫЕ метаданные
            "chat_title": group.title,
            "admins": admins_list_of_dicts
        }

        logger.info(f"[read_inventory_for_chat] Successfully retrieved and merged inventory for chat_id: {chat_id}")
        
        # ---> НАЧАЛО: Сохранение результата в кэш < ---
        if redis_client:
            try:
                # Сериализуем в JSON перед сохранением
                response_json_str = json.dumps(response_dict, default=str) # Используем default=str на всякий случай
                await redis_client.set(cache_key, response_json_str, ex=cache_ttl_seconds)
                logger.info(f"[read_inventory_for_chat] Result for key {cache_key} saved to cache with TTL {cache_ttl_seconds}s.")
            except Exception as e:
                logger.error(f"[read_inventory_for_chat] Failed to save result to cache for key {cache_key}: {e}")
        else:
            logger.warning("[read_inventory_for_chat] Redis client is not available. Skipping cache saving.")
        # ---> КОНЕЦ: Сохранение результата в кэш < ---

        return response_dict

    except HTTPException as http_exc:
         raise http_exc # Пробрасываем HTTP исключения
    except Exception as e:
        logger.exception(f"[read_inventory_for_chat] Error retrieving inventory for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not retrieve inventory data")


@router.post(
    "/{chat_id}",
    response_model=InventoryData,
    summary="Update Inventory Data for a Chat",
    description="Updates the inventory data and metadata for a specific chat. Only available for 'chef' groups. Notifies via Database.",
    tags=["Inventory"]
)
async def update_inventory_for_chat(
    payload: InventoryUpdatePayload,
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates inventory data for a specific chat, only if it's a 'chef' group.
    Saves history and notifies via PostgreSQL NOTIFY.
    """
    logger.info(f"[update_inventory_for_chat] POST /inventory/{chat_id}")

    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[update_inventory_for_chat] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    calculated_progress = 0 # Инициализируем перед транзакцией
    group_id_for_response = None # Для формирования ответа после транзакции
    group_title_for_response = None
    updated_inventory_for_response = {}
    updated_metadata_for_response = {}
    # Переменные для деталей измененного товара для NOTIFY
    item_id_for_notify = None
    category_for_notify = None

    try:
        async with db.begin(): # Используем транзакцию
            group_query = select(Group).where(Group.group_id == group_telegram_id).with_for_update()
            group_result = await db.execute(group_query)
            group = group_result.scalar_one_or_none()

            if not group:
                logger.warning(f"[update_inventory_for_chat] Group not found for chat_id: {chat_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

            if group.group_type != 'chef':
                logger.warning(f"[update_inventory_for_chat] Inventory update denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory data can only be updated for groups of type 'chef'")

            # Сохраняем данные для ответа до их изменения
            group_id_for_response = group.id
            group_title_for_response = group.title

            logger.info(f"Updating inventory for chat_id: {chat_id}")
            # ВАЖНО: вместо полной перезаписи делаем безопасный merge,
            # чтобы не терять параллельные правки. Старый путь остаётся совместимым.
            current_inventory_in_db = group.json_inventory or {}
            merged_inventory = _deep_merge_inventory_preserving_existing(current_inventory_in_db, payload.inventory)
            group.json_inventory = merged_inventory
            updated_inventory_for_response = group.json_inventory # Сохраняем обновленный инвентарь

            calculated_progress = calculate_inventory_progress_py(merged_inventory)
            
            # ИСПРАВЛЕНИЕ: Сохраняем существующие метаданные и обновляем только нужные поля
            existing_metadata = group.json_metadata or {}
            # Серверный timestamp и версия
            server_now = datetime.now(timezone.utc).isoformat()
            try:
                current_version = int(existing_metadata.get("version", 0))
            except Exception:
                current_version = 0
            # Создаем новый объект метаданных для корректного отслеживания изменений ORM
            updated_metadata = {
                **existing_metadata,  # Копируем существующие метаданные
                "progress": calculated_progress,
                "lastUpdated": server_now,
                "chat_id": chat_id,
                "version": current_version + 1
            }
            
            logger.info(f"Calculated progress: {calculated_progress}%. Updating metadata while preserving existing fields: {list(updated_metadata.keys())}")
            group.json_metadata = updated_metadata
            updated_metadata_for_response = group.json_metadata # Сохраняем обновленные метаданные

            # --- ОБРАБОТКА И СОХРАНЕНИЕ ИСТОРИИ ---
            # Переменные для деталей измененного товара для NOTIFY
            item_id_for_notify = None
            category_for_notify = None
            
            if payload.history:
                history_data = payload.history
                category = history_data.get('category')
                item_name = history_data.get('itemName')
                author_member_id = history_data.get('authorMemberId')
                
                if category and item_name:
                    logger.info(f"[update_inventory_for_chat] Processing history for item: {category}/{item_name}")
                    
                    # Определяем тип товара (raw/semifinished)
                    item_type_from_history = history_data.get('itemType')
                    final_item_type = None
                    
                    if item_type_from_history in ['raw', 'semifinished']:
                        final_item_type = item_type_from_history
                        logger.info(f"[update_inventory_for_chat] Using itemType '{final_item_type}' from history data.")
                    else:
                        # Пытаемся определить тип из данных инвентаря
                        if payload.inventory and category in payload.inventory and item_name in payload.inventory[category]:
                            item_data = payload.inventory[category][item_name]
                            if item_data.get('raw') and item_data.get('semifinished'):
                                # Если есть оба типа, определяем по изменению количества
                                old_quantity = history_data.get('oldQuantity', 0)
                                new_quantity = history_data.get('newQuantity', 0)
                                
                                if 'raw' in item_type_from_history or (item_data['raw'].get('quantity', 0) != old_quantity):
                                    final_item_type = 'raw'
                                elif 'semifinished' in item_type_from_history or (item_data['semifinished'].get('quantity', 0) != old_quantity):
                                    final_item_type = 'semifinished'
                                else:
                                    # По умолчанию используем raw
                                    final_item_type = 'raw'
                                logger.info(f"[update_inventory_for_chat] Inferred itemType '{final_item_type}' for {category}/{item_name} from inventory data.")
                            else:
                                 logger.warning(f"[update_inventory_for_chat] Found item {category}/{item_name} in inventory, but its itemType ('{item_type_from_history}') is invalid or missing.")
                        else:
                             logger.warning(f"[update_inventory_for_chat] Could not find item {category}/{item_name} in inventory payload to infer itemType.")
                    
                    if final_item_type is None:
                        logger.error(f"[update_inventory_for_chat] Could not determine a valid itemType for history record: category='{category}', item='{item_name}'. Received itemType from history: '{item_type_from_history}'")
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Could not determine a valid itemType ('raw' or 'semifinished') for the history record of item '{item_name}'."
                        )

                    member_db_id = None
                    if author_member_id:
                        member_query = select(Member.id).where(Member.user_id == author_member_id)
                        member_result = await db.execute(member_query)
                        member_db_id = member_result.scalar_one_or_none()
                        if not member_db_id:
                            logger.warning(f"[update_inventory_for_chat] Author member with Telegram ID {author_member_id} not found in DB for history record.")

                    new_history_record = InventoryHistory(
                        group_id=group.id,
                        category=category,
                        item_name=item_name,
                        action=history_data.get('action'),
                        type=final_item_type,
                        old_quantity=history_data.get('oldQuantity'),
                        new_quantity=history_data.get('newQuantity'),
                        author_id=member_db_id
                    )
                    db.add(new_history_record)
                    logger.info(f"[update_inventory_for_chat] Prepared history record for item: {item_name} with type: {final_item_type}")
                    # ----> ЗАПОМИНАЕМ ДЕТАЛИ ДЛЯ NOTIFY <----
                    item_id_for_notify = new_history_record.item_name
                    category_for_notify = new_history_record.category
                    # --------------------------------------
                else:
                    logger.warning("[update_inventory_for_chat] History data not found in payload.")
            else:
                logger.warning("[update_inventory_for_chat] History data not found in payload.")
                
                # 🔧 ИСПРАВЛЕНИЕ: Если данных истории нет, пытаемся определить обновленный товар из payload.inventory
                if payload.inventory:
                    # Сравниваем новый инвентарь с текущим, чтобы найти измененные товары
                    current_inventory = group.json_inventory or {}
                    
                    for category_name, category_items in payload.inventory.items():
                        if category_name not in current_inventory:
                            continue
                            
                        for item_name, item_data in category_items.items():
                            if item_name not in current_inventory[category_name]:
                                continue
                                
                            current_item = current_inventory[category_name][item_name]
                            
                            # Проверяем изменения в raw
                            if item_data.get('raw') and current_item.get('raw'):
                                if (item_data['raw'].get('quantity') != current_item['raw'].get('quantity') or
                                    item_data['raw'].get('filled') != current_item['raw'].get('filled') or
                                    item_data['raw'].get('isOutOfStock') != current_item['raw'].get('isOutOfStock')):
                                    item_id_for_notify = item_name
                                    category_for_notify = category_name
                                    logger.info(f"[update_inventory_for_chat] Detected raw item update from inventory comparison: {category_name}/{item_name}")
                                    break
                            
                            # Проверяем изменения в semifinished
                            if item_data.get('semifinished') and current_item.get('semifinished'):
                                if (item_data['semifinished'].get('quantity') != current_item['semifinished'].get('quantity') or
                                    item_data['semifinished'].get('filled') != current_item['semifinished'].get('filled')):
                                    item_id_for_notify = item_name
                                    category_for_notify = category_name
                                    logger.info(f"[update_inventory_for_chat] Detected semifinished item update from inventory comparison: {category_name}/{item_name}")
                                    break
                        
                        if item_id_for_notify and category_for_notify:
                            break
            # --- КОНЕЦ ОБРАБОТКИ ИСТОРИИ ---
        
        # Транзакция успешно завершилась (commit)
        logger.info(f"[update_inventory_for_chat] DB transaction committed for chat_id: {chat_id}")

    except HTTPException as http_exc:
        # Ошибка HTTPException возникла внутри транзакции, db.begin() сделает rollback.
        raise http_exc
    except Exception as e:
        # Ловим другие ошибки, db.begin() сделает rollback
        logger.exception(f"[update_inventory_for_chat] Error during DB transaction for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not process inventory data due to DB error")

    # --- ОТПРАВКА УВЕДОМЛЕНИЯ ЧЕРЕЗ PostgreSQL NOTIFY ---
    # Происходит *после* успешного завершения транзакции db.begin()
    if group_id_for_response is not None: # Убедимся, что транзакция прошла успешно
        try:
            # --- КОНЕЦ ПОЛУЧЕНИЯ АДМИНОВ (они больше не нужны для NOTIFY) ---

            # Имя канала
            pg_channel_name = "websocket_channel"
            
            # --- Формируем payload: всегда метаданные, опционально - обновленный item ---
            notify_payload_dict = {
                "type": "inventory_updated", 
                "chat_id": str(chat_id), 
                "metadata": updated_metadata_for_response, # Всегда отправляем актуальные метаданные
            }
            
            # Если было обновление конкретного товара, добавляем его данные
            if item_id_for_notify and category_for_notify:
                # Декодируем параметры для WebSocket (на случай если они пришли закодированными)
                from urllib.parse import unquote
                decoded_item_id_for_notify = unquote(item_id_for_notify)
                decoded_category_for_notify = unquote(category_for_notify)
                
                logger.info(f"[update_inventory_for_chat] WebSocket params: category={category_for_notify} -> {decoded_category_for_notify}, item_id={item_id_for_notify} -> {decoded_item_id_for_notify}")
                
                # Получаем обновленный объект item из сохраненного инвентаря
                updated_item_object = updated_inventory_for_response.get(category_for_notify, {}).get(item_id_for_notify)
                
                if updated_item_object:
                    notify_payload_dict["item_id"] = decoded_item_id_for_notify
                    notify_payload_dict["category"] = decoded_category_for_notify
                    notify_payload_dict["item"] = updated_item_object # <-- Отправляем сам объект товара
                    logger.info(f"Adding item object to NOTIFY payload: item_id={decoded_item_id_for_notify}, category={decoded_category_for_notify}")
                else:
                     logger.warning(f"Could not find updated item {category_for_notify}/{item_id_for_notify} in saved inventory for NOTIFY payload.")
                     # Если не нашли, НЕ добавляем item_id/category, чтобы фронтенд обновил только метаданные
            else:
                logger.info("No specific item updated, sending metadata update only via NOTIFY.")
            # --- КОНЕЦ ФОРМИРОВАНИЯ PAYLOAD ---

            # Добавляем идентификатор события для дедупликации на клиенте
            try:
                notify_payload_dict["event_id"] = str(uuid.uuid4())
            except Exception:
                pass

            # Преобразуем в JSON строку
            notify_payload_json = json.dumps(notify_payload_dict, default=str)

            # Экранируем одинарные кавычки для SQL 
            escaped_payload = notify_payload_json.replace("'", "''")

            # Проверяем длину перед отправкой (PostgreSQL лимит ~8000 байт)
            if len(escaped_payload) >= 7900: # Оставляем небольшой запас
                 logger.warning(f"NOTIFY payload for chat_id {chat_id} is too long ({len(escaped_payload)} bytes). Skipping item data.")
                 # Отправляем ТОЛЬКО метаданные в этом случае
                 minimal_payload_dict = {
                     "type": "inventory_updated", 
                     "chat_id": str(chat_id), 
                     "metadata": updated_metadata_for_response
                 }
                 notify_payload_json = json.dumps(minimal_payload_dict, default=str)
                 escaped_payload = notify_payload_json.replace("'", "''")

            # Создаем сессию для отправки NOTIFY
            async with AsyncSession(async_engine) as notify_db:
                sql_command = text(f"NOTIFY {pg_channel_name}, '{escaped_payload}'")
                await notify_db.execute(sql_command)
                await notify_db.commit() 
                logger.info(f"Successfully sent inventory update NOTIFY to channel '{pg_channel_name}' for chat_id: {chat_id}. Payload length: {len(escaped_payload)}")

        except Exception as notify_error:
            logger.error(f"Failed to send PostgreSQL NOTIFY for chat_id {chat_id}: {notify_error}", exc_info=True)
    else:
        logger.error(f"[update_inventory_for_chat] Cannot send NOTIFY because group data was not available after transaction for chat_id: {chat_id}")
    # --- КОНЕЦ ОТПРАВКИ УВЕДОМЛЕНИЯ --- 

    # --- Инвалидация кэша Redis ---
    try:
        if 'redis_client' in locals() and redis_client:
            await redis_client.delete(f"inventory:{chat_id}")
            logger.info(f"[update_inventory_for_chat] Invalidated cache inventory:{chat_id}")
    except Exception as e:
        logger.error(f"[update_inventory_for_chat] Failed to invalidate cache for chat {chat_id}: {e}")

    # --- ФОРМИРОВАНИЕ HTTP ОТВЕТА --- 
    try:
        # Получаем админов для HTTP ответа
        admins_list_for_http_response = []
  
        
        if group_id_for_response: # Получаем админов всегда для HTTP ответа
             async with AsyncSession(async_engine) as response_db:
                 admins_query = (
                     select(Member)
                     .join(GroupMember, GroupMember.member_id == Member.id)
                     .where(
                         GroupMember.group_id == group_id_for_response,
                         GroupMember.role.in_(['administrator', 'creator'])
                     )
                 )
                 admins_result = await response_db.execute(admins_query)
                 admins = admins_result.scalars().all()
                 admins_list_for_http_response = [AdminInfo.model_validate(admin) for admin in admins]
        
        # Формируем Pydantic модель ответа
        response_data = InventoryData(
            inventory=updated_inventory_for_response, 
            metadata=updated_metadata_for_response,
            chat_title=group_title_for_response, 
            admins=admins_list_for_http_response
        )
        logger.info(f"[update_inventory_for_chat] Inventory update processed successfully for chat_id: {chat_id}. Returning HTTP response.")
        return response_data
    except Exception as resp_err:
        logger.exception(f"[update_inventory_for_chat] Error formatting HTTP response after successful update for chat_id: {chat_id}: {resp_err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Inventory updated but failed to format response.")


# --- ЭНДПОИНТ ИСТОРИИ ---
@router.get(
    "/history/{chat_id}",
    response_model=List[Dict[str, Any]],
    summary="Get Item History",
    description="Retrieves the history of changes for a specific item in a chat.",
    tags=["Inventory", "History"]
)
async def get_item_history(
    chat_id: str = Path(..., description="Telegram ID of the chat"),
    category: str = Query(..., description="Category name"),
    item_name: str = Query(..., description="Item name"),
    db: AsyncSession = Depends(get_db_session)
):
    # Query parameters автоматически декодируются FastAPI
    category_decoded = category
    item_name_decoded = item_name
    
    logger.info(f"[get_item_history] Request for history: chat={chat_id}, category={category_decoded}, item={item_name_decoded}")
    try:
        # --- Проверка chat_id и поиск группы ---
        try:
            group_telegram_id = int(chat_id)
        except ValueError:
             logger.warning(f"[get_item_history] Invalid chat_id format: {chat_id}")
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

        group = await get_group_by_telegram_id(db, group_telegram_id)
        # ---> ДОБАВЛЕНО ЛОГИРОВАНИЕ РЕЗУЛЬТАТА ПОИСКА ГРУППЫ <--- 
        logger.info(f"[get_item_history] Group search result for chat_id {chat_id}: Group found = {group is not None}")
        if not group:
            logger.warning(f"[get_item_history] Group not found for chat_id: {chat_id}, raising 404.") # Added more detail
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

        if group.group_type != 'chef':
             logger.warning(f"[get_item_history] History access denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef', raising 403.") # Added more detail
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory history is only available for groups of type 'chef'")

        # --- Запрос истории из БД ---
        history_query = (
            select(InventoryHistory)
            .options(selectinload(InventoryHistory.author_member))
            .where(
                InventoryHistory.group_id == group.id,
                InventoryHistory.category == category_decoded,
                InventoryHistory.item_name == item_name_decoded
            )
            .order_by(desc(InventoryHistory.timestamp))
        )
        # ---> ДОБАВЛЕНО ЛОГИРОВАНИЕ ПЕРЕД ВЫПОЛНЕНИЕМ ЗАПРОСА <--- 
        logger.info(f"[get_item_history] Executing history query for group.id={group.id}, category='{category_decoded}', item_name='{item_name_decoded}'")
        result = await db.execute(history_query)
        history_records = result.scalars().all()
        # ---> ДОБАВЛЕНО ЛОГИРОВАНИЕ КОЛИЧЕСТВА НАЙДЕННЫХ ЗАПИСЕЙ <--- 
        logger.info(f"[get_item_history] Found {len(history_records)} history records in DB.")

        # --- Формирование ответа ---
        response_data = []
        for record in history_records:
            author_data = None
            if record.author_member:
                 author_data = {
                     "user_id": record.author_member.user_id,
                     "first_name": record.author_member.first_name,
                     "photo_url": str(record.author_member.photo_url) if record.author_member.photo_url else None
                 }

            response_data.append({
                "id": record.id,
                "group_id": record.group_id,
                "category": record.category,
                "item_name": record.item_name,
                "action": record.action,
                "type": record.type,
                "old_quantity": record.old_quantity,
                "new_quantity": record.new_quantity,
                "timestamp": record.timestamp.isoformat(),
                "author": author_data
            })
        # ---> ДОБАВЛЕНО ЛОГИРОВАНИЕ ПЕРЕД ВОЗВРАТОМ ОТВЕТА <--- 
        logger.info(f"[get_item_history] Returning response_data (length: {len(response_data)}). First item if exists: {response_data[0] if response_data else 'None'}")
        return response_data

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.exception(f"[get_item_history] Error fetching history for chat={chat_id}, item={item_name_decoded}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch item history")

# ---> ДОБАВЛЕНИЕ: Pydantic модель для добавления товара <---
class AddItemPayload(BaseModel):
    category: str = Field(..., description="Category name for the new item")
    item_name: str = Field(..., description="Name of the new item")
    has_semifinished: bool = Field(False, description="Does the item have a semifinished component?")
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

# ---> ДОБАВЛЕНИЕ: Новый эндпоинт для добавления товара в json_inventory_additions <---
@router.post(
    "/{chat_id}/items",
    status_code=status.HTTP_201_CREATED,
    summary="Add a Custom Inventory Item Definition",
    description="Adds the definition of a new custom item to the group-specific additions (`json_inventory_additions`). This does not add the item to the main inventory directly, but defines it for future merging.",
    tags=["Inventory", "Custom Items"]
)
async def add_custom_inventory_item(
    payload: AddItemPayload,
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    # TODO: Добавить зависимость для проверки прав администратора
    db: AsyncSession = Depends(get_db_session)
):
    """
    Adds a custom item definition to the group's specific additions.
    """
    logger.info(f"[add_custom_inventory_item] POST /inventory/{chat_id}/items for item: {payload.category}/{payload.item_name}")

    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[add_custom_inventory_item] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    # Проверка категории и имени на пустоту
    if not payload.category or not payload.item_name:
         logger.error(f"[add_custom_inventory_item] Category or item_name is empty for chat_id {chat_id}. Category: '{payload.category}', ItemName: '{payload.item_name}'")
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category and item name cannot be empty.")

    try:
        async with db.begin(): # Используем транзакцию
            # Получаем группу с блокировкой для обновления
            group_query = select(Group).where(Group.group_id == group_telegram_id).with_for_update()
            group_result = await db.execute(group_query)
            group = group_result.scalar_one_or_none()

            if not group:
                logger.warning(f"[add_custom_inventory_item] Group not found for chat_id: {chat_id}")
                # Откат транзакции произойдет автоматически при выходе из блока `async with` из-за исключения
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

            if group.group_type != 'chef':
                logger.warning(f"[add_custom_inventory_item] Add item denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Custom items can only be added to groups of type 'chef'")

            # TODO: Проверка прав доступа пользователя (что он админ группы)

            # ---> НАЧАЛО ИЗМЕНЕНИЯ: Проверка на существование в базовом инвентаре <---
            base_inventory = group.json_inventory
            if not base_inventory:
                 logger.info(f"[add_custom_inventory_item] Base inventory is empty for chat {chat_id}, loading template for check.")
                 try:
                     base_inventory = await get_inventory_template() # Загружаем шаблон только для проверки
                 except HTTPException as e:
                     # Если шаблон не найден, считаем, что базовый инвентарь пуст, и позволяем добавление
                     logger.warning(f"[add_custom_inventory_item] Template not found while checking for existing item: {e.detail}. Allowing addition.")
                     base_inventory = {}
                 except Exception as e:
                     logger.exception(f"[add_custom_inventory_item] Error loading template for check. Allowing addition.")
                     base_inventory = {}
            
            # Проверяем, существует ли товар в базовом инвентаре
            if base_inventory and \
               payload.category in base_inventory and \
               isinstance(base_inventory[payload.category], dict) and \
               payload.item_name in base_inventory[payload.category]:
                logger.warning(f"[add_custom_inventory_item] Item '{payload.item_name}' already exists in base inventory category '{payload.category}' for chat {chat_id}. Rejecting request.")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, 
                    detail=f"Item '{payload.item_name}' already exists in category '{payload.category}' in the base inventory."
                )
            # ---> КОНЕЦ ИЗМЕНЕНИЯ < ---

            # Загружаем или инициализируем json_inventory_additions
            additions = group.json_inventory_additions or {}
            
            # ---> ДОБАВЛЕНИЕ: Проверка на существование в additions <---
            if payload.category in additions and \
               isinstance(additions[payload.category], dict) and \
               payload.item_name in additions[payload.category]:
                logger.warning(f"[add_custom_inventory_item] Item definition '{payload.item_name}' already exists in additions category '{payload.category}' for chat {chat_id}. Rejecting request.")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, 
                    detail=f"Item definition '{payload.item_name}' already exists in category '{payload.category}' additions for this group."
                )
            # ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

            # Обеспечиваем существование категории
            if payload.category not in additions:
                additions[payload.category] = {}
                logger.info(f"[add_custom_inventory_item] Category '{payload.category}' not found in additions for chat {chat_id}, creating it.")
            elif not isinstance(additions[payload.category], dict):
                 logger.warning(f"[add_custom_inventory_item] Existing data for category '{payload.category}' in additions for chat {chat_id} is not a dict. Overwriting with a new dict.")
                 additions[payload.category] = {}

            # Добавляем или обновляем определение товара
            item_definition = {"has_semifinished": payload.has_semifinished}
            additions[payload.category][payload.item_name] = item_definition
            logger.info(f"[add_custom_inventory_item] Added/Updated item '{payload.item_name}' in category '{payload.category}' additions for chat {chat_id}. Definition: {item_definition}")

            # Сохраняем обновленные additions
            group.json_inventory_additions = additions
            # ---> ЯВНО ПОМЕЧАЕМ ПОЛЕ КАК ИЗМЕНЕННОЕ < ---
            flag_modified(group, "json_inventory_additions")
            # ------------------------------------------
            # Не нужно вызывать db.add(group), т.к. он уже отслеживается сессией
            # Не нужно вызывать db.flush() здесь, т.к. commit в конце блока `async with` сделает это
            
            # ---> ДОБАВЛЕНИЕ: Сохраняем метаданные для NOTIFY < ---
            current_metadata = group.json_metadata or {}
            # ---> КОНЕЦ ДОБАВЛЕНИЯ < ---
            
        # Транзакция успешно завершена (commit)
        logger.info(f"[add_custom_inventory_item] Successfully updated json_inventory_additions for chat_id: {chat_id}")
        
        # ---> ДОБАВЛЕНИЕ: Отправка уведомления NOTIFY < ---
        try:
            pg_channel_name = "websocket_channel"
            notify_payload_dict = {
                "type": "inventory_updated", 
                "chat_id": str(chat_id),
                "metadata": current_metadata, # Отправляем текущие метаданные
                # Не отправляем item_id/category при добавлении определения
            }
            notify_payload_json = json.dumps(notify_payload_dict, default=str)
            escaped_payload = notify_payload_json.replace("'", "''")

            # Проверка длины
            if len(escaped_payload) >= 7900:
                 logger.warning(f"NOTIFY payload for item definition addition in chat_id {chat_id} is too long ({len(escaped_payload)} bytes). Sending minimal.")
                 minimal_payload_dict = {"type": "inventory_updated", "chat_id": str(chat_id), "metadata": current_metadata}
                 escaped_payload = json.dumps(minimal_payload_dict, default=str).replace("'", "''")

            async with AsyncSession(async_engine) as notify_db:
                sql_command = text(f"NOTIFY {pg_channel_name}, '{escaped_payload}'")
                await notify_db.execute(sql_command)
                await notify_db.commit() 
                logger.info(f"Successfully sent item definition addition NOTIFY to channel '{pg_channel_name}' for chat_id: {chat_id}. Payload length: {len(escaped_payload)}")

        except Exception as notify_error:
            logger.error(f"Failed to send PostgreSQL NOTIFY after item definition addition for chat_id {chat_id}: {notify_error}", exc_info=True)
        # ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

        return {"message": f"Item '{payload.item_name}' definition added/updated in group additions successfully."}

    except HTTPException as http_exc:
        # Откат транзакции уже произошел (или произойдет при выходе из `async with`)
        logger.error(f"[add_custom_inventory_item] HTTP Exception occurred: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.exception(f"[add_custom_inventory_item] Unexpected error adding custom item for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


class RequestItemPayload(BaseModel):
    category: str = Field(..., description="Category name for the requested item")
    item_name: str = Field(..., description="Name of the requested item")
    has_semifinished: bool = Field(False, description="Does the item have a semifinished component?")


@router.post(
    "/{chat_id}/request-item",
    status_code=status.HTTP_200_OK,
    summary="Request Item Addition Through Bot",
    description="Sends a request to add a new inventory item through the bot to the inventory management group.",
    tags=["Inventory", "Request Items"]
)
async def request_item_addition_through_bot(
    payload: RequestItemPayload,
    chat_id: str = Path(..., description="Telegram ID of the chef chat (group)"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Отправляет запрос на добавление товара через бота в группу инвентаризации.
    """
    logger.info(f"[request_item_addition_through_bot] POST /inventory/{chat_id}/request-item")
    
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[request_item_addition_through_bot] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        # 1. Получаем chef группу
        group = await get_group_by_telegram_id(db, group_telegram_id)
        
        if not group:
            logger.warning(f"[request_item_addition_through_bot] Group not found for chat_id: {chat_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

        if group.group_type != 'chef':
            logger.warning(f"[request_item_addition_through_bot] Item request denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Item requests can only be made from groups of type 'chef'")

        # 2. Получаем ID группы инвентаризации из метаданных
        metadata = group.json_metadata or {}
        inventory_management_group_id = metadata.get("inventory_management_group_id")
        
        if not inventory_management_group_id:
            logger.warning(f"[request_item_addition_through_bot] No inventory management group configured for chat_id: {chat_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Группа инвентаризации не настроена для этой chef группы"
            )

        # 3. Формируем запрос к боту
        bot_internal_base_url = os.getenv("BOT_INTERNAL_URL", "http://bot:8003")
        send_request_endpoint = f"{bot_internal_base_url}/internal/send_item_request"
        
        bot_payload = {
            "inventory_group_id": inventory_management_group_id,
            "chef_group_id": str(chat_id),
            "chef_group_title": group.title,
            "item_name": payload.item_name,
            "category": payload.category,
            "has_semifinished": payload.has_semifinished
        }

        # 4. Отправляем запрос боту
        logger.info(f"[request_item_addition_through_bot] Sending request to bot: {send_request_endpoint}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(send_request_endpoint, json=bot_payload)
                response.raise_for_status()
                
                response_data = response.json()
                sent_to_inventory_group = response_data.get("sent_to_inventory_group", False)
                
                logger.info(f"[request_item_addition_through_bot] Bot request successful for chat_id: {chat_id}, item: {payload.item_name}")
                
                return {
                    "success": True,
                    "message": "Запрос на добавление товара успешно отправлен",
                    "item_name": payload.item_name,
                    "category": payload.category,
                    "sent_to_inventory_group": sent_to_inventory_group,
                    "inventory_group_id": inventory_management_group_id
                }
                
            except httpx.RequestError as req_err:
                logger.error(f"[request_item_addition_through_bot] Request error while contacting bot: {req_err}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Не удалось связаться с ботом для отправки запроса"
                )
            except httpx.HTTPStatusError as status_err:
                logger.error(f"[request_item_addition_through_bot] Bot returned error status {status_err.response.status_code}: {status_err.response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Бот не смог обработать запрос на добавление товара"
                )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.exception(f"[request_item_addition_through_bot] Unexpected error for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.delete(
    "/{chat_id}/items",
    status_code=status.HTTP_200_OK,
    summary="Delete Inventory Item",
    description="Deletes an item from both the main inventory (`json_inventory`) and the custom additions (`json_inventory_additions`) for the group. Updates metadata if deleted from main inventory.",
    tags=["Inventory", "Custom Items"]
)
async def delete_inventory_item(
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    category: str = Query(..., description="Category name of the item to delete"),
    item_name: str = Query(..., description="Name of the item to delete"),
    # TODO: Добавить зависимость для проверки прав администратора
    db: AsyncSession = Depends(get_db_session)
):
    """
    Deletes an item definition and its data from the group's inventory and additions.
    """
    # Query parameters автоматически декодируются FastAPI
    category_decoded = category
    item_name_decoded = item_name
    
    logger.info(f"[delete_inventory_item] DELETE /inventory/{chat_id}/items?category={category_decoded}&item_name={item_name_decoded}")

    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[delete_inventory_item] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    deleted_from_inventory = False
    deleted_from_additions = False
    updated_metadata_for_notify = {} # Инициализируем для отправки NOTIFY

    try:
        async with db.begin(): # Используем транзакцию
            # Получаем группу с блокировкой для обновления
            group_query = select(Group).where(Group.group_id == group_telegram_id).with_for_update()
            group_result = await db.execute(group_query)
            group = group_result.scalar_one_or_none()

            if not group:
                logger.warning(f"[delete_inventory_item] Group not found for chat_id: {chat_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

            if group.group_type != 'chef':
                logger.warning(f"[delete_inventory_item] Delete item denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Items can only be deleted from groups of type 'chef'")

            # TODO: Проверка прав доступа пользователя (что он админ группы)

            # 1. Попытка удаления из основного инвентаря (json_inventory)
            inventory = group.json_inventory
            if inventory and isinstance(inventory, dict) and \
               category_decoded in inventory and isinstance(inventory[category_decoded], dict) and \
               item_name_decoded in inventory[category_decoded]:
                
                logger.info(f"[delete_inventory_item] Deleting '{item_name_decoded}' from category '{category_decoded}' in main inventory for chat {chat_id}.")
                del inventory[category_decoded][item_name_decoded]
                # Опционально: удалить пустую категорию
                if not inventory[category_decoded]:
                    logger.info(f"[delete_inventory_item] Category '{category_decoded}' became empty in main inventory, removing it.")
                    del inventory[category_decoded]
                
                group.json_inventory = inventory
                flag_modified(group, "json_inventory")
                deleted_from_inventory = True
            else:
                logger.info(f"[delete_inventory_item] Item '{item_name_decoded}' in category '{category_decoded}' not found in main inventory for chat {chat_id}.")

            # 2. Попытка удаления из добавлений (json_inventory_additions)
            additions = group.json_inventory_additions
            if additions and isinstance(additions, dict) and \
               category_decoded in additions and isinstance(additions[category_decoded], dict) and \
               item_name_decoded in additions[category_decoded]:
               
                logger.info(f"[delete_inventory_item] Deleting definition '{item_name_decoded}' from category '{category_decoded}' in additions for chat {chat_id}.")
                del additions[category_decoded][item_name_decoded]
                # Опционально: удалить пустую категорию
                if not additions[category_decoded]:
                    logger.info(f"[delete_inventory_item] Category '{category_decoded}' became empty in additions, removing it.")
                    del additions[category_decoded]

                group.json_inventory_additions = additions
                flag_modified(group, "json_inventory_additions")
                deleted_from_additions = True
            else:
                 logger.info(f"[delete_inventory_item] Item definition '{item_name_decoded}' in category '{category_decoded}' not found in additions for chat {chat_id}.")

            # 3. Проверка, было ли что-то удалено
            if not deleted_from_inventory and not deleted_from_additions:
                logger.warning(f"[delete_inventory_item] Item '{item_name_decoded}' in category '{category_decoded}' not found anywhere for chat {chat_id}. Raising 404.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail=f"Item '{item_name_decoded}' not found in category '{category_decoded}' for this group."
                )

            # 4. Обновление метаданных, если удалено из основного инвентаря
            metadata = group.json_metadata or {}
            if deleted_from_inventory:
                new_progress = calculate_inventory_progress_py(group.json_inventory)
                metadata['progress'] = new_progress
                metadata['lastUpdated'] = datetime.now().isoformat()
                group.json_metadata = metadata
                flag_modified(group, "json_metadata")
                logger.info(f"[delete_inventory_item] Metadata updated for chat {chat_id}: progress={new_progress}, lastUpdated set.")
            
            updated_metadata_for_notify = metadata # Сохраняем метаданные для отправки в NOTIFY

        # Транзакция успешно завершена (commit)
        logger.info(f"[delete_inventory_item] DB transaction committed for chat_id: {chat_id} after deleting '{item_name_decoded}'.")

    except HTTPException as http_exc:
        # Откат транзакции произойдет
        logger.error(f"[delete_inventory_item] HTTP Exception occurred: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        # Откат транзакции произойдет
        logger.exception(f"[delete_inventory_item] Error processing delete item request for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not delete item due to a server error")

    # 5. Отправка уведомления NOTIFY (после успешного коммита)
    try:
        pg_channel_name = "websocket_channel"
        notify_payload_dict = {
            "type": "inventory_updated", 
            "chat_id": str(chat_id),
            "metadata": updated_metadata_for_notify, # Отправляем актуальные метаданные
            # Не отправляем item_id/category при удалении, т.к. товара больше нет
        }
        notify_payload_json = json.dumps(notify_payload_dict, default=str)
        escaped_payload = notify_payload_json.replace("'", "''")

        # Проверка длины (на всякий случай)
        if len(escaped_payload) >= 7900:
             logger.warning(f"NOTIFY payload for deletion in chat_id {chat_id} is too long ({len(escaped_payload)} bytes). Sending minimal.")
             minimal_payload_dict = {"type": "inventory_updated", "chat_id": str(chat_id), "metadata": updated_metadata_for_notify}
             escaped_payload = json.dumps(minimal_payload_dict, default=str).replace("'", "''")

        async with AsyncSession(async_engine) as notify_db:
            sql_command = text(f"NOTIFY {pg_channel_name}, '{escaped_payload}'")
            await notify_db.execute(sql_command)
            await notify_db.commit() 
            logger.info(f"Successfully sent inventory delete NOTIFY to channel '{pg_channel_name}' for chat_id: {chat_id}. Payload length: {len(escaped_payload)}")

    except Exception as notify_error:
        logger.error(f"Failed to send PostgreSQL NOTIFY after item deletion for chat_id {chat_id}: {notify_error}", exc_info=True)

    # 6. Возвращаем ответ
    return {"message": f"Item '{item_name_decoded}' in category '{category_decoded}' deleted successfully."}
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---

# --- ЭНДПОИНТ ИСТОРИИ ---

# --- ЭНДПОИНТ ДЛЯ ГЕНЕРАЦИИ EXCEL (БЕЗ СКАЧИВАНИЯ) ---
@router.post(
    "/{chat_id}/excel",
    status_code=status.HTTP_200_OK,
    summary="Trigger Excel Report Generation for a Chat",
    description="Generates an Excel report of the current inventory for the chat and saves it server-side (or prepares it for the bot). Does not return the file directly.",
    tags=["Inventory", "Reports"]
)
async def trigger_excel_generation(
    background_tasks: BackgroundTasks, # Перемещаем background_tasks вперед
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session) # db теперь идет после
):
    logger.info(f"[trigger_excel_generation] POST /inventory/{chat_id}/excel")
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[trigger_excel_generation] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        # Получаем группу, её инвентарь и метаданные
        # Используем selectinload для метаданных, если они в отдельной таблице или нужны связанные данные
        group_query = select(Group) \
            .where(Group.group_id == group_telegram_id)
            # .options(selectinload(Group.metadata_relation)) # Пример, если метаданные связаны

        group_result = await db.execute(group_query)
        group = group_result.scalar_one_or_none()

        if not group:
            logger.warning(f"[trigger_excel_generation] Group not found for chat_id: {chat_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

        if group.group_type != 'chef':
            logger.warning(f"[trigger_excel_generation] Excel generation denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Excel reports can only be generated for groups of type 'chef'")

        # ---> ИСПОЛЬЗОВАНИЕ НОВОЙ ЛОГИКИ СЛИЯНИЯ ДЛЯ ПОЛУЧЕНИЯ АКТУАЛЬНОГО ИНВЕНТАРЯ <---
        # 1. Получаем основной инвентарь
        base_inventory = group.json_inventory
        
        # 2. Загружаем шаблон, если основной пуст
        if not base_inventory:
            logger.info(f"[trigger_excel_generation] Base inventory empty for {chat_id}, loading template.")
            try:
                base_inventory = await get_inventory_template()
            except HTTPException as e:
                logger.error(f"[trigger_excel_generation] Failed to load template for Excel: {e.detail}. Using empty inventory.")
                base_inventory = {}
            except Exception as e:
                logger.exception(f"[trigger_excel_generation] Unexpected error loading template for Excel. Using empty inventory.")
                base_inventory = {}
        else:
             # Работаем с копией
             base_inventory = json.loads(json.dumps(group.json_inventory))

        # 3. Получаем и сливаем добавления
        group_additions = group.json_inventory_additions or {}
        if group_additions:
            logger.info(f"[trigger_excel_generation] Merging additions for Excel generation for chat {chat_id}")
            for category, items in group_additions.items():
                if not isinstance(items, dict): continue
                if category not in base_inventory: base_inventory[category] = {}
                for item_name, item_data in items.items():
                    if not isinstance(item_data, dict): continue
                    if item_name not in base_inventory[category]:
                         new_item = {
                             "name": item_name,
                             "raw": {"quantity": 0, "filled": False, "isOutOfStock": False},
                             "itemType": "raw"
                         }
                         if item_data.get('has_semifinished') is True:
                             new_item["semifinished"] = {"quantity": 0, "filled": False}
                             new_item["itemType"] = "both"
                         base_inventory[category][item_name] = new_item
        
        final_inventory_data = base_inventory # Инвентарь для Excel
        # ---> КОНЕЦ ЛОГИКИ СЛИЯНИЯ <---

        inventory_metadata = group.json_metadata or {} # Используем актуальные метаданные из БД
        group_title = group.title

        # Проверяем, есть ли вообще данные для генерации
        if not final_inventory_data:
             logger.warning(f"[trigger_excel_generation] No inventory data found for chat_id: {chat_id} after merging. Cannot generate Excel.")
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No inventory data available to generate the report.")

        # Вызываем функцию генерации
        # --- ГЕНЕРАЦИЯ EXCEL-ФАЙЛА (логика вынесена в services/inventory/excel_generator.py) ---
        excel_content_stream = generate_inventory_excel(
            inventory_data=final_inventory_data,
            metadata=inventory_metadata,
            group_title=group_title
        )
        # --- КОНЕЦ ГЕНЕРАЦИИ ---

        # ---> ДОБАВЛЕНА ПРОВЕРКА НА ОШИБКУ ГЕНЕРАЦИИ <---
        if excel_content_stream is None:
            logger.error(f"[trigger_excel_generation] Excel generation function (_generate_excel_content) failed for chat_id: {chat_id}.")
            # Кидаем ошибку 500, так как генерация не удалась
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate Excel content (internal function error).")
        # ---> КОНЕЦ ПРОВЕРКИ <---

        # Проверяем, вернула ли функция генерации содержимое (можно оставить для доп. уверенности)
        excel_bytes = excel_content_stream.getvalue()
        if not excel_bytes:
             logger.error(f"[trigger_excel_generation] Excel generation function returned empty content (but not None) for chat_id: {chat_id}.")
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate Excel content (empty result).")

        # --- Логика сохранения файла на диск --- 
        # Определяем путь к общей папке
        # Используем переменную окружения или значение по умолчанию
        # ИЗМЕНЕНО: Путь теперь внутри /app/shared
        shared_folder_path = FilePath(os.getenv("SHARED_REPORTS_FOLDER", "/app/shared/inventory_reports")) # <-- ИЗМЕНЕНО
        shared_folder_path.mkdir(parents=True, exist_ok=True) # Создаем папку, если ее нет

        # Генерируем уникальное имя файла
        unique_filename = f"inventory_{chat_id}_{uuid.uuid4()}.xlsx"
        save_file_path = shared_folder_path / unique_filename
        absolute_file_path_str = str(save_file_path.resolve()) # Получаем абсолютный путь для передачи боту

        try:
            with open(save_file_path, "wb") as f:
                f.write(excel_bytes)
            logger.info(f"[trigger_excel_generation] Excel content for chat {chat_id} saved to: {save_file_path}")
        except Exception as save_err:
            logger.exception(f"[trigger_excel_generation] Failed to save Excel file to {save_file_path} for chat {chat_id}: {save_err}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save generated report.")
        # --- Конец логики сохранения на диск ---

        # --- Логика вызова бота --- 
        # Используем ту же переменную окружения и базовый URL, что и для табелей
        bot_internal_base_url = os.getenv("BOT_INTERNAL_URL", "http://bot:8003") 
        # Формируем полный URL для эндпоинта отправки Excel отчетов
        send_report_endpoint = f"{bot_internal_base_url}/internal/send_excel_report" 
        bot_payload = {
            "chat_id": str(chat_id), # Убедимся, что это строка
            "file_path": absolute_file_path_str # Передаем абсолютный путь к файлу
        }

        # Запускаем отправку запроса боту в фоновой задаче
        background_tasks.add_task(send_inventory_report_to_bot, send_report_endpoint, bot_payload, absolute_file_path_str)

        logger.info(f"[trigger_excel_generation] Excel generation process initiated for chat_id: {chat_id}. Bot notification task scheduled.")
        return {
            "status": "success",
            "message": "Запрос на формирование и отправку отчета получен. Бот скоро отправит файл в группу.",
            "chat_id": chat_id,
            # Убираем redis_key, т.к. он больше не используется
            # "redis_key": redis_key
            "file_path": absolute_file_path_str # Возвращаем путь к файлу (для отладки)
        }

    except HTTPException as http_exc:
        # Пробрасываем HTTP исключения, которые могли возникнуть при поиске группы или генерации
        raise http_exc
    except Exception as e:
        logger.exception(f"[trigger_excel_generation] Unexpected error generating Excel for chat_id: {chat_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during Excel generation.")

# Асинхронная функция для отправки запроса боту в фоне и удаления файла
async def send_inventory_report_to_bot(url: str, payload: dict, file_path_to_delete: str):
    """Отправляет отчет боту и удаляет временный файл."""
    logger.info(f"[BG Task - Inventory Report] Attempting to send request to bot. URL: {url}, Payload keys: {list(payload.keys())}")
    async with httpx.AsyncClient(timeout=60.0) as client: # Добавлен таймаут
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            logger.info(f"[BG Task - Inventory Report] Successful response from bot (status {response.status_code}) for report {payload.get('chat_id')}")
            # Удаляем временный файл после успешной отправки боту
            try:
                os.remove(file_path_to_delete)
                logger.info(f"[BG Task - Inventory Report] Temporary file {file_path_to_delete} deleted.")
            except OSError as unlink_err:
                logger.error(f"[BG Task - Inventory Report] Failed to delete temporary file {file_path_to_delete}: {unlink_err}")
        except httpx.RequestError as req_err:
            logger.error(f"[BG Task - Inventory Report] Request error while contacting bot at {url}: {req_err}")
        except httpx.HTTPStatusError as status_err:
            logger.error(f"[BG Task - Inventory Report] Bot returned an error status {status_err.response.status_code} for {url}. Response: {status_err.response.text}")
        except Exception as e:
            logger.exception(f"[BG Task - Inventory Report] Unexpected error sending request to bot ({url})") # Используем logger.exception

# ---> ДОБАВЛЕНИЕ: Новый эндпоинт для сброса инвентаризации <---
@router.post(
    "/{chat_id}/reset",
    status_code=status.HTTP_200_OK,
    summary="Reset Inventory Data for a Chat",
    description="Resets the inventory quantities and statuses for a specific chat, keeping the structure. Only for 'chef' groups.",
    tags=["Inventory"]
)
async def reset_inventory_for_chat(
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session),
    # TODO: Добавить зависимость для проверки прав администратора
):
    """
    Resets inventory quantities and statuses for a specific chat.
    Loads template if inventory is empty. Updates metadata and notifies.
    """
    logger.info(f"[reset_inventory_for_chat] POST /inventory/{chat_id}/reset")

    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[reset_inventory_for_chat] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    updated_metadata_for_notify = {} # Для отправки в NOTIFY

    try:
        async with db.begin(): # Используем транзакцию
            # Получаем группу с блокировкой для обновления
            group_query = select(Group).where(Group.group_id == group_telegram_id).with_for_update()
            group_result = await db.execute(group_query)
            group = group_result.scalar_one_or_none()

            if not group:
                logger.warning(f"[reset_inventory_for_chat] Group not found for chat_id: {chat_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")

            if group.group_type != 'chef':
                logger.warning(f"[reset_inventory_for_chat] Reset denied for chat_id: {chat_id}. Group type is '{group.group_type}', not 'chef'.")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory can only be reset for groups of type 'chef'")

            # TODO: Проверка прав доступа пользователя (что он админ группы)

            # 1. Получаем текущий инвентарь или шаблон
            inventory_to_reset = group.json_inventory
            if not inventory_to_reset:
                logger.info(f"[reset_inventory_for_chat] Inventory empty for chat {chat_id}. Loading template to reset.")
                try:
                    # Загружаем шаблон, чтобы иметь структуру для сброса
                    inventory_to_reset = await get_inventory_template()
                    # Сохранять шаблон здесь не обязательно, т.к. он будет сохранен после сброса
                except HTTPException as e:
                    logger.error(f"[reset_inventory_for_chat] Template not found, cannot reset inventory structure for chat {chat_id}: {e.detail}")
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Inventory template not found, cannot perform reset.")
                except Exception as e:
                    logger.exception(f"[reset_inventory_for_chat] Error loading template for chat {chat_id} during reset.")
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error loading inventory template during reset.")
            else:
                 # Работаем с копией, чтобы изменения были зафиксированы flag_modified
                 inventory_to_reset = json.loads(json.dumps(group.json_inventory))


            # 2. Обнуляем значения
            reset_count = 0
            if isinstance(inventory_to_reset, dict):
                for category_data in inventory_to_reset.values():
                    if not isinstance(category_data, dict): continue
                    for item_name, item_data in category_data.items():
                         if not isinstance(item_data, dict): continue

                         if 'raw' in item_data and isinstance(item_data['raw'], dict):
                             item_data['raw']['quantity'] = 0
                             item_data['raw']['filled'] = False
                             item_data['raw']['isOutOfStock'] = False
                             reset_count += 1
                         
                         if 'semifinished' in item_data and isinstance(item_data['semifinished'], dict):
                             item_data['semifinished']['quantity'] = 0
                             item_data['semifinished']['filled'] = False
                             # isOutOfStock обычно нет для полуфабрикатов
                             reset_count += 1 # Считаем сброс, если есть поле
            
            logger.info(f"[reset_inventory_for_chat] Reset {reset_count} item states for chat {chat_id}.")

            # 3. Сохраняем сброшенный инвентарь
            group.json_inventory = inventory_to_reset
            flag_modified(group, "json_inventory")

            # 4. Обновляем метаданные
            existing_metadata = group.json_metadata or {}
            # Создаем новый объект метаданных для корректного отслеживания изменений ORM
            updated_metadata = {
                **existing_metadata,  # Копируем существующие метаданные
                'progress': 0,
                'lastUpdated': datetime.now().isoformat(),
                'chat_id': chat_id
            }
            group.json_metadata = updated_metadata
            flag_modified(group, "json_metadata")
            updated_metadata_for_notify = updated_metadata # Сохраняем для NOTIFY
            logger.info(f"[reset_inventory_for_chat] Metadata updated for chat {chat_id}: progress=0, lastUpdated set.")

        # Транзакция успешно завершена (commit)
        logger.info(f"[reset_inventory_for_chat] DB transaction committed for chat_id: {chat_id} after reset.")

    except HTTPException as http_exc:
        # Откат транзакции произойдет автоматически
        logger.error(f"[reset_inventory_for_chat] HTTP Exception occurred during reset: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        # Откат транзакции произойдет автоматически
        logger.exception(f"[reset_inventory_for_chat] Error processing reset request for chat_id: {chat_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not reset inventory due to a server error")

    # 5. Отправка уведомления NOTIFY (после успешного коммита)
    if updated_metadata_for_notify: # Проверяем, что метаданные были обновлены
        try:
            pg_channel_name = "websocket_channel"
            notify_payload_dict = {
                "type": "inventory_reset", # Используем новый тип для ясности
                "chat_id": str(chat_id),
                "metadata": updated_metadata_for_notify,
                # При сбросе не передаем item_id/category/item
            }
            notify_payload_json = json.dumps(notify_payload_dict, default=str)
            escaped_payload = notify_payload_json.replace("'", "''")

            # Проверка длины (на всякий случай)
            if len(escaped_payload) >= 7900:
                 logger.warning(f"NOTIFY payload for reset in chat_id {chat_id} is too long ({len(escaped_payload)} bytes). Sending minimal.")
                 # Вряд ли метаданные будут такими большими, но оставим проверку
                 minimal_payload_dict = {"type": "inventory_reset", "chat_id": str(chat_id), "metadata": updated_metadata_for_notify}
                 escaped_payload = json.dumps(minimal_payload_dict, default=str).replace("'", "''")

            async with AsyncSession(async_engine) as notify_db:
                sql_command = text(f"NOTIFY {pg_channel_name}, '{escaped_payload}'")
                await notify_db.execute(sql_command)
                await notify_db.commit()
                logger.info(f"Successfully sent inventory reset NOTIFY to channel '{pg_channel_name}' for chat_id: {chat_id}. Payload length: {len(escaped_payload)}")

        except Exception as notify_error:
            logger.error(f"Failed to send PostgreSQL NOTIFY after inventory reset for chat_id {chat_id}: {notify_error}", exc_info=True)
    else:
         logger.warning(f"[reset_inventory_for_chat] Cannot send NOTIFY because updated metadata is missing for chat_id: {chat_id}")


    # 6. Возвращаем ответ
    return {"message": f"Inventory for chat {chat_id} has been reset successfully."}
# ---> КОНЕЦ ДОБАВЛЕНИЯ <---


# ---> НОВЫЙ ЭНДПОИНТ: Адаптер инвентаризации <---
@router.post(
    "/admin/adapt-accounting-excel",
    status_code=status.HTTP_200_OK,
    summary="Adapt Accounting Excel File",
    description="Uploads an Excel file from accounting department and adapts inventory templates automatically. Updates both inventory_template.json and excel_template.py with new items.",
    tags=["Inventory", "Admin", "Templates"]
)
async def adapt_accounting_excel(
    excel_file: UploadFile = File(..., description="Excel file from accounting department"),
    db: AsyncSession = Depends(get_db_session),
    # TODO: Добавить зависимость для проверки прав администратора
):
    """
    Обрабатывает Excel-файл от бухгалтерии и автоматически обновляет шаблоны инвентаризации.
    
    Процесс:
    1. Загружает и парсит Excel-файл
    2. Сопоставляет товары с существующими в системе
    3. Добавляет новые товары в шаблоны
    4. Возвращает подробный отчет о проделанной работе
    """
    logger.info(f"[adapt_accounting_excel] POST /inventory/admin/adapt-accounting-excel - файл: {excel_file.filename}")
    
    # Проверяем формат файла
    if not excel_file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Поддерживаются только Excel файлы (.xlsx, .xls)"
        )
    
    # Создаем временный файл
    temp_file_path = None
    try:
        # Создаем временный файл с уникальным именем
        temp_suffix = f"_{uuid.uuid4().hex[:8]}_{excel_file.filename}"
        temp_file = tempfile.NamedTemporaryFile(
            suffix=temp_suffix,
            delete=False,
            dir="/tmp"
        )
        temp_file_path = temp_file.name
        
        # Записываем содержимое загруженного файла
        content = await excel_file.read()
        temp_file.write(content)
        temp_file.close()
        
        logger.info(f"[adapt_accounting_excel] Временный файл создан: {temp_file_path}")
        
        # Инициализируем адаптер
        adapter = InventoryAdapter()
        
        # Обрабатываем файл
        logger.info(f"[adapt_accounting_excel] Запускаем адаптер для файла: {excel_file.filename}")
        result = adapter.process_accounting_excel(temp_file_path)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ошибка обработки файла: {result.get('error', 'Неизвестная ошибка')}"
            )
        
        # Формируем подробный ответ
        response = {
            "success": True,
            "message": "Excel-файл успешно обработан",
            "file_info": {
                "filename": excel_file.filename,
                "size_bytes": len(content)
            },
            "processing_results": {
                "total_items_found": result["total_items"],
                "existing_items_matched": result["exact_matches"],
                "new_items_added": result["new_items"],
                "removed_items": result.get("removed_items", 0)
            },
            "templates_updated": {
                "inventory_template_updated": result["templates_updated"]["inventory_template"],
                "excel_template_updated": result["templates_updated"]["excel_template"]
            },
            "synchronization": result.get("synchronization", {
                "is_synchronized": True,
                "needs_synchronization": False,
                "desynchronization_count": 0,
                "only_in_inventory": [],
                "only_in_excel": []
            }),
            "details": result.get("details", {})
        }
        
        # Логируем успешный результат
        logger.info(f"[adapt_accounting_excel] Файл {excel_file.filename} обработан успешно:")
        logger.info(f"  - Всего товаров: {result['total_items']}")
        logger.info(f"  - Существующих: {result['exact_matches']}")
        logger.info(f"  - Новых: {result['new_items']}")
        logger.info(f"  - Удаленных: {result.get('removed_items', 0)}")
        logger.info(f"  - Шаблоны обновлены: inventory={result['templates_updated']['inventory_template']}, excel={result['templates_updated']['excel_template']}")
        
        # Логируем информацию об удаленных товарах
        removed_items_details = result.get("details", {}).get("removed_items", [])
        if removed_items_details:
            logger.warning(f"🗑️ Удаленные товары:")
            for item in removed_items_details:
                logger.warning(f"  - {item.get('name')} (категория: {item.get('category')})")
        
        # Логируем информацию о синхронизации
        sync_info = result.get("synchronization", {})
        if sync_info.get("needs_synchronization", False):
            logger.warning(f"⚠️ Обнаружена рассинхронизация шаблонов:")
            if sync_info.get("only_in_inventory"):
                logger.warning(f"  - Только в inventory_template.json ({len(sync_info['only_in_inventory'])} товаров):")
                for item in sync_info["only_in_inventory"]:
                    logger.warning(f"    • {item}")
            if sync_info.get("only_in_excel"):
                logger.warning(f"  - Только в excel_template.py ({len(sync_info['only_in_excel'])} товаров):")
                for item in sync_info["only_in_excel"]:
                    logger.warning(f"    • {item}")
        else:
            logger.info("✅ Шаблоны синхронизированы")
        
        # Отправляем WebSocket уведомление и автоматически синхронизируем все группы
        if result['templates_updated']['inventory_template']:
            # Автоматически синхронизируем все группы с новым шаблоном
            logger.info("🔄 Начинаем автоматическую синхронизацию всех групп с новым шаблоном...")
            sync_result = await sync_all_groups_with_template(db)
            
            if sync_result.get("success"):
                logger.info(f"✅ Автоматическая синхронизация завершена: {sync_result.get('groups_updated', 0)} групп обновлено, {sync_result.get('total_changes', 0)} изменений")
                # Добавляем информацию о синхронизации в response
                response["auto_sync"] = {
                    "performed": True,
                    "groups_processed": sync_result.get("groups_processed", 0),
                    "groups_updated": sync_result.get("groups_updated", 0),
                    "total_changes": sync_result.get("total_changes", 0)
                }
            else:
                logger.error(f"❌ Ошибка автоматической синхронизации: {sync_result.get('error', 'Unknown error')}")
                response["auto_sync"] = {
                    "performed": False,
                    "error": sync_result.get("error", "Unknown error")
                }
            
            # Отправляем WebSocket уведомление
            await send_template_updated_notification(db, result)
            logger.info("📡 WebSocket уведомление о обновлении шаблона отправлено")
        
        return response
        
    except HTTPException:
        # Пробрасываем HTTP исключения как есть
        raise
    except Exception as e:
        logger.exception(f"[adapt_accounting_excel] Неожиданная ошибка при обработке файла {excel_file.filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при обработке файла: {str(e)}"
        )
    finally:
        # Удаляем временный файл
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"[adapt_accounting_excel] Временный файл удален: {temp_file_path}")
            except OSError as e:
                logger.error(f"[adapt_accounting_excel] Ошибка удаления временного файла {temp_file_path}: {e}")


# Дополнительный эндпоинт для получения отчета адаптации
@router.get(
    "/admin/adaptation-status",
    summary="Get Adaptation Status",
    description="Returns the current status and statistics of template adaptations.",
    tags=["Inventory", "Admin", "Templates"]
)
async def get_adaptation_status():
    """
    Возвращает статистику по адаптациям шаблонов.
    """
    try:
        # Читаем текущие шаблоны для статистики
        template_path = "/app/data/templates/inventory_template.json"
        
        total_categories = 0
        total_items = 0
        
        if os.path.exists(template_path):
            with open(template_path, 'r', encoding='utf-8') as f:
                template_data = json.load(f)
                total_categories = len(template_data)
                for category_items in template_data.values():
                    if isinstance(category_items, dict):
                        total_items += len(category_items)
        
        return {
            "status": "active",
            "template_statistics": {
                "total_categories": total_categories,
                "total_items": total_items,
                "template_file_exists": os.path.exists(template_path),
                "last_modified": datetime.fromtimestamp(os.path.getmtime(template_path)).isoformat() if os.path.exists(template_path) else None
            },
            "adapter_info": {
                "version": "1.0.0",
                "supported_formats": [".xlsx", ".xls"],
                "max_file_size_mb": 10
            }
        }
        
    except Exception as e:
        logger.exception(f"[get_adaptation_status] Ошибка получения статуса адаптации: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения статуса адаптации"
        )

# ---> НОВЫЕ ЭНДПОИНТЫ ДЛЯ СИНХРОНИЗАЦИИ ШАБЛОНОВ <---
@router.get(
    "/admin/synchronization-status",
    summary="Check Template Synchronization Status",
    description="Checks synchronization status between inventory_template.json and excel_template.py",
    tags=["Inventory", "Admin", "Templates"]
)
async def check_synchronization_status():
    """
    Проверяет состояние синхронизации между шаблонами инвентаризации.
    """
    try:
        logger.info("[check_synchronization_status] Проверяем синхронизацию шаблонов")
        
        # Создаем адаптер для проверки синхронизации
        adapter = InventoryAdapter()
        
        # Проверяем синхронизацию
        sync_status = adapter.check_template_synchronization()
        
        if sync_status.get("error"):
            logger.error(f"[check_synchronization_status] Ошибка: {sync_status['error']}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error checking synchronization: {sync_status['error']}"
            )
        
        return {
            "success": True,
            "synchronization": sync_status,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"[check_synchronization_status] Ошибка проверки синхронизации: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking synchronization status: {str(e)}"
        )

@router.post(
    "/admin/synchronize-templates",
    status_code=status.HTTP_200_OK,
    summary="Synchronize Templates",
    description="Synchronizes inventory_template.json and excel_template.py by adding missing items to each template",
    tags=["Inventory", "Admin", "Templates"]
)
async def synchronize_templates():
    """
    Синхронизирует шаблоны инвентаризации, добавляя недостающие товары в каждый шаблон.
    """
    try:
        logger.info("[synchronize_templates] Запуск синхронизации шаблонов")
        
        # Создаем адаптер для синхронизации
        adapter = InventoryAdapter()
        
        # Выполняем синхронизацию
        sync_result = adapter.synchronize_templates()
        
        if not sync_result.get("success"):
            logger.error(f"[synchronize_templates] Ошибка синхронизации: {sync_result.get('error')}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Synchronization failed: {sync_result.get('error')}"
            )
        
        logger.info(f"[synchronize_templates] Синхронизация завершена: {sync_result}")
        
        return {
            "success": True,
            "message": sync_result.get("message", "Синхронизация завершена"),
            "changes_made": sync_result.get("changes_made", False),
            "details": {
                "before": sync_result.get("before", {}),
                "after": sync_result.get("after", {})
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"[synchronize_templates] Ошибка синхронизации: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error synchronizing templates: {str(e)}"
        )

# ---> НОВЫЙ ЭНДПОИНТ ДЛЯ ОТМЕТКИ ИЗМЕНЕНИЙ КАК ПРОСМОТРЕННЫЕ <---

@router.post(
    "/{chat_id}/mark-template-changes-viewed",
    status_code=status.HTTP_200_OK,
    summary="Mark Template Changes as Viewed",
    description="Marks the latest template changes as viewed by the user for this chat.",
    tags=["Inventory", "Templates"]
)
async def mark_template_changes_viewed(
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session),
    # TODO: Добавить зависимость для проверки авторизации пользователя
):
    """
    Отмечает последние изменения шаблона как просмотренные пользователем
    """
    logger.info(f"[mark_template_changes_viewed] POST /inventory/{chat_id}/mark-template-changes-viewed")
    
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[mark_template_changes_viewed] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        # Получаем группу
        group = await get_group_by_telegram_id(db, group_telegram_id)
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")
        
        if group.group_type != 'chef':
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Template changes are only available for chef groups")
        
        # Проверяем, есть ли информация о последних изменениях
        if not group.json_metadata:
            group.json_metadata = {}
        
        if "lastTemplateUpdate" in group.json_metadata:
            # Отмечаем изменения как просмотренные
            group.json_metadata["lastTemplateUpdate"]["viewed"] = True
            group.json_metadata["lastTemplateUpdate"]["viewedAt"] = datetime.now().isoformat()
            flag_modified(group, "json_metadata")
            
            await db.commit()
            
            logger.info(f"[mark_template_changes_viewed] Template changes marked as viewed for chat {chat_id}")
            return {
                "status": "success",
                "message": "Template changes marked as viewed",
                "chat_id": chat_id,
                "viewed_at": group.json_metadata["lastTemplateUpdate"]["viewedAt"]
            }
        else:
            logger.info(f"[mark_template_changes_viewed] No template changes to mark as viewed for chat {chat_id}")
            return {
                "status": "success",
                "message": "No template changes to mark as viewed",
                "chat_id": chat_id
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[mark_template_changes_viewed] Error marking template changes as viewed for chat {chat_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error marking template changes as viewed")

# ---> КОНЕЦ НОВЫХ ЭНДПОИНТОВ <---

@router.post(
    "/{chat_id}/sync-template",
    status_code=status.HTTP_200_OK,
    summary="Synchronize Chat Inventory with Template",
    description="Synchronizes the chat's inventory with the current template. Adds new items, removes obsolete ones (if not filled), keeps filled data.",
    tags=["Inventory", "Templates"]
)
async def sync_chat_with_template(
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    db: AsyncSession = Depends(get_db_session),
    # TODO: Добавить зависимость для проверки прав администратора
):
    """
    Синхронизирует инвентарь чата с актуальным шаблоном inventory_template.json
    
    Логика:
    1. Загружает актуальный шаблон
    2. Загружает текущий инвентарь чата
    3. Выполняет умный мерж:
       - Добавляет новые позиции из шаблона (quantity=0, filled=false)
       - Удаляет позиции, которых нет в шаблоне (только если quantity=0 и filled=false)
       - Сохраняет заполненные позиции
    4. Обновляет БД
    5. Возвращает отчет об изменениях
    """
    logger.info(f"[sync_chat_with_template] POST /inventory/{chat_id}/sync-template")
    
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        logger.error(f"[sync_chat_with_template] Invalid chat_id format: {chat_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    try:
        # 1. Получаем группу из БД
        group = await get_group_by_telegram_id(db, group_telegram_id)
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")
        
        if group.group_type != 'chef':
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory sync is only available for chef groups")
        
        # 2. Загружаем шаблон
        template_path = "/app/data/templates/inventory_template.json"
        if not os.path.exists(template_path):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Template file not found")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = json.load(f)
        
        # 3. Получаем текущий инвентарь чата
        current_inventory = group.json_inventory or {}
        
        # 4. Выполняем умный мерж
        sync_report = perform_smart_merge(current_inventory, template_data)
        updated_inventory = sync_report["merged_inventory"]
        
        # 5. Сохраняем обновленный инвентарь в БД
        group.json_inventory = updated_inventory
        flag_modified(group, "json_inventory")
        
        # 6. Обновляем метаданные
        now = datetime.now().isoformat()
        if not group.json_metadata:
            group.json_metadata = {}
        group.json_metadata["lastUpdated"] = now
        group.json_metadata["lastSynced"] = now
        group.json_metadata["progress"] = calculate_inventory_progress_py(updated_inventory)
        flag_modified(group, "json_metadata")
        
        await db.commit()
        
        logger.info(f"[sync_chat_with_template] Successfully synchronized inventory for chat {chat_id}")
        
        return {
            "status": "success",
            "message": "Inventory synchronized with template",
            "chat_id": chat_id,
            "changes": sync_report["changes"],
            "summary": {
                "added_items": len(sync_report["changes"]["added"]),
                "removed_items": len(sync_report["changes"]["removed"]),
                "preserved_items": len(sync_report["changes"]["preserved"])
            },
            "updated_at": now
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[sync_chat_with_template] Error synchronizing inventory for chat {chat_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error synchronizing inventory: {str(e)}")


def perform_smart_merge(current_inventory: Dict[str, Any], template_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет умный мерж текущего инвентаря с шаблоном
    
    Args:
        current_inventory: Текущий инвентарь из БД
        template_data: Новый шаблон из inventory_template.json
        
    Returns:
        Dict с merged_inventory и changes
    """
    merged_inventory = {}
    changes = {
        "added": [],      # Новые позиции
        "removed": [],    # Удаленные позиции  
        "preserved": []   # Сохраненные позиции
    }
    
    # Обрабатываем каждую категорию из шаблона
    for category_name, template_items in template_data.items():
        merged_inventory[category_name] = {}
        current_category = current_inventory.get(category_name, {})
        
        # Добавляем/обновляем позиции из шаблона
        for item_name, template_item in template_items.items():
            if item_name in current_category:
                # Позиция существует - сохраняем данные пользователя
                merged_inventory[category_name][item_name] = current_category[item_name]
                changes["preserved"].append(f"{category_name} → {item_name}")
            else:
                # Новая позиция - добавляем из шаблона
                merged_inventory[category_name][item_name] = template_item
                changes["added"].append(f"{category_name} → {item_name}")
    
    # Проверяем на удаленные позиции (есть в current, но нет в template)
    for category_name, current_items in current_inventory.items():
        if category_name not in template_data:
            # Вся категория удалена из шаблона
            for item_name, item_data in current_items.items():
                if is_item_empty(item_data):
                    changes["removed"].append(f"{category_name} → {item_name} (empty)")
                else:
                    # Сохраняем заполненные позиции даже если категории нет в шаблоне
                    if category_name not in merged_inventory:
                        merged_inventory[category_name] = {}
                    merged_inventory[category_name][item_name] = item_data
                    changes["preserved"].append(f"{category_name} → {item_name} (filled, kept despite template)")
        else:
            # Категория есть в шаблоне, проверяем позиции
            template_items = template_data[category_name]
            for item_name, item_data in current_items.items():
                if item_name not in template_items:
                    # Позиция удалена из шаблона
                    if is_item_empty(item_data):
                        changes["removed"].append(f"{category_name} → {item_name} (empty)")
                    else:
                        # Сохраняем заполненную позицию
                        merged_inventory[category_name][item_name] = item_data
                        changes["preserved"].append(f"{category_name} → {item_name} (filled, kept despite template)")
    
    return {
        "merged_inventory": merged_inventory,
        "changes": changes
    }


def is_item_empty(item_data: Dict[str, Any]) -> bool:
    """
    Проверяет, пуста ли позиция инвентаря (можно безопасно удалить)
    
    Args:
        item_data: Данные позиции {"raw": {...}, "semifinished": {...}}
        
    Returns:
        True если позиция пуста и может быть удалена
    """
    # Проверяем raw часть
    raw = item_data.get("raw", {})
    if raw.get("filled") or raw.get("quantity", 0) > 0 or raw.get("isOutOfStock"):
        return False
    
    # Проверяем semifinished часть если есть
    semifinished = item_data.get("semifinished", {})
    if semifinished.get("filled") or semifinished.get("quantity", 0) > 0:
        return False
    
    return True


async def sync_all_groups_with_template(db: AsyncSession) -> Dict[str, Any]:
    """
    Синхронизирует все группы типа 'chef' с актуальным шаблоном
    
    Args:
        db: Сессия базы данных
        
    Returns:
        Dict с результатами синхронизации
    """
    try:
        from sqlalchemy import select
        from models.group import Group
        
        # Получаем все группы типа 'chef'
        result = await db.execute(select(Group).where(Group.group_type == 'chef'))
        chef_groups = result.scalars().all()
        
        if not chef_groups:
            logger.info("[sync_all_groups_with_template] Нет групп типа 'chef' для синхронизации")
            return {
                "success": True,
                "message": "Нет групп для синхронизации",
                "groups_processed": 0,
                "groups_updated": 0,
                "total_changes": 0
            }
        
        # Загружаем шаблон
        template_path = "/app/data/templates/inventory_template.json"
        if not os.path.exists(template_path):
            logger.error("[sync_all_groups_with_template] Файл шаблона не найден")
            return {
                "success": False,
                "error": "Template file not found"
            }
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = json.load(f)
        
        sync_summary = {
            "success": True,
            "groups_processed": 0,
            "groups_updated": 0,
            "total_changes": 0,
            "groups_details": []
        }
        
        # Синхронизируем каждую группу
        for group in chef_groups:
            try:
                logger.info(f"[sync_all_groups_with_template] Синхронизация группы {group.group_id}")
                
                # Получаем текущий инвентарь
                current_inventory = group.json_inventory or {}
                
                # Выполняем умный мерж
                sync_report = perform_smart_merge(current_inventory, template_data)
                updated_inventory = sync_report["merged_inventory"]
                
                # Проверяем, есть ли изменения
                changes_count = len(sync_report["changes"]["added"]) + len(sync_report["changes"]["removed"])
                
                if changes_count > 0:
                    # Сохраняем обновленный инвентарь
                    group.json_inventory = updated_inventory
                    flag_modified(group, "json_inventory")
                    
                    # Обновляем метаданные
                    now = datetime.now().isoformat()
                    if not group.json_metadata:
                        group.json_metadata = {}
                    group.json_metadata["lastUpdated"] = now
                    group.json_metadata["lastSynced"] = now
                    group.json_metadata["progress"] = calculate_inventory_progress_py(updated_inventory)
                    
                    # 🆕 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ПОСЛЕДНИХ ИЗМЕНЕНИЯХ ДЛЯ УВЕДОМЛЕНИЙ
                    group.json_metadata["lastTemplateUpdate"] = {
                        "timestamp": now,
                        "changes": {
                            "added": sync_report["changes"]["added"],
                            "removed": sync_report["changes"]["removed"],
                            "added_count": len(sync_report["changes"]["added"]),
                            "removed_count": len(sync_report["changes"]["removed"])
                        },
                        "viewed": False  # Флаг, что изменения не просмотрены
                    }
                    
                    flag_modified(group, "json_metadata")
                    
                    sync_summary["groups_updated"] += 1
                    sync_summary["total_changes"] += changes_count
                    
                    logger.info(f"[sync_all_groups_with_template] Группа {group.group_id}: {changes_count} изменений")
                else:
                    logger.info(f"[sync_all_groups_with_template] Группа {group.group_id}: без изменений")
                
                sync_summary["groups_processed"] += 1
                sync_summary["groups_details"].append({
                    "group_id": group.group_id,
                    "changes_count": changes_count,
                    "added": len(sync_report["changes"]["added"]),
                    "removed": len(sync_report["changes"]["removed"]),
                    "preserved": len(sync_report["changes"]["preserved"])
                })
                
            except Exception as e:
                logger.error(f"[sync_all_groups_with_template] Ошибка синхронизации группы {group.group_id}: {e}")
                sync_summary["groups_details"].append({
                    "group_id": group.group_id,
                    "error": str(e)
                })
        
        # Сохраняем изменения в БД
        await db.commit()
        
        logger.info(f"[sync_all_groups_with_template] Синхронизация завершена: {sync_summary['groups_processed']} групп обработано, {sync_summary['groups_updated']} обновлено, {sync_summary['total_changes']} изменений")
        
        return sync_summary
        
    except Exception as e:
        logger.error(f"[sync_all_groups_with_template] Ошибка автоматической синхронизации: {e}")
        return {
            "success": False,
            "error": str(e)
        }

async def send_template_updated_notification(db: AsyncSession, adaptation_result: Dict[str, Any]):
    """
    Отправляет WebSocket уведомление о том, что шаблон инвентаря был обновлен
    
    Args:
        db: Сессия базы данных
        adaptation_result: Результат адаптации шаблона
    """
    try:
        # Формируем payload для WebSocket события
        notification_payload = {
            "type": "template_updated",
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_items": adaptation_result.get("total_items", 0),
                "new_items": adaptation_result.get("new_items", 0),
                "removed_items": adaptation_result.get("removed_items", 0),
                "inventory_template_updated": adaptation_result.get("templates_updated", {}).get("inventory_template", False),
                "excel_template_updated": adaptation_result.get("templates_updated", {}).get("excel_template", False)
            },
            "details": {
                "new_items_list": [item.get("name") for item in adaptation_result.get("details", {}).get("new_items", [])],
                "removed_items_list": [item.get("name") for item in adaptation_result.get("details", {}).get("removed_items", [])]
            }
        }
        
        # Отправляем PostgreSQL NOTIFY
        notification_json = json.dumps(notification_payload)
        await db.execute(text("SELECT pg_notify('websocket_channel', :payload)"), {"payload": notification_json})
        
        logger.info(f"[send_template_updated_notification] WebSocket уведомление отправлено: {adaptation_result.get('new_items', 0)} новых, {adaptation_result.get('removed_items', 0)} удаленных товаров")
        
    except Exception as e:
        logger.error(f"[send_template_updated_notification] Ошибка отправки WebSocket уведомления: {e}")
        # Не поднимаем исключение, чтобы не прерывать основной процесс

# ---> КОНЕЦ НОВЫХ ЭНДПОИНТОВ <---


# --- НОВЫЙ ЭНДПОИНТ: точечное обновление одного товара ---
@router.put(
    "/{chat_id}/items/{category}/{item_id:path}",
    summary="Update single inventory item",
    description="Updates a single item inside inventory JSON, optionally writes history and emits NOTIFY.",
    tags=["Inventory"]
)
async def update_inventory_item_point(
    payload: InventoryItemUpdatePayload,
    chat_id: str = Path(..., description="Telegram ID of the chat (group)"),
    category: str = Path(..., description="Inventory category name"),
    item_id: str = Path(..., description="Inventory item id (name) (can contain slashes)"),
    db: AsyncSession = Depends(get_db_session),
    redis_client: redis.Redis = Depends(get_redis_client)
):
    logger.info(f"[update_inventory_item_point] PUT /inventory/{chat_id}/items/{category}/{item_id}")
    try:
        group_telegram_id = int(chat_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid chat ID format")

    updated_inventory_for_response: Dict[str, Any] = {}
    updated_metadata_for_response: Dict[str, Any] = {}
    group_title_for_response: str | None = None
    saved_group_id: int | None = None
    previous_item_snapshot: Dict[str, Any] | None = None

    try:
        async with db.begin():
            group_query = select(Group).where(Group.group_id == group_telegram_id).with_for_update()
            group_result = await db.execute(group_query)
            group = group_result.scalar_one_or_none()

            if not group:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat with ID {chat_id} not found")
            if group.group_type != 'chef':
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inventory data can only be updated for groups of type 'chef'")

            saved_group_id = group.id
            group_title_for_response = group.title

            current_inventory = group.json_inventory or {}
            # Сохраняем предыдущую версию товара для истории
            if isinstance(current_inventory.get(category), dict) and item_id in current_inventory.get(category, {}):
                previous_item_snapshot = json.loads(json.dumps(current_inventory[category][item_id]))

            # Обновляем один товар (проставляем серверный timestamp)
            new_inventory = json.loads(json.dumps(current_inventory))
            if category not in new_inventory or not isinstance(new_inventory.get(category), dict):
                new_inventory[category] = {}
            server_now = datetime.now(timezone.utc).isoformat()
            if isinstance(payload.item, dict):
                payload.item["lastUpdated"] = server_now
            new_inventory[category][item_id] = payload.item
            group.json_inventory = new_inventory
            updated_inventory_for_response = group.json_inventory

            # Пересчитываем прогресс
            calculated_progress = calculate_inventory_progress_py(new_inventory)

            # Метаданные (UTC, сохраняем остальные поля)
            existing_metadata = group.json_metadata or {}
            # Инкрементируем версию
            try:
                current_version = int(existing_metadata.get("version", 0))
            except Exception:
                current_version = 0
            updated_metadata = {
                **existing_metadata,
                "progress": calculated_progress,
                "lastUpdated": server_now,
                "chat_id": chat_id,
                "version": current_version + 1
            }
            group.json_metadata = updated_metadata
            updated_metadata_for_response = group.json_metadata

            # Запись истории (если передана)
            if payload.history and isinstance(payload.history, dict):
                history_data = payload.history
                item_type = history_data.get('itemType')
                if item_type not in ['raw', 'semifinished']:
                    # Определяем по данным товара
                    if isinstance(payload.item, dict):
                        if payload.item.get('raw'):
                            item_type = 'raw'
                        elif payload.item.get('semifinished'):
                            item_type = 'semifinished'
                if item_type is None:
                    item_type = 'raw'

                def _q(obj: Dict[str, Any] | None, kind: str) -> float:
                    if not isinstance(obj, dict):
                        return 0.0
                    node = obj.get(kind)
                    if isinstance(node, dict):
                        try:
                            return float(node.get('quantity') or 0)
                        except Exception:
                            return 0.0
                    return 0.0

                old_q = history_data.get('oldQuantity') if 'oldQuantity' in history_data else _q(previous_item_snapshot, item_type)
                new_q = history_data.get('newQuantity') if 'newQuantity' in history_data else _q(payload.item, item_type)
                action = history_data.get('action') or ('add' if old_q == 0 and new_q > 0 else ('remove' if old_q > 0 and new_q == 0 else 'update'))

                # Не пишем историю при восстановлении из «нет в наличии», когда количество фактически не меняется (0 -> 0)
                try:
                    prev_oos = bool(previous_item_snapshot.get('raw', {}).get('isOutOfStock')) if isinstance(previous_item_snapshot, dict) else False
                    new_oos = bool(payload.item.get('raw', {}).get('isOutOfStock')) if isinstance(payload.item, dict) else False
                except Exception:
                    prev_oos = False
                    new_oos = False

                if item_type == 'raw' and prev_oos is True and new_oos is False and old_q == 0 and new_q == 0:
                    # Восстановление из OOS без изменения количества — пропускаем запись истории
                    logger.info(f"[update_inventory_item_point] Skip history: restore from out_of_stock for {category}/{item_id} (0 -> 0)")
                else:
                    author_member_id = history_data.get('authorMemberId')
                    member_db_id = None
                    if author_member_id:
                        member_query = select(Member.id).where(Member.user_id == author_member_id)
                        member_result = await db.execute(member_query)
                        member_db_id = member_result.scalar_one_or_none()

                    history_record = InventoryHistory(
                        group_id=group.id,
                        category=category,
                        item_name=item_id,
                        action=action,
                        type=item_type,
                        old_quantity=old_q,
                        new_quantity=new_q,
                        author_id=member_db_id
                    )
                    db.add(history_record)

        logger.info(f"[update_inventory_item_point] DB transaction committed for chat_id: {chat_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[update_inventory_item_point] Error during DB transaction for chat_id: {chat_id}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update inventory item")

    # Отправляем NOTIFY
    try:
        # Декодируем параметры для WebSocket (на случай если FastAPI не декодировал полностью)
        from urllib.parse import unquote
        decoded_item_id = unquote(item_id)
        decoded_category = unquote(category)
        
        logger.info(f"[update_inventory_item_point] WebSocket params: category={category} -> {decoded_category}, item_id={item_id} -> {decoded_item_id}")
        
        notify_payload = {
            "type": "inventory_updated",
            "chat_id": str(chat_id),
            "metadata": updated_metadata_for_response,
            "item_id": decoded_item_id,
            "category": decoded_category,
            "item": { **payload.item, **({"lastUpdated": updated_metadata_for_response.get("lastUpdated")} if isinstance(payload.item, dict) else {}) }
        }
        try:
            notify_payload["event_id"] = str(uuid.uuid4())
        except Exception:
            pass
        notify_payload_json = json.dumps(notify_payload, default=str)
        escaped_payload = notify_payload_json.replace("'", "''")
        async with AsyncSession(async_engine) as notify_db:
            sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
            await notify_db.execute(sql_command)
            await notify_db.commit()
        logger.info(f"[update_inventory_item_point] Sent NOTIFY to websocket_channel for chat_id={chat_id}")
    except Exception as e:
        logger.error(f"[update_inventory_item_point] Failed to send NOTIFY: {e}")

    # Инвалидация кэша Redis
    try:
        if redis_client:
            await redis_client.delete(f"inventory:{chat_id}")
            logger.info(f"[update_inventory_item_point] Invalidated cache inventory:{chat_id}")
    except Exception as e:
        logger.error(f"[update_inventory_item_point] Failed to invalidate cache for chat {chat_id}: {e}")

    # Формируем ответ
    try:
        admins_list_of_dicts = []
        if saved_group_id:
            admins_query = (
                select(Member)
                .join(GroupMember, GroupMember.member_id == Member.id)
                .where(
                    GroupMember.group_id == saved_group_id,
                    GroupMember.role.in_(['administrator', 'creator'])
                )
            )
            admins_result = await db.execute(admins_query)
            admins = admins_result.scalars().all()
            for admin in admins:
                admins_list_of_dicts.append({
                    "id": admin.id,
                    "user_id": admin.user_id,
                    "first_name": admin.first_name,
                    "last_name": admin.last_name,
                    "username": admin.username,
                    "photo_url": str(admin.photo_url) if admin.photo_url else None
                })

        # Декодируем ключи инвентаря перед отправкой фронтенду (симметрично GET эндпоинту)
        from urllib.parse import unquote
        decoded_inventory_for_response: dict[str, dict] = {}
        try:
            if isinstance(updated_inventory_for_response, dict):
                for category_key, items in updated_inventory_for_response.items():
                    try:
                        decoded_category_key = unquote(category_key)
                        if '%' in decoded_category_key:
                            decoded_category_key = unquote(decoded_category_key)
                    except Exception:
                        decoded_category_key = category_key

                    decoded_inventory_for_response[decoded_category_key] = {}

                    if isinstance(items, dict):
                        for item_key, item_value in items.items():
                            try:
                                decoded_item_key = unquote(item_key)
                                if '%' in decoded_item_key:
                                    decoded_item_key = unquote(decoded_item_key)
                            except Exception:
                                decoded_item_key = item_key

                            decoded_inventory_for_response[decoded_category_key][decoded_item_key] = item_value
                    else:
                        decoded_inventory_for_response[decoded_category_key] = items
            else:
                decoded_inventory_for_response = updated_inventory_for_response
        except Exception:
            # В случае любой ошибки декодирования возвращаем как есть
            decoded_inventory_for_response = updated_inventory_for_response

        return {
            "inventory": decoded_inventory_for_response,
            "metadata": updated_metadata_for_response,
            "chat_title": group_title_for_response or str(chat_id),
            "admins": admins_list_of_dicts
        }
    except Exception as e:
        logger.error(f"[update_inventory_item_point] Failed to build response: {e}")
        return {
            "inventory": updated_inventory_for_response,
            "metadata": updated_metadata_for_response,
            "chat_title": group_title_for_response or str(chat_id),
            "admins": []
        }
