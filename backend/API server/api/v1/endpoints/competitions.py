# backend/API server/api/v1/endpoints/competitions.py
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from db.session import get_db
from crud.competition import competition_crud
from schemas.competition import (
    CompetitionCreate, CompetitionUpdate, CompetitionResponse, CompetitionDetail,
    ParticipantCreate, ParticipantResponse, WinnerCreate, WinnerResponse,
    CompetitionList, ParticipantList, WinnerList, CompetitionFilter, CompetitionStats,
    ParticipantResultUpdate, ParticipantResultUpdateWithUserId
)
from models.competition import CompetitionStatus, CompetitionWinner
from sqlalchemy import and_

router = APIRouter()

# Простая зависимость для получения user_id из заголовка
async def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> int:
    """Получить ID текущего пользователя из заголовка X-User-ID"""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID header is required"
        )
    try:
        return int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )

# --- Основные эндпоинты для конкурсов ---

@router.post("/", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
async def create_competition(
    competition: CompetitionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Создать новый конкурс"""
    return competition_crud.create(db, competition, current_user_id)

@router.get("/", response_model=CompetitionList)
def get_competitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[CompetitionStatus] = Query(None),
    created_by: Optional[int] = Query(None),
    target_groups: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Получить список конкурсов с фильтрацией"""
    competitions = competition_crud.get_multi(
        db, skip=skip, limit=limit, status=status, 
        created_by=created_by, target_groups=target_groups, search=search
    )
    
    # TODO: Добавить подсчет общего количества для пагинации
    total = len(competitions)  # Временное решение
    
    return CompetitionList(
        competitions=competitions,
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.get("/{competition_id}", response_model=CompetitionDetail)
def get_competition(competition_id: int, db: Session = Depends(get_db)):
    """Получить конкурс по ID с участниками и победителями"""
    competition = competition_crud.get_with_relations(db, competition_id)
    if not competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    return competition

@router.put("/{competition_id}", response_model=CompetitionResponse)
async def update_competition(
    competition_id: int,
    competition: CompetitionUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Обновить конкурс"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа (только создатель может редактировать)
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для редактирования")
    
    updated_competition = competition_crud.update(db, competition_id, competition)
    if not updated_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    return updated_competition

@router.delete("/{competition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Удалить конкурс"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа (только создатель может удалять)
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления")
    
    success = competition_crud.delete(db, competition_id)
    if not success:
        raise HTTPException(status_code=404, detail="Конкурс не найден")

# --- Эндпоинты для управления статусом ---

@router.post("/{competition_id}/publish", response_model=CompetitionResponse)
async def publish_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Опубликовать конкурс"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для публикации")
    
    published_competition = competition_crud.publish(db, competition_id)
    if not published_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    return published_competition

@router.post("/{competition_id}/start", response_model=CompetitionResponse)
async def start_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Запустить конкурс"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для запуска")
    
    started_competition = competition_crud.start(db, competition_id)
    if not started_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    return started_competition

@router.post("/{competition_id}/complete", response_model=CompetitionResponse)
async def complete_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Завершить конкурс"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для завершения")
    
    completed_competition = competition_crud.complete(db, competition_id)
    if not completed_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    return completed_competition

# --- Эндпоинты для участников ---

@router.post("/{competition_id}/participants", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
def add_participant(
    competition_id: int,
    participant: ParticipantCreate,
    db: Session = Depends(get_db)
):
    """Добавить участника в конкурс"""
    db_participant = competition_crud.add_participant(db, competition_id, participant)
    if not db_participant:
        raise HTTPException(status_code=400, detail="Не удалось добавить участника")
    return db_participant

@router.get("/{competition_id}/participants", response_model=ParticipantList)
def get_participants(
    competition_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Получить список участников конкурса"""
    participants = competition_crud.get_participants(db, competition_id)
    
    # Применяем пагинацию
    total = len(participants)
    participants = participants[skip:skip + limit]
    
    return ParticipantList(
        participants=participants,
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.delete("/{competition_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    competition_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Удалить участника из конкурса"""
    # TODO: Проверить права доступа (участник может удалить себя, создатель может удалить любого)
    success = competition_crud.remove_participant(db, competition_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Участник не найден")

@router.patch("/{competition_id}/participants/{participant_id}/result", response_model=ParticipantResponse)
def update_participant_result(
    competition_id: int,
    participant_id: int,
    data: ParticipantResultUpdateWithUserId,
    db: Session = Depends(get_db)
):
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    if db_competition.created_by != data.user_id:
        raise HTTPException(status_code=403, detail="Нет прав для обновления результата")
    participant = competition_crud.update_participant_result(
        db, competition_id, participant_id,
        result_score=data.result_score,
        result_time=data.result_time,
        video_url=data.video_url
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Участник не найден")
    return participant

# --- Эндпоинты для победителей ---

@router.post("/{competition_id}/winners", response_model=WinnerResponse, status_code=status.HTTP_201_CREATED)
async def add_winner(
    competition_id: int,
    winner: WinnerCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Добавить победителя конкурса"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа (только создатель может добавлять победителей)
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для добавления победителя")
    
    db_winner = competition_crud.add_winner(db, competition_id, winner)
    if not db_winner:
        raise HTTPException(status_code=400, detail="Не удалось добавить победителя")
    return db_winner

@router.get("/{competition_id}/winners", response_model=WinnerList)
def get_winners(
    competition_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Получить список победителей конкурса"""
    winners = competition_crud.get_winners(db, competition_id)
    
    # Применяем пагинацию
    total = len(winners)
    winners = winners[skip:skip + limit]
    
    return WinnerList(
        winners=winners,
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.delete("/{competition_id}/winners/{winner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_winner(
    competition_id: int,
    winner_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Удалить победителя из конкурса по ID победителя"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа (только создатель может удалять победителей)
    if db_competition.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления победителя")
    
    # Находим победителя по ID
    winner = db.query(CompetitionWinner).filter(
        and_(
            CompetitionWinner.competition_id == competition_id,
            CompetitionWinner.id == winner_id
        )
    ).first()
    
    if not winner:
        raise HTTPException(status_code=404, detail="Победитель не найден")
    
    success = competition_crud.remove_winner(db, competition_id, user_id=winner.user_id, group_id=winner.group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Победитель не найден")

# --- Эндпоинты для статистики ---

@router.get("/stats/overview", response_model=CompetitionStats)
def get_competition_stats(db: Session = Depends(get_db)):
    """Получить общую статистику по конкурсам"""
    return competition_crud.get_stats(db) 