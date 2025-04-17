from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, JSON, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import relationship
from sqlalchemy.orm import Mapped
from typing import List, Optional

from .base import Base # <-- Исправляем импорт на относительный

# NEW: Import TYPE_CHECKING and forward references
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .group_member import GroupMember
    from .shift import Shift
    from .reserve import Reserve

class Member(Base):
    __tablename__ = 'members'
    
    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = Column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[Optional[str]] = Column(String(255), nullable=True)
    first_name: Mapped[Optional[str]] = Column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = Column(String(255), nullable=True)
    is_bot: Mapped[Optional[bool]] = Column(Boolean, nullable=True, server_default='false')
    joined_at: Mapped[Optional[DateTime]] = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    photo_url: Mapped[Optional[str]] = Column(String, nullable=True)
    json_metadata: Mapped[Optional[dict]] = Column("metadata", JSON, nullable=True)
    
    # Отношения - ИСПРАВЛЕНО
    groups: Mapped[List["GroupMember"]] = relationship(back_populates="member")
    shifts: Mapped[List["Shift"]] = relationship(back_populates="member")
    reserves: Mapped[List["Reserve"]] = relationship(back_populates="member")

    # Добавляем уникальный constraint и индекс через __table_args__ для лучшей практики
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_member_user_id'),
        Index('ix_members_user_id', 'user_id', unique=True),
        Index('ix_members_id', 'id', unique=False)
    )

    def __repr__(self):
        return f"<Member(id={self.id}, user_id={self.user_id}, username='{self.username}')>"

    # Добавляем метод для обновления данных профиля
    def update_profile_data(self, profile_data: dict):
        if profile_data.get('first_name') is not None:
            self.first_name = profile_data['first_name']
        if profile_data.get('last_name') is not None:
            self.last_name = profile_data['last_name']

    # Метод is_senior() больше не имеет смысла здесь 