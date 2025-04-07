from sqlalchemy import Column, Integer, String, BigInteger, DateTime, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True) # Был SERIAL
    group_id = Column(BigInteger, unique=True, index=True, nullable=False) # Был BIGINT, это Telegram ID группы
    title = Column(String(255), nullable=False)
    group_type = Column(String(50), nullable=False) # <<< ДОБАВЛЕНО: Тип группы (courier, chef, general)
    username = Column(String(255), nullable=True) # Имя пользователя группы (если есть)
    description = Column(String, nullable=True) # Был TEXT
    members_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    json_metadata = Column("metadata", JSON, nullable=True) # Был JSONB

    # Связь с ассоциативной таблицей group_members
    members_association = relationship("GroupMember", back_populates="group")

    # Связь со сменами (одна группа - много смен)
    shifts = relationship("Shift", back_populates="group")

    # Ограничение уникальности для group_id (хотя уже есть unique=True)
    __table_args__ = (UniqueConstraint('group_id', name='uq_group_group_id'),) 