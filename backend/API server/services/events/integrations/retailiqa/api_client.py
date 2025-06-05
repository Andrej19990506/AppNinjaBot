import httpx
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from loguru import logger
from pydantic import ValidationError
from core.config import settings

class RetailiQAApiClient:
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url or settings.RETAILIQA_API_BASE_URL
        self.api_token = token or settings.RETAILIQA_TOKEN
        if not self.base_url:
            raise ValueError("RETAILIQA_API_BASE_URL must be configured.")
        self.headers = {}
        if self.api_token:
            self.headers["Authorization"] = f"Token {self.api_token}"
            logger.info(f"RetailiQAApiClient initialized. Token set in headers: {'Yes' if self.api_token else 'No'}")

    async def _request(self, method: str, endpoint: str, params: Optional[Dict[str, Any]] = None, json_data: Optional[Dict[str, Any]] = None) -> Any:
        request_headers = self.headers.copy()
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        logger.debug(f"RetailiQA API Request: {method} {url} | Headers: {request_headers} | Params: {params} | JSON: {json_data}")
        async with httpx.AsyncClient(timeout=settings.RETAILIQA_API_TIMEOUT) as client:
            try:
                response = await client.request(method, url, params=params, json=json_data, headers=request_headers)
                response.raise_for_status()
                logger.debug(f"RetailiQA API Response: {response.status_code} | Content: {response.text[:500]}...")
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"RetailiQA API HTTPStatusError: {e.response.status_code} for {e.request.url} - {e.response.text}")
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Error from RetailiQA API ({e.response.status_code}) for {e.request.url}: {e.response.text}"
                )
            except httpx.RequestError as e:
                logger.error(f"RetailiQA API RequestError for {e.request.url}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Could not connect to RetailiQA API ({e.request.url}): {e}"
                )
            except Exception as e:
                logger.error(f"RetailiQA API Generic Exception: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred while communicating with RetailiQA API."
                )

    # Пример метода для получения отчётов (остальные методы аналогично)
    async def get_reports(self, date_from: Optional[str] = None, date_to: Optional[str] = None, limit: int = 100, offset: int = 0, check_obj_name: Optional[str] = None, category_name: Optional[str] = None, insp_type_name: Optional[str] = None) -> Any:
        endpoint = "report/"
        payload: Dict[str, Any] = {"limit": limit, "offset": offset}
        if date_from:
            payload["from_date"] = date_from
        if date_to:
            payload["to_date"] = date_to
        if check_obj_name:
            payload["check_obj_name"] = check_obj_name
        if category_name:
            payload["category_name"] = category_name
        if insp_type_name:
            payload["insp_type_name"] = insp_type_name
        if self.api_token and not self.headers.get("Authorization"):
            payload["token"] = self.api_token
        return await self._request(method="POST", endpoint=endpoint, json_data=payload)

    async def get_check_objects(self, name_filter: Optional[str] = None, limit: int = 100, offset: int = 0) -> Any:
        endpoint = "check_objects/"
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if name_filter:
            params["name"] = name_filter
        if self.api_token and not self.headers.get("Authorization"):
            params["token"] = self.api_token
        return await self._request(method="GET", endpoint=endpoint, params=params) 