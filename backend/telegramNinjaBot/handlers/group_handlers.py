import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from telegram import Update, ChatMember, Bot, Chat, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, BotCommand, MenuButton, MenuButtonWebApp, User
from telegram.constants import ChatMemberStatus, ChatType, MenuButtonType
from telegram.ext import ContextTypes, MessageHandler, filters, ChatMemberHandler, CommandHandler, Application, CallbackQueryHandler
import random
import time
import telegram.error
import httpx
import aiofiles
import asyncio
from telegramNinjaBot.config.config import Config
from telegramNinjaBot.services.database_service import DatabaseService
import traceback
import re
from pathlib import Path
import uuid
import tempfile

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
    def __init__(self, application: Application, db_service: DatabaseService):
        """Инициализация обработчика групповых событий"""
        self.application = application
        self.db_service = db_service # Сохраняем db_service
        self.bot_id = None  # Инициализируем как None, получим позже
        self.photo_cache = {}  # Инициализируем кэш фотографий
        self.excel_requests = {}  # Хранилище для запросов Excel файлов
        # --- НАЧАЛО ИЗМЕНЕНИЙ ---
        self._processed_new_member_events = set() # Множество для отслеживания обработанных добавлений участников
        self._processed_events = set() # Множество для отслеживания общих событий (например, добавление бота)
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---
        # Регистрируем обработчики
        self._register_handlers()
        
        logger.info("✅ GroupHandler инициализирован (без CourierGroupService)")
    



    async def _clear_processed_groups(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Очистка множества обработанных групп"""
        try:
            if hasattr(self, 'processed_groups'):
                self.processed_groups.clear()
                logger.info("✅ Множество обработанных групп очищено")
        except Exception as e:
            logger.error(f"❌ Ошибка при очистке множества обработанных групп: {str(e)}")
    

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
            is_courier = self.db_service.is_group_of_type(chat.title, "courier")
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Получаем текущие списки участников и администраторов
            current_members = await self._get_chat_members(chat, context)
            current_admins = await self._get_chat_admins(original_chat_id, context)
            
          

            # Обрабатываем каждого нового участника
            for new_member in new_members:
                if new_member.is_bot:  # Пропускаем ботов
                    continue

                # --- НАЧАЛО ИЗМЕНЕНИЙ (Дедупликация) ---
                if update.message: # Убедимся, что есть сообщение для ID
                    event_id = f"new_member_{chat.id}_{new_member.id}_{update.message.message_id}"
                    if event_id in self._processed_new_member_events:
                        logger.info(f"Событие добавления участника {event_id} уже обработано, пропускаем.")
                        continue
                    self._processed_new_member_events.add(event_id)
                else:
                    # Если нет update.message, используем временную метку для примерной дедупликации
                    # Это менее надежно, но лучше, чем ничего
                    timestamp_now = int(time.time())
                    event_id_fallback = f"new_member_{chat.id}_{new_member.id}_{timestamp_now // 5}" # Группируем события в 5-секундные окна
                    if event_id_fallback in self._processed_new_member_events:
                         logger.info(f"Событие добавления участника {event_id_fallback} (по временной метке) уже обработано, пропускаем.")
                         continue
                    self._processed_new_member_events.add(event_id_fallback)
                 # --- КОНЕЦ ИЗМЕНЕНИЙ (Дедупликация) ---

                # --- НАЧАЛО ИЗМЕНЕНИЙ (Приветствие без клавиатуры) ---
                # Отправляем приветственное сообщение без кнопок
                try:
                    # Измененный текст приветствия
                    welcome_message = f"👋 Добро пожаловать в группу '{chat.title}', {new_member.mention_html()}!"
                    await context.bot.send_message(
                        chat_id=chat.id, # Используем ID из объекта чата
                        text=welcome_message,
                        parse_mode='HTML'
                        # Клавиатура регистрации удалена
                    )
                    logger.info(f"Отправлено приветствие для {new_member.username or new_member.id} в чат {chat.title}")
                except telegram.error.BadRequest as e:
                    # Попытка 2 с original_chat_id (на всякий случай)
                    if "chat not found" in str(e).lower():
                         logger.warning(f"Не удалось отправить приветствие с chat_id={chat.id} (Chat not found), пробую original_chat_id={original_chat_id}")
                         try:
                              await context.bot.send_message(
                                   chat_id=original_chat_id,
                                   text=welcome_message, # Используем новый текст
                                   parse_mode='HTML'
                                   # Клавиатура регистрации удалена
                              )
                              logger.info(f"Отправлено приветствие для {new_member.username or new_member.id} в чат {chat.title} (со второй попытки с original_chat_id)")
                         except Exception as e2:
                              logger.error(f"Ошибка отправки приветствия для {new_member.username or new_member.id} в чат {chat.id} (попытка 2 с original_chat_id): {e2}")
                    else:
                        logger.error(f"Ошибка отправки приветствия для {new_member.username or new_member.id} в чат {chat.id}: {e}")
                except Exception as e:
                    logger.error(f"Непредвиденная ошибка при отправке приветствия: {e}")
                # --- КОНЕЦ ИЗМЕНЕНИЙ (Приветствие и клавиатура) ---

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
                # Для курьерских групп сохраняем в системе курьеров (теперь только в БД)
                await self.db_service.save_group(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=current_members,
                    admins=current_admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно обновлены в БД")
            else:
                # Для обычных групп - если нужно сохранять их в БД, делаем так же
                logger.info(f"Сохранение НЕ курьерской группы {chat.title} в БД...")
                await self.db_service.save_group(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=current_members,
                    admins=current_admins
                )
                logger.info(f"✅ Данные НЕ курьерской группы {chat.title} успешно сохранены в БД")
            
            # --- НАЧАЛО ИЗМЕНЕНИЙ: Удаляем вызов старой функции ---
            # # Обновляем клавиатуру после обработки всех новых участников
            # if any(not member.is_bot for member in new_members): # Обновляем, только если были добавлены реальные пользователи
            #     await self._update_registration_keyboard(chat, context)
            # --- КОНЕЦ ИЗМЕНЕНИЙ: Удаляем вызов старой функции ---

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
            is_courier = self.db_service.is_group_of_type(chat.title, "courier")
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
                # Для курьерских групп сохраняем в системе курьеров (теперь только в БД)
                await self.db_service.save_group(
                    chat_id=original_chat_id,
                    chat_title=chat.title,
                    members=current_members,
                    admins=current_admins
                )
                logger.info(f"✅ Данные курьерской группы {chat.title} успешно обновлены в БД")

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения статуса участника: {e}")
            logger.error(traceback.format_exc())

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

    async def _get_user_photo(self, user_id: int, context: ContextTypes.DEFAULT_TYPE, force_update: bool = False) -> Optional[str]:
        """Получение и сохранение фотографии пользователя на сервер"""
        try:
            # Путь к папке для сохранения фото пользователей
            photos_dir = Path("/app/shared/users-photo")
            photos_dir.mkdir(exist_ok=True)
            
            # Путь к файлу фото пользователя
            photo_filename = f"user_{user_id}.jpg"
            photo_path = photos_dir / photo_filename
            
            # Проверяем кэш и существующий файл
            cache_key = str(user_id)
            if not force_update and cache_key in self.photo_cache and photo_path.exists():
                logger.info(f"Возвращаем фото из кэша для пользователя {user_id}")
                return self.photo_cache[cache_key]
            
            # Получаем фотографии пользователя из Telegram
            photos = await context.bot.get_user_profile_photos(user_id, limit=1)
            
            if photos and photos.photos:
                # Берем последнюю фотографию
                photo = photos.photos[0][-1]  # Берем файл с максимальным размером
                
                # Получаем файл из Telegram
                file = await context.bot.get_file(photo.file_id)
                
                # Скачиваем файл на сервер
                await file.download_to_drive(custom_path=photo_path)
                
                # Формируем относительный путь для возврата
                relative_photo_path = f"/users-photo/{photo_filename}"
                
                # Сохраняем в кэш
                self.photo_cache[cache_key] = relative_photo_path
                
                logger.info(f"Фото пользователя {user_id} сохранено на сервер: {relative_photo_path}")
                return relative_photo_path
            
            logger.warning(f"Фотографии не найдены для пользователя {user_id}")
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при получении фото пользователя {user_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return None

    async def _get_chat_members(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка участников чата (без бота)."""
        try:
            logger.info(f"=== Получение участников чата {chat.title} ===")
            members = []
            bot_id = await self._get_bot_id(context) # Получаем ID бота

            # Получаем администраторов, чтобы добавить их
            admins_raw = None
            last_error = None
            successful_id = None
            # Получаем original_chat_id один раз
            original_chat_id_for_admins = await self._get_original_chat_id(await self._get_standardized_chat_id(chat.id))
            chat_id_formats = [chat.id, original_chat_id_for_admins] # Пробуем оба формата

            # logger.info(f"Попытка получить администраторов для _get_chat_members (пробую форматы: {chat_id_formats})")
            for format_id in chat_id_formats:
                 try:
                     admins_raw = await context.bot.get_chat_administrators(format_id)
                     successful_id = format_id
                     # logger.debug(f"Админы для _get_chat_members получены с ID: {successful_id}")
                     break
                 except telegram.error.BadRequest as e:
                     if "chat not found" in str(e).lower():
                         last_error = e
                         continue
                     else:
                         last_error = e
                         break
                 except Exception as e:
                     last_error = e
                     break
            
            if admins_raw is None:
                # Если не удалось получить админов ни с одним ID
                error_msg = f"Не удалось получить администраторов для чата {chat.title} ({chat.id}/{original_chat_id_for_admins}) в _get_chat_members."
                if last_error:
                     error_msg += f" Последняя ошибка: {last_error}"
                logger.error(error_msg)
                # Не поднимаем ошибку, просто возвращаем пустой список участников
                return [] 
            
            # logger.info(f"Обрабатываем {len(admins_raw)} админов для списка участников...")
            for admin_member in admins_raw:
                user = admin_member.user
                if user.id == bot_id: # Пропускаем бота
                    continue
                    
                photo_url = await self._get_user_photo(user.id, context)
                member_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': user.first_name or "",
                    'last_name': user.last_name or "",
                    'status': get_member_status(admin_member), # Используем get_member_status
                    'joined_date': datetime.now().isoformat(), # Дата условная, т.к. не знаем когда админ вступил
                    'is_bot': user.is_bot,
                    'photo_url': photo_url
                }
                members.append(member_info)
                logger.info(f"Добавлен администратор (как участник): {user.username or user.id}")

            # Здесь можно добавить логику получения обычных участников, если API позволит
            # На данный момент, для групп бот часто не может получить список всех участников
            # Поэтому пока ограничиваемся администраторами, которых можем получить

            logger.info(f"✅ Получены участники (администраторы) для чата {chat.title} (отфильтровано: {len(members)}). Бот исключен.")
            return members # Возвращаем список, где бота уже не должно быть
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка участников: {str(e)}")
            return []

    async def _get_chat_admins(self, chat_id: Union[int, str], context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка администраторов чата (без бота)."""
        admin_list = []
        bot_id = await self._get_bot_id(context) # Получаем ID бота
        
        try:
            # logger.info(f"Получение администраторов для чата {chat_id}") # Убрали лог, т.к. он дублируется ниже
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
            successful_id = None
            
            # Логируем начало попытки
            logger.info(f"Попытка получить администраторов для чата {chat_id} (пробую форматы: {chat_id_formats})")

            # Пробуем получить администраторов с разными форматами ID
            for format_id in chat_id_formats:
                try:
                    # logger.debug(f"Пробую получить админов с ID: {format_id}") # Убираем лог каждой попытки
                    admins = await context.bot.get_chat_administrators(format_id)
                    successful_id = format_id # Запоминаем успешный ID
                    break # Выходим из цикла при успехе
                except telegram.error.BadRequest as e:
                    # Игнорируем 'Chat not found' и пробуем следующий формат
                    if "chat not found" in str(e).lower():
                        last_error = e
                        continue
                    else:
                        # Другая ошибка BadRequest, сохраняем и выходим
                        last_error = e
                        break 
                except Exception as e:
                    last_error = e
                    break # Неожиданная ошибка, выходим
            
            if admins is not None and successful_id:
                 logger.info(f"✅ Администраторы успешно получены с ID: {successful_id}")
            else:
                # Если admins пустой или None после всех попыток
                if last_error:
                    logger.error(f"❌ Не удалось получить администраторов для чата {chat_id} после всех попыток. Последняя ошибка: {last_error}")
                    raise last_error # Поднимаем последнюю ошибку
                else:
                     logger.warning(f"Не удалось получить администраторов для чата {chat_id} (возможно, их нет или нет прав), ошибок не было.")
                return [] # Возвращаем пустой список, если не получили админов
            
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

    # --- НОВЫЙ МЕТОД для получения ID бота с кэшированием ---
    async def _get_bot_id(self, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Получает и кэширует ID бота."""
        if self.bot_id is None:
            try:
                me = await context.bot.get_me()
                self.bot_id = me.id
                logger.info(f"Получен и закэширован ID бота: {self.bot_id}")
            except Exception as e:
                logger.error(f"Не удалось получить ID бота: {e}")
                # В случае ошибки возвращаем 0 или другое значение, 
                # которое точно не совпадет с реальным user_id
                return 0 
        return self.bot_id
    # --- КОНЕЦ НОВОГО МЕТОДА ---

    async def _standardize_chat_id(self, chat_id: Union[int, str]) -> str:
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
        """Обработка добавления бота в чат. Только сохраняет данные."""
        try:
            logger.info(f"=== Начало обработки добавления бота в чат {chat.title} (только сохранение данных) ===")

            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")

            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")

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

            # Фильтруем бота перед сохранением
            bot_id = await self._get_bot_id(context)
            filtered_members = [m for m in members if m['user_id'] != bot_id]
            filtered_admins = [a for a in admins if a['user_id'] != bot_id]

            # Используем self.db_service для всех типов групп
            await self.db_service.save_group(
                chat_id=original_chat_id,
                chat_title=chat.title,
                members=filtered_members, # Сохраняем отфильтрованных участников
                admins=filtered_admins    # Сохраняем отфильтрованных админов
            )
            logger.info(f"✅ Отфильтрованные данные группы {chat.title} успешно сохранены в БД после добавления бота")

            # Отправляем специальное приветствие для групп инвентаризации
            group_type = self.db_service.determine_group_type(chat.title)
            if group_type == "inventory":
                await self._send_inventory_welcome_message(chat, context)
                
            # Автоматически связываем группу инвентаризации с chef группами (независимо от приветственного сообщения)
            if group_type == "inventory":
                await self._link_inventory_group_to_chef_groups(chat, context)

            # --- ДОБАВЛЯЕМ ПРИВЕТСТВИЕ ДЛЯ ГРУППЫ КОНКУРСОВ ---
            if chat.title and (chat.title.lower().strip() == "конкурсы" or "конкурс" in chat.title.lower()):
                welcome_text = (
                    "👋 Добро пожаловать в группу конкурсов!\n\n"
                    "📹 Для участия отправьте видео (до 2 ГБ) с подписью:\n"
                    "ФИ участника, филиал, и другую нужную информацию.\n\n"
                    "⚠️ Видео без подписи или превышающее 2 ГБ не принимается!"
                )
                await context.bot.send_message(chat_id=chat.id, text=welcome_text)
            
            # --- ДОБАВЛЯЕМ ПРИВЕТСТВИЕ ДЛЯ ГРУППЫ ЗАКУПОК ---
            if group_type == "purchasing":
                await self._send_purchasing_welcome_message(chat, context)

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке добавления бота (сохранение данных): {str(e)}")
            logger.error(traceback.format_exc())

    async def _link_inventory_group_to_chef_groups(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Автоматически связывает группу инвентаризации с chef группами"""
        try:
            inventory_group_id = str(chat.id)
            
            # Проверяем дедупликацию - создаем уникальный ключ для этого события
            link_event_key = f"inventory_link_{inventory_group_id}"
            current_time = asyncio.get_event_loop().time()
            
            # Проверяем, было ли уже выполнено связывание в течение последних 300 секунд (5 минут)
            if hasattr(self, '_link_events'):
                if link_event_key in self._link_events:
                    last_link_time = self._link_events[link_event_key]
                    if current_time - last_link_time < 300:  # 5 минут
                        logger.info(f"🔗 Связывание группы инвентаризации '{chat.title}' с chef группами уже было выполнено недавно, пропускаем")
                        return
            else:
                self._link_events = {}
            
            logger.info(f"🔗 Начинаю автоматическое связывание группы инвентаризации '{chat.title}' (ID: {inventory_group_id}) с chef группами")
            
            # Получаем все chef группы
            chef_groups = await self.db_service.get_groups_by_type("chef")
            
            if not chef_groups:
                logger.info(f"🔗 Не найдено chef групп для связывания с группой инвентаризации '{chat.title}'")
                return
                
            logger.info(f"🔗 Найдено {len(chef_groups)} chef групп для связывания")
            
            # Обновляем метаданные каждой chef группы
            linked_count = 0
            for chef_group in chef_groups:
                chef_group_id = str(chef_group.get('group_id'))
                chef_group_title = chef_group.get('title', 'Unknown')
                
                # Обновляем метаданные chef группы
                metadata_updates = {
                    "inventory_management_group_id": inventory_group_id
                }
                
                success = await self.db_service.update_group_metadata(chef_group_id, metadata_updates)
                
                if success:
                    linked_count += 1
                    logger.info(f"✅ Chef группа '{chef_group_title}' (ID: {chef_group_id}) успешно связана с группой инвентаризации '{chat.title}'")
                else:
                    logger.error(f"❌ Не удалось связать chef группу '{chef_group_title}' (ID: {chef_group_id}) с группой инвентаризации '{chat.title}'")
            
            if linked_count > 0:
                logger.info(f"🎉 Группа инвентаризации '{chat.title}' автоматически связана с {linked_count} chef группами")
                # Сохраняем время выполнения связывания
                self._link_events[link_event_key] = current_time
            else:
                logger.warning(f"⚠️ Не удалось связать группу инвентаризации '{chat.title}' ни с одной chef группой")
                
        except Exception as e:
            logger.error(f"❌ Ошибка при автоматическом связывании группы инвентаризации '{chat.title}' с chef группами: {e}")
            logger.error(traceback.format_exc())

    async def _send_inventory_welcome_message(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет приветственное сообщение для групп инвентаризации"""
        try:
            # Проверяем дедупликацию - создаем уникальный ключ для этого события
            event_key = f"inventory_welcome_{chat.id}"
            current_time = asyncio.get_event_loop().time()
            
            # Проверяем, было ли уже отправлено приветствие в течение последних 60 секунд
            if hasattr(self, '_welcome_events'):
                if event_key in self._welcome_events:
                    last_sent_time = self._welcome_events[event_key]
                    if current_time - last_sent_time < 60:  # 60 секунд
                        logger.info(f"Приветственное сообщение для группы инвентаризации '{chat.title}' уже было отправлено недавно, пропускаем")
                        return
            else:
                self._welcome_events = {}
            
            # Отправляем информационное сообщение о функциях бота
            welcome_text = (
                "🤖 Я помогу вам автоматически обновлять шаблоны инвентаризации на основе Excel-файлов от бухгалтерии.\n\n"
                "📋 **Что я умею:**\n"
                "• 📊 Автоматически обрабатывать Excel-файлы (.xlsx)\n"
                "• ✅ Сопоставлять новые товары с существующими\n"
                "• 🆕 Добавлять новые позиции в систему\n"
                "• 📈 Обновлять шаблоны инвентаризации\n"
                "• 🔄 Поддерживать актуальность данных\n\n"
                "📤 **Как пользоваться:**\n"
                "Просто отправьте Excel-файл в эту группу, и я автоматически его обработаю!\n\n"
                "⚠️ **Важно:** Поддерживаются только файлы формата .xlsx\n\n"
                "🆘 При возникновении проблем обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
            )
            
            await context.bot.send_message(
                chat_id=chat.id,
                text=welcome_text,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
            # Сохраняем время отправки для предотвращения дублирования
            self._welcome_events[event_key] = current_time
            logger.info(f"✅ Отправлено информационное сообщение для группы инвентаризации: {chat.title}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке приветственного сообщения для группы инвентаризации: {e}")

    async def _send_purchasing_welcome_message(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет приветственное сообщение для групп закупок"""
        try:
            # Проверяем дедупликацию - создаем уникальный ключ для этого события
            event_key = f"purchasing_welcome_{chat.id}"
            current_time = asyncio.get_event_loop().time()
            
            # Проверяем, было ли уже отправлено приветствие в течение последних 60 секунд
            if hasattr(self, '_welcome_events'):
                if event_key in self._welcome_events:
                    last_sent_time = self._welcome_events[event_key]
                    if current_time - last_sent_time < 60:  # 60 секунд
                        logger.info(f"Приветственное сообщение для группы закупок '{chat.title}' уже было отправлено недавно, пропускаем")
                        return
            else:
                self._welcome_events = {}
            
            # Отправляем информационное сообщение о функциях бота для отдела закупок
            welcome_text = (
                "🛒 **Добро пожаловать в группу отдела закупок!**\n\n"
                "🤖 Я буду автоматически информировать вас о всех поставках.\n\n"
                "📋 **Что вы будете получать:**\n"
                "• 📦 Уведомления о принятых поставках\n"
                "• 🏢 Информацию о поставщиках\n"
                "• 📊 Детали по каждому товару и количеству\n"
                "• ⚠️ Информацию о проблемах с поставками\n"
                "• ✅ Статус соответствия накладным\n"
                "• 📍 Информацию о филиалах\n"
                "• 👤 Данные о том, кто принял поставку\n\n"
                "⚡ **Уведомления приходят автоматически** сразу после принятия поставки поваром!\n\n"
                "📈 Это позволит вам оперативно отслеживать все поставки и работать с поставщиками более эффективно.\n\n"
                "🆘 При возникновении вопросов обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
            )
            
            await context.bot.send_message(
                chat_id=chat.id,
                text=welcome_text,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
            # Сохраняем время отправки для предотвращения дублирования
            self._welcome_events[event_key] = current_time
            logger.info(f"✅ Отправлено информационное сообщение для группы закупок: {chat.title}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке приветственного сообщения для группы закупок: {e}")

    async def handle_left_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик удаления участника из чата"""
        try:
            chat = update.effective_chat
            user = update.message.left_chat_member if update.message else None
            
            if not user:
                logger.warning("Не удалось определить пользователя, покинувшего чат.")
                return

            # Пропускаем, если бот сам себя удалил (это обрабатывается в handle_my_chat_member)
            if user.id == context.bot.id:
                logger.info("Бот покинул чат, обработка в handle_my_chat_member.")
                return

            logger.info(f"Участник {user.username or user.id} покинул чат {chat.title} (ID: {chat.id})")

            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            # logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            # logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # --- НОВАЯ ЛОГИКА ---
            # Вызываем метод сервиса базы данных для удаления пользователя и его данных из группы
            db_service = self.db_service # Используем сохраненный сервис
            if db_service:
                logger.info(f"Вызов удаления участника user_id: {user.id} из группы chat_id: {original_chat_id} через DatabaseService...")
                deleted = await db_service.remove_member_from_group(original_chat_id, user.id)
                if deleted:
                    logger.info(f"Удаление участника {user.id} из группы {original_chat_id} в БД прошло успешно.")
                else:
                    logger.warning(f"Удаление участника {user.id} из группы {original_chat_id} в БД не выполнено (возможно, уже удален или ошибка).")
            else:
                 logger.error("DatabaseService не инициализирован или недоступен в application при обработке выхода участника.")

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке выхода участника: {e}")
            logger.error(traceback.format_exc())

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
          
    async def handle_profile_photo_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка обновления фотографии профиля"""
        try:
            if not update.message or not update.message.from_user:
                return

            user = update.message.from_user
            chat = update.effective_chat
            chat_id = await self._get_standardized_chat_id(chat.id)

            # Проверяем, является ли группа курьерской
            is_courier = self.db_service.is_group_of_type(chat.title, "courier")
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")

            # Получаем новое фото профиля
            photo_url = await self._get_user_photo(user.id, context)
            if not photo_url:
                logger.warning(f"Не удалось получить новое фото профиля для пользователя {user.id}")
                return

            if is_courier:
                # Для курьерских групп обновляем данные только в системе курьеров
                members = await self._get_chat_members(chat, context)
                admins = await self._get_chat_admins(chat_id, context)
                
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
                await self.db_service.save_group(
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
            logger.info("🚀 Запуск периодического обновления фотографий...")
            
            # Получаем все группы из БД
            all_groups_data = await self.db_service.get_all_groups()

            if not all_groups_data:
                logger.info("Нет групп для обновления фотографий.")
                return

            updated_photos_count = 0
            for group in all_groups_data:
                chat_id = group.get('chat_id')
                chat_title = group.get('title')
                members = group.get('members')
                
                if not members or not chat_id:
                    continue
                    
                logger.info(f"Обновление фото для группы '{chat_title}' ({chat_id})...")
                try:
                    # Получаем текущие данные о группе
                    current_members = await self._get_chat_members(chat_id)
                    current_admins = await self._get_chat_admins(chat_id, context)
                    
                    # Обновляем фотографии для каждого участника
                    for member in current_members:
                        if not member.get('is_bot'):
                            user_id = int(member.get('user_id'))
                            new_photo = await self._get_user_photo(user_id, context)
                            if new_photo and new_photo != member.get('photo_url'):
                                member['photo_url'] = new_photo
                                logger.info(f"Обновлено фото участника {user_id} в группе {chat_title}")
                    
                    for admin in current_admins:
                        if not admin.get('is_bot'):
                            user_id = int(admin.get('user_id'))
                            new_photo = await self._get_user_photo(user_id, context)
                            if new_photo and new_photo != admin.get('photo_url'):
                                admin['photo_url'] = new_photo
                                logger.info(f"Обновлено фото администратора {user_id} в группе {chat_title}")
                    
                    # Сохраняем обновленные данные через db_service
                    await self.db_service.save_group(
                        chat_id=chat_id,
                        chat_title=chat_title,
                        members=current_members,
                        admins=current_admins
                    )
                    logger.info(f"✅ Успешно обновлены фотографии в группе {chat_title}")
                    updated_photos_count += 1
                except Exception as e:
                    logger.error(f"Ошибка при обновлении фотографий для чата {chat_id}: {e}")
                    continue
            
            logger.info(f"✅ Периодическое обновление фотографий завершено. Обновлено фотографий: {updated_photos_count}")
            
        except Exception as e:
            logger.error(f"Ошибка при периодическом обновлении фотографий: {e}", exc_info=True)

    async def handle_my_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка обновления статуса бота в чате (добавление, удаление, изменение прав)."""
        try:
            chat_member_update = update.my_chat_member
            if not chat_member_update:
                logger.warning("Получено обновление ChatMember, но my_chat_member отсутствует.")
                return

            chat = chat_member_update.chat
            old_member = chat_member_update.old_chat_member
            new_member = chat_member_update.new_chat_member

            old_status = old_member.status if old_member else None
            new_status = new_member.status if new_member else None

            chat_title_safe = chat.title.replace("'", "\\'") if chat.title else "" # Экранируем кавычки для логов
            logger.info(f"=== Обновление статуса бота в чате '{chat_title_safe}' (ID: {chat.id}) ===")
            logger.info(f"Старый статус: {old_status}, Новый статус: {new_status}")

            standardized_chat_id = await self._get_standardized_chat_id(chat.id)
            original_chat_id = await self._get_original_chat_id(standardized_chat_id)

            # --- Обработка добавления бота в группу (отправка приветствий для различных типов групп) ---
            if new_status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR]:
                await self._process_bot_added(chat, context)
                if new_status == ChatMemberStatus.MEMBER and old_status not in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR]:
                    is_courier = self.db_service.is_group_of_type(chat.title, "courier")
                    logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам для отправки приветствия при первом добавлении: {is_courier}")
                    if is_courier:
                        # Кнопка регистрации удалена - больше не создаем клавиатуру
                        try:
                            logger.info(f"Попытка отправить приветственное сообщение (первое добавление) в чат {chat.id} из handle_my_chat_member")
                            message = await context.bot.send_message(
                                chat_id=chat.id, # Используем chat.id из объекта update
                                text=(
                                    f"👋 Приветствую участников группы {chat.title}!\n\n"
                                    "Я помогу с записью на смены и другими задачами группы."
                                )
                                # Кнопка регистрации удалена
                            )
                            logger.info(f"✅ Приветственное сообщение (первое добавление) успешно отправлено в группу {chat.title} (ID: {chat.id})")
                        except telegram.error.BadRequest as e:
                            if "chat not found" in str(e).lower():
                                logger.warning(f"Не удалось отправить приветствие с chat_id={chat.id} (Chat not found), пробую original_chat_id={original_chat_id}")
                                try:
                                    message = await context.bot.send_message(
                                        chat_id=original_chat_id, 
                                        text=(
                                            f"👋 Приветствую участников группы {chat.title}!\n\n"
                                            "Я помогу с записью на смены и другими задачами группы."
                                        )
                                        # Кнопка регистрации удалена
                                    )
                                    logger.info(f"✅ Приветственное сообщение (первое добавление) успешно отправлено в группу {chat.title} (ID: {original_chat_id})")
                                except Exception as e2:
                                    logger.error(f"❌ Ошибка при отправке приветственного сообщения с Reply кнопкой (попытка 2 с original_chat_id) в чате {original_chat_id}: {str(e2)}")
                                    logger.error(traceback.format_exc())
                            else:
                                logger.error(f"❌ Ошибка BadRequest при отправке приветственного сообщения с Reply кнопкой в чате {chat.id}: {str(e)}")
                                logger.error(traceback.format_exc())
                        except Exception as e:
                            logger.error(f"❌ Непредвиденная ошибка при отправке приветственного сообщения с Reply кнопкой в чате {chat.id}: {str(e)}")
                            logger.error(traceback.format_exc())
                    else:
                        logger.info("Приветственное сообщение не отправляется (бот уже был в чате или повышен до админа, либо это не курьерская группа).")
            elif new_status in [ChatMemberStatus.LEFT, ChatMemberStatus.BANNED]:
                logger.warning(f"Бота ({self.bot_id}) удалили (статус: {new_status}) из чата '{chat_title_safe}' ({original_chat_id}).")
                await self._delete_group_data(original_chat_id, chat.title)
            else:
                logger.info(f"Статус бота ({self.bot_id}) в чате '{chat_title_safe}' ({chat.id}) изменен с {old_status} на {new_status}. Это изменение не требует специальных действий в handle_my_chat_member.")
        except Exception as e:
            chat_id_for_error = update.effective_chat.id if update.effective_chat else "Неизвестно"
            logger.error(f"❌ Ошибка в handle_my_chat_member для чата {chat_id_for_error}: {e}")
            logger.error(traceback.format_exc())
            
    async def _delete_group_data(self, chat_id: str, chat_title: str) -> None:
        """Удаляет все данные, связанные с группой, из БД."""
        # Используем f-string аккуратно
        chat_title_safe = chat_title.replace("'", "\\'") # Экранируем кавычки для логов
        logger.warning(f"=== ЗАПУСК УДАЛЕНИЯ ДАННЫХ для группы '{chat_title_safe}' (ID: {chat_id}) ===" )
        try:
            # 1. Удаление из базы данных (через DatabaseService)
            db_service = self.db_service # Используем сохраненный сервис
            if db_service:
                logger.info(f"Вызов удаления данных из БД для чата {chat_id} через DatabaseService...")
                # Используем новый асинхронный метод delete_group
                deleted = await db_service.delete_group(chat_id)
                if deleted:
                    logger.info(f"✅ Данные группы '{chat_title}' (ID: {chat_id}) успешно удалены из БД.")
                else:
                    logger.warning(f"Удаление из БД для чата {chat_id} не выполнено (возможно, группа уже удалена или произошла ошибка).")
            else:
                logger.error("DatabaseService не инициализирован или недоступен в application.")

            logger.warning(f"✅ УДАЛЕНИЕ ДАННЫХ для группы '{chat_title_safe}' (ID: {chat_id}) ЗАВЕРШЕНО." )

        except Exception as e:
            # Используем f-string аккуратно
            logger.error(f"❌ Ошибка при удалении данных для группы '{chat_title_safe}' (ID: {chat_id}): {e}")
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

            
            # Регистрируем обработчик кнопки синхронизации шаблонов
            self.application.add_handler(
                CallbackQueryHandler(
                    self.handle_sync_templates_callback,
                    pattern="^sync_templates$"
                )
            )
            logger.info("✅ Обработчик кнопки синхронизации шаблонов зарегистрирован")
            

            # --- НОВЫЙ ОБРАБОТЧИК EXCEL ДОКУМЕНТОВ ---
            # Обработчик Excel файлов для групп инвентаризации
            self.application.add_handler(
                MessageHandler(
                    filters.Document.FileExtension("xlsx") & filters.ChatType.GROUPS,
                    self.handle_excel_document
                )
            )
            logger.info("✅ Обработчик Excel документов зарегистрирован")
            
            # Обработчик кнопок подтверждения Excel
            self.application.add_handler(
                CallbackQueryHandler(
                    self.handle_excel_confirmation_callback,
                    pattern="^(confirm_excel|skip_excel):"
                )
            )
            logger.info("✅ Обработчик кнопок подтверждения Excel зарегистрирован")
            # --- КОНЕЦ ДОБАВЛЕНИЯ ---

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
            is_courier = self.db_service.is_group_of_type(chat.title, "courier")
            logger.info(f"Проверка группы '{chat.title}' на принадлежность к курьерам: {is_courier}")
            
            # Загружаем текущие данные из admins.json
            data = self.json_service.load_from_json('admins.json')
            success_count = 0
            
            # Обновляем информацию во всех чатах (этот цикл теперь не нужен или должен работать с БД)
            # Заменяем или удаляем цикл, так как он полагался на JSON
            # Вместо этого обновляем только для текущего чата в БД
            
            current_admins = await self._get_chat_admins(original_chat_id, context)
            updated_in_db = False
            for admin in current_admins:
                 if admin.get('user_id') == user.id:
                     admin['phone'] = contact.phone_number # Добавляем поле phone
                     updated_in_db = True
                     logger.info(f"✅ Обновлен контакт администратора user_id: {user.id} в данных группы chat_id: {original_chat_id}")
                     break

            if updated_in_db:
                 # Сохраняем обновленные данные администраторов в БД для текущей группы
                 # Предполагаем, что save_group обновит админов, если передать только их
                 await self.db_service.save_group(
                     chat_id=original_chat_id,
                     chat_title=chat.title, # Получаем актуальное название
                     members=await self._get_chat_members(chat, context), # Передаем текущих участников
                     admins=current_admins # Передаем обновленных админов
                 )
                 success_count = 1 # Обновили в одной группе (текущей)

            if success_count > 0:
                await message.reply_text(
                    f"✅ Контакт успешно сохранен.", # Убрали кол-во групп
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
            is_courier = self.db_service.is_group_of_type(chat.title, "courier")
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
                await self.db_service.save_group(
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
            # is_courier = self.db_service.is_group_of_type(chat.title, "courier") # Проверка здесь не нужна, раз кнопка есть

            # --- Обновляем данные пользователя в БД ---
            members = await self._get_chat_members(chat, context)
            admins = await self._get_chat_admins(original_chat_id, context)
            photo_url = await self._get_user_photo(user.id, context, force_update=True)

            user_info = {
                'user_id': user.id,
                'username': user.username,
                'first_name': user.first_name or "", # Добавили first_name
                'last_name': user.last_name or "",   # Добавили last_name
                'status': 'member',
                'joined_date': datetime.now().isoformat(),
                'is_bot': user.is_bot,
                'photo_url': photo_url # Добавили photo_url
            }

            is_admin = any(admin['user_id'] == user.id for admin in admins)
            if is_admin:
                user_info['status'] = 'administrator'

            updated = False
            for member in members:
                if member['user_id'] == user.id:
                    # Обновляем только необходимые поля, не перезаписывая статус если он админ
                    member['username'] = user_info['username']
                    member['first_name'] = user_info['first_name']
                    member['last_name'] = user_info['last_name']
                    member['photo_url'] = user_info['photo_url']
                    if not member.get('status') or member['status'] != 'administrator': # Не понижаем админа до member
                         member['status'] = user_info['status']
                    updated = True
                    break

            if not updated:
                members.append(user_info)

            await self.db_service.save_group(
                chat_id=original_chat_id,
                chat_title=chat.title,
                members=members,
                admins=admins
            )
            # --- Конец обновления данных ---

            # Отвечаем на callback query
            await query.answer("Вы успешно зарегистрированы! Проверьте личные сообщения от бота.")

            # Отправляем сообщение и видео-инструкцию пользователю в личку
            try:
                # --- ИСПРАВЛЕН ПУТЬ К ВИДЕО ---
                video_path = '/app/data/videos/vidioNinja.mp4' # Используем абсолютный путь внутри контейнера

                # Отправляем текстовое сообщение
                await context.bot.send_message(
                    chat_id=user.id,
                    text="Теперь вы можете записаться на смену, используя кнопку 'Записаться' в меню бота."
                )

                # Отправляем видео-сообщение
                if os.path.exists(video_path): # Проверяем, существует ли файл
                    async with aiofiles.open(video_path, 'rb') as video_file:
                        video_data = await video_file.read()
                        await context.bot.send_video_note(
                            chat_id=user.id,
                            video_note=video_data,
                            disable_notification=True
                        )
                        logger.info(f"✅ Видео-инструкция успешно отправлена пользователю {user.id}")
                else:
                    logger.error(f"❌ Видеофайл не найден по пути: {video_path}")
                    # Можно отправить сообщение об ошибке пользователю или просто пропустить видео
                    await context.bot.send_message(
                         chat_id=user.id,
                         text="К сожалению, не удалось отправить видеоинструкцию."
                     )

            except telegram.error.Forbidden:
                 logger.warning(f"Не удалось отправить сообщение/видео пользователю {user.id}: Бот заблокирован или чат не начат.")
                 # Отправляем сообщение в группу, если не удалось отправить в личку
                 await context.bot.send_message(
                     chat_id=chat.id,
                     text=f"@{user.username}, пожалуйста, начните диалог с ботом (и разблокируйте его, если нужно), чтобы получить инструкцию и доступ к функциям записи.",
                     reply_to_message_id=query.message.message_id
                 )
            except FileNotFoundError: # Обработка если путь все же неверный
                 logger.error(f"❌ Видеофайл не найден по пути: {video_path}")
                 await context.bot.send_message(
                     chat_id=user.id,
                     text="К сожалению, не удалось отправить видеоинструкцию (файл не найден)."
                 )
            except Exception as e:
                logger.warning(f"Не удалось отправить сообщение/видео пользователю {user.id}: {str(e)}")
                # Можно также отправить сообщение в группу
                await context.bot.send_message(
                    chat_id=chat.id,
                    text=f"@{user.username}, произошла ошибка при отправке инструкции в личные сообщения. Пожалуйста, убедитесь, что вы начали диалог с ботом.",
                    reply_to_message_id=query.message.message_id
                )

        except Exception as e:
            logger.error(f"Ошибка при обработке нажатия inline-кнопки 'Записаться': {str(e)}")
            logger.error(traceback.format_exc())
            try:
                await query.answer("Произошла ошибка. Пожалуйста, попробуйте позже.")
            except:
                pass

    # --- НОВЫЙ МЕТОД ДЛЯ РЕГИСТРАЦИИ ПОЛЬЗОВАТЕЛЯ ---
    async def _register_user_in_group(self, user: User, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> bool:
        """Регистрирует пользователя в группе (обновляет данные, отправляет ЛС)."""
        try:
            logger.info(f"Начало регистрации пользователя {user.id} ({user.username}) в группе {chat.title} ({chat.id})")
            original_chat_id = await self._get_original_chat_id(await self._get_standardized_chat_id(chat.id))

            # --- Получение и сохранение данных (аналогично handle_register_callback) ---
            members = await self._get_chat_members(chat, context)
            admins = await self._get_chat_admins(original_chat_id, context)
            photo_url = await self._get_user_photo(user.id, context, force_update=True)

            user_info = {
                'user_id': user.id,
                'username': user.username,
                'first_name': user.first_name or "",
                'last_name': user.last_name or "",
                'status': 'member',
                'joined_date': datetime.now().isoformat(),
                'is_bot': user.is_bot,
                'photo_url': photo_url
            }

            is_admin = any(admin['user_id'] == user.id for admin in admins)
            if is_admin:
                user_info['status'] = 'administrator'

            updated = False
            for member in members:
                if member['user_id'] == user.id:
                    member['username'] = user_info['username']
                    member['first_name'] = user_info['first_name']
                    member['last_name'] = user_info['last_name']
                    member['photo_url'] = user_info['photo_url']
                    if not member.get('status') or member['status'] != 'administrator':
                         member['status'] = user_info['status']
                    updated = True
                    break

            if not updated:
                members.append(user_info)

            await self.db_service.save_group(
                chat_id=original_chat_id,
                chat_title=chat.title,
                members=members,
                admins=admins
            )
            logger.info(f"Данные пользователя {user.id} сохранены/обновлены для группы {chat.title}")
            # --- Конец сохранения данных ---

            # --- Отправка инструкции в ЛС ---
            try:
                # --- НАЧАЛО ИЗМЕНЕНИЙ: Убираем ReplyKeyboardRemove ---
                # Отправляем только текстовое сообщение
                await context.bot.send_message(
                    chat_id=user.id,
                    text="✅ Вы зарегистрированы! Теперь вы можете пользоваться функциями бота (например, запись на смену через меню)."
                    # reply_markup=ReplyKeyboardRemove() # Убрали удаление клавиатуры
                )
                logger.info(f"✅ Подтверждение регистрации отправлено пользователю {user.id} в ЛС.")
                # --- КОНЕЦ ИЗМЕНЕНИЙ: Убираем ReplyKeyboardRemove ---

            except telegram.error.Forbidden:
                 # Логгер и сообщение в группу остаются прежними
                 logger.warning(f"Не удалось отправить сообщение пользователю {user.id}: Бот заблокирован или чат не начат.")
                 await context.bot.send_message(
                     chat_id=chat.id,
                     text=f"@{user.username}, не могу отправить вам сообщение. Пожалуйста, начните диалог с ботом (@{context.bot.username}) и разблокируйте его, если нужно, чтобы завершить регистрацию."
                 )
                 return False # Регистрация не завершена полностью
            except Exception as e:
                # Логгер теперь проще, т.к. только отправка сообщения
                logger.warning(f"Не удалось отправить сообщение пользователю {user.id}: {str(e)}")
                await context.bot.send_message(
                    chat_id=chat.id,
                    text=f"@{user.username}, произошла ошибка при отправке подтверждения в личные сообщения. Пожалуйста, убедитесь, что вы начали диалог с ботом (@{context.bot.username}).",
                )
                return False # Регистрация не завершена полностью

            return True # Регистрация успешна

        except Exception as e:
            logger.error(f"Ошибка при регистрации пользователя {user.id} в группе {chat.title}: {str(e)}")
            logger.error(traceback.format_exc())
            return False
    # --- КОНЕЦ МЕТОДА РЕГИСТРАЦИИ ---

    # Обработчик кнопки регистрации удален

    async def handle_excel_document(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик Excel документов для групп инвентаризации с двухуровневой защитой"""
        try:
            message = update.effective_message
            document = message.document
            chat = message.chat
            user = message.from_user
            
            if not document:
                logger.warning("Получен вызов handle_excel_document без документа")
                return
            
            # Проверяем, является ли группа инвентаризационной
            group_type = self.db_service.determine_group_type(chat.title)
            if group_type != "inventory":
                # Если это не группа инвентаризации, игнорируем
                logger.info(f"Excel файл получен в группе {chat.title} (тип: {group_type}), но это не группа инвентаризации - игнорируем")
                return
            
            logger.info(f"📊 Получен Excel файл '{document.file_name}' от пользователя {user.username or user.id} в группе инвентаризации '{chat.title}'")
            
            # ПЕРВЫЙ УРОВЕНЬ ЗАЩИТЫ: Проверяем права администратора
            try:
                admins = await context.bot.get_chat_administrators(chat.id)
                admin_ids = [admin.user.id for admin in admins]
                
                if user.id not in admin_ids:
                    # Если пользователь не администратор - игнорируем файл полностью
                    logger.warning(f"🔒 Пользователь {user.username or user.id} (ID: {user.id}) не является администратором группы '{chat.title}'. Игнорируем Excel файл.")
                    return
                    
            except Exception as admin_check_error:
                logger.error(f"❌ Ошибка проверки прав администратора: {admin_check_error}")
                await message.reply_text(
                    f"❌ **Ошибка проверки прав доступа**\n\n"
                    f"Не удалось проверить права администратора.\n"
                    f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)",
                    parse_mode='Markdown',
                    disable_web_page_preview=True
                )
                return
            
            logger.info(f"✅ Пользователь {user.username or user.id} является администратором группы '{chat.title}'. Продолжаем обработку.")
            
            # Валидация типа документа
            if not document.file_name.lower().endswith('.xlsx'):
                error_message = (
                    f"❌ **Неподдерживаемый формат файла**\n\n"
                    f"Я понимаю только Excel файлы в формате .xlsx\n"
                    f"Пожалуйста, отправьте файл в правильном формате.\n\n"
                    f"📋 **Поддерживаемые форматы:** .xlsx\n"
                    f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
                )
                
                await message.reply_text(
                    error_message,
                    parse_mode='Markdown',
                    disable_web_page_preview=True
                )
                logger.warning(f"Отклонен файл '{document.file_name}' - неподдерживаемый формат")
                return
            
            # Проверяем размер файла (макс 10MB)
            max_size_mb = 10
            max_size_bytes = max_size_mb * 1024 * 1024
            if document.file_size > max_size_bytes:
                error_message = (
                    f"❌ **Файл слишком большой**\n\n"
                    f"Максимальный размер файла: {max_size_mb}MB\n"
                    f"Размер вашего файла: {document.file_size / (1024*1024):.1f}MB\n\n"
                    f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
                )
                
                await message.reply_text(
                    error_message,
                    parse_mode='Markdown',
                    disable_web_page_preview=True
                )
                logger.warning(f"Отклонен файл '{document.file_name}' - слишком большой размер: {document.file_size} байт")
                return
            
            # ВТОРОЙ УРОВЕНЬ ЗАЩИТЫ: Показываем подтверждение с кнопками
            await self._show_excel_confirmation(message, document, chat, user, context)
                
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке Excel документа: {e}")
            logger.error(traceback.format_exc())
            
            try:
                await message.reply_text(
                    f"❌ **Произошла неожиданная ошибка**\n\n"
                    f"Пожалуйста, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)",
                    parse_mode='Markdown',
                    disable_web_page_preview=True
                )
            except:
                pass

    async def _process_excel_with_adapter(self, temp_file_path: str, original_filename: str, chat: Chat, user, processing_message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет Excel файл в адаптер инвентаризации и обрабатывает результат"""
        try:
            import httpx
            import os
            
            # URL адаптера
            api_base_url = os.getenv("API_INTERNAL_URL", "http://server:8000")
            adapter_url = f"{api_base_url}/api/v1/inventory/admin/adapt-accounting-excel"
            
            logger.info(f"🔄 Отправляем файл '{original_filename}' в адаптер: {adapter_url}")
            
            # Отправляем файл в адаптер
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(temp_file_path, 'rb') as f:
                    files = {
                        'excel_file': (original_filename, f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                    }
                    
                    response = await client.post(adapter_url, files=files)
            
            # Удаляем временный файл
            try:
                os.unlink(temp_file_path)
                logger.info(f"🗑️ Временный файл удален: {temp_file_path}")
            except OSError as e:
                logger.error(f"Ошибка удаления временного файла {temp_file_path}: {e}")
            
            # Обрабатываем ответ
            if response.status_code == 200:
                result = response.json()
                await self._send_success_result(result, original_filename, user, processing_message, context)
            else:
                logger.error(f"❌ Адаптер вернул ошибку {response.status_code}: {response.text}")
                await self._send_error_result(response.status_code, response.text, original_filename, processing_message, context)
                
        except httpx.RequestError as e:
            logger.error(f"❌ Ошибка подключения к адаптеру: {e}")
            await self._send_connection_error(processing_message, context)
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при обработке через адаптер: {e}")
            logger.error(traceback.format_exc())
            await self._send_unexpected_error(processing_message, context)

    def _escape_markdown(self, text: str) -> str:
        """Экранирует только критичные символы Markdown для безопасного отображения"""
        if not text:
            return text
        
        # Экранируем только критичные символы для Telegram Markdown
        # Убираем точки, дефисы и другие символы которые могут не нуждаться в экранировании
        critical_chars = ['`', '*', '_', '[', ']']
        escaped_text = text
        for char in critical_chars:
            escaped_text = escaped_text.replace(char, f'\\{char}')
        return escaped_text

    async def _send_success_result(self, result: dict, filename: str, user, processing_message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение об успешной обработке"""
        try:
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            
            # ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ: показываем полный ответ от API
            logger.info(f"🔍 [DEBUG] Полный ответ от API: {result}")
            
            processing_results = result.get('processing_results', {})
            templates_updated = result.get('templates_updated', {})
            details = result.get('details', {})
            synchronization = result.get('synchronization', {})
            
            # ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ: показываем секцию синхронизации
            logger.info(f"🔍 [DEBUG] Секция synchronization: {synchronization}")
            
            # Формируем сообщение о результатах
            escaped_filename = self._escape_markdown(str(filename))
            success_text = (
                f"✅ **Файл успешно обработан!**\n\n"
                f"📁 **Файл:** {escaped_filename}\n"
                f"👤 **Отправил:** {self._escape_markdown(str(user.first_name or user.username or 'Пользователь'))}\n\n"
                f"📊 **Результаты обработки:**\n"
                f"• 📋 Всего товаров найдено: **{processing_results.get('total_items_found', 0)}**\n"
                f"• ✅ Существующих совпадений: **{processing_results.get('existing_items_matched', 0)}**\n"
                f"• 🔍 Нечетких совпадений: **{processing_results.get('fuzzy_matches_found', 0)}**\n"
                f"• 🆕 Новых товаров добавлено: **{processing_results.get('new_items_added', 0)}**\n"
                f"• 🗑️ Товаров удалено: **{processing_results.get('removed_items', 0)}**\n\n"
                f"🔄 **Обновления шаблонов:**\n"
                f"• 📄 inventory_template.json: {'✅ обновлен' if templates_updated.get('inventory_template_updated') else '⏭️ без изменений'}\n"
                f"• 📊 excel_template.py: {'✅ обновлен' if templates_updated.get('excel_template_updated') else '⏭️ без изменений'}"
            )
            
            # Добавляем информацию о новых товарах
            new_items = details.get('new_items', [])
            if new_items:
                success_text += f"\n\n🆕 **Добавленные товары:**\n"
                for item in new_items[:5]:  # Показываем только первые 5
                    item_name = self._escape_markdown(str(item.get('name', 'Неизвестный')))
                    item_category = self._escape_markdown(str(item.get('suggested_category', 'Общая')))
                    success_text += f"• {item_name} → {item_category}\n"
                
                if len(new_items) > 5:
                    success_text += f"• ... и еще {len(new_items) - 5} товаров\n"
            
            # Добавляем информацию об удаленных товарах
            removed_items = details.get('removed_items', [])
            if removed_items:
                success_text += f"\n\n🗑️ **Удаленные товары:**\n"
                for item in removed_items[:5]:  # Показываем только первые 5
                    item_name = self._escape_markdown(str(item.get('name', 'Неизвестный')))
                    item_category = self._escape_markdown(str(item.get('category', 'Неизвестная')))
                    success_text += f"• {item_name} ← {item_category}\n"
                
                if len(removed_items) > 5:
                    success_text += f"• ... и еще {len(removed_items) - 5} товаров\n"
            
            # Проверяем статус синхронизации
            needs_synchronization = synchronization.get('needs_synchronization', False)
            desync_count = synchronization.get('desynchronization_count', 0)
            
            # ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ: показываем процесс принятия решения
            logger.info(f"🔍 [DEBUG] Проверка синхронизации:")
            logger.info(f"🔍 [DEBUG] - needs_synchronization: {needs_synchronization}")
            logger.info(f"🔍 [DEBUG] - desync_count: {desync_count}")
            logger.info(f"🔍 [DEBUG] - Условие для кнопки: {needs_synchronization and desync_count > 0}")
            
            # Создаем клавиатуру
            keyboard = None
            
            if needs_synchronization and desync_count > 0:
                logger.info("🔍 [DEBUG] Создаем кнопку синхронизации...")
                success_text += f"\n\n⚠️ **Обнаружена рассинхронизация шаблонов**\n"
                success_text += f"📊 Несоответствий: **{desync_count}** товаров\n"
                
                # Добавляем детали рассинхронизации
                only_in_inventory = synchronization.get('only_in_inventory', [])
                only_in_excel = synchronization.get('only_in_excel', [])
                
                if only_in_inventory:
                    success_text += f"\n📄 **Только в inventory_template.json ({len(only_in_inventory)} товаров):**\n"
                    for item in only_in_inventory[:3]:  # Показываем первые 3
                        escaped_item = self._escape_markdown(str(item))
                        success_text += f"• {escaped_item}\n"
                    if len(only_in_inventory) > 3:
                        success_text += f"• ... и еще {len(only_in_inventory) - 3} товаров\n"
                
                if only_in_excel:
                    success_text += f"\n📊 **Только в excel_template.py ({len(only_in_excel)} товаров):**\n"
                    for item in only_in_excel[:3]:  # Показываем первые 3
                        escaped_item = self._escape_markdown(str(item))
                        success_text += f"• {escaped_item}\n"
                    if len(only_in_excel) > 3:
                        success_text += f"• ... и еще {len(only_in_excel) - 3} товаров\n"
                
                success_text += f"\n💡 **Нажмите кнопку ниже для автоматической синхронизации**"
                
                # Добавляем кнопку синхронизации
                sync_button = InlineKeyboardButton(
                    "🔄 Синхронизировать шаблоны", 
                    callback_data="sync_templates"
                )
                keyboard = InlineKeyboardMarkup([[sync_button]])
                logger.info("✅ [DEBUG] Кнопка синхронизации создана!")
            else:
                logger.info("🔍 [DEBUG] Кнопка синхронизации НЕ создается - условие не выполнено")
                success_text += f"\n\n✅ **Шаблоны синхронизированы**"
            
            # ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ: показываем итоговый текст и его длину
            logger.info(f"🔍 [DEBUG] Итоговый текст ({len(success_text)} символов):")
            logger.info(f"🔍 [DEBUG] Текст: {repr(success_text)}")
            logger.info(f"🔍 [DEBUG] Байт 830-850: {repr(success_text[830:850]) if len(success_text) > 830 else 'Текст короче 830 символов'}")
            
            # Временно отключаем Markdown для диагностики
            try:
                await processing_message.edit_text(
                    success_text,
                    parse_mode='Markdown',
                    reply_markup=keyboard
                )
            except Exception as markdown_error:
                logger.error(f"❌ Ошибка Markdown: {markdown_error}")
                # Пробуем без Markdown
                plain_text = success_text.replace('**', '').replace('`', '').replace('*', '')
                await processing_message.edit_text(
                    f"⚠️ РЕЖИМ ОТЛАДКИ (без Markdown):\n\n{plain_text}",
                    reply_markup=keyboard
                )
            
            logger.info(f"✅ Отправлен отчет об успешной обработке файла '{filename}' (синхронизация: {needs_synchronization})")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке результатов успешной обработки: {e}")

    async def _send_error_result(self, status_code: int, error_text: str, filename: str, processing_message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение об ошибке обработки"""
        try:
            error_message = (
                f"❌ **Ошибка обработки файла**\n\n"
                f"📁 **Файл:** `{filename}`\n"
                f"🚫 **Код ошибки:** {status_code}\n"
                f"📄 **Описание:** {error_text[:200]}{'...' if len(error_text) > 200 else ''}\n\n"
                f"🆘 Пожалуйста, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6) с этой ошибкой"
            )
            
            await processing_message.edit_text(
                error_message,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения об ошибке: {e}")

    async def _send_connection_error(self, processing_message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение об ошибке подключения"""
        try:
            error_message = (
                f"❌ **Ошибка подключения**\n\n"
                f"Не удалось подключиться к системе обработки файлов.\n"
                f"Попробуйте еще раз через несколько минут.\n\n"
                f"🆘 Если проблема повторяется, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
            )
            
            await processing_message.edit_text(
                error_message,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения об ошибке подключения: {e}")

    async def _send_unexpected_error(self, processing_message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение о неожиданной ошибке"""
        try:
            error_message = (
                f"❌ **Неожиданная ошибка**\n\n"
                f"Произошла неожиданная ошибка при обработке файла.\n\n"
                f"🆘 Пожалуйста, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
            )
            
            await processing_message.edit_text(
                error_message,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения о неожиданной ошибке: {e}")

    async def handle_sync_templates_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик нажатия кнопки синхронизации шаблонов"""
        try:
            import httpx
            import os
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            
            query = update.callback_query
            await query.answer()  # Подтверждаем получение callback
            
            message = query.message
            user = query.from_user
            
            logger.info(f"🔄 Пользователь {user.mention_markdown()} запустил синхронизацию шаблонов")
            
            # Показываем статус загрузки
            loading_text = (
                f"🔄 **Синхронизация шаблонов**\n\n"
                f"📊 Анализируем различия между шаблонами...\n"
                f"⏳ Пожалуйста, подождите"
            )
            
            await message.edit_text(
                loading_text,
                parse_mode='Markdown'
            )
            
            # URL API для синхронизации
            api_base_url = os.getenv("API_INTERNAL_URL", "http://server:8000")
            sync_url = f"{api_base_url}/api/v1/inventory/admin/synchronize-templates"
            
            logger.info(f"🔄 Отправляем запрос синхронизации: {sync_url}")
            
            # Отправляем запрос синхронизации
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(sync_url)
            
            # Обрабатываем ответ
            if response.status_code == 200:
                result = response.json()
                await self._send_sync_success_result(result, user, message, context)
            else:
                logger.error(f"❌ API синхронизации вернул ошибку {response.status_code}: {response.text}")
                await self._send_sync_error_result(response.status_code, response.text, message, context)
                
        except httpx.RequestError as e:
            logger.error(f"❌ Ошибка подключения к API синхронизации: {e}")
            await self._send_sync_connection_error(message, context)
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при синхронизации: {e}")
            logger.error(traceback.format_exc())
            await self._send_sync_unexpected_error(message, context)

    async def _send_sync_success_result(self, result: dict, user, message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет результат успешной синхронизации"""
        try:
            changes_made = result.get('changes_made', False)
            details = result.get('details', {})
            before = details.get('before', {})
            after = details.get('after', {})
            
            if changes_made:
                success_text = (
                    f"✅ **Синхронизация завершена успешно!**\n\n"
                    f"👤 **Инициатор:** {self._escape_markdown(str(user.first_name or user.username or 'Пользователь'))}\n\n"
                    f"📊 **Результаты синхронизации:**\n"
                    f"• **До синхронизации:** {before.get('desynchronization_count', 0)} несоответствий\n"
                    f"• **После синхронизации:** {after.get('desynchronization_count', 0)} несоответствий\n"
                    f"• **Статус:** {'✅ Синхронизированы' if after.get('is_synchronized', False) else '⚠️ Частично синхронизированы'}\n\n"
                    f"🔄 **Выполненные изменения:**\n"
                    f"• Добавлено товаров в inventory_template.json: **{before.get('only_in_excel', 0)}**\n"
                    f"• Добавлено товаров в excel_template.py: **{before.get('only_in_inventory', 0)}**\n\n"
                    f"✅ Все шаблоны теперь содержат одинаковый набор товаров!"
                )
            else:
                success_text = (
                    f"ℹ️ **Синхронизация не требуется**\n\n"
                    f"👤 **Проверил:** {self._escape_markdown(str(user.first_name or user.username or 'Пользователь'))}\n\n"
                    f"✅ Шаблоны уже синхронизированы\n"
                    f"📊 Несоответствий не обнаружено"
                )
            
            await message.edit_text(
                success_text,
                parse_mode='Markdown'
            )
            
            logger.info(f"✅ Отправлен результат синхронизации (изменения: {changes_made})")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке результатов синхронизации: {e}")

    async def _send_sync_error_result(self, status_code: int, error_text: str, message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение об ошибке синхронизации"""
        try:
            error_message = (
                f"❌ **Ошибка синхронизации**\n\n"
                f"🚫 **Код ошибки:** {status_code}\n"
                f"📄 **Описание:** {error_text[:200]}{'...' if len(error_text) > 200 else ''}\n\n"
                f"🆘 Пожалуйста, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6) с этой ошибкой"
            )
            
            await message.edit_text(
                error_message,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения об ошибке синхронизации: {e}")

    async def _send_sync_connection_error(self, message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение об ошибке подключения к API синхронизации"""
        try:
            error_message = (
                f"❌ **Ошибка подключения**\n\n"
                f"Не удалось подключиться к системе синхронизации.\n"
                f"Попробуйте еще раз через несколько минут.\n\n"
                f"🆘 Если проблема повторяется, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
            )
            
            await message.edit_text(
                error_message,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения об ошибке подключения: {e}")

    async def _send_sync_unexpected_error(self, message, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Отправляет сообщение о неожиданной ошибке синхронизации"""
        try:
            error_message = (
                f"❌ **Неожиданная ошибка**\n\n"
                f"Произошла неожиданная ошибка при синхронизации.\n\n"
                f"🆘 Пожалуйста, обратитесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
            )
            
            await message.edit_text(
                error_message,
                parse_mode='Markdown',
                disable_web_page_preview=True
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения о неожиданной ошибке синхронизации: {e}")

    async def _show_excel_confirmation(self, message, document, chat, user, context):
        """Показывает подтверждение для обработки Excel файла"""
        try:
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            import uuid
            
            # Генерируем уникальный ID для этого запроса
            request_id = str(uuid.uuid4())
            
            # Создаем кнопки подтверждения
            confirm_button = InlineKeyboardButton(
                "✅ Подтвердить",
                callback_data=f"confirm_excel:{request_id}"
            )
            skip_button = InlineKeyboardButton(
                "⏭️ Пропустить",
                callback_data=f"skip_excel:{request_id}"
            )
            
            keyboard = InlineKeyboardMarkup([
                [confirm_button, skip_button]
            ])
            
            # Формируем сообщение с предупреждением
            warning_message = (
                f"⚠️ **ВНИМАНИЕ! Обновление шаблона инвентаризации**\n\n"
                f"📁 **Файл:** `{document.file_name}`\n"
                f"👤 **Отправил:** {user.mention_markdown()}\n\n"
                f"🔄 **Последствия обработки:**\n"
                f"• Синхронизация с базой данных\n"
                f"• Обновление шаблонов инвентаризации\n"
                f"• Изменение структуры данных\n\n"
                f"❓ **Подтвердите свое действие:**\n"
                f"✅ **Подтвердить** - обработать файл и обновить шаблоны\n"
                f"⏭️ **Пропустить** - сохранить файл без обработки\n\n"
                f"⏰ **Время ожидания:** 5 минут"
            )
            
            # Отправляем сообщение с кнопками
            confirmation_message = await message.reply_text(
                warning_message,
                parse_mode='Markdown',
                reply_markup=keyboard
            )
            
            # Очищаем старые запросы (старше 10 минут)
            current_time = asyncio.get_event_loop().time()
            expired_requests = [
                req_id for req_id, req_data in self.excel_requests.items()
                if current_time - req_data['timestamp'] > 600  # 10 минут
            ]
            for req_id in expired_requests:
                del self.excel_requests[req_id]
                logger.info(f"🗑️ Удален истекший запрос Excel: {req_id}")
            
            # Сохраняем информацию о запросе для обработки колбэка
            self.excel_requests[request_id] = {
                'document': document,
                'chat': chat,
                'user': user,
                'original_message': message,
                'confirmation_message': confirmation_message,
                'timestamp': current_time
            }
            
            logger.info(f"📝 Отправлено подтверждение для Excel файла '{document.file_name}' с ID запроса: {request_id}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при показе подтверждения: {e}")
            logger.error(traceback.format_exc())
            
            # В случае ошибки показа подтверждения, отправляем обычное сообщение об ошибке
            await message.reply_text(
                f"❌ **Ошибка системы подтверждения**\n\n"
                f"Не удалось показать подтверждение для обработки файла.\n"
                f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)",
                parse_mode='Markdown',
                disable_web_page_preview=True
            )

    async def handle_excel_confirmation_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик кнопок подтверждения/пропуска Excel файлов"""
        try:
            query = update.callback_query
            if not query or not query.data:
                return
            
            # Отвечаем на колбэк
            await query.answer()
            
            # Парсим callback_data
            if query.data.startswith("confirm_excel:"):
                action = "confirm"
                request_id = query.data.removeprefix("confirm_excel:")
            elif query.data.startswith("skip_excel:"):
                action = "skip"
                request_id = query.data.removeprefix("skip_excel:")
            else:
                logger.warning(f"Получен неизвестный Excel callback_data: {query.data}")
                return
            
            user = query.from_user
            username = f"@{user.username}" if user.username else user.full_name
            
            # Получаем информацию из сообщения (вместо контекста)
            chat = query.message.chat
            
            # Находим информацию о запросе (если есть)
            request_data = None
            if request_id in self.excel_requests:
                request_data = self.excel_requests[request_id]
                original_user = request_data['user']
                
                # Проверяем, что кнопку нажал тот же пользователь, который отправил файл
                if user.id != original_user.id:
                    await query.answer(
                        "❌ Только пользователь, который отправил файл, может подтвердить или пропустить его обработку.",
                        show_alert=True
                    )
                    return
            
            if action == "confirm":
                logger.info(f"✅ Пользователь {username} подтвердил обработку Excel файла")
                
                if request_data:
                    # Есть данные - можем обработать файл
                    document = request_data['document']
                    await query.edit_message_text(
                        f"✅ **Подтверждено! Обрабатываю файл...**\n\n"
                        f"📁 **Файл:** `{document.file_name}`\n"
                        f"👤 **Подтвердил:** {username}\n"
                        f"🔄 **Статус:** Обработка файла и синхронизация шаблонов\n\n"
                        f"⏳ Пожалуйста, подождите...",
                        parse_mode='Markdown'
                    )
                    
                    # Обрабатываем файл
                    await self._process_excel_file_confirmed(request_data, context)
                else:
                    # Нет данных - показываем что нужно обработать вручную
                    await query.edit_message_text(
                        f"✅ **Подтверждено!**\n\n"
                        f"👤 **Подтвердил:** {username}\n"
                        f"📋 **Статус:** Обработка подтверждена\n\n"
                        f"ℹ️ Файл выше будет обработан системой автоматически.",
                        parse_mode='Markdown'
                    )
                
            elif action == "skip":
                logger.info(f"⏭️ Пользователь {username} пропустил обработку Excel файла")
                
                # Просто удаляем сообщение подтверждения
                try:
                    await query.message.delete()
                    logger.info(f"🗑️ Сообщение подтверждения удалено после пропуска обработки")
                except Exception as delete_error:
                    logger.error(f"❌ Не удалось удалить сообщение подтверждения: {delete_error}")
                    # Если не удалось удалить, просто отвечаем на callback
                    await query.answer("Обработка пропущена", show_alert=False)
            
            # Удаляем запрос из кэша (если есть)
            if request_id in self.excel_requests:
                del self.excel_requests[request_id]
            
        except Exception as e:
            logger.error(f"❌ Ошибка в обработчике Excel подтверждения: {e}")
            logger.error(traceback.format_exc())
            
            try:
                await query.edit_message_text(
                    f"❌ **Ошибка обработки подтверждения**\n\n"
                    f"Произошла ошибка при обработке вашего выбора.\n"
                    f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)",
                    parse_mode='Markdown'
                )
            except:
                pass

    async def _process_excel_file_confirmed(self, request_data: dict, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обрабатывает подтвержденный Excel файл"""
        try:
            document = request_data['document']
            chat = request_data['chat']
            user = request_data['user']
            confirmation_message = request_data['confirmation_message']
            
            # Загружаем файл
            try:
                file = await context.bot.get_file(document.file_id)
                
                # Создаем временный файл
                import tempfile
                import uuid
                temp_suffix = f"_{uuid.uuid4().hex[:8]}_{document.file_name}"
                temp_file = tempfile.NamedTemporaryFile(
                    suffix=temp_suffix,
                    delete=False,
                    dir="/tmp"
                )
                
                # Скачиваем файл
                await file.download_to_drive(temp_file.name)
                temp_file.close()
                
                logger.info(f"📥 Подтвержденный файл '{document.file_name}' скачан во временную директорию: {temp_file.name}")
                
                # Отправляем файл в адаптер через API
                await self._process_excel_with_adapter(temp_file.name, document.file_name, chat, user, confirmation_message, context)
                
            except Exception as download_error:
                logger.error(f"❌ Ошибка загрузки подтвержденного файла '{document.file_name}': {download_error}")
                
                error_text = (
                    f"❌ **Ошибка загрузки файла**\n\n"
                    f"📁 **Файл:** `{document.file_name}`\n"
                    f"Не удалось загрузить файл для обработки.\n"
                    f"Пожалуйста, попробуйте отправить файл заново.\n\n"
                    f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)"
                )
                
                await confirmation_message.edit_text(
                    error_text,
                    parse_mode='Markdown',
                    disable_web_page_preview=True
                )
                
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке подтвержденного Excel файла: {e}")
            logger.error(traceback.format_exc())
            
            try:
                await confirmation_message.edit_text(
                    f"❌ **Ошибка обработки файла**\n\n"
                    f"📁 **Файл:** `{document.file_name}`\n"
                    f"Произошла ошибка при обработке подтвержденного файла.\n\n"
                    f"🆘 При проблемах обращайтесь в [техподдержку](https://t.me/+HU1WcpcswddlNjI6)",
                    parse_mode='Markdown',
                    disable_web_page_preview=True
                )
            except:
                pass

    async def handle_competition_video(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        message = update.effective_message
        chat = message.chat
        if not chat.title or (chat.title.lower().strip() != "конкурсы" and "конкурс" not in chat.title.lower()):
            return
        video = message.video
        document = message.document
        # Проверяем обычное видео
        if video:
            file_size = video.file_size
        # Проверяем видео-файл (mp4)
        elif document and document.mime_type and document.mime_type.startswith("video/"):
            file_size = document.file_size
        else:
            return
        if file_size > 2 * 1024 * 1024 * 1024:
            await message.reply_text("❌ Видео превышает 2 ГБ и не принимается!")
            return
        if not message.caption or len(message.caption.strip()) < 5:
            await message.reply_text("❌ К видео обязательно нужно добавить подпись: ФИ участника и филиал!")
            return
        channel_id = str(chat.id).replace("-100", "") if str(chat.id).startswith("-100") else str(chat.id).replace("-", "")
        link = f"https://t.me/c/{channel_id}/{message.message_id}"
        await message.reply_text(f"✅ Видео принято! Ссылка на видео: {link}")