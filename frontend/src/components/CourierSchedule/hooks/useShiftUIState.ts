import { useState, useEffect } from 'react';

interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

interface UseShiftUIStateProps {
    dayShifts: ShiftSlotLocal[];
    nightShifts: ShiftSlotLocal[];
}

export const useShiftUIState = ({ dayShifts, nightShifts }: UseShiftUIStateProps) => {
    // Создаем локальное состояние для смен, чтобы контролировать UI независимо от props
    const [localDayShifts, setLocalDayShifts] = useState<ShiftSlotLocal[]>(dayShifts);
    const [localNightShifts, setLocalNightShifts] = useState<ShiftSlotLocal[]>(nightShifts);
    
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
    
    // Добавляем состояние для модального окна подтверждения
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [pendingShift, setPendingShift] = useState<{
        shiftType: 'day' | 'night', 
        slotIndex: number, 
        existingShiftId?: string
    } | null>(null);
    
    // Добавляем состояние для анимации успешного перемещения
    const [successAnimations, setSuccessAnimations] = useState<Map<string, boolean>>(new Map());
    
    // Добавляем состояние для drag-and-drop
    const [isDragging, setIsDragging] = useState(false);
    const [draggedItem, setDraggedItem] = useState<{
        shiftType: 'day' | 'night';
        slotIndex: number;
        item: ShiftSlotLocal;
    } | null>(null);
    
    // Добавляем useEffect для синхронизации локальных состояний с пропсами
    useEffect(() => {
        console.log('[ShiftPanel] Updating local shifts from props due to changes');
        setLocalDayShifts(dayShifts);
        setLocalNightShifts(nightShifts);
    }, [dayShifts, nightShifts]);
    
    // Функция для обновления локальных данных из props
    const updateLocalShiftsFromProps = () => {
        console.log('[ShiftPanel] Updating local shifts from props (manual)');
        setLocalDayShifts(dayShifts);
        setLocalNightShifts(nightShifts);
    };
    
    // Функция для очистки состояния активного тултипа
    const clearHoveredSlot = () => {
        setHoveredSlot(null);
    };
    
    // Функция для открытия окна подтверждения
    const openConfirmation = (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => {
        setPendingShift({ shiftType, slotIndex, existingShiftId });
        setConfirmationOpen(true);
    };
    
    // Функция для закрытия окна подтверждения
    const closeConfirmation = () => {
        setConfirmationOpen(false);
        setPendingShift(null);
    };
    
    // Открытие диалога профиля курьера
    const openProfileDialog = (courier: { 
        userId?: string; 
        firstName?: string; 
        lastName?: string; 
        photo_url?: string | null;
        isSeniorCourier?: boolean;
    }) => {
        if (!courier.userId) return;
        
        setSelectedCourier({
            id: courier.userId,
            name: `${courier.firstName || ''} ${courier.lastName || ''}`.trim(),
            avatar: courier.photo_url || undefined,
            isSeniorCourier: courier.isSeniorCourier
        });
        setProfileDialogOpen(true);
    };
    
    // Закрытие диалога профиля
    const closeProfileDialog = () => {
        setProfileDialogOpen(false);
        setSelectedCourier(null);
    };
    
    // Запуск таймера долгого нажатия
    const startPressTimer = (shiftType: 'day' | 'night', slotIndex: number, callback: () => void) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
        }
        
        setPressAnimationShiftType(shiftType);
        setPressAnimationSlot(slotIndex);
        setPressAnimationActive(true);
        
        const timer = setTimeout(() => {
            setPressAnimationActive(false);
            callback();
        }, 500); // 500ms для долгого нажатия
        
        setPressTimer(timer);
    };
    
    // Остановка таймера долгого нажатия
    const clearPressTimer = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
        }
        setPressAnimationActive(false);
        setPressAnimationSlot(null);
        setPressAnimationShiftType(null);
    };
    
    // Запуск анимации успешного действия
    const showSuccessAnimation = (shiftType: 'day' | 'night', slotIndex: number) => {
        const animationKey = `${shiftType}-${slotIndex}`;
        setSuccessAnimations(new Map(successAnimations.set(animationKey, true)));
        
        // Автоматически убираем анимацию через 1.5 секунды
        setTimeout(() => {
            setSuccessAnimations(prev => {
                const newMap = new Map(prev);
                newMap.delete(animationKey);
                return newMap;
            });
        }, 1500);
    };
    
    // Начало перетаскивания
    const startDragging = (shiftType: 'day' | 'night', slotIndex: number, item: ShiftSlotLocal) => {
        setIsDragging(true);
        setDraggedItem({ shiftType, slotIndex, item });
    };
    
    // Завершение перетаскивания
    const stopDragging = () => {
        setIsDragging(false);
        setDraggedItem(null);
    };

    return {
        // Состояния
        localDayShifts,
        localNightShifts,
        profileDialogOpen,
        selectedCourier,
        hoveredSlot,
        pressAnimationActive,
        pressAnimationSlot,
        pressAnimationShiftType,
        confirmationOpen,
        pendingShift,
        successAnimations,
        isDragging,
        draggedItem,
        
        // Сеттеры состояний
        setLocalDayShifts,
        setLocalNightShifts,
        setHoveredSlot,
        
        // Функции управления
        updateLocalShiftsFromProps,
        clearHoveredSlot,
        openConfirmation,
        closeConfirmation,
        openProfileDialog,
        closeProfileDialog,
        startPressTimer,
        clearPressTimer,
        showSuccessAnimation,
        startDragging,
        stopDragging
    };
};

export default useShiftUIState; 