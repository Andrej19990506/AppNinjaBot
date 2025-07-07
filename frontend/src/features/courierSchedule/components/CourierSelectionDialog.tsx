import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { ReserveEntry, CourierShift, WeeklySlotConfig, CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { SLOTS_CONFIG } from '../constants';
import { format } from 'date-fns';
import ShiftPanel from './shift-panel/ShiftPanel';
import ReservePanel from './reserve-panel/ReservePanel';
import { ru } from 'date-fns/locale';
import BottomDrawer from '@features/courierSchedule/components/bottom-drawer';
import ShiftConfirmationDialog from './shift-panel/ShiftConfirmationDialog';
import { logger } from '@shared/utils/logger';
import { selectUser, selectUsersById } from '@shared/store/userSlice/userSelectors';
import { DndContext, KeyboardSensor, useSensor, useSensors, DragEndEvent, MouseSensor, TouchSensor, DragOverlay, DragStartEvent, pointerWithin, DragOverEvent } from '@dnd-kit/core';
import Alert from '@mui/material/Alert';
import CourierDragAvatar from '@/features/courierSchedule/components/drag-n-drop/CourierDragAvatar';
import DeleteDropZone, { DELETE_DROP_ZONE_ID } from '@/features/courierSchedule/components/drag-n-drop/DeleteDropZone';
import ReserveDropZone, { RESERVE_DROP_ZONE_ID } from '@/features/courierSchedule/components/drag-n-drop/ReserveDropZone';
import {updateShiftSlot } from '@features/courierSchedule/services/courierApi';
import CourierProfile from '@/features/courierSchedule/components/courier-profile/CourierProfile';
import { refreshCourierProfileFromTelegram } from '@features/courierSchedule/services/courierApi';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import CourierIcon from './courier-profile/CourierIcon';
import defaultAvatar from '@shared/assets/images/Ninja.jpg';
import { 
    assignCourierToShiftThunk, 
    fetchShifts
} from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { motion, useAnimation } from 'framer-motion';
import { userProfileUpdatedWs } from '@shared/store/userSlice/userSlice';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';
import { setShiftDialogOpen, removeShiftLocally, setShiftDialogMode } from '../store/shiftsSlice/shiftsSlice';
import {selectShiftDialogMode} from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors'
import { moveCourierToReserveThunk } from '@features/courierSchedule/store/reservesSlice/reservesThunks';

export const ShiftDialogGlobalHandler = {
    openProfile: null as ((courier: CourierShift) => void) | null
};

type ShiftType = CourierShift['shiftType'];

type ConfirmationDataSource = 
    | { type: 'assignment', data: CourierInfo }
    | { type: 'delete', data: ConfirmedCourierInfo }
    | null;

const rotateAnimation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Добавим новый styled компонент для иконки обновления
const RefreshIcon = styled.span<{ $isRefreshing: boolean }>`
  font-size: 14px;
  display: inline-block;
  ${props => props.$isRefreshing && css`
    animation: ${rotateAnimation} 1s linear infinite;
  `}
`;

// Добавляем стилизованные компоненты для кнопок профиля
const ProfileHeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  position: relative;
  background-color: var(--card-background);
  z-index: 2;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
`;

const CourierInfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CourierPhoto = styled.div`
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--primary-color);
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
`;

const CourierName = styled.span`
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-color);
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const HeaderButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const RefreshButton = styled.button<{ $isRefreshing: boolean }>`
  background: ${props => props.$isRefreshing ? 'var(--primary-color)' : 'var(--gradient-primary)'};
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 8px;
  width: 36px;
  height: 36px;
  cursor: ${props => props.$isRefreshing ? 'default' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: ${props => props.$isRefreshing ? 0.8 : 1};
  box-shadow: var(--shadow-sm);
  transform: ${props => props.$isRefreshing ? 'scale(0.98)' : 'scale(1)'};
  
  &:hover:not(:disabled) {
    transform: scale(1.03);
    box-shadow: var(--shadow-md);
  }
  
  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  
  &:active:not(:disabled) {
    transform: scale(0.97);
  }
  
  &:disabled {
    cursor: not-allowed;
  }

  ${RefreshIcon} {
      font-size: 18px; 
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  transition: all var(--transition-normal);
  width: 32px;
  height: 32px;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: var(--text-color);
  }
  
  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    color: var(--text-color);
  }
  
  &:active {
    transform: scale(0.92);
  }
  
  svg {
    width: 20px;
    height: 20px;
    stroke-width: 2.5;
  }
`;

const HeaderDivider = styled.div`
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-primary);
  opacity: 0.5;
`;

const ModeSwitchContainer = styled.div`
    display: flex;
    margin: 0 -24px 24px -24px;
    padding: 0 24px;
    background: var(--card-background);
    border-bottom: 1px solid var(--border-color);
    // position: sticky; // Temporarily removed for testing
    // top: 0;
    // z-index: 10;
    box-shadow: var(--shadow-sm);
`;

const ModeButton = styled.button<{ 
    $active: boolean;
    $isDropTargetActive?: boolean;
    $isDropTargetOver?: boolean;
}>`
    flex: 1;
    padding: 16px;
    background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.$active ? 'white' : 'var(--text-color)'};
    border: 2px solid transparent;
    cursor: pointer;
    transition: background-color var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal), transform var(--transition-fast), opacity var(--transition-normal);
    font-weight: ${props => props.$active ? '600' : '400'};
    position: relative;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: var(--radius-md, 6px) var(--radius-md, 6px) 0 0;

    &::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 3px;
        background: ${props => props.$active ? 'white' : 'var(--primary-color)'};
        transform: scaleX(${props => (props.$active && !props.$isDropTargetActive) ? 1 : 0});
        transform-origin: right;
        transition: transform var(--transition-normal);
    }

    &:hover {
        background: ${props => props.$active ? 'var(--primary-color)' : 'var(--primary-transparent)'};
        
        &::after {
            transform: scaleX(${props => (props.$active && !props.$isDropTargetActive) ? 1 : 0});
            transform-origin: left;
        }
    }

    &:disabled {
        opacity: ${props => props.$isDropTargetActive ? 1 : 'var(--disabled-opacity)'};
        cursor: not-allowed;
        pointer-events: none;
        &:hover {
             background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
             &::after { transform: scaleX(0); }
        }
    }

    ${props => props.$active && !props.$isDropTargetActive && css`
        box-shadow: var(--shadow-md);
    `}

    ${props => props.$isDropTargetActive && !props.$isDropTargetOver && css`
        background-color: transparent;
        color: var(--error-color);
        border-color: var(--error-color);
        border-style: dashed;
        font-weight: 400;
        animation: none;
        box-shadow: none;
        &::after { transform: scaleX(0); }
    `}

    ${props => props.$isDropTargetOver && css`
        background-color: var(--error-background);
        color: var(--error-color);
        border-color: var(--error-color);
        border-style: solid;
        transform: scale(1.03);
        font-weight: 600;
        animation: none;
        box-shadow: none;
        &::after { transform: scaleX(0); }
    `}
`;

const FlexContainer = styled.div`
    display: flex;
    gap: 8px;
`;

interface ConfirmedCourierInfo {
    id: string;
    name: string;
    avatar: string | null;
}

interface ShiftToDeleteData {
    shiftDbId: string;
    requesterId: string;
    courier: ConfirmedCourierInfo;
}

interface ShiftToReserveData {
    shiftDbId: string;
    courier: ConfirmedCourierInfo;
}

// Добавляем интерфейс для свайпа
interface SwipeInfo {
    startX: number;
    startY: number;
    isSwiping: boolean;
    direction: 'left' | 'right' | null;
}

// Функция для получения следующей/предыдущей даты
const getAdjacentDate = (currentDate: Date, direction: 'prev' | 'next'): Date => {
    const newDate = new Date(currentDate);
    const daysToAdd = direction === 'prev' ? -1 : 1;
    newDate.setDate(newDate.getDate() + daysToAdd);
    return newDate;
};

// Стилизуем контейнер для содержимого с анимацией свайпа
const SwipeableContent = styled(motion.div)`
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
`;

// Индикатор свайпа
const SwipeIndicator = styled.div<{ direction: 'left' | 'right' | null }>`
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    ${props => props.direction === 'left' ? 'right: 16px;' : 'left: 16px;'}
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
    z-index: 100;
    opacity: 0;
    animation: fadeInPulse 0.3s ease-out forwards;
    
    &::after {
        content: "${props => props.direction === 'left' ? '→' : '←'}";
        font-size: 20px;
        color: var(--primary-color);
    }
    
    @keyframes fadeInPulse {
        0% { opacity: 0; transform: translateY(-50%) scale(0.8); }
        50% { opacity: 0.9; transform: translateY(-50%) scale(1.1); }
        100% { opacity: 0.8; transform: translateY(-50%) scale(1); }
    }
`;

const DateIndicator = styled.div`
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--primary-color);
    color: white;
    padding: 6px 14px;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    font-weight: 500;
    z-index: 100;
    opacity: 1;
`;

interface ShiftSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    dayShifts: CourierShift[];
    nightShifts: CourierShift[];
    slotConfig: WeeklySlotConfig | null;
    currentUserId: string;
    requesterId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number) => Promise<any>;
    chatId?: string;
    getDisplayReservesForDate: (date: Date | null) => ReserveEntry[];
    isCurrentUserInReserveForDate: (date: Date | null) => boolean;
    addCurrentUserToReserve: (date: Date) => Promise<void>;
    cancelReserveById: (reserveId: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    onDeleteShift?: (shiftId: string, requesterId: string) => Promise<any>;
    onMoveToReserve?: (shiftId: string, courierId: string) => Promise<any>;
    onShiftDeletedLocally?: (shiftId: string) => void;
    showNotification?: (type: NotificationTypes, message: string, title?: string) => void;
    onOpenProfile?: (courier: CourierShift) => void;
    onDateChange?: (newDate: Date) => void;
    disablePrevDate?: boolean;
    disableNextDate?: boolean;
}

interface PendingShiftAction {
    shiftType: 'day' | 'night';
    slotIndex: number;
}

const SeniorCourierBadge = styled.div`
    position: absolute;
    top: -7px;
    right: -7px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(var(--primary-rgb), 0.15);
    z-index: 2;
    border: 1.5px solid var(--card-background);
    
    &::before {
        content: '⭐';
        font-size: 10px;
        line-height: 1;
    }
`;

const DevelopmentNotice = styled.div`
  margin-top: 24px;
  padding: 16px;
  text-align: center;
  border: 1px dashed var(--warning-color);
  border-radius: var(--radius);
  background-color: var(--warning-background);
  color: var(--text-secondary);
`;

const AnimatedGearIcon = styled.span`
  display: inline-block;
  font-size: 1.5rem;
  margin-bottom: 8px;
  animation: ${rotateAnimation} 2s linear infinite;
  color: var(--warning-color);
`;

const DevelopmentText = styled.p`
  margin: 0;
  font-size: 0.9rem;
`;

const ShiftSelectionDialog: FC<ShiftSelectionDialogProps> = React.memo(({
    isOpen,
    onClose,
    date,
    dayShifts,
    nightShifts,
    slotConfig,
    currentUserId,
    requesterId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    chatId,
    getDisplayReservesForDate,
    isCurrentUserInReserveForDate,
    addCurrentUserToReserve,
    cancelReserveById,
    isLoading: isReserveLoading,
    error: reserveError,
    onDeleteShift,
    onMoveToReserve,
    showNotification,
    onDateChange,
    disablePrevDate = false,
    disableNextDate = false
}) => {
    const dispatch = useAppDispatch();
    const shiftDialogMode = useAppSelector(selectShiftDialogMode);
    const [internalIsBookingLoading, setInternalIsBookingLoading] = useState(false);
    const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
    const [loadingType, setLoadingType] = useState<'day' | 'night' | null>(null);
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingShiftAction | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [activeDragData, setActiveDragData] = useState<any | null>(null);
    const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
    const [isOverDeleteZoneManually, setIsOverDeleteZoneManually] = useState(false);
    const [isOverReserveZoneManually, setIsOverReserveZoneManually] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [confirmedDeletedCourier, setConfirmedDeletedCourier] = useState<ConfirmedCourierInfo | null>(null);
    const [isConfirmingReserve, setIsConfirmingReserve] = useState(false);
    const [confirmedReserveCourier, setConfirmedReserveCourier] = useState<ConfirmedCourierInfo | null>(null);
    const [isProcessingDelete, setIsProcessingDelete] = useState(false);
    const [isProcessingReserve, setIsProcessingReserve] = useState(false);
    const [processingShiftId, setProcessingShiftId] = useState<string | null>(null);
    const [tempCourierData, setTempCourierData] = useState<ConfirmedCourierInfo | null>(null);

    // Состояние для отключения свайпа
    const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
    
    // <<< Состояния для подтверждения УДАЛЕНИЯ 
    const [isDeleteAwaitingConfirmation, setIsDeleteAwaitingConfirmation] = useState(false);
    const [shiftToDeleteData, setShiftToDeleteData] = useState<ShiftToDeleteData | null>(null);

    // <<< НОВЫЕ СОСТОЯНИЯ ДЛЯ ПОДТВЕРЖДЕНИЯ РЕЗЕРВА >>>
    const [isReserveAwaitingConfirmation, setIsReserveAwaitingConfirmation] = useState(false);
    const [shiftToReserveData, setShiftToReserveData] = useState<ShiftToReserveData | null>(null);

    // <<< НОВОЕ СОСТОЯНИЕ ДЛЯ ПОДТВЕРЖДЕНИЯ НАЗНАЧЕНИЯ >>>
    const [isAwaitingAssignmentConfirmation, setIsAwaitingAssignmentConfirmation] = useState(false);
    const [assignmentToConfirmData, setAssignmentToConfirmData] = useState<{
        courier: CourierInfo;
        shiftType: ShiftType;
        slotIndex: number;
    } | null>(null);

    // <<< НОВОЕ СОСТОЯНИЕ ДЛЯ ОБРАБОТКИ ПЕРЕМЕЩЕНИЯ СЛОТА >>>
    const [isProcessingMove, setIsProcessingMove] = useState(false);

    // Добавляем состояние для отображения профиля курьера
    const [selectedCourier, setSelectedCourier] = useState<CourierShift | null>(null);
    const [showCourierProfile, setShowCourierProfile] = useState(false);

    // Добавляем состояние загрузки для кнопки обновления профиля
    const [isProfileRefreshing, setIsProfileRefreshing] = useState(false);

    // <<< ВОЗВРАЩАЕМ СОСТОЯНИЯ ДЛЯ ПАНЕЛИ >>>
    const [isCouriersPanelOpen, setIsCouriersPanelOpen] = useState(false);
    const [panelTargetShiftType, setPanelTargetShiftType] = useState<ShiftType | null>(null);
    const [panelTargetSlotIndex, setPanelTargetSlotIndex] = useState<number | null>(null);

    const user = useAppSelector(selectUser);
    const usersById = useAppSelector(selectUsersById);
    const isCurrentUserSenior = useMemo(() => {
        if (!user || !user.groups || !chatId) {
            return false;
        }
        const currentGroup = user.groups.find(group => String(group.chat_id) === String(chatId));
        const isSenior = currentGroup?.is_senior_courier ?? false;
        return isSenior;
    }, [user, chatId]);

    const selectedCourierIsSenior = useMemo(() => {
        if (!selectedCourier) return false;
        return (selectedCourier as any).isSeniorCourier === true || (selectedCourier as any).is_senior_courier === true;
    }, [selectedCourier]);

    // <<< ИЗМЕНЕНИЕ: Обновляем состояние Redux при изменении isOpen >>>
    useEffect(() => {
        if (isOpen) {
            dispatch(setShiftDialogOpen(true));
            dispatch(setShiftDialogMode('shifts'));

            // Возвращаем функцию очистки, которая сработает ПЕРЕД следующим запуском эффекта
            // ИЛИ при размонтировании компонента, ЕСЛИ эффект был запущен (т.е. isOpen был true)
            return () => {
                dispatch(setShiftDialogOpen(false));
            };
        }
        // Если isOpen изначально false, ничего не делаем и не возвращаем cleanup
    }, [isOpen, dispatch]);

    const showSuccessMessage = (message: string) => {
    };

    const handleSlotSelectWrapper = useCallback((
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        setTimeout(() => {
            setPendingAction({ shiftType, slotIndex });
            setIsConfirmationOpen(true);
        }, 50);
    }, [setPendingAction, setIsConfirmationOpen]);

    const handleConfirmAction = useCallback(async () => {
        if (!pendingAction) return;

        const { shiftType, slotIndex } = pendingAction;
        
        setInternalIsBookingLoading(true);
        setLoadingType(shiftType);
        setLoadingSlot(slotIndex);
        
        let bookingSuccess = false; 
        try {
            await onSlotSelect(shiftType, slotIndex);

        } catch (error) {
        } finally {
            setLoadingType(null);
            setLoadingSlot(null);
            setInternalIsBookingLoading(false);
        }
    }, [
        pendingAction, 
        onSlotSelect, 
        setInternalIsBookingLoading,
        setLoadingType, 
        setLoadingSlot, 
        setIsConfirmationOpen, 
        setPendingAction
    ]);

    const handleCloseConfirmation = useCallback(() => {
        setIsConfirmationOpen(false);
        setPendingAction(null);
    }, [setIsConfirmationOpen, setPendingAction]);

    const dayIndex = date.getDay();

    
    const dayConfig = slotConfig ? slotConfig[dayIndex] : undefined;
    const currentMaxDay = dayConfig?.maxDaySlots ?? SLOTS_CONFIG.DAY.MAX_SLOTS;
    const currentMaxNight = dayConfig?.maxNightSlots ?? SLOTS_CONFIG.NIGHT.MAX_SLOTS;
    const currentHasSeniorSlot = dayConfig?.hasSeniorSlot ?? false;

    const sensors = useSensors(
        useSensor(KeyboardSensor, {
            // Опции для клавиатуры, если нужны
        }),
        useSensor(MouseSensor, {
            // Требовать задержку перед началом перетаскивания мышью
            activationConstraint: {
                delay: 100,       // 100ms задержка для мыши
                tolerance: 0,   // Без допуска смещения для мыши
            },
        }),
        useSensor(TouchSensor, {
            // Требовать задержку и допускать небольшое смещение для тачскрина
            activationConstraint: {
                delay: 250,       // 250ms задержка (дольше, чем для мыши)
                tolerance: 5,     // Допуск смещения в 5px во время задержки
            },
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        setActiveDragId(active.id as string);
        setIsDraggingGlobally(true);
        setIsOverDeleteZoneManually(false);
        setIsOverReserveZoneManually(false);
        setIsConfirmingDelete(false);
        setConfirmedDeletedCourier(null);
        setIsConfirmingReserve(false);
        setConfirmedReserveCourier(null);
        
        // Деактивируем возможность свайпа при начале перетаскивания
        setIsSwipeEnabled(false);
        
        if (active.data.current) {
            setActiveDragData(active.data.current);
        }
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        const overId = over?.id;

        const isOverDelete = overId === DELETE_DROP_ZONE_ID;
        const isOverReserve = overId === RESERVE_DROP_ZONE_ID;

        setIsOverDeleteZoneManually(isOverDelete);
        setIsOverReserveZoneManually(isOverReserve);

        const overlayElement = document.querySelector('.drag-overlay'); 
        if (overlayElement) {
            try {
                const computedStyle = window.getComputedStyle(overlayElement);
                const pointerEvents = computedStyle.getPropertyValue('pointer-events');
            } catch (e) {
            }
        } else {
        }
    }, [setIsOverDeleteZoneManually, setIsOverReserveZoneManually]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;

        // <<< Сброс isOver... в начале ОСТАВЛЯЕМ >>>
        setIsOverDeleteZoneManually(false);
        setIsOverReserveZoneManually(false);

        // Проверка на активные процессы (остается)
        if (isProcessingDelete || isProcessingReserve || isProcessingMove || isDeleteAwaitingConfirmation || isReserveAwaitingConfirmation) { 
            if (!isDeleteAwaitingConfirmation && !isReserveAwaitingConfirmation) {
                 setActiveDragId(null); 
                 setActiveDragData(null);
                 setIsDraggingGlobally(false);
            }
            return; 
        }
            
        // Дроп не произошел или на себя (остается)
        if (!over || active.id === over.id) {
            setActiveDragId(null);
            setActiveDragData(null);
            setIsDraggingGlobally(false);
            return;
        }

        const draggedData = active.data.current;
        const droppedOnData = over.data.current;
        
        // Логика для зон удаления и резерва
        if (draggedData?.type === 'shift' && droppedOnData && (droppedOnData.type === 'delete-zone' || droppedOnData.type === 'reserve-zone')) {
             const shiftDbId = draggedData?.shiftDbId;
             const courierData = draggedData?.courier; 
             const courierId = courierData?.id; 

             if (shiftDbId && courierData && courierId) {
                 const name = `${courierData.firstName || ''} ${courierData.lastName || ''}`.trim() || 'Курьер';
                 const avatar = courierData.photoUrl || null;
                 const currentCourierInfo: ConfirmedCourierInfo = { id: courierId, name: name, avatar: avatar }; 

                 setTempCourierData(currentCourierInfo); 
                 setProcessingShiftId(shiftDbId); 

                 if (over.id === DELETE_DROP_ZONE_ID && onDeleteShift) {
                     setShiftToDeleteData({ shiftDbId, requesterId, courier: currentCourierInfo });
                     setIsDeleteAwaitingConfirmation(true); 

                 } else if (over.id === RESERVE_DROP_ZONE_ID && onMoveToReserve) {
                      setShiftToReserveData({ shiftDbId, courier: currentCourierInfo });
                      setIsReserveAwaitingConfirmation(true);
                 } else {
                      setProcessingShiftId(null); 
                      setTempCourierData(null);
                      setActiveDragId(null); 
                      setActiveDragData(null);
                 }
             } else {
                 setActiveDragId(null); 
                 setActiveDragData(null);
                 setProcessingShiftId(null);
                 setTempCourierData(null);
             }
        // Логика для перетаскивания на пустой слот
        } else if (draggedData?.type === 'shift' && droppedOnData?.type === 'empty-slot') {
            const shiftDbId = draggedData?.shiftDbId;
            const originalShiftType = draggedData?.shiftType as ('day' | 'night' | null);
            const targetShiftType = droppedOnData?.shiftType as ('day' | 'night' | null);
            const targetSlotIndex = droppedOnData?.slotIndex;
            

            // НОВАЯ ПРОВЕРКА: Предотвращаем дроп на слот старшего курьера
            if (targetSlotIndex === -1) {
                setActiveDragId(null);
                setActiveDragData(null);
                setIsOverDeleteZoneManually(false);
                setIsOverReserveZoneManually(false);
                return;
            }

            // Проверяем все условия
            if (shiftDbId && 
                originalShiftType && 
                targetShiftType && 
                targetSlotIndex !== undefined && 
                originalShiftType !== targetShiftType && 
                isCurrentUserSenior) 
            {
                setIsProcessingMove(true); // Начинаем индикацию загрузки
                setProcessingShiftId(shiftDbId); // Подсвечиваем изменяемую смену
                
                // Устанавливаем слот и тип для отображения лоадера
                setLoadingType(targetShiftType);
                setLoadingSlot(targetSlotIndex);

                try {
                    // Вызываем новую функцию API
                    const updatedShift = await updateShiftSlot(
                        shiftDbId, 
                        requesterId, // Передаем ID старшего курьера
                        targetShiftType, 
                        targetSlotIndex
                    );
                    
                    // Напрямую запрашиваем обновление смен из Redux
                    if (chatId) {
                        dispatch(fetchShifts({ chatId: Number(chatId) }));
                    }
                    
                    if (showNotification) {
                        const courierName = `${draggedData.courier?.firstName || ''} ${draggedData.courier?.lastName || ''}`.trim() || 'Курьер';
                        showNotification(
                            NotificationTypes.SUCCESS,
                            `Смена курьера ${courierName} перемещена на ${targetShiftType === 'day' ? 'дневной' : 'ночной'} слот ${targetSlotIndex + 1}.`
                        );
                    }
                    // UI обновится через WebSocket
                } catch (error: any) {
                    if (showNotification) {
                        showNotification(
                            NotificationTypes.ERROR, 
                            error?.response?.data?.detail || error?.message || 'Ошибка перемещения смены.',
                            'Ошибка API'
                        );
                    }
                } finally {
                    setIsProcessingMove(false); // Завершаем индикацию загрузки
                    setProcessingShiftId(null); // Убираем подсветку
                    // Сбрасываем индикацию лоадера
                    setLoadingType(null);
                    setLoadingSlot(null);
                    // Сбрасываем состояние перетаскивания в любом случае
                    setActiveDragId(null);
                    setActiveDragData(null);
                    // <<< ДОБАВЛЯЕМ СБРОС СОСТОЯНИЯ ЗОН ЗДЕСЬ >>>
                    setIsOverDeleteZoneManually(false);
                    setIsOverReserveZoneManually(false);
                }

            } else {
                setActiveDragId(null); 
                setActiveDragData(null);
                setIsOverDeleteZoneManually(false);
                setIsOverReserveZoneManually(false);
            }
            
        // --- <<< НОВАЯ ЛОГИКА: Перетаскивание курьера из панели на пустой слот >>> ---
        } else if (draggedData?.type === 'courier-from-panel' && droppedOnData?.type === 'empty-slot') {
            const draggedCourier = draggedData?.courier as CourierInfo | undefined;
            const targetShiftType = droppedOnData?.shiftType as ('day' | 'night' | null);
            const targetSlotIndex = droppedOnData?.slotIndex;


            // НОВАЯ ПРОВЕРКА: Предотвращаем дроп на слот старшего курьера
            if (targetSlotIndex === -1) {
                setActiveDragId(null);
                setActiveDragData(null);
                setIsOverDeleteZoneManually(false);
                setIsOverReserveZoneManually(false);
                
                // Показываем уведомление пользователю о невозможности этого действия
                if (showNotification) {
                    showNotification(
                        NotificationTypes.WARNING,
                        'Нельзя назначить обычного курьера на слот старшего курьера'
                    );
                }
                return;
            }

            // Проверяем все необходимые данные и права старшего курьера
            if (draggedCourier && targetShiftType && targetSlotIndex !== undefined && isCurrentUserSenior && chatId && date) {

                // <<< ВМЕСТО ЭТОГО УСТАНАВЛИВАЕМ СОСТОЯНИЕ ДЛЯ ПОДТВЕРЖДЕНИЯ >>>
                setAssignmentToConfirmData({
                    courier: draggedCourier,
                    shiftType: targetShiftType,
                    slotIndex: targetSlotIndex,
                });
                setIsAwaitingAssignmentConfirmation(true);

                // <<< Сбрасываем состояние перетаскивания СРАЗУ >>>
                setActiveDragId(null);
                setActiveDragData(null);
                setIsOverDeleteZoneManually(false);
                setIsOverReserveZoneManually(false);

            } else {
                setActiveDragId(null);
                setActiveDragData(null);
                setIsOverDeleteZoneManually(false);
                setIsOverReserveZoneManually(false);
            }
        // --- Конец новой логики ---
            
        } else {
            setActiveDragId(null); 
            setActiveDragData(null);
            setIsOverDeleteZoneManually(false);
            setIsOverReserveZoneManually(false);
        }


        // После завершения drag-and-drop снова активируем свайп
        setIsSwipeEnabled(true);
    }, [
        // <<< ОБНОВЛЯЕМ ЗАВИСИМОСТИ >>>
        isProcessingDelete, 
        isProcessingReserve, 
        isProcessingMove, // Добавлено
        isDeleteAwaitingConfirmation,
        isReserveAwaitingConfirmation,
        onDeleteShift, 
        onMoveToReserve,
        requesterId, // Добавлен ID текущего пользователя
        isCurrentUserSenior, // Добавлен флаг старшего
        showNotification, // Добавлено для уведомлений
        setShiftToDeleteData,      
        setIsDeleteAwaitingConfirmation,
        setShiftToReserveData,
        setIsReserveAwaitingConfirmation,
        setTempCourierData, 
        setProcessingShiftId,
        setActiveDragId, 
        setActiveDragData, 
        setIsDraggingGlobally,
        setIsOverDeleteZoneManually, 
        setIsOverReserveZoneManually,
        setIsProcessingMove, // Добавлено
        dispatch,
        chatId,
        date,
        currentUserId
    ]);

    // <<< Получаем тип перетаскиваемой смены >>>
    const draggingShiftType = useMemo(() => {
        if (activeDragData?.type === 'shift') {
            return activeDragData.shiftType as ('day' | 'night');
        }
        return null;
    }, [activeDragData]);

    const handleConfirmDelete = useCallback(async () => {
        setIsDraggingGlobally(false); // <<< Сбрасываем флаг перетаскивания
        if (!shiftToDeleteData || !onDeleteShift) {
            setIsDeleteAwaitingConfirmation(false); // Сброс ожидания
            setShiftToDeleteData(null);
            setProcessingShiftId(null); 
            setTempCourierData(null);
            return;
        }

        const { shiftDbId, requesterId, courier } = shiftToDeleteData;
        
        setIsDeleteAwaitingConfirmation(false);
        setIsProcessingDelete(true);

        try {
            await onDeleteShift(shiftDbId, requesterId); // Вызываем API
            
            // <<< ДОБАВЛЯЕМ ДИСПАТЧ ЗДЕСЬ >>>
            dispatch(removeShiftLocally(shiftDbId));
            if (showNotification) {
                showNotification(NotificationTypes.SUCCESS, `Курьер ${courier.name || ''} удален со смены.`);
            }
            setConfirmedDeletedCourier(courier); 
            setIsConfirmingDelete(true); 

            setTimeout(() => {
                setIsConfirmingDelete(false);
                setConfirmedDeletedCourier(null);
                setProcessingShiftId(null); // Сброс после таймера
                setTempCourierData(null);   // Сброс после таймера
            }, 2000);

        } catch (error: any) {
            if (showNotification) {
                showNotification(NotificationTypes.ERROR, `Ошибка удаления курьера ${courier.name || ''}.`, error?.message || 'Ошибка сервера');
            }
            setProcessingShiftId(null); 
            setTempCourierData(null);
        } finally {
            setIsProcessingDelete(false); // Завершаем процессинг
            setShiftToDeleteData(null);   // Очищаем данные для удаления
            setActiveDragId(null); 
            setActiveDragData(null);
        }
    }, [
        shiftToDeleteData, 
        onDeleteShift, 
        showNotification, 
        setConfirmedDeletedCourier, 
        setIsConfirmingDelete, 
        setIsProcessingDelete, 
        setShiftToDeleteData, 
        setIsDeleteAwaitingConfirmation,
        setProcessingShiftId,
        setTempCourierData,
        setActiveDragId,      
        setActiveDragData,     
        requesterId,
        setIsDraggingGlobally,
        dispatch
    ]);

    const handleCancelDelete = useCallback(() => {
        setIsDraggingGlobally(false); // <<< Сбрасываем флаг перетаскивания
        setIsSwipeEnabled(true);
        setIsDeleteAwaitingConfirmation(false);
        setShiftToDeleteData(null);
        setProcessingShiftId(null); 
        setTempCourierData(null);
        setActiveDragId(null); 
        setActiveDragData(null);
    }, [
        setIsDeleteAwaitingConfirmation,
        setShiftToDeleteData, 
        setProcessingShiftId, 
        setTempCourierData,
        setActiveDragId,     
        setActiveDragData,
        setIsDraggingGlobally
    ]);

    // <<< ОБНОВЛЯЕМ ОБРАБОТЧИК ПОДТВЕРЖДЕНИЯ РЕЗЕРВА >>>
    const handleConfirmReserve = useCallback(async () => {
        setIsDraggingGlobally(false);
        if (!shiftToReserveData) {
            setIsReserveAwaitingConfirmation(false);
            setShiftToReserveData(null);
            setProcessingShiftId(null);
            setTempCourierData(null);
            return;
        }
        const { shiftDbId, courier } = shiftToReserveData;
        setIsReserveAwaitingConfirmation(false);
        setIsProcessingReserve(true);
        try {
            // Вместо onMoveToReserve диспатчим moveCourierToReserveThunk
            if (chatId && date) {
                await dispatch(moveCourierToReserveThunk({
                    shiftId: shiftDbId,
                    requesterId,
                    groupTelegramId: Number(chatId),
                    date
                }));
            }
            if (showNotification) {
                showNotification(NotificationTypes.INFO, `Курьер ${courier.name || ''} перемещен в резерв.`);
            }
            setConfirmedReserveCourier(courier);
            setIsConfirmingReserve(true);
            setTimeout(() => {
                setIsConfirmingReserve(false);
                setConfirmedReserveCourier(null);
                setProcessingShiftId(null);
                setTempCourierData(null);
            }, 2000);
        } catch (error: any) {
            if (showNotification) {
                showNotification(NotificationTypes.ERROR, `Ошибка перемещения курьера ${courier.name || ''} в резерв.`, error?.message || 'Ошибка сервера');
            }
            setProcessingShiftId(null);
            setTempCourierData(null);
        } finally {
            setIsProcessingReserve(false);
            setShiftToReserveData(null);
            setActiveDragId(null);
            setActiveDragData(null);
        }
    }, [
        shiftToReserveData,
        requesterId,
        showNotification,
        setIsReserveAwaitingConfirmation,
        setIsProcessingReserve,
        setConfirmedReserveCourier,
        setIsConfirmingReserve,
        setShiftToReserveData,
        setProcessingShiftId,
        setTempCourierData,
        setActiveDragId,
        setActiveDragData,
        setIsDraggingGlobally,
        dispatch,
        chatId,
        date
    ]);

    // <<< Обработчик отмены РЕЗЕРВА >>>
    const handleCancelReserve = useCallback(() => {
        setIsDraggingGlobally(false); // <<< Сбрасываем флаг перетаскивания
        setIsSwipeEnabled(true);
        setIsReserveAwaitingConfirmation(false);
        setShiftToReserveData(null);
        setProcessingShiftId(null);
        setTempCourierData(null);
        setActiveDragId(null); 
        setActiveDragData(null);
    }, [
        setIsReserveAwaitingConfirmation, 
        setShiftToReserveData,
        setProcessingShiftId, 
        setTempCourierData,
        setActiveDragId, 
        setActiveDragData,
        setIsDraggingGlobally
    ]);

    // Определяем тип для источника данных подтверждения
    type ConfirmationDataSource = 
        | { type: 'assignment', data: CourierInfo }
        | { type: 'delete', data: ConfirmedCourierInfo }
        | null;

    // <<< HELPER: Возвращает источник данных для подтверждения >>>
    const getConfirmationDataSource = (): ConfirmationDataSource => {
        if (isAwaitingAssignmentConfirmation && assignmentToConfirmData) {
            return { type: 'assignment', data: assignmentToConfirmData.courier };
        } else if (isDeleteAwaitingConfirmation && shiftToDeleteData) {
            return { type: 'delete', data: shiftToDeleteData.courier };
        } else if (isProcessingDelete && (tempCourierData || shiftToDeleteData)) {
            // Во время обработки удаления приоритет у tempCourierData
            const source = tempCourierData || shiftToDeleteData?.courier;
            if (source) {
                return { type: 'delete', data: source };
            }
        }
        return null; // Возвращаем null, если данных нет
    };
    
    // --- ИЗМЕНЕНИЕ: Определяем данные ПОСЛЕ getConfirmationDataSource ---
    const isDraggingShift = activeDragId && activeDragData?.type === 'shift';
    const isAwaitingDeleteOrAssign = isDeleteAwaitingConfirmation || isAwaitingAssignmentConfirmation;
    const isWorkingOnDeleteOrAssign = isProcessingDelete || isConfirmingDelete || isAwaitingDeleteOrAssign;
    const isWorkingOnReserve = isProcessingReserve || isConfirmingReserve || isReserveAwaitingConfirmation;
    const isAnyZoneWorking = isWorkingOnDeleteOrAssign || isWorkingOnReserve;

    const showZonesContainer = isDraggingShift || isAnyZoneWorking;
    const renderDeleteZone = (isDraggingShift && !isAnyZoneWorking) || isWorkingOnDeleteOrAssign;
    const renderReserveZone = (isDraggingShift && !isAnyZoneWorking) || isWorkingOnReserve;

    const deleteConfirmationDataSource = isWorkingOnDeleteOrAssign ? getConfirmationDataSource() : null;
    // <<< ИЗМЕНЕНИЕ: Используем существующие данные для резерва >>>
    const reserveAwaitingOrProcessingData = isWorkingOnReserve ? (shiftToReserveData?.courier || tempCourierData) : null; 
    // --- КОНЕЦ ОПРЕДЕЛЕНИЯ ДАННЫХ ---

    const isOverDeleteZone = isOverDeleteZoneManually;
    const isOverReserveZone = isOverReserveZoneManually;

    const standardDropAnimation = {
        duration: 300,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)'
    };

    // Добавляем обработчик для открытия профиля
    const handleOpenCourierProfile = useCallback((courier: CourierShift) => {
        
        // Закрываем все диалоги и панели
        if (isConfirmationOpen) {
            setIsConfirmationOpen(false);
            setPendingAction(null);
        }
        
        if (isCouriersPanelOpen) {
            setIsCouriersPanelOpen(false);
            setPanelTargetShiftType(null);
            setPanelTargetSlotIndex(null);
        }
        
        // Останавливаем drag-n-drop
        setIsDraggingGlobally(false);
        setActiveDragId(null);
        setActiveDragData(null);
        
        // Устанавливаем данные курьера и показываем профиль
        setSelectedCourier(courier);
        setShowCourierProfile(true);
    }, [
        isConfirmationOpen, 
        setIsConfirmationOpen, 
        setPendingAction, 
        isCouriersPanelOpen, 
        setIsCouriersPanelOpen,
        setPanelTargetShiftType,
        setPanelTargetSlotIndex,
        setIsDraggingGlobally,
        setActiveDragId,
        setActiveDragData
    ]);
    
    // Добавляем обработчик для закрытия профиля и возврата к списку смен
    const handleCloseProfile = useCallback(() => {
        setShowCourierProfile(false);
        setSelectedCourier(null);
    }, []);

    // Добавляем функцию обновления профиля курьера
    const handleRefreshCourierProfile = useCallback(async () => {
        if (!selectedCourier) return;
        
        setIsProfileRefreshing(true);
        
        if (showNotification) {
            showNotification(
                NotificationTypes.INFO,
                `Обновление информации о курьере ${selectedCourier.firstName} ${selectedCourier.lastName}...`
            );
        }
        
        try {
            const courierIdStr = selectedCourier.userId || (selectedCourier as any).user_id || selectedCourier.id || '';
            const courierIdNum = parseInt(courierIdStr, 10);
            
            if (!courierIdNum) {
                throw new Error('Не удалось определить ID курьера для обновления.');
            }

            const updatedCourierData = await refreshCourierProfileFromTelegram(courierIdStr);
            
            // <<< ДИСПАТЧИМ userProfileUpdatedWs с частичными данными >>>
            const profileUpdate: Partial<import('../../../types/user').User> = {
                first_name: updatedCourierData.first_name,
                last_name: updatedCourierData.last_name,
                photo_url: updatedCourierData.photo_url,
                username: updatedCourierData.username, // Добавим и username на всякий случай
            };

            dispatch(userProfileUpdatedWs({ 
                user_id: courierIdNum, 
                profile: profileUpdate 
            }));
            // --- Убираем обновление локального стейта ---
            
            if (showNotification) {
                showNotification(
                    NotificationTypes.SUCCESS,
                    `Информация о курьере ${updatedCourierData.first_name} ${updatedCourierData.last_name} обновлена`
                );
            }
        } catch (error) {
            if (showNotification) {
                showNotification(
                    NotificationTypes.ERROR,
                    error instanceof Error ? error.message : 'Не удалось обновить профиль курьера из Telegram'
                );
            }
        } finally {
            setIsProfileRefreshing(false);
        }
    }, [selectedCourier, showNotification, setIsProfileRefreshing, dispatch]);

    // <<< ВОЗВРАЩАЕМ ОБРАБОТЧИК ДЛЯ ОТКРЫТИЯ ПАНЕЛИ >>>
    const handleLongPressEmptySlot = useCallback((shiftType: ShiftType, slotIndex: number) => {
        // <<< ПРОВЕРКА: Если панель уже открыта, ничего не делаем >>>
        if (isCouriersPanelOpen) {
            return;
        }
        // <<< Конец проверки >>>
        setPanelTargetShiftType(shiftType);
        setPanelTargetSlotIndex(slotIndex);
        setIsCouriersPanelOpen(true);
        
        // Явно отключаем свайп при открытии панели курьеров
        setIsSwipeEnabled(false);
        
    }, [isCouriersPanelOpen, setPanelTargetShiftType, setPanelTargetSlotIndex, setIsCouriersPanelOpen, setIsSwipeEnabled]); // Добавляем setIsSwipeEnabled в зависимости

    // <<< ВОЗВРАЩАЕМ ОБРАБОТЧИК ДЛЯ ЗАКРЫТИЯ ПАНЕЛИ >>>
    const handleCloseCouriersPanel = useCallback(() => {
        setIsCouriersPanelOpen(false);
        setPanelTargetShiftType(null); // Сбрасываем цель при закрытии
        setPanelTargetSlotIndex(null); // Сбрасываем цель при закрытии

        // Явно включаем свайп при закрытии панели курьеров, если не идет перетаскивание
        if (!isDraggingGlobally) {
            setIsSwipeEnabled(true);
        }
    }, [setIsCouriersPanelOpen, setPanelTargetShiftType, setPanelTargetSlotIndex, isDraggingGlobally, setIsSwipeEnabled]); // Добавляем зависимости

    // <<< НОВЫЙ ОБРАБОТЧИК: Подтверждение назначения курьера >>>
    const handleConfirmAssignment = useCallback(async () => {
        if (!assignmentToConfirmData || !chatId || !date) {
            setIsAwaitingAssignmentConfirmation(false);
            setAssignmentToConfirmData(null);
            setIsDraggingGlobally(false);
            return;
        }

        const { courier, shiftType, slotIndex } = assignmentToConfirmData;
        // Показываем индикацию загрузки
        setLoadingType(shiftType);
        setLoadingSlot(slotIndex);
        setInternalIsBookingLoading(true);

        try {
            await dispatch(assignCourierToShiftThunk({
                assignerId: String(currentUserId),
                courier: courier,
                groupTelegramId: chatId,
                date: format(date, 'yyyy-MM-dd'),
                shiftType: shiftType,
                slotIndex: slotIndex
            })).unwrap();

            if (showNotification) {
                showNotification(
                    NotificationTypes.SUCCESS,
                    `Курьер ${courier.first_name || ''} ${courier.last_name || ''} назначен на ${shiftType === 'day' ? 'дневной' : 'ночной'} слот ${slotIndex + 1}.`
                );
            }
            // Напрямую запрашиваем обновление смен из Redux
            if (chatId) {
                dispatch(fetchShifts({ chatId: Number(chatId) }));
            }
            
        } catch (error: any) {
            if (showNotification) {
                showNotification(
                    NotificationTypes.ERROR,
                    error?.message || 'Ошибка назначения курьера.',
                    'Ошибка назначения'
                );
            }
        } finally {
            // Сбрасываем состояние подтверждения и флаг перетаскивания
            setIsAwaitingAssignmentConfirmation(false);
            setAssignmentToConfirmData(null);
            setIsDraggingGlobally(false);
            // Сбрасываем индикацию загрузки
            setLoadingType(null);
            setLoadingSlot(null);
            setInternalIsBookingLoading(false);
            // Включаем свайп снова
            setIsSwipeEnabled(true);
        }
    }, [assignmentToConfirmData, chatId, date, currentUserId, dispatch, showNotification]);

    // <<< НОВЫЙ ОБРАБОТЧИК: Отмена назначения курьера >>>
    const handleCancelAssignment = useCallback(() => {
        // Включаем свайп снова
        setIsSwipeEnabled(true);
        setIsAwaitingAssignmentConfirmation(false);
        setAssignmentToConfirmData(null);
        setIsDraggingGlobally(false); // Сбрасываем и флаг перетаскивания
    }, []);

    // Добавляем состояния для свайпа
    const [swipeInfo, setSwipeInfo] = useState<SwipeInfo>({
        startX: 0,
        startY: 0,
        isSwiping: false,
        direction: null
    });
    const [isChangingDate, setIsChangingDate] = useState(false);
    const [targetDate, setTargetDate] = useState<Date | null>(null);
    
    // Добавляем контроллер анимации
    const contentAnimControls = useAnimation();

    // Обработчики свайпа
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        // Блокируем свайп, если он отключен или идет смена даты
        if (!onDateChange || isChangingDate || !isSwipeEnabled) return;
        
        const touch = e.touches[0];
        setSwipeInfo({
            startX: touch.clientX,
            startY: touch.clientY,
            isSwiping: true,
            direction: null
        });
    }, [onDateChange, isChangingDate, isSwipeEnabled]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        // Блокируем свайп, если он отключен, не начат или идет смена даты
        if (!swipeInfo.isSwiping || !onDateChange || isChangingDate || !isSwipeEnabled) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - swipeInfo.startX;
        const deltaY = touch.clientY - swipeInfo.startY;
        
        // Проверяем, что свайп больше горизонтальный, чем вертикальный
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            // Определяем направление свайпа
            const direction = deltaX > 0 ? 'right' : 'left';
            
            // Проверяем, не блокировано ли движение в этом направлении
            if ((direction === 'left' && !disableNextDate) || (direction === 'right' && !disablePrevDate)) {
                setSwipeInfo(prev => ({
                    ...prev,
                    direction
                }));
                
                // Применяем анимацию смещения контента
                const offset = Math.min(Math.abs(deltaX), 100) * (direction === 'left' ? -1 : 1);
                contentAnimControls.set({ x: offset });
            }
        }
    }, [swipeInfo, onDateChange, isChangingDate, disablePrevDate, disableNextDate, contentAnimControls, isSwipeEnabled]);

    // Добавляем функцию для сброса всех активных состояний при свайпе
    const resetAllActiveStates = useCallback(() => {
        // Сбрасываем состояние панели курьеров
        if (isCouriersPanelOpen) {
            setIsCouriersPanelOpen(false);
            setPanelTargetShiftType(null);
            setPanelTargetSlotIndex(null);
        }
        
        // Сбрасываем диалоги подтверждения
        if (isConfirmationOpen) {
            setIsConfirmationOpen(false);
            setPendingAction(null);
        }
        
        // Сбрасываем состояние подтверждения удаления
        if (isDeleteAwaitingConfirmation) {
            setIsDeleteAwaitingConfirmation(false);
            setShiftToDeleteData(null);
        }
        
        // Сбрасываем состояние подтверждения резерва
        if (isReserveAwaitingConfirmation) {
            setIsReserveAwaitingConfirmation(false);
            setShiftToReserveData(null);
        }
        
        // Сбрасываем состояние подтверждения назначения
        if (isAwaitingAssignmentConfirmation) {
            setIsAwaitingAssignmentConfirmation(false);
            setAssignmentToConfirmData(null);
        }
        
    }, [
        isCouriersPanelOpen, 
        setIsCouriersPanelOpen,
        setPanelTargetShiftType,
        setPanelTargetSlotIndex,
        isConfirmationOpen,
        setIsConfirmationOpen,
        setPendingAction,
        isDeleteAwaitingConfirmation,
        setIsDeleteAwaitingConfirmation,
        setShiftToDeleteData,
        isReserveAwaitingConfirmation,
        setIsReserveAwaitingConfirmation,
        setShiftToReserveData,
        isAwaitingAssignmentConfirmation,
        setIsAwaitingAssignmentConfirmation,
        setAssignmentToConfirmData
    ]);

    // Обновляем обработчик свайпа с улучшенной анимацией
    const handleTouchEnd = useCallback(async () => {
        // Блокируем свайп, если он отключен или идет смена даты
        if (!swipeInfo.isSwiping || !onDateChange || isChangingDate || !isSwipeEnabled) {
            // Сбрасываем состояние свайпа
            setSwipeInfo({
                startX: 0,
                startY: 0,
                isSwiping: false,
                direction: null
            });
            contentAnimControls.start({ x: 0 });
            return;
        }
        
        const { direction } = swipeInfo;
        
        // Если был определен достаточный свайп с направлением
        if (direction) {
            // Определяем новую дату в зависимости от направления
            const newDate = direction === 'left' 
                ? getAdjacentDate(date, 'next')  // Свайп влево → следующая дата
                : getAdjacentDate(date, 'prev'); // Свайп вправо → предыдущая дата
            
            // Сбрасываем все активные диалоги и панели
            resetAllActiveStates();
            
            // Запускаем анимацию ухода текущего контента
            setIsChangingDate(true);
            setTargetDate(newDate);
            
            // Анимируем исчезновение текущего содержимого в сторону свайпа
            await contentAnimControls.start({ 
                x: direction === 'left' ? -window.innerWidth : window.innerWidth,
                transition: { 
                    duration: 0.25,
                    ease: "easeInOut"
                }
            });
            
            // Вызываем колбэк изменения даты
            onDateChange(newDate);
            
            // Устанавливаем начальную позицию для нового контента
            contentAnimControls.set({ 
                x: direction === 'left' ? window.innerWidth : -window.innerWidth
            });
            
            // Запускаем анимацию появления нового контента
            await contentAnimControls.start({ 
                x: 0,
                transition: { 
                    duration: 0.25,
                    ease: "easeInOut"
                }
            });
            
            // Сбрасываем состояния после завершения анимации
            setIsChangingDate(false);
            setTargetDate(null);
        } else {
            // Если не было достаточного свайпа, возвращаем контент в исходное положение
            contentAnimControls.start({ 
                x: 0,
                transition: { 
                    duration: 0.2,
                    ease: "easeOut"
                }
            });
        }
        
        // Сбрасываем информацию о свайпе
        setSwipeInfo({
            startX: 0,
            startY: 0,
            isSwiping: false,
            direction: null
        });
    }, [swipeInfo, onDateChange, isChangingDate, date, contentAnimControls, resetAllActiveStates, isSwipeEnabled]);

    // Упрощаем эффект, убираем анимацию слотов при монтировании
    useEffect(() => {
        // Ничего не делаем при монтировании, убираем анимацию появления
    }, [isOpen]);

    // Добавляем эффект для отслеживания глобального состояния перетаскивания
    useEffect(() => {
        // Когда перетаскивание заканчивается, включаем свайп снова
        if (!isDraggingGlobally) {
            setIsSwipeEnabled(true);
        }
    }, [isDraggingGlobally]);

    // Добавляем эффект для отключения свайпа при открытой панели курьеров
    useEffect(() => {
        if (isCouriersPanelOpen) {
            setIsSwipeEnabled(false);
        } else if (!isDraggingGlobally) {
            // Включаем свайп только если не идет перетаскивание
            setIsSwipeEnabled(true);
        }
    }, [isCouriersPanelOpen, isDraggingGlobally]);

    // В начале компонента ShiftSelectionDialog, после объявления всех useMemo и состояний
    // Добавим логирование даты при каждом рендере
    useEffect(() => {
        if (isOpen && date) {
            const dayOfWeek = date.getDay();
        }
    }, [isOpen, date]);

    return (
        <DndContext 
            sensors={sensors} 
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            collisionDetection={pointerWithin}
        >
            <BottomDrawer
                isOpen={isOpen}
                onClose={onClose}
                title={
                    showCourierProfile && selectedCourier 
                        ? `Профиль курьера` 
                        : (date ? `Смены на ${format(date, 'd MMMM yyyy', { locale: ru })}` : 'Выберите дату')
                }
                customHeader={showCourierProfile && selectedCourier ? (
                    <ProfileHeaderContainer>
                        <CourierInfoContainer>
                            <CourierPhoto>
                                {(() => {
                                    const userIdNum = selectedCourier?.userId ? parseInt(String(selectedCourier.userId), 10) : null;
                                    const latestUserData = userIdNum ? usersById[userIdNum] : null;
                                    const photoUrl = latestUserData?.photo_url || (selectedCourier as any)?.photoUrl || (selectedCourier as any)?.photo_url;
                                    return (
                                        <img 
                                            src={photoUrl || defaultAvatar} // <<< Используем defaultAvatar
                                            alt="Фото курьера"
                                            onError={(e) => {
                                                const img = e.target as HTMLImageElement;
                                                img.src = defaultAvatar; // <<< Используем defaultAvatar
                                            }}
                                        />
                                    );
                                })()}
                                {selectedCourierIsSenior && <SeniorCourierBadge />}
                            </CourierPhoto>
                            <CourierName>
                                {(() => {
                                    const userIdNum = selectedCourier?.userId ? parseInt(String(selectedCourier.userId), 10) : null;
                                    const latestUserData = userIdNum ? usersById[userIdNum] : null;
                                    const firstName = latestUserData?.first_name || selectedCourier?.firstName || '';
                                    const lastName = latestUserData?.last_name || selectedCourier?.lastName || '';
                                    return `${firstName} ${lastName}`.trim();
                                })()}
                            </CourierName>
                        </CourierInfoContainer>
                        <HeaderButtonsContainer>
                            <RefreshButton
                                $isRefreshing={isProfileRefreshing}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isProfileRefreshing) {
                                        handleRefreshCourierProfile();
                                    }
                                }}
                                disabled={isProfileRefreshing}
                                aria-label={isProfileRefreshing ? "Обновление профиля..." : "Обновить профиль"}
                            >
                                <RefreshIcon $isRefreshing={isProfileRefreshing}>
                                    ⟳
                                </RefreshIcon> 
                            </RefreshButton>
                            <CloseButton
                                onClick={onClose}
                                aria-label="Закрыть"
                            >
                                <svg 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor"
                                >
                                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </CloseButton>
                        </HeaderButtonsContainer>
                        <HeaderDivider />
                    </ProfileHeaderContainer>
                ) : undefined}
            >
                {/* Индикатор свайпа показывается только при активном свайпе */}
                {swipeInfo.direction && !showCourierProfile && (
                    <SwipeIndicator direction={swipeInfo.direction} />
                )}
                
                {/* Постоянный индикатор дня недели */}
                {!showCourierProfile && (
                    <DateIndicator>
                        {format(date, 'EEEE', { locale: ru })}
                    </DateIndicator>
                )}
                
                {/* Оборачиваем основной контент в SwipeableContent для анимации */}
                <SwipeableContent
                    animate={contentAnimControls}
                    onTouchStart={!showCourierProfile ? handleTouchStart : undefined}
                    onTouchMove={!showCourierProfile ? handleTouchMove : undefined}
                    onTouchEnd={!showCourierProfile ? handleTouchEnd : undefined}
                >
                    {/* Рендерим зоны только если не показываем профиль */}
                    {!showCourierProfile && showZonesContainer ? ( 
                        <FlexContainer> 
                            {renderDeleteZone && ( 
                                <DeleteDropZone 
                                    isOver={isOverDeleteZone}
                                    isProcessing={isProcessingDelete}
                                    isConfirming={isConfirmingDelete}
                                    courierData={confirmedDeletedCourier} // Для галочки успеха
                                    confirmationDataSource={deleteConfirmationDataSource} // Передаем общие данные
                                    isAwaitingConfirmation={isAwaitingDeleteOrAssign} // Передаем флаг ожидания
                                    onConfirm={isAwaitingAssignmentConfirmation ? handleConfirmAssignment : handleConfirmDelete} 
                                    onCancel={isAwaitingAssignmentConfirmation ? handleCancelAssignment : handleCancelDelete}
                                    confirmationType={isAwaitingAssignmentConfirmation ? 'assignment' : 'delete'}
                                />
                            )}
                            {renderReserveZone && ( 
                                <ReserveDropZone 
                                    isOver={isOverReserveZone}
                                    isProcessing={isProcessingReserve} 
                                    isConfirming={isConfirmingReserve} 
                                    confirmedCourierData={confirmedReserveCourier} // Для галочки успеха
                                    courierAwaitingActionData={reserveAwaitingOrProcessingData} // Передаем данные для ожидания/обработки
                                    isAwaitingConfirmation={isReserveAwaitingConfirmation} // Передаем флаг ожидания
                                    onConfirm={handleConfirmReserve}
                                    onCancel={handleCancelReserve}
                                />
                            )}
                        </FlexContainer>
                    ) : !showCourierProfile && (
                        null 
                    )}

                    {!showCourierProfile && reserveError && <Alert severity="error" sx={{ mb: 2 }}>{reserveError}</Alert>} 
                    
                    {/* Показываем профиль курьера или панели смен/резерва */}
                    {showCourierProfile && selectedCourier ? (
                        <div style={{ padding: '10px 0' }}>
                            <CourierProfile 
                                isSeniorCourier={(selectedCourier as any)?.isSeniorCourier ?? false}
                                targetUserId={selectedCourier.userId}
                                hideOwnStatus={true}
                            />
                            
                            {/* <<< ПЕРЕМЕЩАЕМ БЛОК "В РАЗРАБОТКЕ" СЮДА >>> */}
                            <DevelopmentNotice>
                                <AnimatedGearIcon>⚙️</AnimatedGearIcon>
                                <DevelopmentText>Функционал в разработке</DevelopmentText>
                            </DevelopmentNotice>

                            <button 
                                style={{ 
                                    marginTop: '20px',
                                    padding: '12px 20px',
                                    backgroundColor: 'var(--primary-color)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 'var(--radius)',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    width: '100%',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={handleCloseProfile}
                            >
                                Вернуться к списку смен
                            </button>
                        </div>
                    ) : (
                        <div style={{ width: '100%' }}>
                            {shiftDialogMode === 'shifts' ? (
                                isConfirmationOpen && pendingAction ? (
                                    <ShiftConfirmationDialog
                                        isOpen={isConfirmationOpen}
                                        onCancel={handleCloseConfirmation}
                                        onConfirm={handleConfirmAction}
                                        date={date}
                                        pendingShift={pendingAction}
                                        userName={currentUserName}
                                        userAvatar={currentUserAvatar}
                                    />
                                ) : (
                                    <ShiftPanel
                                        date={date}
                                        dayShifts={dayShifts}
                                        nightShifts={nightShifts}
                                        maxDaySlots={currentMaxDay}
                                        maxNightSlots={currentMaxNight}
                                        currentUserId={currentUserId}
                                        currentUserName={currentUserName}
                                        onSlotSelect={handleSlotSelectWrapper}
                                        onSwitchToReserve={() => dispatch(setShiftDialogMode('reserves'))}
                                        showSuccessMessage={showSuccessMessage}
                                        showErrorMessage={(message) => {
                                            if (showNotification) {
                                                showNotification(NotificationTypes.ERROR, message);
                                            } else {
                                                logger.error("[ShiftSelectionDialog] showNotification is undefined, cannot display error:", message);
                                            }
                                        }}
                                        isLoading={internalIsBookingLoading}
                                        loadingSlot={loadingSlot}
                                        loadingType={loadingType}
                                        chatId={chatId}
                                        isSenior={isCurrentUserSenior}
                                        draggingShiftType={draggingShiftType}
                                        isDraggingGlobal={isDraggingGlobally}
                                        processingShiftId={processingShiftId}
                                        isProcessingMove={isProcessingMove}
                                        onOpenProfile={handleOpenCourierProfile}
                                        // <<< ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ ПРОПСЫ >>>
                                        onLongPressEmptySlot={handleLongPressEmptySlot}
                                        isCouriersPanelOpen={isCouriersPanelOpen}
                                        panelTargetShiftType={panelTargetShiftType}
                                        panelTargetSlotIndex={panelTargetSlotIndex}
                                        onCloseCouriersPanel={handleCloseCouriersPanel}
                                        activeDragId={activeDragId}
                                        hasSeniorSlot={currentHasSeniorSlot}
                                    />
                                )
                            ) : (
                                <ReservePanel
                                    date={date}
                                    currentUserId={currentUserId}
                                    currentUserAvatar={currentUserAvatar}
                                    currentUserName={currentUserName}
                                    dayShifts={dayShifts}
                                    nightShifts={nightShifts}
                                    onSwitchToShifts={() => dispatch(setShiftDialogMode('shifts'))}
                                    getDisplayReservesForDate={getDisplayReservesForDate}
                                    isCurrentUserInReserveForDate={isCurrentUserInReserveForDate}
                                    addCurrentUserToReserve={addCurrentUserToReserve}
                                    cancelReserveById={cancelReserveById}
                                    isLoading={isReserveLoading}
                                    error={reserveError}
                                    showSuccessMessage={showSuccessMessage}
                                    chatId={chatId}
                                    isCurrentUserSenior={isCurrentUserSenior}
                                />
                            )}
                        </div>
                    )}
                </SwipeableContent>
            </BottomDrawer>

            <DragOverlay 
                style={{ pointerEvents: 'none' }} 
                className="drag-overlay"
                zIndex={9999}
                dropAnimation={isProcessingMove ? null : standardDropAnimation}
            >
                {activeDragId && activeDragData && (
                    activeDragData.type === 'shift' && activeDragData.courier ? (
                        <CourierDragAvatar courier={activeDragData.courier} />
                    ) : activeDragData.type === 'courier-from-panel' && activeDragData.courier ? (
                        <CourierIcon courier={activeDragData.courier} />
                    ) : null
                )}
            </DragOverlay>
        </DndContext>
    );
});

export default ShiftSelectionDialog; 