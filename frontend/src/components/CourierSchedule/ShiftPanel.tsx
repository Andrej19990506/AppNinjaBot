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
import LoadingOverlay from './LoadingOverlay';
import CourierProfileDialog from '../CourierProfileDialog/CourierProfileDialog';

// Интерфейсы
interface ShiftSlot {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
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
    chatId?: string;
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
    overflow: visible;

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

// Добавляем стиль для значка старшего курьера
const SeniorBadge = styled.div`
    position: absolute;
    top: -5px;
    right: -5px;
    background: linear-gradient(45deg, #FFC107, #FF9800);
    color: #333;
    font-size: 10px;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px rgba(255, 193, 7, 0.5);
    z-index: 10;
    animation: pulse 2s infinite;
    pointer-events: auto;
    
    @keyframes pulse {
        0% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0.7);
        }
        70% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 10px 5px rgba(255, 193, 7, 0);
        }
        100% {
            box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0);
        }
    }
    
    /* Увеличиваем размер на больших экранах */
    @media (min-width: 768px) {
        top: -6px;
        right: -6px;
        height: 22px;
        width: 22px;
        font-size: 12px;
    }
`;

// Добавляем компонент для инструкции
const LongPressHint = styled.div`
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
    margin-top: 16px;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: var(--radius);
    animation: fadeIn 1s ease;
    border-left: 3px solid var(--primary-color);
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

// Компонент для визуальной обратной связи при долгом нажатии
const PressAnimation = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.1);
    opacity: 0;
    transform: scale(0);
    transition: transform 0.5s ease, opacity 0.5s ease;
    pointer-events: none;
    
    &.active {
        transform: scale(1);
        opacity: 1;
    }
`;

// Компонент панели смен обернутый в React.memo для предотвращения ненужных перерисовок
const ShiftPanel = React.memo(({
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
    showSuccessMessage,
    chatId
}: ShiftPanelProps) => {
    const dispatch = useDispatch<AppDispatch>();
    // Создаем локальное состояние для смен, чтобы контролировать UI независимо от props
    const [localDayShifts, setLocalDayShifts] = useState(dayShifts);
    const [localNightShifts, setLocalNightShifts] = useState(nightShifts);
    
    // Добавляем состояние для управления диалогом
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<{
        id: number | string;
        name: string;
        avatar?: string;
        isSeniorCourier?: boolean;
    } | null>(null);
    
    // Состояние для отображения тултипа при клике
    const [hoveredSlot, setHoveredSlot] = useState<{
        shiftType: 'day' | 'night', 
        slotIndex: number,
        showTooltip: boolean
    } | null>(null);
    
    // Таймер для определения долгого нажатия
    const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
    
    // Добавляем состояние для анимации долгого нажатия
    const [pressAnimationActive, setPressAnimationActive] = useState(false);
    const [pressAnimationSlot, setPressAnimationSlot] = useState<number | null>(null);
    const [pressAnimationShiftType, setPressAnimationShiftType] = useState<'day' | 'night' | null>(null);
    
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
        
        // Проверим атрибут data-avatar-click, который мы устанавливаем при клике на аватар
        // Если клик был по аватару, то не выполняем действие слота
        const isAvatarClick = document.body.hasAttribute('data-avatar-click');
        if (isAvatarClick) {
            document.body.removeAttribute('data-avatar-click');
            return;
        }
        
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
                
                // Проверяем, есть ли chatId
                if (!chatId) {
                    console.log('[ShiftPanel] Warning: No chatId provided for canceling shift, using default');
                }
                
                // Вызываем dispatch для отмены смены на сервере с параметром chatId
                await dispatch(cancelShift({
                    shiftId: String(userShift.id),
                    chatId: chatId
                }));
                
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

    // Обработчик клика на аватар курьера (короткое нажатие)
    const handleCourierAvatarClick = (
        event: React.MouseEvent | React.TouchEvent,
        courier: { 
            userId?: string; 
            firstName?: string; 
            lastName?: string; 
            photo_url?: string | null;
            isSeniorCourier?: boolean;
        },
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        // Предотвращаем срабатывание onClick родительской кнопки
        event.preventDefault();
        event.stopPropagation();
        
        // Устанавливаем атрибут, показывающий, что был клик по аватару
        document.body.setAttribute('data-avatar-click', 'true');
        
        // Показываем стандартный черный тултип над аватаром
        setHoveredSlot({
            shiftType,
            slotIndex,
            showTooltip: true
        });
        
        // Автоматически скрываем тултип через 2 секунды
        setTimeout(() => {
            setHoveredSlot(null);
        }, 2000);
    };
    
    // Обработчик долгого нажатия на аватар курьера
    const handleCourierAvatarPress = (
        event: React.MouseEvent | React.TouchEvent,
        courier: { 
            userId?: string; 
            firstName?: string; 
            lastName?: string; 
            photo_url?: string | null;
            isSeniorCourier?: boolean;
        },
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        // Предотвращаем срабатывание onClick родительской кнопки
        event.preventDefault();
        event.stopPropagation();
        
        // Устанавливаем атрибут, показывающий, что был клик по аватару
        document.body.setAttribute('data-avatar-click', 'true');
        
        // Активируем анимацию для визуальной обратной связи
        setPressAnimationActive(true);
        setPressAnimationSlot(slotIndex);
        setPressAnimationShiftType(shiftType);
        
        // Устанавливаем таймер для долгого нажатия
        const timer = setTimeout(() => {
            if (courier.userId) {
                setSelectedCourier({
                    id: courier.userId || '',
                    name: `${courier.firstName || ''} ${courier.lastName || ''}`.trim(),
                    avatar: courier.photo_url || undefined,
                    isSeniorCourier: courier.isSeniorCourier || false
                });
                setProfileDialogOpen(true);
                
                // Для отладки
                console.log('[ShiftPanel] Открытие профиля курьера:', {
                    courier, 
                    isSeniorCourier: courier.isSeniorCourier
                });
                
                // Сбрасываем анимацию
                setPressAnimationActive(false);
                setPressAnimationSlot(null);
                setPressAnimationShiftType(null);
            }
        }, 500); // 500ms для долгого нажатия
        
        setPressTimer(timer);
    };
    
    // Обработчик отпускания нажатия
    const handleCourierAvatarRelease = () => {
        // Очищаем таймер при отпускании, чтобы отменить открытие диалога,
        // если пользователь отпустил раньше, чем через 500ms
        if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
        }
        
        // Сбрасываем анимацию
        setPressAnimationActive(false);
        setPressAnimationSlot(null);
        setPressAnimationShiftType(null);
    };
    
    // Скрываем тултип при клике вне аватара
    useEffect(() => {
        const handleClickOutside = () => {
            setHoveredSlot(null);
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // Оптимизированная функция renderSlots для ShiftPanel
    const renderSlots = useMemo(() => {
        console.log('[ShiftPanel] Re-rendering slots');
        
        // Используем локальное состояние вместо пропсов для предотвращения лишних перерисовок
        const localDayShifts = [...dayShifts];
        const localNightShifts = [...nightShifts];
        
        // Проверяем, есть ли пользователя с флагом старшего курьера
        const seniorCourierShifts = localDayShifts.concat(localNightShifts).filter(shift => shift.isSeniorCourier);
        console.info('[ShiftPanel] Смены старших курьеров:', seniorCourierShifts);
        
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
                
                // Проверяем, нужно ли показать тултип принудительно (при клике)
                const showTooltip = hoveredSlot && 
                                   hoveredSlot.shiftType === shiftType && 
                                   hoveredSlot.slotIndex === index && 
                                   hoveredSlot.showTooltip;
                
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
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                position: 'relative'
                            }}
                        >
                            {existingShift ? (
                                <React.Fragment>
                                    <CourierAvatar 
                                        src={existingShift.photo_url || defaultAvatar} 
                                        alt={`${existingShift.firstName || 'Курьер'}`}
                                        style={{
                                            willChange: 'transform',
                                            transform: 'translateZ(0)'
                                        }}
                                        // Обработчик клика для информационного тултипа
                                        onClick={(e) => handleCourierAvatarClick(e, existingShift, shiftType, index)}
                                        // Добавляем обработчики для долгого нажатия
                                        onMouseDown={(e) => handleCourierAvatarPress(e, existingShift, shiftType, index)}
                                        onMouseUp={handleCourierAvatarRelease}
                                        onMouseLeave={handleCourierAvatarRelease}
                                        onTouchStart={(e) => handleCourierAvatarPress(e, existingShift, shiftType, index)}
                                        onTouchEnd={handleCourierAvatarRelease}
                                        onTouchCancel={handleCourierAvatarRelease}
                                    />
                                    {/* Анимация при долгом нажатии */}
                                    {pressAnimationActive && 
                                     pressAnimationSlot === index && 
                                     pressAnimationShiftType === shiftType && (
                                        <PressAnimation className={pressAnimationActive ? 'active' : ''} />
                                    )}
                                    {existingShift.isSeniorCourier && (
                                        <SeniorBadge 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedCourier({
                                                    id: existingShift.userId || '',
                                                    name: `${existingShift.firstName || ''} ${existingShift.lastName || ''}`.trim(),
                                                    avatar: existingShift.photo_url || undefined,
                                                    isSeniorCourier: existingShift.isSeniorCourier
                                                });
                                                setProfileDialogOpen(true);
                                                console.info('⭐ Клик по значку старшего курьера:', existingShift);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                            title="Открыть профиль старшего курьера"
                                        >
                                            <span style={{ 
                                                fontSize: '12px', 
                                                fontWeight: 'bold' 
                                            }}>⭐</span>
                                        </SeniorBadge>
                                    )}
                                </React.Fragment>
                            ) : (
                                <PlusIcon>+</PlusIcon>
                            )}
                        </SlotButton>
                        
                        {existingShift && (
                            <SlotTooltip style={{ opacity: showTooltip ? 1 : undefined }}>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}>
                                    {existingShift.isSeniorCourier && (
                                        <span style={{
                                            display: 'inline-block',
                                            background: 'linear-gradient(45deg, #FFC107, #FF9800)',
                                            color: '#333',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            marginBottom: '5px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }}>
                                            ⭐ Старший курьер
                                        </span>
                                    )}
                                    <span>{existingShift.firstName || 'Курьер'} {existingShift.lastName || ''}</span>
                                </div>
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
    }, [dayShifts, nightShifts, currentUserId, handleSlotSelect, handleCourierAvatarPress, handleCourierAvatarRelease, 
        pressAnimationActive, pressAnimationSlot, pressAnimationShiftType, handleCourierAvatarClick, hoveredSlot]);

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

            {/* Добавляем подсказку о длительном нажатии */}
            <LongPressHint>
                💡 Совет: Удерживайте аватар курьера для просмотра расширенного профиля и управления статусом
            </LongPressHint>

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
            
            {/* Диалог профиля курьера (при долгом нажатии) */}
            {selectedCourier && (
                <CourierProfileDialog
                    open={profileDialogOpen}
                    onClose={() => setProfileDialogOpen(false)}
                    courierId={Number(selectedCourier.id)}
                    courierName={selectedCourier.name}
                    courierAvatar={selectedCourier.avatar}
                    chatId={chatId}
                    isSeniorCourier={selectedCourier.isSeniorCourier}
                />
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