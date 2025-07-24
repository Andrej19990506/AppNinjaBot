# backend/API server/crud/competition.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import List, Optional, Dict, Any
from datetime import datetime

from models.competition import Competition, CompetitionParticipant, CompetitionWinner, CompetitionStatus
from models import Member, Group, GroupMember
from schemas.competition import CompetitionCreate, CompetitionUpdate, ParticipantCreate, WinnerCreate

class CompetitionCRUD:
    
    # --- Основные CRUD операции для конкурсов ---
    
    def create(self, db: Session, competition_data: CompetitionCreate, created_by: int) -> Competition:
        """Создать новый конкурс"""
        db_competition = Competition(
            **competition_data.dict(),
            created_by=created_by,
            status=CompetitionStatus.DRAFT
        )
        db.add(db_competition)
        db.commit()
        db.refresh(db_competition)
        return db_competition
    
    def get(self, db: Session, competition_id: int) -> Optional[Competition]:
        """Получить конкурс по ID"""
        return db.query(Competition).filter(Competition.id == competition_id).first()
    
    def get_with_relations(self, db: Session, competition_id: int) -> Optional[Competition]:
        """Получить конкурс с участниками и победителями"""
        return db.query(Competition).options(
            joinedload(Competition.participants),
            joinedload(Competition.winners)
        ).filter(Competition.id == competition_id).first()
    
    def get_multi(
        self, 
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[CompetitionStatus] = None,
        created_by: Optional[int] = None,
        target_groups: Optional[List[str]] = None,
        search: Optional[str] = None
    ) -> List[Competition]:
        """Получить список конкурсов с фильтрацией"""
        query = db.query(Competition).options(joinedload(Competition.winners))
        
        if status:
            query = query.filter(Competition.status == status)
        
        if created_by:
            query = query.filter(Competition.created_by == created_by)
        
        if target_groups:
            # Фильтр по целевым группам (JSON содержит массив)
            for group in target_groups:
                query = query.filter(Competition.target_groups.contains([group]))
        
        if search:
            search_filter = or_(
                Competition.title.ilike(f"%{search}%"),
                Competition.description.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        
        return query.offset(skip).limit(limit).all()
    
    def update(self, db: Session, competition_id: int, competition_data: CompetitionUpdate) -> Optional[Competition]:
        """Обновить конкурс"""
        db_competition = self.get(db, competition_id)
        if not db_competition:
            return None
        
        update_data = competition_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_competition, field, value)
        
        db_competition.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_competition)
        return db_competition
    
    def delete(self, db: Session, competition_id: int) -> bool:
        """Удалить конкурс"""
        db_competition = self.get(db, competition_id)
        if not db_competition:
            return False
        
        db.delete(db_competition)
        db.commit()
        return True
    
    def publish(self, db: Session, competition_id: int) -> Optional[Competition]:
        """Опубликовать конкурс (изменить статус на ANNOUNCEMENT)"""
        db_competition = self.get(db, competition_id)
        if not db_competition:
            return None
        
        db_competition.status = CompetitionStatus.ANNOUNCEMENT
        db_competition.published_at = datetime.utcnow()
        db_competition.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_competition)
        return db_competition
    
    def start(self, db: Session, competition_id: int) -> Optional[Competition]:
        """Запустить конкурс (изменить статус на ACTIVE)"""
        db_competition = self.get(db, competition_id)
        if not db_competition:
            return None
        
        db_competition.status = CompetitionStatus.ACTIVE
        db_competition.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_competition)
        return db_competition
    
    def complete(self, db: Session, competition_id: int) -> Optional[Competition]:
        """Завершить конкурс (изменить статус на COMPLETED)"""
        db_competition = self.get(db, competition_id)
        if not db_competition:
            return None
        
        db_competition.status = CompetitionStatus.COMPLETED
        db_competition.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_competition)
        return db_competition
    
    # --- Операции с участниками ---
    
    def add_participant(self, db: Session, competition_id: int, participant_data: ParticipantCreate) -> Optional[CompetitionParticipant]:
        """Добавить участника в конкурс"""
        print(f"add_participant: competition_id={competition_id}, user_id={participant_data.user_id}")
        
        # Проверяем, что конкурс существует и активен
        competition = self.get(db, competition_id)
        if not competition:
            print(f"add_participant: Competition {competition_id} not found")
            return None
        if competition.status not in [CompetitionStatus.ANNOUNCEMENT, CompetitionStatus.ACTIVE]:
            print(f"add_participant: Competition {competition_id} status {competition.status} not allowed")
            return None
        
        print(f"add_participant: Competition found, status={competition.status}")
        
        # Проверяем, не зарегистрирован ли уже пользователь
        existing_participant = db.query(CompetitionParticipant).filter(
            and_(
                CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id == participant_data.user_id
            )
        ).first()
        
        if existing_participant:
            print(f"add_participant: User {participant_data.user_id} already registered")
            return None
        
        print(f"add_participant: User not already registered")
        
        # Проверяем лимит участников
        if competition.max_participants and competition.current_participants >= competition.max_participants:
            print(f"add_participant: Participant limit reached ({competition.current_participants}/{competition.max_participants})")
            return None
        
        print(f"add_participant: Participant limit OK ({competition.current_participants}/{competition.max_participants})")
        
        # Получаем данные пользователя из базы данных
        user = db.query(Member).filter(Member.user_id == participant_data.user_id).first()
        
        # Получаем информацию о группе пользователя
        user_group = None
        if user:
            group_member = db.query(GroupMember).filter(GroupMember.member_id == user.id).first()
            if group_member:
                user_group = db.query(Group).filter(Group.id == group_member.group_id).first()
        
        # Создаем участника с данными пользователя
        participant_dict = participant_data.dict()
        if user:
            participant_dict.update({
                'user_name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or f"Пользователь {user.user_id}",
                'user_position': 'Участник',
                'user_department': user_group.title if user_group else 'Не указан'
            })
            print(f"add_participant: User data found - {participant_dict['user_name']} from {participant_dict['user_department']}")
        else:
            print(f"add_participant: User {participant_data.user_id} not found in members table")
        
        db_participant = CompetitionParticipant(
            competition_id=competition_id,
            **participant_dict
        )
        db.add(db_participant)
        
        # Увеличиваем счетчик участников
        competition.current_participants += 1
        
        db.commit()
        db.refresh(db_participant)
        print(f"add_participant: Successfully added participant")
        return db_participant
    
    def get_participants(self, db: Session, competition_id: int) -> List[CompetitionParticipant]:
        """Получить список участников конкурса"""
        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == competition_id
        ).all()
        
        # Обновляем данные участников, если они не заполнены
        for participant in participants:
            if not participant.user_name or not participant.user_position:
                user = db.query(Member).filter(Member.user_id == participant.user_id).first()
                if user:
                    # Получаем информацию о группе пользователя
                    user_group = None
                    group_member = db.query(GroupMember).filter(GroupMember.member_id == user.id).first()
                    if group_member:
                        user_group = db.query(Group).filter(Group.id == group_member.group_id).first()
                    
                    participant.user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or f"Пользователь {user.user_id}"
                    participant.user_position = 'Участник'
                    participant.user_department = user_group.title if user_group else 'Не указан'
                    print(f"get_participants: Updated participant {participant.user_id} - {participant.user_name} from {participant.user_department}")
        
        db.commit()
        return participants
    
    def remove_participant(self, db: Session, competition_id: int, user_id: int) -> bool:
        """Удалить участника из конкурса"""
        participant = db.query(CompetitionParticipant).filter(
            and_(
                CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id == user_id
            )
        ).first()
        
        if not participant:
            return False
        
        # Уменьшаем счетчик участников
        competition = self.get(db, competition_id)
        if competition:
            competition.current_participants = max(0, competition.current_participants - 1)
        
        db.delete(participant)
        db.commit()
        return True
    
    def update_participant_result(self, db: Session, competition_id: int, participant_id: int, result_score: Optional[int] = None, result_time: Optional[int] = None, video_url: Optional[str] = None) -> Optional[CompetitionParticipant]:
        """Обновить результат участника и пересчитать рейтинг"""
        participant = db.query(CompetitionParticipant).filter_by(id=participant_id, competition_id=competition_id).first()
        if not participant:
            return None
        if result_score is not None:
            participant.result_score = result_score
        if result_time is not None:
            participant.result_time = result_time
        if video_url is not None:
            participant.video_url = video_url
        db.commit()

        # Пересчет рейтинга
        participants = db.query(CompetitionParticipant).filter_by(competition_id=competition_id).all()
        participants_sorted = sorted(
            participants,
            key=lambda p: (-(p.result_score or 0), p.registered_at)
        )
        for idx, p in enumerate(participants_sorted, start=1):
            p.ranking_position = idx
        db.commit()
        return participant
    
    # --- Операции с победителями ---
    
    def add_winner(self, db: Session, competition_id: int, winner_data: WinnerCreate) -> Optional[CompetitionWinner]:
        """Добавить победителя конкурса"""
        # Проверяем, что конкурс завершен
        competition = self.get(db, competition_id)
        if not competition or competition.status != CompetitionStatus.COMPLETED:
            return None
        
        # Проверяем, не добавлен ли уже этот победитель (пользователь или группа)
        existing_winner = None
        if winner_data.user_id:
            existing_winner = db.query(CompetitionWinner).filter(
                and_(
                    CompetitionWinner.competition_id == competition_id,
                    CompetitionWinner.user_id == winner_data.user_id
                )
            ).first()
        elif winner_data.group_id:
            existing_winner = db.query(CompetitionWinner).filter(
                and_(
                    CompetitionWinner.competition_id == competition_id,
                    CompetitionWinner.group_id == winner_data.group_id
                )
            ).first()
        
        if existing_winner:
            return None
        
        # Создаем победителя
        winner_dict = winner_data.dict()
        
        try:
            db_winner = CompetitionWinner(
                competition_id=competition_id,
                **winner_dict
            )
            db.add(db_winner)
            db.commit()
            db.refresh(db_winner)
            return db_winner
        except Exception as e:
            db.rollback()
            return None
    
    def get_winners(self, db: Session, competition_id: int) -> List[CompetitionWinner]:
        """Получить список победителей конкурса"""
        return db.query(CompetitionWinner).filter(
            CompetitionWinner.competition_id == competition_id
        ).order_by(CompetitionWinner.place).all()
    
    def remove_winner(self, db: Session, competition_id: int, user_id: Optional[int] = None, group_id: Optional[int] = None) -> bool:
        """Удалить победителя из конкурса"""
        if not user_id and not group_id:
            return False
            
        winner = None
        if user_id:
            winner = db.query(CompetitionWinner).filter(
                and_(
                    CompetitionWinner.competition_id == competition_id,
                    CompetitionWinner.user_id == user_id
                )
            ).first()
        elif group_id:
            winner = db.query(CompetitionWinner).filter(
                and_(
                    CompetitionWinner.competition_id == competition_id,
                    CompetitionWinner.group_id == group_id
                )
            ).first()
        
        if not winner:
            return False
        
        db.delete(winner)
        db.commit()
        return True
    
    # --- Статистика ---
    
    def get_stats(self, db: Session) -> Dict[str, int]:
        """Получить статистику по конкурсам"""
        total_competitions = db.query(func.count(Competition.id)).scalar()
        active_competitions = db.query(func.count(Competition.id)).filter(
            Competition.status == CompetitionStatus.ACTIVE
        ).scalar()
        completed_competitions = db.query(func.count(Competition.id)).filter(
            Competition.status == CompetitionStatus.COMPLETED
        ).scalar()
        total_participants = db.query(func.count(CompetitionParticipant.id)).scalar()
        total_winners = db.query(func.count(CompetitionWinner.id)).scalar()
        
        return {
            "total_competitions": total_competitions,
            "active_competitions": active_competitions,
            "completed_competitions": completed_competitions,
            "total_participants": total_participants,
            "total_winners": total_winners
        }

# Создаем экземпляр для использования
competition_crud = CompetitionCRUD() 