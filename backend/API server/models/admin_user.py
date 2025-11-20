from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from models.base import Base
import enum


class AdminRole(str, enum.Enum):
    """Роли администраторов"""
    SUPER_ADMIN = "super_admin"  # Суперадмин приложения
    COMPANY_ADMIN = "company_admin"  # Админ компании


class AdminUser(Base):
    """
    Модель для хранения администраторов админ-панели.
    """
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    
    # Email для входа
    email = Column(String(255), unique=True, nullable=False, index=True)
    
    # Хеш пароля (bcrypt)
    password_hash = Column(String(255), nullable=False)
    
    # Роль администратора
    # Используем String вместо Enum, так как в БД хранятся значения enum ('super_admin', 'company_admin')
    # а не имена констант ('SUPER_ADMIN', 'COMPANY_ADMIN')
    # Конвертация в enum будет происходить через property или в коде
    role = Column(String(50), nullable=False, default=AdminRole.COMPANY_ADMIN.value)
    
    # Связь с компанией (только для COMPANY_ADMIN)
    # Если role = SUPER_ADMIN, то company_bot_id = None
    company_bot_id = Column(Integer, ForeignKey("company_bots.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Имя администратора
    name = Column(String(255), nullable=True)
    
    # Активен ли аккаунт
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Связь с ботом компании
    company_bot = relationship("CompanyBot", backref="admin_users")

    @property
    def role_enum(self) -> AdminRole:
        """Возвращает роль как enum"""
        return AdminRole(self.role)
    
    @role_enum.setter
    def role_enum(self, value: AdminRole):
        """Устанавливает роль из enum"""
        self.role = value.value

    def __repr__(self):
        return f"<AdminUser(id={self.id}, email='{self.email}', role='{self.role}')>"

