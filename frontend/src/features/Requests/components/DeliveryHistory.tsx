import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { getDeliveries, DeliveryResponse } from '../services/requestsApi';

// 🎨 Брендовые SVG иконки
const SupplierIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M7 21L7 8L21 8V21C21 21.5523 20.5523 22 20 22L8 22C7.44772 22 7 21.5523 7 21Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 8V6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M12 8V6" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle cx="10" cy="14" r="1" fill="currentColor"/>
    <circle cx="14" cy="14" r="1" fill="currentColor"/>
    <circle cx="10" cy="18" r="1" fill="currentColor"/>
    <circle cx="14" cy="18" r="1" fill="currentColor"/>
  </svg>
);

const CalendarIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M4 7C4 5.89543 4.89543 5 6 5H18C19.1046 5 20 5.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V7Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M16 3V7" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M8 3V7" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M4 11H20" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle 
      cx="11" 
      cy="11" 
      r="8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="m21 21-4.35-4.35" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const CleanIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M3 6H21" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ListIcon = ({ size = 16 }: { size?: number }) => (
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

const BoxIcon = ({ size = 16 }: { size?: number }) => (
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

const EmptyIcon = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M3 7V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V7" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V7" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle 
      cx="12" 
      cy="13" 
      r="3" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeDasharray="2 2"
    />
  </svg>
);

const CheckIcon = ({ size = 16 }: { size?: number }) => (
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

const Container = styled(motion.div)`
  padding: 0;
  background: transparent;
`;

const FiltersContainer = styled.div`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
`;

const FilterInput = styled.input`
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 0.9rem;
  background: var(--card-background);
  color: var(--text-color);
  min-width: 200px;
  flex: 1;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }
  
  &::placeholder {
    color: var(--text-secondary);
  }
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 0.9rem;
  background: var(--card-background);
  color: var(--text-color);
  min-width: 200px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }
  
  option {
    background: var(--card-background);
    color: var(--text-color);
  }
`;

const FilterDateInput = styled.input`
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 0.9rem;
  background: var(--card-background);
  color: var(--text-color);
  min-width: 150px;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }
  
  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    filter: invert(0.5);
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FilterLabel = styled.label`
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
`;

const FiltersRow = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: end;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: end;
`;

const ClearButton = styled.button`
  padding: 8px 16px;
  background: var(--gray-100);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background: var(--gray-200);
    color: var(--text-color);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ResultsInfo = styled.div`
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(var(--primary-rgb), 0.05);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: var(--radius);
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid var(--gray-200);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const DeliveriesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
`;

const DeliveryCard = styled(motion.div)`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
  transition: all var(--transition-normal);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
`;

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

const StatusBadge = styled.span<{ $status: string }>`
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

const AcceptedBy = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--primary-rgb), 0.05);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary-color);
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
`;

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

// Стили для развернутого контента с товарами
const ExpandedContent = styled(motion.div)`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
`;

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

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ItemRow = styled.div`
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
  }
  
  .item-details {
    display: flex;
    gap: 12px;
    color: var(--text-secondary);
    font-size: 0.8rem;
  }
`;

const ItemBadge = styled.span<{ $type: 'quantity' | 'unit' | 'checked' }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  
  ${props => {
    if (props.$type === 'checked') {
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

// SVG компонент для стрелки разворачивания
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

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  
  .icon {
    margin-bottom: 16px;
    opacity: 0.6;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      transition: all 0.3s ease;
    }
    
    &:hover svg {
      opacity: 0.8;
      transform: scale(1.05);
    }
  }
  
  .message {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-color);
    margin-bottom: 8px;
  }
  
  .hint {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-top: 8px;
  }
`;

interface Props {
  selectedChatId?: string | null;
  chatTitle?: string;
}

const DeliveryHistory: React.FC<Props> = ({ selectedChatId, chatTitle }) => {
  const [deliveries, setDeliveries] = useState<DeliveryResponse[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<DeliveryResponse[]>([]); // Все поставки для фильтрации
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]); // Список поставщиков
  const [filters, setFilters] = useState({
    supplier: '',
    dateFrom: '',
    dateTo: ''
  });

  // 🔍 Логи для отладки состояния компонента
  console.log('📋 [DeliveryHistory] Рендер компонента:', {
    selectedChatId,
    chatTitle,
    deliveriesCount: deliveries.length,
    loading,
    error,
    filters
  });

  const loadData = async () => {
    console.log('🔄 [DeliveryHistory] Начинаем загрузку истории поставок...');
    
    try {
      setLoading(true);
      setError(null);

      // Загружаем все поставки для выбранного филиала без фильтров
      const filtersToApply = {
        branch: chatTitle || undefined, // Только фильтр по филиалу
        include_stats: false,
        size: 100 // Максимально допустимое значение по API
      };

      console.log('📡 [DeliveryHistory] Применяем фильтры:', filtersToApply);

      const response = await getDeliveries(filtersToApply);
      
      console.log('✅ [DeliveryHistory] Получены данные с сервера:', {
        deliveriesCount: response.deliveries.length,
        totalAvailable: response.total,
        branch: chatTitle
      });

      // Предупреждение если записей больше чем загружено
      if (response.total > response.deliveries.length) {
        console.warn(`⚠️ [DeliveryHistory] Показано ${response.deliveries.length} из ${response.total} поставок. Для загрузки всех записей требуется пагинация.`);
      }

      // Фильтрация на клиенте для точного соответствия филиала
      const branchFilteredDeliveries = response.deliveries.filter(delivery => 
        !chatTitle || delivery.branch === chatTitle
      );

      console.log('🎯 [DeliveryHistory] После фильтрации по филиалу:', {
        originalCount: response.deliveries.length,
        filteredCount: branchFilteredDeliveries.length,
        targetBranch: chatTitle
      });

      setAllDeliveries(branchFilteredDeliveries);
      
      // Извлекаем уникальных поставщиков
      const suppliers = Array.from(new Set(
        branchFilteredDeliveries.map(delivery => delivery.supplier)
      )).sort();
      
      console.log('📋 [DeliveryHistory] Найдены поставщики:', suppliers);
      setAvailableSuppliers(suppliers);
      
      // Применяем клиентские фильтры
      applyClientFilters(branchFilteredDeliveries);
      
    } catch (err) {
      console.error('❌ [DeliveryHistory] Ошибка при загрузке:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Функция для применения фильтров на клиенте
  const applyClientFilters = (deliveriesToFilter: DeliveryResponse[] = allDeliveries) => {
    console.log('🔧 [DeliveryHistory] Применяем клиентские фильтры:', filters);
    
    let filtered = deliveriesToFilter;

    // Фильтр по поставщику
    if (filters.supplier) {
      filtered = filtered.filter(delivery => 
        delivery.supplier === filters.supplier
      );
    }

    // Фильтр по дате "с"
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(delivery => 
        new Date(delivery.delivery_date) >= fromDate
      );
    }

    // Фильтр по дате "по"
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Включаем весь день
      filtered = filtered.filter(delivery => 
        new Date(delivery.delivery_date) <= toDate
      );
    }

    console.log('✅ [DeliveryHistory] Результат фильтрации:', {
      original: deliveriesToFilter.length,
      filtered: filtered.length,
      filters
    });

    setDeliveries(filtered);
  };

  useEffect(() => {
    console.log('🔄 [DeliveryHistory] useEffect triggered:', { selectedChatId, chatTitle });
    if (chatTitle) { // Загружаем данные только если есть выбранный филиал
      loadData();
    }
  }, [selectedChatId, chatTitle]); // Убираем зависимость от фильтров

  // ⚡ Применяем клиентские фильтры при их изменении
  useEffect(() => {
    if (allDeliveries.length > 0) {
      applyClientFilters();
    }
  }, [filters]); // Реагируем только на изменения фильтров

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    console.log(`🔧 [DeliveryHistory] Изменен фильтр ${key}:`, value);
    setFilters(prev => ({ ...prev, [key]: value }));
    // applyClientFilters будет вызван автоматически через useEffect
  };

  // 🧹 Функция для сброса фильтров
  const clearFilters = () => {
    console.log('🧹 [DeliveryHistory] Сброс фильтров');
    setFilters({
      supplier: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  // 🔄 Функция для разворачивания/сворачивания карточки
  const toggleCardExpansion = (deliveryId: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deliveryId)) {
        newSet.delete(deliveryId);
      } else {
        newSet.add(deliveryId);
      }
      console.log(`🔧 [DeliveryHistory] Карточка ${deliveryId} ${newSet.has(deliveryId) ? 'развернута' : 'свернута'}`);
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Если филиал не выбран, показываем сообщение
  if (!chatTitle) {
    return (
      <Container>
        <EmptyState>
          <div className="icon">🏪</div>
          <div className="message">Выберите филиал для просмотра истории поставок</div>
        </EmptyState>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
        </LoadingContainer>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <EmptyState>
          <div className="icon">❌</div>
          <div className="message">{error}</div>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <FiltersContainer>
        <FiltersRow>
          <FilterGroup>
            <FilterLabel>
              <SupplierIcon size={16} />
              Поставщик
            </FilterLabel>
            <FilterSelect
              value={filters.supplier}
              onChange={(e) => handleFilterChange('supplier', e.target.value)}
            >
              <option value="">Все поставщики</option>
              {availableSuppliers.map(supplier => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </FilterSelect>
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>
              <CalendarIcon size={16} />
              Дата с
            </FilterLabel>
            <FilterDateInput
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>
              <CalendarIcon size={16} />
              Дата по
            </FilterLabel>
            <FilterDateInput
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </FilterGroup>

          <FilterActions>
            <ClearButton onClick={clearFilters}>
              <CleanIcon size={16} />
              Сбросить
            </ClearButton>
          </FilterActions>
        </FiltersRow>

        <ResultsInfo>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ListIcon size={16} />
            Найдено поставок: <strong>{deliveries.length}</strong> из <strong>{allDeliveries.length}</strong>
          </span>
          {(filters.supplier || filters.dateFrom || filters.dateTo) && (
            <span style={{ 
              color: 'var(--primary-color)', 
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <SearchIcon size={14} />
              Фильтры активны
            </span>
          )}
        </ResultsInfo>
      </FiltersContainer>

      {deliveries.length === 0 ? (
        <EmptyState>
          <div className="icon">
            <EmptyIcon size={64} />
          </div>
          <div className="message">Поставки не найдены</div>
        </EmptyState>
      ) : (
        <DeliveriesGrid>
          <AnimatePresence>
            {deliveries.map((delivery, index) => {
              const isExpanded = expandedCards.has(delivery.id);
              
              return (
                <DeliveryCard
                  key={delivery.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  layout
                >
                  <CardHeader>
                    <SupplierName>{delivery.supplier}</SupplierName>
                    <ExpandButton
                      onClick={() => toggleCardExpansion(delivery.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronDownIcon isExpanded={isExpanded} />
                    </ExpandButton>
                    <StatusBadge $status={delivery.status}>
                      {delivery.status === 'accepted' ? 'Принято' : delivery.status}
                    </StatusBadge>
                  </CardHeader>

                <CardDetails>
                  {delivery.branch && (
                    <DetailRow>
                      <span className="label">Филиал:</span>
                      <span className="value">{delivery.branch}</span>
                    </DetailRow>
                  )}
                  <DetailRow>
                    <span className="label">Дата поставки:</span>
                    <span className="value">
                      {new Date(delivery.delivery_date).toLocaleDateString('ru-RU')}
                    </span>
                  </DetailRow>
                  <DetailRow>
                    <span className="label">Товаров:</span>
                    <span className="value">
                      {delivery.checked_items} из {delivery.total_items}
                    </span>
                  </DetailRow>
                </CardDetails>

                <AcceptedBy>
                  <UserAvatar>{delivery.accepted_by_initials}</UserAvatar>
                  <UserInfo>
                    <div className="name">{delivery.accepted_by_name}</div>
                    <div className="date">Принял {formatDate(delivery.accepted_at)}</div>
                  </UserInfo>
                </AcceptedBy>

                {/* Развернутый контент с товарами */}
                <AnimatePresence>
                  {isExpanded && (
                    <ExpandedContent
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                <ItemsTitle>
                  <BoxIcon size={18} />
                  Принятые товары ({delivery.items?.length || 0})
                </ItemsTitle>
                      
                      {delivery.items && delivery.items.length > 0 ? (
                        <ItemsList>
                          {delivery.items.map((item, itemIndex) => (
                            <ItemRow key={itemIndex}>
                              <div className="item-name">{item.name}</div>
                              <div className="item-details">
                                {item.quantity && (
                                  <ItemBadge $type="quantity">
                                    {item.quantity} {item.unit || 'шт'}
                                  </ItemBadge>
                                )}
                          {item.is_checked && (
                            <ItemBadge $type="checked">
                              <CheckIcon size={12} />
                              Принято
                            </ItemBadge>
                          )}
                              </div>
                            </ItemRow>
                          ))}
                        </ItemsList>
                      ) : (
                        <div style={{ 
                          color: 'var(--text-secondary)', 
                          textAlign: 'center', 
                          padding: '16px',
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                          <ListIcon size={16} />
                          Список товаров не доступен
                        </div>
                      )}
                    </ExpandedContent>
                  )}
                </AnimatePresence>
              </DeliveryCard>
              );
            })}
          </AnimatePresence>
        </DeliveriesGrid>
      )}
    </Container>
  );
};

export default DeliveryHistory;
