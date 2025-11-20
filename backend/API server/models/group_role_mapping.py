from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime, Index, BigInteger, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class GroupRoleMapping(Base):
    """
    Модель для связи групп с ролями компании.
    Определяет, какая роль компании соответствует какой группе.
    Это позволяет группе иметь определенную роль в контексте компании.
    
    is_working_group:
    - true: группа работает с ботом (функционал активен, бот обрабатывает команды)
    - false: группа только для уведомлений (получает файлы/сообщения, но бот не работает)
    """
    __tablename__ = "group_role_mappings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с группой (через Telegram group_id)
    group_id = Column(BigInteger, ForeignKey("groups.group_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Связь с ролью компании
    company_role_id = Column(Integer, ForeignKey("company_roles.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Рабочая группа или только для уведомлений
    # true: группа работает с ботом (функционал активен)
    # false: группа только для уведомлений (получает файлы, но бот не работает)
    is_working_group = Column(Boolean, default=True, nullable=False, index=True)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    group = relationship("Group", backref="role_mappings")
    company_role = relationship("CompanyRole", backref="group_mappings")
    
    # Ограничение уникальности: одна группа может иметь только одну роль компании
    # (но можно расширить в будущем, если понадобится несколько ролей на группу)
    __table_args__ = (
        UniqueConstraint('group_id', 'company_role_id', name='uq_group_role_mapping'),
        Index('ix_group_role_mappings_group_id', 'group_id'),
        Index('ix_group_role_mappings_company_role_id', 'company_role_id'),
        Index('ix_group_role_mappings_is_working_group', 'is_working_group'),
    )

    def __repr__(self):
        return f"<GroupRoleMapping(id={self.id}, group_id={self.group_id}, company_role_id={self.company_role_id}, is_working_group={self.is_working_group})>"

