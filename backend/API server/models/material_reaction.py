from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .base import Base

class MaterialReaction(Base):
    __tablename__ = "material_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(Integer, nullable=False, comment="ID обучающего материала")
    user_id = Column(BigInteger, ForeignKey("members.user_id"), nullable=False)
    emoji = Column(String(10), nullable=False, comment="Эмодзи реакции (❤️, 👍, 🔥, etc.)")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Связь с пользователем
    author = relationship("Member", foreign_keys=[user_id], primaryjoin="MaterialReaction.user_id == Member.user_id")

    # Ограничения и индексы
    __table_args__ = (
        # Один пользователь может поставить только одну реакцию на материал
        UniqueConstraint('material_id', 'user_id', name='uq_material_reaction_user'),
        Index('ix_material_reactions_material_id', 'material_id'),
        Index('ix_material_reactions_user_id', 'user_id'),
        Index('ix_material_reactions_emoji', 'emoji'),
        Index('ix_material_reactions_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<MaterialReaction(id={self.id}, material_id={self.material_id}, user_id={self.user_id}, emoji='{self.emoji}')>" 