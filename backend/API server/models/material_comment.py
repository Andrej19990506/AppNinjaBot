from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, BigInteger, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .base import Base

class MaterialComment(Base):
    __tablename__ = "material_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(Integer, nullable=False, index=True, comment="ID обучающего материала")
    user_id = Column(BigInteger, ForeignKey("members.user_id"), nullable=False, index=True)
    message = Column(Text, nullable=False, comment="Текст комментария")
    reply_to = Column(UUID(as_uuid=True), ForeignKey("material_comments.id"), nullable=True, index=True, comment="ID комментария-родителя для ответов")
    edited = Column(Boolean, nullable=False, server_default='false', comment="Был ли комментарий отредактирован")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Связи
    author = relationship("Member", foreign_keys=[user_id], primaryjoin="MaterialComment.user_id == Member.user_id")
    parent_comment = relationship("MaterialComment", remote_side=[id], backref="replies")

    # Индексы для оптимизации
    __table_args__ = (
        Index('ix_material_comments_material_id', 'material_id'),
        Index('ix_material_comments_user_id', 'user_id'),
        Index('ix_material_comments_reply_to', 'reply_to'),
        Index('ix_material_comments_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<MaterialComment(id={self.id}, material_id={self.material_id}, user_id={self.user_id}, message='{self.message[:50]}...')>" 