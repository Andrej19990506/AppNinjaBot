# backend/API server/api/v1/endpoints/competitions.py
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, UploadFile, File, Form, Request, Response
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
import shutil
import os
import httpx
import ffmpeg
import cloudinary
import cloudinary.uploader
from datetime import datetime

router = APIRouter()

# Получаем URL бота из переменной окружения
BOT_INTERNAL_URL = os.getenv("BOT_INTERNAL_URL", "http://bot:8003")

# Настройка Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "dzymrkr14"),
    api_key=os.getenv("CLOUDINARY_API_KEY", "729531884973171"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", "D8f3KJs53yr2D36mmxy6pEM9DuQ")
)

# Проверяем конфигурацию
print(f"🔧 Cloudinary config: cloud_name={cloudinary.config().cloud_name}, api_key={cloudinary.config().api_key}")

def compress_video(input_path: str, output_path: str, max_size_mb: int = 45) -> str:
    """Сжимает видео до указанного размера в МБ"""
    try:
        # Получаем информацию о видео
        probe = ffmpeg.probe(input_path)
        duration = float(probe['streams'][0]['duration'])
        
        # Рассчитываем битрейт для достижения нужного размера
        target_size_bits = max_size_mb * 8 * 1024 * 1024  # в битах
        target_bitrate = int(target_size_bits / duration)
        
        # Сжимаем видео
        stream = ffmpeg.input(input_path)
        stream = ffmpeg.output(stream, output_path, 
                             vcodec='libx264', 
                             acodec='aac',
                             video_bitrate=target_bitrate,
                             audio_bitrate='128k',
                             preset='fast',
                             crf=23)
        ffmpeg.run(stream, overwrite_output=True)
        
        return output_path
    except Exception as e:
        # Если сжатие не удалось, возвращаем оригинальный файл
        shutil.copy2(input_path, output_path)
        return output_path

def upload_to_cloudinary(file_path: str, filename: str) -> str:
    """Загружает файл в Cloudinary и возвращает ссылку"""
    try:
        print(f"🔧 Начинаем загрузку в Cloudinary: {filename}")
        print(f"🔧 Конфигурация: cloud_name={cloudinary.config().cloud_name}, api_key={cloudinary.config().api_key}")
        
        # Загружаем файл в Cloudinary
        result = cloudinary.uploader.upload(
            file_path,
            resource_type="video",
            folder="competition_videos",
            public_id=filename,
            overwrite=True
        )
        
        print(f"✅ Успешно загружено в Cloudinary: {result.get('secure_url')}")
        
        # Возвращаем URL для просмотра
        return result.get('secure_url')
        
    except Exception as e:
        print(f"❌ Ошибка загрузки в Cloudinary: {e}")
        print(f"🔧 Детали ошибки: {type(e).__name__}")
        return None

def save_video_locally(file_path: str, filename: str) -> str:
    """Сохраняет видео в локальном хранилище и возвращает ссылку для скачивания"""
    try:
        # Создаем директорию для постоянного хранения
        storage_dir = "/app/shared/video_storage"
        os.makedirs(storage_dir, exist_ok=True)
        
        # Создаем уникальное имя файла
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        final_filename = f"{unique_id}_{filename}"
        final_path = os.path.join(storage_dir, final_filename)
        
        # Копируем файл в постоянное хранилище
        shutil.copy2(file_path, final_path)
        
        # Возвращаем ссылку для скачивания (через nginx)
        download_url = f"http://localhost:8000/api/v1/download/video/{final_filename}"
        
        print(f"✅ Видео сохранено локально: {download_url}")
        return download_url
        
    except Exception as e:
        print(f"❌ Ошибка сохранения видео локально: {e}")
        return None

# --- Основные эндпоинты для конкурсов ---

@router.post("/", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
def create_competition(
    competition: CompetitionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def update_competition(
    competition_id: int,
    competition: CompetitionUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def delete_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def publish_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def start_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def complete_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def remove_participant(
    competition_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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
def add_winner(
    competition_id: int,
    winner: WinnerCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
):
    """Добавить победителя конкурса"""
    db_competition = competition_crud.get(db, competition_id)
    if not db_competition:
        raise HTTPException(status_code=404, detail="Конкурс не найден")
    
    # TODO: Проверить права доступа (только создатель может добавлять победителей)
    # Временно отключено для тестирования
    # if db_competition.created_by != current_user_id:
    #     raise HTTPException(status_code=403, detail="Нет прав для добавления победителя")
    
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
def remove_winner(
    competition_id: int,
    winner_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(lambda: 123)  # TODO: Заменить на реальную аутентификацию
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

@router.post("/{competition_id}/upload_video", status_code=201)
def upload_competition_video(
    competition_id: int,
    user_id: int = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    video: UploadFile = File(...),
    request: Request = None
):
    """Загрузка видео участника конкурса и отправка через Telegram-бота в группу модерации"""
    try:
        # 1. Сохраняем файл во временную папку
        save_dir = "/app/shared/competition_videos"
        try:
            os.makedirs(save_dir, exist_ok=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка создания директории: {e}")
        
        save_path = os.path.join(save_dir, f"{competition_id}_{user_id}_{video.filename}")
        
        try:
            with open(save_path, "wb") as buffer:
                shutil.copyfileobj(video.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {e}")

        # 2. Сжимаем видео если оно слишком большое
        compressed_path = save_path
        try:
            file_size_mb = os.path.getsize(save_path) / (1024 * 1024)
            print(f"📹 Оригинальный размер видео: {file_size_mb:.2f} МБ")
            
            if file_size_mb > 45:  # Если файл больше 45 МБ
                compressed_path = os.path.join(save_dir, f"compressed_{competition_id}_{user_id}_{video.filename}")
                compressed_path = compress_video(save_path, compressed_path, max_size_mb=45)
                
                # Проверяем размер после сжатия
                compressed_size_mb = os.path.getsize(compressed_path) / (1024 * 1024)
                print(f"📹 Размер после сжатия: {compressed_size_mb:.2f} МБ")
                
                # Если все еще слишком большой, пробуем еще более агрессивное сжатие
                if compressed_size_mb > 50:
                    print(f"⚠️ Файл все еще слишком большой ({compressed_size_mb:.2f} МБ), применяем экстремальное сжатие")
                    extreme_path = os.path.join(save_dir, f"extreme_{competition_id}_{user_id}_{video.filename}")
                    extreme_path = compress_video(compressed_path, extreme_path, max_size_mb=40)
                    
                    extreme_size_mb = os.path.getsize(extreme_path) / (1024 * 1024)
                    print(f"📹 Размер после экстремального сжатия: {extreme_size_mb:.2f} МБ")
                    
                    # Удаляем промежуточный файл
                    os.remove(compressed_path)
                    compressed_path = extreme_path
                
                # Удаляем оригинальный файл
                os.remove(save_path)
            else:
                print(f"📹 Видео не требует сжатия: {file_size_mb:.2f} МБ")
        except Exception as e:
            print(f"❌ Ошибка при сжатии видео: {e}")
            # Если сжатие не удалось, используем оригинальный файл
            compressed_path = save_path

        # 4. Всегда загружаем в Cloudinary
        final_file_size_mb = os.path.getsize(compressed_path) / (1024 * 1024)
        print(f"📊 Финальный размер файла: {final_file_size_mb:.2f} МБ")
        
        print("☁️ Загружаем в Cloudinary")
        
        # Загружаем в Cloudinary
        cloudinary_link = upload_to_cloudinary(
            compressed_path, 
            f"competition_{competition_id}_{user_id}_{video.filename}"
        )
        
        if cloudinary_link:
            # Отправляем ссылку через бота
            cloudinary_caption = f"🎥 Видео для модерации\nПользователь: {first_name} {last_name} (ID: {user_id})\nКонкурс: {competition_id}\n\n📁 Файл загружен в Cloudinary:\n{cloudinary_link}"
            
            bot_url = f"{BOT_INTERNAL_URL}/internal/send-message"
            payload = {
                "chat_id": "-1004882333113",
                "text": cloudinary_caption
            }
            
            try:
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(bot_url, json=payload)
                    if resp.status_code != 200:
                        raise HTTPException(status_code=500, detail=f"Ошибка отправки ссылки через бота: {resp.status_code}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ошибка отправки ссылки: {e}")
            
            # Удаляем файл после загрузки в Drive
            if os.path.exists(compressed_path):
                os.remove(compressed_path)
                
            return {"success": True, "message": "Видео загружено в Cloudinary", "cloudinary_link": cloudinary_link}
        else:
            # Если не удалось загрузить в Drive, возвращаем ошибку
            if os.path.exists(compressed_path):
                os.remove(compressed_path)
            raise HTTPException(status_code=500, detail="Не удалось загрузить видео в Cloudinary")
        
    except HTTPException:
        raise
    except Exception as e:
        # Очищаем файлы в случае любой неожиданной ошибки
        if 'save_path' in locals() and os.path.exists(save_path):
            os.remove(save_path)
        if 'compressed_path' in locals() and os.path.exists(compressed_path):
            os.remove(compressed_path)
        raise HTTPException(status_code=500, detail=f"Неожиданная ошибка: {e}") 