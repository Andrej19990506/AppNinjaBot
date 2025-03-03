import os
import json
import logging
import aiohttp
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from telegram import Update, ChatMember, Bot
from telegram.ext import ContextTypes, MessageHandler, filters, ChatMemberHandler, CommandHandler
from telegramNinjaBot.services.json_service import JsonService
from telegram.constants import ChatMemberStatus
from typing import Optional, List, Dict, Union, Any
import random
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
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
    def __init__(self, application, json_service: JsonService):
        """Инициализация обработчика групповых событий"""
        self.application = application
        self.json_service = json_service
        
        # Создаем и настраиваем HTTP-клиент для бота
        self.http_client = None
        
        # Инициализируем кэш фотографий
        self.photo_cache = {}
        self.photos_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'photos')
        os.makedirs(self.photos_dir, exist_ok=True)
        
        if self.json_service.file_exists('photo_cache.json'):
            self.photo_cache = self.json_service.load_from_json('photo_cache.json')
        
        # Добавляем задачу периодического обновления фотографий
        self.job_queue = application.job_queue
        self.job_queue.run_repeating(self.update_all_photos, interval=3600, first=10)  # Обновляем каждый час
        
        logger.info("✅ Обработчик групповых событий инициализирован")
    
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
        """Обработка новых участников в чате"""
        try:
            chat = update.effective_chat
            new_members = update.message.new_chat_members
            bot_added = False
            
            logger.info(f"=== Обработка новых участников в чате {chat.title} ===")
            logger.info(f"ID чата: {chat.id}")
            logger.info(f"Тип чата: {chat.type}")
            logger.info(f"Новые участники: {[f'{member.full_name} (ID: {member.id})' for member in new_members]}")
            
            # Проверяем каждого нового участника
            for member in new_members:
                if member.id == context.bot.id:
                    logger.info(f"🤖 Бот был добавлен в чат {chat.title}")
                    bot_added = True
                    # Сразу обрабатываем добавление бота
                    await self._process_bot_added(update, context)
                else:
                    # Получаем фото нового участника с принудительным обновлением
                    photo_url = await self._get_user_photo(member.id, context, force_update=True)
                    logger.info(f"Получено фото для нового участника {member.full_name}: {photo_url}")
                    
                    # Приветствуем нового участника
                    welcome_message = (
                        f"Добро пожаловать, {member.first_name}!\n"
                        f"Рады видеть вас в группе '{chat.title}'."
                    )
                    try:
                        await update.message.reply_text(welcome_message)
                        logger.info(f"✅ Отправлено приветствие новому участнику {member.full_name} в чате {chat.title}")
                    except Exception as e:
                        logger.error(f"❌ Ошибка при отправке приветствия: {e}")
            
            if not bot_added:
                # Получаем стандартизированный ID чата
                standardized_chat_id = await self._get_standardized_chat_id(chat.id)
                original_chat_id = await self._get_original_chat_id(standardized_chat_id)
                
                logger.info(f"Обновление данных для обычного участника в чате {chat.title}")
                logger.info(f"Стандартизированный ID: {standardized_chat_id}")
                logger.info(f"Оригинальный ID: {original_chat_id}")
                
                # Получаем текущих участников
                current_members = await self._get_chat_members(chat, context)
                logger.info(f"Получено {len(current_members)} участников")
                
                # Получаем администраторов
                admins = await self._get_chat_admins(original_chat_id, context)
                logger.info(f"Получено {len(admins)} администраторов")
                
                # Сохраняем данные
                await self.json_service.save_members(standardized_chat_id, chat.title, current_members)
                await self.json_service.save_admins(standardized_chat_id, chat.title, admins)
                
                logger.info(f"✅ Обновлены данные для чата {chat.title} (ID: {standardized_chat_id})")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке новых участников: {e}", exc_info=True)
            logger.error(traceback.format_exc())

    async def handle_chat_member_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка изменений участников чата"""
        try:
            chat = update.chat_member.chat
            user = update.chat_member.new_chat_member.user
            new_member = update.chat_member.new_chat_member
            old_member = update.chat_member.old_chat_member
            user_name = f"{user.first_name} {user.last_name if user.last_name else ''}"

            logger.info(f"=== Обработка изменения статуса участника ===")
            logger.info(f"Чат: {chat.title}")
            logger.info(f"ID чата: {chat.id}")
            logger.info(f"Участник: {user_name}")
            logger.info(f"ID участника: {user.id}")
            logger.info(f"Старый статус: {old_member.status}")
            logger.info(f"Новый статус: {new_member.status}")

            # Проверка изменения статуса
            if new_member.status == "administrator":
                logger.info(f"🎉 Пользователь {user_name} назначен администратором")
                
                # Получаем актуальные права администратора
                admin_rights = {
                    'can_manage_chat': getattr(new_member, 'can_manage_chat', False),
                    'can_delete_messages': getattr(new_member, 'can_delete_messages', False),
                    'can_manage_voice_chats': getattr(new_member, 'can_manage_voice_chats', False),
                    'can_restrict_members': getattr(new_member, 'can_restrict_members', False),
                    'can_promote_members': getattr(new_member, 'can_promote_members', False),
                    'can_change_info': getattr(new_member, 'can_change_info', False),
                    'can_invite_users': getattr(new_member, 'can_invite_users', False),
                    'can_pin_messages': getattr(new_member, 'can_pin_messages', False)
                }
                logger.info(f"Права администратора: {json.dumps(admin_rights, indent=2, ensure_ascii=False)}")

                # Сначала получаем фото нового администратора
                photo_url = await self._get_user_photo(user.id, context, force_update=True)
                logger.info(f"Получено фото для нового администратора: {photo_url}")
                
                # Создаем или обновляем информацию об администраторе
                admin_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'status': new_member.status,
                    'is_bot': user.is_bot,
                    'photo_url': photo_url,
                    **admin_rights  # Добавляем права администратора
                }
                logger.info(f"Создана информация об администраторе: {json.dumps(admin_info, indent=2, ensure_ascii=False)}")

                # Получаем стандартизированный ID чата
                standardized_chat_id = await self._get_standardized_chat_id(chat.id)
                logger.info(f"Стандартизированный ID чата: {standardized_chat_id}")

                # Обновляем список администраторов
                admins_data = self.json_service.load_from_json('admins.json')
                logger.info(f"Загружен текущий список администраторов")
                
                if standardized_chat_id not in admins_data:
                    logger.info(f"Создаем новую запись для чата {chat.title}")
                    admins_data[standardized_chat_id] = {'chat_title': chat.title, 'admins': []}
                
                # Обновляем или добавляем администратора
                admin_found = False
                for i, admin in enumerate(admins_data[standardized_chat_id]['admins']):
                    if str(admin['user_id']) == str(user.id):
                        logger.info(f"Обновляем существующего администратора {user_name}")
                        admins_data[standardized_chat_id]['admins'][i] = admin_info
                        admin_found = True
                        break
                
                if not admin_found:
                    logger.info(f"Добавляем нового администратора {user_name}")
                    admins_data[standardized_chat_id]['admins'].append(admin_info)
                
                # Обновляем время последнего обновления
                admins_data[standardized_chat_id]['last_updated'] = datetime.now().isoformat()
                
                # Сохраняем обновленный список администраторов
                await self.json_service.save_to_json('admins.json', admins_data)
                logger.info(f"✅ Список администраторов успешно обновлен")

                # Отправляем поздравление
                await chat.send_message(
                    f"🎉 Поздравляем! {user_name} теперь администратор!"
                )
                logger.info(f"✅ Отправлено поздравление новому администратору")

                # Отправляем уведомление на сервер
                logger.info(f"Отправляем уведомление на сервер об обновлении прав")
                await self._notify_server_about_admin_update(
                    standardized_chat_id,
                    admins_data[standardized_chat_id]
                )

            elif old_member.status == "administrator":
                logger.info(f"❌ Пользователь {user_name} больше не является администратором")
                
                await chat.send_message(
                    f"❌ {user_name} больше не является администратором."
                )
                logger.info(f"Отправлено уведомление о снятии прав администратора")
                
                # Получаем стандартизированный ID чата
                standardized_chat_id = await self._get_standardized_chat_id(chat.id)
                logger.info(f"Стандартизированный ID чата: {standardized_chat_id}")
                
                # Удаляем из admin_activity.json
                activity_data = self.json_service.load_from_json('admin_activity.json')
                if standardized_chat_id in activity_data and str(user.id) in activity_data[standardized_chat_id]:
                    del activity_data[standardized_chat_id][str(user.id)]
                    logger.info(f"Удалена активность администратора из admin_activity.json")
                    
                    # Если это был последний админ в чате, удаляем и запись о чате
                    if not activity_data[standardized_chat_id]:
                        del activity_data[standardized_chat_id]
                        logger.info(f"Удалена запись о чате из admin_activity.json (нет активных админов)")
                    
                    await self.json_service.save_to_json('admin_activity.json', activity_data)
                    logger.info(f"✅ Файл admin_activity.json обновлен")
                
                # Удаляем из списка администраторов
                admins_data = self.json_service.load_from_json('admins.json')
                if standardized_chat_id in admins_data:
                    before_count = len(admins_data[standardized_chat_id]['admins'])
                    admins_data[standardized_chat_id]['admins'] = [
                        admin for admin in admins_data[standardized_chat_id]['admins']
                        if str(admin['user_id']) != str(user.id)
                    ]
                    after_count = len(admins_data[standardized_chat_id]['admins'])
                    
                    admins_data[standardized_chat_id]['last_updated'] = datetime.now().isoformat()
                    await self.json_service.save_to_json('admins.json', admins_data)
                    logger.info(f"✅ Администратор удален из списка (было {before_count}, стало {after_count} админов)")

                    # Отправляем уведомление на сервер
                    logger.info(f"Отправляем уведомление на сервер об обновлении прав")
                    await self._notify_server_about_admin_update(
                        standardized_chat_id,
                        admins_data[standardized_chat_id]
                    )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения участника")
            logger.error(f"Описание ошибки: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
    
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

            # Принудительно обновляем списки участников и администраторов
            try:
                chat = update.effective_chat
                standardized_chat_id = await self._get_standardized_chat_id(chat.id)
                original_chat_id = await self._get_original_chat_id(standardized_chat_id)
                
                # Обновляем список администраторов
                admins = await self._get_chat_admins(original_chat_id, context)
                # Сохраняем только если список не пустой
                if admins:
                    await self.json_service.save_admins(standardized_chat_id, chat.title, admins)
                    logger.info(f"Принудительно обновлен список администраторов для чата {chat.title}")
                else:
                    logger.warning("Получен пустой список администраторов, пропускаем сохранение")
                
                # Обновляем список участников
                members = await self._get_chat_members(chat, context)
                if members:
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
            
            # Пробуем получить участников с разными форматами ID
            chat_id_formats = [
                chat.id,  # Оригинальный ID
                str(chat.id),  # Строковый ID
                f"-100{str(chat.id)}" if not str(chat.id).startswith('-100') else str(chat.id),  # Формат для супергрупп
            ]
            
            for chat_id in chat_id_formats:
                if success:
                    break
                    
                try:
                    # Получаем список участников
                    chat_members = await context.bot.get_chat_administrators(chat_id)
                    
                    # Обрабатываем каждого участника
                    for member in chat_members:
                        user = member.user
                        if user.is_bot:  # Пропускаем ботов
                            continue
                            
                        # Получаем фото участника с принудительным обновлением для новых
                        photo_url = await self._get_user_photo(user.id, context, force_update=True)
                        
                        member_info = {
                            'user_id': user.id,
                            'username': user.username,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                            'status': get_member_status(member),
                            'joined_date': datetime.now().isoformat(),
                            'is_bot': user.is_bot
                        }
                        
                        # Добавляем фото, если оно есть
                        if photo_url:
                            member_info['photo_url'] = photo_url
                            logger.info(f"Добавлено фото для участника {user.full_name}")
                        else:
                            logger.warning(f"Не удалось получить фото для участника {user.full_name}")
                        
                        members.append(member_info)
                        logger.info(f"Добавлен участник: {user.full_name} ({user.id})")
                    
                    success = True
                    logger.info(f"✅ Успешно получены {len(members)} участников")
                    
                except Exception as e:
                    last_error = e
                    logger.warning(f"Ошибка при получении участников с ID {chat_id}: {str(e)}")
                    continue
            
            if not success and last_error:
                raise last_error
            
            return members
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка участников: {str(e)}")
            logger.error(traceback.format_exc())
            return []

    async def _get_chat_admins(self, chat_id: Union[int, str], context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка администраторов чата"""
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
            
            # Пробуем каждый формат ID
            for format_id in chat_id_formats:
                try:
                    logger.info(f"Пробую получить администраторов с ID: {format_id}")
                    admins = await context.bot.get_chat_administrators(format_id)
                    if admins:
                        logger.info(f"Успешно получены администраторы с ID: {format_id}")
                        break
                except Exception as e:
                    last_error = e
                    logger.warning(f"Не удалось получить администраторов с ID {format_id}: {e}")
                    continue
            
            if not admins:
                if last_error:
                    raise last_error
                return []
            
            admin_list = []
            for admin in admins:
                user = admin.user
                admin_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
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
                logger.info(f"Добавлен администратор: {user.full_name} ({user.id})")
            
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

    async def _process_bot_added(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка добавления бота в чат"""
        try:
            chat = update.effective_chat
            logger.info(f"=== Начало обработки добавления бота в чат {chat.title} ===")
            logger.info(f"ID чата: {chat.id}")
            
            # Получаем стандартизированный ID чата
            chat_id = str(chat.id).replace('-100', '').replace('-', '')
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем список участников
            logger.info("Получение списка участников...")
            members = await self._get_chat_members(chat, context)
            logger.info(f"Получено {len(members)} участников")
            
            # Получаем список администраторов
            logger.info("Получение списка администраторов...")
            admins = await self._get_chat_admins(chat.id, context)
            logger.info(f"Получено {len(admins)} администраторов")
            
            # Сохраняем данные
            logger.info("Сохранение данных...")
            
            # Создаем файл инвентаря для чата
            inventory_file = os.path.join(self.json_service.inventory_dir, f'inventory_{chat_id}.json')
            logger.info(f"Создание файла инвентаря: {inventory_file}")
            
            # Создаем директорию, если её нет
            os.makedirs(os.path.dirname(inventory_file), exist_ok=True)
            
            with open(inventory_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'chat_id': chat_id,
                    'chat_title': chat.title,
                    'created_at': datetime.now().isoformat(),
                    'items': []
                }, f, ensure_ascii=False, indent=2)
            logger.info("✅ Файл инвентаря создан")
            
            # Отправляем приветственное сообщение
            welcome_message = (
                f"👋 Привет! Я бот для управления инвентарем.\n"
                f"Теперь я буду помогать вам отслеживать и управлять инвентарем в группе '{chat.title}'.\n\n"
                f"🔍 Вот что я умею:\n"
                f"• Отслеживать добавление и удаление предметов\n"
                f"• Синхронизировать инвентарь между филиалами\n"
                f"• Показывать статистику и отчеты\n\n"
                f"Чтобы начать работу, добавьте меня в администраторы группы."
            )
            
            message = await context.bot.send_message(
                chat_id=chat.id,
                text=welcome_message
            )
            logger.info(f"✅ Приветственное сообщение отправлено (Message ID: {message.message_id})")
            
            logger.info(f"✅ Бот успешно добавлен в чат {chat.title} (ID: {chat.id})")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке добавления бота: {str(e)}")
            logger.error(traceback.format_exc())

    async def handle_left_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка удаления участника из чата"""
        try:
            chat = update.effective_chat
            left_member = update.message.left_chat_member
            
            logger.info(f"Участник {left_member.full_name} (id: {left_member.id}) покинул чат {chat.title}")
            
            # Получаем стандартизированный ID чата
            standardized_chat_id = await self._get_standardized_chat_id(chat.id)
            
            # Загружаем текущий список участников для этого чата
            data = self.json_service.load_from_json('members.json')
            
            if standardized_chat_id in data:
                current_members = data[standardized_chat_id].get('members', [])
                # Удаляем участника из списка
                updated_members = [m for m in current_members if str(m['user_id']) != str(left_member.id)]
                
                # Сохраняем обновленный список
                await self.json_service.save_members(standardized_chat_id, chat.title, updated_members)
                logger.info(f"Участник удален из members.json")
            
            # Отправляем сообщение только если это не бот
            if not left_member.is_bot:
                await update.message.reply_text(
                    f"До свидания, {left_member.full_name}! 👋"
                )
            
        except Exception as e:
            logger.error(f"Ошибка при обработке удаления участника: {e}", exc_info=True)

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
        """Обработка данных из веб-приложения"""
        try:
            data = json.loads(update.effective_message.web_app_data.data)
            logger.info(f"Получены данные из веб-приложения: {data}")
            
            if data.get('action') == 'open_user_profile':
                user_id = data.get('user_id')
                first_name = data.get('first_name', 'Пользователь')
                
                if user_id:
                    # Пытаемся получить информацию о пользователе
                    try:
                        user_chat = await context.bot.get_chat(user_id)
                        username = user_chat.username
                        phone = user_chat.phone_number if hasattr(user_chat, 'phone_number') else None
                        
                        # Создаем кнопку для открытия чата
                        keyboard = []
                        
                        if username:
                            url = f"https://t.me/{username}"
                            button_text = f"Открыть чат с {first_name}"
                            keyboard.append([InlineKeyboardButton(text=button_text, url=url)])
                        elif phone:
                            url = f"https://t.me/+{phone}"
                            button_text = f"Открыть чат с {first_name}"
                            keyboard.append([InlineKeyboardButton(text=button_text, url=url)])
                        else:
                            # Если нет ни username, ни телефона, отправляем ссылку на профиль
                            url = f"tg://user?id={user_id}"
                            button_text = f"Найти {first_name} в Telegram"
                            keyboard.append([InlineKeyboardButton(text=button_text, url=url)])
                        
                        reply_markup = InlineKeyboardMarkup(keyboard)
                        
                        await update.effective_message.reply_text(
                            f"Вот ссылка для связи с {first_name}:",
                            reply_markup=reply_markup
                        )
                    except Exception as e:
                        logger.error(f"Ошибка при получении информации о пользователе: {e}")
                        await update.effective_message.reply_text(
                            f"К сожалению, не удалось получить информацию для связи с {first_name}. "
                            "Попробуйте найти пользователя самостоятельно в Telegram."
                        )
                else:
                    await update.effective_message.reply_text(
                        "Не удалось определить пользователя для открытия чата."
                    )
            
        except Exception as e:
            logger.error(f"Ошибка при обработке данных из веб-приложения: {e}", exc_info=True)
            await update.effective_message.reply_text(
                "Произошла ошибка при обработке данных. Пожалуйста, попробуйте позже."
            )

    async def handle_share_contact(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка команды /share_contact"""
        try:
            chat = update.effective_chat
            user = update.effective_user
            
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

            # Получаем новое фото профиля
            photo_url = await self._get_user_photo(user.id, context)
            if not photo_url:
                logger.warning(f"Не удалось получить новое фото профиля для пользователя {user.id}")
                return

            # Обновляем фото в данных участников
            members_data = self.json_service.load_from_json('members.json')
            if str(chat_id) in members_data:
                chat_data = members_data[str(chat_id)]
                for member in chat_data.get('members', []):
                    if str(member.get('user_id')) == str(user.id):
                        member['photo_url'] = photo_url
                        logger.info(f"Обновлено фото профиля для пользователя {user.id} в данных участников")
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
                    logger.info(f"Обновление фотографий для чата {chat_id}")
                    
                    # Обновляем фото участников
                    for member in chat_data.get('members', []):
                        if not member.get('is_bot'):  # Пропускаем ботов
                            user_id = int(member.get('user_id'))
                            new_photo = await self._get_user_photo(user_id, context)
                            if new_photo and new_photo != member.get('photo_url'):
                                member['photo_url'] = new_photo
                                logger.info(f"Обновлено фото участника {user_id}")
                    
                    # Сохраняем обновленные данные участников
                    await self.json_service.save_members(chat_id, chat_data['chat_title'], chat_data['members'])
                    
                    # Обновляем фото администраторов
                    if chat_id in admins_data:
                        chat_admins = admins_data[chat_id]
                        for admin in chat_admins.get('admins', []):
                            user_id = int(admin.get('user_id'))
                            new_photo = await self._get_user_photo(user_id, context)
                            if new_photo and new_photo != admin.get('photo_url'):
                                admin['photo_url'] = new_photo
                                logger.info(f"Обновлено фото администратора {user_id}")
                        
                        # Сохраняем обновленные данные администраторов
                        await self.json_service.save_admins(chat_id, chat_data['chat_title'], chat_admins['admins'])
                    
                except Exception as chat_error:
                    logger.error(f"Ошибка при обновлении фото в чате {chat_id}: {str(chat_error)}")
                    continue
            
            logger.info("✅ Периодическое обновление фотографий завершено")
            
        except Exception as e:
            logger.error(f"Ошибка при периодическом обновлении фотографий: {str(e)}", exc_info=True)

    async def handle_my_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка изменений статуса бота в чате"""
        try:
            logger.info("=== Начало обработки изменения статуса бота ===")
            logger.info(f"Update ID: {update.update_id}")
            logger.info(f"Update type: {update.__class__.__name__}")
            logger.info(f"Update data: {update.to_dict()}")
            
            if not update.my_chat_member:
                logger.error("❌ Нет my_chat_member в update")
                return

            chat = update.effective_chat
            new_member = update.my_chat_member.new_chat_member
            old_member = update.my_chat_member.old_chat_member
            
            logger.info(f"Чат: {chat.title} (ID: {chat.id})")
            logger.info(f"Тип чата: {chat.type}")
            logger.info(f"Старый статус: {old_member.status}")
            logger.info(f"Новый статус: {new_member.status}")
            logger.info(f"Пользователь: {new_member.user.full_name} (ID: {new_member.user.id})")
            logger.info(f"Это бот? {new_member.user.is_bot}")
            logger.info(f"ID нашего бота: {context.bot.id}")
            
            # Проверяем, что это действительно наш бот
            if new_member.user.id != context.bot.id:
                logger.info(f"❌ Обновление не относится к нашему боту (наш ID: {context.bot.id})")
                return
            
            # Если бота добавили в чат (из состояния left/kicked в member/administrator)
            if (old_member.status in ['left', 'kicked'] and 
                new_member.status in ['member', 'administrator']):
                logger.info("✅ Обнаружено добавление бота в чат")
                
                # Получаем стандартизированный ID чата
                chat_id = await self._get_standardized_chat_id(chat.id)
                logger.info(f"Стандартизированный ID чата: {chat_id}")
                
                try:
                    # Проверяем права бота
                    bot_member = await context.bot.get_chat_member(chat.id, context.bot.id)
                    logger.info(f"Права бота в чате: {bot_member.status}")
                    logger.info(f"Может отправлять сообщения: {getattr(bot_member, 'can_post_messages', True)}")
                    
                    # Проверяем тип чата и права
                    if chat.type not in ['group', 'supergroup']:
                        logger.error(f"❌ Неподдерживаемый тип чата: {chat.type}")
                        await context.bot.send_message(
                            chat_id=chat.id,
                            text="❌ Извините, но я работаю только в группах и супергруппах."
                        )
                        return
                    
                    if not getattr(bot_member, 'can_post_messages', True):
                        logger.error("❌ У бота нет прав на отправку сообщений")
                        return

                    # Получаем оригинальный ID чата для API запросов
                    original_chat_id = await self._get_original_chat_id(chat_id)
                    logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
                    
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
                    if members:
                        await self.json_service.save_members(chat_id, chat.title, members)
                        logger.info("✅ Список участников сохранен")
                    if admins:
                        await self.json_service.save_admins(chat_id, chat.title, admins)
                        logger.info("✅ Список администраторов сохранен")
                    
                    # Создаем пустой файл инвентаря для нового чата
                    inventory_path = os.path.join(self.json_service.inventory_dir, f'inventory_{chat_id}.json')
                    logger.info(f"Создание файла инвентаря: {inventory_path}")
                    
                    if not os.path.exists(inventory_path):
                        empty_inventory = {
                            'inventory': {},
                            'metadata': {
                                'lastUpdated': datetime.now().isoformat(),
                                'progress': 0
                            }
                        }
                        with open(inventory_path, 'w', encoding='utf-8') as f:
                            json.dump(empty_inventory, f, ensure_ascii=False, indent=2)
                        logger.info("✅ Файл инвентаря создан")
                    else:
                        logger.info("Файл инвентаря уже существует")
                    
                    # Отправляем приветственное сообщение
                    welcome_message = (
                        f"🤖 Привет! Спасибо, что добавили меня в группу '{chat.title}'!\n\n"
                        f"Я буду помогать вам управлять инвентаризацией и отслеживать участников.\n\n"
                        f"✅ Данные чата успешно инициализированы:\n"
                        f"- Список участников сохранен ({len(members) if members else 0} участников)\n"
                        f"- Список администраторов сохранен ({len(admins) if admins else 0} админов)\n"
                        f"- Файл инвентаря создан\n\n"
                        f"🔍 Теперь вы можете начать инвентаризацию!"
                    )
                    
                    try:
                        sent_message = await context.bot.send_message(
                            chat_id=chat.id,
                            text=welcome_message,
                            parse_mode='HTML'
                        )
                        logger.info(f"✅ Приветственное сообщение отправлено (Message ID: {sent_message.message_id})")
                    except telegram.error.TelegramError as e:
                        logger.error(f"❌ Ошибка Telegram при отправке приветственного сообщения: {e}")
                        if 'not enough rights' in str(e).lower():
                            logger.error("У бота недостаточно прав для отправки сообщений")
                        elif 'bot was blocked' in str(e).lower():
                            logger.error("Бот был заблокирован в чате")
                        else:
                            logger.error(f"Неизвестная ошибка Telegram: {e}")
                    except Exception as e:
                        logger.error(f"❌ Общая ошибка при отправке приветственного сообщения: {e}")
                    
                    logger.info(f"✅ Бот успешно добавлен в чат {chat.title} (ID: {chat.id})")
                    
                except Exception as inner_e:
                    logger.error(f"❌ Ошибка при инициализации бота в чате: {str(inner_e)}", exc_info=True)
                    try:
                        error_message = (
                            "❌ Произошла ошибка при инициализации бота.\n"
                            "Пожалуйста, удалите бота из группы и добавьте снова.\n\n"
                            f"Ошибка: {str(inner_e)}"
                        )
                        await context.bot.send_message(
                            chat_id=chat.id,
                            text=error_message
                        )
                    except Exception as e2:
                        logger.error(f"❌ Ошибка при отправке сообщения об ошибке: {e2}")
            else:
                logger.info(f"Изменение статуса бота с {old_member.status} на {new_member.status} не требует обработки")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения статуса бота: {str(e)}", exc_info=True)

    async def _notify_server_about_admin_update(self, chat_id: str, admins_data: dict) -> None:
        """Отправляет уведомление на сервер об обновлении прав администратора"""
        try:
            logger.info(f"🔄 Отправка уведомления на сервер об обновлении прав администратора")
            logger.info(f"ID чата: {chat_id}")
            logger.info(f"Количество администраторов: {len(admins_data.get('admins', []))}")
            
            api_url = os.getenv('API_URL', 'http://api:8000')
            logger.info(f"URL сервера: {api_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_url}/api/admin_update/{chat_id}",
                    json=admins_data,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Уведомление успешно отправлено на сервер")
                        logger.info(f"Чат: {chat_id}")
                        logger.info(f"Название чата: {admins_data.get('chat_title', 'Неизвестно')}")
                    else:
                        logger.error(f"❌ Ошибка при отправке уведомления на сервер")
                        logger.error(f"Код ошибки: {response.status}")
                        error_text = await response.text()
                        logger.error(f"Описание ошибки: {error_text}")
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке уведомления на сервер")
            logger.error(f"Описание ошибки: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")