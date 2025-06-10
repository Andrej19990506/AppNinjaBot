from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import httpx
import asyncio
from fastapi.responses import JSONResponse, FileResponse
import os
from dotenv import load_dotenv
import json
import logging
from sqlalchemy import text
from pathlib import Path

# Загружаем переменные окружения
load_dotenv()


from db.session import get_db_session
from models import Member, GroupMember
# Импортируем Pydantic и схемы
from pydantic import BaseModel
from schemas import GroupRead, UserProfileResponse

# --- Инициализируем логгер --- 
logger = logging.getLogger(__name__)

# --- НОВАЯ СХЕМА ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ --- 
class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

# Получаем URL бота из переменных окружения 
BOT_API_URL = os.getenv("BOT_API_URL", "http://bot:8000")

router = APIRouter()

@router.get(
    "/{user_id}/context",
    response_model=List[GroupRead], # Ожидаем список групп на выходе
    summary="Get User's Groups Context",
    description="Retrieves a list of groups that the specified user (member) belongs to, including the user's role in each group.",
    tags=["Users", "Groups"] # Теги для документации Swagger
)
async def get_user_groups_context(
    user_id: int, # Получаем user_id (Telegram ID) из пути
    db: AsyncSession = Depends(get_db_session) # Получаем сессию БД
):
    """
    Fetches the groups associated with a given user_id (Telegram ID), 
    including the user's role and senior status in each group.
    """
    # 1. Найти пользователя (Member) по user_id
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    if not member:
        # Возвращаем более информативную ошибку 404
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Э, братан! Пользователя с ID {user_id} в базе данных не найдено!",
        )

    # 2. Получить связанные GroupMember и Group, используя жадную загрузку
    member_with_associations_query = (
        select(Member)
        .options(selectinload(Member.groups)
                 .selectinload(GroupMember.group))
        .where(Member.id == member.id)
    )
    member_with_associations_result = await db.execute(member_with_associations_query)
    member_with_associations = member_with_associations_result.scalars().first()

    # 3. Подготовить список для ответа
    groups_context = []
    if member_with_associations and member_with_associations.groups:
        for assoc in member_with_associations.groups:
            if assoc.group:
                group_data = assoc.group.__dict__
                group_data['role'] = assoc.role
                group_data['is_senior_courier'] = assoc.is_senior_courier
                groups_context.append(group_data)

    # 4. Вернуть список
    return groups_context

@router.get(
    "/{user_id}/profile",
    response_model=UserProfileResponse, # Используем новую схему ответа
    summary="Get User Profile",
    description="Retrieves the full profile information for the specified user (member).",
    tags=["Users"]
)
async def get_user_profile(
    user_id: int, # Получаем user_id (Telegram ID) из пути
    db: AsyncSession = Depends(get_db_session)
):
    """
    Fetches the profile data for a given user_id (Telegram ID).
    It also attempts to refresh the data from the Telegram bot before returning.
    """
    # 1. Найти пользователя (Member) по user_id (Telegram ID)
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    # 2. Если пользователь не найден, вернуть 404
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Слышь! Профиль для пользователя с ID {user_id} в базе не обнаружен!",
        )

    # --- НАЧАЛО: Логика обновления от бота (адаптировано из refresh_user_profile_from_telegram) ---
    try:
        # 2.1 Отправляем запрос боту для получения актуальных данных из Telegram
        # Используем тот же URL и параметры, что и в refresh_user_profile_from_telegram
        # BOT_API_URL определен в начале файла, но refresh_user_profile_from_telegram использует http://bot:8003
        # Будем использовать http://bot:8003 для консистентности с refresh_user_profile_from_telegram
        bot_refresh_url = "http://bot:8003/refresh_user" 
        command = f'curl -X POST -H "Content-Type: application/json" -d \'{{"user_id": {user_id}}}\'' \
                  f' {bot_refresh_url} -f -s -S --connect-timeout 15 --max-time 30'
        logger.info(f"[CURL GetProfileRefresh] Executing: {command}")
        
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()

        logger.info(f"[CURL GetProfileRefresh] Exit code: {proc.returncode}")
        stdout_decoded = stdout.decode().strip() if stdout else ""
        stderr_decoded = stderr.decode().strip() if stderr else ""
        
        if stdout_decoded:
            logger.info(f"[CURL GetProfileRefresh] STDOUT: {stdout_decoded}")
        if stderr_decoded:
            logger.error(f"[CURL GetProfileRefresh] STDERR: {stderr_decoded}")

        if proc.returncode != 0:
            error_detail = stderr_decoded or f"Curl command failed with exit code {proc.returncode}"
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE if proc.returncode in [7, 28] else status.HTTP_502_BAD_GATEWAY
            raise HTTPException(
                status_code=status_code,
                detail=f"Failed to fetch from bot for profile refresh: {error_detail}"
            )

        try:
            telegram_data = json.loads(stdout_decoded)
        except json.JSONDecodeError:
             raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Bot responded with invalid JSON for profile refresh: {stdout_decoded}"
            )

        # 2.2 Обновляем данные пользователя в нашей БД
        # Используем ту же логику обновления, что и в refresh_user_profile_from_telegram
        updated_locally = False
        if "first_name" in telegram_data and not member.first_name:
            member.first_name = telegram_data["first_name"]
            logger.info(f"Updating empty first_name for user {user_id} from Telegram data in get_user_profile.")
            updated_locally = True
        
        if "last_name" in telegram_data and not member.last_name:
            member.last_name = telegram_data["last_name"]
            logger.info(f"Updating empty last_name for user {user_id} from Telegram data in get_user_profile.")
            updated_locally = True

        if "username" in telegram_data and member.username != telegram_data["username"]:
            member.username = telegram_data["username"]
            logger.info(f"Updating username for user {user_id} from Telegram data in get_user_profile.")
            updated_locally = True
        
        if "photo_url" in telegram_data and member.photo_url != telegram_data["photo_url"]:
            # Убедимся, что photo_url от бота не пустой, прежде чем обновлять
            if telegram_data["photo_url"]: 
                member.photo_url = telegram_data["photo_url"]
                logger.info(f"Updating photo_url for user {user_id} from Telegram data in get_user_profile.")
                updated_locally = True
            else:
                logger.info(f"Photo_url from bot for user {user_id} is empty, not updating local photo_url.")


        if updated_locally:
            await db.commit()
            await db.refresh(member)
            logger.info(f"Local profile for user {user_id} updated after bot refresh in get_user_profile.")

            # 2.3 Отправка NOTIFY после успешного обновления (аналогично refresh_user_profile_from_telegram)
            try:
                pydantic_profile = UserProfileResponse.model_validate(member)
                profile_data_dict = pydantic_profile.model_dump(mode='json')
                
                notify_payload_dict = {
                    "type": "profile_updated",
                    "user_id": member.user_id,
                    "data": profile_data_dict
                }
                notify_payload_json = json.dumps(notify_payload_dict)

                if len(notify_payload_json.encode('utf-8')) < 7900:
                    escaped_payload = notify_payload_json.replace("'", "''")
                    sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                    await db.execute(sql_command)
                    logger.info(f"[GetProfileRefresh] Sent GLOBAL NOTIFY for updated profile user_id {member.user_id}")
                else:
                    logger.warning(f"[GetProfileRefresh] NOTIFY payload for user_id {member.user_id} is too large. Skipping.")
            except Exception as notify_err:
                logger.error(f"[GetProfileRefresh] Failed to send GLOBAL NOTIFY for user_id {member.user_id}: {notify_err}", exc_info=True)
        else:
            logger.info(f"No local profile changes for user {user_id} after bot refresh in get_user_profile.")

    except HTTPException as e:
        # Если ошибка произошла при коммуникации с ботом или парсинге его ответа
        logger.error(f"HTTPException during bot refresh in get_user_profile for user {user_id}: {e.detail}", exc_info=True)
        # Перевыбрасываем ошибку, чтобы фронтенд знал о проблеме с обновлением
        # Можно выбрать другую стратегию: например, вернуть `member` как есть, но с логом об ошибке обновления
        raise e 
    except asyncio.TimeoutError:
         logger.error(f"Curl command communication timed out during bot refresh in get_user_profile for user {user_id}", exc_info=True)
         raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Bot communication timed out during profile refresh."
        )
    except Exception as e:
        # Другие неожиданные ошибки при попытке обновить от бота
        logger.error(f"Unexpected error during bot refresh in get_user_profile for user {user_id}: {e}", exc_info=True)
        # Чтобы не сломать основной функционал получения профиля, можно залогировать и вернуть member как есть,
        # Либо можно также выбросить ошибку. Для консистентности с refresh_user_profile_from_telegram, лучше выбросить.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing profile from bot: {str(e)}"
        )
    # --- КОНЕЦ: Логика обновления от бота ---

    # 3. Вернуть найденного (и возможно обновленного) пользователя.
    if member.photo_url == "":
        member.photo_url = None
    return member

# --- ОБНОВЛЕННЫЙ ЭНДПОИНТ ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ --- 
@router.put(
    "/{user_id}/profile",
    response_model=UserProfileResponse, 
    summary="Update User Profile",
    description="Updates the profile information (first_name, last_name) for the specified user.",
    tags=["Users"]
)
async def update_user_profile(
    user_id: int, 
    profile_data: UserProfileUpdate, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates the profile data (first_name, last_name) for a given user_id.
    Senior status is updated via a different endpoint.
    """
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден для обновления профиля.",
        )

    update_data = profile_data.model_dump(exclude_unset=True) 
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет данных для обновления."
        )

    # Обновляем поля first_name и last_name
    updated = False
    if 'first_name' in update_data:
        member.first_name = update_data['first_name']
        updated = True
    if 'last_name' in update_data:
        member.last_name = update_data['last_name']
        updated = True

    if not updated:
         # Если пришли какие-то другие поля, но не имя/фамилия
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="Можно обновлять только first_name и last_name через этот эндпоинт."
         )

    try:
        await db.commit()
        await db.refresh(member)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при сохранении профиля: {e}"
        )

    return member

@router.post(
    "/{user_id}/refresh",
    response_model=UserProfileResponse,
    summary="Refresh User Profile from Telegram",
    description="Fetches latest user data from Telegram via the bot and updates the database",
    tags=["Users"]
)
async def refresh_user_profile_from_telegram(
    user_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Refreshes user profile by fetching latest data from Telegram.
    
    Process:
    1. Find the user in our database to confirm they exist
    2. Send request to bot API to fetch latest Telegram data
    3. Update our database with the data received from bot
    4. Return the updated user profile
    """
    # 1. Проверяем, что пользователь существует в БД
    member_query = select(Member).where(Member.user_id == user_id)
    member_result = await db.execute(member_query)
    member = member_result.scalars().first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден в базе данных."
        )
    
    # 2. Отправляем запрос боту для получения актуальных данных из Telegram
    try:
        # --- Заменяем httpx на curl ---
        command = f'curl -X POST -H "Content-Type: application/json" -d \'{{"user_id": {user_id}}}\'' \
                  f' http://bot:8003/refresh_user -f -s -S --connect-timeout 15 --max-time 30'
        logger.info(f"[CURL Refresh] Executing: {command}")
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()

        logger.info(f"[CURL Refresh] Exit code: {proc.returncode}")
        stdout_decoded = stdout.decode().strip() if stdout else ""
        stderr_decoded = stderr.decode().strip() if stderr else ""
        
        if stdout_decoded:
            logger.info(f"[CURL Refresh] STDOUT: {stdout_decoded}")
        if stderr_decoded:
            logger.error(f"[CURL Refresh] STDERR: {stderr_decoded}")

        if proc.returncode != 0:
            error_detail = stderr_decoded or f"Curl command failed with exit code {proc.returncode}"
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE if proc.returncode in [7, 28] else status.HTTP_502_BAD_GATEWAY # 7=connect failed, 28=timeout
            raise HTTPException(
                status_code=status_code,
                detail=f"Failed to fetch from bot via curl: {error_detail}"
            )

        try:
            telegram_data = json.loads(stdout_decoded)
        except json.JSONDecodeError:
             raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Bot responded with invalid JSON via curl: {stdout_decoded}"
            )
        # --- Конец замены ---

        # 3. Обновляем данные пользователя в нашей БД
        try:
            # <<< ИЗМЕНЕНИЕ: Обновляем имя/фамилию только если они пусты в БД >>>
            if "first_name" in telegram_data and not member.first_name:
                member.first_name = telegram_data["first_name"]
                logger.info(f"Updating empty first_name for user {user_id} from Telegram data.")
            
            if "last_name" in telegram_data and not member.last_name:
                member.last_name = telegram_data["last_name"]
                logger.info(f"Updating empty last_name for user {user_id} from Telegram data.")

            # <<< Обновляем username и photo_url всегда, если они есть >>>
            if "username" in telegram_data and member.username != telegram_data["username"]:
                member.username = telegram_data["username"]
                logger.info(f"Updating username for user {user_id} from Telegram data.")
            
            if "photo_url" in telegram_data and member.photo_url != telegram_data["photo_url"]:
                member.photo_url = telegram_data["photo_url"]
                logger.info(f"Updating photo_url for user {user_id} from Telegram data.")
            
            await db.commit()
            await db.refresh(member)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обновлении профиля: {str(e)}"
            )
        
        # --- Отправка NOTIFY после успешного обновления (ОДНОГО, БЕЗ CHAT_ID) --- >
        try:
            pydantic_profile = UserProfileResponse.model_validate(member)
            profile_data_dict = pydantic_profile.model_dump(mode='json')
            
            notify_payload_dict = {
                "type": "profile_updated",
                "user_id": member.user_id, 
                # "chat_id": target_chat_id, <<< УБИРАЕМ chat_id >>>
                "data": profile_data_dict
            }
            notify_payload_json = json.dumps(notify_payload_dict)

            if len(notify_payload_json.encode('utf-8')) < 7900:
                escaped_payload = notify_payload_json.replace("'", "''")
                sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                await db.execute(sql_command)
                logger.info(f"[Refresh Profile] Sent GLOBAL NOTIFY for updated profile user_id {member.user_id}")
            else:
                logger.warning(f"[Refresh Profile] NOTIFY payload for user_id {member.user_id} is too large. Skipping.")
                
        except Exception as notify_err:
            logger.error(f"[Refresh Profile] Failed to send GLOBAL NOTIFY for user_id {member.user_id}: {notify_err}", exc_info=True)
        # --- Конец блока NOTIFY ---
        
        # 4. Возвращаем обновленный профиль
        return member
    except asyncio.TimeoutError: # Если proc.communicate() зависнет
         raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Curl command communication timed out."
        )
    except Exception as e: # Ловим другие ошибки (создание процесса и т.д.)
        logger.error(f"Error during curl execution: {e}", exc_info=True)
        # Используем уже существующий логгер
        # logger = logging.getLogger(__name__) # Не нужно переопределять
        # logger.error(f"Error during curl execution: {e}", exc_info=True) 
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to execute curl to connect to bot: {str(e)}"
        )

@router.get(
    "/{user_id}/photo",
    summary="Get User Photo",
    description="Returns the user's profile photo file from server storage",
    tags=["Users"]
)
async def get_user_photo(user_id: int):
    """
    Возвращает файл фотографии пользователя с сервера.
    Если фото не найдено, возвращает 404 ошибку.
    """
    try:
        # Путь к папке с фото пользователей
        photos_dir = Path("/app/shared/users-photo")
        photo_filename = f"user_{user_id}.jpg"
        photo_path = photos_dir / photo_filename
        
        # Проверяем существование файла
        if not photo_path.exists():
            logger.warning(f"Фото пользователя {user_id} не найдено: {photo_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Фото пользователя {user_id} не найдено"
            )
        
        logger.info(f"Возвращаем фото пользователя {user_id}: {photo_path}")
        return FileResponse(
            path=str(photo_path),
            media_type="image/jpeg",
            filename=photo_filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении фото пользователя {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка сервера при получении фото: {str(e)}"
        )

