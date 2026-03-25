from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import and_
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


from db.session import AsyncSessionFactory, get_db_session
from models import Member, GroupMember
from models.group_role_mapping import GroupRoleMapping
from models.company_role import CompanyRole
from models.company_bot import CompanyBot
from models.role_feature_mapping import RoleFeatureMapping
from models.bot_feature import BotFeature
from models.feature_access_delegate import FeatureAccessDelegate
from models.feature_user_access import FeatureUserAccess
# Импортируем Pydantic и схемы
from pydantic import BaseModel
from schemas import GroupRead, UserProfileResponse
from schemas.bot_feature import BotFeatureResponse
from api.dependencies.auth import get_current_member

# --- Инициализируем логгер --- 
logger = logging.getLogger(__name__)

# --- НОВАЯ СХЕМА ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ --- 
class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

# Получаем URL бота из переменных окружения 
# По умолчанию используем bot-main (основной бот авторизации)
BOT_API_URL = os.getenv("BOT_API_URL", "http://bot-main:8003")

router = APIRouter()


async def _background_refresh_profile_from_telegram(user_id: int) -> None:
    """
    Обновление профиля через бота в фоне (после ответа GET /profile).
    Не блокирует старт приложения; при ошибке только логируем.
    """
    logger.info(f"[GetProfileRefresh BG] Старт фонового обновления профиля user_id={user_id}")
    try:
        async with AsyncSessionFactory() as db:
            member_result = await db.execute(select(Member).where(Member.user_id == user_id))
            member = member_result.scalars().first()
            if not member:
                logger.warning(f"[GetProfileRefresh BG] Пользователь {user_id} не найден в БД, пропуск")
                return

            bot_base_url = BOT_API_URL.rstrip("/")
            bot_refresh_url = f"{bot_base_url}/refresh_user"
            command = (
                f'curl -X POST -H "Content-Type: application/json" -d \'{{"user_id": {user_id}}}\''
                f" {bot_refresh_url} -f -s -S --connect-timeout 15 --max-time 30"
            )
            logger.info(f"[GetProfileRefresh BG] Executing: {command}")

            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            logger.info(f"[GetProfileRefresh BG] Exit code: {proc.returncode}")
            stdout_decoded = stdout.decode().strip() if stdout else ""
            stderr_decoded = stderr.decode().strip() if stderr else ""

            if stdout_decoded:
                logger.info(f"[GetProfileRefresh BG] STDOUT: {stdout_decoded}")
            if stderr_decoded:
                logger.error(f"[GetProfileRefresh BG] STDERR: {stderr_decoded}")

            if proc.returncode != 0:
                error_detail = stderr_decoded or f"Curl failed with exit code {proc.returncode}"
                logger.warning(
                    f"[GetProfileRefresh BG] Не удалось обновить профиль от бота: {error_detail}"
                )
                return

            try:
                telegram_data = json.loads(stdout_decoded)
            except json.JSONDecodeError:
                logger.warning(
                    f"[GetProfileRefresh BG] Бот вернул невалидный JSON: {stdout_decoded}"
                )
                return

            if not telegram_data:
                return

            updated_locally = False
            if "first_name" in telegram_data and not member.first_name:
                member.first_name = telegram_data["first_name"]
                logger.info(
                    f"[GetProfileRefresh BG] Updating empty first_name for user {user_id}"
                )
                updated_locally = True

            if "last_name" in telegram_data and not member.last_name:
                member.last_name = telegram_data["last_name"]
                logger.info(
                    f"[GetProfileRefresh BG] Updating empty last_name for user {user_id}"
                )
                updated_locally = True

            if "username" in telegram_data and member.username != telegram_data["username"]:
                member.username = telegram_data["username"]
                logger.info(
                    f"[GetProfileRefresh BG] Updating username for user {user_id}"
                )
                updated_locally = True

            if "photo_url" in telegram_data and member.photo_url != telegram_data["photo_url"]:
                if telegram_data["photo_url"]:
                    member.photo_url = telegram_data["photo_url"]
                    logger.info(
                        f"[GetProfileRefresh BG] Updating photo_url for user {user_id}"
                    )
                    updated_locally = True
                else:
                    logger.info(
                        f"[GetProfileRefresh BG] photo_url от бота пустой для user {user_id}, пропуск"
                    )

            if not updated_locally:
                logger.info(
                    f"[GetProfileRefresh BG] Нет изменений в локальном профиле user {user_id}"
                )
                return

            try:
                pydantic_profile = UserProfileResponse.model_validate(member)
                profile_data_dict = pydantic_profile.model_dump(mode="json")
                notify_payload_dict = {
                    "type": "profile_updated",
                    "user_id": member.user_id,
                    "data": profile_data_dict,
                }
                notify_payload_json = json.dumps(notify_payload_dict)

                if len(notify_payload_json.encode("utf-8")) < 7900:
                    escaped_payload = notify_payload_json.replace("'", "''")
                    sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                    await db.execute(sql_command)
                    logger.info(
                        f"[GetProfileRefresh BG] NOTIFY profile_updated user_id={member.user_id}"
                    )
                else:
                    logger.warning(
                        f"[GetProfileRefresh BG] NOTIFY payload слишком большой, пропуск user_id={member.user_id}"
                    )
            except Exception as notify_err:
                logger.error(
                    f"[GetProfileRefresh BG] NOTIFY failed user_id={member.user_id}: {notify_err}",
                    exc_info=True,
                )

            await db.commit()
            await db.refresh(member)
            logger.info(
                f"[GetProfileRefresh BG] Профиль user {user_id} обновлён в БД (commit)"
            )
    except Exception as e:
        logger.error(
            f"[GetProfileRefresh BG] Ошибка фонового обновления user_id={user_id}: {e}",
            exc_info=True,
        )


@router.get(
    "/{user_id}/context",
    response_model=None, # Не используем строгую схему, возвращаем словарь напрямую
    summary="Get User's Groups Context",
    description="Retrieves a list of groups that the specified user (member) belongs to, including the user's role in each group, company, role, and features.",
    tags=["Users", "Groups"] # Теги для документации Swagger
)
async def get_user_groups_context(
    user_id: int,
    current_member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Fetches the groups associated with a given user_id (Telegram ID), 
    including the user's role and senior status in each group.
    """
    if current_member.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this context is forbidden",
        )

    member = current_member

    # 2. Получить связанные GroupMember и Group, используя жадную загрузку
    member_with_associations_query = (
        select(Member)
        .options(selectinload(Member.groups)
                 .selectinload(GroupMember.group))
        .where(Member.id == member.id)
    )
    member_with_associations_result = await db.execute(member_with_associations_query)
    member_with_associations = member_with_associations_result.scalars().first()

    # 3. Подготовить список для ответа с информацией о компании, роли и функциях
    groups_context = []
    if member_with_associations and member_with_associations.groups:
        for assoc in member_with_associations.groups:
            if assoc.group:
                # Получаем привязку группы к роли компании
                # Используем group_id из модели Group (это Telegram ID группы)
                group_telegram_id = assoc.group.group_id
                logger.info(f"[get_user_groups_context] Ищем привязку для группы: group_id={group_telegram_id}, internal_id={assoc.group.id}, title={assoc.group.title}")
                
                group_mapping_stmt = select(GroupRoleMapping).where(
                    GroupRoleMapping.group_id == group_telegram_id
                )
                group_mapping_result = await db.execute(group_mapping_stmt)
                group_mapping = group_mapping_result.scalar_one_or_none()
                
                logger.info(f"[get_user_groups_context] Привязка группы найдена: {group_mapping is not None}, group_id={group_telegram_id}")
                
                # Инициализируем данные о компании, роли и функциях
                company_info = None
                role_info = None
                features = []
                
                if group_mapping:
                    logger.info(f"[get_user_groups_context] Привязка найдена: company_role_id={group_mapping.company_role_id}")
                    # Получаем информацию о роли
                    role_stmt = select(CompanyRole).where(
                        CompanyRole.id == group_mapping.company_role_id
                    )
                    role_result = await db.execute(role_stmt)
                    role = role_result.scalar_one_or_none()
                    
                    if role:
                        logger.info(f"[get_user_groups_context] Роль найдена: id={role.id}, name={role.role_name}, company_bot_id={role.company_bot_id}")
                        role_info = {
                            'id': role.id,
                            'role_name': role.role_name,
                            'role_code': role.role_code,
                            'icon': role.icon,
                            'color': role.color,
                            'description': role.description,
                            'is_working_group': group_mapping.is_working_group,
                        }
                        
                        # Получаем информацию о компании
                        company_stmt = select(CompanyBot).where(
                            CompanyBot.id == role.company_bot_id
                        )
                        company_result = await db.execute(company_stmt)
                        company = company_result.scalar_one_or_none()
                        
                        if company:
                            logger.info(f"[get_user_groups_context] Компания найдена: id={company.id}, name={company.company_name}")
                            company_info = {
                                'id': company.id,
                                'company_name': company.company_name,
                                'bot_username': company.bot_username,
                            }
                        else:
                            logger.warning(f"[get_user_groups_context] Компания не найдена для company_bot_id={role.company_bot_id}")
                        
                        # Получаем функции роли (только включенные) с учетом access_type
                        features_stmt = (
                            select(BotFeature, RoleFeatureMapping)
                            .join(RoleFeatureMapping, RoleFeatureMapping.bot_feature_id == BotFeature.id)
                            .where(
                                RoleFeatureMapping.company_role_id == role.id,
                                RoleFeatureMapping.is_enabled == True,
                                BotFeature.is_active == True
                            )
                        )
                        features_result = await db.execute(features_stmt)
                        features_with_mappings = features_result.all()
                        
                        # Определяем, является ли пользователь уполномоченным
                        user_role_in_group = assoc.role  # Роль пользователя в группе (member, administrator, creator)
                        is_admin_or_creator = user_role_in_group in ['administrator', 'creator']
                        
                        # Получаем список делегатов для всех restricted features в этой группе
                        restricted_mapping_ids = [m.id for f, m in features_with_mappings if m.access_type == 'restricted']
                        delegate_mapping_ids = set()
                        if restricted_mapping_ids:
                            delegates_stmt = select(FeatureAccessDelegate).where(
                                and_(
                                    FeatureAccessDelegate.group_id == group_telegram_id,
                                    FeatureAccessDelegate.delegate_user_id == member.user_id,
                                    FeatureAccessDelegate.role_feature_mapping_id.in_(restricted_mapping_ids)
                                )
                            )
                            delegates_result = await db.execute(delegates_stmt)
                            delegates = delegates_result.scalars().all()
                            delegate_mapping_ids = {d.role_feature_mapping_id for d in delegates}
                        
                        # Получаем список выданных доступов для пользователя
                        granted_mapping_ids = set()
                        if restricted_mapping_ids:
                            user_accesses_stmt = select(FeatureUserAccess).where(
                                and_(
                                    FeatureUserAccess.group_id == group_telegram_id,
                                    FeatureUserAccess.user_id == member.user_id,
                                    FeatureUserAccess.role_feature_mapping_id.in_(restricted_mapping_ids)
                                )
                            )
                            user_accesses_result = await db.execute(user_accesses_stmt)
                            user_accesses = user_accesses_result.scalars().all()
                            granted_mapping_ids = {a.role_feature_mapping_id for a in user_accesses}
                        
                        logger.info(f"[get_user_groups_context] Роль пользователя в группе: {user_role_in_group}, is_admin_or_creator: {is_admin_or_creator}")
                        logger.info(f"[get_user_groups_context] Делегат для {len(delegate_mapping_ids)} привязок, выдан доступ к {len(granted_mapping_ids)} привязкам")
                        logger.info(f"[get_user_groups_context] Найдено функций для роли {role.id}: {len(features_with_mappings)}")
                        
                        # Фильтруем features на основе access_type
                        features = []
                        for feature, mapping in features_with_mappings:
                            has_access = False
                            
                            if mapping.access_type == 'open':
                                # Открытый доступ - показываем всем
                                has_access = True
                            elif mapping.access_type == 'restricted':
                                # Ограниченный доступ - проверяем права
                                if is_admin_or_creator:
                                    # Админы/создатели всегда имеют доступ
                                    has_access = True
                                elif mapping.id in delegate_mapping_ids:
                                    # Делегат имеет доступ
                                    has_access = True
                                elif mapping.id in granted_mapping_ids:
                                    # Пользователю выдан доступ делегатом
                                    has_access = True
                            
                            if has_access:
                                features.append({
                                    'id': feature.id,
                                    'feature_code': feature.feature_code,
                                    'feature_name': feature.feature_name,
                                    'description': feature.description,
                                    'icon': feature.icon,
                                })
                        
                        logger.info(f"[get_user_groups_context] Отфильтровано функций с учетом доступа: {len(features)}")
                    else:
                        logger.warning(f"[get_user_groups_context] Роль не найдена для company_role_id={group_mapping.company_role_id}")
                
                # Используем свойство chat_id для преобразования в строку
                group_data = {
                    'id': assoc.group.id,  # Внутренний ID группы из БД
                    'group_id': assoc.group.chat_id,  # Используем свойство chat_id (строка)
                    'title': assoc.group.title,
                    'group_type': assoc.group.group_type,
                    'username': assoc.group.username,
                    'description': assoc.group.description,
                    'members_count': assoc.group.members_count,
                    'json_metadata': assoc.group.json_metadata,
                    'supplies_config': assoc.group.supplies_config,
                    'created_at': assoc.group.created_at,  # Дата создания
                    'role': assoc.role,  # Роль пользователя в группе (member, admin и т.д.)
                    'is_senior_courier': assoc.is_senior_courier,
                    # Новая информация о компании и роли
                    'company': company_info,
                    'company_role': role_info,
                    'features': features,
                }
                groups_context.append(group_data)
                
                # Логируем финальные данные группы для отладки
                logger.info(f"[get_user_groups_context] Финальные данные группы: group_id={group_telegram_id}, has_company={company_info is not None}, has_role={role_info is not None}, features_count={len(features)}")

    # 4. Вернуть список
    logger.info(f"[get_user_groups_context] Возвращаем {len(groups_context)} групп с контекстом")
    return groups_context

@router.get(
    "/{user_id}/profile",
    response_model=UserProfileResponse, # Используем новую схему ответа
    summary="Get User Profile",
    description="Retrieves the full profile information for the specified user (member).",
    tags=["Users"]
)
async def get_user_profile(
    user_id: int,
    background_tasks: BackgroundTasks,
    current_member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Fetches the profile data for a given user_id (Telegram ID) from the database immediately.
    A refresh from the Telegram bot runs in the background after the response is sent.
    """
    if current_member.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this profile is forbidden",
        )

    member = current_member
    background_tasks.add_task(_background_refresh_profile_from_telegram, user_id)

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
                  f' {BOT_API_URL.rstrip("/")}/refresh_user -f -s -S --connect-timeout 15 --max-time 30'
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
    description="Returns the user's profile photo file from server storage. If file doesn't exist but photo_url is in DB, attempts to download from Telegram bot.",
    tags=["Users"]
)
async def get_user_photo(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Возвращает файл фотографии пользователя с сервера.
    Если файл не найден, но photo_url есть в БД, пытается скачать фото через бота.
    Если фото не найдено, возвращает 404 ошибку.
    """
    try:
        # Путь к папке с фото пользователей
        photos_dir = Path("/app/shared/users-photo")
        photos_dir.mkdir(exist_ok=True)  # Создаем папку, если её нет
        photo_filename = f"user_{user_id}.jpg"
        photo_path = photos_dir / photo_filename
        
        # Проверяем существование файла
        if not photo_path.exists():
            logger.warning(f"Фото пользователя {user_id} не найдено на диске: {photo_path}, пытаемся скачать через бота...")
            
            # Проверяем, есть ли photo_url в БД
            member_stmt = select(Member).where(Member.user_id == user_id)
            member_result = await db.execute(member_stmt)
            member = member_result.scalar_one_or_none()
            
            if member and member.photo_url:
                logger.info(f"Найден photo_url в БД для пользователя {user_id}: {member.photo_url}, пытаемся скачать фото через Telegram API...")
                
                # Пытаемся скачать фото через Telegram Bot API напрямую
                try:
                    # Получаем токен основного бота из переменных окружения
                    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
                    if not bot_token:
                        logger.warning("TELEGRAM_BOT_TOKEN не найден, не можем скачать фото")
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Фото пользователя {user_id} не найдено"
                        )
                    
                    # Получаем фото пользователя через Telegram Bot API
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        # Сначала получаем список фото пользователя
                        get_photos_url = f"https://api.telegram.org/bot{bot_token}/getUserProfilePhotos"
                        photos_response = await client.get(
                            get_photos_url,
                            params={"user_id": user_id, "limit": 1},
                            timeout=10.0
                        )
                        
                        if photos_response.status_code != 200:
                            logger.warning(f"Telegram API вернул ошибку при получении фото пользователя {user_id}: {photos_response.status_code}")
                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Фото пользователя {user_id} не найдено"
                            )
                        
                        photos_data = photos_response.json()
                        if not photos_data.get("ok") or not photos_data.get("result", {}).get("photos"):
                            logger.warning(f"У пользователя {user_id} нет фото в Telegram")
                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Фото пользователя {user_id} не найдено"
                            )
                        
                        # Получаем file_id самого большого фото
                        photo_sizes = photos_data["result"]["photos"][0]
                        largest_photo = photo_sizes[-1]  # Последний элемент - самый большой размер
                        file_id = largest_photo["file_id"]
                        
                        # Получаем путь к файлу
                        get_file_url = f"https://api.telegram.org/bot{bot_token}/getFile"
                        file_response = await client.get(
                            get_file_url,
                            params={"file_id": file_id},
                            timeout=10.0
                        )
                        
                        if file_response.status_code != 200:
                            logger.warning(f"Telegram API вернул ошибку при получении пути к файлу: {file_response.status_code}")
                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Фото пользователя {user_id} не найдено"
                            )
                        
                        file_data = file_response.json()
                        if not file_data.get("ok"):
                            logger.warning(f"Telegram API вернул ошибку: {file_data}")
                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Фото пользователя {user_id} не найдено"
                            )
                        
                        file_path = file_data["result"]["file_path"]
                        
                        # Скачиваем файл
                        download_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
                        download_response = await client.get(download_url, timeout=30.0)
                        
                        if download_response.status_code == 200:
                            # Сохраняем фото на диск
                            with open(photo_path, "wb") as f:
                                f.write(download_response.content)
                            logger.info(f"Фото пользователя {user_id} успешно скачано и сохранено: {photo_path}")
                        else:
                            logger.warning(f"Не удалось скачать фото пользователя {user_id}: статус {download_response.status_code}")
                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Фото пользователя {user_id} не найдено"
                            )
                except httpx.TimeoutException:
                    logger.error(f"Таймаут при попытке скачать фото пользователя {user_id} через Telegram API")
                    raise HTTPException(
                        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                        detail="Таймаут при попытке получить фото"
                    )
                except httpx.RequestError as e:
                    logger.error(f"Ошибка при запросе фото пользователя {user_id} через Telegram API: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Фото пользователя {user_id} не найдено"
                    )
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"Ошибка при скачивании фото пользователя {user_id}: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Фото пользователя {user_id} не найдено"
                    )
            else:
                # photo_url нет в БД, возвращаем 404
                logger.warning(f"Фото пользователя {user_id} не найдено и photo_url отсутствует в БД")
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

