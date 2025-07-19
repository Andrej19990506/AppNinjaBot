from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_
from typing import List, Optional
from uuid import UUID

from models.material_comment import MaterialComment
from models.member import Member
from schemas.material_comment import MaterialCommentCreate, MaterialCommentUpdate

class CRUDMaterialComment:
    def create(self, db: Session, *, obj_in: MaterialCommentCreate, user_id: int) -> MaterialComment:
        """Создать новый комментарий"""
        db_obj = MaterialComment(
            material_id=obj_in.material_id,
            user_id=user_id,
            message=obj_in.message,
            reply_to=obj_in.reply_to
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_material(self, db: Session, *, material_id: int) -> List[MaterialComment]:
        """Получить все комментарии к материалу"""
        return db.query(MaterialComment).filter(
            MaterialComment.material_id == material_id
        ).options(
            joinedload(MaterialComment.author)
        ).order_by(desc(MaterialComment.created_at)).all()

    def get_by_id(self, db: Session, *, comment_id: UUID) -> Optional[MaterialComment]:
        """Получить комментарий по ID"""
        return db.query(MaterialComment).filter(
            MaterialComment.id == comment_id
        ).options(
            joinedload(MaterialComment.author)
        ).first()

    def update(self, db: Session, *, comment_id: UUID, obj_in: MaterialCommentUpdate, user_id: int) -> Optional[MaterialComment]:
        """Обновить комментарий (только автор может редактировать)"""
        db_obj = db.query(MaterialComment).filter(
            and_(
                MaterialComment.id == comment_id,
                MaterialComment.user_id == user_id  # Только автор
            )
        ).first()
        
        if db_obj:
            db_obj.message = obj_in.message
            db_obj.edited = True
            db.commit()
            db.refresh(db_obj)
        
        return db_obj

    def delete(self, db: Session, *, comment_id: UUID, user_id: int) -> bool:
        """Удалить комментарий (только автор может удалять)"""
        db_obj = db.query(MaterialComment).filter(
            and_(
                MaterialComment.id == comment_id,
                MaterialComment.user_id == user_id  # Только автор
            )
        ).first()
        
        if db_obj:
            # Сначала удаляем все ответы на этот комментарий
            db.query(MaterialComment).filter(
                MaterialComment.reply_to == comment_id
            ).delete()
            
            # Затем удаляем сам комментарий
            db.delete(db_obj)
            db.commit()
            return True
        
        return False

    def get_comments_count(self, db: Session, *, material_id: int) -> int:
        """Получить количество комментариев к материалу"""
        return db.query(MaterialComment).filter(
            MaterialComment.material_id == material_id
        ).count()

material_comment = CRUDMaterialComment() 