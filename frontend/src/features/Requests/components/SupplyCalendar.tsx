import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { isDeliveryDay } from '@shared/utils/dateUtils';

// 🎨 Брендовые SVG иконки
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
      d="M16 3V7M8 3V7M4 11H20" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronLeftIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M15 18L9 12L15 6" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M9 18L15 12L9 6" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const BoxIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M21 8C21 8 17 6 12 6C7 6 3 8 3 8L12 13L21 8Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M3 8V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18V8" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const EmptyCalendarIconSVG = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M9 14H15M9 18H15" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// 🎨 Стили
const CalendarContainer = styled(motion.div)<{ $isInHeader?: boolean }>`
  background: ${props => props.$isInHeader ? 'transparent' : 'var(--card-background)'};
  border-radius: ${props => props.$isInHeader ? '0' : 'var(--radius-lg)'};
  max-width: 380px;
  margin: ${props => props.$isInHeader ? '0' : '0 auto'};
  overflow: hidden;
  
  @media (max-width: 768px) {
    max-width: 100%;
    margin: 0;
  }
`;

const CalendarHeader = styled.div`
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: linear-gradient(135deg, var(--card-background), rgba(var(--primary-rgb), 0.02));
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease;
  
  @media (max-width: 768px) {
    padding: 12px 16px;
  }
  
  &:hover {
    background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), rgba(var(--primary-rgb), 0.02));
  }
`;

const CalendarTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.95rem;
`;

const CalendarToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 0.85rem;
`;

const CalendarContent = styled(motion.div)`
  padding: 16px 20px 20px;
  
  @media (max-width: 768px) {
    padding: 12px 16px 16px;
  }
`;

const MonthYear = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-color);
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 16px;
  }
`;

const NavigationButton = styled(motion.button)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(var(--primary-rgb), 0.1);
  border-radius: var(--radius);
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
  }
  
  &:hover {
    background: rgba(var(--primary-rgb), 0.2);
    transform: scale(1.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const WeekDays = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 12px;
`;

const WeekDay = styled.div`
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 8px 4px;
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
`;

const DayButton = styled(motion.button)<{
  $isCurrentMonth: boolean;
  $isToday: boolean;
  $isSelected: boolean;
  $hasDeliveries: boolean;
  $deliveryCount: number;
  $isDeliveryDayOfWeek: boolean;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 6px;
  overflow: visible;
  
  @media (max-width: 768px) {
    min-height: 36px;
    font-size: 0.8rem;
    padding: 4px;
  }
  
  /* Базовые цвета */
  background: ${props => {
    if (props.$isSelected) return 'var(--primary-color)';
    if (props.$isToday) return 'rgba(var(--primary-rgb), 0.1)';
    if (props.$hasDeliveries) return 'rgba(var(--success-rgb), 0.1)';
    if (props.$isDeliveryDayOfWeek && props.$isCurrentMonth) return 'rgba(var(--primary-rgb), 0.05)';
    return 'transparent';
  }};
  
  color: ${props => {
    if (props.$isSelected) return 'white';
    if (props.$isCurrentMonth) return 'var(--text-color)';
    return 'var(--text-secondary)';
  }};
  
  border: ${props => {
    if (props.$isSelected) return '2px solid var(--primary-color)';
    if (props.$isToday) return '2px solid var(--primary-color)';
    if (props.$hasDeliveries) return '2px solid var(--success-color)';
    if (props.$isDeliveryDayOfWeek && props.$isCurrentMonth) return '2px solid var(--primary-color)';
    return '2px solid transparent';
  }};
  
  &:hover {
    background: ${props => {
      if (props.$isSelected) return 'var(--primary-color)';
      if (props.$hasDeliveries) return 'rgba(var(--success-rgb), 0.2)';
      if (props.$isDeliveryDayOfWeek && props.$isCurrentMonth) return 'rgba(var(--primary-rgb), 0.15)';
      return 'rgba(var(--primary-rgb), 0.1)';
    }};
    transform: scale(1.05);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
  }
`;

const DeliveryIndicator = styled(motion.div)`
  position: absolute;
  top: -3px;
  right: -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  background: linear-gradient(135deg, var(--primary-color), #f97316);
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  box-shadow: 
    0 2px 8px rgba(var(--primary-rgb), 0.3),
    0 0 0 1px rgba(var(--primary-rgb), 0.1);
  z-index: 6;
  
  @media (max-width: 768px) {
    min-width: 16px;
    height: 16px;
    font-size: 0.65rem;
    top: -2px;
    right: -2px;
  }
  
  /* Добавляем тонкое внутреннее свечение */
  &::before {
    content: '';
    position: absolute;
    top: 1px;
    left: 1px;
    right: 1px;
    bottom: 1px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
    border-radius: 50%;
    pointer-events: none;
  }
`;

const DeliveryTooltip = styled(motion.div)`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-size: 0.8rem;
  color: var(--text-color);
  box-shadow: var(--shadow-md);
  z-index: 10;
  white-space: nowrap;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: var(--card-background);
  }
`;

// 🎨 Стили для легенды
const CalendarLegend = styled.div`
  margin-top: 12px;
  padding: 10px;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
`;

const LegendTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
`;

const LegendItems = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const LegendDot = styled.div<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$color};
  border: 1px solid ${props => props.$color};
`;

const LegendDotBorder = styled.div<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: transparent;
  border: 2px solid ${props => props.$color};
`;

const LegendText = styled.div`
  font-size: 0.7rem;
  color: var(--text-secondary);
`;

// 🎨 Стили для сообщения о пустом календаре
const EmptyCalendarMessage = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.02), rgba(var(--primary-rgb), 0.05));
  border-radius: var(--radius-lg);
  border: 1px dashed rgba(var(--primary-rgb), 0.2);
`;

const EmptyCalendarIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(var(--primary-rgb), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--primary-color);
`;

const EmptyCalendarTitle = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
`;

const EmptyCalendarText = styled.div`
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.4;
  max-width: 280px;
`;

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

// 📅 Интерфейсы
interface DeliveryData {
  date: string;
  count: number;
  suppliers: string[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasDeliveries: boolean;
  deliveryCount: number;
  isDeliveryDayOfWeek: boolean;
  suppliers: string[];
}

interface Props {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  deliveries: DeliveryData[];
  onMonthChange?: (month: Date) => void; // Функция для загрузки данных при смене месяца
  className?: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

// 🗓️ Компонент календаря
const SupplyCalendar: React.FC<Props> = ({ 
  selectedDate, 
  onDateChange, 
  deliveries, 
  onMonthChange,
  className,
  isExpanded = false,
  onToggleExpanded
}) => {
  
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // 📊 Получаем данные о поставках для текущего месяца
  const getDeliveriesForMonth = (month: Date) => {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const filteredDeliveries = deliveries.filter(delivery => 
      delivery.date.startsWith(monthKey)
    );
    
    return filteredDeliveries;
  };

  // 📅 Генерируем дни месяца
  const generateDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    
    // Исправляем начало недели - в России неделя начинается с понедельника
    const firstDayOfWeek = firstDay.getDay();
    const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Воскресенье = 6 дней назад, остальные = день-1
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    const days = [];
    const today = new Date();
    
    // Получаем строку выбранной даты для сравнения (локальное время)
    const selectedDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.toDateString() === today.toDateString();
      
      // Исправляем сравнение дат - используем локальное время
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const isSelected = dateString === selectedDateString;
      
      const dayDeliveries = deliveries.find(d => d.date === dateString);
      const hasDeliveries = !!dayDeliveries;
      const deliveryCount = dayDeliveries?.count || 0;
      
      // 🚀 ОПТИМИЗАЦИЯ: Определяем является ли день днем поставки
      const isDeliveryDayOfWeek = isDeliveryDay(date);
      
      // 🔍 ДЕБАГ: Логируем дни с поставками
      if (hasDeliveries) {
        console.log('📦 [SupplyCalendar] День с поставками:', {
          date: dateString,
          count: deliveryCount,
          suppliers: dayDeliveries?.suppliers,
          isDeliveryDay: isDeliveryDayOfWeek
        });
      }
      
      days.push({
        date,
        isCurrentMonth,
        isToday,
        isSelected,
        hasDeliveries,
        deliveryCount,
        isDeliveryDayOfWeek,
        suppliers: dayDeliveries?.suppliers || []
      });
    }
    
    return days;
  };

  // 🔄 Навигация по месяцам
  const goToPreviousMonth = (e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие события
    console.log('📅 [SupplyCalendar] Переключение на предыдущий месяц');
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
    
    // 🚀 ОПТИМИЗАЦИЯ: Загружаем данные для нового месяца
    if (onMonthChange) {
      onMonthChange(newMonth);
    }
  };

  const goToNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие события
    console.log('📅 [SupplyCalendar] Переключение на следующий месяц');
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
    
    // 🚀 ОПТИМИЗАЦИЯ: Загружаем данные для нового месяца
    if (onMonthChange) {
      onMonthChange(newMonth);
    }
  };

  // 📅 Обработка выбора дня
  const handleDayClick = (day: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие события
    if (day.isCurrentMonth) {
      onDateChange(day.date);
      // Сворачиваем календарь после выбора даты
      onToggleExpanded?.();
    }
  };

  // 📊 Получаем название месяца
  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const days = generateDays();
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  


  return (
    <CalendarContainer
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <CalendarHeader>
        <CalendarTitle>
          <CalendarIcon size={16} />
          Выбор даты поставки
        </CalendarTitle>
      </CalendarHeader>

      <AnimatePresence>
        {isExpanded && (
          <CalendarContent
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <NavigationButton
                onClick={goToPreviousMonth}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeftIcon size={16} />
              </NavigationButton>
              
              <MonthYear>
                <CalendarIcon size={18} />
                {getMonthName(currentMonth)}
              </MonthYear>
              
              <NavigationButton
                onClick={goToNextMonth}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronRightIcon size={16} />
              </NavigationButton>
            </div>

            <WeekDays>
              {weekDays.map(day => (
                <WeekDay key={day}>{day}</WeekDay>
              ))}
            </WeekDays>

            {/* 🔍 Проверяем, есть ли данные для текущего месяца */}
            {getDeliveriesForMonth(currentMonth).length === 0 ? (
              <EmptyCalendarMessage
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <EmptyCalendarIcon>
                  <EmptyCalendarIconSVG size={24} />
                </EmptyCalendarIcon>
                <EmptyCalendarTitle>
                  Поставки не запланированы
                </EmptyCalendarTitle>
                <EmptyCalendarText>
                  Для {getMonthName(currentMonth)} поставки еще не созданы.
                </EmptyCalendarText>
              </EmptyCalendarMessage>
            ) : (
              <>
                <CalendarGrid>
                  {days.map((day, index) => (
                    <DayButton
                      key={index}
                      $isCurrentMonth={day.isCurrentMonth}
                      $isToday={day.isToday}
                      $isSelected={day.isSelected}
                      $hasDeliveries={day.hasDeliveries}
                      $deliveryCount={day.deliveryCount}
                      $isDeliveryDayOfWeek={day.isDeliveryDayOfWeek}
                      onClick={(e) => handleDayClick(day, e)}
                      onMouseEnter={() => setHoveredDay(index)}
                      onMouseLeave={() => setHoveredDay(null)}
                      disabled={!day.isCurrentMonth}
                      whileHover={{ scale: day.isCurrentMonth ? 1.05 : 1 }}
                      whileTap={{ scale: day.isCurrentMonth ? 0.95 : 1 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.01 }}
                    >
                      {day.date.getDate()}
                      
                      {day.hasDeliveries && (
                        <DeliveryIndicator
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.01 + 0.1 }}
                        >
                          {day.deliveryCount}
                        </DeliveryIndicator>
                      )}
                      
                      <AnimatePresence>
                        {hoveredDay === index && day.hasDeliveries && (
                          <DeliveryTooltip
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                          >
                            <BoxIcon size={12} />
                            {day.deliveryCount} поставок
                            {day.suppliers.length > 0 && (
                              <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                {day.suppliers.slice(0, 2).join(', ')}
                                {day.suppliers.length > 2 && ` +${day.suppliers.length - 2}`}
                              </div>
                            )}
                          </DeliveryTooltip>
                        )}
                      </AnimatePresence>
                    </DayButton>
                  ))}
                </CalendarGrid>

                {/* 🎨 Легенда календаря */}
                <CalendarLegend>
                  <LegendTitle>Обозначения:</LegendTitle>
                  <LegendItems>
                    <LegendItem>
                      <LegendDotBorder $color="var(--primary-color)" />
                      <LegendText>Дни поставок (пн, ср, пт)</LegendText>
                    </LegendItem>
                    <LegendItem>
                      <LegendDot $color="var(--success-color)" />
                      <LegendText>Есть поставки</LegendText>
                    </LegendItem>
                    <LegendItem>
                      <LegendDot $color="var(--text-secondary)" />
                      <LegendText>Нет поставок</LegendText>
                    </LegendItem>
                  </LegendItems>
                </CalendarLegend>
              </>
            )}
          </CalendarContent>
        )}
      </AnimatePresence>
    </CalendarContainer>
  );
};

export default SupplyCalendar;
