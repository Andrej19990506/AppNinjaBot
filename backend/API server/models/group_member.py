from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True) # Первичный ключ для самой таблицы
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    # Связи с основными таблицами
    group = relationship("Group", back_populates="members_association")
    member = relationship("Member", back_populates="groups_association")

    # Ограничение уникальности: пара (group_id, member_id) должна быть уникальной
    __table_args__ = (UniqueConstraint('group_id', 'member_id', name='uq_group_member'),) 