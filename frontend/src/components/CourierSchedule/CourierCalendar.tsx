import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import format from 'date-fns/format';
import { ru } from 'date-fns/locale';
import ShiftSelectionDialog from './ShiftSelectionDialog';
import { useDispatch, useSelector } from 'react-redux';
import { 
    fetchShifts, 
    selectAllShifts, 
    selectIsLoading,
    selectError,
    subscribeToShiftEvents,
    unsubscribeFromShiftEvents,
    bookShift
} from '../../store/slices/shiftsSlice';
import { 
    addToReserve, 
    removeFromReserve, 
    selectAllReserves,
    forceFetchReserves
} from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import store from '../../store/store';

interface CourierShift {
    userId: string;
    photo_url?: string;
    firstName: string;
    lastName: string;
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
}

interface CourierCalendarProps {
    onShiftSelect: (date: Date, shiftType: 'day' | 'night', slotIndex: number) => void;
    selectedDate?: Date;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onClose: () => void;
}

const CalendarContainer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card-background);
    z-index: 1000;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    -webkit-overflow-scrolling: touch;
    max-width: 100vw;
`;

const CalendarHeader = styled.div`
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    background: var(--card-background);
    border-bottom: 1px solid var(--border-color);
    z-index: 2;
    width: 100%;
`;

const HeaderTop = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    width: 100%;
`;

const SlotsContainer = styled.div`
    position: relative;
    width: 100%;
    background-color: var(--background-secondary);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    
    /* Показываем скроллбар */
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color) transparent;
    
    /* Стили для Webkit (Chrome, Safari, etc) */
    &::-webkit-scrollbar {
        display: block;
        height: 3px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
        border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
        background-color: var(--primary-color);
        border-radius: 3px;
        
        &:hover {
            background-color: var(--primary-hover);
        }
    }
`;

const MonthsContainer = styled.div`
    flex: 1;
    padding: 8px;
    max-width: 100%;
    margin: 0 auto;
    width: 100%;
    overflow-x: hidden;
    
    @media (min-width: 768px) {
        padding: 12px;
        max-width: 480px;
    }
`;

const SlotsInfo = styled.div`
    display: inline-flex;
    padding: 12px 16px;
    gap: 8px;
    min-width: min-content;
    width: auto;
`;

const DaySlots = styled.div`
    text-align: center;
    flex: 0 0 80px;
    position: relative;
    cursor: pointer;
    padding: 8px 4px;
    border-radius: var(--radius);
    transition: background-color 0.2s;

    &:hover {
        background-color: var(--hover-color);
    }
`;

const MonthSection = styled.div`
    margin-bottom: 32px;
    max-width: 100%;
    overflow: hidden;
    
    @media (max-width: 480px) {
        margin-bottom: 24px;
    }
`;

const MonthTitle = styled.h2`
    margin: 0 0 16px 0;
    color: var(--text-color);
    font-size: 1.2rem;
    text-align: center;
    
    @media (max-width: 480px) {
        font-size: 1.1rem;
        margin: 0 0 12px 0;
    }
`;

const WeekDaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 4px;
    text-align: center;
    max-width: 100%;
    padding: 0 4px;
    
    @media (max-width: 480px) {
        gap: 1px;
        padding: 0 2px;
    }
`;

const WeekDay = styled.div`
    color: var(--text-secondary);
    font-size: 0.8rem;
    padding: 4px 0;
`;

const DaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin: 0 auto;
    max-width: 100%;
    padding: 0 4px;
    
    @media (max-width: 480px) {
        gap: 1px;
        padding: 0 2px;
    }
`;

const EmptySlotIndicator = styled.div`
    width: 95%;
    height: 95%;
    border-radius: 50%;
    border: 2px solid #4CAF50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(76, 175, 80, 0.05);
    position: relative;
    transition: all 0.3s ease;
    aspect-ratio: 1;

    &::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(76,175,80,0.05) 100%);
        opacity: 0.8;
    }

    &::after {
        content: '';
        position: absolute;
        width: calc(100% + 6px);
        height: calc(100% + 6px);
        border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: #4CAF50;
        border-right-color: #4CAF50;
        animation: rotate 2s linear infinite;
        opacity: 0.3;
        left: -3px;
        top: -3px;
    }

    @keyframes rotate {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    &:hover {
        transform: scale(1.05);
        box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
        
        &::after {
            opacity: 0.6;
        }
    }
`;

const OccupiedSlotIndicator = styled(EmptySlotIndicator)`
    border-color: #FF3B30;
    background: rgba(255, 59, 48, 0.05);

    &::before {
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255, 59, 48, 0.05) 100%);
    }

    &::after {
        border-top-color: #FF3B30;
        border-right-color: #FF3B30;
    }

    &:hover {
        box-shadow: 0 0 15px rgba(255, 59, 48, 0.3);
    }
`;

const CrossIcon = styled.div`
    color: #FF3B30;
    font-size: 1.2rem;
    font-weight: bold;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
`;

const DayCell = styled.div<{ 
    $isToday?: boolean; 
    $isSelected?: boolean; 
    $hasShifts?: boolean;
    $isAvailable?: boolean;
}>`
    aspect-ratio: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: var(--radius);
    padding: 2px;
    transition: all 0.2s ease;

    &:hover {
        background: var(--hover-color);
    }

    ${props => props.$isToday && `
        border: 2px solid var(--primary-color);
    `}

    ${props => props.$isSelected && `
        background: var(--primary-color);
        color: white;
    `}
`;

const CourierAvatar = styled.img`
    width: 95%;
    height: 95%;
    border-radius: 50%;
    object-fit: cover;
    transition: transform 0.2s ease;

    &:hover {
        transform: scale(1.05);
    }
`;

const DayNumber = styled.span<{ $isAvailable?: boolean }>`
    font-size: ${props => props.$isAvailable ? '1.1rem' : '1rem'};
    font-weight: ${props => props.$isAvailable ? '600' : 'normal'};
    color: ${props => props.$isAvailable ? '#4CAF50' : 'inherit'};
    position: relative;
    z-index: 1;
    line-height: 1;
`;

const AvatarsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1px;
    width: 95%;
    height: 95%;
    padding: 2px;
    position: relative;
`;

const AvatarWrapper = styled.div`
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid var(--primary-color);
    aspect-ratio: 1;
`;

const Avatar = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 8px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background: var(--hover-color);
    }
`;

const Title = styled.h1`
    margin: 0;
    color: var(--text-color);
    font-size: 1.5rem;
    text-align: center;
    
    @media (max-width: 480px) {
        font-size: 1.2rem;
    }
`;

const DayName = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
`;

const SlotCount = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
`;

const SlotBadge = styled.div`
    background-color: var(--primary-color);
    color: white;
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    min-width: 24px;
`;

const SlotDivider = styled.span`
    color: var(--text-secondary);
    font-weight: 500;
`;

const Tooltip = styled.div<{ $isVisible: boolean; $position: 'left' | 'center' | 'right' }>`
    position: fixed;
    bottom: auto;
    left: auto;
    right: auto;
    transform: none;
    background-color: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    width: max-content;
    opacity: ${props => props.$isVisible ? 1 : 0};
    visibility: ${props => props.$isVisible ? 'visible' : 'hidden'};
    transition: opacity 0.2s, visibility 0.2s;
    z-index: 1000;

    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: ${props => {
            if (props.$position === 'center') return '50%';
            if (props.$position === 'left') return '20%';
            return '80%';
        }};
        transform: translateX(-50%);
        border: 8px solid transparent;
        border-top-color: var(--border-color);
    }

    &::before {
        content: '';
        position: absolute;
        top: 100%;
        left: ${props => {
            if (props.$position === 'center') return '50%';
            if (props.$position === 'left') return '20%';
            return '80%';
        }};
        transform: translateX(-50%);
        border: 7px solid transparent;
        border-top-color: var(--card-background);
        z-index: 1;
    }
`;

const TooltipTitle = styled.div`
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-color);
`;

const TooltipRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    
    &:not(:last-child) {
        margin-bottom: 4px;
    }
`;

const ShiftIcon = styled.span`
    font-size: 1.1rem;
`;

const CourierCalendar: React.FC<CourierCalendarProps> = ({
    onShiftSelect,
    selectedDate,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onClose
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const shifts = useSelector((state: RootState) => state.shifts.shifts);
    const reserves = useSelector(selectAllReserves);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [tooltipDay, setTooltipDay] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const slotsContainerRef = useRef<HTMLDivElement>(null);
    const [hasShownScrollHint, setHasShownScrollHint] = useState(false);
    const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
    const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

    // Кэшируем функции обработчиков для предотвращения перерисовок
    const stableHandleShiftUpdated = useCallback((data: any) => {
        console.log('[CourierCalendar] WebSocket shift_updated:', data.id);
        // Не вызываем немедленное обновление UI, позволяем редуксу сделать это
    }, []);
    
    const stableHandleShiftBooked = useCallback((data: any) => {
        console.log('[CourierCalendar] WebSocket shift_booked:', data.id);
        // Не вызываем немедленное обновление UI, позволяем редуксу сделать это
    }, []);
    
    const stableHandleShiftCanceled = useCallback((data: any) => {
        console.log('[CourierCalendar] WebSocket shift_canceled:', data.id);
        // Не вызываем немедленное обновление UI, позволяем редуксу сделать это
    }, []);

    useEffect(() => {
        // Загружаем смены при монтировании компонента
        dispatch(fetchShifts());
        
        // Подписываемся на события WebSocket с стабильными обработчиками
        subscribeToShiftEvents(dispatch, {
            onShiftUpdated: stableHandleShiftUpdated,
            onShiftBooked: stableHandleShiftBooked,
            onShiftCanceled: stableHandleShiftCanceled
        });
        
        // Отписываемся при размонтировании
        return () => {
            unsubscribeFromShiftEvents();
        };
    }, [dispatch, stableHandleShiftUpdated, stableHandleShiftBooked, stableHandleShiftCanceled]);

    // Add a new useEffect hook to handle real-time updates
    useEffect(() => {
        // Используем debounce для плавного обновления без моргания
        // Вместо немедленного обновления, будем ждать небольшое время 
        // на случай, если придет несколько обновлений подряд
        const timer = setTimeout(() => {
            console.log('[CourierCalendar] Shifts have been updated, smoothly refreshing calendar UI');
            setLastUpdateTime(Date.now());
        }, 500); // Увеличиваем таймаут для большей плавности
        
        // Очищаем таймер при изменении зависимостей
        return () => clearTimeout(timer);
    }, [shifts]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const days = [];

        // Корректируем firstDayOfMonth для недели, начинающейся с понедельника
        const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        // Добавляем пустые ячейки в начало
        for (let i = 0; i < adjustedFirstDay; i++) {
            days.push(null);
        }

        // Добавляем дни месяца
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const getShiftsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return shifts.filter(shift => shift.date === dateStr);
    };

    const getDayShifts = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dateShifts = shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'day'
        );
        console.log(`[CourierCalendar] Day shifts for ${dateStr}:`, dateShifts);
        return dateShifts;
    };

    const getNightShifts = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dateShifts = shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'night'
        );
        console.log(`[CourierCalendar] Night shifts for ${dateStr}:`, dateShifts);
        return dateShifts;
    };

    const getReservesForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        // Получаем свежие данные прямо из Redux store
        const allCurrentReserves = selectAllReserves(store.getState());
        
        // Добавим детальное логирование
        console.log(`[CourierCalendar] All Redux reserves:`, allCurrentReserves);
        
        const filteredReserves = allCurrentReserves.filter(reserve => reserve.date === dateStr);
        console.log(`[CourierCalendar] Reserves for ${dateStr}:`, {
            totalReserves: allCurrentReserves.length,
            filteredReserves: filteredReserves.length,
            dateStr,
            reservesData: filteredReserves
        });
        return filteredReserves;
    };

    // Добавим функцию для проверки, есть ли у пользователя смена на данную дату
    const hasUserShift = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return shifts.some(shift => 
            shift.date === dateStr && 
            String(shift.userId) === String(currentUserId)
        );
    };

    const isToday = (date: Date) => {
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isSelected = (date: Date) => {
        if (!date || !selectedDate) return false;
        return date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear();
    };

    const isDateAvailable = (date: Date) => {
        if (!date) return false;
        
        const today = new Date();
        const thursday = new Date(today);
        const daysUntilThursday = (4 - today.getDay() + 7) % 7;
        thursday.setDate(today.getDate() + daysUntilThursday);
        
        const nextThursday = new Date(thursday);
        nextThursday.setDate(thursday.getDate() + 7);
        
        return date >= thursday && date < nextThursday;
    };

    const months = [
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 4, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 5, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 6, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 7, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 8, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 9, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 10, 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 11, 1)
    ];

    // Обновленная функция для позиционирования тултипа
    const handleDayMouseEnter = (event: React.MouseEvent<HTMLDivElement>, day: string) => {
        const element = event.currentTarget;
        const rect = element.getBoundingClientRect();
        const tooltipWidth = 200; // Примерная ширина тултипа
        
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        
        // Проверяем, не выходит ли тултип за пределы экрана
        if (left < 16) {
            left = 16; // Минимальный отступ слева
        } else if (left + tooltipWidth > window.innerWidth - 16) {
            left = window.innerWidth - tooltipWidth - 16; // Минимальный отступ справа
        }

        setTooltipPosition({
            top: rect.top - 8, // Позиционируем над элементом
            left: left
        });
        setTooltipDay(day);
    };

    // Функция для анимации скролла
    const showScrollHint = () => {
        if (!slotsContainerRef.current || hasShownScrollHint) return;

        const container = slotsContainerRef.current;
        const scrollWidth = container.scrollWidth - container.clientWidth;

        // Задержка перед началом анимации
        setTimeout(() => {
            // Плавная прокрутка вправо (2 секунды)
            container.scrollTo({ 
                left: scrollWidth, 
                behavior: 'smooth' 
            });
            
            // Пауза в конечной позиции (1 секунда)
            setTimeout(() => {
                // Плавная прокрутка обратно (2 секунды)
                container.scrollTo({ 
                    left: 0, 
                    behavior: 'smooth' 
                });
                setHasShownScrollHint(true);
            }, 2000); // Ждем 2 секунды перед возвратом
        }, 1000); // Начинаем через 1 секунду после монтирования
    };

    // Показываем подсказку при монтировании
    useEffect(() => {
        showScrollHint();
    }, []);

    const handleDayClick = (date: Date) => {
        // Если дата уже выбрана, не делаем ничего
        if (selectedDateForDialog && 
            format(selectedDateForDialog, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
            console.log(`[CourierCalendar] Day already selected: ${format(date, 'yyyy-MM-dd')}`);
            return;
        }
        
        console.log(`[CourierCalendar] Day clicked: ${format(date, 'yyyy-MM-dd')}`);
        
        // Проверяем, есть ли у пользователя смена на эту дату
        const userHasShift = hasUserShift(date);
        console.log(`[CourierCalendar] User has shift on this date: ${userHasShift}`);
        
        // Отображаем все смены на эту дату для отладки
        const dayShifts = getDayShifts(date);
        const nightShifts = getNightShifts(date);
        console.log(`[CourierCalendar] Opening dialog with ${dayShifts.length} day shifts and ${nightShifts.length} night shifts`);
        
        // Если дата доступна для бронирования, открываем диалог
        if (isDateAvailable(date)) {
            setSelectedDateForDialog(date);
        }
    };

    const handleShiftSelect = async (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => {
        if (!selectedDateForDialog) return;
        
        try {
            const dateString = format(selectedDateForDialog, 'yyyy-MM-dd');
            
            // Дополнительная проверка существующего ID смены
            let validShiftId = existingShiftId;
            
            // Если передан existingShiftId, проверяем, действительно ли такая смена есть в Redux
            if (existingShiftId) {
                const shiftsFromRedux = shifts;
                const shiftExists = shiftsFromRedux.some(shift => shift.id === existingShiftId);
                
                if (!shiftExists) {
                    console.log('[CourierCalendar] existingShiftId не найден в Redux store, будет создана новая смена');
                    validShiftId = undefined; // Очищаем ID, если смена не найдена
                }
            }
            
            console.log('[CourierCalendar] Booking/updating shift:', {
                date: dateString,
                shiftType,
                slotIndex,
                userId: currentUserId,
                existingShiftId: validShiftId
            });
            
            // Диспатчим экшен без await, чтобы не блокировать UI
            // Это позволит избежать перерисовки до завершения действия
            const dispatchPromise = dispatch(bookShift({
                date: dateString,
                shiftType,
                slotIndex,
                userId: currentUserId,
                existingShiftId: validShiftId
            }));
            
            // Отложенно обновим UI через 500мс, чтобы дать время для обработки UI в ShiftPanel
            setTimeout(() => {
                console.log('[CourierCalendar] Delayed UI update after booking shift');
            }, 500);
            
            // Асинхронно обрабатываем результат без блокировки UI
            dispatchPromise.then(() => {
                console.log('[CourierCalendar] Shift booking completed successfully');
            }).catch(error => {
                console.error('[CourierCalendar] Error in background shift booking:', error);
            });
            
            // Возвращаем промис для кода, которому нужно дождаться завершения
            return dispatchPromise;
        } catch (error) {
            console.error('Error booking/updating shift:', error);
        }
    };

    const handleReserveSelect = async () => {
        if (!selectedDateForDialog) return;
        
        try {
            console.log('[CourierCalendar] Adding to reserve...');
            const result = await dispatch(addToReserve({
                date: format(selectedDateForDialog, 'yyyy-MM-dd'),
                userId: currentUserId
            }));
            
            console.log('[CourierCalendar] Successfully added to reserve, result:', result);
            
            // Возвращаем результат, чтобы компонент ReservePanel мог обработать его
            return result.payload;
        } catch (error) {
            console.error('[CourierCalendar] Error adding to reserve:', error);
            throw error; // Пробрасываем ошибку дальше для обработки в компоненте
        }
    };

    const handleCancelReserve = async (reserveId: string) => {
        try {
            console.log('[CourierCalendar] Canceling reserve with ID:', reserveId);
            await dispatch(removeFromReserve({
                reserveId,
                userId: currentUserId
            }));
            console.log('[CourierCalendar] Successfully canceled reserve');
        } catch (error) {
            console.error('Error canceling reserve:', error);
        }
    };

    // Создаем мемоизированную версию функции renderDayContent
    const renderDayContent = useMemo(() => {
        // Возвращаем функцию, которая будет использоваться для рендеринга
        return (date: Date) => {
            if (!date) return null;
            
            const dateStr = format(date, 'yyyy-MM-dd');
            const dateShifts = shifts.filter(shift => shift.date === dateStr);
            
            // Проверяем, записан ли текущий курьер на эту дату
            const currentUserShift = dateShifts.find(shift => String(shift.userId) === String(currentUserId));
            
            if (currentUserShift) {
                // Сокращаем логирование для уменьшения нагрузки
                return (
                    <CourierAvatar 
                        src={currentUserShift.photo_url || currentUserAvatar || defaultAvatar}
                        alt={`${currentUserShift.firstName || ''} ${currentUserShift.lastName || ''}`}
                        // Используем более стабильный ключ без lastUpdateTime
                        key={`${dateStr}-${currentUserShift.id || 'user'}`}
                        onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = defaultAvatar;
                        }}
                    />
                );
            }
            
            // Проверяем количество занятых слотов
            const totalSlots = 6; // 4 дневных + 2 вечерних
            const occupiedSlots = dateShifts.length;
            const hasAvailableSlots = occupiedSlots < totalSlots;
            
            if (isDateAvailable(date)) {
                if (hasAvailableSlots) {
                    return (
                        <EmptySlotIndicator key={`${dateStr}-empty`}>
                            <DayNumber $isAvailable={true}>{format(date, 'd')}</DayNumber>
                        </EmptySlotIndicator>
                    );
                } else {
                    return (
                        <OccupiedSlotIndicator key={`${dateStr}-occupied`}>
                            <DayNumber $isAvailable={false} style={{ color: '#FF3B30' }}>{format(date, 'd')}</DayNumber>
                            <CrossIcon>×</CrossIcon>
                        </OccupiedSlotIndicator>
                    );
                }
            }
            
            return <DayNumber $isAvailable={false} key={`${dateStr}-unavailable`}>{format(date, 'd')}</DayNumber>;
        };
    }, [shifts, currentUserId, currentUserAvatar, isDateAvailable]);

    if (isLoading) {
        return <div>Загрузка...</div>;
    }

    if (error) {
        return <div>Ошибка: {error}</div>;
    }

    return (
        <CalendarContainer>
            <CalendarHeader>
                <HeaderTop>
                    <CloseButton onClick={onClose}>&larr;</CloseButton>
                    <Title>Выберите дату смены</Title>
                    <div style={{ width: '40px' }} />
                </HeaderTop>
                <SlotsContainer ref={slotsContainerRef}>
                    <SlotsInfo>
                        {weekDays.map((day, index) => (
                            <DaySlots 
                                key={day}
                                onMouseEnter={(e) => handleDayMouseEnter(e, day)}
                                onMouseLeave={() => setTooltipDay(null)}
                            >
                                <DayName>{day}</DayName>
                                <SlotCount>
                                    <SlotBadge>4</SlotBadge>
                                    <SlotDivider>/</SlotDivider>
                                    <SlotBadge>2</SlotBadge>
                                </SlotCount>
                            </DaySlots>
                        ))}
                    </SlotsInfo>
                    {tooltipDay && (
                        <Tooltip 
                            $isVisible={true}
                            $position="center"
                            style={{
                                position: 'fixed',
                                top: tooltipPosition.top,
                                left: tooltipPosition.left
                            }}
                        >
                            <TooltipTitle>Доступные места</TooltipTitle>
                            <TooltipRow>
                                <ShiftIcon>☀️</ShiftIcon>
                                Дневная смена: 4 места
                            </TooltipRow>
                            <TooltipRow>
                                <ShiftIcon>🌙</ShiftIcon>
                                Вечерняя смена: 2 места
                            </TooltipRow>
                        </Tooltip>
                    )}
                </SlotsContainer>
            </CalendarHeader>

            <MonthsContainer>
                {months.map((month) => (
                    <MonthSection 
                        key={`${month.getFullYear()}-${month.getMonth()}`}
                        id={`month-${month.getFullYear()}-${month.getMonth()}`}
                    >
                        <MonthTitle>
                            {monthNames[month.getMonth()]} {month.getFullYear()}
                        </MonthTitle>

                        <WeekDaysGrid>
                            {weekDays.map(day => (
                                <WeekDay key={day}>{day}</WeekDay>
                            ))}
                        </WeekDaysGrid>

                        <DaysGrid>
                            {getDaysInMonth(month).map((date, index) => {
                                if (!date) {
                                    return <div key={`empty-${index}`} />;
                                }

                                const dayShifts = getShiftsForDate(date);
                                const hasShifts = dayShifts.length > 0;
                                const isAvailable = isDateAvailable(date);

                                return (
                                    <DayCell
                                        key={date.toISOString()}
                                        onClick={() => handleDayClick(date)}
                                        $isToday={isToday(date)}
                                        $isSelected={isSelected(date)}
                                        $hasShifts={hasShifts}
                                        $isAvailable={isAvailable}
                                    >
                                        {renderDayContent(date)}
                                    </DayCell>
                                );
                            })}
                        </DaysGrid>
                    </MonthSection>
                ))}
            </MonthsContainer>

            <ShiftSelectionDialog
                isOpen={!!selectedDateForDialog}
                onClose={() => setSelectedDateForDialog(null)}
                date={selectedDateForDialog || new Date()}
                dayShifts={getDayShifts(selectedDateForDialog || new Date())}
                nightShifts={getNightShifts(selectedDateForDialog || new Date())}
                maxDaySlots={4}
                maxNightSlots={2}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                currentUserName={currentUserName}
                onSlotSelect={handleShiftSelect}
                onReserveSelect={handleReserveSelect}
                onCancelReserve={handleCancelReserve}
                reserves={getReservesForDate(selectedDateForDialog || new Date())}
            />
        </CalendarContainer>
    );
};

export default CourierCalendar; 