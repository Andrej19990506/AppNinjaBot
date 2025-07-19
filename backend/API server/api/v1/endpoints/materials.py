from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import logging

from db.session import get_db
from crud.material_comment import material_comment
from crud.material_reaction import material_reaction
from schemas.material_comment import (
    MaterialCommentCreate,
    MaterialCommentUpdate, 
    MaterialCommentRead,
    MaterialCommentsResponse
)
from schemas.material_reaction import (
    MaterialReactionCreate,
    MaterialReactionsResponse,
    GroupedReaction
)
from models import Member

logger = logging.getLogger(__name__)

# Простая зависимость для получения user_id из заголовка
async def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> int:
    """Получить ID текущего пользователя из заголовка X-User-ID"""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID header is required"
        )
    try:
        return int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )

router = APIRouter()

# ===== КОММЕНТАРИИ =====

@router.get("/materials/{material_id}/comments", response_model=MaterialCommentsResponse)
def get_material_comments(
    material_id: int,
    db: Session = Depends(get_db)
):
    """Получить все комментарии к материалу"""
    comments = material_comment.get_by_material(db=db, material_id=material_id)
    
    # Строим дерево комментариев (родители и ответы)
    comments_dict = {}
    root_comments = []
    
    for comment in comments:
        comments_dict[comment.id] = {
            "comment": comment,
            "replies": []
        }
    
    for comment in comments:
        if comment.reply_to and comment.reply_to in comments_dict:
            comments_dict[comment.reply_to]["replies"].append(comment)
        else:
            root_comments.append(comment)
    
    return MaterialCommentsResponse(
        comments=root_comments,
        total=len(comments)
    )

@router.post("/materials/{material_id}/comments", response_model=MaterialCommentRead)
def create_material_comment(
    material_id: int,
    comment_in: MaterialCommentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Создать новый комментарий к материалу"""
    # Проверяем, что material_id в запросе совпадает с material_id в теле
    if comment_in.material_id != material_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Material ID in path does not match material ID in body"
        )
    
    comment = material_comment.create(
        db=db, 
        obj_in=comment_in, 
        user_id=current_user_id
    )
    
    return comment

@router.put("/comments/{comment_id}", response_model=MaterialCommentRead)
def update_material_comment(
    comment_id: UUID,
    comment_update: MaterialCommentUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Обновить комментарий (только автор)"""
    comment = material_comment.update(
        db=db,
        comment_id=comment_id,
        obj_in=comment_update,
        user_id=current_user_id
    )
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found or you don't have permission to edit it"
        )
    
    return comment

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material_comment(
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Удалить комментарий (только автор)"""
    success = material_comment.delete(
        db=db,
        comment_id=comment_id,
        user_id=current_user_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found or you don't have permission to delete it"
        )

# ===== РЕАКЦИИ =====

@router.get("/materials/{material_id}/reactions", response_model=MaterialReactionsResponse)
def get_material_reactions(
    material_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Получить все реакции к материалу"""
    grouped_reactions = material_reaction.get_grouped_reactions(db=db, material_id=material_id)
    user_reaction_obj = material_reaction.get_user_reaction(
        db=db, 
        material_id=material_id, 
        user_id=current_user_id
    )
    
    # Преобразуем в схемы
    reactions = [
        GroupedReaction(
            emoji=reaction["emoji"],
            count=reaction["count"],
            users=reaction["users"]
        )
        for reaction in grouped_reactions
    ]
    
    return MaterialReactionsResponse(
        reactions=reactions,
        user_reaction=user_reaction_obj.emoji if user_reaction_obj else None,
        total=sum(r.count for r in reactions)
    )

@router.post("/materials/{material_id}/reactions")
def toggle_material_reaction(
    material_id: int,
    reaction_in: MaterialReactionCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Поставить/убрать реакцию (toggle)"""
    # Проверяем, что material_id в запросе совпадает с material_id в теле
    if reaction_in.material_id != material_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Material ID in path does not match material ID in body"
        )
    
    result = material_reaction.create_or_update(
        db=db,
        obj_in=reaction_in,
        user_id=current_user_id
    )
    
    if result is None:
        return {"message": "Reaction removed"}
    else:
        return {"message": "Reaction added/updated", "reaction": result.emoji}

@router.delete("/materials/{material_id}/reactions", status_code=status.HTTP_204_NO_CONTENT)
def remove_material_reaction(
    material_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """Убрать реакцию пользователя"""
    success = material_reaction.delete(
        db=db,
        material_id=material_id,
        user_id=current_user_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reaction found"
        ) 