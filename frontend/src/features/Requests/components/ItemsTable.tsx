import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import DeliveryAcceptanceModal from './DeliveryAcceptanceModal';
import SupplyCalendar from './SupplyCalendar';
import { useAppSelector } from '@shared/store/hooks';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import { tooltipManager } from '@shared/components/Notifications/Toast';
import { isDeliveryDay } from '@shared/utils/dateUtils';

// 🎨 Брендовые SVG иконки для поставок

// Функция для правильного склонения слова "поставка"
const getSuppliesText = (count: number): string => {
  if (count === 1) return 'поставка';
  if (count >= 2 && count <= 4) return 'поставки';
  return 'поставок';
};

// Функция для получения полного текста с датой и количеством
const getSuppliesTextWithDate = (date: string, count: number): string => {
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const month = dateObj.getMonth();
  
  // Склонение месяцев в родительный падеж
  const monthsGenitive = [
    'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
    'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
  ];
  
  const monthName = monthsGenitive[month];
  
  return `За ${day} ${monthName} ${count} ${getSuppliesText(count)}`;
};

// Типы поставок
const SUPPLY_TYPES = [
  { id: 'raw_materials', name: 'Сырье', description: 'Продукты и ингредиенты' },
  { id: 'household', name: 'Хозтовары', description: 'Бытовая химия и уборка' },
  { id: 'stationery', name: 'Канцелярия', description: 'Офисные принадлежности' }
] as const;

// Интерфейс для конфигурации поставок с поддержкой разных таблиц
interface SuppliesConfig {
  spreadsheet_id: string;
  household_spreadsheet_id?: string; // Отдельная таблица для хозтоваров
  stationery_spreadsheet_id?: string; // Отдельная таблица для канцелярии
  default_sheet_pattern: string;
  branch_name: string;
  start_row: number;
  header_row: number;
  months_range_back: number;
  months_range_forward: number;
}

type SupplyType = typeof SUPPLY_TYPES[number]['id'];

// Функция для получения правильного spreadsheet_id в зависимости от типа поставок
const getSpreadsheetIdForType = (config: SuppliesConfig, supplyType: SupplyType): string => {
  switch (supplyType) {
    case 'raw_materials':
      return config.spreadsheet_id;
    case 'household':
      return config.household_spreadsheet_id || config.spreadsheet_id;
    case 'stationery':
      return config.stationery_spreadsheet_id || config.spreadsheet_id;
    default:
      return config.spreadsheet_id;
  }
};

const CalendarIcon = ({ size = 20, selectedDate }: { size?: number; selectedDate?: string }) => {
  const dayNumber = selectedDate ? new Date(selectedDate).getDate() : new Date().getDate();
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Основа календаря */}
      <rect 
        x="3" 
        y="4" 
        width="18" 
        height="18" 
        rx="2" 
        ry="2" 
        stroke="currentColor" 
        strokeWidth="2"
        fill="rgba(var(--primary-rgb), 0.05)"
      />
      
      {/* Верхние крепления */}
      <line 
        x1="16" 
        y1="2" 
        x2="16" 
        y2="6" 
        stroke="currentColor" 
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line 
        x1="8" 
        y1="2" 
        x2="8" 
        y2="6" 
        stroke="currentColor" 
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Разделитель заголовка */}
      <line 
        x1="3" 
        y1="10" 
        x2="21" 
        y2="10" 
        stroke="currentColor" 
        strokeWidth="2"
      />
      
  
    </svg>
  );
};

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
  onDateChange?: (date: string) => void; // Новый проп для изменения даты
  selectedSupplyType?: SupplyType; // Выбранный тип поставок
  onSupplyTypeChange?: (type: SupplyType) => void; // Функция для изменения типа поставок
  acceptedDeliveriesCache?: React.MutableRefObject<Map<string, Map<string, any>>>; // Глобальный кеш принятых поставок
  onMonthChange?: (month: Date) => void; // Функция для загрузки данных при смене месяца
  deliveryData?: Array<{date: string, count: number, suppliers: string[]}>; // Данные поставок для календаря
};


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


// Стилизованные компоненты
const TableContainer = styled.div`
  border-radius: var(--radius-lg);
  position: relative;
  animation: ${fadeInUp} 0.7s ease-out;
  backdrop-filter: blur(20px);
  &::after {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: calc(var(--radius-lg) + 2px);
    pointer-events: none;
    z-index: -2;
    opacity: 0.6;
  }
`;

const TableHeader = styled.div<{ $isExpanded?: boolean }>`
  background: var(--card-background);
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  
  
  @media (max-width: 768px) {
    padding: 20px 24px;
    flex-direction:column;
    gap: 12px;
    text-align: center;
  }
`;

const HeaderTopRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 16px;
  margin-bottom: 16px;
`;

const HeaderLeftSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
`;


const CalendarToggleIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: rgba(var(--primary-rgb), 0.08);
  border: 1px solid rgba(var(--primary-rgb), 0.15);
  white-space: nowrap;
  
  &:hover {
    color: var(--primary-color);
    background: rgba(var(--primary-rgb), 0.12);
    border-color: rgba(var(--primary-rgb), 0.25);
    transform: scale(1.02);
  }
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 5px 8px;
    gap: 4px;
  }
`;

const CalendarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: var(--radius-lg);
  background: rgba(var(--primary-rgb), 0.05);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: rgba(var(--primary-rgb), 0.08);
    border-color: rgba(var(--primary-rgb), 0.15);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

// Каруселька типов поставок
const SupplyTypeCarousel = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(var(--primary-rgb), 0.05);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
`;

const SupplyTypeButton = styled.button<{ $isActive: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: ${props => props.$isActive 
    ? 'var(--primary-color)' 
    : 'rgba(var(--primary-rgb), 0.1)'
  };
  color: ${props => props.$isActive 
    ? 'white' 
    : 'var(--text-primary)'
  };
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
  box-shadow: ${props => props.$isActive 
    ? '0 4px 12px rgba(var(--primary-rgb), 0.3)' 
    : '0 2px 4px rgba(0, 0, 0, 0.1)'
  };
  
  &:hover {
    background: ${props => props.$isActive 
      ? 'var(--primary-color)' 
      : 'rgba(var(--primary-rgb), 0.15)'
    };
    transform: translateY(-1px);
    box-shadow: ${props => props.$isActive 
      ? '0 6px 16px rgba(var(--primary-rgb), 0.4)' 
      : '0 4px 8px rgba(0, 0, 0, 0.15)'
    };
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const SupplyTypeIcon = styled.span`
  font-size: 1.2rem;
  line-height: 1;
`;

const SupplyTypeName = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
`;

const SupplyTypeDescription = styled.span`
  font-size: 0.7rem;
  opacity: 0.8;
  text-align: center;
  line-height: 1.2;
  margin-top: 2px;
`;


const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
`;

const CountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const SupplierCount = styled.span`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: rgba(var(--primary-rgb), 0.1);
  padding: 4px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ItemCount = styled.span`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--primary-color);
  background: rgba(var(--primary-rgb), 0.15);
  padding: 6px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(var(--primary-rgb), 0.3);
  box-shadow: 0 3px 6px rgba(var(--primary-rgb), 0.2);
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(var(--primary-rgb), 0.3);
  }
`;

const ChevronDownIcon = ({ isExpanded }: { isExpanded: boolean }) => (
  <motion.svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    animate={{ rotate: isExpanded ? 180 : 0 }}
    transition={{ duration: 0.3, ease: 'easeInOut' }}
    style={{ color: 'currentColor' }}
  >
    <path 
      d="M6 9L12 15L18 9" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </motion.svg>
);

const TableTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
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
    grid-template-columns: 1fr;
    gap: 16px;
    min-height: 100%;
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
  text-align: center;
  
  /* Унификация эмодзи на всех устройствах */
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiSymbols', 'EmojiOne Mozilla', 'Twemoji Mozilla', 'Segoe UI Symbol', sans-serif;
  font-variant-emoji: emoji;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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
  margin-top: 15px;
  
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

const ItemsTable: React.FC<Props> = ({ items, selectedDate, selectedChatId, chatTitle, onModalStateChange, closeModalRef, acceptDeliveryRef, onProgressChange, onSubmittingChange, onDateChange, selectedSupplyType = 'raw_materials', onSupplyTypeChange, acceptedDeliveriesCache, onMonthChange, deliveryData = [] }) => {
  console.log('🎯 [ItemsTable] Рендер:', { 
    itemsCount: items?.length || 0, 
    selectedSupplyType, 
    hasItems: !!items,
    items: items,
    deliveryDataCount: deliveryData?.length || 0,
    deliveryData: deliveryData,
    selectedDate: selectedDate
  });
  const user = useAppSelector(selectUser);
  const [acceptedDeliveries, setAcceptedDeliveries] = useState<Map<string, AcceptedDelivery>>(new Map());
  
  // 🚀 Используем глобальный кеш из Requests.tsx - не теряется при перемонтировании
  const cache = acceptedDeliveriesCache || useRef<Map<string, Map<string, AcceptedDelivery>>>(new Map());
  // 🚀 Используем useRef для сохранения состояния свернутых поставщиков между рендерами
  const collapsedSuppliersRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierGroup | null>(null);
  const [checkedItems, setCheckedItems] = useState<CheckedItems>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({}); // Заметки для каждого товара
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  
  // 🚀 Сохраняем состояние календаря между рендерами - не сбрасывается при переключении месяца
  const calendarExpandedRef = useRef(false);

  // 📅 Переключение состояния календаря с сохранением в useRef
  const toggleCalendar = useCallback(() => {
    const newState = !calendarExpandedRef.current;
    calendarExpandedRef.current = newState;
    setIsCalendarExpanded(newState);
    console.log('📅 [ItemsTable] Переключение календаря:', newState ? 'развернут' : 'свернут');
    console.log('📅 [ItemsTable] calendarExpandedRef.current:', calendarExpandedRef.current);
    console.log('📅 [ItemsTable] isCalendarExpanded state:', newState);
  }, []);
  
  // 🔄 Синхронизируем состояние календаря с useRef при каждом рендере
  useEffect(() => {
    console.log('🔄 [ItemsTable] Синхронизация календаря - deliveryData изменился');
    console.log('🔄 [ItemsTable] calendarExpandedRef.current до синхронизации:', calendarExpandedRef.current);
    console.log('🔄 [ItemsTable] isCalendarExpanded до синхронизации:', isCalendarExpanded);
    
    setIsCalendarExpanded(calendarExpandedRef.current);
    
    console.log('🔄 [ItemsTable] После синхронизации - isCalendarExpanded:', calendarExpandedRef.current);
  }, [deliveryData]); // Синхронизируем при изменении deliveryData
  
  useEffect(() => {
    if (selectedSupplyType === 'stationery') {
      console.log('🎯 [ItemsTable] Канцелярия выбрана - показываем товары!');
    }
  }, [selectedSupplyType]);

  // 🚀 ОПТИМИЗАЦИЯ: Данные календаря теперь приходят из Requests.tsx через пропсы
  // Удаляем локальную функцию fetchDeliveryData и useEffect

  console.log('🎯 [ItemsTable] Рендер:', items.length, 'товаров,', acceptedDeliveries.size, 'принятых поставок');
  console.log('🎯 [ItemsTable] isCalendarExpanded в рендере:', isCalendarExpanded);
  console.log('🎯 [ItemsTable] calendarExpandedRef.current в рендере:', calendarExpandedRef.current);
  console.log('🎯 [ItemsTable] deliveryData.length в рендере:', deliveryData.length);
  
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
    if (supplierGroups.length > 0 && collapsedSuppliersRef.current.size === 0) {
      const allSuppliers = new Set(supplierGroups.map(group => group.supplier));
      collapsedSuppliersRef.current = allSuppliers;
      forceUpdate({});
    }
  }, [supplierGroups.length]);

  // 📋 Загрузка принятых поставок при изменении даты
  const loadAcceptedDeliveries = useCallback(async () => {
    if (!selectedDate || !selectedChatId) {
      console.log('❌ [DELIVERIES] Пропускаем загрузку - нет selectedDate или selectedChatId');
      return;
    }
    
    // 🚀 Создаем ключ кеша: chatId + date
    const cacheKey = `${selectedChatId}-${selectedDate}`;
    console.log('🔍 [DELIVERIES] Проверяем кеш для ключа:', cacheKey);
    console.log('📊 [DELIVERIES] Текущий размер кеша:', cache.current.size);
    console.log('🗂️ [DELIVERIES] Ключи в кеше:', Array.from(cache.current.keys()));
    
    // ✅ Проверяем кеш - если данные уже есть, используем их
    if (cache.current.has(cacheKey)) {
      const cachedData = cache.current.get(cacheKey)!;
      console.log('⚡ [DELIVERIES] Используем кешированные данные:', cachedData.size, 'поставок');
      setAcceptedDeliveries(cachedData);
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

      // 🚀 Сохраняем в кеш для будущих использований
      cache.current.set(cacheKey, acceptedMap);
      console.log('💾 [DELIVERIES] Сохранили в кеш:', cacheKey, 'с', acceptedMap.size, 'поставками');
      console.log('📊 [DELIVERIES] Размер кеша:', cache.current.size, 'записей');
      
      setAcceptedDeliveries(acceptedMap);
      
    } catch (error) {
      console.error('❌ [DELIVERIES] Ошибка загрузки:', error);
    }
  }, [selectedDate, selectedChatId, chatTitle]);

  useEffect(() => {
    // 🚀 Умное кеширование как в DeliveryHistory - загружаем только если данных нет или изменился филиал
    console.log('🔄 [ItemsTable] useEffect triggered - вызываем loadAcceptedDeliveries:', { selectedDate, selectedChatId, chatTitle });
    
    if (selectedDate && selectedChatId && chatTitle) {
      // Проверяем есть ли уже данные для этого филиала и даты
      const cacheKey = `${selectedChatId}-${selectedDate}`;
      const hasCachedData = cache.current.has(cacheKey);
      
      if (!hasCachedData) {
        console.log('🔄 [ItemsTable] Нет кешированных данных - загружаем');
        loadAcceptedDeliveries();
      } else {
        console.log('⚡ [ItemsTable] Данные уже есть в кеше - используем их');
        const cachedData = cache.current.get(cacheKey)!;
        setAcceptedDeliveries(cachedData);
      }
    }
  }, [selectedDate, selectedChatId, chatTitle]); // Убираем loadAcceptedDeliveries из зависимостей

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
    console.log('🔄 [ItemsTable] Переключение поставщика:', supplier);
    const wasCollapsed = collapsedSuppliersRef.current.has(supplier);
    if (wasCollapsed) {
      collapsedSuppliersRef.current.delete(supplier);
      console.log('📂 [ItemsTable] Разворачиваем:', supplier);
    } else {
      collapsedSuppliersRef.current.add(supplier);
      console.log('📁 [ItemsTable] Сворачиваем:', supplier);
    }
    console.log('🔄 [ItemsTable] Новое состояние collapsedSuppliers:', Array.from(collapsedSuppliersRef.current));
    // Принудительно обновляем компонент
    forceUpdate({});
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

  if (!items || items.length === 0) {
  return (
      <TableContainer>
        <motion.div variants={headerVariants}>
          <TableHeader $isExpanded={isCalendarExpanded}>
            <HeaderTopRow>
              <HeaderLeftSection>
                <CalendarGroup>
                  <CalendarIcon size={24} selectedDate={selectedDate} />
                  <CalendarToggleIndicator onClick={toggleCalendar}>
                    <span>{isCalendarExpanded ? 'Скрыть' : 'Показать'}</span>
                    <ChevronDownIcon isExpanded={isCalendarExpanded} />
                  </CalendarToggleIndicator>
                </CalendarGroup>
              </HeaderLeftSection>
            </HeaderTopRow>
            
            {/* Интегрированный календарь прямо в хедере */}
            <AnimatePresence>
              {isCalendarExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}
                >
                  <SupplyCalendar
                    selectedDate={new Date(selectedDate || new Date().toISOString().split('T')[0])}
                    onDateChange={(newDate) => {
                      // Исправляем проблему с UTC - используем локальное время
                      const year = newDate.getFullYear();
                      const month = String(newDate.getMonth() + 1).padStart(2, '0');
                      const day = String(newDate.getDate()).padStart(2, '0');
                      const localDateString = `${year}-${month}-${day}`;
                      onDateChange?.(localDateString);
                    }}
                    deliveries={deliveryData}
                    onMonthChange={onMonthChange}
                    isExpanded={true}
                    onToggleExpanded={() => {}}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </TableHeader>
        </motion.div>
        
        <EmptyState>
          <EmptyIcon>
            {deliveryCheck.isValidDay ? '📭' : '📅'}
          </EmptyIcon>
          <EmptyText>
            {deliveryCheck.isValidDay 
              ? 'На выбранную дату поставок нет' 
              : 'Поставки принимаются только в понедельник, среду и пятницу'
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <TableContainer>
        <motion.div variants={headerVariants}>
          <TableHeader $isExpanded={isCalendarExpanded}>
            <HeaderTopRow>
              <HeaderLeftSection>
                  <TitleGroup>
                    <TitleRow>
                      <TableTitle>
                        {getSuppliesTextWithDate(selectedDate || new Date().toISOString().split('T')[0], totalSuppliers)}
                      </TableTitle>
                    </TitleRow>
                  </TitleGroup>
                <CalendarGroup>
                  <CalendarIcon size={24} selectedDate={selectedDate} />
                  <CalendarToggleIndicator onClick={toggleCalendar}>
                    <span>{isCalendarExpanded ? 'Скрыть' : 'Показать'}</span>
                    <ChevronDownIcon isExpanded={isCalendarExpanded} />
                  </CalendarToggleIndicator>
                </CalendarGroup>
              </HeaderLeftSection>
            </HeaderTopRow>
            
            {/* Интегрированный календарь прямо в хедере */}
            <AnimatePresence>
              {isCalendarExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}
                >
                  <SupplyCalendar
                    selectedDate={new Date(selectedDate || new Date().toISOString().split('T')[0])}
                    onDateChange={(newDate) => {
                      // Исправляем проблему с UTC - используем локальное время
                      const year = newDate.getFullYear();
                      const month = String(newDate.getMonth() + 1).padStart(2, '0');
                      const day = String(newDate.getDate()).padStart(2, '0');
                      const localDateString = `${year}-${month}-${day}`;
                      onDateChange?.(localDateString);
                    }}
                    deliveries={deliveryData}
                    onMonthChange={onMonthChange}
                    isExpanded={true}
                    onToggleExpanded={() => {}}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </TableHeader>
        </motion.div>
      
      <ScrollArea>
        <CardsContainer>
          {/* Показываем товары для всех типов поставок */}
          {true && (
            <AnimatePresence>
              {supplierGroups.map((group, groupIndex) => {
              const isCollapsed = collapsedSuppliersRef.current.has(group.supplier);
              const isAccepted = acceptedDeliveries.has(group.supplier);
              
              console.log('🎯 [ItemsTable] Рендер карточки:', {
                supplier: group.supplier,
                isCollapsed,
                isAccepted,
                collapsedSuppliers: Array.from(collapsedSuppliersRef.current),
                itemsCount: group.items.length
              });
              
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
          )}
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


