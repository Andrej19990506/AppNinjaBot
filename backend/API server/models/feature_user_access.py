from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime, Index, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class FeatureUserAccess(Base):
    """
    Модель для хранения доступов к функционалу, выданных делегатами пользователям.
    Когда делегат раздает доступ пользователю в приложении, создается запись здесь.
    """
    __tablename__ = "feature_user_accesses"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с привязкой роли и функционала
    role_feature_mapping_id = Column(Integer, ForeignKey("role_feature_mappings.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Группа, в которой выдан доступ
    group_id = Column(BigInteger, ForeignKey("groups.group_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Пользователь, которому выдан доступ (Telegram user_id)
    user_id = Column(BigInteger, nullable=False, index=True)
    
    # Кто выдал доступ (делегат, Telegram user_id)
    granted_by_user_id = Column(BigInteger, nullable=False, index=True)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Опционально: срок действия доступа
    
    # Связи
    role_feature_mapping = relationship("RoleFeatureMapping", backref="user_accesses")
    group = relationship("Group", backref="feature_user_accesses")
    
    # Ограничение уникальности: один пользователь не может получить доступ дважды для одной привязки в одной группе
    __table_args__ = (
        UniqueConstraint('role_feature_mapping_id', 'group_id', 'user_id', name='uq_feature_user_access'),
        Index('ix_feature_user_accesses_role_feature_mapping_id', 'role_feature_mapping_id'),
        Index('ix_feature_user_accesses_group_id', 'group_id'),
        Index('ix_feature_user_accesses_user_id', 'user_id'),
        Index('ix_feature_user_accesses_granted_by_user_id', 'granted_by_user_id'),
    )

    def __repr__(self):
        return f"<FeatureUserAccess(id={self.id}, role_feature_mapping_id={self.role_feature_mapping_id}, group_id={self.group_id}, user_id={self.user_id}, granted_by={self.granted_by_user_id})>"

