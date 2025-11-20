import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from pydantic import BaseModel

from db.session import get_db_session
from models.company_bot import CompanyBot
from models.admin_user import AdminRole
from schemas.company_bot import CompanyBotCreate, CompanyBotUpdate, CompanyBotResponse
from api.dependencies.admin_auth import get_current_admin, require_super_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/company-bots", tags=["Company Bots"])


class BotTokenVerifyRequest(BaseModel):
    bot_token: str


class BotTokenVerifyResponse(BaseModel):
    bot_id: int
    bot_username: Optional[str] = None
    first_name: Optional[str] = None
    is_bot: bool = True
    can_join_groups: Optional[bool] = None
    can_read_all_group_messages: Optional[bool] = None
    supports_inline_queries: Optional[bool] = None


@router.post("/verify-token", response_model=BotTokenVerifyResponse)
async def verify_bot_token(
    request: BotTokenVerifyRequest,
    current_admin = Depends(get_current_admin),
):
    """
    Проверяет токен бота через Telegram Bot API метод getMe.
    Возвращает информацию о боте: bot_id, bot_username и другие данные.
    """
    bot_token = request.bot_token.strip()
    
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot token is required",
        )
    
    # Проверяем формат токена (обычно это число:строка)
    if ':' not in bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bot token format",
        )
    
    # Вызываем Telegram Bot API метод getMe
    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/getMe"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(telegram_api_url)
            
            if response.status_code != 200:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_description = error_data.get("description", "Unknown error")
                logger.warning(f"[BotTokenVerify] Telegram API error: {error_description}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid bot token: {error_description}",
                )
            
            data = response.json()
            
            if not data.get("ok"):
                error_description = data.get("description", "Unknown error")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Telegram API error: {error_description}",
                )
            
            bot_info = data.get("result", {})
            
            return BotTokenVerifyResponse(
                bot_id=bot_info.get("id"),
                bot_username=bot_info.get("username"),
                first_name=bot_info.get("first_name"),
                is_bot=bot_info.get("is_bot", True),
                can_join_groups=bot_info.get("can_join_groups"),
                can_read_all_group_messages=bot_info.get("can_read_all_group_messages"),
                supports_inline_queries=bot_info.get("supports_inline_queries"),
            )
            
    except httpx.TimeoutException:
        logger.error("[BotTokenVerify] Timeout when calling Telegram API")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout when verifying bot token with Telegram API",
        )
    except httpx.RequestError as e:
        logger.error(f"[BotTokenVerify] Request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to connect to Telegram API",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BotTokenVerify] Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error when verifying bot token",
        )


@router.post("", response_model=CompanyBotResponse, status_code=status.HTTP_201_CREATED)
async def create_company_bot(
    bot_data: CompanyBotCreate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(require_super_admin),  # Только суперадмин может создавать компании
) -> CompanyBotResponse:
    """
    Создает нового бота компании в БД.
    Требуется авторизация суперадмина.
    """
    # Проверяем, что токен уникален
    stmt = select(CompanyBot).where(CompanyBot.bot_token == bot_data.bot_token)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot with this token already exists",
        )
    
    # Создаем нового бота
    company_bot = CompanyBot(
        bot_token=bot_data.bot_token,
        bot_username=bot_data.bot_username,
        bot_id=bot_data.bot_id,
        group_id=bot_data.group_id,
        company_name=bot_data.company_name,
        is_active=bot_data.is_active,
        bot_metadata=bot_data.bot_metadata,
    )
    
    db.add(company_bot)
    await db.commit()
    await db.refresh(company_bot)
    
    logger.info(f"[CompanyBot] Создан бот компании: ID={company_bot.id}, username={company_bot.bot_username}")
    
    # Автоматически создаем дефолтную роль "Общая" для новой компании
    from models.company_role import CompanyRole
    default_role = CompanyRole(
        company_bot_id=company_bot.id,
        role_name="Общая",
        role_code="general",
        description="Дефолтная роль для автоматической привязки групп к компании",
        is_active=True,
        display_order=0,
    )
    db.add(default_role)
    await db.commit()
    await db.refresh(default_role)
    
    logger.info(f"[CompanyBot] Создана дефолтная роль для компании: ID={default_role.id}, role_code={default_role.role_code}")
    
    return CompanyBotResponse(
        id=company_bot.id,
        bot_token=company_bot.bot_token,
        bot_username=company_bot.bot_username,
        bot_id=company_bot.bot_id,
        group_id=company_bot.group_id,
        company_name=company_bot.company_name,
        is_active=company_bot.is_active,
        bot_metadata=company_bot.bot_metadata,
        created_at=company_bot.created_at.isoformat() if company_bot.created_at else "",
        updated_at=company_bot.updated_at.isoformat() if company_bot.updated_at else "",
    )


@router.get("", response_model=List[CompanyBotResponse])
async def list_company_bots(
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
    active_only: bool = True,
) -> List[CompanyBotResponse]:
    """
    Получает список ботов компаний.
    Суперадмин видит все компании, админ компании - только свою.
    """
    stmt = select(CompanyBot)
    
    # Если это админ компании, показываем только его компанию
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if not current_admin.company_bot_id:
            return []
        stmt = stmt.where(CompanyBot.id == current_admin.company_bot_id)
    
    if active_only:
        stmt = stmt.where(CompanyBot.is_active == True)
    
    result = await db.execute(stmt)
    bots = result.scalars().all()
    
    return [
        CompanyBotResponse(
            id=bot.id,
            bot_token=bot.bot_token,
            bot_username=bot.bot_username,
            bot_id=bot.bot_id,
            group_id=bot.group_id,
            company_name=bot.company_name,
            is_active=bot.is_active,
            bot_metadata=bot.bot_metadata,
            created_at=bot.created_at.isoformat() if bot.created_at else "",
            updated_at=bot.updated_at.isoformat() if bot.updated_at else "",
        )
        for bot in bots
    ]


@router.get("/{bot_id}", response_model=CompanyBotResponse)
async def get_company_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
) -> CompanyBotResponse:
    """
    Получает информацию о конкретном боте компании.
    Требуется авторизация.
    """
    stmt = select(CompanyBot).where(CompanyBot.id == bot_id)
    result = await db.execute(stmt)
    bot = result.scalar_one_or_none()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company bot with ID {bot_id} not found",
        )
    
    # Проверяем права доступа: админ компании может видеть только свою компанию
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this company",
            )
    
    return CompanyBotResponse(
        id=bot.id,
        bot_token=bot.bot_token,
        bot_username=bot.bot_username,
        bot_id=bot.bot_id,
        group_id=bot.group_id,
        company_name=bot.company_name,
        is_active=bot.is_active,
        bot_metadata=bot.bot_metadata,
        created_at=bot.created_at.isoformat() if bot.created_at else "",
        updated_at=bot.updated_at.isoformat() if bot.updated_at else "",
    )


@router.put("/{bot_id}", response_model=CompanyBotResponse)
async def update_company_bot(
    bot_id: int,
    bot_data: CompanyBotUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(get_current_admin),
) -> CompanyBotResponse:
    """
    Обновляет информацию о боте компании.
    Требуется авторизация.
    """
    stmt = select(CompanyBot).where(CompanyBot.id == bot_id)
    result = await db.execute(stmt)
    bot = result.scalar_one_or_none()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company bot with ID {bot_id} not found",
        )
    
    # Проверяем права доступа: админ компании может обновлять только свою компанию
    if current_admin.role_enum == AdminRole.COMPANY_ADMIN:
        if current_admin.company_bot_id != bot_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this company",
            )
    
    # Обновляем только переданные поля
    update_data = bot_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bot, field, value)
    
    await db.commit()
    await db.refresh(bot)
    
    logger.info(f"[CompanyBot] Обновлен бот компании: ID={bot.id}")
    
    return CompanyBotResponse(
        id=bot.id,
        bot_token=bot.bot_token,
        bot_username=bot.bot_username,
        bot_id=bot.bot_id,
        group_id=bot.group_id,
        company_name=bot.company_name,
        is_active=bot.is_active,
        bot_metadata=bot.bot_metadata,
        created_at=bot.created_at.isoformat() if bot.created_at else "",
        updated_at=bot.updated_at.isoformat() if bot.updated_at else "",
    )


@router.get("/by-group/{group_id}")
async def get_company_bot_by_group(
    group_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Получает информацию о боте компании для группы по group_id.
    Ищет бота через цепочку: GroupRoleMapping -> CompanyRole -> CompanyBot.
    Используется scheduler для определения, какой бот использовать для отправки уведомлений.
    Не требует авторизации (внутренний эндпоинт).
    """
    from models.group_role_mapping import GroupRoleMapping
    from models.company_role import CompanyRole
    
    # Сначала пробуем найти через group_role_mappings
    stmt = (
        select(CompanyBot)
        .join(CompanyRole, CompanyBot.id == CompanyRole.company_bot_id)
        .join(GroupRoleMapping, CompanyRole.id == GroupRoleMapping.company_role_id)
        .where(
            GroupRoleMapping.group_id == group_id,
            CompanyBot.is_active == True,
            CompanyRole.is_active == True
        )
    )
    result = await db.execute(stmt)
    bot = result.scalar_one_or_none()
    
    # Если не найден через group_role_mappings, пробуем напрямую через group_id в CompanyBot
    if not bot:
        stmt = select(CompanyBot).where(
            CompanyBot.group_id == group_id,
            CompanyBot.is_active == True
        )
        result = await db.execute(stmt)
        bot = result.scalar_one_or_none()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company bot not found for group {group_id}",
        )
    
    # Получаем BOT_API_URL из переменных окружения или конфига
    # В обоих окружениях (dev и prod) боты компаний работают через bot-companies
    import os
    from core.config import settings
    env = os.getenv('ENVIRONMENT', 'development')
    if env == 'development':
        # В dev окружении ВСЕГДА используем bot-companies для ботов компаний
        # независимо от BOT_API_URL в переменных окружения
        bot_api_url = 'http://bot-companies:8003'
    else:
        # В prod окружении тоже используем bot-companies
        bot_api_url = os.getenv('BOT_API_URL') or 'http://bot-companies:8003'
    
    # Возвращаем словарь с дополнительным полем bot_api_url
    return {
        "id": bot.id,
        "bot_token": bot.bot_token,
        "bot_username": bot.bot_username,
        "bot_id": bot.bot_id,
        "group_id": bot.group_id,
        "company_name": bot.company_name,
        "is_active": bot.is_active,
        "bot_metadata": bot.bot_metadata,
        "created_at": bot.created_at.isoformat() if bot.created_at else "",
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else "",
        "bot_api_url": bot_api_url
    }


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company_bot(
    bot_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_admin = Depends(require_super_admin),  # Только суперадмин может удалять
):
    """
    Удаляет бота компании (или деактивирует).
    Требуется авторизация.
    """
    stmt = select(CompanyBot).where(CompanyBot.id == bot_id)
    result = await db.execute(stmt)
    bot = result.scalar_one_or_none()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company bot with ID {bot_id} not found",
        )
    
    # Вместо удаления деактивируем
    bot.is_active = False
    await db.commit()
    
    logger.info(f"[CompanyBot] Деактивирован бот компании: ID={bot.id}")
    
    return None

