"""
HTTP-клиент python-telegram-bot с Bearer для исходящего прокси (Go на Render).

См. go-gateway: префиксы /tgapi/ и /tgfile/ → api.telegram.org
"""
from __future__ import annotations

import httpx
from telegram.request import HTTPXRequest


class ProxyAuthHTTPXRequest(HTTPXRequest):
    """HTTPXRequest с постоянным Authorization: Bearer для Go-прокси."""

    def __init__(self, *args, forward_auth_token: str, **kwargs):
        # Важно: HTTPXRequest.__init__ внутри вызывает self._build_client() —
        # токен должен быть задан ДО super().__init__.
        self._forward_auth_token = forward_auth_token
        super().__init__(*args, **kwargs)

    def _build_client(self) -> httpx.AsyncClient:
        kw = dict(self._client_kwargs)
        kw["headers"] = {"Authorization": f"Bearer {self._forward_auth_token}"}
        return httpx.AsyncClient(**kw)
