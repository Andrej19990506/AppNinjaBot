import React, { useState } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { ReserveShift } from '../../types/shifts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDispatch } from 'react-redux';
import { cancelShift } from '../../store/slices/shiftsSlice';
import { AppDispatch } from '../../store/store';

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
    reserves = []
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const [selectedSlots, setSelectedSlots] = useState<{
        type: 'day' | 'night';
        index: number;
    } | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [localDayShifts, setLocalDayShifts] = useState(dayShifts);
    const [localNightShifts, setLocalNightShifts] = useState(nightShifts);
    const [isReserveMode, setIsReserveMode] = useState(false);
    const [reserveState, setReserveState] = useState<{
        isReserved: boolean;
        reserveId?: number;
    } | null>(null);

    console.log('[ShiftSelectionDialog] Render with props:', { 
        isOpen, 
        currentUserId,
        reserves: reserves.length,
        isReserveMode,
        reserveState 
    });

    // Обновляем локальное состояние при изменении пропсов
    React.useEffect(() => {
        console.log('[ShiftSelectionDialog] useEffect for shifts update');
        console.log('[ShiftSelectionDialog] Incoming day shifts:', dayShifts.length, 'night shifts:', nightShifts.length);
        
        // Преобразуем userId в строку для консистентного сравнения
        const currentUserIdStr = String(currentUserId);
        
        // Создаем новые массивы для смен с правильной типизацией
        const newDayShifts = dayShifts.map(shift => ({
            ...shift,
            userId: String(shift.userId)
        }));
        
        const newNightShifts = nightShifts.map(shift => ({
            ...shift,
            userId: String(shift.userId)
        }));
        
        // Проверяем, есть ли смены текущего пользователя
        const userDayShift = newDayShifts.find(shift => shift.userId === currentUserIdStr);
        const userNightShift = newNightShifts.find(shift => shift.userId === currentUserIdStr);
        
        // Подробно логируем информацию о сменах пользователя для отладки
        if (userDayShift) {
            console.log('[ShiftSelectionDialog] User has day shift:', userDayShift);
        }
        if (userNightShift) {
            console.log('[ShiftSelectionDialog] User has night shift:', userNightShift);
        }
        
        // Проверяем, изменился ли тип смены пользователя
        if (userDayShift && userNightShift) {
            console.log('[ShiftSelectionDialog] Warning: User has both day and night shifts', {
                dayShift: userDayShift,
                nightShift: userNightShift
            });
            
            // Если ID смен совпадают, значит была смена типа (день -> ночь или ночь -> день)
            if (userDayShift.id === userNightShift.id) {
                console.log('[ShiftSelectionDialog] Same shift ID detected, user is switching shift type');
                
                // Определяем правильный тип смены по shiftType
                if (userDayShift.shiftType === 'night') {
                    console.log('[ShiftSelectionDialog] Removing day shift because shiftType is night');
                    const filteredDayShifts = newDayShifts.filter(shift => shift.userId !== currentUserIdStr);
                    setLocalDayShifts(filteredDayShifts);
                    setLocalNightShifts(newNightShifts);
                } else if (userNightShift.shiftType === 'day') {
                    console.log('[ShiftSelectionDialog] Removing night shift because shiftType is day');
                    setLocalDayShifts(newDayShifts);
                    const filteredNightShifts = newNightShifts.filter(shift => shift.userId !== currentUserIdStr);
                    setLocalNightShifts(filteredNightShifts);
                }
            } else {
                // Если ID смен разные, значит у пользователя есть смены обоих типов
                // Используем самую последнюю смену на основе ID (предполагаем, что более новые смены имеют больший ID)
                console.log('[ShiftSelectionDialog] User has different shifts for day and night');
                
                // Для простоты сохраняем оба типа смен, бэкенд должен обеспечить корректное состояние
                setLocalDayShifts(newDayShifts);
                setLocalNightShifts(newNightShifts);
            }
        } else {
            // Если нет конфликта, просто обновляем состояние
            setLocalDayShifts(newDayShifts);
            setLocalNightShifts(newNightShifts);
        }
        
        // Логируем детальную информацию о сменах после обработки
        console.log('[ShiftSelectionDialog] Final day shifts:', newDayShifts);
        console.log('[ShiftSelectionDialog] Final night shifts:', newNightShifts);
    }, [dayShifts, nightShifts, currentUserId]);

    // Добавляем эффект для отслеживания изменений isOpen
    React.useEffect(() => {
        console.log('[ShiftSelectionDialog] Dialog open state changed:', isOpen);
        if (!isOpen) {
            // Сбрасываем состояния при закрытии
            setShowSuccess(false);
            setSelectedSlots(null);
        }
    }, [isOpen]);

    // Предотвращаем закрытие диалога во время обработки резерва
    const handleClose = () => {
        console.log('[ShiftSelectionDialog] handleClose called, reserveState:', reserveState);
        // Если есть активный процесс резервирования, не закрываем диалог
        if (showSuccess) {
            console.log('[ShiftSelectionDialog] Preventing close due to active success notification');
            return;
        }
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
        
        // Проверяем, есть ли у пользователя уже смена на эту дату
        const userDayShift = localDayShifts.find(shift => String(shift.userId) === currentUserIdStr);
        const userNightShift = localNightShifts.find(shift => String(shift.userId) === currentUserIdStr);
        
        // Если пользователь уже имеет смену этого типа и того же индекса, не делаем ничего
        if ((shiftType === 'day' && userDayShift?.slotIndex === slotIndex) ||
            (shiftType === 'night' && userNightShift?.slotIndex === slotIndex)) {
            console.log('[ShiftSelectionDialog] User already has this exact shift, doing nothing');
            return;
        }
        
        console.log('[ShiftSelectionDialog] Setting selectedSlots');
        setSelectedSlots({ type: shiftType, index: slotIndex });
        
        // Создаем новый слот для текущего пользователя
        const newSlot: ShiftSlot = {
            id: userDayShift?.id || userNightShift?.id,  // Сохраняем ID существующей смены
            userId: currentUserIdStr,
            photo_url: currentUserAvatar,
            firstName: currentUserName?.split(' ')[0],
            lastName: currentUserName?.split(' ')[1],
            slotIndex: slotIndex,
            shiftType: shiftType
        };
        
        // Обновляем локальное состояние UI перед вызовом API
        // Создаем копии массивов для избежания мутации
        const dayShiftsWithoutUser = [...localDayShifts].filter(shift => String(shift.userId) !== currentUserIdStr);
        const nightShiftsWithoutUser = [...localNightShifts].filter(shift => String(shift.userId) !== currentUserIdStr);
        
        // Обновляем массивы с копиями, чтобы избежать проблем с рендерингом
        if (shiftType === 'day') {
            console.log('[ShiftSelectionDialog] Updating local day shifts with new slot:', newSlot);
            console.log('[ShiftSelectionDialog] Removing user from night shifts');
            setLocalDayShifts([...dayShiftsWithoutUser, newSlot]);
            setLocalNightShifts([...nightShiftsWithoutUser]);
        } else {
            console.log('[ShiftSelectionDialog] Updating local night shifts with new slot:', newSlot);
            console.log('[ShiftSelectionDialog] Removing user from day shifts');
            setLocalDayShifts([...dayShiftsWithoutUser]);
            setLocalNightShifts([...nightShiftsWithoutUser, newSlot]);
        }
        
        // Форсируем перерисовку UI через короткий таймаут
        setTimeout(() => {
            console.log('[ShiftSelectionDialog] Forcing UI update');
            if (shiftType === 'day') {
                setLocalDayShifts(prev => [...prev]);
            } else {
                setLocalNightShifts(prev => [...prev]);
            }
        }, 100);
        
        // Вызываем API для бронирования, передавая информацию о существующей смене для перебронирования
        console.log('[ShiftSelectionDialog] Calling onSlotSelect with existing shift ID:', newSlot.id);
        if (userDayShift || userNightShift) {
            // Если у пользователя уже есть смена, передаем её ID для обновления
            const existingShiftId = userDayShift?.id || userNightShift?.id;
            onSlotSelect(shiftType, slotIndex, existingShiftId);
        } else {
            // Если смены нет, просто бронируем новую
            onSlotSelect(shiftType, slotIndex);
        }
        
        // Показываем уведомление об успехе
        console.log('[ShiftSelectionDialog] Setting showSuccess to true');
        setShowSuccess(true);
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
            console.log('[ShiftSelectionDialog] Setting showSuccess to false');
            setShowSuccess(false);
        }, 3000);
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
        
        // Проверяем, есть ли у текущего пользователя смена в этот день
        const userDayShift = localDayShifts.find(shift => String(shift.userId) === currentUserIdStr);
        const userNightShift = localNightShifts.find(shift => String(shift.userId) === currentUserIdStr);
        
        // Для отладки логируем информацию о сменах пользователя
        if (userDayShift) {
            console.log(`[ShiftSelectionDialog] User has day shift:`, userDayShift);
        }
        if (userNightShift) {
            console.log(`[ShiftSelectionDialog] User has night shift:`, userNightShift);
        }
        
        console.log(`[ShiftSelectionDialog] Rendering ${shiftType} slots:`, shifts);
        
        for (let i = 0; i < maxSlots; i++) {
            // Определяем, есть ли смена для этого слота
            const currentSlots = shiftType === 'day' ? localDayShifts : localNightShifts;
            const slot = currentSlots.find(shift => shift.slotIndex === i);
            
            const isSelected = selectedSlots?.type === shiftType && selectedSlots?.index === i;
            const isCurrentUserSlot = slot && String(slot.userId) === currentUserIdStr;
            
            // Определяем, должен ли слот быть заблокирован
            const hasSlot = !!slot;
            const isDisabled = (hasSlot && !isCurrentUserSlot) || 
                             (shiftType === 'day' && userDayShift && !isCurrentUserSlot) || 
                             (shiftType === 'night' && userNightShift && !isCurrentUserSlot);
            
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
            } else if ((shiftType === 'day' && userDayShift && !isCurrentUserSlot) || 
                      (shiftType === 'night' && userNightShift && !isCurrentUserSlot)) {
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

    const handleReserveClick = () => {
        console.log('[ShiftSelectionDialog] handleReserveClick called');
        if (!selectedSlots) return;
        
        // Обновляем состояние резерва
        setReserveState({
            isReserved: true,
            reserveId: Date.now()
        });
        
        // Показываем уведомление об успехе
        setShowSuccess(true);
        
        // Вызываем onReserveSelect после установки состояния
        console.log('[ShiftSelectionDialog] Calling onReserveSelect');
        onReserveSelect();

        // Скрываем только уведомление через 3 секунды
        setTimeout(() => {
            console.log('[ShiftSelectionDialog] Hiding success notification');
            setShowSuccess(false);
        }, 3000);
    };

    const handleCancelReserve = () => {
        console.log('[ShiftSelectionDialog] handleCancelReserve called');
        setReserveState(null);
        setShowSuccess(false);
    };

    const toggleReserveMode = () => {
        console.log('[ShiftSelectionDialog] toggleReserveMode:', !isReserveMode);
        setIsReserveMode(!isReserveMode);
    };

    const handleBookClick = () => {
        console.log('[ShiftSelectionDialog] handleBookClick called');
        if (!selectedSlots) return;
        
        // Вызываем onSlotSelect для бронирования смены
        onSlotSelect(selectedSlots.type, selectedSlots.index);
        
        // Показываем уведомление об успехе
        setShowSuccess(true);
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
            setShowSuccess(false);
        }, 3000);
    };

    const renderReserveContent = () => (
        <>
            <DialogHeader>
                <DialogTitle>Запись в резерв</DialogTitle>
                <DialogDate>{format(date, 'dd MMMM yyyy', { locale: ru })}</DialogDate>
            </DialogHeader>

            <ReserveGrid>
                {/* Отображаем существующие резервы */}
                {reserves.map((reserve) => (
                    <SlotButtonWrapper key={reserve.id}>
                        <SlotButton $isOccupied={true}>
                            <CourierAvatar
                                src={reserve.photo_url || defaultAvatar}
                                alt={`${reserve.firstName} ${reserve.lastName}`}
                                onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.src = defaultAvatar;
                                }}
                            />
                        </SlotButton>
                        <SlotTooltip>{`${reserve.firstName} ${reserve.lastName}`}</SlotTooltip>
                    </SlotButtonWrapper>
                ))}
                
                {/* Показываем либо кнопку записи, либо фото с кнопкой отмены */}
                {!reserveState?.isReserved ? (
                    <SlotButtonWrapper>
                        <SlotButton 
                            $isOccupied={false}
                            onClick={handleReserveClick}
                        >
                            <PlusIcon>+</PlusIcon>
                        </SlotButton>
                        <SlotTooltip>Записаться в резерв</SlotTooltip>
                    </SlotButtonWrapper>
                ) : (
                    <>
                        <SlotButtonWrapper>
                            <SlotButton $isOccupied={true}>
                                <CourierAvatar
                                    src={currentUserAvatar || defaultAvatar}
                                    alt={currentUserName || 'Курьер'}
                                    onError={(e) => {
                                        const img = e.target as HTMLImageElement;
                                        img.src = defaultAvatar;
                                    }}
                                />
                            </SlotButton>
                            <SlotTooltip>{currentUserName || 'Вы'}</SlotTooltip>
                        </SlotButtonWrapper>
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
                    </>
                )}
            </ReserveGrid>

            {reserves.length === 0 && !reserveState?.isReserved && (
                <NoSlotsMessage>
                    В резерве пока никого нет.<br/>
                    Нажмите на "+" чтобы записаться первым.
                </NoSlotsMessage>
            )}
        </>
    );

    const renderRegularContent = () => {
        if (isFullyBooked) {
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
                        Записаться в резерв
                    </ReserveButton>
                </>
            );
        }

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
                        {renderSlots(localDayShifts, maxDaySlots, 'day')}
                    </SlotsGrid>
                </ShiftSection>

                <ShiftSection>
                    <ShiftTitle>
                        <ShiftIcon>🌙</ShiftIcon>
                        Вечерняя смена
                    </ShiftTitle>
                    <SlotsGrid>
                        {renderSlots(localNightShifts, maxNightSlots, 'night')}
                    </SlotsGrid>
                </ShiftSection>
                
                <DialogFooter>
                    {reserveState ? (
                        <ReserveActions>
                            <CancelButton onClick={handleCancelReserve}>
                                Отменить резерв
                            </CancelButton>
                        </ReserveActions>
                    ) : (
                        <ActionButtons>
                            <ReserveButton 
                                onClick={handleReserveClick}
                                disabled={!selectedSlots}
                            >
                                Добавить в резерв
                            </ReserveButton>
                            <BookButton 
                                onClick={handleBookClick}
                                disabled={!selectedSlots}
                            >
                                Записаться на смену
                            </BookButton>
                        </ActionButtons>
                    )}
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
                        {isReserveMode ? 'Вы успешно записались в резерв' : 'Вы успешно записались на смену'}
                    </SuccessNotification>
                )}

                {isReserveMode ? renderReserveContent() : renderRegularContent()}
            </DialogContent>
        </DialogOverlay>
    );
};

export default ShiftSelectionDialog; 