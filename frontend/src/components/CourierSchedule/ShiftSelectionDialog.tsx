import React, { useState, useEffect, useReducer } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { ReserveShift } from '../../types/shifts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDispatch, useSelector } from 'react-redux';
import { cancelShift, removeFromReserve } from '../../store/slices/shiftsSlice';
import { AppDispatch, RootState } from '../../store/store';
import { socketService } from '../../services/socket';

interface ShiftSlot {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
}

const DialogOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    backdrop-filter: blur(4px);
`;

const DialogContent = styled.div`
    background: var(--card-background);
    border-radius: var(--radius);
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    animation: slideUp 0.3s ease;

    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
`;

const DialogHeader = styled.div`
    margin-bottom: 24px;
    text-align: center;
`;

const DialogTitle = styled.h2`
    margin: 0;
    color: var(--text-color);
    font-size: 1.5rem;
    font-weight: 600;
`;

const DialogDate = styled.div`
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-top: 8px;
`;

const ShiftSection = styled.div`
    margin-bottom: 24px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const ShiftTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: var(--text-color);
    font-size: 1.2rem;
    font-weight: 500;
`;

const ShiftIcon = styled.span`
    font-size: 1.4rem;
`;

const SlotsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 12px;
    justify-items: center;
`;

const SlotButton = styled.button<{ $isOccupied?: boolean }>`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px dashed ${props => props.$isOccupied ? 'transparent' : 'var(--primary-color)'};
    background: ${props => props.$isOccupied ? 'transparent' : 'rgba(76, 175, 80, 0.05)'};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    &:hover {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(1.05)'};
        background: ${props => props.$isOccupied ? 'transparent' : 'rgba(76, 175, 80, 0.1)'};
    }

    &:active {
        transform: ${props => props.$isOccupied ? 'none' : 'scale(0.95)'};
    }
`;

const PlusIcon = styled.div`
    color: var(--primary-color);
    font-size: 1.8rem;
    font-weight: 300;
`;

const CourierAvatar = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
`;

const CloseButton = styled.button`
    position: absolute;
    top: 16px;
    right: 16px;
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

const SuccessNotification = styled.div`
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(76, 175, 80, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideDown 0.3s ease;
    z-index: 1200;

    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`;

const CheckIcon = styled.span`
    font-size: 1.2rem;
`;

const SlotTooltip = styled.div`
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;

    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.8);
    }
`;

const SlotButtonWrapper = styled.div`
    position: relative;
    
    &:hover ${SlotTooltip} {
        opacity: 1;
    }
`;

const ReserveSection = styled.div`
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
`;

const ReserveButton = styled.button`
    width: 100%;
    padding: 12px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
    }
`;

const ReserveList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
`;

const ReserveItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: var(--background);
    border-radius: var(--radius);
`;

const ReserveAvatar = styled.img`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
`;

const ReserveInfo = styled.div`
    flex: 1;
`;

const ReserveName = styled.div`
    font-weight: 500;
    color: var(--text-color);
`;

const ReserveDate = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
`;

const NoSlotsMessage = styled.div`
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1.5;
    background: var(--background);
    border-radius: var(--radius);
    margin-bottom: 24px;
`;

const ReserveGrid = styled(SlotsGrid)`
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    margin: 24px 0;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 16px;
`;

const BookButton = styled(ReserveButton)`
    background: var(--primary-color);
    
    &:hover {
        background: var(--primary-dark);
    }
`;

const ReserveActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
`;

const CancelButton = styled(ReserveButton)`
    background: #f44336;
    
    &:hover {
        background: #d32f2f;
    }
`;

const DialogFooter = styled.div`
    margin-top: 24px;
`;

interface ShiftSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    dayShifts: ShiftSlot[];
    nightShifts: ShiftSlot[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => void;
    onReserveSelect: () => void;
    onCancelReserve?: (reserveId: string) => void;
    reserves: ReserveShift[];
}

const ShiftSelectionDialog: React.FC<ShiftSelectionDialogProps> = ({
    isOpen,
    onClose,
    date,
    dayShifts,
    nightShifts,
    maxDaySlots,
    maxNightSlots,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    onReserveSelect,
    onCancelReserve,
    reserves = []
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const [selectedSlots, setSelectedSlots] = useState<{
        type: 'day' | 'night';
        index: number;
    } | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [localDayShifts, setLocalDayShifts] = useState(dayShifts);
    const [localNightShifts, setLocalNightShifts] = useState(nightShifts);
    const [isReserveMode, setIsReserveMode] = useState(false);
    const [reserveState, setReserveState] = useState<{
        isReserved: boolean;
        reserveId?: string;
        isPending?: boolean;
    } | null>(null);

    // Получаем резервы из Redux store
    const allReserves = useSelector((state: RootState) => state.shifts.reserves);
    // Получаем все смены из Redux store для проверки
    const shiftsFromRedux = useSelector((state: RootState) => state.shifts.shifts);
    
    const currentUserReserve = allReserves.find(
        reserve => String(reserve.userId) === String(currentUserId) && reserve.date === format(date, 'yyyy-MM-dd')
    );

    // Отслеживаем состояние загрузки для операций отмены смены
    const shiftsLoading = useSelector((state: RootState) => state.shifts.loading);

    // Отслеживаем события WebSocket для reserve_deleted
    // Важно: этот хук должен выполняться при каждом рендере безусловно
    useEffect(() => {
        console.log('[ShiftSelectionDialog] Setting up WebSocket listeners');
        
        // Явно подписываемся на событие reserve_deleted для обработки при переходе из резерва в смену
        const handleReserveDeleted = (data: { reserve_id: string }) => {
            console.log('[ShiftSelectionDialog] Received reserve_deleted event:', data);
            
            // Явно проверяем, принадлежит ли удаленный резерв текущему пользователю
            const deletedReserveId = data.reserve_id;
            const userReserveId = reserveState?.reserveId || 
                                  currentUserReserve?.id;
            
            if (userReserveId && deletedReserveId === userReserveId) {
                console.log('[ShiftSelectionDialog] Clearing local reserve state after WebSocket event');
                setReserveState(null);
                
                // Если находимся в режиме резерва, переключаемся обратно в режим смен
                if (isReserveMode) {
                    console.log('[ShiftSelectionDialog] Switching back to shift mode after reserve deletion');
                    setIsReserveMode(false);
                }
                
                // Обновляем UI
                forceUpdate();
            }
        };
        
        // Подписываемся на событие
        socketService.on('reserve_deleted', handleReserveDeleted);
        
        // Отписываемся при размонтировании
        return () => {
            console.log('[ShiftSelectionDialog] Cleaning up WebSocket listeners');
            socketService.off('reserve_deleted', handleReserveDeleted);
        };
    }, [currentUserId, isReserveMode, reserveState, currentUserReserve]);

    console.log('[ShiftSelectionDialog] Render with props:', { 
        isOpen, 
        currentUserId,
        reserves: reserves.length,
        isReserveMode,
        reserveState,
        currentUserReserve,
        shiftsLoading
    });

    // Отслеживаем операции отмены смены и резерва в Redux
    useEffect(() => {
        // Пропускаем лишние обновления при первоначальной загрузке
        if (shiftsLoading) {
            console.log('[ShiftSelectionDialog] Skipping update during loading');
            return;
        }

        // Отслеживаем изменения в Redux-состоянии
        console.log('[ShiftSelectionDialog] Redux state changed - shifts or reserves updated');
        
        // Проверка, находится ли пользователь в резерве
        const userInReserve = reserves.some(
            reserve => String(reserve.userId) === String(currentUserId) && 
                      reserve.date === format(date, 'yyyy-MM-dd')
        );
        
        // Проверка, находится ли пользователь в сменах (в Redux)
        const dateString = format(date, 'yyyy-MM-dd');
        const userInDayShifts = dayShifts.some(shift => String(shift.userId) === String(currentUserId));
        const userInNightShifts = nightShifts.some(shift => String(shift.userId) === String(currentUserId));
        const userHasShift = userInDayShifts || userInNightShifts;
        
        console.log('[ShiftSelectionDialog] User state - reserve:', userInReserve, 
            'day:', userInDayShifts, 'night:', userInNightShifts);
        
        // Обновляем локальное состояние смен, если изменились входные данные
        // и не происходит сейчас отмена резерва
        const isHandlingReserveCancel = reserveState?.isPending;
        
        if (!isHandlingReserveCancel) {
            // ВАЖНО: Если одновременно есть и резерв, и смена, приоритет отдаем смене
            // и не обновляем состояние резерва
            if (userInReserve && !userHasShift) {
                // Обновляем состояние резерва только если у пользователя нет активной смены
                const currentUserReserve = reserves.find(
                    reserve => String(reserve.userId) === String(currentUserId) && 
                            reserve.date === format(date, 'yyyy-MM-dd')
                );
                
                if (currentUserReserve) {
                    console.log('[ShiftSelectionDialog] Updating reserve state:', currentUserReserve);
                    setReserveState({
                        isReserved: true,
                        reserveId: String(currentUserReserve.id)
                    });
                }
            } else if (userHasShift && userInReserve) {
                // Если пользователь одновременно имеет и смену, и резерв - удаляем резерв из локального состояния
                console.log('[ShiftSelectionDialog] User has both shift and reserve, prioritizing shift');
                
                // Очищаем состояние резерва в локальном состоянии
                if (reserveState?.isReserved) {
                    console.log('[ShiftSelectionDialog] Clearing local reserve state because user has active shift');
                    setReserveState(null);
                }
                
                // Находясь в режиме резерва, переключаемся в режим смен
                if (isReserveMode) {
                    console.log('[ShiftSelectionDialog] Switching from reserve mode to shift mode due to active shift');
                    setIsReserveMode(false);
                }
            } else if (reserveState?.isReserved && !userInReserve) {
                // Если локальное состояние говорит, что он в резерве, но в Redux его нет - сбрасываем
                console.log('[ShiftSelectionDialog] User not in reserve anymore, clearing reserve state');
                setReserveState(null);
            }
            
            // ВАЖНОЕ ИЗМЕНЕНИЕ: Всегда обновляем локальные смены из Redux, даже если у пользователя есть резерв
            // Это позволит видеть свои смены, даже если пользователь также находится в резерве
            const shouldUpdateDayShifts = JSON.stringify(localDayShifts) !== JSON.stringify(dayShifts);
            const shouldUpdateNightShifts = JSON.stringify(localNightShifts) !== JSON.stringify(nightShifts);
            
            if (shouldUpdateDayShifts) {
                console.log('[ShiftSelectionDialog] Updating local day shifts from Redux');
                setLocalDayShifts([...dayShifts]);
            }
            
            if (shouldUpdateNightShifts) {
                console.log('[ShiftSelectionDialog] Updating local night shifts from Redux');
                setLocalNightShifts([...nightShifts]);
            }
            
            if (shouldUpdateDayShifts || shouldUpdateNightShifts) {
                forceUpdate();
            }
        } else {
            console.log('[ShiftSelectionDialog] Skipping state update while handling reserve cancel');
        }
    }, [dayShifts, nightShifts, reserves, currentUserId, date, shiftsLoading, isReserveMode]);

    // Добавляем эффект для отслеживания изменений isOpen
    useEffect(() => {
        console.log('[ShiftSelectionDialog] Dialog open state changed:', isOpen);
        if (!isOpen) {
            // Сбрасываем состояния при закрытии
            setShowSuccess(false);
            setSelectedSlots(null);
            setIsReserveMode(false); // Сбрасываем режим резерва при закрытии
        }
    }, [isOpen]);

    // Предотвращаем закрытие диалога во время обработки резерва
    const handleClose = () => {
        console.log('[ShiftSelectionDialog] handleClose called');
        console.log('[ShiftSelectionDialog] Current states:', {
            reserveState: reserveState,
            showSuccess: showSuccess,
            selectedSlots: selectedSlots
        });
        
        // Не закрываем, если в процессе бронирования или создания резерва
        if (reserveState?.isPending) {
            console.log('[ShiftSelectionDialog] Not closing - reserve is pending');
            return;
        }
        
        // Не закрываем, если отображается сообщение об успехе
        if (showSuccess) {
            console.log('[ShiftSelectionDialog] Not closing - success message is showing');
            return;
        }

        // Сбрасываем все локальные состояния
        setSelectedSlots(null);
        setIsReserveMode(false);
        
        // Вызываем функцию закрытия
        onClose();
    };

    if (!isOpen) return null;

    // Проверяем, все ли слоты заняты
    const totalSlots = maxDaySlots + maxNightSlots;
    const occupiedSlots = dayShifts.length + nightShifts.length;
    const isFullyBooked = occupiedSlots >= totalSlots;

    const handleSlotSelect = async (shiftType: 'day' | 'night', slotIndex: number) => {
        console.log('[ShiftSelectionDialog] handleSlotSelect called:', { shiftType, slotIndex });
        
        const currentUserIdStr = String(currentUserId);
        
        // Устанавливаем slotSelection для индикации последнего действия пользователя
        console.log('[ShiftSelectionDialog] Setting selectedSlots');
        setSelectedSlots({ type: shiftType, index: slotIndex });
        
        // Если пользователь был в режиме резерва, переключаем обратно на режим смен
        if (isReserveMode) {
            console.log('[ShiftSelectionDialog] Switching from reserve mode to shift mode');
            setIsReserveMode(false);
        }
        
        try {
            // Проверяем, есть ли у пользователя активный резерв
            const userHasReserve = reserveState?.isReserved || !!currentUserReserve;
            
            // Проверяем, есть ли у пользователя уже смена на эту дату в локальном состоянии
            const userDayShift = dayShifts.find(shift => String(shift.userId) === currentUserIdStr);
            const userNightShift = nightShifts.find(shift => String(shift.userId) === currentUserIdStr);
            
            // Проверяем, есть ли у пользователя смена в Redux store
            const dateString = format(date, 'yyyy-MM-dd');
            const userShiftInRedux = shiftsFromRedux.find(
                shift => shift.date === dateString && 
                String(shift.userId) === currentUserIdStr
            );
            
            console.log('[ShiftSelectionDialog] User shift in Redux:', userShiftInRedux);
            
            // Если пользователь уже имеет смену этого типа и того же индекса, не делаем ничего
            if ((shiftType === 'day' && userDayShift?.slotIndex === slotIndex) ||
                (shiftType === 'night' && userNightShift?.slotIndex === slotIndex)) {
                console.log('[ShiftSelectionDialog] User already has this exact shift, doing nothing');
                return;
            }
            
            // 1. ВАЖНЫЙ ШАГ: Если пользователь в резерве, сначала отменяем резерв
            if (userHasReserve) {
                console.log('[ShiftSelectionDialog] User has active reserve, canceling before booking shift');
                let reserveIdToCancel: string | undefined;
                
                if (reserveState?.reserveId) {
                    reserveIdToCancel = reserveState.reserveId;
                } else if (currentUserReserve) {
                    reserveIdToCancel = String(currentUserReserve.id);
                }
                
                if (reserveIdToCancel && !reserveIdToCancel.startsWith('temp-')) {
                    try {
                        // Устанавливаем флаг, что происходит отмена резерва
                        setReserveState(prev => prev ? { 
                            ...prev, 
                            isPending: true 
                        } : { 
                            isReserved: false, 
                            isPending: true 
                        });
                        
                        // ВАЖНО: Отправляем событие через WebSocket для удаления из резерва
                        // Это необходимо сделать ДО создания новой смены
                        console.log('[ShiftSelectionDialog] Removing from reserve via WebSocket:', reserveIdToCancel);
                        
                        // Используем dispatch для отправки WebSocket события и дожидаемся его выполнения
                        const result = await dispatch(removeFromReserve({
                            reserveId: reserveIdToCancel,
                            userId: currentUserIdStr
                        }));
                        
                        // Проверяем успешность операции
                        if (removeFromReserve.fulfilled.match(result)) {
                            console.log('[ShiftSelectionDialog] Successfully removed from reserve via WebSocket:', result.payload);
                        } else {
                            console.error('[ShiftSelectionDialog] Failed to remove from reserve:', result.error);
                            throw new Error('Failed to remove from reserve');
                        }
                        
                        // Сбрасываем состояние резерва - важно сделать это немедленно
                        setReserveState(null);
                        
                        // Очищаем локальное состояние смен для подготовки к созданию новой
                        setLocalDayShifts(prev => prev.filter(shift => String(shift.userId) !== currentUserIdStr));
                        setLocalNightShifts(prev => prev.filter(shift => String(shift.userId) !== currentUserIdStr));
                        
                        // Принудительно обновляем компонент
                        forceUpdate();
                        
                        // Важно: дожидаемся обработки удаления резерва на сервере
                        // Увеличиваем задержку для надежности коммуникации с сервером
                        await new Promise(resolve => setTimeout(resolve, 800));
                    } catch (error) {
                        console.error('[ShiftSelectionDialog] Error canceling reserve:', error);
                        
                        // Сбрасываем флаг ожидания, но продолжаем процесс
                        setReserveState(prev => prev ? {
                            ...prev,
                            isPending: false
                        } : {
                            isReserved: false,
                            isPending: false
                        });
                        
                        // Продолжаем с бронированием смены, даже если была ошибка с отменой резерва
                        // В худшем случае у пользователя будет и резерв, и смена, но это решится в следующем useEffect
                        console.log('[ShiftSelectionDialog] Continuing with booking shift despite reserve cancel error');
                    }
                }
            }

            // 2. ВАЖНЫЙ ШАГ: После отмены резерва, ВСЕГДА создаем новую смену
            // Это предотвращает проблему с обновлением несуществующей смены
            console.log('[ShiftSelectionDialog] Creating a new shift after reserve was canceled');
            
            // Никогда не передаем существующий ID смены, всегда создаем новую
            // undefined вместо existingShiftId гарантирует создание новой смены
            onSlotSelect(shiftType, slotIndex, undefined);
            
            // 3. Оптимистично обновляем UI, не дожидаясь ответа сервера
            // Обновляем локальное состояние UI - создаем новую виртуальную смену
            const newShift: ShiftSlot = {
                userId: currentUserIdStr,
                slotIndex,
                shiftType,
                firstName: currentUserName || '',
                lastName: '',
                photo_url: currentUserAvatar || null
            };
            
            // Очищаем все предыдущие смены пользователя и добавляем новую
            const updatedDayShifts = dayShifts.filter(shift => String(shift.userId) !== currentUserIdStr);
            const updatedNightShifts = nightShifts.filter(shift => String(shift.userId) !== currentUserIdStr);
            
            if (shiftType === 'day') {
                setLocalDayShifts([...updatedDayShifts, newShift]);
                setLocalNightShifts(updatedNightShifts);
            } else {
                setLocalDayShifts(updatedDayShifts);
                setLocalNightShifts([...updatedNightShifts, newShift]);
            }
            
            // Принудительно обновляем компонент
            forceUpdate();
            
            // Показываем уведомление об успехе
            setSuccessMessage('Вы успешно записались на смену');
            setShowSuccess(true);
            
            // Скрываем уведомление через 3 секунды
            setTimeout(() => {
                console.log('[ShiftSelectionDialog] Setting showSuccess to false');
                setShowSuccess(false);
                // Еще раз обновляем компонент
                forceUpdate();
            }, 3000);
        } catch (error) {
            console.error('[ShiftSelectionDialog] Error in handleSlotSelect:', error);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    };

    const renderSlots = (shifts: ShiftSlot[], maxSlots: number, shiftType: 'day' | 'night') => {
        const slots = [];
        const currentUserIdStr = String(currentUserId);
        
        // Создаем новую копию массива shifts для рендеринга
        // Это гарантирует, что мы используем самые актуальные данные
        const currentShifts = [...shifts];
        
        // Проверяем, есть ли у текущего пользователя смена в этот день
        // Важно: используем текущее состояние из Redux для точного отображения
        const userHasShiftInCurrentType = currentShifts.some(shift => String(shift.userId) === currentUserIdStr);
        
        // Для кросс-проверки с другим типом смены
        const userHasDayShift = shiftType === 'day' 
            ? userHasShiftInCurrentType 
            : dayShifts.some(shift => String(shift.userId) === currentUserIdStr);
        
        const userHasNightShift = shiftType === 'night' 
            ? userHasShiftInCurrentType 
            : nightShifts.some(shift => String(shift.userId) === currentUserIdStr);
        
        // Для отладки логируем информацию о сменах пользователя
        console.log(`[ShiftSelectionDialog] Rendering ${shiftType} slots:`, {
            userHasDayShift,
            userHasNightShift,
            shiftsCount: currentShifts.length
        });
        
        for (let i = 0; i < maxSlots; i++) {
            // Определяем, есть ли смена для этого слота
            const slot = currentShifts.find(shift => shift.slotIndex === i);
            
            // Определяем, должен ли слот быть заблокирован
            const hasSlot = !!slot;
            const isCurrentUserSlot = slot && String(slot.userId) === currentUserIdStr;
            
            // Слот должен быть заблокирован если:
            // 1. Он занят другим пользователем
            // 2. Пользователь уже имеет другую смену этого типа
            let isDisabled = false;
            
            if (hasSlot && !isCurrentUserSlot) {
                // Слот занят другим пользователем
                isDisabled = true;
            } else if (!hasSlot && shiftType === 'day' && userHasDayShift && !isCurrentUserSlot) {
                // Пользователь уже имеет дневную смену с другим индексом
                isDisabled = true;
            } else if (!hasSlot && shiftType === 'night' && userHasNightShift && !isCurrentUserSlot) {
                // Пользователь уже имеет ночную смену с другим индексом
                isDisabled = true;
            }
            
            // Для отладки выводим информацию о каждом слоте
            console.log(`[ShiftSelectionDialog] Rendering ${shiftType} slot ${i}:`, {
                hasSlot,
                isCurrentUserSlot,
                isDisabled,
                slot: slot || null
            });
            
            // Определяем текст подсказки
            let tooltipText = '';
            if (hasSlot && !isCurrentUserSlot) {
                tooltipText = `Занято курьером ${slot?.firstName} ${slot?.lastName}`;
            } else if ((shiftType === 'day' && userHasDayShift && !isCurrentUserSlot) || 
                      (shiftType === 'night' && userHasNightShift && !isCurrentUserSlot)) {
                tooltipText = `Вы уже записаны на ${shiftType === 'day' ? 'дневную' : 'вечернюю'} смену`;
            }
            
            // Теперь добавляем слот с правильными стилями
            slots.push(
                <SlotButtonWrapper key={i}>
                    {tooltipText && <SlotTooltip>{tooltipText}</SlotTooltip>}
                    <SlotButton
                        $isOccupied={hasSlot}
                        onClick={() => !isDisabled && handleSlotSelect(shiftType, i)}
                        disabled={isDisabled}
                        style={{
                            opacity: isDisabled && !isCurrentUserSlot ? 0.5 : 1,
                            cursor: isDisabled && !isCurrentUserSlot ? 'not-allowed' : 'pointer',
                            border: isCurrentUserSlot ? '2px solid var(--primary-color)' : 
                                    hasSlot ? 'transparent' : '2px dashed var(--primary-color)',
                            background: isCurrentUserSlot ? 'rgba(76, 175, 80, 0.1)' : 
                                      hasSlot ? 'transparent' : 'rgba(76, 175, 80, 0.05)'
                        }}
                    >
                        {hasSlot ? (
                            <CourierAvatar
                                src={slot?.photo_url || defaultAvatar}
                                alt={`${slot?.firstName} ${slot?.lastName}`}
                                onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.src = defaultAvatar;
                                }}
                                style={{
                                    border: isCurrentUserSlot ? 
                                        '2px solid var(--primary-color)' : 
                                        '2px solid var(--border-color)'
                                }}
                            />
                        ) : !isDisabled ? (
                            <PlusIcon>+</PlusIcon>
                        ) : null}
                    </SlotButton>
                </SlotButtonWrapper>
            );
        }
        return slots;
    };

    const handleReserveClick = async () => {
        console.log('[ShiftSelectionDialog] handleReserveClick called');
        
        // Проверяем, есть ли у пользователя активная смена
        const userDayShift = localDayShifts.find(shift => String(shift.userId) === String(currentUserId));
        const userNightShift = localNightShifts.find(shift => String(shift.userId) === String(currentUserId));
        
        // Если есть активная смена, отменяем её
        if (userDayShift?.id || userNightShift?.id) {
            console.log('[ShiftSelectionDialog] Canceling existing shift before adding to reserve');
            const shiftId = userDayShift?.id || userNightShift?.id;
            const shiftType = userDayShift ? 'day' : 'night';
            
            if (shiftId) {
                try {
                    await dispatch(cancelShift(shiftId));
                    console.log('[ShiftSelectionDialog] Existing shift canceled successfully');
                    
                    // Обновляем локальное состояние, убирая пользователя из смены
                    if (shiftType === 'day') {
                        const updatedDayShifts = localDayShifts.filter(shift => String(shift.userId) !== String(currentUserId));
                        console.log('[ShiftSelectionDialog] Updated day shifts after cancel:', updatedDayShifts);
                        setLocalDayShifts(updatedDayShifts);
                    } else {
                        const updatedNightShifts = localNightShifts.filter(shift => String(shift.userId) !== String(currentUserId));
                        console.log('[ShiftSelectionDialog] Updated night shifts after cancel:', updatedNightShifts);
                        setLocalNightShifts(updatedNightShifts);
                    }
                    
                    // Принудительно обновляем компонент для отражения изменений в UI
                    forceUpdate();
                } catch (error) {
                    console.error('[ShiftSelectionDialog] Error canceling existing shift:', error);
                    // Продолжаем процесс добавления в резерв даже если не удалось отменить смену
                }
            }
        }
        
        // Вызываем onReserveSelect для добавления в резерв
        onReserveSelect();
        
        // Сразу устанавливаем временное состояние резерва до получения ответа от сервера
        const tempReserveId = `temp-${Date.now()}`;
        setReserveState({
            isReserved: true,
            reserveId: tempReserveId,
            isPending: true // Отмечаем, что резерв в процессе создания
        });
        
        // Показываем уведомление об успехе
        setSuccessMessage('Вы успешно записались в резерв');
        setShowSuccess(true);
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
            console.log('[ShiftSelectionDialog] Hiding success notification');
            setShowSuccess(false);
            
            // Обновляем состояние резерва, указывая, что он больше не в процессе создания
            setReserveState(prevState => 
                prevState ? { ...prevState, isPending: false } : null
            );
            
            // Еще раз принудительно обновляем компонент
            forceUpdate();
        }, 3000);
    };

    const handleCancelReserve = async () => {
        console.log('[ShiftSelectionDialog] handleCancelReserve called');
        
        try {
            // Определяем ID резерва для отмены
            let reserveIdToCancel: string | undefined;
            
            if (reserveState?.reserveId) {
                reserveIdToCancel = reserveState.reserveId;
            } else if (currentUserReserve) {
                reserveIdToCancel = String(currentUserReserve.id);
            }
            
            if (reserveIdToCancel && !reserveIdToCancel.startsWith('temp-')) {
                console.log('[ShiftSelectionDialog] Canceling reserve with ID:', reserveIdToCancel);
                
                // Немедленно обновляем локальное состояние
                setReserveState(null);
                
                // Вызываем dispatch для отправки WebSocket события напрямую
                await dispatch(removeFromReserve({
                    reserveId: reserveIdToCancel,
                    userId: String(currentUserId)
                }));
                
                console.log('[ShiftSelectionDialog] Reserve cancellation dispatched via WebSocket');
                
                // Показываем уведомление об успехе отмены
                setSuccessMessage('Резерв успешно отменен');
                setShowSuccess(true);
                
                // Скрываем уведомление через 3 секунды
                setTimeout(() => {
                    setShowSuccess(false);
                    
                    // Если пользователь находится в режиме резерва, переключаем его обратно в режим смен
                    if (isReserveMode) {
                        console.log('[ShiftSelectionDialog] Switching back to shift mode after reserve cancellation');
                        setIsReserveMode(false);
                    }
                    
                    // Принудительно обновляем компонент
                    forceUpdate();
                }, 3000);
            } else {
                console.log('[ShiftSelectionDialog] No valid reserve ID to cancel, temporary reserve, or no cancel function');
                
                // Сбрасываем локальное состояние резерва в любом случае
                setReserveState(null);
                
                // Переключаемся в режим выбора смены
                if (isReserveMode) {
                    setIsReserveMode(false);
                }
                
                // Принудительно обновляем компонент
                forceUpdate();
            }
        } catch (error) {
            console.error('[ShiftSelectionDialog] Error in handleCancelReserve:', error);
            // Сбрасываем состояние даже в случае ошибки
            setReserveState(null);
            if (isReserveMode) {
                setIsReserveMode(false);
            }
        }
    };

    const toggleReserveMode = () => {
        console.log('[ShiftSelectionDialog] toggleReserveMode:', !isReserveMode);
        setIsReserveMode(!isReserveMode);
        // Сбрасываем выбранный слот при переключении режима
        setSelectedSlots(null);
    };

    const renderReserveContent = () => {
        // Определяем, имеет ли текущий пользователь резерв
        const userHasReserve = reserveState?.isReserved || !!currentUserReserve;
        
        // Функция для явного перехода от резерва к сменам с отменой резерва
        const handleSwitchToShifts = () => {
            console.log('[ShiftSelectionDialog] handleSwitchToShifts called - just switching mode without canceling reserve');
            
            // Просто переключаемся в режим выбора смен без отмены резерва
            setIsReserveMode(false);
            
            // Если у пользователя есть смена в локальном состоянии, нужно убедиться, что она не отображается
            // при наличии активного резерва
            const currentUserIdStr = String(currentUserId);
            const userHasReserve = reserveState?.isReserved || !!currentUserReserve;
            
            if (userHasReserve) {
                // Если у пользователя есть резерв, убираем его из локальных смен для согласованности UI
                const userInLocalDayShifts = localDayShifts.some(shift => String(shift.userId) === currentUserIdStr);
                const userInLocalNightShifts = localNightShifts.some(shift => String(shift.userId) === currentUserIdStr);
                
                if (userInLocalDayShifts) {
                    console.log('[ShiftSelectionDialog] Removing user from local day shifts during switch');
                    setLocalDayShifts(prev => prev.filter(shift => String(shift.userId) !== currentUserIdStr));
                }
                
                if (userInLocalNightShifts) {
                    console.log('[ShiftSelectionDialog] Removing user from local night shifts during switch');
                    setLocalNightShifts(prev => prev.filter(shift => String(shift.userId) !== currentUserIdStr));
                }
            }
            
            // Обновляем компонент, чтобы отразить изменения
            forceUpdate();
        };
        
        return (
            <>
                <DialogHeader>
                    <DialogTitle>Запись в резерв</DialogTitle>
                    <DialogDate>{format(date, 'dd MMMM yyyy', { locale: ru })}</DialogDate>
                </DialogHeader>

                <ReserveGrid>
                    {/* Отображаем существующие резервы */}
                    {reserves.map((reserve) => {
                        const isCurrentUser = String(reserve.userId) === String(currentUserId);
                        return (
                            <SlotButtonWrapper key={reserve.id}>
                                <SlotButton 
                                    $isOccupied={true}
                                    style={{
                                        border: isCurrentUser ? '2px solid var(--primary-color)' : 'transparent',
                                        background: isCurrentUser ? 'rgba(76, 175, 80, 0.1)' : 'transparent'
                                    }}
                                >
                                    <CourierAvatar
                                        src={reserve.photo_url || defaultAvatar}
                                        alt={`${reserve.firstName} ${reserve.lastName}`}
                                        style={{
                                            border: isCurrentUser ? '2px solid var(--primary-color)' : '2px solid var(--border-color)'
                                        }}
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            img.src = defaultAvatar;
                                        }}
                                    />
                                </SlotButton>
                                <SlotTooltip>{isCurrentUser ? 'Вы' : `${reserve.firstName} ${reserve.lastName}`}</SlotTooltip>
                            </SlotButtonWrapper>
                        );
                    })}
                    
                    {/* Показываем кнопку записи, если пользователь еще не в резерве */}
                    {!userHasReserve && (
                        <SlotButtonWrapper>
                            <SlotButton 
                                $isOccupied={false}
                                onClick={handleReserveClick}
                            >
                                <PlusIcon>+</PlusIcon>
                            </SlotButton>
                            <SlotTooltip>Записаться в резерв</SlotTooltip>
                        </SlotButtonWrapper>
                    )}
                    
                    {/* Показываем кнопку отмены, если пользователь в резерве */}
                    {userHasReserve && (
                        <SlotButtonWrapper>
                            <SlotButton 
                                $isOccupied={false}
                                onClick={handleCancelReserve}
                                style={{ background: 'rgba(244, 67, 54, 0.1)', borderColor: '#f44336' }}
                            >
                                <span style={{ color: '#f44336', fontSize: '1.5rem' }}>&times;</span>
                            </SlotButton>
                            <SlotTooltip>Отменить резерв</SlotTooltip>
                        </SlotButtonWrapper>
                    )}
                </ReserveGrid>

                {reserves.length === 0 && !userHasReserve && (
                    <NoSlotsMessage>
                        В резерве пока никого нет.<br/>
                        Нажмите на "+" чтобы записаться первым.
                    </NoSlotsMessage>
                )}
                
                <DialogFooter>
                    <ActionButtons>
                        <BookButton 
                            onClick={handleSwitchToShifts}
                        >
                            Вернуться к выбору смены
                        </BookButton>
                        
                        {userHasReserve && (
                            <CancelButton onClick={handleCancelReserve}>
                                Отменить резерв
                            </CancelButton>
                        )}
                    </ActionButtons>
                </DialogFooter>
            </>
        );
    };

    const renderRegularContent = () => {
        // Определяем, имеет ли пользователь резерв
        const userHasReserve = reserveState?.isReserved || !!currentUserReserve;
        
        // Проверяем, есть ли у пользователя смена в Redux (наиболее актуальные данные)
        const reduxDayShift = dayShifts.find(shift => String(shift.userId) === String(currentUserId));
        const reduxNightShift = nightShifts.find(shift => String(shift.userId) === String(currentUserId));
        const userHasShift = !!reduxDayShift || !!reduxNightShift;

        // Если все слоты заняты и у пользователя нет смены - показываем сообщение
        if (isFullyBooked && !userHasShift) {
            return (
                <>
                    <DialogHeader>
                        <DialogTitle>Выбор смены</DialogTitle>
                        <DialogDate>{formatDate(date)}</DialogDate>
                    </DialogHeader>

                    <NoSlotsMessage>
                        На этот день все слоты заняты. <br/>
                        Вы можете записаться в резерв на случай отмены смены.
                    </NoSlotsMessage>

                    <ReserveButton onClick={toggleReserveMode}>
                        {userHasReserve ? 'Управление резервом' : 'Записаться в резерв'}
                    </ReserveButton>
                </>
            );
        }

        // Используем данные из Redux для отображения
        return (
            <>
                <DialogHeader>
                    <DialogTitle>Выбор смены</DialogTitle>
                    <DialogDate>{formatDate(date)}</DialogDate>
                </DialogHeader>

                <ShiftSection>
                    <ShiftTitle>
                        <ShiftIcon>☀️</ShiftIcon>
                        Дневная смена
                    </ShiftTitle>
                    <SlotsGrid>
                        {renderSlots(dayShifts, maxDaySlots, 'day')}
                    </SlotsGrid>
                </ShiftSection>

                <ShiftSection>
                    <ShiftTitle>
                        <ShiftIcon>🌙</ShiftIcon>
                        Вечерняя смена
                    </ShiftTitle>
                    <SlotsGrid>
                        {renderSlots(nightShifts, maxNightSlots, 'night')}
                    </SlotsGrid>
                </ShiftSection>
                
                <DialogFooter>
                    <ActionButtons>
                        <ReserveButton 
                            onClick={toggleReserveMode}
                        >
                            {userHasReserve ? 'Управление резервом' : 'Записаться в резерв'}
                        </ReserveButton>
                        
                        {userHasShift && !userHasReserve && (
                            <CancelButton 
                                onClick={async () => {
                                    // Отменяем существующую смену
                                    const shiftId = reduxDayShift?.id || reduxNightShift?.id;
                                    const shiftType = reduxDayShift ? 'day' : 'night';
                                    
                                    if (shiftId) {
                                        try {
                                            await dispatch(cancelShift(shiftId));
                                            console.log('[ShiftSelectionDialog] Existing shift canceled successfully');
                                            
                                            // Обновляем локальное состояние, убирая пользователя из смены
                                            if (shiftType === 'day') {
                                                const updatedDayShifts = localDayShifts.filter(shift => String(shift.userId) !== String(currentUserId));
                                                console.log('[ShiftSelectionDialog] Updated day shifts after cancel:', updatedDayShifts);
                                                setLocalDayShifts(updatedDayShifts);
                                            } else {
                                                const updatedNightShifts = localNightShifts.filter(shift => String(shift.userId) !== String(currentUserId));
                                                console.log('[ShiftSelectionDialog] Updated night shifts after cancel:', updatedNightShifts);
                                                setLocalNightShifts(updatedNightShifts);
                                            }
                                            
                                            // Принудительно обновляем компонент для отражения изменений в UI
                                            forceUpdate();
                                            
                                            setSuccessMessage('Смена успешно отменена');
                                            setShowSuccess(true);
                                            setTimeout(() => {
                                                setShowSuccess(false);
                                                // Еще раз обновляем компонент после скрытия уведомления
                                                forceUpdate();
                                            }, 3000);
                                        } catch (error) {
                                            console.error('[ShiftSelectionDialog] Error canceling shift:', error);
                                        }
                                    }
                                }}
                            >
                                {"Отменить смену"}
                            </CancelButton>
                        )}
                    </ActionButtons>
                </DialogFooter>
            </>
        );
    };

    return (
        <DialogOverlay onClick={(e) => {
            console.log('[ShiftSelectionDialog] DialogOverlay clicked');
            if (e.target === e.currentTarget) {
                handleClose();
            }
        }}>
            <DialogContent onClick={e => e.stopPropagation()}>
                <CloseButton onClick={handleClose}>&times;</CloseButton>
                
                {showSuccess && (
                    <SuccessNotification>
                        <CheckIcon>✓</CheckIcon>
                        {successMessage || (isReserveMode ? 'Вы успешно записались в резерв' : 'Вы успешно записались на смену')}
                    </SuccessNotification>
                )}

                {isReserveMode ? renderReserveContent() : renderRegularContent()}
            </DialogContent>
        </DialogOverlay>
    );
};

export default ShiftSelectionDialog; 