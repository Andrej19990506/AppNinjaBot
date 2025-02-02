from telegram import Update, ChatMember, Bot
from telegram.ext import ContextTypes, MessageHandler, filters, ChatMemberHandler, CommandHandler
from services.json_service import JsonService
import logging
from telegram.constants import ChatMemberStatus
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import random
import json
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
import time
import telegram.error
import httpx
import os
import aiohttp
import aiofiles

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
        
        # Регистрация обработчиков
        self.application.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, self.handle_new_chat_members))
        self.application.add_handler(MessageHandler(filters.StatusUpdate.LEFT_CHAT_MEMBER, self.handle_left_chat_member))
        
        # Обновляем регистрацию ChatMemberHandler для отслеживания всех изменений статуса
        self.application.add_handler(ChatMemberHandler(self.handle_chat_member_update, ChatMemberHandler.CHAT_MEMBER))
        self.application.add_handler(ChatMemberHandler(self.handle_chat_member_update, ChatMemberHandler.MY_CHAT_MEMBER))
        
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        self.application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, self.handle_webapp_data))
        self.application.add_handler(MessageHandler(filters.CONTACT, self.handle_contact_message))
        
        # Добавляем задачу периодического обновления фотографий
        self.job_queue = application.job_queue
        self.job_queue.run_repeating(self.update_all_photos, interval=3600, first=10)  # Обновляем каждый час
        
        logger.info("✅ Обработчики групповых событий зарегистрированы")
    
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
            standardized_chat_id = await self._get_standardized_chat_id(chat.id)
            original_chat_id = await self._get_original_chat_id(standardized_chat_id)
            new_members = update.message.new_chat_members
            bot_added = False
            
            # Сначала получаем текущих участников
            current_members = await self._get_chat_members(chat, context)
            current_member_ids = {str(member['user_id']) for member in current_members}
            
            # Проверяем каждого нового участника
            for member in new_members:
                if member.id == context.bot.id:
                    logger.info(f"Бот был добавлен в чат {chat.title}")
                    bot_added = True
                else:
                    # Приветствуем нового участника
                    welcome_message = (
                        f"Добро пожаловать, {member.first_name}!\n"
                        f"Рады видеть вас в группе '{chat.title}'."
                    )
                    await update.message.reply_text(welcome_message)
                    logger.info(f"Отправлено приветствие новому участнику {member.first_name} в чате {chat.title}")
                
                # Если участник еще не в списке, добавляем его
                if str(member.id) not in current_member_ids:
                    member_info = {
                        'user_id': str(member.id),
                        'username': member.username,
                        'first_name': member.first_name,
                        'last_name': member.last_name,
                        'is_bot': member.is_bot,
                        'status': 'member'  # Новые участники всегда имеют статус member
                    }
                    current_members.append(member_info)
                    logger.info(f"Добавлен новый участник {member.first_name} в список участников")

            # Получаем текущих администраторов чата
            admins = await self._get_chat_admins(original_chat_id, context)
            await self.json_service.save_admins(standardized_chat_id, chat.title, admins)
            logger.info(f"Обновлены администраторы для чата {chat.title}")
            
            # Сохраняем обновленный список участников
            await self.json_service.save_members(standardized_chat_id, chat.title, current_members)
            logger.info(f"Обновлены участники для чата {chat.title}")
            
            # Если был добавлен бот, отправляем специальное приветственное сообщение
            if bot_added:
                    await self._process_bot_added(update, context)
            
            logger.info(f"Обработаны новые участники в чате {chat.title} (ID: {standardized_chat_id})")
            
        except Exception as e:
            logger.error(f"Ошибка при обработке новых участников: {e}", exc_info=True)
    
    async def handle_chat_member_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка изменений участников чата"""
        try:
            logger.info("🔄 Получено обновление статуса участника")
            
            if not update.chat_member:
                logger.warning("❌ Не удалось получить информацию об участнике")
                return
                
            chat = update.effective_chat
            member = update.chat_member
            
            # Получаем объекты участников и их статусы
            old_member = member.old_chat_member
            new_member = member.new_chat_member
            
            if not old_member or not new_member:
                logger.warning("❌ Не удалось получить информацию о старом или новом статусе участника")
                return
            
            # Получаем информацию о пользователе
            user = new_member.user
            user_name = user.full_name if user else 'Unknown User'
            
            logger.info(f"🔄 Обновление статуса участника {user_name}")
            logger.info(f"Старый статус: {old_member.status}")
            logger.info(f"Новый статус: {new_member.status}")
            
            # Проверка изменения статуса администратора
            was_admin = old_member.status in ['administrator', 'creator']
            is_admin = new_member.status in ['administrator', 'creator']
            
            if was_admin != is_admin:
                logger.info(f"⚡️ Обнаружено изменение прав администратора для {user_name}")
                try:
                    # Получаем стандартизированный ID чата
                    chat_id = await self._get_standardized_chat_id(chat.id)
                    # Получаем оригинальный ID для запросов к API
                    original_chat_id = await self._get_original_chat_id(chat_id)
                    
                    # Получаем текущий список участников
                    members_data = self.json_service.load_from_json('members.json')
                    if str(chat_id) in members_data:
                        members = members_data[str(chat_id)]['members']
                        # Обновляем статус участника
                        for member_info in members:
                            if str(member_info['user_id']) == str(user.id):
                                member_info['status'] = 'member' if not is_admin else 'administrator'
                                logger.info(f"Обновлен статус участника {user_name} на {member_info['status']}")
                        
                        # Сохраняем обновленный список участников
                        await self.json_service.save_members(chat_id, chat.title, members)
                        logger.info(f"📋 Обновлен список участников для чата {chat.title}")
                    
                    # Обновляем список администраторов
                    admins = await self._get_chat_admins(original_chat_id, context)
                    if admins:  # Сохраняем только если список не пустой
                        await self.json_service.save_admins(chat_id, chat.title, admins)
                        logger.info(f"📋 Обновлен список администраторов для чата {chat.title}")
                    
                    # Отправляем уведомление в чат
                    if is_admin:
                        await chat.send_message(
                            f"🎉 Поздравляем! {user_name} теперь администратор!"
                        )
                        logger.info(f"Отправлено поздравление новому администратору {user_name}")
                        
                        # Инициализируем активность администратора
                        activity_data = self.json_service.load_from_json('admin_activity.json')
                        if str(chat_id) not in activity_data:
                            activity_data[str(chat_id)] = {}
                        if str(user.id) not in activity_data[str(chat_id)]:
                            activity_data[str(chat_id)][str(user.id)] = {
                                'message_count': 0,
                                'last_active': datetime.now().isoformat(),
                                'commands_used': 0,
                                'reactions_received': 0,
                                'messages_pinned': 0
                            }
                        self.json_service.save_admin_activity(activity_data)
                        logger.info(f"Инициализирована активность нового администратора {user_name}")
                    else:
                        await chat.send_message(
                            f"❌ {user_name} больше не является администратором."
                        )
                        logger.info(f"Отправлено уведомление о снятии прав администратора у {user_name}")
                        
                        # Удаляем из admin_activity.json
                        activity_data = self.json_service.load_from_json('admin_activity.json')
                        if str(chat_id) in activity_data and str(user.id) in activity_data[str(chat_id)]:
                            del activity_data[str(chat_id)][str(user.id)]
                            # Если это был последний админ в чате, удаляем и запись о чате
                            if not activity_data[str(chat_id)]:
                                del activity_data[str(chat_id)]
                            self.json_service.save_admin_activity(activity_data)
                            logger.info(f"🗑 Удалена активность бывшего администратора {user_name}")
                    
                except Exception as inner_e:
                    logger.error(f"Ошибка при обновлении статуса участника: {str(inner_e)}", exc_info=True)

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения участника: {str(e)}", exc_info=True)
    
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
                standardized_chat_id = await self._get_standardized_chat_id(chat_id)
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
    
    async def _get_standardized_chat_id(self, chat_id: int) -> str:
        """Преобразует ID чата в стандартный формат"""
        try:
            str_id = str(chat_id)
            # Для супергрупп (начинается с -100)
            if str_id.startswith('-100'):
                return str_id[4:]  # Убираем '-100'
            # Для обычных групп (начинается с -)
            elif str_id.startswith('-'):
                return str_id[1:]  # Убираем '-'
            # Для приватных чатов (положительные ID)
            return str_id
        except Exception as e:
            logger.error(f"Ошибка при стандартизации ID чата {chat_id}: {str(e)}")
            return str(abs(chat_id))  # Возвращаем абсолютное значение как запасной вариант

    async def _get_original_chat_id(self, standardized_id: str) -> int:
        """Преобразует стандартизированный ID обратно в оригинальный формат"""
        try:
            # Для супергрупп (ID длиннее 10 символов)
            if len(standardized_id) >= 10:
                return int(f"-100{standardized_id}")
            # Для остальных групп
            return -int(standardized_id)
        except Exception as e:
            logger.error(f"Ошибка при получении оригинального ID чата {standardized_id}: {str(e)}")
            return int(standardized_id)  # Возвращаем как есть в случае ошибки

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
            async with aiohttp.ClientSession() as session:
                async with session.get(file_path) as response:
                    if response.status == 200:
                        async with aiofiles.open(photo_path, 'wb') as f:
                            await f.write(await response.read())
                        logger.info(f"✅ Фото для пользователя {user_id} сохранено локально")
                        return True
            logger.error(f"❌ Не удалось скачать фото для пользователя {user_id}")
            return False
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении фото: {str(e)}")
            return False
            
    async def _get_user_photo(self, user_id: int, context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """Получение фотографии пользователя с использованием локального хранения"""
        try:
            user_id_str = str(user_id)
            current_time = datetime.now()
            photo_path = self._get_photo_path(user_id_str)
            
            # Проверяем наличие локальной фотографии
            if os.path.exists(photo_path):
                # Проверяем время последнего обновления файла
                modified_time = datetime.fromtimestamp(os.path.getmtime(photo_path))
                if current_time - modified_time < timedelta(hours=24):  # Обновляем раз в сутки
                    logger.info(f"✅ Используем локальную фотографию для пользователя {user_id}")
                    return f"local:{user_id_str}"
            
            # Если локальной фотографии нет или она устарела, получаем новую
            photos = await context.bot.get_user_profile_photos(user_id, limit=1)
            if photos and photos.photos:
                file_id = photos.photos[0][-1].file_id
                file = await context.bot.get_file(file_id)
                
                # Скачиваем и сохраняем фото локально
                if await self._download_and_save_photo(file.file_path, user_id_str):
                    return f"local:{user_id_str}"
                    
            logger.warning(f"❌ Не удалось получить фото для пользователя {user_id}")
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении фото профиля: {str(e)}")
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

    async def _get_chat_admins(self, chat_id: int, context: ContextTypes.DEFAULT_TYPE) -> List[Dict]:
        """Получает список администраторов чата"""
        try:
            logger.info(f"Получение списка администраторов для чата {chat_id}")
            standardized_chat_id = await self._get_standardized_chat_id(chat_id)
            
            # Загружаем данные об активности администраторов
            admin_activity = self.json_service.load_from_json('admin_activity.json')
            chat_activity = admin_activity.get(str(standardized_chat_id), {})
            
            try:
                # Получаем список администраторов через API
                chat_admins = await context.bot.get_chat_administrators(chat_id)
                logger.info(f"Получено {len(chat_admins)} администраторов")
                
                admins_list = []
                for admin in chat_admins:
                    if not admin.user:
                        continue
                        
                    user = admin.user
                    user_id = str(user.id)
                    
                    # Получаем фото профиля
                    photo_url = await self._get_user_photo(user.id, context)
                    
                    # Получаем данные об активности
                    activity_data = chat_activity.get(user_id, {
                        'message_count': 0,
                        'last_active': '',
                        'commands_used': 0,
                        'reactions_received': 0,
                        'messages_pinned': 0
                    })
                    
                    # Рассчитываем оценку активности
                    activity_score = self._calculate_activity_score(activity_data)
                    
                    admin_info = {
                        'user_id': user_id,
                        'username': user.username,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'photo_url': photo_url,
                        'phone': None,  # Телефон добавляется отдельно
                        'status': admin.status,
                        'activity_score': activity_score
                    }
                    admins_list.append(admin_info)
                    
                return admins_list
                
            except Exception as api_error:
                logger.error(f"Неожиданная ошибка при получении администраторов: {str(api_error)}")
                # При ошибке API возвращаем текущий список администраторов из файла
                current_admins = self.json_service.load_from_json('admins.json')
                if str(standardized_chat_id) in current_admins:
                    return current_admins[str(standardized_chat_id)].get('admins', [])
                return []
                
        except Exception as e:
            logger.error(f"Ошибка при получении списка администраторов: {str(e)}", exc_info=True)
            return []

    async def _get_chat_members(self, chat, context):
        """Получение списка участников чата"""
        members = []
        try:
            # Получаем администраторов для проверки статуса
            admins = await self._get_chat_admins(chat.id, context)
            admin_ids = {str(admin['user_id']) for admin in admins}  # Убеждаемся, что все ID в строковом формате
            admin_statuses = {str(admin['user_id']): admin['status'] for admin in admins}
            
            # Получаем количество участников
            total_count = await context.bot.get_chat_member_count(chat.id)
            logger.info(f"Всего участников в чате: {total_count}")
            
            # Добавляем администраторов
            members.extend(admins)
            logger.info(f"Добавлены администраторы: {[admin['username'] for admin in admins]}")
            
            # Получаем информацию о боте
            bot_member = await context.bot.get_chat_member(chat.id, context.bot.id)
            if bot_member and bot_member.user:
                logger.info(f"Получаем фото для бота {bot_member.user.username}")
                # Проверяем, не добавлен ли уже бот как администратор
                if str(bot_member.user.id) not in admin_ids:
                    photo_url = await self._get_user_photo(bot_member.user.id, context)
                    member_info = {
                        'user_id': str(bot_member.user.id),  # Сохраняем ID как строку
                        'username': bot_member.user.username,
                        'first_name': bot_member.user.first_name,
                        'last_name': bot_member.user.last_name,
                        'is_bot': True,
                        'status': str(bot_member.status).lower(),
                        'photo_url': photo_url
                    }
                    members.append(member_info)
                    logger.info(f"Добавлен бот {member_info['username']} с фото: {photo_url}")
                else:
                    logger.info(f"Бот {bot_member.user.username} уже добавлен как администратор")

            # Проверяем наличие обновления и сообщения
            update = getattr(context, 'update', None)
            if update:
                logger.info("Обрабатываем обновление")
                # Если есть сообщение с новыми участниками
                if hasattr(update, 'message') and update.message:
                    message = update.message
                    logger.info("Найдено сообщение в обновлении")
                    
                    # Добавляем отправителя, если он не администратор
                    if message.from_user and message.from_user.id not in admin_ids:
                        sender = message.from_user
                        logger.info(f"Обрабатываем отправителя: {sender.username}")
                        member = await context.bot.get_chat_member(chat.id, sender.id)
                        if member.status not in [ChatMemberStatus.LEFT, ChatMemberStatus.BANNED]:
                            photo_url = await self._get_user_photo(sender.id, context)
                            member_info = {
                                'user_id': str(sender.id),
                                'username': sender.username,
                                'first_name': sender.first_name,
                                'last_name': sender.last_name,
                                'is_bot': sender.is_bot,
                                'status': str(member.status).lower(),
                                'photo_url': photo_url
                            }
                            members.append(member_info)
                            logger.info(f"Добавлен отправитель {member_info['username']} с фото: {photo_url}")
                    
                    # Добавляем новых участников
                    if hasattr(message, 'new_chat_members'):
                        logger.info("Обрабатываем новых участников")
                        for new_member in message.new_chat_members:
                            if new_member.id not in admin_ids and new_member.id != context.bot.id:
                                logger.info(f"Обрабатываем нового участника: {new_member.username}")
                                member = await context.bot.get_chat_member(chat.id, new_member.id)
                                if member.status not in [ChatMemberStatus.LEFT, ChatMemberStatus.BANNED]:
                                    photo_url = await self._get_user_photo(new_member.id, context)
                                    member_info = {
                                        'user_id': str(new_member.id),
                                        'username': new_member.username,
                                        'first_name': new_member.first_name,
                                        'last_name': new_member.last_name,
                                        'is_bot': new_member.is_bot,
                                        'status': str(member.status).lower(),
                                        'photo_url': photo_url
                                    }
                                    members.append(member_info)
                                    logger.info(f"Добавлен новый участник {member_info['username']} с фото: {photo_url}")

                # Если есть обновление статуса участника
                if hasattr(update, 'chat_member') and update.chat_member:
                    logger.info("Обрабатываем обновление статуса участника")
                    chat_member = update.chat_member
                    if chat_member.new_chat_member and chat_member.new_chat_member.user:
                        user = chat_member.new_chat_member.user
                        logger.info(f"Обновляем статус для пользователя: {user.username}")
                        if user.id not in admin_ids:
                            photo_url = await self._get_user_photo(user.id, context)
                            member_info = {
                                'user_id': str(user.id),
                                'username': user.username,
                                'first_name': user.first_name,
                                'last_name': user.last_name,
                                'is_bot': user.is_bot,
                                'status': str(chat_member.new_chat_member.status).lower(),
                                'photo_url': photo_url
                            }
                            members.append(member_info)
                            logger.info(f"Обновлен участник {member_info['username']} с фото: {photo_url}")
            
            # Получаем фото для всех участников, у которых его еще нет
            logger.info("Проверяем наличие фото у всех участников")
            for member in members:
                if 'photo_url' not in member or member['photo_url'] is None:
                    logger.info(f"Получаем фото для участника {member['username']}")
                    photo_url = await self._get_user_photo(int(member['user_id']), context)
                    member['photo_url'] = photo_url
                    logger.info(f"Обновлено фото для участника {member['username']}: {photo_url}")
            
            # Обновляем статусы участников в соответствии с их правами администратора
            for member in members:
                if member['user_id'] in admin_statuses:
                    old_status = member['status']
                    member['status'] = admin_statuses[member['user_id']]
                    logger.info(f"Обновлен статус участника {member['username']}: {old_status} -> {member['status']}")

            # Удаляем дубликаты по user_id, сохраняя последнюю версию
            unique_members = {}
            for member in members:
                unique_members[member['user_id']] = member
            members = list(unique_members.values())
            
            logger.info(f"Получено {len(members)} участников из {total_count}")
            logger.info("Финальный список участников:")
            for member in members:
                logger.info(f"- {member['username']}: статус={member['status']}, фото={member['photo_url'] is not None}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении участников: {e}", exc_info=True)
        return members
    
    async def _process_bot_added(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка добавления бота в чат"""
        try:
            chat = update.effective_chat
            logger.info(f"Начинаем обработку добавления бота в чат {chat.title}")
            
            # Отправляем приветственное сообщение
            welcome_message = (
                f"Привет! Спасибо, что добавили меня в группу '{chat.title}'!\n"
            f"Я буду помогать вам управлять группой и отслеживать участников."
        )
            await update.message.reply_text(welcome_message)
            logger.info(f"Отправлено приветственное сообщение в чат {chat.title}")
            
            logger.info(f"Бот успешно добавлен в чат {chat.title} (ID: {chat.id})")
            
        except Exception as e:
            logger.error(f"Ошибка при обработке добавления бота: {e}", exc_info=True)
            raise

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