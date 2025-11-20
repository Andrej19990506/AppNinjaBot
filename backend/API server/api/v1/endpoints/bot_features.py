import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db_session
from models.bot_feature import BotFeature
from schemas.bot_feature import BotFeatureResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bot-features", tags=["Bot Features"])


@router.get("", response_model=List[BotFeatureResponse])
async def list_bot_features(
    db: AsyncSession = Depends(get_db_session),
    active_only: bool = False,
) -> List[BotFeatureResponse]:
    """
    Получает список всех функций бота.
    Доступно всем авторизованным пользователям.
    """
    stmt = select(BotFeature)
    
    if active_only:
        stmt = stmt.where(BotFeature.is_active == True)
    
    stmt = stmt.order_by(BotFeature.feature_name)
    result = await db.execute(stmt)
    features = result.scalars().all()
    
    return [
        BotFeatureResponse(
            id=feature.id,
            feature_code=feature.feature_code,
            feature_name=feature.feature_name,
            description=feature.description,
            icon=feature.icon,
            is_active=feature.is_active,
            created_at=feature.created_at.isoformat() if feature.created_at else "",
            updated_at=feature.updated_at.isoformat() if feature.updated_at else "",
        )
        for feature in features
    ]


@router.get("/{feature_id}", response_model=BotFeatureResponse)
async def get_bot_feature(
    feature_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> BotFeatureResponse:
    """Получает информацию о конкретной функции бота"""
    stmt = select(BotFeature).where(BotFeature.id == feature_id)
    result = await db.execute(stmt)
    feature = result.scalar_one_or_none()
    
    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bot feature with ID {feature_id} not found",
        )
    
    return BotFeatureResponse(
        id=feature.id,
        feature_code=feature.feature_code,
        feature_name=feature.feature_name,
        description=feature.description,
        icon=feature.icon,
        is_active=feature.is_active,
        created_at=feature.created_at.isoformat() if feature.created_at else "",
        updated_at=feature.updated_at.isoformat() if feature.updated_at else "",
    )

