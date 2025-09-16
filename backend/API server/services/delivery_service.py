# backend/API server/services/delivery_service.py
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc

from models.delivery import Delivery, DeliveryItem
from schemas.delivery import (
    DeliveryCreate, DeliveryUpdate, DeliveryRead, DeliveryItemRead,
    DeliveryStats, DeliveryFilters, DeliveryAcceptRequest
)

class DeliveryService:
    """Сервис для работы с поставками"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_delivery(self, delivery_data: DeliveryCreate) -> Delivery:
        """Создание новой поставки"""
        from loguru import logger
        
        logger.info(f"🚀 [DeliveryService.create_delivery] Создание новой поставки:")
        logger.info(f"📦 [CREATE] Supplier: {delivery_data.supplier}")
        logger.info(f"🏪 [CREATE] Branch: {delivery_data.branch}")
        logger.info(f"📅 [CREATE] Date: {delivery_data.delivery_date}")
        logger.info(f"👤 [CREATE] AcceptedBy: {delivery_data.accepted_by.name} ({delivery_data.accepted_by.initials})")
        logger.info(f"📋 [CREATE] Items count: {len(delivery_data.items)}")
        
        # Создаем поставку
        delivery = Delivery(
            supplier=delivery_data.supplier,
            branch=delivery_data.branch,
            delivery_date=delivery_data.delivery_date,
            accepted_by_name=delivery_data.accepted_by.name,
            accepted_by_initials=delivery_data.accepted_by.initials,
            accepted_by_user_id=delivery_data.accepted_by.user_id,
            accepted_by_telegram_id=delivery_data.accepted_by.telegram_id,
            notes=delivery_data.notes,
            status="accepted"
        )
        
        logger.info(f"💾 [CREATE] Добавляем поставку в БД...")
        self.db.add(delivery)
        self.db.flush()  # Получаем ID поставки
        
        logger.info(f"✅ [CREATE] Поставка создана с ID: {delivery.id}")
        
        # Создаем товары
        total_cost = 0.0
        checked_count = 0
        
        logger.info(f"📦 [CREATE] Обрабатываем товары...")
        for i, item_data in enumerate(delivery_data.items):
            item_total = (item_data.price or 0) * (item_data.quantity or 0)
            total_cost += item_total
            
            if item_data.is_checked:
                checked_count += 1
            
            delivery_item = DeliveryItem(
                delivery_id=delivery.id,
                name=item_data.name,
                category=item_data.category,
                unit=item_data.unit,
                quantity=item_data.quantity,
                price=item_data.price,
                item_total=item_total,
                is_checked=item_data.is_checked,
                notes=item_data.notes
            )
            self.db.add(delivery_item)
            
            logger.info(f"📋 [CREATE ITEM {i+1}] {item_data.name} - ✅:{item_data.is_checked}")
        
        # Обновляем счетчики в поставке
        delivery.total_items = len(delivery_data.items)
        delivery.checked_items = checked_count
        delivery.total_cost = total_cost
        
        logger.info(f"🔢 [CREATE] Финальные счетчики:")
        logger.info(f"   Total items: {delivery.total_items}")
        logger.info(f"   Checked items: {delivery.checked_items}")
        logger.info(f"   Total cost: {delivery.total_cost}")
        
        logger.info(f"💾 [CREATE] Сохраняем в БД...")
        self.db.commit()
        self.db.refresh(delivery)
        
        logger.info(f"🎉 [CREATE] Поставка успешно создана с ID: {delivery.id}")
        
        return delivery
    
    def get_delivery(self, delivery_id: int) -> Optional[Delivery]:
        """Получение поставки по ID"""
        return self.db.query(Delivery).filter(Delivery.id == delivery_id).first()
    
    def get_deliveries(
        self, 
        filters: Optional[DeliveryFilters] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Delivery], int]:
        """Получение списка поставок с фильтрами"""
        query = self.db.query(Delivery)
        
        if filters:
            if filters.supplier:
                query = query.filter(Delivery.supplier.ilike(f"%{filters.supplier}%"))
            
            if filters.branch:
                query = query.filter(Delivery.branch.ilike(f"%{filters.branch}%"))
            
            if filters.status:
                query = query.filter(Delivery.status == filters.status)
            
            if filters.date_from:
                query = query.filter(Delivery.delivery_date >= filters.date_from)
            
            if filters.date_to:
                query = query.filter(Delivery.delivery_date <= filters.date_to)
            
            if filters.accepted_by:
                query = query.filter(
                    or_(
                        Delivery.accepted_by_name.ilike(f"%{filters.accepted_by}%"),
                        Delivery.accepted_by_initials.ilike(f"%{filters.accepted_by}%")
                    )
                )
        
        # Подсчет общего количества
        total = query.count()
        
        # Получение записей с пагинацией
        deliveries = query.order_by(desc(Delivery.accepted_at)).offset(skip).limit(limit).all()
        
        return deliveries, total
    
    def update_delivery(self, delivery_id: int, update_data: DeliveryUpdate) -> Optional[Delivery]:
        """Обновление поставки"""
        delivery = self.get_delivery(delivery_id)
        if not delivery:
            return None
        
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(delivery, field, value)
        
        self.db.commit()
        self.db.refresh(delivery)
        
        return delivery
    
    def delete_delivery(self, delivery_id: int) -> bool:
        """Удаление поставки"""
        delivery = self.get_delivery(delivery_id)
        if not delivery:
            return False
        
        self.db.delete(delivery)
        self.db.commit()
        
        return True
    
    def get_delivery_stats(self, filters: Optional[DeliveryFilters] = None) -> DeliveryStats:
        """Получение статистики по поставкам"""
        query = self.db.query(Delivery)
        
        # Применяем фильтры
        if filters:
            if filters.date_from:
                query = query.filter(Delivery.delivery_date >= filters.date_from)
            if filters.date_to:
                query = query.filter(Delivery.delivery_date <= filters.date_to)
            if filters.branch:
                query = query.filter(Delivery.branch.ilike(f"%{filters.branch}%"))
        
        deliveries = query.all()
        
        total_deliveries = len(deliveries)
        pending_deliveries = len([d for d in deliveries if d.status == "pending"])
        completed_deliveries = len([d for d in deliveries if d.status in ["accepted", "completed"]])
        total_items = sum(d.total_items for d in deliveries)
        total_cost = sum(d.total_cost or 0 for d in deliveries)
        
        # Уникальные поставщики и филиалы
        suppliers = list(set(d.supplier for d in deliveries if d.supplier))
        branches = list(set(d.branch for d in deliveries if d.branch))
        
        return DeliveryStats(
            total_deliveries=total_deliveries,
            pending_deliveries=pending_deliveries,
            completed_deliveries=completed_deliveries,
            total_items=total_items,
            total_cost=total_cost,
            suppliers=suppliers,
            branches=branches
        )
    
    def get_deliveries_by_date(self, target_date: date) -> List[Delivery]:
        """Получение поставок за определенную дату"""
        from loguru import logger
        
        logger.info(f"🔍 [DeliveryService.get_deliveries_by_date] Поиск поставок за дату: {target_date}")
        
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())
        
        logger.info(f"📅 [DeliveryService] Интервал поиска: {start_datetime} - {end_datetime}")
        
        # Выполняем запрос к БД
        deliveries = self.db.query(Delivery).filter(
            and_(
                Delivery.delivery_date >= start_datetime,
                Delivery.delivery_date <= end_datetime
            )
        ).all()
        
        logger.info(f"📊 [DeliveryService] Найдено поставок в БД: {len(deliveries)}")
        
        # Логируем информацию о каждой найденной поставке
        for i, delivery in enumerate(deliveries):
            logger.info(f"📦 [DeliveryService DELIVERY {i+1}] "
                       f"ID: {delivery.id}, "
                       f"Supplier: {delivery.supplier}, "
                       f"Branch: {delivery.branch}, "
                       f"Status: {delivery.status}, "
                       f"Date: {delivery.delivery_date}, "
                       f"AcceptedBy: {delivery.accepted_by_name}")
        
        return deliveries
    
    def get_deliveries_by_supplier(self, supplier: str) -> List[Delivery]:
        """Получение поставок по поставщику"""
        return self.db.query(Delivery).filter(
            Delivery.supplier.ilike(f"%{supplier}%")
        ).order_by(desc(Delivery.delivery_date)).all()
    
    def update_item_checked_status(self, item_id: int, is_checked: bool) -> bool:
        """Обновление статуса проверки товара"""
        item = self.db.query(DeliveryItem).filter(DeliveryItem.id == item_id).first()
        if not item:
            return False
        
        old_status = item.is_checked
        item.is_checked = is_checked
        
        # Обновляем счетчик в поставке
        delivery = item.delivery
        if old_status != is_checked:
            if is_checked:
                delivery.checked_items += 1
            else:
                delivery.checked_items -= 1
        
        self.db.commit()
        return True
