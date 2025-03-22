import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
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
    forceFetchReserves,
    subscribeToReserveEvents,
    unsubscribeFromReserveEvents,
    reserveDeleted
} from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import store from '../../store/store';
import { socketService } from '../../services/socket';
import LoadingOverlay from './LoadingOverlay';

interface CourierShift {
    userId: string;
    photo_url?: string;
    firstName: string;
    lastName: string;
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

interface CourierCalendarProps {
    onShiftSelect: (date: Date, shiftType: 'day' | 'night', slotIndex: number) => void;
    selectedDate?: Date;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onClose: () => void;
    chatId?: string;
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
    overflow: visible;

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

const LockIcon = styled.div`
    position: absolute;
    width: 18px;
    height: 16px;
    top: 58%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    
    /* Дужка замка */
    &::before {
        content: '';
        position: absolute;
        width: 10px;
        height: 6px;
        border: 2px solid #FF3B30;
        border-bottom: none;
        border-radius: 4px 4px 0 0;
        top: -6px;
        left: 2px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    /* Тело замка */
    &::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 10px;
        background-color: #FF3B30;
        border-radius: 3px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
`;

// Добавим стилизацию для иконки и тела замка
const LockIconSkeuomorphic = styled(LockIcon)`
    /* Эффект градиента для тела замка */
    &::after {
        background: linear-gradient(135deg, #FF5A50 0%, #FF3B30 100%);
        border: 1px solid rgba(0, 0, 0, 0.05);
    }
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

// Обновляем стиль для индикатора "в резерве"
const ReserveSlotIndicator = styled(EmptySlotIndicator)`
    border: 2px solid #FF9500;
    background: rgba(255, 149, 0, 0.05);
    position: relative;
    overflow: visible;

    &::before {
        background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255, 149, 0, 0.05) 100%);
    }

    &::after {
        border-top-color: #FF9500;
        border-right-color: #FF9500;
    }
    
    /* Улучшаем эффект наведения */
    &:hover {
        transform: scale(1.05);
        box-shadow: 0 0 15px rgba(255, 149, 0, 0.3);
    }
`;

// Обновляем стиль для иконки восклицательного знака
const ReserveIcon = styled.div`
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #FFA726 0%, #FF9500 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: bold;
    z-index: 10;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(255, 149, 0, 0.4);
    border: 1.5px solid white;
    transition: all 0.2s ease;
    
    /* Улучшаем внешний вид при наведении */
    &:hover {
        transform: scale(1.15);
        box-shadow: 0 3px 8px rgba(255, 149, 0, 0.6);
    }
    
    /* Эффект нажатия */
    &:active {
        transform: scale(0.95);
        box-shadow: 0 1px 3px rgba(255, 149, 0, 0.3);
    }
    
    /* Добавляем стилизованный восклицательный знак */
    &::before {
        content: '!';
        display: inline-block;
        transform: translateY(-1px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
`;

// Обновляем стиль для заголовка тултипа резерва
const ReserveTooltipTitle = styled.div`
    font-weight: 600;
    font-size: 1.1rem;
    margin-bottom: 12px;
    color: #FF9500;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &::before {
        content: '';
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: linear-gradient(135deg, #FFA726 0%, #FF9500 100%);
        border-radius: 50%;
        position: relative;
        box-shadow: 0 2px 4px rgba(255, 149, 0, 0.3);
    }
    
    &::after {
        content: '!';
        position: absolute;
        left: 17px;
        color: white;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
`;

const TooltipDivider = styled.div`
    height: 1px;
    background: rgba(0, 0, 0, 0.1);
    margin: 12px 0;
`;

const TooltipInfoRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
`;

const TooltipIconWrapper = styled.div`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(76, 175, 80, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    
    &.warning {
        background: rgba(255, 59, 48, 0.1);
    }
`;

const TooltipButton = styled.button`
    width: 100%;
    padding: 10px;
    background: linear-gradient(to right, #FF9500, #FF7A00);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    margin-top: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(255, 149, 0, 0.25);
    }
    
    &:active {
        transform: translateY(0);
    }
    
    &.disabled {
        background: #f2f2f2;
        color: #999;
        cursor: not-allowed;
        
        &:hover {
            transform: none;
            box-shadow: none;
        }
    }
`;

// Добавляем стиль для кнопки закрытия тултипа
const TooltipCloseButton = styled.button`
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #666;
    }
`;

// Улучшим вид LoadingOverlay
const CalendarLoadingOverlay = styled.div`
    position: absolute;
    top: 80px; /* После заголовка */
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--card-background);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
    
    &.show {
        opacity: 1;
        visibility: visible;
    }
`;

// Улучшенный стиль для тултипа резерва с динамическим позиционированием стрелки
const ReserveTooltip = styled.div<{ position: 'top' | 'bottom' | 'left' | 'right'; arrowOffset: string }>`
    position: fixed;
    z-index: 1000;
    background-color: var(--card-background);
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    width: 280px;
    max-width: 90vw;
    padding: 16px;
    animation: tooltipFadeIn 0.3s ease;
    border: 1px solid rgba(255, 149, 0, 0.3);
    
    @media (max-width: 480px) {
        width: calc(100vw - 32px);
        max-width: calc(100vw - 32px);
        padding: 12px;
    }
    
    @keyframes tooltipFadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    &::after {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        
        ${props => props.position === 'top' && `
            bottom: -10px;
            left: ${props.arrowOffset};
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid var(--card-background);
        `}
        
        ${props => props.position === 'bottom' && `
            top: -10px;
            left: ${props.arrowOffset};
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-bottom: 10px solid var(--card-background);
        `}
        
        ${props => props.position === 'left' && `
            right: -10px;
            top: ${props.arrowOffset};
            border-top: 10px solid transparent;
            border-bottom: 10px solid transparent;
            border-left: 10px solid var(--card-background);
        `}
        
        ${props => props.position === 'right' && `
            left: -10px;
            top: ${props.arrowOffset};
            border-top: 10px solid transparent;
            border-bottom: 10px solid transparent;
            border-right: 10px solid var(--card-background);
        `}
    }
`;

const CourierCalendar: React.FC<CourierCalendarProps> = ({
    onShiftSelect,
    selectedDate,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onClose,
    chatId
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
    const [tooltipPosition, setTooltipPosition] = useState<{
        top: number;
        left: number;
        position?: 'top' | 'bottom' | 'left' | 'right';
        arrowOffset?: string;
    }>({ top: 0, left: 0, position: 'top', arrowOffset: '50%' });
    const slotsContainerRef = useRef<HTMLDivElement>(null);
    const [hasShownScrollHint, setHasShownScrollHint] = useState(false);
    const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
    const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [showSkeleton, setShowSkeleton] = useState<boolean>(false);

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

    // Добавляем обработчики событий резервов
    const stableHandleReserveAdded = useCallback((data: any) => {
        console.log('[CourierCalendar] WebSocket reserve_added:', data);
        
        // Проверяем, касается ли событие текущего пользователя
        const isCurrentUser = String(data.user_id) === String(currentUserId);
        
        if (isCurrentUser) {
            console.log('[CourierCalendar] Current user was added to reserve:', data.date);
        }
        
        // Принудительно обновляем Redux-данные после добавления в резерв
        dispatch(forceFetchReserves()).then(() => {
            // Немедленное обновление UI
            setLastUpdateTime(Date.now());
            
            // Также закрываем и открываем диалог, если он открыт на эту дату
            if (selectedDateForDialog && format(selectedDateForDialog, 'yyyy-MM-dd') === data.date) {
                const currentDate = new Date(selectedDateForDialog);
                setSelectedDateForDialog(null);
                setTimeout(() => setSelectedDateForDialog(currentDate), 100);
            }
        });
    }, [dispatch, currentUserId, selectedDateForDialog]);

    const stableHandleReserveDeleted = useCallback((data: any) => {
        console.log('[CourierCalendar] WebSocket reserve_deleted:', data);
        
        // Проверяем, касается ли событие текущего пользователя
        const isCurrentUser = String(data.user_id) === String(currentUserId);
        
        if (isCurrentUser) {
            console.log('[CourierCalendar] Current user was removed from reserve:', data.date);
            
            // Немедленное оптимистичное обновление UI
            setLastUpdateTime(Date.now());
        }
        
        // Оптимистично обновляем Redux-состояние, не дожидаясь сетевого запроса
        const reserveId = data.reserve_id || data.id;
        if (reserveId) {
            // Если у нас есть ID резерва, диспатчим локальное действие
            dispatch(reserveDeleted({ id: reserveId }));
        } else if (data.user_id && data.date) {
            // Если нет ID, но есть ID пользователя и дата
            dispatch(reserveDeleted({ userId: data.user_id, date: data.date }));
        }
        
        // После оптимистичного обновления делаем запрос для синхронизации
        dispatch(forceFetchReserves()).then(() => {
            // Дополнительное обновление UI после получения данных с сервера
            setLastUpdateTime(Date.now());
            
            // Также закрываем и открываем диалог, если он открыт на эту дату
            if (selectedDateForDialog && format(selectedDateForDialog, 'yyyy-MM-dd') === data.date) {
                const currentDate = new Date(selectedDateForDialog);
                setSelectedDateForDialog(null);
                setTimeout(() => setSelectedDateForDialog(currentDate), 100);
            }
        });
    }, [dispatch, currentUserId, selectedDateForDialog]);

    useEffect(() => {
        // Загружаем смены при монтировании компонента
        dispatch(fetchShifts());
        
        // Подписываемся на события WebSocket с стабильными обработчиками
        subscribeToShiftEvents(dispatch, {
            onShiftUpdated: stableHandleShiftUpdated,
            onShiftBooked: stableHandleShiftBooked,
            onShiftCanceled: stableHandleShiftCanceled
        });
        
        // Подписываемся на события резервов
        subscribeToReserveEvents(dispatch);

        // Добавляем прямые обработчики для UI-обновлений календаря
        socketService.on('reserve_added', stableHandleReserveAdded);
        socketService.on('reserve_deleted', stableHandleReserveDeleted);
        
        // Отписываемся при размонтировании
        return () => {
            unsubscribeFromShiftEvents();
            unsubscribeFromReserveEvents();
            socketService.off('reserve_added', stableHandleReserveAdded);
            socketService.off('reserve_deleted', stableHandleReserveDeleted);
        };
    }, [
        dispatch, 
        stableHandleShiftUpdated, 
        stableHandleShiftBooked, 
        stableHandleShiftCanceled,
        stableHandleReserveAdded,
        stableHandleReserveDeleted
    ]);

    // Add a new useEffect hook to handle real-time updates
    useEffect(() => {
        // Используем debounce для плавного обновления без моргания
        // Вместо немедленного обновления, будем ждать небольшое время 
        // на случай, если придет несколько обновлений подряд
        const timer = setTimeout(() => {
            console.log('[CourierCalendar] Data has been updated, smoothly refreshing calendar UI');
            setLastUpdateTime(Date.now());
        }, 500); // Увеличиваем таймаут для большей плавности
        
        // Очищаем таймер при изменении зависимостей
        return () => clearTimeout(timer);
    }, [shifts, reserves]);

    // Отслеживаем загрузку и устанавливаем initialLoading в false после первой загрузки
    useEffect(() => {
        if (!isLoading && initialLoading) {
            setInitialLoading(false);
        }
    }, [isLoading, initialLoading]);

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
        // Логируем только если есть смены или это текущая дата календаря
        if (dateShifts.length > 0 || isToday(date)) {
            console.log(`[CourierCalendar] Day shifts for ${dateStr}:`, dateShifts);
        }
        return dateShifts;
    };

    const getNightShifts = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dateShifts = shifts.filter(shift => 
            shift.date === dateStr && 
            shift.shiftType === 'night'
        );
        // Логируем только если есть смены или это текущая дата календаря
        if (dateShifts.length > 0 || isToday(date)) {
            console.log(`[CourierCalendar] Night shifts for ${dateStr}:`, dateShifts);
        }
        return dateShifts;
    };

    const getReservesForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Используем текущие резервы из хука useSelector вместо вызова селектора напрямую
        // Это обеспечит получение актуальных данных и правильное обновление UI
        
        // Убираем детальное логирование для каждой даты - это создает слишком много шума
        // и замедляет работу приложения
        // console.log(`[CourierCalendar] Getting reserves for ${dateStr}:`, { 
        //     reserves, 
        //     reservesCount: reserves.length 
        // });
        
        // Фильтруем резервы для указанной даты
        const filteredReserves = reserves.filter(reserve => reserve.date === dateStr);
        
        // Логируем только если есть резервы на эту дату
        if (filteredReserves.length > 0) {
            console.log(`[CourierCalendar] Reserves for ${dateStr}:`, {
                filteredCount: filteredReserves.length,
                reservesData: filteredReserves
            });
        }
        
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

    const handleShiftSelect = async (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction = false) => {
        if (!selectedDateForDialog) {
            console.error('[CourierCalendar] No selected date for dialog, aborting shift select');
            return;
        }
        
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
            
            // Проверяем, доступен ли chatId
            if (!chatId) {
                console.log('[CourierCalendar] Warning: No chatId provided for shift booking, using default chat ID');
            }
            
            console.log('[CourierCalendar] Booking/updating shift:', {
                date: dateString,
                shiftType,
                slotIndex,
                userId: currentUserId,
                existingShiftId: validShiftId,
                chatId: chatId || 'not provided',
                isDragAction
            });
            
            // Для drag-and-drop операций важно дождаться результата
            if (isDragAction) {
                console.log('[CourierCalendar] Processing drag-and-drop operation, waiting for completion');
                
                // Диспатчим экшен с await для перетаскивания, чтобы гарантировать завершение
                try {
                    const result = await dispatch(bookShift({
                        date: dateString,
                        shiftType,
                        slotIndex,
                        userId: currentUserId,
                        existingShiftId: validShiftId,
                        chatId: chatId,
                        isDragAction
                    })).unwrap();
                    
                    console.log('[CourierCalendar] Drag-and-drop operation completed successfully:', result);
                    return result;
                } catch (error) {
                    console.error('[CourierCalendar] Error in drag-and-drop operation:', error);
                    throw error; // Пробрасываем ошибку для обработки в компоненте ShiftPanel
                }
            } else {
                // Для обычного выбора смены - не блокируем UI
                console.log('[CourierCalendar] Regular shift selection, not blocking UI');
                const dispatchPromise = dispatch(bookShift({
                    date: dateString,
                    shiftType,
                    slotIndex,
                    userId: currentUserId,
                    existingShiftId: validShiftId,
                    chatId: chatId,
                    isDragAction
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
            }
        } catch (error) {
            console.error('[CourierCalendar] Error in handleShiftSelect:', error);
            throw error; // Пробрасываем ошибку дальше
        }
    };

    const handleReserveSelect = async () => {
        if (!selectedDateForDialog) return;
        
        try {
            console.log('[CourierCalendar] Adding to reserve...');

            // Получаем chat_id из props или из данных WebApp
            if (!chatId) {
                console.error('[CourierCalendar] Error: No chat ID provided');
                throw new Error('Не удалось определить ID чата. Отсутствует идентификатор чата.');
            }
            
            console.log('[CourierCalendar] Using chat ID:', chatId);
            
            const result = await dispatch(addToReserve({
                date: format(selectedDateForDialog, 'yyyy-MM-dd'),
                userId: currentUserId,
                chatId: chatId
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
            
            // Проверяем наличие chat_id
            if (!chatId) {
                console.error('[CourierCalendar] Error: No chat ID provided');
                throw new Error('Не удалось определить ID чата. Отсутствует идентификатор чата.');
            }
            
            console.log('[CourierCalendar] Using chat ID for cancellation:', chatId);
            
            // Оптимистично обновляем UI до получения ответа от сервера
            setLastUpdateTime(Date.now());
            
            // Отправляем запрос на удаление из резерва
            await dispatch(removeFromReserve({
                reserveId,
                userId: currentUserId,
                chatId: chatId
            }));
            
            // Оптимистично обновляем Redux-состояние
            dispatch(reserveDeleted({ id: reserveId }));
            
            // Принудительно запрашиваем актуальные данные после удаления
            await dispatch(forceFetchReserves());
            
            // Обновляем UI после удаления из резерва
            setLastUpdateTime(Date.now());
            
            console.log('[CourierCalendar] Successfully canceled reserve and refreshed data');
            
            // Если диалог открыт, закрываем его на небольшое время и открываем снова 
            // для принудительного обновления
            if (selectedDateForDialog) {
                const currentDate = new Date(selectedDateForDialog);
                setSelectedDateForDialog(null);
                
                // Небольшая задержка для гарантированного обновления UI
                setTimeout(() => {
                    setSelectedDateForDialog(currentDate);
                }, 100);
            }
        } catch (error) {
            console.error('Error canceling reserve:', error);
        }
    };

    // Добавляем проверку, есть ли пользователь в резерве на данную дату
    const userIsInReserve = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dateReserves = getReservesForDate(date);
        
        // Поиск первого резерва пользователя на эту дату
        const userReserve = dateReserves.find(reserve => 
            String(reserve.userId) === String(currentUserId)
        );
        
        // Логируем только если пользователь найден в резерве
        if (userReserve) {
            console.log(`[CourierCalendar] User ${currentUserId} is in reserve for ${dateStr}`, userReserve);
        }
        
        return !!userReserve;
    };

    // Проверка доступности смен на дату
    const getSlotsInfo = (date: Date) => {
        const dayShifts = getDayShifts(date);
        const nightShifts = getNightShifts(date);
        const dayAvailable = dayShifts.length < 4;
        const nightAvailable = nightShifts.length < 2;
        
        return {
            dayTotal: 4,
            nightTotal: 2,
            dayOccupied: dayShifts.length,
            nightOccupied: nightShifts.length,
            dayAvailable,
            nightAvailable,
            hasAvailableSlots: dayAvailable || nightAvailable
        };
    };

    // Обновляем функцию renderDayContent для обновленного отображения состояния резерва
    const renderDayContent = useMemo(() => {
        // Возвращаем функцию, которая будет использоваться для рендеринга
        return (date: Date) => {
            if (!date) return null;
            
            const dateStr = format(date, 'yyyy-MM-dd');
            const dateShifts = shifts.filter(shift => shift.date === dateStr);
            
            // Проверяем, записан ли текущий курьер на эту дату
            const currentUserShift = dateShifts.find(shift => String(shift.userId) === String(currentUserId));
            
            // Проверяем, в резерве ли текущий курьер на эту дату
            const inReserve = userIsInReserve(date);
            
            // Получаем информацию о доступности смен
            const slotsInfo = getSlotsInfo(date);
            
            // Используем переменную для хранения содержимого, которое будет возвращено
            let content;
            
            if (currentUserShift) {
                // Если пользователь имеет смену на эту дату
                content = (
                    <CourierAvatar 
                        src={currentUserShift.photo_url || currentUserAvatar || defaultAvatar}
                        alt={`${currentUserShift.firstName || ''} ${currentUserShift.lastName || ''}`}
                        key={`${dateStr}-${currentUserShift.id || 'user'}`}
                        onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = defaultAvatar;
                        }}
                    />
                );
            }
            else if (inReserve) {
                // Если пользователь в резерве на эту дату
                content = (
                    <ReserveSlotIndicator key={`${dateStr}-reserve`}>
                        <DayNumber $isAvailable={true} style={{
                            color: '#FF9500',
                            fontWeight: '600',
                            textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
                        }}>
                            {format(date, 'd')}
                        </DayNumber>
                        <ReserveIcon 
                            onClick={(e) => handleReserveIconClick(e, date)}
                            title="Вы в резерве на эту дату"
                        />
                    </ReserveSlotIndicator>
                );
            }
            // Проверяем доступность даты и наличие свободных мест
            else if (isDateAvailable(date)) {
                if (slotsInfo.hasAvailableSlots) {
                    content = (
                        <EmptySlotIndicator key={`${dateStr}-empty`}>
                            <DayNumber $isAvailable={true}>{format(date, 'd')}</DayNumber>
                        </EmptySlotIndicator>
                    );
                } else {
                    content = (
                        <OccupiedSlotIndicator key={`${dateStr}-occupied`}>
                            <DayNumber 
                                $isAvailable={false} 
                                style={{ 
                                    color: '#FF3B30', 
                                    opacity: 0.9, 
                                    fontSize: '0.85rem',
                                    position: 'absolute',
                                    top: '24%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontWeight: '600',
                                    textShadow: '0 0 3px rgba(255, 255, 255, 0.9)'
                                }}
                            >
                                {format(date, 'd')}
                            </DayNumber>
                            <LockIconSkeuomorphic>
                                <div style={{
                                    position: 'absolute',
                                    width: '4px',
                                    height: '4px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                                    borderRadius: '50%',
                                    top: '3px',
                                    left: '6px',
                                    zIndex: 3,
                                    boxShadow: 'inset 0 0 2px rgba(0, 0, 0, 0.3)'
                                }}/>
                            </LockIconSkeuomorphic>
                        </OccupiedSlotIndicator>
                    );
                }
            }
            else {
                content = <DayNumber $isAvailable={false} key={`${dateStr}-unavailable`}>{format(date, 'd')}</DayNumber>;
            }
            
            return content;
        };
    }, [shifts, reserves, currentUserId, currentUserAvatar, isDateAvailable, lastUpdateTime]);

    // Обновленная функция для позиционирования тултипа резерва
    const calculateTooltipPosition = (element: Element, tooltipWidth: number, tooltipHeight: number) => {
        const rect = element.getBoundingClientRect();
        
        // Получаем размеры области просмотра
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Расстояние между элементом и тултипом
        const gap = 15;
        
        // Определяем лучшее позиционирование
        let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
        let arrowOffset = '50%';
        let top = 0;
        let left = 0;
        
        // Проверяем, куда лучше поместить тултип
        const spaceAbove = rect.top;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceLeft = rect.left;
        const spaceRight = viewportWidth - rect.right;
        
        // Решаем, в каком направлении будет тултип
        if (spaceAbove >= tooltipHeight + gap && spaceAbove >= spaceBelow) {
            // Размещаем сверху
            position = 'top';
            top = rect.top - tooltipHeight - gap;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            arrowOffset = '50%';
        } else if (spaceBelow >= tooltipHeight + gap) {
            // Размещаем снизу
            position = 'bottom';
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            arrowOffset = '50%';
        } else if (spaceLeft >= tooltipWidth + gap && spaceLeft >= spaceRight) {
            // Размещаем слева
            position = 'left';
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.left - tooltipWidth - gap;
            arrowOffset = '50%';
        } else {
            // Размещаем справа по умолчанию
            position = 'right';
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            left = rect.right + gap;
            arrowOffset = '50%';
        }
        
        // Корректируем, чтобы не выходил за пределы экрана
        if (left < 16) {
            // Сдвигаем тултип вправо, чтобы он не вылезал за левый край
            const originalLeft = left;
            left = 16;
            
            // Корректируем позицию стрелки для горизонтального тултипа
            if (position === 'top' || position === 'bottom') {
                const arrowLeftPixels = tooltipWidth / 2 + originalLeft - left;
                arrowOffset = `${arrowLeftPixels}px`;
            }
        } else if (left + tooltipWidth > viewportWidth - 16) {
            // Сдвигаем тултип влево, чтобы он не вылезал за правый край
            const originalLeft = left;
            left = viewportWidth - tooltipWidth - 16;
            
            // Корректируем позицию стрелки для горизонтального тултипа
            if (position === 'top' || position === 'bottom') {
                const arrowLeftPixels = tooltipWidth / 2 + originalLeft - left;
                arrowOffset = `${arrowLeftPixels}px`;
            }
        }
        
        // Корректируем, чтобы не выходил за верхнюю и нижнюю границу
        if (top < 16) {
            const originalTop = top;
            top = 16;
            
            // Корректируем позицию стрелки для вертикального тултипа
            if (position === 'left' || position === 'right') {
                const arrowTopPixels = tooltipHeight / 2 + originalTop - top;
                arrowOffset = `${arrowTopPixels}px`;
            }
        } else if (top + tooltipHeight > viewportHeight - 16) {
            const originalTop = top;
            top = viewportHeight - tooltipHeight - 16;
            
            // Корректируем позицию стрелки для вертикального тултипа
            if (position === 'left' || position === 'right') {
                const arrowTopPixels = tooltipHeight / 2 + originalTop - top;
                arrowOffset = `${arrowTopPixels}px`;
            }
        }
        
        return { top, left, position, arrowOffset };
    };

    // Обновляем функцию handleReserveIconClick, убираем автоматическое закрытие
    const handleReserveIconClick = (event: React.MouseEvent, date: Date) => {
        event.stopPropagation(); // Предотвращаем переход к диалогу выбора смены
        
        const element = event.currentTarget;
        
        // Предполагаемые размеры тултипа (примерные значения)
        const tooltipWidth = window.innerWidth < 480 ? window.innerWidth - 32 : 280;
        const tooltipHeight = 220; // Примерная высота тултипа
        
        // Рассчитываем оптимальную позицию
        const { top, left, position, arrowOffset } = calculateTooltipPosition(
            element,
            tooltipWidth,
            tooltipHeight
        );
        
        setTooltipDay('reserve-' + format(date, 'yyyy-MM-dd'));
        setTooltipPosition({
            top,
            left,
            position,
            arrowOffset
        });
        
        // Удаляем автоматическое закрытие через таймаут
    };

    // Добавляем useEffect для обработки кликов вне тултипа
    useEffect(() => {
        // Только если тултип открыт
        if (tooltipDay && tooltipDay.startsWith('reserve-')) {
            // Функция обработчик клика
            const handleOutsideClick = (event: MouseEvent) => {
                // Проверяем, что клик был не внутри тултипа
                const tooltipElement = document.querySelector('.reserve-tooltip');
                if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
                    setTooltipDay(null);
                }
            };
            
            // Добавляем обработчик на document
            document.addEventListener('mousedown', handleOutsideClick);
            
            // Очищаем обработчик при закрытии тултипа
            return () => {
                document.removeEventListener('mousedown', handleOutsideClick);
            };
        }
    }, [tooltipDay]);

    // Показываем полноэкранную загрузку только при первоначальной загрузке данных
    if (initialLoading && isLoading) {
        return <LoadingOverlay context="schedule" />;
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

            {tooltipDay && tooltipDay.startsWith('reserve-') && (() => {
                // Получаем информацию о слотах
                const dateObj = new Date(tooltipDay.replace('reserve-', ''));
                const slotsInfo = getSlotsInfo(dateObj);
                const dateStr = format(dateObj, 'dd.MM.yyyy');
                
                return (
                    <ReserveTooltip 
                        className="reserve-tooltip"
                        style={{
                            top: tooltipPosition.top,
                            left: tooltipPosition.left
                        }}
                        position={tooltipPosition.position || 'top'}
                        arrowOffset={tooltipPosition.arrowOffset || '50%'}
                    >
                        <TooltipCloseButton onClick={() => setTooltipDay(null)}>×</TooltipCloseButton>
                        
                        <ReserveTooltipTitle>
                            Вы в резерве на эту дату
                        </ReserveTooltipTitle>
                        
                        <TooltipDivider />
                        
                        <TooltipInfoRow>
                            <TooltipIconWrapper>
                                <span role="img" aria-label="calendar">📅</span>
                            </TooltipIconWrapper>
                            <div>Дата: <strong>{dateStr}</strong></div>
                        </TooltipInfoRow>
                        
                        <TooltipInfoRow>
                            <TooltipIconWrapper className={slotsInfo.dayAvailable ? '' : 'warning'}>
                                <span role="img" aria-label="day">☀️</span>
                            </TooltipIconWrapper>
                            <div>
                                Дневная смена: <strong>{slotsInfo.dayOccupied}/{slotsInfo.dayTotal}</strong>
                                {slotsInfo.dayAvailable ? ' (есть места)' : ' (нет мест)'}
                            </div>
                        </TooltipInfoRow>
                        
                        <TooltipInfoRow>
                            <TooltipIconWrapper className={slotsInfo.nightAvailable ? '' : 'warning'}>
                                <span role="img" aria-label="night">🌙</span>
                            </TooltipIconWrapper>
                            <div>
                                Вечерняя смена: <strong>{slotsInfo.nightOccupied}/{slotsInfo.nightTotal}</strong>
                                {slotsInfo.nightAvailable ? ' (есть места)' : ' (нет мест)'}
                            </div>
                        </TooltipInfoRow>
                        
                        {slotsInfo.hasAvailableSlots ? (
                            <TooltipButton
                                onClick={() => {
                                    setTooltipDay(null);
                                    handleDayClick(dateObj);
                                }}
                            >
                                Записаться на смену
                            </TooltipButton>
                        ) : (
                            <TooltipButton className="disabled">
                                Нет свободных мест
                            </TooltipButton>
                        )}
                    </ReserveTooltip>
                );
            })()}

            {/* Индикатор загрузки при обновлении данных */}
            <CalendarLoadingOverlay className={isLoading && !initialLoading && !showSkeleton ? "show" : ""}>
                <LoadingOverlay context="schedule" />
            </CalendarLoadingOverlay>
        </CalendarContainer>
    );
};

export default CourierCalendar; 