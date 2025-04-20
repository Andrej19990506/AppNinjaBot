import logging
import json
import os
import traceback
from datetime import datetime
from typing import Dict, Any, List
import asyncio
import hashlib

from telegram import Update
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)

class MessageHandler:
    """Обработчик сообщений для бота"""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.password_change_requests_file = os.path.join(data_dir, 'password_change_requests.json')
        self.senior_courier_passwords_file = os.path.join(data_dir, 'senior_courier_passwords.json')
        
        # Создаем файлы, если они не существуют
        self._ensure_file_exists(self.password_change_requests_file, {})
        self._ensure_file_exists(self.senior_courier_passwords_file, {})
        
        logger.info(f"✅ MessageHandler инициализирован. Директория данных: {data_dir}")
    
    def _ensure_file_exists(self, file_path: str, default_content: dict) -> None:
        """Проверяет существование файла и создает его с дефолтным содержимым если нужно"""
        try:
            # Проверяем существование файла
            if not os.path.exists(file_path):
                # Проверяем существование директории
                dir_path = os.path.dirname(file_path)
                if dir_path and not os.path.exists(dir_path):
                    logger.info(f"Создание директории: {dir_path}")
                    os.makedirs(dir_path, exist_ok=True)
                
                # Создаем файл с дефолтным содержимым
                logger.info(f"Создание файла: {file_path}")
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(default_content, f, ensure_ascii=False, indent=2)
                logger.info(f"✅ Создан файл {os.path.basename(file_path)}")
            else:
                logger.debug(f"Файл {os.path.basename(file_path)} уже существует")
        except Exception as e:
            logger.error(f"❌ Ошибка при создании файла {file_path}: {str(e)}")
            logger.error(traceback.format_exc())

    async def handle_private_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик личных сообщений пользователя боту"""
        try:
            if not update.message or not update.message.text or not update.effective_user:
                return

            user_id = update.effective_user.id
            text = update.message.text.strip()
            
            # Проверяем, есть ли запрос на смену пароля для этого пользователя
            if await self._check_password_change_request(user_id, text, context):
                # Запрос на смену пароля обработан
                return
            
            # Другие обработчики сообщений могут быть добавлены сюда
            await update.message.reply_text("👋 Привет! Я бот-помощник для курьеров. Чем могу помочь?")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке личного сообщения: {str(e)}")
            logger.error(traceback.format_exc())
            
            try:
                await update.message.reply_text("Произошла ошибка при обработке сообщения. Пожалуйста, попробуйте позже.")
            except:
                pass

    async def _check_password_change_request(self, user_id: int, text: str, context: ContextTypes.DEFAULT_TYPE) -> bool:
        """Проверяет и обрабатывает запрос на смену пароля"""
        try:
            if not os.path.exists(self.password_change_requests_file):
                return False
                
            with open(self.password_change_requests_file, 'r', encoding='utf-8') as f:
                requests = json.load(f)
                
            # Проверяем, есть ли активный запрос для этого пользователя
            user_id_str = str(user_id)
            if user_id_str not in requests:
                return False
                
            request_data = requests[user_id_str]
            status = request_data.get('status', '')
            
            # Обновляем время последней активности
            request_data['last_active'] = datetime.now().isoformat()
            
            # Обрабатываем в зависимости от статуса запроса
            if status == 'waiting_new_password':
                return await self._handle_new_password(user_id, text, request_data, requests, context)
            elif status == 'waiting_confirm_password':
                return await self._handle_confirm_password(user_id, text, request_data, requests, context)
                
            return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке запроса на смену пароля: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def _handle_current_password(self, user_id: int, password: str, request_data: Dict[str, Any], 
                                      all_requests: Dict[str, Any], context: ContextTypes.DEFAULT_TYPE) -> bool:
        """Обрабатывает ввод текущего пароля"""
        try:
            user_id_str = str(user_id)
            
            # Загружаем текущие пароли
            if not os.path.exists(self.senior_courier_passwords_file):
                with open(self.senior_courier_passwords_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
                    
            with open(self.senior_courier_passwords_file, 'r', encoding='utf-8') as f:
                passwords = json.load(f)
            
            # Для первого пароля используем дефолтный 1234, если пароля еще нет
            current_hashed_password = passwords.get(user_id_str, self._hash_password('1234'))
            
            # Проверяем пароль
            if self._hash_password(password) != current_hashed_password:
                # Увеличиваем счетчик попыток
                request_data['attempts'] = request_data.get('attempts', 0) + 1
                
                # Если слишком много попыток, отменяем запрос
                if request_data['attempts'] >= 3:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text="❌ Слишком много неудачных попыток. Запрос на смену пароля отменен."
                    )
                    del all_requests[user_id_str]
                else:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=f"❌ Неверный пароль. Осталось попыток: {3 - request_data['attempts']}"
                    )
                    all_requests[user_id_str] = request_data
            else:
                # Пароль верный, переходим к следующему шагу
                request_data['status'] = 'waiting_new_password'
                request_data['attempts'] = 0
                all_requests[user_id_str] = request_data
                
                await context.bot.send_message(
                    chat_id=user_id,
                    text="✅ Текущий пароль верный.\n\nТеперь введите новый пароль:"
                )
            
            # Сохраняем обновленные запросы
            with open(self.password_change_requests_file, 'w', encoding='utf-8') as f:
                json.dump(all_requests, f, ensure_ascii=False, indent=2)
                
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке текущего пароля: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def _handle_new_password(self, user_id: int, password: str, request_data: Dict[str, Any], 
                                  all_requests: Dict[str, Any], context: ContextTypes.DEFAULT_TYPE) -> bool:
        """Обрабатывает ввод нового пароля"""
        try:
            user_id_str = str(user_id)
            chat_title = request_data.get('chat_title', 'этого чата')
            
            # Проверяем валидность пароля
            if len(password) < 4:
                await context.bot.send_message(
                    chat_id=user_id,
                    text="❌ Пароль должен содержать не менее 4 символов. Попробуйте еще раз:"
                )
                return True
                
            # Сохраняем новый пароль в запросе
            request_data['new_password'] = password
            request_data['status'] = 'waiting_confirm_password'
            all_requests[user_id_str] = request_data
            
            # Сохраняем обновленные запросы
            with open(self.password_change_requests_file, 'w', encoding='utf-8') as f:
                json.dump(all_requests, f, ensure_ascii=False, indent=2)
                
            await context.bot.send_message(
                chat_id=user_id,
                text=f"✅ Новый пароль принят.\n\n⚠️ Обратите внимание, что вы меняете пароль для чата *{chat_title}*.\n\nПожалуйста, повторите новый пароль для подтверждения:",
                parse_mode="Markdown"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке нового пароля: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def _handle_confirm_password(self, user_id: int, password: str, request_data: Dict[str, Any], 
                                      all_requests: Dict[str, Any], context: ContextTypes.DEFAULT_TYPE) -> bool:
        """Обрабатывает подтверждение нового пароля"""
        try:
            user_id_str = str(user_id)
            new_password = request_data.get('new_password', '')
            chat_id = request_data.get('chat_id')
            chat_title = request_data.get('chat_title', 'чат курьеров')
            
            if not chat_id:
                # Если chat_id не указан (старый формат запроса), используем дефолтное поведение
                logger.warning(f"Запрос на смену пароля не содержит chat_id, используем старый формат сохранения")
                chat_id = "default"
                
            if password != new_password:
                # Пароли не совпадают
                await context.bot.send_message(
                    chat_id=user_id,
                    text="❌ Пароли не совпадают. Пожалуйста, попробуйте еще раз.\n\nВведите новый пароль:"
                )
                
                # Сбрасываем статус для ввода нового пароля
                request_data['status'] = 'waiting_new_password'
                request_data['attempts'] = 0
                if 'new_password' in request_data:
                    del request_data['new_password']
                    
                all_requests[user_id_str] = request_data
            else:
                # Пароли совпадают, сохраняем новый пароль
                # Загружаем текущие пароли
                with open(self.senior_courier_passwords_file, 'r', encoding='utf-8') as f:
                    passwords = json.load(f)
                
                # Проверяем структуру файла
                if "chat_passwords" not in passwords:
                    passwords = {"chat_passwords": {}}
                
                # Обновляем пароль для конкретного чата
                passwords["chat_passwords"][str(chat_id)] = self._hash_password(new_password)
                
                # Сохраняем обновленные пароли
                with open(self.senior_courier_passwords_file, 'w', encoding='utf-8') as f:
                    json.dump(passwords, f, ensure_ascii=False, indent=2)
                
                # Удаляем запрос
                del all_requests[user_id_str]
                
                # Формируем сообщение в зависимости от наличия названия чата
                message = f"🔐 Пароль успешно изменен! Теперь все старшие курьеры в чате *{chat_title}* будут использовать новый пароль для авторизации."
                
                await context.bot.send_message(
                    chat_id=user_id,
                    text=message,
                    parse_mode="Markdown"
                )
                
                logger.info(f"✅ Пароль для чата {chat_id} успешно изменен пользователем {user_id}")
            
            # Сохраняем обновленные запросы
            with open(self.password_change_requests_file, 'w', encoding='utf-8') as f:
                json.dump(all_requests, f, ensure_ascii=False, indent=2)
                
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке подтверждения пароля: {str(e)}")
            logger.error(traceback.format_exc())
            return False
            
    def _hash_password(self, password: str) -> str:
        """Хеширует пароль для безопасного хранения"""
        hash_obj = hashlib.sha256(password.encode())
        return hash_obj.hexdigest() 