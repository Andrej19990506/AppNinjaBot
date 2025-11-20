import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from urllib.parse import parse_qsl, unquote, quote

from fastapi import HTTPException, status
from pydantic import BaseModel

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


def _get_secret_key(bot_token: str) -> bytes:
    return hashlib.sha256(bot_token.encode()).digest()


def _build_data_check_string(pairs: List[Tuple[str, str]]) -> str:
    logger.info(f"[Telegram Auth] _build_data_check_string: входные пары: {pairs}")
    # Исключаем только hash из data_check_string
    # В Bot API 8.0+ signature ДОЛЖЕН быть включен в data_check_string для проверки hash
    filtered = [(k, v) for k, v in pairs if k != "hash"]
    logger.info(f"[Telegram Auth] _build_data_check_string: отфильтрованные пары (без hash): {filtered}")
    filtered.sort(key=lambda item: item[0])
    logger.info(f"[Telegram Auth] _build_data_check_string: отсортированные пары: {filtered}")
    result = "\n".join(f"{k}={v}" for k, v in filtered)
    logger.info(f"[Telegram Auth] _build_data_check_string: результат: {repr(result)}")
    return result


def _verify_signature(data_check_string: str, received_hash: str) -> bool:
    logger.info(f"[Telegram Auth] Проверка подписи. Токенов для проверки: {len(settings.telegram_bot_tokens)}")
    logger.info(f"[Telegram Auth] data_check_string: {data_check_string}")
    logger.info(f"[Telegram Auth] received_hash: {received_hash}")
    
    for i, token in enumerate(settings.telegram_bot_tokens):
        token_preview = token[:20] + "..." if len(token) > 20 else token
        logger.info(f"[Telegram Auth] Проверка токена {i+1}: {token_preview}")
        secret_key = _get_secret_key(token)
        computed_hash = hmac.new(
            secret_key,
            msg=data_check_string.encode(),
            digestmod=hashlib.sha256,
        ).hexdigest()
        logger.info(f"[Telegram Auth] Токен {i+1}: computed_hash={computed_hash}, received_hash={received_hash}")
        logger.info(f"[Telegram Auth] Токен {i+1}: совпадение={computed_hash == received_hash}")
        if hmac.compare_digest(computed_hash, received_hash):
            logger.info(f"[Telegram Auth] Подпись валидна для токена {i+1}")
            return True
    logger.warning(f"[Telegram Auth] Подпись не прошла валидацию ни для одного токена")
    return False


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

    # Парсим init_data вручную, сохраняя исходные URL-encoded значения
    # Это нужно для правильной проверки подписи
    pairs_raw = []
    for pair in init_data.split('&'):
        if '=' in pair:
            key, value = pair.split('=', 1)
            pairs_raw.append((key, value))
    
    logger.info(f"[Telegram Auth] Распарсено пар (raw): {len(pairs_raw)}")
    
    if not pairs_raw:
        logger.error("[Telegram Auth] Пустые данные init_data")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty init data",
        )

    # Создаем словарь из raw пар для получения hash
    data_dict_raw = dict(pairs_raw)
    received_hash = data_dict_raw.get("hash")
    if not received_hash:
        logger.error("[Telegram Auth] Отсутствует hash в init_data")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing hash in init data",
        )

    # Для парсинга user и других полей декодируем значения
    pairs = [(k, unquote(v)) for k, v in pairs_raw]
    data_dict = dict(pairs)
    logger.info(f"[Telegram Auth] data_dict ключи: {list(data_dict.keys())}")
    
    # Для проверки подписи используем ДЕКОДИРОВАННЫЕ значения (как в документации Telegram)
    # parse_qsl автоматически декодирует значения, что соответствует спецификации Telegram
    data_check_string = _build_data_check_string(pairs)
    logger.info(f"[Telegram Auth] data_check_string построен: {data_check_string}")
    
    if not _verify_signature(data_check_string, received_hash):
        logger.error(f"[Telegram Auth] Подпись не прошла валидацию. received_hash: {received_hash}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram init data signature",
        )

    raw_user = data_dict.get("user")
    if not raw_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user data in init data",
        )

    try:
        user_payload = json.loads(raw_user)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user payload in init data",
        ) from exc

    try:
        telegram_user = TelegramAuthorizedUser.model_validate(user_payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unexpected user payload structure",
        ) from exc

    try:
        auth_date_raw = int(data_dict["auth_date"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid auth_date in init data",
        ) from exc

    auth_datetime = _validate_auth_date(auth_date_raw)

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


