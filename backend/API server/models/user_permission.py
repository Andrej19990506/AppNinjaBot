from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class UserPermission(Base):
    __tablename__ = 'user_permissions'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey('members.user_id'), nullable=False, index=True)
    group_id = Column(BigInteger, ForeignKey('groups.group_id'), nullable=False, index=True)
    permission_type = Column(String(50), nullable=False, index=True)  # 'inventory', 'writeoff', 'events'
    granted_by = Column(BigInteger, ForeignKey('members.user_id'), nullable=False)
    granted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, server_default='true', index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(BigInteger, ForeignKey('members.user_id'), nullable=True)
    
    # Связи
    user = relationship("Member", foreign_keys=[user_id], primaryjoin="UserPermission.user_id == Member.user_id")
    granted_by_user = relationship("Member", foreign_keys=[granted_by], primaryjoin="UserPermission.granted_by == Member.user_id")
    revoked_by_user = relationship("Member", foreign_keys=[revoked_by], primaryjoin="UserPermission.revoked_by == Member.user_id")
    group = relationship("Group", foreign_keys=[group_id], primaryjoin="UserPermission.group_id == Group.group_id")

    def __repr__(self):
        return f"<UserPermission(user_id={self.user_id}, group_id={self.group_id}, permission='{self.permission_type}', active={self.is_active})>" 