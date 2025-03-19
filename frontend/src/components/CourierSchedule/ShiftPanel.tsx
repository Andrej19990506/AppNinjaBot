import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import defaultAvatar from '../../assets/images/Ninja.jpg';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDispatch, useSelector } from 'react-redux';
import { cancelShift } from '../../store/slices/shiftsSlice';
import { removeFromReserve } from '../../store/slices/reservesSlice';
import { AppDispatch, RootState } from '../../store/store';
import { ReserveShift } from '../../types/shifts';

// Интерфейсы
interface ShiftSlot {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
}

interface ShiftPanelProps {
    date: Date;
    dayShifts: ShiftSlot[];
    nightShifts: ShiftSlot[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => void;
    onSwitchToReserve: () => void;
    forceUpdate: () => void;
    reserves: ReserveShift[];
    showSuccessMessage: (message: string) => void;
}

// Стили (которые нужны только для этого компонента)
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

const DialogFooter = styled.div`
    margin-top: 24px;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 16px;
`;

const ModeButton = styled.button`
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

const ReserveLink = styled.a`
    color: var(--primary-color);
    text-decoration: none;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
`;

// Компонент панели смен обернутый в React.memo для предотвращения ненужных перерисовок
const ShiftPanel: React.FC<ShiftPanelProps> = React.memo(({
    date,
    dayShifts,
    nightShifts,
    maxDaySlots,
    maxNightSlots,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    onSwitchToReserve,
    forceUpdate,
    reserves,
    showSuccessMessage
}) => {
    const dispatch = useDispatch<AppDispatch>();
    // Создаем локальное состояние для смен, чтобы контролировать UI независимо от props
    const [localDayShifts, setLocalDayShifts] = useState(dayShifts);
    const [localNightShifts, setLocalNightShifts] = useState(nightShifts);
    
    // Синхронизируем локальное состояние с props при изменении props
    useEffect(() => {
        // Используем предыдущие оптимистичные обновления, если они есть
        setLocalDayShifts(prevShifts => {
            // Найдем все оптимистичные обновления (id начинается с "temp-")
            const optimisticShifts = prevShifts.filter(shift => 
                shift.id && shift.id.toString().startsWith('temp-')
            );
            
            // Если нет оптимистичных обновлений, просто используем новые смены
            if (optimisticShifts.length === 0) return dayShifts;
            
            // Иначе объединяем новые реальные смены с оптимистичными
            // Заменяем оптимистичные на соответствующие реальные, если они есть
            // Фильтруем, чтобы избежать дубликатов (по slotIndex)
            const usedSlotIndexes = new Set();
            
            // Сначала добавляем все реальные смены
            const result = [...dayShifts];
            result.forEach(shift => usedSlotIndexes.add(shift.slotIndex));
            
            // Затем добавляем оптимистичные, которые не конфликтуют
            optimisticShifts.forEach(shift => {
                if (!usedSlotIndexes.has(shift.slotIndex)) {
                    result.push(shift);
                    usedSlotIndexes.add(shift.slotIndex);
                }
            });
            
            return result;
        });
        
        // То же самое для ночных смен
        setLocalNightShifts(prevShifts => {
            const optimisticShifts = prevShifts.filter(shift => 
                shift.id && shift.id.toString().startsWith('temp-')
            );
            
            if (optimisticShifts.length === 0) return nightShifts;
            
            const usedSlotIndexes = new Set();
            const result = [...nightShifts];
            result.forEach(shift => usedSlotIndexes.add(shift.slotIndex));
            
            optimisticShifts.forEach(shift => {
                if (!usedSlotIndexes.has(shift.slotIndex)) {
                    result.push(shift);
                    usedSlotIndexes.add(shift.slotIndex);
                }
            });
            
            return result;
        });
    }, [dayShifts, nightShifts]);

    // Проверяем, все ли слоты заняты
    const totalSlots = maxDaySlots + maxNightSlots;
    const occupiedSlots = localDayShifts.length + localNightShifts.length;
    const isFullyBooked = occupiedSlots >= totalSlots;

    // Проверяем, есть ли у пользователя смена
    const userDayShift = localDayShifts.find(shift => String(shift.userId) === String(currentUserId));
    const userNightShift = localNightShifts.find(shift => String(shift.userId) === String(currentUserId));
    const userHasShift = !!userDayShift || !!userNightShift;

    // Проверяем, есть ли у пользователя резерв
    const userHasReserve = reserves.some(
        reserve => String(reserve.userId) === String(currentUserId) && 
                  reserve.date === format(date, 'yyyy-MM-dd')
    );

    const handleSlotSelect = async (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => {
        console.log('[ShiftPanel] handleSlotSelect called:', { shiftType, slotIndex, existingShiftId });
        
        // Если слот принадлежит текущему пользователю, отменяем смену
        if (existingShiftId && ((shiftType === 'day' && userDayShift) || (shiftType === 'night' && userNightShift))) {
            console.log('[ShiftPanel] Slot belongs to current user, canceling shift');
            return handleCancelShift();
        }
        
        try {
            // Оптимистично добавляем смену в локальное состояние
            const optimisticShift = {
                id: `temp-${Date.now()}`,
                userId: currentUserId,
                photo_url: currentUserAvatar,
                firstName: currentUserName?.split(' ')[0] || '',
                lastName: currentUserName?.split(' ')[1] || '',
                shiftType,
                slotIndex,
                date: format(date, 'yyyy-MM-dd')
            };
            
            // Добавляем в локальное состояние для мгновенного отображения
            if (shiftType === 'day') {
                setLocalDayShifts(prevShifts => [...prevShifts, optimisticShift]);
            } else {
                // То же самое для ночных смен
                setLocalNightShifts(prevShifts => [...prevShifts, optimisticShift]);
            }
            
            // Проверяем, есть ли пользователь в резерве на эту дату
            // Примечание: Основная логика удаления из резерва теперь происходит в shiftsSlice.ts,
            // но мы оставляем здесь код для отображения сообщения пользователю
            const userReserve = reserves.find(
                reserve => String(reserve.userId) === String(currentUserId) && 
                           reserve.date === format(date, 'yyyy-MM-dd')
            );
            
            let wasInReserve = false;
            // Если пользователь в резерве, запоминаем это для последующего уведомления
            if (userReserve && userReserve.id) {
                console.log('[ShiftPanel] User is in reserve, this will be handled by shiftsSlice');
                wasInReserve = true;
            }
            
            // Вызываем onSlotSelect callback для отправки запроса на сервер
            await onSlotSelect(shiftType, slotIndex, existingShiftId);
            console.log('[ShiftPanel] Slot selection successful');
            
            // Показываем уведомление об удалении из резерва, если пользователь был в резерве
            if (wasInReserve) {
                // Небольшая задержка, чтобы уведомление появилось после успешной записи на смену
                setTimeout(() => {
                    showSuccessMessage('Вы были автоматически удалены из резерва при записи на смену');
                }, 500);
            }
            
            // Не вызываем forceUpdate, так как у нас есть локальное состояние
            // и оно уже обновилось оптимистично
        } catch (error) {
            console.error('[ShiftPanel] Error selecting slot:', error);
            // В случае ошибки отменяем оптимистичное обновление
            if (shiftType === 'day') {
                setLocalDayShifts(prevShifts => 
                    prevShifts.filter(shift => !shift.id?.toString().startsWith('temp-'))
                );
            } else {
                setLocalNightShifts(prevShifts => 
                    prevShifts.filter(shift => !shift.id?.toString().startsWith('temp-'))
                );
            }
        }
    };

    const handleCancelShift = async () => {
        console.log('[ShiftPanel] handleCancelShift called');
        
        try {
            // Находим ID смены пользователя (дневной или ночной)
            const userShift = userDayShift || userNightShift;
            
            if (userShift && userShift.id) {
                console.log('[ShiftPanel] Canceling shift with ID:', userShift.id);
                
                // Оптимистично удаляем смену из локального состояния
                if (userDayShift) {
                    setLocalDayShifts(prevShifts => 
                        prevShifts.filter(shift => shift.id !== userShift.id)
                    );
                } else if (userNightShift) {
                    setLocalNightShifts(prevShifts => 
                        prevShifts.filter(shift => shift.id !== userShift.id)
                    );
                }
                
                // Показываем уведомление об успешной отмене до выполнения запроса
                showSuccessMessage('Смена успешно отменена');
                
                // Вызываем dispatch для отмены смены на сервере
                await dispatch(cancelShift(String(userShift.id)));
                
                console.log('[ShiftPanel] Shift cancellation successful');
                
                // После отмены смены предлагаем перейти к панели резерва
                setTimeout(() => {
                    // Даем пользователю время увидеть анимацию отмены смены
                    onSwitchToReserve();
                    showSuccessMessage('Вы можете записаться в резерв');
                }, 1000);
            } else {
                console.log('[ShiftPanel] No shift to cancel');
            }
        } catch (error) {
            console.error('[ShiftPanel] Error canceling shift:', error);
            
            // В случае ошибки восстанавливаем состояние
            setLocalDayShifts(dayShifts);
            setLocalNightShifts(nightShifts);
        }
    };

    // Оптимизированная функция renderSlots для ShiftPanel
    const renderSlots = useMemo(() => {
        console.log('[ShiftPanel] Re-rendering slots');
        
        // Используем локальное состояние вместо пропсов для предотвращения лишних перерисовок
        const localDayShifts = [...dayShifts];
        const localNightShifts = [...nightShifts];
        
        // Проверяем, есть ли у пользователя уже смена данного типа
        const userHasDayShift = localDayShifts.some(shift => String(shift.userId) === String(currentUserId));
        const userHasNightShift = localNightShifts.some(shift => String(shift.userId) === String(currentUserId));
        
        return (shiftType: 'day' | 'night', slots: number) => {
            const shiftsArray = shiftType === 'day' ? localDayShifts : localNightShifts;
            const userHasThisTypeShift = shiftType === 'day' ? userHasDayShift : userHasNightShift;
            
            return Array.from({ length: slots }).map((_, index) => {
                const existingShift = shiftsArray.find(shift => 
                    shift.slotIndex === index && 
                    (shift.shiftType === shiftType || !shift.shiftType)
                );
                
                const isCurrentUser = existingShift && String(existingShift.userId) === String(currentUserId);
                // Слот должен быть заблокирован если:
                // 1. Он уже занят другим пользователем ИЛИ
                // 2. Пользователь уже имеет смену этого типа (дневную/ночную) и это не его слот
                const isDisabled = (!!existingShift && !isCurrentUser) || (userHasThisTypeShift && !isCurrentUser);
                
                return (
                    <SlotButtonWrapper key={`${shiftType}-${index}`} style={{
                        willChange: 'transform',
                        transform: 'translateZ(0)'
                    }}>
                        <SlotButton 
                            $isOccupied={!!existingShift}
                            onClick={() => handleSlotSelect(shiftType, index, existingShift?.id)}
                            disabled={isDisabled}
                            title={isCurrentUser ? 'Нажмите, чтобы отменить смену' : 
                                   (userHasThisTypeShift ? `Вы уже записаны на ${shiftType === 'day' ? 'дневную' : 'ночную'} смену` : '')}
                            data-testid={`slot-${shiftType}-${index}`}
                            style={{
                                willChange: 'transform',
                                transform: 'translateZ(0)',
                                // Добавляем визуальный индикатор блокировки
                                opacity: isDisabled && !existingShift ? 0.5 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {existingShift ? (
                                <CourierAvatar 
                                    src={existingShift.photo_url || defaultAvatar} 
                                    alt={`${existingShift.firstName || 'Курьер'}`}
                                    style={{
                                        willChange: 'transform',
                                        transform: 'translateZ(0)'
                                    }}
                                />
                            ) : (
                                <PlusIcon>+</PlusIcon>
                            )}
                        </SlotButton>
                        
                        {existingShift && (
                            <SlotTooltip>
                                {existingShift.firstName || 'Курьер'} {existingShift.lastName || ''}
                            </SlotTooltip>
                        )}
                        
                        {!existingShift && userHasThisTypeShift && !isCurrentUser && (
                            <SlotTooltip>
                                Вы уже записаны на {shiftType === 'day' ? 'дневную' : 'ночную'} смену
                            </SlotTooltip>
                        )}
                    </SlotButtonWrapper>
                );
            });
        };
    }, [dayShifts, nightShifts, currentUserId, handleSlotSelect]);

    return (
        <React.Fragment key="shift-panel-root">
            <DialogHeader>
                <DialogTitle>Выбор смены</DialogTitle>
                <DialogDate>{format(date, 'dd MMMM yyyy', { locale: ru })}</DialogDate>
            </DialogHeader>

            <ShiftSection key="day-shift-section" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
                <ShiftTitle>
                    <ShiftIcon>☀️</ShiftIcon> Дневная смена
                </ShiftTitle>
                <SlotsGrid>
                    {renderSlots('day', maxDaySlots)}
                </SlotsGrid>
            </ShiftSection>

            <ShiftSection key="night-shift-section" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
                <ShiftTitle>
                    <ShiftIcon>🌙</ShiftIcon> Вечерняя смена
                </ShiftTitle>
                <SlotsGrid>
                    {renderSlots('night', maxNightSlots)}
                </SlotsGrid>
            </ShiftSection>

            {isFullyBooked && !userHasShift && (
                <NoSlotsMessage
                    key="no-slots-message"
                    style={{
                        willChange: 'transform',
                        transform: 'translateZ(0)'
                    }}
                >
                    Все смены уже заняты.<br/>
                    Вы можете записаться в резерв.
                </NoSlotsMessage>
            )}
        </React.Fragment>
    );
}, (prevProps, nextProps) => {
    // Сравниваем только важные props, игнорируя те, которые не влияют на отображение
    return (
        // Сравниваем даты
        prevProps.date.getTime() === nextProps.date.getTime() &&
        // Сравниваем количество смен (не их содержимое, т.к. у нас есть локальное состояние)
        prevProps.dayShifts.length === nextProps.dayShifts.length &&
        prevProps.nightShifts.length === nextProps.nightShifts.length &&
        // Сравниваем ID пользователя (важно для определения "моей" смены)
        prevProps.currentUserId === nextProps.currentUserId &&
        // Сравниваем количество резервов (не их содержимое)
        prevProps.reserves.length === nextProps.reserves.length
    );
});

// Экспортируем компонент
export default ShiftPanel; 