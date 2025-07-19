from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import List, Optional, Dict, Any
from uuid import UUID

from models.material_reaction import MaterialReaction
from models.member import Member
from schemas.material_reaction import MaterialReactionCreate

class CRUDMaterialReaction:
    def create_or_update(self, db: Session, *, obj_in: MaterialReactionCreate, user_id: int) -> MaterialReaction:
        """Создать новую реакцию или обновить существующую"""
        # Проверяем, есть ли уже реакция от этого пользователя к материалу
        existing = db.query(MaterialReaction).filter(
            and_(
                MaterialReaction.material_id == obj_in.material_id,
                MaterialReaction.user_id == user_id
            )
        ).first()
        
        if existing:
            # Если та же реакция - удаляем (toggle)
            if existing.emoji == obj_in.emoji:
                db.delete(existing)
                db.commit()
                return None
            else:
                # Иначе обновляем эмодзи
                existing.emoji = obj_in.emoji
                db.commit()
                db.refresh(existing)
                return existing
        else:
            # Создаем новую реакцию
            db_obj = MaterialReaction(
                material_id=obj_in.material_id,
                user_id=user_id,
                emoji=obj_in.emoji
            )
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            return db_obj

    def get_by_material(self, db: Session, *, material_id: int) -> List[MaterialReaction]:
        """Получить все реакции к материалу"""
        return db.query(MaterialReaction).filter(
            MaterialReaction.material_id == material_id
        ).options(
            joinedload(MaterialReaction.author)
        ).all()

    def get_user_reaction(self, db: Session, *, material_id: int, user_id: int) -> Optional[MaterialReaction]:
        """Получить реакцию пользователя к материалу"""
        return db.query(MaterialReaction).filter(
            and_(
                MaterialReaction.material_id == material_id,
                MaterialReaction.user_id == user_id
            )
        ).first()

    def get_grouped_reactions(self, db: Session, *, material_id: int) -> List[Dict[str, Any]]:
        """Получить сгруппированные по эмодзи реакции"""
        results = db.query(
            MaterialReaction.emoji,
            func.count(MaterialReaction.id).label('count'),
            func.array_agg(MaterialReaction.user_id).label('user_ids')
        ).filter(
            MaterialReaction.material_id == material_id
        ).group_by(MaterialReaction.emoji).all()
        
        grouped = []
        for result in results:
            # Получаем информацию о пользователях
            users = db.query(Member).filter(
                Member.user_id.in_(result.user_ids)
            ).all()
            
            grouped.append({
                'emoji': result.emoji,
                'count': result.count,
                'users': [
                    {
                        'user_id': user.user_id,
                        'first_name': user.first_name,
                        'username': user.username,
                        'photo_url': user.photo_url
                    }
                    for user in users
                ]
            })
        
        return grouped

    def delete(self, db: Session, *, material_id: int, user_id: int) -> bool:
        """Удалить реакцию пользователя"""
        db_obj = db.query(MaterialReaction).filter(
            and_(
                MaterialReaction.material_id == material_id,
                MaterialReaction.user_id == user_id
            )
        ).first()
        
        if db_obj:
            db.delete(db_obj)
            db.commit()
            return True
        
        return False

    def get_reactions_count(self, db: Session, *, material_id: int) -> int:
        """Получить количество реакций к материалу"""
        return db.query(MaterialReaction).filter(
            MaterialReaction.material_id == material_id
        ).count()

material_reaction = CRUDMaterialReaction() 