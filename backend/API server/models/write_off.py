from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class WriteOff(Base):
    __tablename__ = 'write_offs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(BigInteger, ForeignKey('groups.group_id'), nullable=False)
    user_id = Column(BigInteger, ForeignKey('members.user_id'), nullable=False)
    name = Column(String(255), nullable=False)
    reason = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    unit_type = Column(String(10), nullable=False, default='шт')
    photo_path = Column(String(500), nullable=True, comment='Путь к фото списания')
    date = Column(Date, nullable=False, server_default=func.current_date())  # Дата списания (без времени)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    
    # Relationship с автором списания
    author_member = relationship("Member", foreign_keys=[user_id], primaryjoin="WriteOff.user_id == Member.user_id") 