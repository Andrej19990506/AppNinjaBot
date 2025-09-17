import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import DeliveryAcceptanceModal from './DeliveryAcceptanceModal';
import { useAppSelector } from '@shared/store/hooks';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import { tooltipManager } from '@shared/components/Notifications/Toast';
import { isDeliveryDay } from '@shared/utils/dateUtils';

// 🎨 Брендовые SVG иконки для поставок
const SupplierBoxIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M21 8C21 8 17 6 12 6C7 6 3 8 3 8L12 13L21 8Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3.27 6.96L12 12.01L20.73 6.96" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M12 22.08V12" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const DeliveryTruckIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M1 3H15V13H1V3Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 8H20L23 11V16H16V8Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const PendingIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AcceptedIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      fill="var(--primary-color)" 
      stroke="var(--primary-color)" 
      strokeWidth="2"
    />
    <path 
      d="M9 12L11 14L15 10" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ItemsIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M8 6H21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M8 12H21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M8 18H21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 6H3.01" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 12H3.01" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 18H3.01" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);


type Item = {
  name: string;
  category?: string | null;
  unit?: string | null;
  supplier?: string | null;
  price: number | null;
  quantity_for_date?: number | null;
  item_total?: number | null;
  status?: string | null;
};

type SupplierGroup = {
  supplier: string;
  items: Item[];
  itemCount: number;
};

type CheckedItems = {
  [supplierItemKey: string]: boolean; // ключ: supplier-itemIndex, значение: проверен ли
};

type AcceptedDelivery = {
  id: string;
  supplier: string;
  acceptedBy: {
    name: string;
    initials: string;
    user_id?: number;
    telegram_id?: number;
    avatar?: string;
    photoUrl?: string;
  };
  acceptedAt: string;
  itemsCount: number;
  checkedItems?: CheckedItems; // Опционально для обратной совместимости
};

type Props = { 
  items: Item[];
  selectedDate?: string;
  selectedChatId?: string | null;
  chatTitle?: string;
  onModalStateChange?: (isOpen: boolean) => void; // Новый проп для передачи состояния модалки
  closeModalRef?: React.MutableRefObject<(() => void) | null>; // Ref для функции закрытия модалки
  acceptDeliveryRef?: React.MutableRefObject<(() => void) | null>; // Ref для функции принятия поставки
  onProgressChange?: (progress: number, isComplete: boolean) => void; // Новый проп для передачи прогресса
  onSubmittingChange?: (isSubmitting: boolean) => void; // Новый проп для передачи состояния загрузки
};

// Брендовые анимации в стиле приложения
const pulseAnimation = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4);
    transform: scale(1);
  }
  70% { 
    box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0);
    transform: scale(1.02);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0);
    transform: scale(1);
  }
`;

const breatheAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const shineAnimation = keyframes`
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

// Стилизованные компоненты
const TableContainer = styled.div`
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-color);
  position: relative;
  animation: ${fadeInUp} 0.7s ease-out;
  /* Убираем все ограничения для естественного роста контента */
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--gradient-primary);
  }
`;

const TableHeader = styled.div`
  background: var(--card-background);
  border-bottom: 2px solid var(--border-color);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    padding: 16px;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
`;

const TableTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ItemCount = styled.span`
  background: var(--primary-color);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
`;

const ScrollArea = styled.div`
  width: 100%;
  padding: 16px 24px;
  
  @media (max-width: 768px) {
    padding: 12px 0px;
  }
`;

// Контейнер для карточек с адаптивной сеткой
const CardsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
  width: 100%;
  align-items: start; /* Выравниваем карточки по верху */
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
  }
  
  @media (max-width: 768px) {
    margin-bottom: 85px;
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;


const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  min-width: 600px; /* Минимальная ширина для корректного отображения всех колонок */
  table-layout: fixed; /* Фиксированная ширина колонок */
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
    min-width: 500px; /* Уменьшенная минимальная ширина для мобильных */
    width: auto; /* Позволяем таблице расширяться за пределы контейнера */
    table-layout: auto; /* Автоматическая ширина колонок на мобильных */
  }
`;

const TableHead = styled.thead`
  background: var(--gray-50);
  position: sticky;
  top: 0;
  z-index: 5;
`;

const HeaderCell = styled.th<{ $align?: 'left' | 'right' | 'center' }>`
  padding: 16px 12px;
  text-align: ${props => props.$align || 'left'};
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-color);
  background: var(--card-background);
  white-space: nowrap;
  
  &:first-child {
    padding-left: 24px;
    min-width: 150px; /* Широкая колонка для названий */
  }
  
  &:nth-child(2) {
    min-width: 120px; /* Колонка категории */
  }
  
  &:nth-child(3) {
    min-width: 80px; /* Колонка единиц измерения */
  }
  
  &:nth-child(4) {
    min-width: 80px; /* Колонка количества */
  }
  
  &:last-child {
    padding-right: 24px;
    min-width: 100px; /* Колонка статуса */
  }
  
  @media (max-width: 768px) {
    padding: 10px 8px;
    font-size: 0.7rem;
    
    &:first-child {
      padding-left: 12px;
      min-width: 120px;
    }
    
    &:nth-child(2) {
      min-width: 100px;
    }
    
    &:nth-child(3) {
      min-width: 60px;
    }
    
    &:nth-child(4) {
      min-width: 60px;
    }
    
    &:last-child {
      padding-right: 12px;
      min-width: 80px;
    }
  }
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ $index: number }>`
  border-bottom: 1px solid var(--border-color);
  transition: all var(--transition-normal);
  animation: ${slideInLeft} 0.4s ease-out;
  animation-delay: ${props => props.$index * 0.05}s;
  animation-fill-mode: both;
  
  &:hover {
    background: var(--primary-transparent);
    transform: translateX(4px);
    box-shadow: inset 4px 0 0 var(--primary-color);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const TableCell = styled.td<{ $align?: 'left' | 'right' | 'center'; $highlight?: boolean }>`
  padding: 16px 12px;
  text-align: ${props => props.$align || 'left'};
  color: ${props => props.$highlight ? 'var(--primary-color)' : 'var(--text-color)'};
  font-weight: ${props => props.$highlight ? '600' : '400'};
  border-bottom: 1px solid var(--border-color);
  transition: all var(--transition-fast);
  
  &:first-child {
    padding-left: 24px;
    font-weight: 500;
    min-width: 150px;
  }
  
  &:nth-child(2) {
    min-width: 120px;
  }
  
  &:nth-child(3) {
    min-width: 80px;
  }
  
  &:nth-child(4) {
    min-width: 80px;
  }
  
  &:last-child {
    padding-right: 24px;
    min-width: 100px;
  }
  
  @media (max-width: 768px) {
    padding: 10px 8px;
    font-size: 0.8rem;
    
    &:first-child {
      padding-left: 12px;
      min-width: 120px;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    &:nth-child(2) {
      min-width: 100px;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    &:nth-child(3) {
      min-width: 60px;
    }
    
    &:nth-child(4) {
      min-width: 60px;
    }
    
    &:last-child {
      padding-right: 12px;
      min-width: 80px;
    }
  }
`;

const StatusBadge = styled.span<{ $status?: string }>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all var(--transition-fast);
  background: ${props => {
    const status = props.$status?.toLowerCase();
    if (status?.includes('готов') || status?.includes('выполнен')) return 'rgba(var(--primary-rgb), 0.1)';
    if (status?.includes('ожидан') || status?.includes('процесс')) return 'var(--warning-background)';
    if (status?.includes('отклонен') || status?.includes('ошибка')) return 'var(--error-background)';
    return 'var(--gray-100)';
  }};
  color: ${props => {
    const status = props.$status?.toLowerCase();
    if (status?.includes('готов') || status?.includes('выполнен')) return 'var(--primary-color)';
    if (status?.includes('ожидан') || status?.includes('процесс')) return 'var(--warning-color)';
    if (status?.includes('отклонен') || status?.includes('ошибка')) return 'var(--error-color)';
    return 'var(--text-secondary)';
  }};
  
  &:hover {
    transform: scale(1.05);
  }
  
  @media (max-width: 768px) {
    font-size: 0.65rem;
    padding: 2px 8px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 24px;
  color: var(--text-secondary);
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyText = styled.p`
  font-size: 1.1rem;
  margin: 0;
  text-align: center;
  line-height: 1.4;
`;

const DeliveryDaysInfo = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: center;
`;

const DayBadge = styled.span<{ $isActive?: boolean }>`
  padding: 6px 12px;
  border-radius: var(--radius);
  font-size: 0.875rem;
  font-weight: 600;
  
  ${props => props.$isActive ? `
    background: var(--gradient-primary);
    color: white;
    box-shadow: var(--shadow-sm);
  ` : `
    background: var(--gray-100);
    color: var(--text-secondary);
  `}
`;




// Хедер карточки в стиле DeliveryHistory
const CardHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px;
  }
`;

const SupplierInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  grid-column: 1; /* Левая колонка */
  justify-self: start;
`;

// Кнопка разворачивания в центре
const ExpandButtonContainer = styled.div`
  grid-column: 2; /* Центральная колонка */
  justify-self: center;
`;

// Статус поставки в правой части
const SupplierStatus = styled.div`
  grid-column: 3; /* Правая колонка */
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 8px;
  
  @media (max-width: 768px) {
    grid-column: 1;
    grid-row: 2;
    justify-self: start;
    margin-top: 4px;
  }
`;

// Брендовая кнопка разворачивания/сворачивания
const CollapseButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius);
  color: white;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
  z-index: 1;
  
  /* Эффект блеска */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transition: left 0.3s ease;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    
    &::before {
      left: 100%;
    }
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  /* SVG иконка стрелки */
  svg {
    width: 16px;
    height: 16px;
    transition: transform 0.3s ease;
  }
`;

// SVG компонент для стрелки в стиле DeliveryHistory
const ChevronDownIcon = ({ isExpanded }: { isExpanded: boolean }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ 
      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.3s ease'
    }}
  >
    <path 
      d="M6 9L12 15L18 9" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Название поставщика в стиле DeliveryHistory
const SupplierName = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* Позволяет тексту сжиматься */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  &::before {
    content: '🏢';
    font-size: 1.1rem;
    flex-shrink: 0; /* Иконка не сжимается */
  }
`;

const SupplierStats = styled.div`
  font-size: 0.9rem;
  opacity: 0.95;
  display: flex;
  gap: 20px;
  position: relative;
  z-index: 1;
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    
    svg {
      opacity: 0.8;
    }
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
  }
`;

// Статус бейдж в стиле DeliveryHistory
const DeliveryStatusBadge = styled.span<{ $status: string }>`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => props.$status === 'accepted' ? `
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary-color);
    border: 1px solid rgba(var(--primary-rgb), 0.2);
  ` : `
    background: var(--gray-100);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  `}
  
  @media (max-width: 768px) {
    grid-column: 1 / -1;
    justify-self: start;
    margin-top: 4px;
  }
`;

// Кнопка разворачивания в стиле DeliveryHistory
const ExpandButton = styled(motion.button)`
  background: rgba(var(--primary-rgb), 0.1);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: var(--radius);
  color: var(--primary-color);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0; /* Кнопка не сжимается */
  
  &:hover {
    background: rgba(var(--primary-rgb), 0.15);
    border-color: rgba(var(--primary-rgb), 0.3);
    transform: scale(1.05);
  }
  
  svg {
    width: 16px;
    height: 16px;
    transition: transform 0.3s ease;
  }
`;

// Детали карточки в стиле DeliveryHistory
const CardDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  
  .label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .value {
    color: var(--text-color);
    font-weight: 600;
  }
`;

// Информация о принявшем в стиле DeliveryHistory
const AcceptedBy = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--primary-rgb), 0.05);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary-color);
`;

// Контейнер для контента карточки (занимает оставшееся место)
const CardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

// Стили для развернутого контента с товарами (как в DeliveryHistory)
const ExpandedContent = styled(motion.div)`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
`;

// Заголовок списка товаров (как в DeliveryHistory)
const ItemsTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    color: var(--primary-color);
    opacity: 0.8;
  }
`;

// Список товаров (как в DeliveryHistory)
const SupplierItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// Строка товара (как в DeliveryHistory)
const SupplierItemRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--gray-50);
  border-radius: var(--radius);
  font-size: 0.85rem;
  
  .item-name {
    font-weight: 500;
    color: var(--text-color);
    flex: 1;
    margin-right: 12px;
  }
  
  .item-details {
    display: flex;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.8rem;
    flex-wrap: wrap;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    
    .item-name {
      margin-right: 0;
      margin-bottom: 4px;
    }
    
    .item-details {
      width: 100%;
      justify-content: flex-start;
    }
  }
`;

// Бейдж для деталей товара (как в DeliveryHistory)
const ItemBadge = styled.span<{ $type: 'category' | 'unit' | 'quantity' | 'status' }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  
  ${props => {
    if (props.$type === 'quantity') {
      return `
        background: rgba(var(--primary-rgb), 0.1);
        color: var(--primary-color);
        border: 1px solid rgba(var(--primary-rgb), 0.2);
      `;
    }
    if (props.$type === 'status') {
      return `
        background: rgba(var(--primary-rgb), 0.1);
        color: var(--primary-color);
        border: 1px solid rgba(var(--primary-rgb), 0.2);
      `;
    }
    return `
      background: var(--gray-100);
      color: var(--text-secondary);
      border: 1px solid var(--gray-200);
    `;
  }}
`;

// Контейнер для таблицы с горизонтальной прокруткой
const TableWrapper = styled.div`
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: var(--radius);
  
  @media (max-width: 768px) {
    /* Принудительная горизонтальная прокрутка на мобильных */
    overflow-x: scroll;
    overflow-y: visible;
    width: 100%;
    max-width: 100%;
    
    /* Скрываем скроллбар но оставляем функциональность */
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color) transparent;
    
    &::-webkit-scrollbar {
      height: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: var(--gray-100);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--primary-color);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: var(--primary-dark);
    }
  }
`;

// Карточка поставщика в стиле DeliveryHistory
const SupplierCard = styled(motion.div)<{ $isAccepted?: boolean }>`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
  transition: all var(--transition-normal);
  height: 100%;
  display: flex;
  flex-direction: column;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  @media (max-width: 768px) {
    padding: 16px;
  }
`;

// Футер карточки с действиями в брендовом стиле - компактный дизайн
const SupplierFooter = styled.div`
  background: var(--gray-50);
  padding: 12px 20px; /* Уменьшили padding */
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 50px; /* Фиксированная минимальная высота */
  margin-top: auto; /* Прижимаем футер к низу карточки */
  
  [data-theme="dark"] & {
    background: var(--gray-100);
  }
  
  @media (max-width: 768px) {
    padding: 10px 16px; /* Еще меньше на мобильных */
    flex-direction: column;
    gap: 12px;
    min-height: auto;
  }
`;

const FooterInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-weight: 500;
  
  span:first-child {
    font-size: 1.2rem;
  }
`;

const AcceptButton = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius);
  background: var(--gradient-primary);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast);
  margin-top: auto;
  
  &:hover {
    background: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

// Компоненты для выдвигающейся панели приемки поставки - УДАЛЕНЫ
// Теперь используется DeliveryAcceptanceModal

const UserInfo = styled.div`
  .name {
    font-weight: 600;
    color: var(--text-color);
    font-size: 0.9rem;
  }
  
  .date {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
`;

const UserAvatar = styled.div<{ $src?: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.$src ? 'transparent' : 'var(--gradient-primary)'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  background-image: ${props => props.$src ? `url(${props.$src})` : 'none'};
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden; /* Обрезаем изображение по кругу */
  object-fit: cover; /* Сохраняем пропорции изображения */
  
  /* Дополнительные стили для правильного отображения фото */
  ${props => props.$src && `
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
  `}
`;

// Остальные стили для модального окна - УДАЛЕНЫ
// Теперь используется DeliveryAcceptanceModal

const NotesSection = styled.div`
  padding: 20px 32px;
  border-top: 1px solid var(--border-color);
  background: var(--card-background);
`;

const NotesLabel = styled.label`
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    color: var(--primary-color);
    opacity: 0.8;
  }
`;

const NotesTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--card-background);
  color: var(--text-color);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  transition: all var(--transition-normal);
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }
  
  &::placeholder {
    color: var(--text-secondary);
  }
`;

const NotesIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M14 2V8H20" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 13H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 17H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M10 9H8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ItemsTable: React.FC<Props> = ({ items, selectedDate, selectedChatId, chatTitle, onModalStateChange, closeModalRef, acceptDeliveryRef, onProgressChange, onSubmittingChange }) => {
  const user = useAppSelector(selectUser);
  const [acceptedDeliveries, setAcceptedDeliveries] = useState<Map<string, AcceptedDelivery>>(new Map());
  const [collapsedSuppliers, setCollapsedSuppliers] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierGroup | null>(null);
  const [checkedItems, setCheckedItems] = useState<CheckedItems>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({}); // Заметки для каждого товара

  // 🔍 Логи для отладки состояния компонента
  console.log('🎯 [ItemsTable] Рендер:', items.length, 'товаров,', acceptedDeliveries.size, 'принятых поставок');
  
  // Отслеживаем изменения прогресса и состояния загрузки
  useEffect(() => {
    if (modalOpen && selectedSupplier) {
      const totalItems = selectedSupplier.items.length;
      const checkedCount = Object.values(checkedItems).filter(Boolean).length;
      const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;
      const isComplete = checkedCount === totalItems;
      
      onProgressChange?.(progress, isComplete);
    }
  }, [modalOpen, selectedSupplier, checkedItems, onProgressChange]);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  // Устанавливаем функцию принятия поставки в ref
  useEffect(() => {
    if (acceptDeliveryRef) {
      acceptDeliveryRef.current = () => {
        if (selectedSupplier) {
          handleConfirmAcceptance(checkedItems, itemNotes);
        }
      };
    }
  }, [selectedSupplier, checkedItems, itemNotes, acceptDeliveryRef]);
  
  const formatNumber = (num: number) => 
    num.toLocaleString('ru-RU');

  // 👤 Функция для получения инициалов пользователя
  const getUserInitials = (name: string): string => {
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word[0].toUpperCase())
      .slice(0, 2)
      .join('');
  };

  // 👤 Получаем данные текущего пользователя
  const getCurrentUserData = () => {
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';
    const initials = getUserInitials(fullName);
    
    // URL фото пользователя через API endpoint
    const photoUrl = user?.id 
      ? `${window.APP_CONFIG?.API_URL || 'http://localhost:8000/api'}/v1/users/${user.id}/photo`
      : undefined;
    
    console.log('👤 [ItemsTable] Получение данных пользователя');
    
    return {
      name: fullName,
      initials: initials,
      user_id: user?.id,
      telegram_id: user?.id, // Используем id как telegram_id если нет отдельного поля
      photoUrl: photoUrl
    };
  };

  // 📡 Передаем состояние модалки в родительский компонент
  React.useEffect(() => {
    onModalStateChange?.(modalOpen);
  }, [modalOpen, onModalStateChange]);

  // 🚪 Функция для закрытия модалки
  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    setSelectedSupplier(null);
    setCheckedItems({});
    setItemNotes({}); // Сбрасываем заметки к товарам
  }, []);

  // 📡 Устанавливаем функцию закрытия модалки в ref
  React.useEffect(() => {
    if (closeModalRef) {
      closeModalRef.current = closeModal;
    }
  }, [closeModal, closeModalRef]);

  // Группировка товаров по поставщикам
  const groupItemsBySupplier = (items: Item[]): SupplierGroup[] => {
    const groups = items.reduce((acc, item) => {
      const supplier = item.supplier || 'Неизвестный поставщик';
      
      if (!acc[supplier]) {
        acc[supplier] = {
          supplier,
          items: [],
          itemCount: 0
        };
      }
      
      acc[supplier].items.push(item);
      acc[supplier].itemCount += 1;
      
      return acc;
    }, {} as Record<string, SupplierGroup>);
    
    return Object.values(groups).sort((a, b) => a.supplier.localeCompare(b.supplier));
  };

  // 📦 Получаем группы поставщиков с умной сортировкой
  const supplierGroups = React.useMemo(() => {
    const groups = groupItemsBySupplier(items);
    
    // 🎯 Сортируем: не принятые поставки вверх, принятые вниз
    return groups.sort((a, b) => {
      const aIsAccepted = acceptedDeliveries.has(a.supplier);
      const bIsAccepted = acceptedDeliveries.has(b.supplier);
      
      // Если статусы разные - не принятые идут первыми
      if (aIsAccepted !== bIsAccepted) {
        return aIsAccepted ? 1 : -1;
      }
      
      // Если статусы одинаковые - сортируем по названию поставщика
      return a.supplier.localeCompare(b.supplier);
    });
  }, [items, acceptedDeliveries]);

  // 📦 По умолчанию сворачиваем все карточки при первой загрузке
  React.useEffect(() => {
    if (supplierGroups.length > 0 && collapsedSuppliers.size === 0) {
      const allSuppliers = new Set(supplierGroups.map(group => group.supplier));
      setCollapsedSuppliers(allSuppliers);
    }
  }, [supplierGroups.length, collapsedSuppliers.size]);

  // 📋 Загрузка принятых поставок при изменении даты
  const loadAcceptedDeliveries = useCallback(async () => {
    if (!selectedDate) {
      return;
    }
    
    console.log('🔄 [DELIVERIES] Загрузка принятых поставок для даты:', selectedDate);

    try {
      const { getDeliveriesByDate } = await import('../services/requestsApi');
      
      const deliveries = await getDeliveriesByDate(selectedDate);
      
      console.log('✅ [DELIVERIES] Получено поставок:', deliveries.length);

      // Создаем Map из принятых поставок
      const acceptedMap = new Map<string, AcceptedDelivery>();
      
      deliveries.forEach((delivery, index) => {
        console.log(`📦 [DELIVERY ${index + 1}] Обработка поставки:`, delivery.supplier);

        // Фильтруем только принятые поставки для текущего филиала
        if (delivery.status === 'accepted' && 
            (delivery.branch === chatTitle || delivery.branch === selectedChatId)) {
          
          // Получаем URL фото пользователя
          const photoUrl = delivery.accepted_by_user_id 
            ? `${window.APP_CONFIG?.API_URL || 'http://localhost:8000/api'}/v1/users/${delivery.accepted_by_user_id}/photo`
            : undefined;


          const acceptedDelivery: AcceptedDelivery = {
            id: delivery.id.toString(),
            supplier: delivery.supplier,
            acceptedBy: {
              name: delivery.accepted_by_name || 'Неизвестно',
              initials: delivery.accepted_by_initials || '??',
              user_id: delivery.accepted_by_user_id,
              telegram_id: delivery.accepted_by_user_id,
              photoUrl: photoUrl
            },
            acceptedAt: delivery.accepted_at || new Date().toISOString(),
            itemsCount: delivery.items?.length || 0
          };

          acceptedMap.set(delivery.supplier, acceptedDelivery);
          
        } else {
        }
      });

      console.log('🎯 [DELIVERIES] Итоговый результат:', acceptedMap.size, 'поставок');

      setAcceptedDeliveries(acceptedMap);
      
    } catch (error) {
      console.error('❌ [DELIVERIES] Ошибка загрузки:', error);
    }
  }, [selectedDate, selectedChatId, chatTitle]);

  useEffect(() => {
    loadAcceptedDeliveries();
  }, [selectedDate, selectedChatId, chatTitle]); // Используем прямые зависимости вместо функции

  const handleAcceptDelivery = (supplierGroup: SupplierGroup) => {
    setSelectedSupplier(supplierGroup);
    setModalOpen(true);
    // Инициализируем состояние чекбоксов для этого поставщика
    const initialChecked: CheckedItems = {};
    supplierGroup.items.forEach((_, index) => {
      initialChecked[`${supplierGroup.supplier}-${index}`] = false;
    });
    setCheckedItems(initialChecked);
  };

  // 🔔 Используем общую систему уведомлений
  const showNotification = (type: 'success' | 'error', message: string) => {
    tooltipManager.show(message, type);
  };

  const handleConfirmAcceptance = async (checkedItems: { [key: string]: boolean }, itemNotes: { [key: string]: string }) => {
    if (!selectedSupplier || isSubmitting) return;
    
    console.log('🚀 [ACCEPT] Принятие поставки:', selectedSupplier.supplier);
    
    // 🚫 Проверяем что все товары отмечены
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    console.log('✅ [ACCEPT] Отмечено товаров:', checkedCount, 'из', selectedSupplier.items.length);
    
    if (checkedCount !== selectedSupplier.items.length) {
      showNotification('error', 'Необходимо отметить все товары перед приемкой поставки');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { acceptDelivery } = await import('../services/requestsApi');
      
      // Подготавливаем данные для отправки - только отмеченные товары
      const deliveryItems = selectedSupplier.items
        .map((item, index) => {
          const itemKey = `${selectedSupplier.supplier}-${index}`;
          return {
            name: item.name,
            category: item.category || undefined,
            unit: item.unit || undefined,
            quantity: item.quantity_for_date || undefined,
            price: undefined, // Цены мы убрали из интерфейса
            is_checked: checkedItems[itemKey] || false,
            notes: itemNotes[itemKey] || undefined, // Добавляем заметки к товару
            itemKey: itemKey
          };
        })
        .filter(item => item.is_checked); // Отправляем только отмеченные товары


      // 🚫 Дополнительная проверка что есть отмеченные товары для отправки
      if (deliveryItems.length === 0) {
        showNotification('error', 'Не выбрано ни одного товара для приемки');
        setIsSubmitting(false);
        return;
      }

      const deliveryRequest = {
        supplier: selectedSupplier.supplier,
        branch: chatTitle || 'Неизвестный филиал', // Получаем из выбранного чата
        delivery_date: selectedDate || new Date().toISOString().split('T')[0],
        items: deliveryItems,
        accepted_by: getCurrentUserData(),
        notes: undefined // Убираем системную заметку - она не нужна пользователям
      };

      console.log('📨 [ACCEPT] Отправка запроса...');

      // Отправляем данные на сервер
      const response = await acceptDelivery(deliveryRequest);
      
      console.log('✅ [ACCEPT] Ответ получен');
      
      // Создаем локальную запись о принятой поставке
      const acceptedDelivery: AcceptedDelivery = {
        id: response.delivery_id?.toString() || `local-${Date.now()}`,
        supplier: selectedSupplier.supplier,
        acceptedBy: {
          name: deliveryRequest.accepted_by.name,
          initials: deliveryRequest.accepted_by.initials,
          user_id: deliveryRequest.accepted_by.user_id,
          telegram_id: deliveryRequest.accepted_by.telegram_id,
          avatar: undefined,
          photoUrl: deliveryRequest.accepted_by.photoUrl
        },
        acceptedAt: new Date().toISOString(),
        itemsCount: deliveryItems.length,
        checkedItems: { ...checkedItems }
      };



      setAcceptedDeliveries(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedSupplier.supplier, acceptedDelivery);
        console.log('🔄 [ACCEPT] Обновляем состояние acceptedDeliveries:', {
          previousSize: prev.size,
          newSize: newMap.size,
          suppliers: Array.from(newMap.keys())
        });
        return newMap;
      });
      
      setModalOpen(false);
      setSelectedSupplier(null);
      setCheckedItems({});
      
      // Показываем уведомление об успехе
      showNotification('success', `Поставка от ${selectedSupplier.supplier} успешно принята!`);
      
      // 📢 Отправляем уведомление в Telegram чат
      if (selectedChatId && typeof selectedChatId === 'string' && selectedChatId.trim() !== '') {
        try {
          console.log('📢 [NOTIFICATION] Отправляем уведомление в Telegram чат...');
          console.log('🔍 [NOTIFICATION] selectedChatId:', selectedChatId, 'тип:', typeof selectedChatId);
          
          const { sendDeliveryNotification } = await import('../services/requestsApi');
          
          const notificationData = {
            chat_id: selectedChatId.trim(),
            supplier: selectedSupplier.supplier,
            items: deliveryItems.map(item => ({
              name: item.name,
              quantity: item.quantity || 0,
              unit: item.unit || 'шт',
              notes: item.notes || undefined // Добавляем заметки к товару
            })),
            accepted_by: {
              name: deliveryRequest.accepted_by.name,
              initials: deliveryRequest.accepted_by.initials
            },
            delivery_date: deliveryRequest.delivery_date,
            branch: deliveryRequest.branch
          };
          
          console.log('📋 [NOTIFICATION] Данные для уведомления:', notificationData);
          
          await sendDeliveryNotification(notificationData);
          console.log('✅ [NOTIFICATION] Уведомление успешно отправлено в чат');
          
        } catch (notificationError) {
          console.error('❌ [NOTIFICATION] Ошибка при отправке уведомления:', notificationError);
          // Не показываем ошибку пользователю, так как поставка уже принята
          showNotification('error', 'Поставка принята, но не удалось отправить уведомление в чат');
        }
      } else {
        console.warn('⚠️ [NOTIFICATION] selectedChatId не задан или невалиден:', {
          selectedChatId,
          type: typeof selectedChatId,
          isEmpty: selectedChatId === '',
          isNull: selectedChatId === null,
          isUndefined: selectedChatId === undefined
        });
      }
      
      console.log(`🎉 [ACCEPT] Поставка от ${selectedSupplier.supplier} успешно сохранена с ID: ${response.delivery_id}`);
      
    } catch (error) {
      console.error('❌ [ACCEPT] Ошибка при принятии поставки:', error);
      console.error('🔍 [ACCEPT] Детали ошибки:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        supplier: selectedSupplier.supplier,
        selectedDate,
        chatTitle
      });
      
      // Показываем уведомление об ошибке
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при сохранении поставки';
      showNotification('error', errorMessage);
      
      // Не закрываем модалку при ошибке, чтобы пользователь мог повторить попытку
    } finally {
      setIsSubmitting(false);
      console.log('🏁 [ACCEPT] Завершение процесса принятия поставки');
    }
  };

  // handleToggleItem удалена - теперь используется DeliveryAcceptanceModal

  const toggleSupplierCollapse = (supplier: string) => {
    setCollapsedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplier)) {
        newSet.delete(supplier);
      } else {
        newSet.add(supplier);
      }
      return newSet;
    });
  };


  // Проверяем день недели для поставок (красноярское время)
  const checkDeliveryDay = (dateString?: string) => {
    if (!dateString) return { isValidDay: true, message: '' };
    
    const date = new Date(dateString);
    const isValidDay = isDeliveryDay(date);
    
    if (!isValidDay) {
      return {
        isValidDay: false,
        message: 'Поставки принимаются только в понедельник, среду и пятницу'
      };
    }
    
    return { isValidDay: true, message: '' };
  };

  const deliveryCheck = checkDeliveryDay(selectedDate);

  if (!items || items.length === 0) {
  return (
      <TableContainer>
        <TableHeader>
          <TableTitle>📦 Поставки</TableTitle>
        </TableHeader>
        <EmptyState>
          <EmptyIcon>{deliveryCheck.isValidDay ? '📭' : '📅'}</EmptyIcon>
          <EmptyText>
            {deliveryCheck.isValidDay 
              ? 'Нет товаров в текущей заявке'
              : deliveryCheck.message
            }
          </EmptyText>
          {!deliveryCheck.isValidDay && (
            <DeliveryDaysInfo>
              <DayBadge $isActive>Пн</DayBadge>
              <DayBadge $isActive>Ср</DayBadge>
              <DayBadge $isActive>Пт</DayBadge>
            </DeliveryDaysInfo>
          )}
        </EmptyState>
      </TableContainer>
    );
  }

  const totalSuppliers = supplierGroups.length;

  // Анимации для framer-motion
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5 }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.4 }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <TableContainer>
        <motion.div variants={headerVariants}>
          <TableHeader>
            <TableTitle>
              📦 Поставки ({totalSuppliers})
            </TableTitle>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ItemCount>
                {items.length} товаров
              </ItemCount>
            </motion.div>
          </TableHeader>
        </motion.div>
      
      <ScrollArea>
        <CardsContainer>
          <AnimatePresence>
            {supplierGroups.map((group, groupIndex) => {
              const isCollapsed = collapsedSuppliers.has(group.supplier);
              const isAccepted = acceptedDeliveries.has(group.supplier);
              
              return (
                <motion.div
                  key={group.supplier}
                  variants={cardVariants}
                  whileHover={{ 
                    scale: 1.01,
                    transition: { duration: 0.2 }
                  }}
                  layout
                >
                  <SupplierCard $isAccepted={isAccepted}>
                    <CardHeader>
                      <SupplierName title={`Поставка от ${group.supplier}`}>
                        Поставка от {group.supplier}
                      </SupplierName>
                      <ExpandButton
                        onClick={() => toggleSupplierCollapse(group.supplier)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <ChevronDownIcon isExpanded={!isCollapsed} />
                      </ExpandButton>
                      <DeliveryStatusBadge $status={isAccepted ? 'accepted' : 'pending'}>
                        {isAccepted ? 'Принято' : 'Ожидает'}
                      </DeliveryStatusBadge>
                    </CardHeader>
              
                    <CardDetails>
                      <DetailRow>
                        <span className="label">Товаров:</span>
                        <span className="value">{group.itemCount}</span>
                      </DetailRow>
                      <DetailRow>
                        <span className="label">Дата поставки:</span>
                        <span className="value">
                          {selectedDate ? new Date(selectedDate).toLocaleDateString('ru-RU') : '—'}
                        </span>
                      </DetailRow>
                    </CardDetails>

                    {isAccepted && (
                      <AcceptedBy>
                        <UserAvatar $src={acceptedDeliveries.get(group.supplier)?.acceptedBy.photoUrl}>
                          {!acceptedDeliveries.get(group.supplier)?.acceptedBy.photoUrl && acceptedDeliveries.get(group.supplier)?.acceptedBy.initials}
                        </UserAvatar>
                        <UserInfo>
                          <div className="name">{acceptedDeliveries.get(group.supplier)?.acceptedBy.name}</div>
                          <div className="date">Принял {acceptedDeliveries.get(group.supplier)?.acceptedAt ? new Date(acceptedDeliveries.get(group.supplier)!.acceptedAt).toLocaleDateString('ru-RU') : '—'}</div>
                        </UserInfo>
                      </AcceptedBy>
                    )}

                    {/* Развернутый контент с товарами (как в DeliveryHistory) */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <ExpandedContent
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ItemsTitle>
                            <ItemsIcon size={18} />
                            Товары поставки ({group.items.length})
                          </ItemsTitle>
                          
                          <SupplierItemsList>
                            {group.items.map((item, index) => (
                              <SupplierItemRow key={`${groupIndex}-${index}`}>
                                <div className="item-name">{item.name}</div>
                                <div className="item-details">
                                  {item.category && (
                                    <ItemBadge $type="category">
                                      {item.category}
                                    </ItemBadge>
                                  )}
                                  {item.unit && (
                                    <ItemBadge $type="unit">
                                      {item.unit}
                                    </ItemBadge>
                                  )}
                                  {item.quantity_for_date != null && (
                                    <ItemBadge $type="quantity">
                                      {formatNumber(item.quantity_for_date)}
                                    </ItemBadge>
                                  )}
                                  {item.status && (
                                    <ItemBadge $type="status">
                                      {item.status}
                                    </ItemBadge>
                                  )}
                                </div>
                              </SupplierItemRow>
                            ))}
                          </SupplierItemsList>
                        </ExpandedContent>
                      )}
                    </AnimatePresence>
              
                    {!isAccepted && (
                      <AcceptButton 
                        onClick={() => handleAcceptDelivery(group)}
                      >
                        <SupplierBoxIcon size={16} />
                        Принять поставку
                      </AcceptButton>
                    )}
                  </SupplierCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </CardsContainer>
      </ScrollArea>
      </TableContainer>

      {/* Модальное окно для приемки поставки */}
      <DeliveryAcceptanceModal
        isOpen={modalOpen}
        onClose={closeModal}
        onAccept={() => handleConfirmAcceptance(checkedItems, itemNotes)}
        onCancel={closeModal}
        supplier={selectedSupplier?.supplier || ''}
        items={selectedSupplier?.items.map(item => ({
          name: item.name,
          category: item.category || 'Без категории',
          unit: item.unit || 'шт',
          quantity: item.quantity_for_date || 0,
          price: item.price || 0
        })) || []}
        checkedItems={checkedItems}
        itemNotes={itemNotes}
        onItemToggle={(index) => {
          const itemKey = `${selectedSupplier?.supplier}-${index}`;
          setCheckedItems(prev => ({
            ...prev,
            [itemKey]: !prev[itemKey]
          }));
        }}
        onNoteChange={(index, note) => {
          const itemKey = `${selectedSupplier?.supplier}-${index}`;
          setItemNotes(prev => ({
            ...prev,
            [itemKey]: note
          }));
        }}
        isSubmitting={isSubmitting}
      />

      {/* Уведомления теперь управляются общей системой tooltipManager */}
    </motion.div>
  );
};

export default ItemsTable;


