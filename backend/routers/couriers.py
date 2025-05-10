from typing import Optional
import os
import json
import traceback
from fastapi import APIRouter
from log import logger

router = APIRouter()

@router.get("/{courier_id}/status")
async def get_courier_status(courier_id: int, chat_id: Optional[str] = None):
    """Получение статуса курьера"""
    try:
        logger.info(f"=== Получение статуса курьера {courier_id} ===")
        logger.info(f"Chat ID: {chat_id}")
        
        # Проверяем, является ли пользователь старшим курьером
        is_senior_courier = False
        
        if chat_id:
            # Проверяем файл группы
            group_file = f"data/courier_groups/group_{chat_id}.json"
            if os.path.exists(group_file):
                with open(group_file, 'r', encoding='utf-8') as f:
                    group_data = json.load(f)
                    # Проверяем, является ли пользователь старшим курьером
                    is_senior_courier = group_data.get('senior_courier_id') == str(courier_id)
                    logger.info(f"Статус старшего курьера из файла группы: {is_senior_courier}")
        
        return {
            "success": True,
            "is_senior_courier": is_senior_courier
        }
        
    except Exception as e:
        logger.error(f"Ошибка при получении статуса курьера: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e)
        } 