from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime, Index, Boolean, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class RoleFeatureMapping(Base):
    """
    Модель для связи ролей компании с функционалом бота.
    Определяет, какие функции доступны для какой роли.
    """
    __tablename__ = "role_feature_mappings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с ролью компании
    company_role_id = Column(Integer, ForeignKey("company_roles.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Связь с функцией бота
    bot_feature_id = Column(Integer, ForeignKey("bot_features.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Включен ли функционал для роли
    is_enabled = Column(Boolean, default=True, nullable=False)
    
    # Тип доступа: 'open' - открыт для всех участников группы, 'restricted' - только для уполномоченных (админы/создатели)
    access_type = Column(String(20), default='open', nullable=False, server_default='open')
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    company_role = relationship("CompanyRole", backref="feature_mappings")
    bot_feature = relationship("BotFeature", back_populates="role_mappings")
    
    # Ограничение уникальности: одна роль не может иметь дублирующуюся связь с функцией
    __table_args__ = (
        UniqueConstraint('company_role_id', 'bot_feature_id', name='uq_role_feature_mapping'),
        Index('ix_role_feature_mappings_company_role_id', 'company_role_id'),
        Index('ix_role_feature_mappings_bot_feature_id', 'bot_feature_id'),
    )

    def __repr__(self):
        return f"<RoleFeatureMapping(id={self.id}, company_role_id={self.company_role_id}, bot_feature_id={self.bot_feature_id}, is_enabled={self.is_enabled})>"

