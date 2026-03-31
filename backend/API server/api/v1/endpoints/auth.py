import logging
import json
from typing import List
import bcrypt

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import get_redis_client
from api.dependencies.auth import get_current_member
from core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from core.telegram import validate_telegram_init_data, validate_telegram_login_widget_data
from db.session import get_db_session
from models.group import Group
from models.group_member import GroupMember
from models.member import Member
from schemas.auth import (
    AuthTokenPair,
    AuthenticatedGroup,
    AuthenticatedUser,
    BotTokenAuthRequest,
    BotTokenStoreRequest,
    DevAuthRequest,
    LocalLoginRequest,
    LocalSetupRequest,
    TelegramAuthResponse,
    TelegramWebAppAuthRequest,
    TokenRefreshRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


async def _upsert_member(db: AsyncSession, user_payload) -> Member:
    stmt = select(Member).where(Member.user_id == user_payload.id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member is None:
        member = Member(
            user_id=user_payload.id,
            first_name=user_payload.first_name,
            last_name=user_payload.last_name,
            username=user_payload.username,
            photo_url=user_payload.photo_url,
            json_metadata=None,
        )
        db.add(member)
        await db.flush()
        logger.info(f"[Auth] Created member for Telegram ID {user_payload.id}")
    else:
        updated = False
        # Обновляем только если пришли новые данные
        if user_payload.first_name and member.first_name != user_payload.first_name:
            member.first_name = user_payload.first_name
            updated = True
        if user_payload.last_name is not None and member.last_name != user_payload.last_name:
            member.last_name = user_payload.last_name
            updated = True
        if user_payload.username and member.username != user_payload.username:
            member.username = user_payload.username
            updated = True
        if user_payload.photo_url and member.photo_url != user_payload.photo_url:
            member.photo_url = user_payload.photo_url
            updated = True

        if updated:
            await db.flush()
            logger.info(f"[Auth] Updated member profile for Telegram ID {user_payload.id}")

    return member


async def _load_member_groups(db: AsyncSession, member: Member) -> List[AuthenticatedGroup]:
    stmt = (
        select(GroupMember, Group)
        .join(Group, GroupMember.group_id == Group.id)
        .where(GroupMember.member_id == member.id)
    )
    result = await db.execute(stmt)
    groups: List[AuthenticatedGroup] = []
    for group_member, group in result.all():
        groups.append(
            AuthenticatedGroup(
                group_id=group.chat_id,
                title=group.title,
                group_type=group.group_type,
                role=group_member.role,
                is_senior_courier=group_member.is_senior_courier,
            )
        )
    return groups


def _build_token_pair(user_id: int) -> AuthTokenPair:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    return AuthTokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        access_expires_in=settings.JWT_ACCESS_TOKEN_EXPIRES,
        refresh_expires_in=settings.JWT_REFRESH_TOKEN_EXPIRES,
    )


@router.post("/telegram/webapp", response_model=TelegramAuthResponse)
async def authenticate_telegram_webapp(
    payload: TelegramWebAppAuthRequest,
    db: AsyncSession = Depends(get_db_session),
) -> TelegramAuthResponse:
    logger.info(f"[Auth] Получен запрос на авторизацию через Telegram WebApp")
    logger.info(f"[Auth] init_data длина: {len(payload.init_data) if payload.init_data else 0}")
    logger.info(f"[Auth] init_data preview: {payload.init_data[:100] if payload.init_data else 'N/A'}")
    
    try:
        telegram_payload = validate_telegram_init_data(payload.init_data)
        logger.info(f"[Auth] initData валидирован успешно, user_id: {telegram_payload.user.id}")
        member = await _upsert_member(db, telegram_payload.user)
        logger.info(f"[Auth] Member получен/создан: {member.user_id}")
        groups = await _load_member_groups(db, member)
        logger.info(f"[Auth] Загружено групп: {len(groups)}")
    except Exception as e:
        logger.error(f"[Auth] Ошибка при авторизации: {e}", exc_info=True)
        raise

    tokens = _build_token_pair(member.user_id)

    auth_user = AuthenticatedUser(
        user_id=member.user_id,
        first_name=member.first_name,
        last_name=member.last_name,
        username=member.username,
        photo_url=member.photo_url,
    )

    return TelegramAuthResponse(tokens=tokens, user=auth_user, groups=groups)


@router.get("/telegram/login")
async def authenticate_telegram_login_widget(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Telegram Login Widget callback.
    Telegram calls this URL with query params: id, first_name, username, photo_url, auth_date, hash, ...
    We validate signature and redirect back to SPA with issued JWT tokens.
    """
    # Query params are strings; normalize to a plain dict
    data = {k: str(v) for k, v in request.query_params.items()}

    # Важно: не логируем query целиком (там есть hash и персональные данные)
    logger.info("[Auth] Telegram Login Widget callback received")

    telegram_payload = validate_telegram_login_widget_data(data)
    member = await _upsert_member(db, telegram_payload.user)
    groups = await _load_member_groups(db, member)
    tokens = _build_token_pair(member.user_id)

    # Redirect back to the same host (frontend is served by nginx on same domain)
    scheme = request.scope.get("scheme") or "https"
    host = request.headers.get("host") or ""
    base = f"{scheme}://{host}" if host else ""

    # Put tokens in query string for SPA to pick up then immediately clean URL.
    # (Simple & works with current app architecture; no WS/polling.)
    redirect_url = f"{base}/?tg_login=1&access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    return RedirectResponse(url=redirect_url, status_code=302)


def _bcrypt_hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def _bcrypt_verify(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


@router.post("/local/login", response_model=TelegramAuthResponse)
async def authenticate_local(
    payload: LocalLoginRequest,
    db: AsyncSession = Depends(get_db_session),
) -> TelegramAuthResponse:
    """
    Локальная авторизация (без Telegram).
    - Если у Member задан password_hash: проверяем bcrypt.
    - Иначе разрешаем "первый вход" по user_id и паролю=последние 4 цифры user_id.
    """
    login_raw = (payload.login or "").strip()
    password_raw = payload.password or ""

    if not login_raw:
        raise HTTPException(status_code=400, detail="Login is required")

    member: Member | None = None

    # 1) Попытка найти по login (если пользователь уже настроил)
    stmt = select(Member).where(Member.login == login_raw)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    # 2) Фолбэк: login как user_id (первый вход)
    if member is None:
        try:
            user_id = int(login_raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        stmt = select(Member).where(Member.user_id == user_id)
        result = await db.execute(stmt)
        member = result.scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Проверка пароля
    if member.password_hash:
        if not _bcrypt_verify(password_raw, member.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    else:
        # Первый вход: пароль = последние 4 цифры user_id
        expected = str(member.user_id)[-4:]
        if password_raw != expected:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        # Зафиксируем, что пользователь вошёл: по умолчанию выставим login=user_id (если пусто)
        if not member.login:
            member.login = str(member.user_id)
            await db.flush()

    groups = await _load_member_groups(db, member)
    tokens = _build_token_pair(member.user_id)
    auth_user = AuthenticatedUser(
        user_id=member.user_id,
        first_name=member.first_name,
        last_name=member.last_name,
        username=member.username,
        photo_url=member.photo_url,
    )
    return TelegramAuthResponse(tokens=tokens, user=auth_user, groups=groups)


@router.post("/local/setup", response_model=TelegramAuthResponse)
async def setup_local_credentials(
    payload: LocalSetupRequest,
    current_member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db_session),
) -> TelegramAuthResponse:
    """
    Установка/смена логина и пароля для текущего пользователя.
    Требует Bearer access token.
    """
    new_login = payload.new_login.strip()
    new_password = payload.new_password

    # Проверяем уникальность логина
    stmt = select(Member).where(Member.login == new_login, Member.id != current_member.id)
    result = await db.execute(stmt)
    exists = result.scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=409, detail="Login already taken")

    current_member.login = new_login
    current_member.password_hash = _bcrypt_hash_password(new_password)
    await db.flush()

    groups = await _load_member_groups(db, current_member)
    tokens = _build_token_pair(current_member.user_id)
    auth_user = AuthenticatedUser(
        user_id=current_member.user_id,
        first_name=current_member.first_name,
        last_name=current_member.last_name,
        username=current_member.username,
        photo_url=current_member.photo_url,
    )
    return TelegramAuthResponse(tokens=tokens, user=auth_user, groups=groups)


@router.post("/token/refresh", response_model=AuthTokenPair)
async def refresh_tokens(
    payload: TokenRefreshRequest,
) -> AuthTokenPair:
    token_payload = decode_token(payload.refresh_token, TokenType.REFRESH)

    try:
        user_id = int(token_payload.sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed refresh token",
        ) from exc

    return _build_token_pair(user_id)


@router.get("/bot-auth-check/{session_id}")
async def check_bot_auth_token(
    session_id: str,
    redis_client = Depends(get_redis_client),
):
    """
    Проверяет наличие токена авторизации для session_id (polling механизм).
    Используется браузером для проверки, создал ли бот токен.
    """
    if not redis_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis is not available",
        )
    
    session_key = f"bot_auth_session:{session_id}"
    try:
        token = await redis_client.get(session_key)
        if token:
            # Токен найден, возвращаем его
            return {"has_token": True, "token": token}
        else:
            # Токен еще не создан или истек
            return {"has_token": False}
    except Exception as e:
        logger.error(f"[Auth] Ошибка при проверке токена для session_id {session_id}: {e}")
        return {"has_token": False}


@router.get("/bot-username")
async def get_bot_username():
    """
    Возвращает username основного бота для авторизации.
    """
    # Используем первый из allowed_bots
    allowed_bots_raw = settings.TELEGRAM_ALLOWED_BOTS
    if allowed_bots_raw:
        # Берем первый username из списка (основной бот) в оригинальном регистре
        bot_username = allowed_bots_raw.split(",")[0].strip()
        logger.info(f"[Auth] Возвращаем username бота из TELEGRAM_ALLOWED_BOTS: {bot_username}")
        return {"bot_username": bot_username}
    
    # Если allowed_bots пуст, возвращаем дефолтный
    logger.warning("[Auth] TELEGRAM_ALLOWED_BOTS не настроен, используем дефолтный username")
    return {"bot_username": "Flouix_bot"}


@router.post("/bot-token")
async def store_bot_token(
    payload: BotTokenStoreRequest,
    redis_client = Depends(get_redis_client),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Сохраняет одноразовый токен авторизации в Redis.
    Используется ботом для создания токена перед отправкой пользователю.
    """
    logger.info(f"[Auth] Запрос на сохранение токена для user_id: {payload.user_id}")
    if not redis_client:
        logger.error("[Auth] Redis клиент недоступен (None)")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis is not available",
        )
    
    # Проверяем соединение с Redis
    try:
        await redis_client.ping()
        logger.info("[Auth] Redis соединение проверено успешно")
    except Exception as e:
        logger.error(f"[Auth] Ошибка при проверке соединения с Redis: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis connection error: {str(e)}",
        )
    
    # Сохраняем токен в Redis с временем жизни
    token_key = f"bot_auth_token:{payload.token}"
    try:
        # Сохраняем токен
        await redis_client.setex(
            token_key,
            payload.expires_in,
            str(payload.user_id)
        )
        
        # Если есть session_id, сохраняем токен также по session_id и отправляем WebSocket событие
        if payload.session_id:
            session_key = f"bot_auth_session:{payload.session_id}"
            await redis_client.setex(
                session_key,
                payload.expires_in,
                payload.token  # Сохраняем сам токен, чтобы потом его использовать
            )
            logger.info(f"[Auth] Токен также сохранен по session_id: {payload.session_id}")
            
            # Отправляем WebSocket уведомление для реального времени
            try:
                notify_payload = {
                    "type": "bot_auth_token",
                    "room": f"auth_session:{payload.session_id}",
                    "data": {
                        "token": payload.token,
                        "session_id": payload.session_id
                    }
                }
                notify_payload_json = json.dumps(notify_payload)
                escaped_payload = notify_payload_json.replace("'", "''")
                sql_command = text(f"NOTIFY websocket_channel, '{escaped_payload}'")
                await db.execute(sql_command)
                logger.info(f"[Auth] WebSocket уведомление отправлено для session_id: {payload.session_id}")
            except Exception as ws_error:
                logger.error(f"[Auth] Ошибка при отправке WebSocket уведомления: {ws_error}")
                # Не прерываем выполнение, токен уже сохранен
        
        logger.info(f"[Auth] Токен сохранен в Redis для user_id: {payload.user_id}, expires_in: {payload.expires_in}s")
        return {"success": True, "token": payload.token}
    except Exception as e:
        logger.error(f"[Auth] Ошибка при сохранении токена в Redis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store token",
        )


@router.post("/telegram/bot", response_model=TelegramAuthResponse)
async def authenticate_telegram_bot(
    payload: BotTokenAuthRequest,
    db: AsyncSession = Depends(get_db_session),
    redis_client = Depends(get_redis_client),
) -> TelegramAuthResponse:
    """
    Авторизация через одноразовый токен от бота.
    Обменивает токен на JWT access/refresh токены.
    """
    if not redis_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis is not available",
        )
    
    # Получаем user_id из Redis по токену
    token_key = f"bot_auth_token:{payload.token}"
    try:
        user_id_str = await redis_client.get(token_key)
        if not user_id_str:
            logger.warning(f"[Auth] Токен не найден или истек: {payload.token[:8]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        
        user_id = int(user_id_str)
        
        # Удаляем токен после использования (одноразовый)
        await redis_client.delete(token_key)
        logger.info(f"[Auth] Токен использован и удален для user_id: {user_id}")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token format",
        )
    except Exception as e:
        logger.error(f"[Auth] Ошибка при получении токена из Redis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate token",
        )
    
    # Находим пользователя в БД
    stmt = select(Member).where(Member.user_id == user_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    
    if member is None:
        logger.warning(f"[Auth] Пользователь {user_id} не найден в БД")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )
    
    logger.info(f"[Auth] Авторизация через бота успешна для user_id: {user_id}")
    
    # Загружаем группы пользователя
    groups = await _load_member_groups(db, member)
    
    # Создаем токены
    tokens = _build_token_pair(member.user_id)
    
    auth_user = AuthenticatedUser(
        user_id=member.user_id,
        first_name=member.first_name,
        last_name=member.last_name,
        username=member.username,
        photo_url=member.photo_url,
    )
    
    return TelegramAuthResponse(tokens=tokens, user=auth_user, groups=groups)


@router.get("/redirect/{token}")
async def redirect_to_app(token: str, redis_client = Depends(get_redis_client)):
    """
    Редиректит на deep link для нативного приложения.
    Используется ботом для создания кнопки, которая открывает приложение.
    """
    logger.info(f"[Auth] Редирект на deep link для токена: {token[:8]}...")
    
    if not redis_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis is not available",
        )
    
    # Проверяем, что токен существует в Redis
    token_key = f"bot_auth_token:{token}"
    try:
        user_id = await redis_client.get(token_key)
        if not user_id:
            logger.warning(f"[Auth] Токен не найден в Redis: {token[:8]}...")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Token not found or expired",
            )
        
        # Редиректим на deep link
        deep_link = f"flowixapp://auth?auth_token={token}"
        logger.info(f"[Auth] Редирект на deep link: flowixapp://auth?auth_token={token[:8]}...")
        return RedirectResponse(url=deep_link, status_code=302)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Ошибка при редиректе: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to redirect",
        )


@router.post("/dev", response_model=TelegramAuthResponse)
async def authenticate_dev(
    payload: DevAuthRequest,
    db: AsyncSession = Depends(get_db_session),
) -> TelegramAuthResponse:
    """
    Dev-only endpoint for authentication without initData.
    Only works in development environment.
    """
    if settings.ENV != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev authentication is only available in development environment",
        )
    
    logger.info(f"[Auth] Dev авторизация для user_id: {payload.user_id}")
    
    # Находим или создаем пользователя по user_id
    stmt = select(Member).where(Member.user_id == payload.user_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {payload.user_id} not found in database",
        )
    
    logger.info(f"[Auth] Member найден: {member.user_id}, имя: {member.first_name}")
    
    # Загружаем группы пользователя
    groups = await _load_member_groups(db, member)
    logger.info(f"[Auth] Загружено групп: {len(groups)}")
    
    # Создаем токены
    tokens = _build_token_pair(member.user_id)
    
    auth_user = AuthenticatedUser(
        user_id=member.user_id,
        first_name=member.first_name,
        last_name=member.last_name,
        username=member.username,
        photo_url=member.photo_url,
    )
    
    return TelegramAuthResponse(tokens=tokens, user=auth_user, groups=groups)


