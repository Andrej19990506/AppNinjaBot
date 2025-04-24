from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, BigInteger, DateTime, JSON, UniqueConstraint, text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Mapped
from .base import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .group_member import GroupMember
    from .shift import Shift
    from .reserve import Reserve

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True) # Был SERIAL
    group_id = Column(BigInteger, unique=True, index=True, nullable=False) # Был BIGINT, это Telegram ID группы
    title = Column(String(255), nullable=False)
    group_type = Column(String(50), nullable=False) # <<< ДОБАВЛЕНО: Тип группы (courier, chef, general)
    username = Column(String(255), nullable=True) # Имя пользователя группы (если есть)
    description = Column(Text, nullable=True) # Был TEXT
    members_count = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    # Атрибут модели - json_metadata, столбец в БД - metadata
    json_metadata: Mapped[Optional[dict]] = Column("metadata", JSON, nullable=True) # <-- ИЗМЕНЕНО

    # <<< ДОБАВЛЕНО НОВОЕ ПОЛЕ >>>
    slot_config = Column(JSON, nullable=False, server_default=text("'{}'::jsonb")) # Для PostgreSQL

    # <<< ДОБАВЛЯЕМ ПОЛЕ ДЛЯ НАСТРОЕК ДОСТУПА >>>
    access_settings = Column(JSON, nullable=True, comment='Isolated storage for shift access settings')

    # <<< ДОБАВЛЯЕМ ПОЛЕ ДЛЯ ДАННЫХ ИНВЕНТАРЯ >>>
    json_inventory = Column(JSON, nullable=True, comment='Stores the actual inventory data as JSON')

    # <<< ДОБАВЛЕНО: Поле для дополнительных кастомных товаров группы >>>
    json_inventory_additions = Column(JSON, nullable=True, comment='Stores group-specific item additions/definitions')

    # Связь с ассоциативной таблицей group_members
    members: Mapped[List["GroupMember"]] = relationship(back_populates="group", cascade="all, delete-orphan")

    # Связь со сменами (одна группа - много смен)
    shifts: Mapped[List["Shift"]] = relationship(back_populates="group", cascade="all, delete-orphan")
    
    # Связь с резервами (одна группа - много резервов)
    reserves: Mapped[List["Reserve"]] = relationship(back_populates="group", cascade="all, delete-orphan")

    # Ограничение уникальности для group_id (хотя уже есть unique=True)
    __table_args__ = (
        UniqueConstraint('group_id', name='uq_group_group_id'),
        Index('ix_group_type', 'group_type'), # Индекс для фильтрации по типу
    )

    def __repr__(self):
        return f"<Group(id={self.id}, group_id={self.group_id}, title='{self.title}', type='{self.group_type}')>" 