import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from urllib.parse import parse_qsl

from fastapi import HTTPException, status
from pydantic import BaseModel

from core.config import settings


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
    filtered = [(k, v) for k, v in pairs if k != "hash"]
    filtered.sort(key=lambda item: item[0])
    return "\n".join(f"{k}={v}" for k, v in filtered)


def _verify_signature(data_check_string: str, received_hash: str) -> bool:
    for token in settings.telegram_bot_tokens:
        secret_key = _get_secret_key(token)
        computed_hash = hmac.new(
            secret_key,
            msg=data_check_string.encode(),
            digestmod=hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(computed_hash, received_hash):
            return True
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
    if not settings.telegram_bot_tokens:
        raise RuntimeError("No TELEGRAM_BOT_TOKEN configured for verification")

    pairs = parse_qsl(init_data, keep_blank_values=True)
    if not pairs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty init data",
        )

    data_dict = dict(pairs)
    received_hash = data_dict.get("hash")
    if not received_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing hash in init data",
        )

    data_check_string = _build_data_check_string(pairs)
    if not _verify_signature(data_check_string, received_hash):
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


