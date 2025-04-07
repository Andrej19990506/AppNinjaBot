import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Date, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class Reserve(Base):
    __tablename__ = 'reserves'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(Integer, ForeignKey('members.id'), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey('groups.id'), nullable=False, index=True) # Внутренний ID группы
    date = Column(Date, nullable=False, index=True) # Дата, на которую создан резерв
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    member = relationship("Member", back_populates="reserves")
    group = relationship("Group", back_populates="reserves") # Добавляем связь с группой

    def __repr__(self):
        return f"<Reserve(id={self.id}, member_id={self.member_id}, group_id={self.group_id}, date={self.date})>" 