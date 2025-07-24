# backend/API server/models/competition.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Text, BigInteger, ForeignKey, Enum, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from .base import Base

class CompetitionStatus(enum.Enum):
    DRAFT = "draft"           # Черновик
    ANNOUNCEMENT = "announcement"  # Анонс
    ACTIVE = "active"         # Идет
    COMPLETED = "completed"   # Завершен
    CANCELLED = "cancelled"   # Отменен

class Competition(Base):
    __tablename__ = "competitions"

    # --- Основные поля ---
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    full_description = Column(Text, nullable=True)
    
    # --- Статус ---
    status = Column(Enum(CompetitionStatus, values_callable=lambda obj: [e.value for e in obj]), nullable=False, default=CompetitionStatus.DRAFT, index=True)
    
    # --- Даты ---
    start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    end_date = Column(DateTime(timezone=True), nullable=False, index=True)
    registration_deadline = Column(DateTime(timezone=True), nullable=True)  # Дедлайн регистрации
    
    # --- Приз ---
    prize = Column(String(255), nullable=True)  # Описание приза
    dynamic_prize_config = Column(JSON, nullable=True)  # Конфигурация динамического приза
    
    # --- Участники ---
    max_participants = Column(Integer, nullable=True)  # Максимум участников
    current_participants = Column(Integer, default=0)  # Текущее количество
    
    # --- Контент конкурса (JSON для гибкости) ---
    competition_data = Column(JSON, nullable=True)  # Все специфичные данные конкурса
    rules = Column(JSON, nullable=True)  # Правила конкурса
    evaluation_criteria = Column(JSON, nullable=True)  # Критерии оценки и их приоритеты
    victory_description = Column(Text, nullable=True)  # Описание победы (показывается после завершения)
    
    # --- Целевые группы ---
    target_groups = Column(JSON, nullable=True)  # ["chef", "courier", "admin"]
    target_chat_ids = Column(JSON, nullable=True)  # Список ID чатов
    
    # --- Файлы ---
    images = Column(JSON, nullable=True)  # Список URL изображений
    attachments = Column(JSON, nullable=True)  # Дополнительные файлы
    
    # --- Создатель ---
    created_by = Column(BigInteger, nullable=False, index=True)  # ID создателя
    
    # --- Временные метки ---
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    # --- Связи ---
    participants = relationship("CompetitionParticipant", back_populates="competition", cascade="all, delete-orphan")
    winners = relationship("CompetitionWinner", back_populates="competition", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Competition(id={self.id}, title='{self.title}', status='{self.status.value}')>"


class CompetitionParticipant(Base):
    __tablename__ = "competition_participants"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"), nullable=False, index=True)
    user_id = Column(BigInteger, nullable=False, index=True)  # Может быть ID пользователя или группы
    participant_type = Column(String(50), default="individual", index=True)  # individual, branch, team
    
    # --- Статус участия ---
    status = Column(String(50), default="registered", index=True)  # registered, approved, rejected, withdrawn
    
    # --- Информация об участнике ---
    user_name = Column(String(255), nullable=True)
    user_position = Column(String(255), nullable=True)
    user_department = Column(String(255), nullable=True)
    branch_name = Column(String(255), nullable=True)  # Название филиала
    branch_id = Column(String(100), nullable=True)    # ID филиала
    
    # --- Дополнительные данные участника ---
    participant_data = Column(JSON, nullable=True)  # Любые дополнительные данные
    result_score = Column(Integer, nullable=True)  # Результат участника (например, количество коробок)
    result_time = Column(Integer, nullable=True)  # Время выполнения в секундах
    ranking_position = Column(Integer, nullable=True)  # Позиция в рейтинге
    result_accuracy = Column(Float, nullable=True)  # Точность (например, процент недостачи)
    result_secondary_score = Column(Float, nullable=True)  # Вторичный критерий оценки
    external_data_source = Column(String(100), nullable=True)  # Источник данных (accounting, manual, etc.)
    external_data_id = Column(String(255), nullable=True)  # ID записи во внешней системе
    video_url = Column(String(512), nullable=True)  # Ссылка на видео зачёта
    
    # --- Временные метки ---
    registered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # --- Связи ---
    competition = relationship("Competition", back_populates="participants")

    def __repr__(self):
        return f"<CompetitionParticipant(competition_id={self.competition_id}, user_id={self.user_id}, status='{self.status}')>"


class CompetitionWinner(Base):
    __tablename__ = "competition_winners"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"), nullable=False, index=True)
    user_id = Column(BigInteger, nullable=True, index=True)  # ID пользователя (может быть null для групп)
    group_id = Column(BigInteger, nullable=True, index=True)  # ID группы (может быть null для пользователей)
    
    # --- Информация о победителе ---
    place = Column(Integer, nullable=False)  # 1, 2, 3 место
    prize = Column(String(255), nullable=True)  # Описание приза
    
    # --- Дополнительная информация ---
    user_name = Column(String(255), nullable=True)
    user_position = Column(String(255), nullable=True)
    user_department = Column(String(255), nullable=True)
    
    # --- Дополнительные данные победителя ---
    winner_data = Column(JSON, nullable=True)  # Любые дополнительные данные
    long_term_status = Column(Boolean, default=False)  # Долгосрочный статус победителя
    status_expires_at = Column(DateTime(timezone=True), nullable=True)  # Дата истечения статуса
    
    # --- Временные метки ---
    announced_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # --- Связи ---
    competition = relationship("Competition", back_populates="winners")

    def __repr__(self):
        return f"<CompetitionWinner(competition_id={self.competition_id}, user_id={self.user_id}, place={self.place})>" 