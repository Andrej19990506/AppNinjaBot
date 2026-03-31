import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict
from urllib.parse import parse_qsl
import hashlib
import hmac

from fastapi import HTTPException, status
from pydantic import BaseModel
from telegram_init_data import validate as validate_init_data

from core.config import settings

logger = logging.getLogger(__name__)


class TelegramAuthorizedUser(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    language_code: str | None = None
    photo_url: str | None = None


class TelegramAuthPayload(BaseModel):
    user: TelegramAuthorizedUser
    auth_date: datetime
    query_id: str | None = None
    raw_data: Dict[str, Any]




def _validate_auth_date(auth_date: int) -> datetime:
    auth_datetime = datetime.fromtimestamp(auth_date, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    max_age = settings.TELEGRAM_INITDATA_MAX_AGE
    if max_age and (now - auth_datetime).total_seconds() > max_age:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram auth data is too old",
        )
    return auth_datetime


def validate_telegram_init_data(init_data: str) -> TelegramAuthPayload:
    logger.info(f"[Telegram Auth] Начало валидации init_data. Длина: {len(init_data)}")
    logger.info(f"[Telegram Auth] Доступно токенов для проверки: {len(settings.telegram_bot_tokens)}")
    
    if not settings.telegram_bot_tokens:
        logger.error("[Telegram Auth] Нет токенов для проверки!")
        raise RuntimeError("No TELEGRAM_BOT_TOKEN configured for verification")

    # Используем библиотеку telegram-init-data для валидации
    try:
        # Пробуем валидировать с каждым токеном
        validation_success = False
        data_dict = None
        
        for i, token in enumerate(settings.telegram_bot_tokens):
            token_preview = token[:20] + "..." if len(token) > 20 else token
            logger.info(f"[Telegram Auth] Проверка токена {i+1}: {token_preview}")
            
            try:
                # Валидируем init_data с помощью библиотеки
                # validate() выбрасывает исключение, если валидация не прошла
                validate_init_data(init_data, token)
                
                logger.info(f"[Telegram Auth] Подпись валидна для токена {i+1}")
                validation_success = True
                
                # Парсим данные вручную после успешной валидации
                # (библиотека может не поддерживать все типы чатов, поэтому парсим сами)
                pairs = parse_qsl(init_data, keep_blank_values=True)
                data_dict = dict(pairs)
                
                # Декодируем JSON-поля
                if "user" in data_dict:
                    try:
                        data_dict["user"] = json.loads(data_dict["user"])
                    except json.JSONDecodeError:
                        pass  # Оставляем как есть, если не JSON
                
                break
                
            except Exception as e:
                logger.warning(f"[Telegram Auth] Токен {i+1}: валидация не прошла - {e}")
                continue
        
        if not validation_success:
            logger.error("[Telegram Auth] Подпись не прошла валидацию ни для одного токена")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Telegram init data signature",
            )
        
        if not data_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to parse init data",
            )
        
        logger.info(f"[Telegram Auth] data_dict ключи: {list(data_dict.keys())}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Telegram Auth] Ошибка при парсинге/валидации init_data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid init data format: {str(e)}",
        )

    # Получаем user из распарсенных данных
    user_data = data_dict.get("user")
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user data in init data",
        )

    try:
        telegram_user = TelegramAuthorizedUser.model_validate(user_data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unexpected user payload structure",
        ) from exc

    # Получаем auth_date
    auth_date_raw = data_dict.get("auth_date")
    if not auth_date_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid auth_date in init data",
        )

    try:
        auth_date_int = int(auth_date_raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid auth_date in init data",
        ) from exc

    auth_datetime = _validate_auth_date(auth_date_int)

    query_id = data_dict.get("query_id")

    allowed_bots = settings.telegram_allowed_bots
    if allowed_bots and query_id:
        # query_id format: <base64>|<bot_username>; username хранится после |
        if "|" in query_id:
            _, maybe_bot = query_id.split("|", maxsplit=1)
            bot_username = maybe_bot.lower()
            if bot_username not in allowed_bots:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Telegram bot is not allowed",
                )

    return TelegramAuthPayload(
        user=telegram_user,
        auth_date=auth_datetime,
        query_id=query_id,
        raw_data=data_dict,
    )


def _compute_login_widget_hash(data: Dict[str, str], bot_token: str) -> str:
    """
    Telegram Login Widget signature verification:
    https://core.telegram.org/widgets/login#checking-authorization
    """
    provided_hash = (data.get("hash") or "").strip()
    if not provided_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing hash in Telegram login data",
        )

    # 1) Build data_check_string from all fields except 'hash'
    pairs = []
    for k in sorted(data.keys()):
        if k == "hash":
            continue
        v = data.get(k)
        if v is None:
            continue
        pairs.append(f"{k}={v}")
    data_check_string = "\n".join(pairs)

    # 2) secret_key = sha256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()

    # 3) HMAC-SHA256 over data_check_string
    calculated = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    return calculated


def validate_telegram_login_widget_data(data: Dict[str, str]) -> TelegramAuthPayload:
    """
    Validates Telegram Login Widget callback payload (query params).
    Returns normalized TelegramAuthPayload compatible with the rest of auth flow.
    """
    if not settings.telegram_bot_tokens:
        logger.error("[Telegram Login] Нет токенов для проверки!")
        raise RuntimeError("No TELEGRAM_BOT_TOKEN configured for verification")

    # auth_date
    auth_date_raw = (data.get("auth_date") or "").strip()
    if not auth_date_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing auth_date in Telegram login data",
        )
    try:
        auth_date_int = int(auth_date_raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid auth_date in Telegram login data",
        ) from exc
    auth_datetime = _validate_auth_date(auth_date_int)

    # signature: try each configured bot token (support multi-bot setups)
    provided_hash = (data.get("hash") or "").strip()
    signature_ok = False
    for i, token in enumerate(settings.telegram_bot_tokens):
        try:
            calculated = _compute_login_widget_hash(data, token)
            if hmac.compare_digest(calculated, provided_hash):
                signature_ok = True
                logger.info(f"[Telegram Login] Подпись валидна для токена {i+1}")
                break
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[Telegram Login] Ошибка проверки подписи для токена {i+1}: {e}")

    if not signature_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram login data signature",
        )

    # Build user from flat fields
    user_id_raw = (data.get("id") or "").strip()
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing id in Telegram login data",
        )
    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid id in Telegram login data",
        ) from exc

    telegram_user = TelegramAuthorizedUser(
        id=user_id,
        first_name=(data.get("first_name") or "").strip(),
        last_name=(data.get("last_name") or None),
        username=(data.get("username") or None),
        language_code=(data.get("language_code") or None),
        photo_url=(data.get("photo_url") or None),
    )

    if not telegram_user.first_name:
        # Telegram usually sends first_name, but keep strictness modest
        telegram_user.first_name = "Telegram"

    return TelegramAuthPayload(
        user=telegram_user,
        auth_date=auth_datetime,
        query_id=None,
        raw_data=dict(data),
    )


