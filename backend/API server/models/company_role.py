from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, BigInteger, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class CompanyRole(Base):
    """
    Модель для хранения кастомных ролей компаний.
    Каждая компания может иметь свои уникальные роли (например, "Повар", "Курьер", "Менеджер" и т.д.)
    """
    __tablename__ = "company_roles"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с ботом компании (через group_id бота можно определить компанию)
    # Используем BigInteger для совместимости с Group.group_id
    company_bot_id = Column(Integer, ForeignKey("company_bots.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Название роли (например, "Повар", "Курьер", "Менеджер", "Администратор")
    role_name = Column(String(100), nullable=False)
    
    # Внутренний код роли (например, "chef", "courier", "manager")
    # Используется для программной логики и обратной совместимости
    role_code = Column(String(50), nullable=False, index=True)
    
    # Описание роли
    description = Column(Text, nullable=True)
    
    # Иконка роли (опционально, для UI)
    icon = Column(String(50), nullable=True)
    
    # Цвет роли (опционально, для UI, например "#FF6B35")
    color = Column(String(20), nullable=True)
    
    # Порядок отображения (для сортировки в UI)
    display_order = Column(Integer, default=0, nullable=False)
    
    # Активна ли роль
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Дополнительные настройки роли (JSON)
    # Например: {"can_manage_shifts": true, "can_view_inventory": false}
    permissions = Column(Text, nullable=True)  # JSON в виде текста
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связь с ботом компании
    company_bot = relationship("CompanyBot", backref="roles")
    
    # Ограничения уникальности: одна компания не может иметь две роли с одинаковым role_code
    __table_args__ = (
        Index('ix_company_roles_company_bot_code', 'company_bot_id', 'role_code', unique=True),
        Index('ix_company_roles_company_bot_name', 'company_bot_id', 'role_name'),
    )

    def __repr__(self):
        return f"<CompanyRole(id={self.id}, company_bot_id={self.company_bot_id}, role_name='{self.role_name}', role_code='{self.role_code}')>"

