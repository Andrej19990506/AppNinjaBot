from sqlalchemy.orm import Session, selectinload
from sqlalchemy.future import select
from datetime import date
from uuid import UUID

from models.reserve import Reserve
from models.member import Member
from models.group import Group
from schemas.reserve import ReserveCreate
from sqlalchemy import and_

async def get_reserve_by_user_and_date(
    db: Session,
    *, 
    user_id: int,
    group_id: int,
    reserve_date: date
) -> Reserve | None:
    """Получает запись резерва для пользователя на конкретную дату в конкретной группе."""
    result = await db.execute(
        select(Reserve)
        .where(
            Reserve.member_id == user_id,
            Reserve.group_id == group_id, 
            Reserve.date == reserve_date
        )
    )
    return result.scalars().first()

async def check_existing_reserve(
    db: Session, 
    *, 
    user_telegram_id: int,
    group_telegram_id: int,
    reserve_date: date
) -> Reserve | None:
    """Проверяет, существует ли уже запись в резерве для указанного пользователя, группы и даты."""
    # Находим пользователя по telegram_id
    user_result = await db.execute(select(Member).where(Member.user_id == user_telegram_id))
    db_user = user_result.scalars().first()

    if not db_user:
        # Если пользователь не найден, резерва быть не может
        return None
        
    # Находим группу по telegram_id
    group_result = await db.execute(select(Group).where(Group.group_id == group_telegram_id))
    db_group = group_result.scalars().first()
    
    if not db_group:
        # Если группа не найдена, резерва быть не может
        return None

    # Проверяем наличие резерва
    result = await db.execute(
        select(Reserve)
        .where(
            Reserve.member_id == db_user.id,
            Reserve.group_id == db_group.id, 
            Reserve.date == reserve_date
        )
    )
    return result.scalars().first()

async def create_reserve(db: Session, *, reserve_in: ReserveCreate) -> Reserve | None:
    """Создает новую запись в резерве."""
    # Находим пользователя по telegram_id
    user_result = await db.execute(select(Member).where(Member.user_id == reserve_in.user_telegram_id))
    db_user = user_result.scalars().first()

    if not db_user:
        # Если пользователь не найден, резерв создать не можем
        return None
        
    # Находим группу по telegram_id
    group_result = await db.execute(select(Group).where(Group.group_id == reserve_in.group_telegram_id))
    db_group = group_result.scalars().first()
    
    if not db_group:
        # Если группа не найдена, резерв создать не можем
        return None

    # Убираем проверку на существующий резерв, так как она теперь выполняется на уровне routers
    # Эта проверка теперь в check_existing_reserve

    db_reserve = Reserve(
        member_id=db_user.id,
        group_id=db_group.id,
        date=reserve_in.reserve_date
    )
    db.add(db_reserve)
    await db.commit()
    await db.refresh(db_reserve)
    # Загружаем связанного пользователя и группу
    await db.refresh(db_reserve, attribute_names=['member', 'group'])
    # Дополнительно обновим member и group, чтобы все их поля были загружены
    await db.refresh(db_reserve.member)
    await db.refresh(db_reserve.group)
    return db_reserve

async def get_reserves_by_group_and_date(
    db: Session,
    *, 
    group_telegram_id: int,
    reserve_date: date
) -> list[Reserve]:
    """Получает список всех резервов для группы на указанную дату."""
    print(f"DEBUG: [get_reserves_by_group_and_date] group_telegram_id={group_telegram_id}, date={reserve_date}, type(date)={type(reserve_date)}")
    
    # Найти внутренний ID группы по Telegram ID
    group_result = await db.execute(select(Group.id).where(Group.group_id == group_telegram_id))
    group_id = group_result.scalar_one_or_none()
    
    print(f"DEBUG: [get_reserves_by_group_and_date] Внутренний group_id={group_id}")
    
    if group_id is None:
        # Если группа не найдена, возвращаем пустой список
        print(f"DEBUG: [get_reserves_by_group_and_date] Группа не найдена, возвращаем []")
        return []
    
    print(f"DEBUG: [get_reserves_by_group_and_date] Выполняем запрос резервов с параметрами: group_id={group_id}, date={reserve_date}")
    result = await db.execute(
        select(Reserve)
        .where(
            Reserve.group_id == group_id,
            Reserve.date == reserve_date
        )
        .options(
            selectinload(Reserve.member),   # Загружаем связанных пользователей 
            selectinload(Reserve.group)     # Загружаем связанную группу
        )
        .order_by(Reserve.created_at) # Сортируем по времени создания
    )
    reserves = result.scalars().all()
    print(f"DEBUG: [get_reserves_by_group_and_date] Найдено резервов: {len(reserves)}")
    return reserves

async def get_reserve(db: Session, *, reserve_id: UUID) -> Reserve | None:
    """Получает резерв по его ID."""
    result = await db.execute(
        select(Reserve)
        .where(Reserve.id == reserve_id)
        .options(
            selectinload(Reserve.member),   # Загружаем связанного пользователя
            selectinload(Reserve.group)     # Загружаем связанную группу
        )
    )
    return result.scalars().first()

async def delete_reserve(db: Session, *, reserve_id: UUID) -> Reserve | None:
    """Удаляет резерв по его ID."""
    db_reserve = await get_reserve(db, reserve_id=reserve_id)
    if db_reserve:
        await db.delete(db_reserve)
        await db.commit()
    return db_reserve 