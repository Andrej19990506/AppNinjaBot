from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, DateTime, Index, BigInteger, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class GroupFeatureNotification(Base):
    """
    Модель для настройки уведомлений для функций бота.
    Определяет, в какие группы отправлять уведомления при выполнении определенной функции.
    
    Пример: При инвентаризации в группе "Продавцы Банк Бир" (working_group),
    Excel файл должен отправляться также в группу "Начальство Банк Бир" (notification_group).
    """
    __tablename__ = "group_feature_notifications"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с функцией бота
    bot_feature_id = Column(Integer, ForeignKey("bot_features.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Рабочая группа (где работает функция)
    working_group_id = Column(BigInteger, ForeignKey("groups.group_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Группа для уведомлений (куда отправлять файлы/сообщения)
    notification_group_id = Column(BigInteger, ForeignKey("groups.group_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Тип уведомления (например, "excel", "message", "file")
    notification_type = Column(String(50), nullable=True, default="excel")
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Связи
    bot_feature = relationship("BotFeature", back_populates="notifications")
    working_group = relationship("Group", foreign_keys=[working_group_id], backref="working_notifications")
    notification_group = relationship("Group", foreign_keys=[notification_group_id], backref="notification_targets")
    
    # Ограничение уникальности: одна комбинация (функция + рабочая группа + уведомительная группа) должна быть уникальной
    __table_args__ = (
        UniqueConstraint('bot_feature_id', 'working_group_id', 'notification_group_id', name='uq_group_feature_notification'),
        Index('ix_group_feature_notifications_bot_feature_id', 'bot_feature_id'),
        Index('ix_group_feature_notifications_working_group_id', 'working_group_id'),
        Index('ix_group_feature_notifications_notification_group_id', 'notification_group_id'),
    )

    def __repr__(self):
        return f"<GroupFeatureNotification(id={self.id}, bot_feature_id={self.bot_feature_id}, working_group_id={self.working_group_id}, notification_group_id={self.notification_group_id})>"

