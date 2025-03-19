import os
import json
import logging
import aiohttp
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from telegram import Update, ChatMember, Bot, Chat, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, BotCommand, MenuButton, MenuButtonWebApp
from telegram.constants import ChatMemberStatus, MenuButtonType
from telegram.ext import ContextTypes, MessageHandler, filters, ChatMemberHandler, CommandHandler, Application, CallbackQueryHandler
from telegramNinjaBot.services.json_service import JsonService
from telegramNinjaBot.services.courier_group_service import CourierGroupService
from typing import Optional, List, Dict, Union, Any
import random
import time
import telegram.error
import httpx
import aiofiles
import asyncio
from telegramNinjaBot.config.config import Config
import traceback

logger = logging.getLogger(__name__)

def get_member_status(member: ChatMember) -> str:
    """Получает статус участника в читаемом формате"""
    status_map = {
        'creator': 'creator',
        'administrator': 'administrator',
        'member': 'member',
        'restricted': 'restricted',
        'left': 'left',
        'kicked': 'banned',
        'banned': 'banned'
    }
    return status_map.get(member.status, str(member.status).lower())

class GroupHandler:
    def __init__(self, application: Application, json_service: JsonService):
        """Инициализация обработчика групповых событий"""
        self.application = application
        self.json_service = json_service
        self.courier_service = CourierGroupService(self.json_service.data_dir)
        self.bot_id = None  # Инициализируем как None
        self.photo_cache = {}  # Инициализируем кэш фотографий
        self.processed_groups_file = os.path.join(self.json_service.data_dir, 'processed_groups.json')
        
        # Регистрируем обработчики
        self._register_handlers()
        
        logger.info("✅ GroupHandler инициализирован")
    
    def _load_processed_groups(self) -> set:
        """Загрузка списка обработанных групп из файла"""
        try:
            if os.path.exists(self.processed_groups_file):
                with open(self.processed_groups_file, 'r', encoding='utf-8') as f:
                    return set(json.load(f))
            return set()
        except Exception as e:
            logger.error(f"Ошибка при загрузке списка обработанных групп: {str(e)}")
            return set()

    def _save_processed_groups(self, groups: set) -> None:
        """Сохранение списка обработанных групп в файл"""
        try:
            with open(self.processed_groups_file, 'w', encoding='utf-8') as f:
                json.dump(list(groups), f)
        except Exception as e:
            logger.error(f"Ошибка при сохранении списка обработанных групп: {str(e)}")

    async def initialize(self):
        """Инициализация дополнительных параметров после полной инициализации бота"""
        try:
            # Инициализируем сервис для групп курьеров
            self.courier_service = CourierGroupService(self.json_service.data_dir)
            
            # Создаем и настраиваем HTTP-клиент для бота
            self.http_client = None
            
            # Инициализируем кэш фотографий
            self.photo_cache = {}
            self.photos_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'photos')
            os.makedirs(self.photos_dir, exist_ok=True)
            
            if self.json_service.file_exists('photo_cache.json'):
                self.photo_cache = self.json_service.load_from_json('photo_cache.json')
            
            # Добавляем задачу периодического обновления фотографий
            self.job_queue = self.application.job_queue
            self.job_queue.run_repeating(self.update_all_photos, interval=3600, first=10)  # Обновляем каждый час
            
            # Добавляем задачу очистки множества обработанных групп
            self.job_queue.run_repeating(self._clear_processed_groups, interval=300, first=300)  # Очищаем каждые 5 минут
            
            # Инициализируем бота и получаем его ID
            await self.application.bot.initialize()
            self.bot_id = self.application.bot.id
            logger.info(f"✅ ID бота установлен: {self.bot_id}")
            
            logger.info("✅ Обработчик групповых событий инициализирован")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при инициализации GroupHandler: {str(e)}")
            logger.error(traceback.format_exc())
            raise

    async def _clear_processed_groups(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Очистка множества обработанных групп"""
        try:
            if hasattr(self, 'processed_groups'):
                self.processed_groups.clear()
                logger.info("✅ Множество обработанных групп очищено")
        except Exception as e:
            logger.error(f"❌ Ошибка при очистке множества обработанных групп: {str(e)}")
    
    async def _ensure_http_client(self):
        """Убеждаемся, что HTTP-клиент существует и активен"""
        try:
            if self.http_client is None or self.http_client.is_closed:
                limits = httpx.Limits(max_connections=100, max_keepalive_connections=50)
                timeout = httpx.Timeout(30.0)
                self.http_client = httpx.AsyncClient(
                    limits=limits,
                    timeout=timeout
                )
                self.application.bot._http_client = self.http_client
                logger.info("Создан новый HTTP-клиент")
        except Exception as e:
            logger.error(f"Ошибка при создании HTTP-клиента: {str(e)}", exc_info=True)
            raise

    async def handle_new_chat_members(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик добавления новых участников в чат"""
        try:
            chat = update.effective_chat
            new_members = update.message.new_chat_members if update.message else []
            
            # Проверяем, был ли добавлен бот
            is_bot_added = any(member.id == context.bot.id for member in new_members)
            
            if is_bot_added:
                # Создаем уникальный идентификатор события
                event_id = f"bot_added_{chat.id}_{update.message.message_id}"
                
                # Инициализируем множество для отслеживания обработанных событий, если его еще нет
                if not hasattr(self, '_processed_events'):
                    self._processed_events = set()
                
                # Проверяем, не обрабатывали ли мы уже это событие
                if event_id in self._processed_events:
                    logger.info(f"Событие {event_id} уже было обработано, пропускаем")
                    return
                
                # Добавляем событие в множество обработанных
                self._processed_events.add(event_id)
                
                logger.info(f"=== Бот добавлен в чат {chat.title} ===")
                await self._process_bot_added(chat, context)
                return
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Получаем текущие списки участников и администраторов
            current_members = await self._get_chat_members(chat, context)
            current_admins = await self._get_chat_admins(original_chat_id, context)
            
            # Обрабатываем каждого нового участника
            for new_member in new_members:
                if new_member.is_bot:  # Пропускаем ботов
                    continue
                    
                # Получаем фото нового участника
                photo_url = await self._get_user_photo(new_member.id, context, force_update=True)
                
                # Создаем информацию о новом участнике
                member_info = {
                    'user_id': new_member.id,
                    'username': new_member.username,
                    'first_name': new_member.first_name or "",
                    'last_name': new_member.last_name or "",
                    'status': 'member',
                    'joined_date': datetime.now().isoformat(),
                    'is_bot': new_member.is_bot
                }
                
                if photo_url:
                    member_info['photo_url'] = photo_url
                
                # Проверяем, является ли новый участник администратором
                is_admin = await context.bot.get_chat_member(chat.id, new_member.id)
                if is_admin.status in ['administrator', 'creator']:
                    member_info['status'] = is_admin.status
                    if not any(a['user_id'] == new_member.id for a in current_admins):
                        current_admins.append(member_info)
                
                # Добавляем участника в список, если его там еще нет
                if not any(m['user_id'] == new_member.id for m in current_members):
                    current_members.append(member_info)
                    logger.info(f"Добавлен новый участник: {new_member.username or new_member.id}")
            
            # Сохраняем обновленные данные
            if is_courier:
                # Для курьерских групп сохраняем в системе курьеров
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=current_members,
                    admins=current_admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно обновлены")
            else:
                # Для обычных групп сохраняем в общие файлы
                await self.json_service.save_members(original_chat_id, chat.title, current_members)
                await self.json_service.save_admins(original_chat_id, chat.title, current_admins)
                logger.info(f"✅ Данные группы {chat.title} успешно обновлены")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке новых участников: {e}")
            logger.error(traceback.format_exc())

    async def handle_chat_member_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик изменения статуса участника в чате"""
        try:
            chat = update.effective_chat
            user = update.chat_member.new_chat_member.user
            old_status = update.chat_member.old_chat_member.status
            new_status = update.chat_member.new_chat_member.status
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Получаем текущие списки участников и администраторов
            current_members = await self._get_chat_members(chat, context)
            current_admins = await self._get_chat_admins(original_chat_id, context)
            
            # Получаем фото пользователя
            photo_url = await self._get_user_photo(user.id, context, force_update=True)
            
            # Создаем/обновляем информацию о пользователе
            member_info = {
                'user_id': user.id,
                'username': user.username,
                'first_name': user.first_name or "",
                'last_name': user.last_name or "",
                'status': new_status,
                'joined_date': datetime.now().isoformat(),
                'is_bot': user.is_bot
            }
            
            if photo_url:
                member_info['photo_url'] = photo_url
            
            # Обновляем статус в списке участников
            member_updated = False
            for member in current_members:
                if member['user_id'] == user.id:
                    member.update(member_info)
                    member_updated = True
                    break
            
            # Если участника нет в списке, добавляем его
            if not member_updated and new_status not in ['left', 'kicked']:
                current_members.append(member_info)
                logger.info(f"Добавлен новый участник: {user.username or user.id}")
            
            # Обновляем список администраторов
            if new_status in ['administrator', 'creator']:
                # Добавляем в список администраторов
                if not any(a['user_id'] == user.id for a in current_admins):
                    current_admins.append(member_info)
                    logger.info(f"Добавлен новый администратор: {user.username or user.id}")
            elif old_status in ['administrator', 'creator']:
                # Удаляем из списка администраторов
                current_admins = [a for a in current_admins if a['user_id'] != user.id]
                logger.info(f"Удален администратор: {user.username or user.id}")
            
            # Сохраняем обновленные данные
            if is_courier:
                # Для курьерских групп сохраняем в системе курьеров
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=current_members,
                    admins=current_admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно обновлены")

                # Обновляем список доступа к веб-приложению
                courier_access_file = os.path.join(self.json_service.data_dir, 'courier_webapp_access.json')
                try:
                    # Загружаем текущие данные о доступе
                    if os.path.exists(courier_access_file):
                        with open(courier_access_file, 'r', encoding='utf-8') as f:
                            access_data = json.load(f)
                    else:
                        access_data = {"groups": [], "members": []}

                    # Обновляем список участников
                    current_members = set(str(member['user_id']) for member in members)
                    
                    # Получаем участников всех курьерских групп
                    all_courier_members = set()
                    for group_id in access_data["groups"]:
                        try:
                            group_members = await self._get_chat_members(group_id, context)
                            all_courier_members.update(str(member['user_id']) for member in group_members)
                        except Exception as e:
                            logger.error(f"Ошибка при получении участников группы {group_id}: {str(e)}")

                    # Обновляем список доступа
                    access_data["members"] = list(all_courier_members)

                    # Сохраняем обновленные данные
                    with open(courier_access_file, 'w', encoding='utf-8') as f:
                        json.dump(access_data, f, indent=2, ensure_ascii=False)

                    logger.info(f"✅ Список доступа к веб-приложению обновлен")

                    # Сохраняем обновленные данные
                    with open(courier_access_file, 'w', encoding='utf-8') as f:
                        json.dump(access_data, f, indent=2, ensure_ascii=False)

                    logger.info(f"✅ Список доступа к веб-приложению обновлен")

                except Exception as e:
                    logger.error(f"❌ Ошибка при обновлении списка доступа: {str(e)}")
                    logger.error(traceback.format_exc())
            else:
                # Для обычных групп сохраняем в общие файлы
                await self.json_service.save_members(original_chat_id, chat.title, current_members)
                await self.json_service.save_admins(original_chat_id, chat.title, current_admins)
                logger.info(f"✅ Данные группы {chat.title} успешно обновлены")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения статуса участника: {e}")
            logger.error(traceback.format_exc())

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик сообщений для отслеживания активности администраторов"""
        try:
            if not update.message or not update.message.chat:
                return

            chat_id = update.message.chat.id
            user = update.message.from_user
            user_id = user.id if user else None
            
            if not user_id:
                return

            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(update.message.chat.title)
            logger.info(f"Проверка группы '{update.message.chat.title}' на принадлежность к курьерам: {is_courier}")

            # Принудительно обновляем списки участников и администраторов
            try:
                chat = update.effective_chat
                standardized_chat_id = await self._get_standardized_chat_id(chat.id)
                original_chat_id = await self._get_original_chat_id(standardized_chat_id)
                
                # Обновляем список администраторов
                admins = await self._get_chat_admins(original_chat_id, context)
                # Сохраняем только если список не пустой
                if admins:
                    if is_courier:
                        # Для курьерских групп сохраняем данные только в системе курьеров
                        members = await self._get_chat_members(chat, context)
                        await self.courier_service.save_group_data(
                            chat_id=standardized_chat_id,
                            chat_title=chat.title,
                            members=members,
                            admins=admins
                        )
                        logger.info(f"✅ Данные курьерской группы {chat.title} успешно обновлены")
                    else:
                        # Для обычных групп сохраняем данные в общие файлы
                        await self.json_service.save_admins(standardized_chat_id, chat.title, admins)
                        logger.info(f"Принудительно обновлен список администраторов для чата {chat.title}")
                else:
                    logger.warning("Получен пустой список администраторов, пропускаем сохранение")
                
                # Обновляем список участников
                members = await self._get_chat_members(chat, context)
                if members:
                    if is_courier:
                        # Для курьерских групп данные уже сохранены выше
                        logger.info(f"✅ Список участников курьерской группы {chat.title} обновлен")
                    else:
                        # Для обычных групп сохраняем данные в общие файлы
                        await self.json_service.save_members(standardized_chat_id, chat.title, members)
                        logger.info(f"Принудительно обновлен список участников для чата {chat.title}")
                else:
                    logger.warning("Получен пустой список участников, пропускаем сохранение")
            except Exception as update_error:
                logger.error(f"Ошибка при принудительном обновлении списков: {str(update_error)}", exc_info=True)

            # Обработка активности администратора
            activity_data = self.json_service.load_from_json('admin_activity.json')
            
            # Проверяем, является ли отправитель администратором
            admins = await self._get_chat_admins(original_chat_id, context)
            is_admin = any(admin.get('user_id') == str(user_id) for admin in admins)
            
            if is_admin:
                # Инициализируем структуру данных, если её нет
                if standardized_chat_id not in activity_data:
                    activity_data[standardized_chat_id] = {}
                    
                if str(user_id) not in activity_data[standardized_chat_id]:
                    activity_data[standardized_chat_id][str(user_id)] = {
                        'message_count': 0,
                        'last_active': '',
                        'commands_used': 0,
                        'reactions_received': 0,
                        'messages_pinned': 0
                    }
                
                # Обновляем данные активности
                admin_data = activity_data[standardized_chat_id][str(user_id)]
                admin_data['message_count'] += 1
                admin_data['last_active'] = datetime.now().isoformat()
                
                if update.message.text and update.message.text.startswith('/'):
                    admin_data['commands_used'] += 1
                
                # Сохраняем обновленные данные
                self.json_service.save_admin_activity(activity_data)
                logger.info(f"Обновлена активность администратора {user_id} в чате {chat_id}")
                
        except Exception as e:
            logger.error(f"Ошибка при обработке сообщения: {e}", exc_info=True)
    
    async def _get_standardized_chat_id(self, chat_id: Union[int, str]) -> str:
        """Преобразует ID чата в стандартный формат"""
        str_id = str(chat_id)
        
        # Удаляем префикс -100 для супергрупп
        if str_id.startswith('-100'):
            return str_id[4:]
        # Удаляем префикс - для обычных групп
        elif str_id.startswith('-'):
            return str_id[1:]
        return str_id

    async def _get_original_chat_id(self, standardized_chat_id: Union[int, str]) -> str:
        """Преобразует стандартизированный ID чата в оригинальный формат"""
        str_id = str(standardized_chat_id)
        
        # Проверяем длину ID для определения типа группы
        if len(str_id) >= 10:  # Супергруппа
            return f"-100{str_id}"
        else:  # Обычная группа
            return f"-{str_id}"

    def _calculate_activity_score(self, activity_data: Dict) -> float:
        """Рассчитывает оценку активности администратора"""
        try:
            # Получаем значения из данных активности
            message_count = activity_data.get('message_count', 0)
            commands_used = activity_data.get('commands_used', 0)
            reactions_received = activity_data.get('reactions_received', 0)
            messages_pinned = activity_data.get('messages_pinned', 0)
            last_active_str = activity_data.get('last_active')
            
            # Базовая оценка на основе количества сообщений
            base_score = message_count * 1.0
            
            # Дополнительные баллы за разные типы активности
            command_bonus = commands_used * 2.0  # Использование команд ценится выше
            reaction_bonus = reactions_received * 0.5  # Небольшой бонус за реакции
            pin_bonus = messages_pinned * 1.5  # Бонус за закрепление сообщений
            
            # Расчет штрафа за неактивность
            inactivity_penalty = 0
            if last_active_str:
                try:
                    last_active = datetime.fromisoformat(last_active_str)
                    days_inactive = (datetime.now() - last_active).days
                    if days_inactive > 0:
                        # Штраф увеличивается с каждым днем неактивности
                        inactivity_penalty = min(days_inactive * 0.1, 0.5)  # Максимальный штраф 50%
                except ValueError:
                    logger.warning(f"Некорректный формат даты последней активности: {last_active_str}")
            
            # Итоговая оценка
            total_score = (base_score + command_bonus + reaction_bonus + pin_bonus) * (1 - inactivity_penalty)
            
            # Нормализация оценки от 0 до 100
            normalized_score = min(100, max(0, total_score))
            
            logger.info(f"Рассчитана оценка активности: {normalized_score} (сообщения: {message_count}, команды: {commands_used}, реакции: {reactions_received}, закрепления: {messages_pinned}, штраф: {inactivity_penalty})")
            
            return normalized_score
            
        except Exception as e:
            logger.error(f"Ошибка при расчете оценки активности: {str(e)}")
            return 0

    def _get_photo_path(self, user_id: str) -> str:
        """Получение пути к локальному файлу фотографии"""
        return os.path.join(self.photos_dir, f'user_{user_id}.jpg')
        
    async def _download_and_save_photo(self, file_path: str, user_id: str) -> bool:
        """Скачивание и сохранение фотографии локально"""
        try:
            photo_path = self._get_photo_path(user_id)
            
            # Убедимся, что директория существует
            os.makedirs(os.path.dirname(photo_path), exist_ok=True)
            
            # Попытка скачать и сохранить фото с повторными попытками
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(file_path) as response:
                            if response.status == 200:
                                # Сначала сохраняем во временный файл
                                temp_path = f"{photo_path}.tmp"
                                async with aiofiles.open(temp_path, 'wb') as f:
                                    await f.write(await response.read())
                                # Затем переименовываем в целевой файл
                                os.replace(temp_path, photo_path)
                                logger.info(f"✅ Фото для пользователя {user_id} сохранено локально")
                                return True
                            else:
                                logger.warning(f"⚠️ Неудачная попытка {attempt + 1}/{max_retries} скачать фото. Статус: {response.status}")
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"⚠️ Попытка {attempt + 1}/{max_retries} не удалась: {str(e)}")
                    await asyncio.sleep(1)  # Пауза перед следующей попыткой
                    
            logger.error(f"❌ Не удалось скачать фото для пользователя {user_id} после {max_retries} попыток")
            return False
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении фото: {str(e)}")
            return False
            
    async def _get_user_photo(self, user_id: int, context: ContextTypes.DEFAULT_TYPE, force_update: bool = False) -> Optional[str]:
        """Получение фотографии пользователя"""
        try:
            # Проверяем кэш только если не требуется принудительное обновление
            cache_key = str(user_id)
            if not force_update and cache_key in self.photo_cache:
                logger.info(f"Возвращаем фото из кэша для пользователя {user_id}")
                return self.photo_cache[cache_key]
            
            # Получаем фотографии пользователя
            photos = await context.bot.get_user_profile_photos(user_id, limit=1)
            
            if photos and photos.photos:
                # Берем последнюю фотографию
                photo = photos.photos[0][-1]  # Берем файл с максимальным размером
                
                # Получаем файл
                file = await context.bot.get_file(photo.file_id)
                
                # Проверяем, является ли file.file_path уже полным URL
                if file.file_path.startswith('http'):
                    photo_url = file.file_path
                else:
                    # Формируем URL для загрузки файла
                    bot_token = context.bot.token
                    photo_url = f"https://api.telegram.org/file/bot{bot_token}/{file.file_path}"
                
                # Очищаем URL от возможного дублирования
                if "https://api.telegram.org/file/bot" in photo_url[30:]:
                    photo_url = photo_url[:photo_url.find("/https://")]
                
                # Сохраняем в кэш
                self.photo_cache[cache_key] = photo_url
                
                # Сохраняем кэш в файл
                await self.json_service.save_to_json('photo_cache.json', self.photo_cache)
                
                logger.info(f"Получен URL фото для пользователя {user_id}: {photo_url}")
                return photo_url
            
            logger.warning(f"Фотографии не найдены для пользователя {user_id}")
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при получении фото пользователя {user_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return None

    async def request_admin_contact(self, admin_id: int, admin_name: str, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Запрашивает контакт у администратора без username"""
        try:
            # Проверяем, когда последний раз отправляли запрос
            contact_requests = self.json_service.load_from_json('contact_requests.json')
            admin_id_str = str(admin_id)
            
            now = datetime.now()
            if admin_id_str in contact_requests:
                last_request = datetime.fromisoformat(contact_requests[admin_id_str])
                # Если прошло меньше 24 часов с последнего запроса, пропускаем
                if (now - last_request).total_seconds() < 24 * 3600:
                    logger.info(f"Пропускаем запрос контакта для {admin_name} - прошло меньше 24 часов")
                    return
            
            # Создаем клавиатуру с кнопкой для отправки контакта
            keyboard = [[KeyboardButton(
                text="Поделиться контактом",
                request_contact=True
            )]]
            reply_markup = ReplyKeyboardMarkup(
                keyboard,
                resize_keyboard=True,
                one_time_keyboard=True
            )
            
            # Отправляем сообщение администратору
            await context.bot.send_message(
                chat_id=admin_id,
                text=(
                    "Здравствуйте! Я заметил, что у вас нет username в Telegram.\n\n"
                    "Чтобы участники чата могли легко связаться с вами, "
                    "пожалуйста, поделитесь своим контактным номером, нажав кнопку ниже.\n\n"
                    "Ваш номер будет виден только участникам чата."
                ),
                reply_markup=reply_markup
            )
            
            # Сохраняем время запроса
            contact_requests[admin_id_str] = now.isoformat()
            self.json_service.save_to_json(contact_requests, 'contact_requests.json')
            
            logger.info(f"Отправлен запрос контакта администратору {admin_name} (ID: {admin_id})")
            
        except Exception as e:
            logger.error(f"Ошибка при запросе контакта у администратора {admin_name}: {e}", exc_info=True)

    async def _get_chat_members(self, chat, context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка участников чата"""
        try:
            logger.info(f"=== Получение участников чата {chat.title} ===")
            members = []
            last_error = None
            success = False
            
            # Получаем список участников через обновление чата
            try:
                chat_info = await context.bot.get_chat(chat.id)
                if not chat_info.permissions:
                    logger.warning(f"Нет прав для получения информации о чате {chat.title}")
                    return []

                # Получаем администраторов
                admins = await context.bot.get_chat_administrators(chat.id)
                admin_ids = [admin.user.id for admin in admins]
                
                # Добавляем администраторов в список участников
                for admin in admins:
                    user = admin.user
                    if user.is_bot:  # Пропускаем ботов
                        continue
                        
                    # Получаем фото участника
                    photo_url = await self._get_user_photo(user.id, context, force_update=True)
                    
                    member_info = {
                        'user_id': user.id,
                        'username': user.username,
                        'first_name': "",  # Инициализируем пустой строкой
                        'last_name': "",   # Инициализируем пустой строкой
                        'status': 'administrator',
                        'joined_date': datetime.now().isoformat(),
                        'is_bot': user.is_bot
                    }
                    
                    if photo_url:
                        member_info['photo_url'] = photo_url
                        
                    members.append(member_info)
                    logger.info(f"Добавлен администратор: {user.username or user.id}")

                success = True
                logger.info(f"✅ Успешно получены участники чата {chat.title}")
                
            except Exception as e:
                last_error = e
                logger.warning(f"Не удалось получить участников чата {chat.title}: {str(e)}")
            
            if not success and last_error:
                raise last_error
                
            return members
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка участников: {str(e)}")
            return []

    async def _get_chat_admins(self, chat_id: Union[int, str], context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка администраторов чата"""
        admin_list = []
        
        try:
            logger.info(f"Получение администраторов для чата {chat_id}")
            
            # Преобразуем chat_id в правильный формат для API
            str_chat_id = str(chat_id)
            
            # Определяем форматы ID для попыток
            chat_id_formats = []
            
            # Сначала пробуем формат обычной группы
            if str_chat_id.startswith('-100'):
                # Если начинается с -100, пробуем сначала обычный формат
                chat_id_formats.append(f"-{str_chat_id[4:]}")
                chat_id_formats.append(str_chat_id)  # Затем оригинальный формат
            elif str_chat_id.startswith('-'):
                chat_id_formats.append(str_chat_id)  # Сначала как есть
                chat_id_formats.append(f"-100{str_chat_id[1:]}")  # Затем формат супергруппы
            else:
                chat_id_formats.append(f"-{str_chat_id}")  # Сначала обычный формат
                chat_id_formats.append(f"-100{str_chat_id}")  # Затем формат супергруппы
            
            admins = None
            last_error = None
            
            # Пробуем получить администраторов с разными форматами ID
            for format_id in chat_id_formats:
                try:
                    admins = await context.bot.get_chat_administrators(format_id)
                    break
                except Exception as e:
                    last_error = e
                    continue
            
            if not admins:
                if last_error:
                    raise last_error
                return []
            
            for admin in admins:
                user = admin.user
                admin_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': "",  # Инициализируем пустой строкой
                    'last_name': "",   # Инициализируем пустой строкой
                    'status': get_member_status(admin),
                    'is_bot': user.is_bot,
                    'can_manage_chat': getattr(admin, 'can_manage_chat', True),
                    'can_delete_messages': getattr(admin, 'can_delete_messages', True),
                    'can_manage_voice_chats': getattr(admin, 'can_manage_voice_chats', True),
                    'can_restrict_members': getattr(admin, 'can_restrict_members', True),
                    'can_promote_members': getattr(admin, 'can_promote_members', True),
                    'can_change_info': getattr(admin, 'can_change_info', True),
                    'can_invite_users': getattr(admin, 'can_invite_users', True),
                    'can_pin_messages': getattr(admin, 'can_pin_messages', True)
                }
                
                # Получаем фото профиля
                photo_url = await self._get_user_photo(user.id, context)
                if photo_url:
                    admin_info['photo_url'] = photo_url
                
                admin_list.append(admin_info)
                logger.info(f"Добавлен администратор: {user.username or user.id}")
            
            logger.info(f"Всего получено {len(admin_list)} администраторов")
            return admin_list
            
        except Exception as e:
            logger.error(f"Ошибка при получении списка администраторов: {str(e)}")
            return []

    async def _standardize_chat_id(self, chat_id: int | str) -> str:
        """Стандартизация ID чата"""
        chat_id_str = str(chat_id)
        
        # Убираем '-100' из начала ID если есть
        if chat_id_str.startswith('-100'):
            return chat_id_str[4:]
        # Убираем '-' из начала ID если есть
        elif chat_id_str.startswith('-'):
            return chat_id_str[1:]
        return chat_id_str

    async def _process_bot_added(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка добавления бота в чат"""
        try:
            # Создаем уникальный идентификатор для этого чата
            chat_key = f"bot_added_{chat.id}"
            
            # Загружаем список обработанных групп
            processed_groups = self._load_processed_groups()
            
            # Проверяем, не обрабатывали ли мы уже этот чат
            if chat_key in processed_groups:
                logger.info(f"Чат {chat.title} уже был обработан, пропускаем")
                return
                
            # Добавляем чат в множество обработанных и сохраняем
            processed_groups.add(chat_key)
            # Добавляем чат в множество обработанных
            if not hasattr(self, 'processed_groups'):
                self.processed_groups = set()
            self.processed_groups.add(chat_key)
            
            logger.info(f"=== Начало обработки добавления бота в чат {chat.title} ===")
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")

            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            if is_courier:
                # Создаем inline клавиатуру с кнопкой "Записаться"
                keyboard = InlineKeyboardMarkup([
                    [InlineKeyboardButton("📝 Записаться", callback_data="register_courier")]
                ])
                
                # Отправляем сообщение с кнопкой в чат
                try:
                    logger.info(f"Попытка отправить приветственное сообщение в чат {chat.id}")
                    message = await context.bot.send_message(
                        chat_id=chat.id,
                        text=(
                            f"👋 Приветствую участников группы {chat.title}!\n\n"
                            "Чтобы получить доступ к функциям записи на смену, "
                            "пожалуйста, нажмите кнопку 'Записаться' ниже."
                        ),
                        reply_markup=keyboard
                    )
                    
                    # Создаем задачу для попытки закрепления сообщения через 10 секунд
                    async def try_pin_message():
                        try:
                            await asyncio.sleep(10)  # Ждем 10 секунд
                            logger.info("Попытка закрепить сообщение после задержки")
                            await context.bot.pin_chat_message(
                                chat_id=chat.id,
                                message_id=message.message_id,
                                disable_notification=True
                            )
                            logger.info("✅ Сообщение успешно закреплено")
                        except Exception as e:
                            logger.error(f"❌ Не удалось закрепить сообщение после задержки: {str(e)}")
                    
                    # Запускаем задачу закрепления сообщения асинхронно
                    asyncio.create_task(try_pin_message())
                    
                    logger.info(f"✅ Приветственное сообщение успешно отправлено в группу {chat.title}")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке приветственного сообщения: {str(e)}")
                    logger.error(traceback.format_exc())

            # Получаем список всех участников чата
            logger.info("Получение списка участников...")
            members = await self._get_chat_members(chat, context)
            logger.info(f"Получено {len(members)} участников")
            
            # Получаем список администраторов
            logger.info("Получение списка администраторов...")
            admins = await self._get_chat_admins(original_chat_id, context)
            logger.info(f"Получено {len(admins)} администраторов")
            
            # Проверяем и добавляем администраторов в список участников, если их там нет
            for admin in admins:
                if not any(m['user_id'] == admin['user_id'] for m in members):
                    members.append(admin)
                    logger.info(f"Администратор {admin['username'] or admin['user_id']} добавлен в список участников")
            
            if is_courier:
                # Для курьерских групп сохраняем в системе курьеров
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=members,
                    admins=admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно сохранены")

                # Обновляем список доступа к веб-приложению
                courier_access_file = os.path.join(self.json_service.data_dir, 'courier_webapp_access.json')
                try:
                    # Загружаем текущие данные о доступе
                    if os.path.exists(courier_access_file):
                        with open(courier_access_file, 'r', encoding='utf-8') as f:
                            access_data = json.load(f)
                    else:
                        access_data = {"groups": [], "members": []}

                    # Обновляем список групп
                    if original_chat_id not in access_data["groups"]:
                        access_data["groups"].append(original_chat_id)

                    # Обновляем список участников
                    member_ids = [str(member['user_id']) for member in members]
                    access_data["members"] = list(set(access_data["members"] + member_ids))

                    # Сохраняем обновленные данные
                    with open(courier_access_file, 'w', encoding='utf-8') as f:
                        json.dump(access_data, f, indent=2, ensure_ascii=False)

                    logger.info(f"✅ Список доступа к веб-приложению обновлен")

                    
                except Exception as e:
                    logger.error(f"❌ Ошибка при обновлении списка доступа: {str(e)}")
                    logger.error(traceback.format_exc())
            else:
                # Для обычных групп сохраняем в общие файлы
                await self.json_service.save_members(original_chat_id, chat.title, members)
                await self.json_service.save_admins(original_chat_id, chat.title, admins)
                logger.info(f"✅ Данные группы {chat.title} успешно сохранены")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке добавления бота: {str(e)}")
            logger.error(traceback.format_exc())

    async def handle_left_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик удаления участника из чата"""
        try:
            chat = update.effective_chat
            left_member = update.message.left_chat_member
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            if is_courier:
                # Для курьерских групп обновляем данные только в системе курьеров
                members = await self._get_chat_members(chat, context)
                admins = await self._get_chat_admins(original_chat_id, context)
                
                # Удаляем участника из списков
                members = [m for m in members if m['user_id'] != left_member.id]
                admins = [a for a in admins if a['user_id'] != left_member.id]
                
                # Сохраняем обновленные данные только в системе курьеров
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=members,
                    admins=admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно обновлены")

                # Обновляем список доступа к веб-приложению
                courier_access_file = os.path.join(self.json_service.data_dir, 'courier_webapp_access.json')
                try:
                    # Загружаем текущие данные о доступе
                    if os.path.exists(courier_access_file):
                        with open(courier_access_file, 'r', encoding='utf-8') as f:
                            access_data = json.load(f)
                    else:
                        access_data = {"groups": [], "members": []}

                    # Проверяем, есть ли пользователь в других курьерских группах
                    user_in_other_groups = False
                    for group_id in access_data["groups"]:
                        if group_id != original_chat_id:  # Проверяем другие группы
                            try:
                                group_members = await self._get_chat_members(group_id, context)
                                if any(str(member['user_id']) == str(left_member.id) for member in group_members):
                                    user_in_other_groups = True
                                    break
                            except Exception as e:
                                logger.error(f"Ошибка при получении участников группы {group_id}: {str(e)}")

                    # Если пользователь не состоит в других курьерских группах, удаляем его из списка доступа
                    if not user_in_other_groups:
                        if str(left_member.id) in access_data["members"]:
                            access_data["members"].remove(str(left_member.id))
                            # Устанавливаем стандартную кнопку меню для пользователя
                            try:
                                await context.bot.set_chat_menu_button(
                                    chat_id=left_member.id,
                                    menu_button=MenuButton()  # Используем пустой MenuButton для стандартной кнопки
                                )
                                logger.info(f"✅ Стандартная кнопка меню установлена для пользователя {left_member.id}")
                            except Exception as e:
                                logger.error(f"Ошибка при установке стандартной кнопки меню: {str(e)}")

                    # Сохраняем обновленные данные
                    with open(courier_access_file, 'w', encoding='utf-8') as f:
                        json.dump(access_data, f, indent=2, ensure_ascii=False)

                    logger.info(f"✅ Список доступа к веб-приложению обновлен")

                except Exception as e:
                    logger.error(f"❌ Ошибка при обновлении списка доступа: {str(e)}")
                    logger.error(traceback.format_exc())

            else:
                # Для обычных групп обновляем данные в общие файлы
                members = await self._get_chat_members(chat, context)
                members = [m for m in members if m['user_id'] != left_member.id]
                await self.json_service.save_members(original_chat_id, chat.title, members)
                logger.info(f"✅ Данные группы {chat.title} успешно обновлены")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке удаления участника: {e}")
            logger.error(traceback.format_exc())

    async def send_love_messages(self, bot: Bot, user_id: int, count: int = 100) -> None:
        """Отправка любовных сообщений пользователю"""
        try:
            # Список ласковых обращений
            love_messages = [
                
            ]
            
            # Перемешиваем сообщения
            random.shuffle(love_messages)
            
            # Отправляем сообщения
            for i in range(count):
                # Если сообщений меньше чем count, повторяем их случайным образом
                message = f"{i+1}. {love_messages[i % len(love_messages)]}"
                await bot.send_message(chat_id=user_id, text=message)
                logger.info(f"Отправлено сообщение {i+1} пользователю {user_id}: {message}")
            
            logger.info(f"Успешно отправлено {count} любовных сообщений пользователю {user_id}")
            
        except Exception as e:
            logger.error(f"Ошибка при отправке любовных сообщений: {e}", exc_info=True)
            raise

    async def handle_webapp_data(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка данных от веб-приложения"""
        try:
            if not update.message or not update.message.web_app_data:
                return
                
            data = json.loads(update.message.web_app_data.data)
            logger.info(f"Получены данные от веб-приложения: {data}")
            
            # Здесь можно добавить обработку различных типов данных
            # Например, регистрация курьера, обновление профиля и т.д.
            
            await update.message.reply_text(
                "Спасибо за регистрацию! Мы свяжемся с вами в ближайшее время."
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке данных веб-приложения: {e}")
            logger.error(traceback.format_exc())
            await update.message.reply_text(
                "Произошла ошибка при обработке данных. Пожалуйста, попробуйте позже."
            )

    async def handle_share_contact(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка команды /share_contact"""
        try:
            chat = update.effective_chat
            user = update.effective_user
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Проверяем, является ли пользователь администратором
            chat_member = await context.bot.get_chat_member(chat.id, user.id)
            if chat_member.status not in ['administrator', 'creator']:
                await update.message.reply_text(
                    "Эта команда доступна только для администраторов."
                )
                return

            # Создаем клавиатуру с кнопкой для отправки контакта
            keyboard = [[KeyboardButton(
                text="Поделиться контактом",
                request_contact=True
            )]]
            reply_markup = ReplyKeyboardMarkup(
                keyboard,
                resize_keyboard=True,
                one_time_keyboard=True
            )
            
            await update.message.reply_text(
                "Чтобы пользователи могли связаться с вами через бота, "
                "нажмите кнопку 'Поделиться контактом' ниже.\n\n"
                "Ваш номер телефона будет виден только тем, у кого есть доступ к чату.",
                reply_markup=reply_markup
            )
            
        except Exception as e:
            logger.error(f"Ошибка при обработке команды share_contact: {e}", exc_info=True)
            await update.message.reply_text(
                "Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже."
            )
            
    async def handle_contact_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка сообщения с контактом"""
        try:
            if not update.message.contact:
                return
                
            contact = update.message.contact
            user = update.effective_user
            
            # Проверяем, что контакт принадлежит отправителю
            if contact.user_id != user.id:
                await update.message.reply_text(
                    "Вы можете поделиться только своим контактом.",
                    reply_markup=ReplyKeyboardRemove()
                )
                return
            
            # Загружаем текущие данные из admins.json
            data = self.json_service.load_from_json('admins.json')
            success_count = 0
            
            # Обновляем информацию во всех чатах
            for chat_id, chat_data in data.items():
                try:
                    # Проверяем, является ли группа курьерской
                    is_courier = self.courier_service.is_courier_group(chat_data.get('chat_title', ''))
                    logger.info(f"Проверка группы '{chat_data.get('chat_title', '')}' на принадлежность к курьерам: {is_courier}")
                    
                    if is_courier:
                        # Для курьерских групп обновляем данные только в системе курьеров
                        members = await self._get_chat_members(chat_id)
                        admins = await self._get_chat_admins(chat_id)
                        
                        # Обновляем номер телефона для администратора
                        updated = False
                        for admin in admins:
                            if admin.get('user_id') == user.id:
                                admin['phone'] = contact.phone_number
                                updated = True
                                logger.info(f"✅ Обновлен контакт администратора в курьерской группе {chat_data.get('chat_title')}")
                                break
                        
                        if updated:
                            # Сохраняем обновленные данные только в системе курьеров
                            await self.courier_service.save_group_data(
                                chat_id=chat_id,
                                chat_title=chat_data.get('chat_title', ''),
                                members=members,
                                admins=admins
                            )
                            success_count += 1
                    else:
                        # Для обычных групп обновляем данные в общих файлах
                        updated = False
                        admins = chat_data.get('admins', [])
                        
                        # Обновляем номер телефона для администратора
                        for admin in admins:
                            if admin.get('user_id') == user.id:
                                admin['phone'] = contact.phone_number
                                updated = True
                                logger.info(f"✅ Обновлен контакт администратора в чате {chat_data.get('chat_title')}")
                                break
                        
                        if updated:
                            # Используем save_admins вместо прямого обновления
                            await self.json_service.save_admins(
                                chat_id,
                                chat_data.get('chat_title'),
                                admins
                            )
                            success_count += 1
                        
                except Exception as e:
                    logger.error(f"❌ Ошибка при обновлении контакта в чате {chat_data.get('chat_title')}: {str(e)}")
                    continue
            
            if success_count > 0:
                await update.message.reply_text(
                    "✅ Спасибо! Ваш контакт успешно сохранен. Теперь участники чатов смогут связаться с вами.",
                    reply_markup=ReplyKeyboardRemove()
                )
                logger.info(f"Контакт администратора {user.first_name} успешно сохранен в {success_count} чатах")
            else:
                await update.message.reply_text(
                    "❌ К сожалению, не удалось сохранить ваш контакт. Пожалуйста, попробуйте позже.",
                    reply_markup=ReplyKeyboardRemove()
                )
                logger.error(f"Не удалось сохранить контакт администратора {user.first_name} ни в одном чате")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке контакта: {str(e)}", exc_info=True)
            await update.message.reply_text(
                "❌ Произошла ошибка при сохранении контакта. Пожалуйста, попробуйте позже.",
                reply_markup=ReplyKeyboardRemove()
            )

    async def handle_profile_photo_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка обновления фотографии профиля"""
        try:
            if not update.message or not update.message.from_user:
                return

            user = update.message.from_user
            chat = update.effective_chat
            chat_id = await self._get_standardized_chat_id(chat.id)

            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")

            # Получаем новое фото профиля
            photo_url = await self._get_user_photo(user.id, context)
            if not photo_url:
                logger.warning(f"Не удалось получить новое фото профиля для пользователя {user.id}")
                return

            if is_courier:
                # Для курьерских групп обновляем данные только в системе курьеров
                members = await self._get_chat_members(chat.id)
                admins = await self._get_chat_admins(chat.id)
                
                # Обновляем фото в списках
                for member in members:
                    if str(member.get('user_id')) == str(user.id):
                        member['photo_url'] = photo_url
                        logger.info(f"Обновлено фото участника {user.id} в курьерской группе")
                
                for admin in admins:
                    if str(admin.get('user_id')) == str(user.id):
                        admin['photo_url'] = photo_url
                        logger.info(f"Обновлено фото профиля для администратора {user.id} в курьерской группе")
                
                # Сохраняем обновленные данные
                await self.courier_service.save_group_data(
                    chat_id=chat_id,
                    chat_title=chat.title,
                    members=members,
                    admins=admins
                )
                logger.info(f"✅ Фотографии успешно обновлены для курьерской группы {chat.title}")
            else:
                # Обновляем фото в данных участников
                members_data = self.json_service.load_from_json('members.json')
                if str(chat_id) in members_data:
                    chat_data = members_data[str(chat_id)]
                    for member in chat_data.get('members', []):
                        if str(member.get('user_id')) == str(user.id):
                            member['photo_url'] = photo_url
                            logger.info(f"Обновлено фото участника {user.id}")
                    await self.json_service.save_members(chat_id, chat.title, chat_data['members'])

                # Обновляем фото в данных администраторов
                admins_data = self.json_service.load_from_json('admins.json')
                if str(chat_id) in admins_data:
                    chat_admins = admins_data[str(chat_id)]
                    for admin in chat_admins.get('admins', []):
                        if str(admin.get('user_id')) == str(user.id):
                            admin['photo_url'] = photo_url
                            logger.info(f"Обновлено фото профиля для администратора {user.id}")
                    await self.json_service.save_admins(chat_id, chat.title, chat_admins['admins'])

                logger.info(f"✅ Успешно обновлены фотографии для пользователя {user.id} в чате {chat.title}")

        except Exception as e:
            logger.error(f"Ошибка при обновлении фото профиля: {str(e)}", exc_info=True)

    async def update_all_photos(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Периодическое обновление фотографий всех участников"""
        try:
            logger.info("🔄 Начало периодического обновления фотографий")
            
            # Загружаем данные о чатах и участниках
            members_data = self.json_service.load_from_json('members.json')
            admins_data = self.json_service.load_from_json('admins.json')
            
            for chat_id, chat_data in members_data.items():
                try:
                    chat_title = chat_data.get('chat_title', '')
                    logger.info(f"Обновление фотографий для чата {chat_title}")
                    
                    # Проверяем, является ли группа курьерской
                    is_courier = self.courier_service.is_courier_group(chat_title)
                    logger.info(f"Проверка группы '{chat_title}' на принадлежность к курьерам: {is_courier}")
                    
                    if is_courier:
                        # Для курьерских групп обновляем данные только в системе курьеров
                        members = await self._get_chat_members(chat_id)
                        admins = await self._get_chat_admins(chat_id, context)
                        
                        # Обновляем фото в списках
                        for member in members:
                            if not member.get('is_bot'):  # Пропускаем ботов
                                user_id = int(member.get('user_id'))
                                new_photo = await self._get_user_photo(user_id, context)
                                if new_photo and new_photo != member.get('photo_url'):
                                    member['photo_url'] = new_photo
                                    logger.info(f"Обновлено фото участника {user_id} в курьерской группе")
                        
                        for admin in admins:
                            if not admin.get('is_bot'):  # Пропускаем ботов
                                user_id = int(admin.get('user_id'))
                                new_photo = await self._get_user_photo(user_id, context)
                                if new_photo and new_photo != admin.get('photo_url'):
                                    admin['photo_url'] = new_photo
                                    logger.info(f"Обновлено фото администратора {user_id} в курьерской группе")
                        
                        # Сохраняем обновленные данные
                        await self.courier_service.save_group_data(
                            chat_id=chat_id,
                            chat_title=chat_title,
                            members=members,
                            admins=admins
                        )
                        logger.info(f"✅ Успешно обновлены фотографии в курьерской группе {chat_title}")
                    else:
                        # Для обычных групп обновляем данные в общие файлы
                        members = await self._get_chat_members(chat_id)
                        admins = await self._get_chat_admins(chat_id, context)
                        
                        # Обновляем фото в списках
                        for member in members:
                            if not member.get('is_bot'):  # Пропускаем ботов
                                user_id = int(member.get('user_id'))
                                new_photo = await self._get_user_photo(user_id, context)
                                if new_photo and new_photo != member.get('photo_url'):
                                    member['photo_url'] = new_photo
                                    logger.info(f"Обновлено фото участника {user_id} в группе")
                        
                        for admin in admins:
                            if not admin.get('is_bot'):  # Пропускаем ботов
                                user_id = int(admin.get('user_id'))
                                new_photo = await self._get_user_photo(user_id, context)
                                if new_photo and new_photo != admin.get('photo_url'):
                                    admin['photo_url'] = new_photo
                                    logger.info(f"Обновлено фото администратора {user_id} в группе")
                        
                        await self.json_service.save_members(chat_id, chat_title, members)
                        await self.json_service.save_admins(chat_id, chat_title, admins)
                        logger.info(f"✅ Успешно обновлены фотографии в группе {chat_title}")
                        
                except Exception as e:
                    logger.error(f"Ошибка при обновлении фотографий для чата {chat_id}: {e}")
                    continue
            
            logger.info("✅ Периодическое обновление фотографий завершено")
            
        except Exception as e:
            logger.error(f"Ошибка при периодическом обновлении фотографий: {e}", exc_info=True)

    async def handle_my_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик изменения статуса бота в чате"""
        try:
            chat = update.effective_chat
            old_status = update.my_chat_member.old_chat_member.status
            new_status = update.my_chat_member.new_chat_member.status
            
            # Проверяем, что бот был добавлен в группу
            if old_status in ['left', 'kicked'] and new_status in ['member', 'administrator']:
                logger.info(f"Бот добавлен в группу {chat.title}")
                await self._process_bot_added(chat, context)
                return
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Получаем список участников чата
            logger.info("Получение списка участников...")
            members = await self._get_chat_members(chat, context)
            logger.info(f"Получено {len(members)} участников")
            
            # Получаем список администраторов
            logger.info("Получение списка администраторов...")
            admins = await self._get_chat_admins(original_chat_id, context)
            logger.info(f"Получено {len(admins)} администраторов")
            
            if not members:
                logger.error("❌ Не удалось получить список участников")
            if not admins:
                logger.error("❌ Не удалось получить список администраторов")
            
            # Сохраняем данные о чате и участниках
            logger.info("Сохранение данных...")
            
            if is_courier:
                # Для курьерских групп сохраняем данные только в системе курьеров
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=members,
                    admins=admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно сохранены")
            else:
                # Для обычных групп сохраняем данные в общие файлы
                if members:
                    await self.json_service.save_members(original_chat_id, chat.title, members)
                    logger.info("✅ Список участников сохранен")
                if admins:
                    await self.json_service.save_admins(original_chat_id, chat.title, admins)
                    logger.info("✅ Список администраторов сохранен")
            
            logger.info(f"✅ Обработка изменения статуса бота в чате {chat.title} завершена")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения статуса бота: {e}")
            logger.error(traceback.format_exc())

    async def _notify_server_about_admin_update(self, chat_id: str, admins_data: dict) -> None:
        """Уведомление сервера об обновлении списка администраторов"""
        try:
            # Получаем стандартизированный ID чата для сохранения данных
            standardized_chat_id = await self._get_standardized_chat_id(chat_id)
            logger.info(f"Стандартизированный ID чата: {standardized_chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(standardized_chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Отправляем данные на сервер
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.server_url}/api/admin/update",
                    json={
                        "chat_id": original_chat_id,
                        "admins": admins_data
                    }
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Сервер успешно уведомлен об обновлении администраторов для чата {original_chat_id}")
                    else:
                        logger.error(f"❌ Ошибка при уведомлении сервера: {response.status}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при уведомлении сервера: {e}")
            logger.error(traceback.format_exc())

    def _register_handlers(self):
        """Регистрация обработчиков групповых событий"""
        try:
            # Регистрируем только обработчик NEW_CHAT_MEMBERS для добавления бота
            self.application.add_handler(
                MessageHandler(
                    filters.StatusUpdate.NEW_CHAT_MEMBERS,
                    self.handle_new_chat_members
                )
            )
            logger.info("✅ Обработчик добавления новых участников зарегистрирован")
            
            # Регистрируем обработчик изменения статуса участника
            self.application.add_handler(
                ChatMemberHandler(
                    self.handle_chat_member_update,
                    ChatMemberHandler.CHAT_MEMBER
                )
            )
            logger.info("✅ Обработчик изменения статуса участника зарегистрирован")
            
            # Регистрируем обработчик удаления участника
            self.application.add_handler(
                MessageHandler(
                    filters.StatusUpdate.LEFT_CHAT_MEMBER,
                    self.handle_left_chat_member
                )
            )
            logger.info("✅ Обработчик удаления участника зарегистрирован")
            
            # Регистрируем обработчик получения контакта
            self.application.add_handler(
                MessageHandler(
                    filters.CONTACT,
                    self.handle_contact
                )
            )
            logger.info("✅ Обработчик получения контакта зарегистрирован")
            
            # Регистрируем обработчик получения фото
            self.application.add_handler(
                MessageHandler(
                    filters.PHOTO,
                    self.handle_photo
                )
            )
            logger.info("✅ Обработчик получения фото зарегистрирован")
            
            # Регистрируем обработчик данных веб-приложения
            self.application.add_handler(
                MessageHandler(
                    filters.StatusUpdate.WEB_APP_DATA,
                    self.handle_webapp_data
                )
            )
            logger.info("✅ Обработчик данных веб-приложения зарегистрирован")

            # Регистрируем обработчик inline-кнопки "Записаться"
            self.application.add_handler(
                CallbackQueryHandler(
                    self.handle_register_callback,
                    pattern="^register_courier$"
                )
            )
            logger.info("✅ Обработчик inline-кнопки 'Записаться' зарегистрирован")
            
            logger.info("✅ Все обработчики групповых событий зарегистрированы")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при регистрации обработчиков: {e}")
            logger.error(traceback.format_exc())
            raise

    async def handle_contact(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик получения контакта от пользователя"""
        try:
            message = update.effective_message
            contact = message.contact
            user = message.from_user
            chat = message.chat
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Загружаем текущие данные из admins.json
            data = self.json_service.load_from_json('admins.json')
            success_count = 0
            
            # Обновляем информацию во всех чатах
            for chat_id, chat_data in data.items():
                try:
                    # Проверяем, является ли группа курьерской
                    is_courier = self.courier_service.is_courier_group(chat_data.get('chat_title', ''))
                    logger.info(f"Проверка группы '{chat_data.get('chat_title', '')}' на принадлежность к курьерам: {is_courier}")
                    
                    if is_courier:
                        # Для курьерских групп обновляем данные только в системе курьеров
                        members = await self._get_chat_members(chat_id)
                        admins = await self._get_chat_admins(original_chat_id, context)
                        
                        # Обновляем номер телефона для администратора
                        updated = False
                        for admin in admins:
                            if admin.get('user_id') == user.id:
                                admin['phone'] = contact.phone_number
                                updated = True
                                logger.info(f"✅ Обновлен контакт администратора в курьерской группе {chat_data.get('chat_title')}")
                                break
                        
                        if updated:
                            # Сохраняем обновленные данные только в системе курьеров
                            await self.courier_service.save_group_data(
                                chat_id=original_chat_id,
                                chat_title=chat_data.get('chat_title', ''),
                                members=members,
                                admins=admins
                            )
                            success_count += 1
                    else:
                        # Для обычных групп обновляем данные в общие файлы
                        admins = await self._get_chat_admins(original_chat_id, context)
                        
                        # Обновляем номер телефона для администратора
                        updated = False
                        for admin in admins:
                            if admin.get('user_id') == user.id:
                                admin['phone'] = contact.phone_number
                                updated = True
                                logger.info(f"✅ Обновлен контакт администратора в группе {chat_data.get('chat_title')}")
                                break
                        
                        if updated:
                            await self.json_service.save_admins(original_chat_id, chat_data.get('chat_title', ''), admins)
                            success_count += 1
                            
                except Exception as e:
                    logger.error(f"Ошибка при обновлении контакта в чате {chat_id}: {e}")
                    continue
            
            if success_count > 0:
                await message.reply_text(
                    f"✅ Контакт успешно сохранен в {success_count} группах.",
                    reply_markup=ReplyKeyboardRemove()
                )
            else:
                await message.reply_text(
                    "❌ Произошла ошибка при сохранении контакта. Пожалуйста, попробуйте позже.",
                    reply_markup=ReplyKeyboardRemove()
                )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке контакта: {e}")
            logger.error(traceback.format_exc())

    async def handle_photo(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик получения нового фото профиля"""
        try:
            message = update.effective_message
            user = message.from_user
            chat = message.chat
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Получаем новое фото профиля
            photo_url = await self._get_user_photo(user.id, context)
            if not photo_url:
                logger.warning(f"Не удалось получить новое фото профиля для пользователя {user.id}")
                return
            
            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            if is_courier:
                # Для курьерских групп обновляем данные только в системе курьеров
                members = await self._get_chat_members(chat, context)
                admins = await self._get_chat_admins(original_chat_id, context)
                
                # Обновляем фото в списках
                for member in members:
                    if str(member.get('user_id')) == str(user.id):
                        member['photo_url'] = photo_url
                        logger.info(f"Обновлено фото участника {user.id} в курьерской группе")
                
                for admin in admins:
                    if str(admin.get('user_id')) == str(user.id):
                        admin['photo_url'] = photo_url
                        logger.info(f"Обновлено фото профиля для администратора {user.id} в курьерской группе")
                
                # Сохраняем обновленные данные
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=members,
                    admins=admins
                )
                logger.info(f"✅ Успешно обновлены фотографии для пользователя {user.id} в курьерской группе {chat.title}")
            else:
                # Для обычных групп обновляем данные в общие файлы
                members = await self._get_chat_members(chat, context)
                admins = await self._get_chat_admins(original_chat_id, context)
                
                # Обновляем фото в списках
                for member in members:
                    if str(member.get('user_id')) == str(user.id):
                        member['photo_url'] = photo_url
                        logger.info(f"Обновлено фото участника {user.id} в группе")
                
                for admin in admins:
                    if str(admin.get('user_id')) == str(user.id):
                        admin['photo_url'] = photo_url
                        logger.info(f"Обновлено фото профиля для администратора {user.id} в группе")
                
                await self.json_service.save_members(original_chat_id, chat.title, members)
                await self.json_service.save_admins(original_chat_id, chat.title, admins)
                logger.info(f"✅ Успешно обновлены фотографии для пользователя {user.id} в чате {chat.title}")
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении фото профиля: {str(e)}", exc_info=True)

    async def handle_register_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик нажатия на inline-кнопку 'Записаться'"""
        try:
            query = update.callback_query
            user = query.from_user
            chat = query.message.chat

            if query.data != "register_courier":
                return

            logger.info(f"Пользователь {user.id} нажал inline-кнопку 'Записаться' в чате {chat.title}")

            # Получаем стандартизированный ID чата
            chat_id = await self._get_standardized_chat_id(chat.id)
            original_chat_id = await self._get_original_chat_id(chat_id)

            # Проверяем, является ли группа курьерской
            is_courier = self.courier_service.is_courier_group(chat.title)
            
            if is_courier:
                # Получаем текущие списки участников и администраторов
                members = await self._get_chat_members(chat, context)
                admins = await self._get_chat_admins(original_chat_id, context)

                # Получаем фото пользователя
                photo_url = await self._get_user_photo(user.id, context, force_update=True)

                # Создаем информацию о пользователе
                user_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': "",
                    'last_name': "",
                    'status': 'member',
                    'joined_date': datetime.now().isoformat(),
                    'is_bot': user.is_bot
                }

                if photo_url:
                    user_info['photo_url'] = photo_url

                # Проверяем, является ли пользователь администратором
                is_admin = any(admin['user_id'] == user.id for admin in admins)
                if is_admin:
                    user_info['status'] = 'administrator'

                # Обновляем или добавляем пользователя в список участников
                updated = False
                for member in members:
                    if member['user_id'] == user.id:
                        member.update(user_info)
                        updated = True
                        break

                if not updated:
                    members.append(user_info)

                # Сохраняем обновленные данные
                await self.courier_service.save_group_data(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=members,
                    admins=admins
                )

                # Обновляем список доступа к веб-приложению
                courier_access_file = os.path.join(self.json_service.data_dir, 'courier_webapp_access.json')
                try:
                    if os.path.exists(courier_access_file):
                        with open(courier_access_file, 'r', encoding='utf-8') as f:
                            access_data = json.load(f)
                    else:
                        access_data = {"groups": [], "members": []}

                    # Добавляем пользователя в список участников
                    if str(user.id) not in access_data["members"]:
                        access_data["members"].append(str(user.id))

                    # Сохраняем обновленные данные
                    with open(courier_access_file, 'w', encoding='utf-8') as f:
                        json.dump(access_data, f, indent=2, ensure_ascii=False)


                    # Отвечаем на callback query
                    await query.answer("Вы успешно зарегистрированы! Проверьте личные сообщения от бота.")

                    # Отправляем сообщение и видео-инструкцию пользователю в личку
                    try:
                        # Путь к видео-файлу
                        video_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'videos', 'vidioNinja.mp4')
                        
                        # Отправляем текстовое сообщение
                        await context.bot.send_message(
                            chat_id=user.id,
                            text="Теперь вы можете записаться на смену, используя кнопку 'Записаться' в меню бота."
                        )
                        
                        # Отправляем видео-сообщение
                        async with aiofiles.open(video_path, 'rb') as video_file:
                            video_data = await video_file.read()
                            await context.bot.send_video_note(
                                chat_id=user.id,
                                video_note=video_data,
                                disable_notification=True
                            )
                            logger.info(f"✅ Видео-инструкция успешно отправлена пользователю {user.id}")
                            
                    except Exception as e:
                        logger.warning(f"Не удалось отправить сообщение пользователю {user.id}: {str(e)}")
                        # Отправляем сообщение в группу, если не удалось отправить в личку
                        await context.bot.send_message(
                            chat_id=chat.id,
                            text=f"@{user.username}, пожалуйста, начните диалог с ботом, чтобы получить доступ к функциям записи.",
                            reply_to_message_id=query.message.message_id
                        )

                except Exception as e:
                    logger.error(f"Ошибка при обновлении списка доступа: {str(e)}")
                    await query.answer("Произошла ошибка. Пожалуйста, попробуйте позже.")

        except Exception as e:
            logger.error(f"Ошибка при обработке нажатия inline-кнопки 'Записаться': {str(e)}")
            logger.error(traceback.format_exc())
            try:
                await query.answer("Произошла ошибка. Пожалуйста, попробуйте позже.")
            except:
                pass