from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime, Index, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class FeatureAccessDelegate(Base):
    """
    Модель для хранения делегатов, которые могут раздавать доступ к функционалу.
    Когда access_type = 'restricted', админы могут назначить делегатов,
    которые затем смогут раздавать доступ к функционалу другим пользователям в приложении.
    """
    __tablename__ = "feature_access_delegates"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с привязкой роли и функционала
    role_feature_mapping_id = Column(Integer, ForeignKey("role_feature_mappings.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Группа, в которой делегат может раздавать доступ
    group_id = Column(BigInteger, ForeignKey("groups.group_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Пользователь-делегат (Telegram user_id из Member)
    delegate_user_id = Column(BigInteger, nullable=False, index=True)
    
    # Кто назначил делегата (для аудита, Telegram user_id)
    created_by_user_id = Column(BigInteger, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    role_feature_mapping = relationship("RoleFeatureMapping", backref="delegates")
    group = relationship("Group", backref="feature_delegates")
    
    # Ограничение уникальности: один делегат не может быть назначен дважды для одной привязки в одной группе
    __table_args__ = (
        UniqueConstraint('role_feature_mapping_id', 'group_id', 'delegate_user_id', name='uq_feature_access_delegate'),
        Index('ix_feature_access_delegates_role_feature_mapping_id', 'role_feature_mapping_id'),
        Index('ix_feature_access_delegates_group_id', 'group_id'),
        Index('ix_feature_access_delegates_delegate_user_id', 'delegate_user_id'),
    )

    def __repr__(self):
        return f"<FeatureAccessDelegate(id={self.id}, role_feature_mapping_id={self.role_feature_mapping_id}, group_id={self.group_id}, delegate_user_id={self.delegate_user_id})>"

