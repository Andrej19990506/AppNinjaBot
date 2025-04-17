from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime, Index, String, func, Boolean
from sqlalchemy.orm import relationship
from .base import Base

class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    role = Column(String(50), nullable=False, server_default='member')
    is_senior_courier = Column(Boolean, nullable=True)

    # Связи с основными таблицами
    group = relationship("Group", back_populates="members")
    member = relationship("Member", back_populates="groups")

    # Ограничение уникальности: пара (group_id, member_id) должна быть уникальной
    __table_args__ = (
        UniqueConstraint('group_id', 'member_id', name='uq_group_member'),
        Index('ix_group_members_group_id', 'group_id', unique=False),
        Index('ix_group_members_member_id', 'member_id', unique=False),
        Index('ix_group_members_id', 'id', unique=False)
    )

    def __repr__(self):
        return f"<GroupMember(group_id={self.group_id}, member_id={self.member_id}, role='{self.role}', senior={self.is_senior_courier})>" 