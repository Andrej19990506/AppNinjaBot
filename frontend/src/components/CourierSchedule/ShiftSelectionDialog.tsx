import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import styled, { css } from 'styled-components';
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
import { selectUser } from '../../store/slices/userSlice';
import { NotificationTypes } from '../../store/slices/notificationSlice';
// @ts-ignore
import { DndContext, KeyboardSensor, useSensor, useSensors, DragEndEvent, MouseSensor, TouchSensor, DragOverlay, DragStartEvent, pointerWithin, DragOverEvent } from '@dnd-kit/core';
import Alert from '@mui/material/Alert';
import CourierDragAvatar from './components/CourierDragAvatar';
import DeleteDropZone, { DELETE_DROP_ZONE_ID } from './DeleteDropZone';
import ReserveDropZone, { RESERVE_DROP_ZONE_ID } from './ReserveDropZone';
// Импортируем новую функцию API
import { moveShiftToReserve, updateShiftSlot } from '../../services/courierApi';

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
}

interface PendingShiftAction {
    shiftType: 'day' | 'night';
    slotIndex: number;
}

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
}) => {
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

    const user = useSelector(selectUser);
    const isCurrentUserSenior = useMemo(() => {
        if (!user || !user.groups || !chatId) {
            return false;
        }
        const currentGroup = user.groups.find(group => String(group.chat_id) === String(chatId));
        const isSenior = currentGroup?.is_senior_courier ?? false;
        logger.debug(`[ShiftSelectionDialog] Computed isCurrentUserSenior for chatId ${chatId}: ${isSenior}`);
        return isSenior;
    }, [user, chatId]);

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
                title={date ? `Смены на ${format(date, 'd MMMM yyyy', { locale: ru })}` : 'Выберите дату'}
            >
                {/* Рендерим либо контейнер зон, либо кнопки */} 
                {showZones ? (
                    <FlexContainer> 
                        {/* Передаем renderDeleteZone/renderReserveZone для условного рендеринга */} 
                        {renderDeleteZone && (
                            <DeleteDropZone 
                                isOver={isOverDeleteZone}
                                isProcessing={isProcessingDelete} 
                                isConfirming={isConfirmingDelete} 
                                courierData={confirmedDeletedCourier} 
                                // Используем данные из shiftToDeleteData ИЛИ tempCourierData
                                processingCourierData={shiftToDeleteData?.courier || tempCourierData}
                                isAwaitingConfirmation={isDeleteAwaitingConfirmation} // Переименовано
                                onConfirm={handleConfirmDelete} 
                                onCancel={handleCancelDelete}
                            />
                        )}
                        {renderReserveZone && (
                            <ReserveDropZone 
                                isOver={isOverReserveZone}
                                isProcessing={isProcessingReserve} 
                                isConfirming={isConfirmingReserve} 
                                confirmedCourierData={confirmedReserveCourier} // Для галочки
                                // Для ожидания/обработки используем shiftToReserveData или tempCourierData
                                courierAwaitingActionData={shiftToReserveData?.courier || tempCourierData}
                                isAwaitingConfirmation={isReserveAwaitingConfirmation} // Новое состояние
                                onConfirm={handleConfirmReserve} // Новый обработчик
                                onCancel={handleCancelReserve} // Новый обработчик
                            />
                        )}
                    </FlexContainer>
                ) : (
                    /* Обычные кнопки переключения режимов */
                    <ModeSwitchContainer>
                        <ModeButton
                            $active={mode === 'shifts'}
                            onClick={() => setModeWrapper('shifts')}
                            disabled={internalIsBookingLoading || isConfirmationOpen} // Убираем зависимость от зон
                        >
                            {"Смены"}
                        </ModeButton>
                        <ModeButton
                            $active={mode === 'reserves'}
                            onClick={() => setModeWrapper('reserves')}
                            disabled={internalIsBookingLoading || isConfirmationOpen} // Убираем зависимость от зон
                        >
                            Резерв
                        </ModeButton>
                    </ModeSwitchContainer>
                )}

                {reserveError && <Alert severity="error" sx={{ mb: 2 }}>{reserveError}</Alert>} 
                        
                {mode === 'shifts' ? (
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