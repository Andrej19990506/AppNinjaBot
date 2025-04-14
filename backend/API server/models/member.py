from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, JSON, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import relationship
from .base import Base # <-- Исправляем импорт на относительный

class Member(Base):
    __tablename__ = 'members'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    is_bot = Column(Boolean, nullable=True, server_default='false')
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    photo_url = Column(String, nullable=True)
    json_metadata = Column("metadata", JSON, nullable=True)
    
    # Отношения
    groups_association = relationship("GroupMember", back_populates="member")
    shifts = relationship("Shift", back_populates="member")
    reserves = relationship("Reserve", back_populates="member")

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