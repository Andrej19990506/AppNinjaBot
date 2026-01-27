# backend/API server/api/v1/endpoints/voice_contest.py
"""
API эндпоинты для голосового конкурса сбора данных для Лолы
Используем существующую систему competitions
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from datetime import datetime
import logging

from db.session import get_db
from crud.competition import competition_crud
from models.competition import Competition, CompetitionParticipant, CompetitionStatus
from schemas.competition import ParticipantCreate, ParticipantResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# СХЕМЫ ДЛЯ ГОЛОСОВОГО КОНКУРСА
# ============================================================================

class VoiceContestStats(BaseModel):
    """Статистика участника голосового конкурса"""
    total: int = 0
    hotword: int = 0
    command: int = 0
    negative: int = 0
    progress_percentage: float = 0.0
    daily_average: float = 0.0
    last_recording_at: Optional[str] = None

class VoiceContestProgressUpdate(BaseModel):
    """Обновление прогресса записи"""
    recording_type: str = Field(..., pattern="^(hotword|command|negative)$")
    increment: int = Field(default=1, ge=1, le=100)

class VoiceContestRegistration(BaseModel):
    """Регистрация участника в голосовом конкурсе"""
    user_id: int
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)

class VoiceContestParticipantResponse(BaseModel):
    """Ответ с данными участника"""
    id: int
    user_id: int
    user_name: str
    result_score: int  # Общее количество записей
    ranking_position: Optional[int] = None
    stats: VoiceContestStats
    registered_at: datetime
    
    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    """Запись в лидерборде"""
    position: int
    user_id: int
    user_name: str
    total_recordings: int
    hotword_count: int
    command_count: int
    negative_count: int
    progress_percentage: float

class VoiceContestLeaderboard(BaseModel):
    """Лидерборд голосового конкурса"""
    competition_id: int
    total_participants: int
    leaderboard: List[LeaderboardEntry]

# ============================================================================
# КОНСТАНТЫ
# ============================================================================

VOICE_CONTEST_ID = 1  # ID голосового конкурса (создать через админку)
TARGET_RECORDINGS = 2500  # Минимум записей для участия

# ============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================================================

def get_voice_contest_stats(participant: CompetitionParticipant) -> VoiceContestStats:
    """Извлекает статистику голосового конкурса из participant_data"""
    if not participant.participant_data:
        return VoiceContestStats()
    
    voice_data = participant.participant_data.get("voice_contest", {})
    return VoiceContestStats(
        total=voice_data.get("total", 0),
        hotword=voice_data.get("hotword", 0),
        command=voice_data.get("command", 0),
        negative=voice_data.get("negative", 0),
        progress_percentage=voice_data.get("progress_percentage", 0.0),
        daily_average=voice_data.get("daily_average", 0.0),
        last_recording_at=voice_data.get("last_recording_at")
    )

def update_voice_contest_stats(
    participant: CompetitionParticipant,
    recording_type: str,
    increment: int
) -> dict:
    """Обновляет статистику участника"""
    
    # Получаем текущие данные
    if not participant.participant_data:
        participant.participant_data = {}
    
    # Получаем текущую статистику или создаем новую
    current_voice_data = participant.participant_data.get("voice_contest", {
        "total": 0,
        "hotword": 0,
        "command": 0,
        "negative": 0,
        "daily_stats": {}
    })
    
    # Создаем НОВЫЙ словарь вместо изменения существующего
    # Это важно для SQLAlchemy, чтобы он увидел изменения
    voice_data = current_voice_data.copy()
    
    # Обновляем счётчики
    voice_data[recording_type] = voice_data.get(recording_type, 0) + increment
    voice_data["total"] = voice_data.get("total", 0) + increment
    
    # Обновляем дневную статистику (тоже создаем новый словарь)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    daily_stats = voice_data.get("daily_stats", {}).copy()
    daily_stats[today] = daily_stats.get(today, 0) + increment
    voice_data["daily_stats"] = daily_stats
    
    # Рассчитываем средний прогресс в день
    if daily_stats:
        total_days = len(daily_stats)
        total_recordings = sum(daily_stats.values())
        voice_data["daily_average"] = round(total_recordings / total_days, 2)
    else:
        voice_data["daily_average"] = 0.0
    
    # Рассчитываем процент прогресса
    voice_data["progress_percentage"] = round((voice_data["total"] / TARGET_RECORDINGS) * 100, 2)
    
    # Обновляем время последней записи
    voice_data["last_recording_at"] = datetime.utcnow().isoformat()
    
    # ВАЖНО: Создаем новый словарь participant_data вместо изменения существующего
    participant.participant_data = {
        **participant.participant_data,
        "voice_contest": voice_data
    }
    
    # ВАЖНО: Помечаем поле как измененное, чтобы SQLAlchemy сохранило изменения в JSON
    flag_modified(participant, "participant_data")
    
    # Обновляем result_score для сортировки
    participant.result_score = voice_data["total"]
    
    logger.info(f"Updated voice contest stats: {voice_data}")
    
    return voice_data

# ============================================================================
# ЭНДПОИНТЫ
# ============================================================================

@router.post("/register", response_model=VoiceContestParticipantResponse, status_code=status.HTTP_201_CREATED)
async def register_participant(
    registration: VoiceContestRegistration,
    db: Session = Depends(get_db)
):
    """
    Регистрация участника в голосовом конкурсе
    
    - **user_id**: Telegram user ID
    - **first_name**: Имя участника
    - **last_name**: Фамилия участника
    """
    try:
        logger.info(f"Voice contest registration: user_id={registration.user_id}, name={registration.first_name} {registration.last_name}")
        
        # Проверяем, существует ли конкурс
        competition = competition_crud.get(db, VOICE_CONTEST_ID)
        if not competition:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Voice contest with ID {VOICE_CONTEST_ID} not found"
            )
        
        # Проверяем, что конкурс активен
        if competition.status not in [CompetitionStatus.ANNOUNCEMENT, CompetitionStatus.ACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Voice contest is not active (status: {competition.status.value})"
            )
        
        # Проверяем, не зарегистрирован ли уже
        existing = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID,
            CompetitionParticipant.user_id == registration.user_id
        ).first()
        
        if existing:
            logger.info(f"User {registration.user_id} already registered, returning existing participant")
            stats = get_voice_contest_stats(existing)
            return VoiceContestParticipantResponse(
                id=existing.id,
                user_id=existing.user_id,
                user_name=existing.user_name,
                result_score=existing.result_score or 0,
                ranking_position=existing.ranking_position,
                stats=stats,
                registered_at=existing.registered_at
            )
        
        # Создаём нового участника
        participant_data = ParticipantCreate(
            user_id=registration.user_id,
            user_name=f"{registration.first_name} {registration.last_name}",
            user_position="Участник",
            user_department="Voice Contest",
            participant_data={
                "voice_contest": {
                    "total": 0,
                    "hotword": 0,
                    "command": 0,
                    "negative": 0,
                    "progress_percentage": 0.0,
                    "daily_average": 0.0,
                    "daily_stats": {},
                    "last_recording_at": None
                }
            }
        )
        
        participant = competition_crud.add_participant(db, VOICE_CONTEST_ID, participant_data)
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register participant"
            )
        
        logger.info(f"Successfully registered user {registration.user_id} in voice contest")
        
        stats = get_voice_contest_stats(participant)
        return VoiceContestParticipantResponse(
            id=participant.id,
            user_id=participant.user_id,
            user_name=participant.user_name,
            result_score=participant.result_score or 0,
            ranking_position=participant.ranking_position,
            stats=stats,
            registered_at=participant.registered_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering participant: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/progress/{user_id}", response_model=VoiceContestParticipantResponse)
async def get_participant_progress(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Получить прогресс участника
    
    - **user_id**: Telegram user ID
    """
    try:
        participant = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID,
            CompetitionParticipant.user_id == user_id
        ).first()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Participant with user_id {user_id} not found"
            )
        
        stats = get_voice_contest_stats(participant)
        
        return VoiceContestParticipantResponse(
            id=participant.id,
            user_id=participant.user_id,
            user_name=participant.user_name,
            result_score=participant.result_score or 0,
            ranking_position=participant.ranking_position,
            stats=stats,
            registered_at=participant.registered_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting participant progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.patch("/progress/{user_id}", response_model=VoiceContestParticipantResponse)
async def update_participant_progress(
    user_id: int,
    progress_update: VoiceContestProgressUpdate,
    db: Session = Depends(get_db)
):
    """
    Обновить прогресс участника после записи аудио
    
    - **user_id**: Telegram user ID
    - **recording_type**: Тип записи (hotword, command, negative)
    - **increment**: Количество записей (по умолчанию 1)
    """
    try:
        logger.info(f"Updating progress for user {user_id}: {progress_update.recording_type} +{progress_update.increment}")
        
        participant = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID,
            CompetitionParticipant.user_id == user_id
        ).first()
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Participant with user_id {user_id} not found. Please register first."
            )
        
        # Обновляем статистику
        voice_data = update_voice_contest_stats(
            participant,
            progress_update.recording_type,
            progress_update.increment
        )
        
        # Пересчитываем рейтинг
        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID
        ).all()
        
        participants_sorted = sorted(
            participants,
            key=lambda p: (-(p.result_score or 0), p.registered_at)
        )
        
        for idx, p in enumerate(participants_sorted, start=1):
            p.ranking_position = idx
        
        # Сохраняем изменения в БД
        db.commit()
        logger.info(f"Committed changes to database for user {user_id}")
        
        # Обновляем объект из БД
        db.refresh(participant)
        
        # Проверяем, что данные сохранились
        refreshed_stats = get_voice_contest_stats(participant)
        logger.info(f"After refresh - stats from DB: {refreshed_stats.dict()}")
        
        logger.info(f"Successfully updated progress for user {user_id}: total={voice_data['total']}, position={participant.ranking_position}")
        
        stats = get_voice_contest_stats(participant)
        
        return VoiceContestParticipantResponse(
            id=participant.id,
            user_id=participant.user_id,
            user_name=participant.user_name,
            result_score=participant.result_score or 0,
            ranking_position=participant.ranking_position,
            stats=stats,
            registered_at=participant.registered_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating participant progress: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/leaderboard", response_model=VoiceContestLeaderboard)
async def get_leaderboard(
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Получить лидерборд голосового конкурса
    
    - **limit**: Максимум участников в ответе (по умолчанию 100)
    """
    try:
        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID
        ).order_by(
            CompetitionParticipant.result_score.desc(),
            CompetitionParticipant.registered_at
        ).limit(limit).all()
        
        leaderboard_entries = []
        
        for idx, participant in enumerate(participants, start=1):
            stats = get_voice_contest_stats(participant)
            
            entry = LeaderboardEntry(
                position=idx,
                user_id=participant.user_id,
                user_name=participant.user_name or f"Участник {participant.user_id}",
                total_recordings=stats.total,
                hotword_count=stats.hotword,
                command_count=stats.command,
                negative_count=stats.negative,
                progress_percentage=stats.progress_percentage
            )
            leaderboard_entries.append(entry)
        
        total_participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID
        ).count()
        
        return VoiceContestLeaderboard(
            competition_id=VOICE_CONTEST_ID,
            total_participants=total_participants,
            leaderboard=leaderboard_entries
        )
        
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/status")
async def get_contest_status(db: Session = Depends(get_db)):
    """
    Получить статус голосового конкурса
    
    Возвращает:
    - **status**: текущий статус конкурса (draft, announcement, active, completed, cancelled)
    - **is_visible**: true если конкурс должен отображаться (не draft)
    - **competition_id**: ID конкурса
    """
    try:
        competition = competition_crud.get(db, VOICE_CONTEST_ID)
        if not competition:
            # Если конкурс не найден, возвращаем draft
            return {
                "status": "draft",
                "is_visible": False,
                "competition_id": VOICE_CONTEST_ID
            }
        
        is_visible = competition.status != CompetitionStatus.DRAFT
        
        return {
            "status": competition.status.value,
            "is_visible": is_visible,
            "competition_id": VOICE_CONTEST_ID,
            "title": competition.title,
            "start_date": competition.start_date.isoformat() if competition.start_date else None,
            "end_date": competition.end_date.isoformat() if competition.end_date else None
        }
        
    except Exception as e:
        logger.error(f"Error getting contest status: {e}")
        # В случае ошибки возвращаем draft для безопасности
        return {
            "status": "draft",
            "is_visible": False,
            "competition_id": VOICE_CONTEST_ID
        }

@router.get("/stats/global")
async def get_global_stats(db: Session = Depends(get_db)):
    """
    Получить глобальную статистику конкурса
    """
    try:
        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == VOICE_CONTEST_ID
        ).all()
        
        total_recordings = 0
        total_hotword = 0
        total_command = 0
        total_negative = 0
        qualified_participants = 0  # >= 2500 записей
        
        for participant in participants:
            stats = get_voice_contest_stats(participant)
            total_recordings += stats.total
            total_hotword += stats.hotword
            total_command += stats.command
            total_negative += stats.negative
            
            if stats.total >= TARGET_RECORDINGS:
                qualified_participants += 1
        
        return {
            "competition_id": VOICE_CONTEST_ID,
            "total_participants": len(participants),
            "qualified_participants": qualified_participants,
            "target_per_participant": TARGET_RECORDINGS,
            "total_recordings": total_recordings,
            "hotword_recordings": total_hotword,
            "command_recordings": total_command,
            "negative_recordings": total_negative,
            "distribution": {
                "hotword_percentage": round((total_hotword / total_recordings * 100) if total_recordings > 0 else 0, 2),
                "command_percentage": round((total_command / total_recordings * 100) if total_recordings > 0 else 0, 2),
                "negative_percentage": round((total_negative / total_recordings * 100) if total_recordings > 0 else 0, 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting global stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

