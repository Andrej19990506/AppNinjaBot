import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { ReserveEntry, CourierShift } from '../../types/shifts';
import { WeeklySlotConfig } from '../../store/slices/shiftsSlice';
import { SLOTS_CONFIG } from './CourierCalendar/constants';
import { format } from 'date-fns';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import { ru } from 'date-fns/locale';
import BottomDrawer from './components/BottomDrawer';
import ShiftConfirmationDialog from './components/ShiftConfirmationDialog';
import { logger } from '../../utils/logger';
import { useSelector } from 'react-redux';
import { selectUser, userProfileUpdatedWs, selectUsersById } from '../../store/slices/userSlice';
import { NotificationTypes } from '../../store/slices/notificationSlice';
// @ts-ignore
import { DndContext, KeyboardSensor, useSensor, useSensors, DragEndEvent, MouseSensor, TouchSensor, DragOverlay, DragStartEvent, pointerWithin, DragOverEvent } from '@dnd-kit/core';
import Alert from '@mui/material/Alert';
import CourierDragAvatar from './components/CourierDragAvatar';
import DeleteDropZone, { DELETE_DROP_ZONE_ID } from './DeleteDropZone';
import ReserveDropZone, { RESERVE_DROP_ZONE_ID } from './ReserveDropZone';
// Импортируем новую функцию API
import { moveShiftToReserve, updateShiftSlot } from '../../services/courierApi';
import CourierProfile from '../../components/CourierProfile/CourierProfile';
import { CourierShift as CourierShiftType } from './CourierCalendar/types';
// Импортируем функцию для обновления профиля
import { refreshCourierProfileFromTelegram } from '../../services/courierApi';
// <<< Добавляем useAppDispatch >>>
import { useAppDispatch } from '../../store/hooks';
// <<< Добавляем импорт User >>>
import { User } from '../../types/user';
// <<< ДОБАВЛЯЕМ ИМПОРТ defaultAvatar >>>
import defaultAvatar from '../../assets/images/Ninja.jpg';

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

// Define type for confirmed courier data
interface ConfirmedCourierInfo {
    id: string;
    name: string;
    avatar: string | null;
}

// <<< ИНТЕРФЕЙС ДЛЯ ДАННЫХ, ОЖИДАЮЩИХ ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ >>>
interface ShiftToDeleteData {
    shiftDbId: string;
    requesterId: string;
    courier: ConfirmedCourierInfo;
}

// <<< НОВЫЙ ИНТЕРФЕЙС ДЛЯ ДАННЫХ, ОЖИДАЮЩИХ ПОДТВЕРЖДЕНИЯ РЕЗЕРВА >>>
interface ShiftToReserveData {
    shiftDbId: string;
    courier: ConfirmedCourierInfo;
}

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

// <<< НОВЫЙ КОМПОНЕНТ: Блок "В разработке" >>>
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
// <<< КОНЕЦ НОВОГО КОМПОНЕНТА >>>

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
    onShiftDeletedLocally,
    showNotification,
    onOpenProfile
}) => {
    const dispatch = useAppDispatch(); // <<< Инициализируем dispatch
    const [mode, setMode] = useState<'shifts' | 'reserves'>('shifts');
    const [internalIsBookingLoading, setInternalIsBookingLoading] = useState(false);
    const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
    const [loadingType, setLoadingType] = useState<'day' | 'night' | null>(null);
    
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingShiftAction | null>(null);
    const [initialModeSet, setInitialModeSet] = useState(false);
    
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [activeDragData, setActiveDragData] = useState<any | null>(null);
    const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
    const [isOverDeleteZoneManually, setIsOverDeleteZoneManually] = useState(false);
    const [isOverReserveZoneManually, setIsOverReserveZoneManually] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [confirmedDeletedCourier, setConfirmedDeletedCourier] = useState<ConfirmedCourierInfo | null>(null);
    const [isConfirmingReserve, setIsConfirmingReserve] = useState(false);
    const [confirmedReserveCourier, setConfirmedReserveCourier] = useState<ConfirmedCourierInfo | null>(null);
    
    // New states for processing
    const [isProcessingDelete, setIsProcessingDelete] = useState(false);
    const [isProcessingReserve, setIsProcessingReserve] = useState(false);
    const [processingShiftId, setProcessingShiftId] = useState<string | null>(null);
    const [tempCourierData, setTempCourierData] = useState<ConfirmedCourierInfo | null>(null);

    // <<< Состояния для подтверждения УДАЛЕНИЯ (переименовано) >>>
    const [isDeleteAwaitingConfirmation, setIsDeleteAwaitingConfirmation] = useState(false);
    const [shiftToDeleteData, setShiftToDeleteData] = useState<ShiftToDeleteData | null>(null);

    // <<< НОВЫЕ СОСТОЯНИЯ ДЛЯ ПОДТВЕРЖДЕНИЯ РЕЗЕРВА >>>
    const [isReserveAwaitingConfirmation, setIsReserveAwaitingConfirmation] = useState(false);
    const [shiftToReserveData, setShiftToReserveData] = useState<ShiftToReserveData | null>(null);

    // <<< НОВОЕ СОСТОЯНИЕ ДЛЯ ОБРАБОТКИ ПЕРЕМЕЩЕНИЯ СЛОТА >>>
    const [isProcessingMove, setIsProcessingMove] = useState(false);

    // Добавляем состояние для отображения профиля курьера
    const [selectedCourier, setSelectedCourier] = useState<CourierShift | null>(null);
    const [showCourierProfile, setShowCourierProfile] = useState(false);

    // Добавляем состояние загрузки для кнопки обновления профиля
    const [isProfileRefreshing, setIsProfileRefreshing] = useState(false);

    const user = useSelector(selectUser);
    const usersById = useSelector(selectUsersById);
    const isCurrentUserSenior = useMemo(() => {
        if (!user || !user.groups || !chatId) {
            return false;
        }
        const currentGroup = user.groups.find(group => String(group.chat_id) === String(chatId));
        const isSenior = currentGroup?.is_senior_courier ?? false;
        logger.debug(`[ShiftSelectionDialog] Computed isCurrentUserSenior for chatId ${chatId}: ${isSenior}`);
        return isSenior;
    }, [user, chatId]);

    const selectedCourierIsSenior = useMemo(() => {
        if (!selectedCourier) return false;
        return (selectedCourier as any).isSeniorCourier === true || (selectedCourier as any).is_senior_courier === true;
    }, [selectedCourier]);

    logger.debug(`[ShiftSelectionDialog] Rendering component. Current mode: ${mode}, isOpen: ${isOpen}, initialModeSet: ${initialModeSet}`);

    useEffect(() => {
        logger.debug(`[ShiftSelectionDialog] useEffect [isOpen, initialModeSet] running. isOpen: ${isOpen}, initialModeSet: ${initialModeSet}`);
        if (isOpen && !initialModeSet) {
            logger.debug('[ShiftSelectionDialog] Condition Met (isOpen && !initialModeSet): Setting mode to shifts and initialModeSet to true.');
            setMode('shifts');
            setInitialModeSet(true);
        }
        else if (!isOpen && initialModeSet) {
            logger.debug('[ShiftSelectionDialog] Condition Met (!isOpen && initialModeSet): Dialog closed, resetting initialModeSet to false.');
            setInitialModeSet(false);
        } else {
            logger.debug('[ShiftSelectionDialog] Conditions NOT met for mode/initialModeSet change in this effect.');
        }
    }, [isOpen, initialModeSet]);

    const showSuccessMessage = (message: string) => {
        console.log('[ShiftSelectionDialog] showSuccessMessage:', message);
    };

    const handleSlotSelectWrapper = useCallback((
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        logger.info('[ShiftSelectionDialog] Slot clicked, preparing to open confirmation for:', { shiftType, slotIndex });
        setTimeout(() => {
            setPendingAction({ shiftType, slotIndex });
            setIsConfirmationOpen(true);
            logger.info('[ShiftSelectionDialog] Confirmation dialog opened after delay.');
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
            logger.info(`[ShiftSelectionDialog] Подтверждение действия: бронирование ${shiftType} слота ${slotIndex}`);
            await onSlotSelect(shiftType, slotIndex);
            logger.info(`[ShiftSelectionDialog] Бронирование смены успешно завершено.`);
            bookingSuccess = true;

        } catch (error) {
            logger.error('[ShiftSelectionDialog] Ошибка при подтверждении действия (бронировании смены):', error);
        } finally {
            setLoadingType(null);
            setLoadingSlot(null);
            setInternalIsBookingLoading(false);
            if (bookingSuccess) {
                 setIsConfirmationOpen(false);
                 setPendingAction(null);
            }
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

    const setModeWrapper = useCallback((newMode: 'shifts' | 'reserves') => {
        setMode(prevMode => {
            logger.debug(`[ShiftSelectionDialog] setMode called. Previous: ${prevMode}, Requested New: ${newMode}`);
            return newMode;
        });
    }, [setMode]);

    const dayIndex = date.getDay();
    const dayConfig = slotConfig ? slotConfig[dayIndex] : undefined;
    const currentMaxDay = dayConfig?.maxDaySlots ?? SLOTS_CONFIG.DAY.MAX_SLOTS;
    const currentMaxNight = dayConfig?.maxNightSlots ?? SLOTS_CONFIG.NIGHT.MAX_SLOTS;

    const sensors = useSensors(
        useSensor(KeyboardSensor, {
        }),
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                distance: 10,
            },
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        logger.debug('[ShiftSelectionDialog] Drag Start Event:', event);
        setActiveDragId(active.id as string);
        setIsDraggingGlobally(true);
        setIsOverDeleteZoneManually(false);
        setIsOverReserveZoneManually(false);
        setIsConfirmingDelete(false);
        setConfirmedDeletedCourier(null);
        setIsConfirmingReserve(false);
        setConfirmedReserveCourier(null);
        
        if (active.data.current) {
            setActiveDragData(active.data.current);
            logger.debug('[ShiftSelectionDialog] Active Drag Data:', active.data.current);
        }
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        const overId = over?.id;

        const isOverDelete = overId === DELETE_DROP_ZONE_ID;
        const isOverReserve = overId === RESERVE_DROP_ZONE_ID;

        // Update states based on which zone is hovered (or none)
        setIsOverDeleteZoneManually(isOverDelete);
        setIsOverReserveZoneManually(isOverReserve);

        // Keep console logs for debugging
        console.log(`[handleDragOver] Over ID: ${overId}, isOverDelete: ${isOverDelete}, isOverReserve: ${isOverReserve}`);
        
        // Log DragOverlay style (can be removed later)
        const overlayElement = document.querySelector('.drag-overlay'); 
        if (overlayElement) {
            try {
                const computedStyle = window.getComputedStyle(overlayElement);
                const pointerEvents = computedStyle.getPropertyValue('pointer-events');
                console.log(`[handleDragOver] DragOverlay pointer-events: ${pointerEvents}`);
            } catch (e) {
                console.error("Error getting overlay computed style:", e);
            }
        } else {
            console.log("[handleDragOver] DragOverlay element not found by selector");
        }
    }, [setIsOverDeleteZoneManually, setIsOverReserveZoneManually]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        logger.debug(`[DndContext] DragEnd Event: active.id=${active.id}, over.id=${over?.id}`);

        // <<< Сброс isOver... в начале ОСТАВЛЯЕМ >>>
        setIsOverDeleteZoneManually(false);
        setIsOverReserveZoneManually(false);

        // Проверка на активные процессы (остается)
        if (isProcessingDelete || isProcessingReserve || isProcessingMove || isDeleteAwaitingConfirmation || isReserveAwaitingConfirmation) { 
            logger.warn('[DndContext] Drag ended while another action is processing or awaiting confirmation. Ignoring.');
            // Важно: НЕ сбрасываем isDraggingGlobally здесь, если ждем подтверждения
            if (!isDeleteAwaitingConfirmation && !isReserveAwaitingConfirmation) {
                 setActiveDragId(null); 
                 setActiveDragData(null);
                 setIsDraggingGlobally(false);
            }
            return; 
        }
            
        // Дроп не произошел или на себя (остается)
        if (!over || active.id === over.id) {
            logger.debug('[DndContext] Drag ended over nothing or self. Resetting drag states.');
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
                     logger.info(`[DndContext] Item dropped on delete zone. Shift ID: ${shiftDbId}. Awaiting confirmation...`);
                     setShiftToDeleteData({ shiftDbId, requesterId, courier: currentCourierInfo });
                     setIsDeleteAwaitingConfirmation(true); 

                 } else if (over.id === RESERVE_DROP_ZONE_ID && onMoveToReserve) {
                      logger.info(`[DndContext] Item dropped on reserve zone. Shift ID: ${shiftDbId}. Awaiting confirmation...`);
                      setShiftToReserveData({ shiftDbId, courier: currentCourierInfo });
                      setIsReserveAwaitingConfirmation(true);
                 } else {
                      // Это условие не должно сработать из-за проверки droppedOnData.type выше, но оставим на всякий случай
                      logger.debug(`[DndContext] Drop zone logic error.`);
                      setProcessingShiftId(null); 
                      setTempCourierData(null);
                      setActiveDragId(null); 
                      setActiveDragData(null);
                 }
             } else {
                 logger.debug(`[DndContext] Drop on zone - missing shift/courier data.`);
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
            
            logger.info(`[DndContext] Shift dropped on empty slot. Shift ID: ${shiftDbId}, Original Type: ${originalShiftType}, Target Type: ${targetShiftType}, Target Index: ${targetSlotIndex}`);

            // Проверяем все условия
            if (shiftDbId && 
                originalShiftType && 
                targetShiftType && 
                targetSlotIndex !== undefined && 
                originalShiftType !== targetShiftType && 
                isCurrentUserSenior) 
            {
                logger.info(`[DndContext] Valid drop onto different type slot by senior. Initiating move...`);
                setIsProcessingMove(true); // Начинаем индикацию загрузки
                setProcessingShiftId(shiftDbId); // Подсвечиваем изменяемую смену

                try {
                    // Вызываем новую функцию API
                    const updatedShift = await updateShiftSlot(
                        shiftDbId, 
                        requesterId, // Передаем ID старшего курьера
                        targetShiftType, 
                        targetSlotIndex
                    );
                    logger.info(`[DndContext] Shift slot updated successfully via API.`, updatedShift);
                    if (showNotification) {
                        const courierName = `${draggedData.courier?.firstName || ''} ${draggedData.courier?.lastName || ''}`.trim() || 'Курьер';
                        showNotification(
                            NotificationTypes.SUCCESS,
                            `Смена курьера ${courierName} перемещена на ${targetShiftType === 'day' ? 'дневной' : 'ночной'} слот ${targetSlotIndex + 1}.`
                        );
                    }
                    // UI обновится через WebSocket
                } catch (error: any) {
                    logger.error(`[DndContext] Error updating shift slot via API:`, error);
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
                    // Сбрасываем состояние перетаскивания в любом случае
                    setActiveDragId(null); 
                    setActiveDragData(null);
                    // <<< ДОБАВЛЯЕМ СБРОС СОСТОЯНИЯ ЗОН ЗДЕСЬ >>>
                    setIsOverDeleteZoneManually(false);
                    setIsOverReserveZoneManually(false);
                }

            } else {
                logger.debug(`[DndContext] Invalid drop on empty slot (same type, not senior, or missing data).`);
                setActiveDragId(null); 
                setActiveDragData(null);
                // <<< Также сбрасываем состояние зон здесь >>>
                setIsOverDeleteZoneManually(false);
                setIsOverReserveZoneManually(false);
            }
            
        } else {
            // Остальные случаи (например, перетаскивание не того типа)
            logger.debug(`[DndContext] Drag ended over invalid target or with invalid draggable type.`);
            setActiveDragId(null); 
            setActiveDragData(null);
            // <<< И здесь сбрасываем состояние зон >>>
            setIsOverDeleteZoneManually(false);
            setIsOverReserveZoneManually(false);
        }

        // Финальный сброс isDraggingGlobally теперь не нужен

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
        setIsProcessingMove // Добавлено
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
            logger.error('[ShiftSelectionDialog] handleConfirmDelete called without shiftToDeleteData or onDeleteShift handler.');
            setIsDeleteAwaitingConfirmation(false); // Сброс ожидания
            setShiftToDeleteData(null);
            setProcessingShiftId(null); 
            setTempCourierData(null);
            return;
        }

        const { shiftDbId, requesterId, courier } = shiftToDeleteData;
        
        logger.info(`[ShiftSelectionDialog] Confirming delete for shift ID: ${shiftDbId}`);
        setIsDeleteAwaitingConfirmation(false); // Убираем ожидание
        setIsProcessingDelete(true);      // Начинаем процессинг (спиннер)
        // tempCourierData и processingShiftId уже установлены из handleDragEnd

        try {
            await onDeleteShift(shiftDbId, requesterId); // Вызываем API
            
            logger.info(`[DndContext] Delete request successful for ${shiftDbId}. Showing confirmation.`);
            if (showNotification) {
                showNotification(NotificationTypes.SUCCESS, `Курьер ${courier.name || ''} удален со смены.`);
            }
            // Используем данные из shiftToDeleteData для подтверждения
            setConfirmedDeletedCourier(courier); 
            setIsConfirmingDelete(true); 

            setTimeout(() => {
                setIsConfirmingDelete(false);
                setConfirmedDeletedCourier(null);
                setProcessingShiftId(null); // Сброс после таймера
                setTempCourierData(null);   // Сброс после таймера
                logger.debug("[DndContext] Delete confirmation timeout finished.");
            }, 2000);

        } catch (error: any) {
            logger.error(`[DndContext] Delete request failed for ${shiftDbId}:`, error);
            if (showNotification) {
                showNotification(NotificationTypes.ERROR, `Ошибка удаления курьера ${courier.name || ''}.`, error?.message || 'Ошибка сервера');
            }
            // Сброс при ошибке
            setProcessingShiftId(null); 
            setTempCourierData(null);
        } finally {
            setIsProcessingDelete(false); // Завершаем процессинг
            setShiftToDeleteData(null);   // Очищаем данные для удаления
            // Сбрасываем ID перетаскивания после завершения обработки
            setActiveDragId(null); 
            setActiveDragData(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setIsDraggingGlobally
    ]);

    // <<< Обработчик отмены УДАЛЕНИЯ >>>
    const handleCancelDelete = useCallback(() => {
        setIsDraggingGlobally(false); // <<< Сбрасываем флаг перетаскивания
        logger.info('[ShiftSelectionDialog] Cancelling delete confirmation.');
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
        setIsDraggingGlobally(false); // <<< Сбрасываем флаг перетаскивания
        if (!shiftToReserveData) {
            logger.error('[ShiftSelectionDialog] handleConfirmReserve called without shiftToReserveData.');
            setIsReserveAwaitingConfirmation(false); 
            setShiftToReserveData(null);
            setProcessingShiftId(null); 
            setTempCourierData(null);
            return;
        }
        
        const { shiftDbId, courier } = shiftToReserveData;
        logger.info(`[ShiftSelectionDialog] Confirming move to reserve for shift ID: ${shiftDbId}, Courier: ${courier.name}`);
        
        setIsReserveAwaitingConfirmation(false); 
        setIsProcessingReserve(true); 
        
        try {
            // <<< ВЫЗЫВАЕМ НОВУЮ ФУНКЦИЮ API >>>
            // Передаем shiftDbId и requesterId (который пришел в пропсах)
            const createdReserve = await moveShiftToReserve(shiftDbId, requesterId);
            logger.info(`[ShiftSelectionDialog] Reserve request successful via API for ${shiftDbId}. Showing confirmation.`, createdReserve);

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
                logger.debug("[ShiftSelectionDialog] Reserve confirmation timeout finished.");
            }, 2000);

        } catch (error: any) {
            logger.error(`[ShiftSelectionDialog] Reserve request failed for ${shiftDbId}:`, error);
            if (showNotification) {
                // Используем сообщение из ошибки API
                showNotification(NotificationTypes.ERROR, `Ошибка перемещения курьера ${courier.name || ''} в резерв.`, error?.message || 'Ошибка сервера'); 
            }
            setProcessingShiftId(null); 
            setTempCourierData(null);
        } finally {
            setIsProcessingReserve(false);
            setShiftToReserveData(null); 
            setActiveDragId(null); 
            setActiveDragData(null);
            logger.debug("[ShiftSelectionDialog] Reserve processing finished.");
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
        setIsDraggingGlobally
    ]);

    // <<< Обработчик отмены РЕЗЕРВА >>>
    const handleCancelReserve = useCallback(() => {
        setIsDraggingGlobally(false); // <<< Сбрасываем флаг перетаскивания
        logger.info('[ShiftSelectionDialog] Cancel reserve action triggered.');
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

    // --- ФИНАЛЬНАЯ, ЕЩЕ БОЛЕЕ ПРОСТАЯ ЛОГИКА ВИДИМОСТИ ЗОН/КНОПОК --- 
    
    const isAwaitingAnyConfirmation = isDeleteAwaitingConfirmation || isReserveAwaitingConfirmation;
    
    // Показываем область зон, если есть активное перетаскивание ИЛИ ожидается подтверждение
    // Используем activeDragId вместо isDraggingGlobally для большей точности момента
    const showZones = Boolean(activeDragId) || isAwaitingAnyConfirmation;

    // Логика видимости КОНКРЕТНЫХ зон внутри контейнера (если showZones=true)
    // Показываем зону УДАЛЕНИЯ, если:
    // 1. Идет перетаскивание (activeDragId есть) И НЕТ ожидания подтверждения ИЛИ
    // 2. Ожидается подтверждение ИМЕННО для удаления.
    const renderDeleteZone = (Boolean(activeDragId) && !isAwaitingAnyConfirmation) || isDeleteAwaitingConfirmation;
    
    // Показываем зону РЕЗЕРВА, если:
    // 1. Идет перетаскивание (activeDragId есть) И НЕТ ожидания подтверждения ИЛИ
    // 2. Ожидается подтверждение ИМЕННО для резерва.
    const renderReserveZone = (Boolean(activeDragId) && !isAwaitingAnyConfirmation) || isReserveAwaitingConfirmation;
    // --- КОНЕЦ ФИНАЛЬНОЙ ЛОГИКИ --- 

    const isOverDeleteZone = isOverDeleteZoneManually;
    const isOverReserveZone = isOverReserveZoneManually;

    const standardDropAnimation = {
        duration: 300,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)'
    };

    // Добавляем обработчик для открытия профиля
    const handleOpenCourierProfile = useCallback((courier: CourierShift) => {
        setSelectedCourier(courier);
        setShowCourierProfile(true);
    }, []);
    
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
            const profileUpdate: Partial<import('../../types/user').User> = {
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
            logger.error(`[ShiftSelectionDialog] Ошибка при обновлении профиля курьера:`, error);
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
                                    // <<< ИСПОЛЬЗУЕМ defaultAvatar как fallback >>>
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
                {/* Рендерим зоны только если не показываем профиль */}
                {!showCourierProfile && showZones ? (
                    <FlexContainer> 
                        {renderDeleteZone && (
                            <DeleteDropZone 
                                isOver={isOverDeleteZone}
                                isProcessing={isProcessingDelete} 
                                isConfirming={isConfirmingDelete} 
                                courierData={confirmedDeletedCourier} 
                                processingCourierData={shiftToDeleteData?.courier || tempCourierData}
                                isAwaitingConfirmation={isDeleteAwaitingConfirmation}
                                onConfirm={handleConfirmDelete} 
                                onCancel={handleCancelDelete}
                            />
                        )}
                        {renderReserveZone && (
                            <ReserveDropZone 
                                isOver={isOverReserveZone}
                                isProcessing={isProcessingReserve} 
                                isConfirming={isConfirmingReserve} 
                                confirmedCourierData={confirmedReserveCourier}
                                courierAwaitingActionData={shiftToReserveData?.courier || tempCourierData}
                                isAwaitingConfirmation={isReserveAwaitingConfirmation}
                                onConfirm={handleConfirmReserve}
                                onCancel={handleCancelReserve}
                            />
                        )}
                    </FlexContainer>
                ) : !showCourierProfile && (
                    <ModeSwitchContainer>
                        <ModeButton
                            $active={mode === 'shifts'}
                            onClick={() => setModeWrapper('shifts')}
                            disabled={internalIsBookingLoading || isConfirmationOpen}
                        >
                            {"Смены"}
                        </ModeButton>
                        <ModeButton
                            $active={mode === 'reserves'}
                            onClick={() => setModeWrapper('reserves')}
                            disabled={internalIsBookingLoading || isConfirmationOpen}
                        >
                            Резерв
                        </ModeButton>
                    </ModeSwitchContainer>
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
                    mode === 'shifts' ? (
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
                                onSwitchToReserve={() => setModeWrapper('reserves')}
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
                            onSwitchToShifts={() => setModeWrapper('shifts')}
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
                    )
                )}
            </BottomDrawer>

            <DragOverlay 
                style={{ pointerEvents: 'none' }} 
                className="drag-overlay"
                zIndex={9999}
                dropAnimation={isProcessingMove ? null : standardDropAnimation}
            >
                {activeDragId && activeDragData?.courier ? (
                    <CourierDragAvatar courier={activeDragData.courier} />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
});

export default ShiftSelectionDialog; 