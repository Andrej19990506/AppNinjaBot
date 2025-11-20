from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, Optional

import jwt
from fastapi import HTTPException, status
from pydantic import BaseModel

from core.config import settings


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


class TokenPayload(BaseModel):
    sub: str
    type: TokenType
    exp: datetime
    iat: datetime


def _create_token(
    subject: str,
    token_type: TokenType,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY is not configured")

    now = datetime.now(timezone.utc)
    if expires_delta is None:
        if token_type is TokenType.ACCESS:
            expires_delta = timedelta(seconds=settings.JWT_ACCESS_TOKEN_EXPIRES)
        else:
            expires_delta = timedelta(seconds=settings.JWT_REFRESH_TOKEN_EXPIRES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
    }

    if additional_claims:
        payload.update(additional_claims)

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token


def create_access_token(subject: str | int, claims: Optional[Dict[str, Any]] = None) -> str:
    return _create_token(str(subject), TokenType.ACCESS, additional_claims=claims)


def create_refresh_token(subject: str | int, claims: Optional[Dict[str, Any]] = None) -> str:
    return _create_token(str(subject), TokenType.REFRESH, additional_claims=claims)


def decode_token(token: str, expected_type: TokenType) -> TokenPayload:
    try:
        decoded = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    token_type = decoded.get("type")
    if token_type != expected_type.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect token type",
        )

    try:
        payload = TokenPayload.model_validate(decoded)
        # Сохраняем дополнительные поля из decoded в payload для доступа к ним
        # Pydantic модель не включает дополнительные поля в model_dump(), поэтому сохраняем их отдельно
        payload._decoded_dict = decoded  # type: ignore
    except Exception as exc:  # pragma: no cover - pydantic validation errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload",
        ) from exc

    return payload


