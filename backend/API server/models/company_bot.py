from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from models.base import Base


class CompanyBot(Base):
    """
    Модель для хранения информации о ботах компаний.
    Каждая компания может иметь свой бот для работы в группах.
    """
    __tablename__ = "company_bots"

    id = Column(Integer, primary_key=True, index=True)
    
    # Токен бота компании (из BotFather)
    bot_token = Column(String(255), unique=True, nullable=False, index=True)
    
    # Username бота (например, @NinjaSlovtsova_bot)
    bot_username = Column(String(100), unique=True, nullable=True, index=True)
    
    # ID бота (получается через getMe API)
    # Используем BigInteger, так как Telegram bot ID может быть больше int32
    bot_id = Column(BigInteger, unique=True, nullable=True, index=True)
    
    # Связь с группой (какой группе принадлежит этот бот)
    # Используем BigInteger для совместимости с Group.group_id (который хранит Telegram ID)
    group_id = Column(BigInteger, ForeignKey("groups.group_id"), nullable=True, index=True)
    
    # Название компании/группы (для удобства)
    company_name = Column(String(255), nullable=True)
    
    # Активен ли бот
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Дополнительная информация (JSON)
    bot_metadata = Column("metadata", Text, nullable=True)  # В БД колонка называется metadata, но в модели используем bot_metadata
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связь с группой
    group = relationship("Group", backref="company_bots")

