from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True) # Был SERIAL, SQLAlchemy handle it
    user_id = Column(BigInteger, unique=True, index=True, nullable=False) # Был BIGINT, это Telegram ID
    username = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default='member') # Статус из Telegram (member, admin, etc.)?
    is_bot = Column(Boolean, default=False)
    is_senior_courier = Column(Boolean, default=False, nullable=False) # <<< ДОБАВЛЕНО: Статус старшего курьера
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    photo_url = Column(String, nullable=True) # TEXT можно представить как String без длины
    json_metadata = Column("metadata", JSON, nullable=True) # Был JSONB

    # Связь с ассоциативной таблицей group_members
    groups_association = relationship("GroupMember", back_populates="member")

    # Связь со сменами (один участник - много смен)
    shifts = relationship("Shift", back_populates="member")

    # === ДОБАВЛЕНО: Связь с резервами ===
    reserves = relationship("Reserve", back_populates="member")
    # ===================================

    # Ограничение уникальности для user_id (хотя уже есть unique=True)
    __table_args__ = (UniqueConstraint('user_id', name='uq_member_user_id'),) 