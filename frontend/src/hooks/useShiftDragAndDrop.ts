import { useState, useCallback, useRef, useEffect } from 'react';
import { DraggableProvided, DroppableProvided, DropResult } from '@hello-pangea/dnd';
import { ShiftSlot } from '../types/shifts';

interface UseShiftDragAndDropProps {
    isSeniorUser: boolean;
    onItemMove?: (
        item: ShiftSlot,
        sourceType: 'day' | 'night',
        sourceIndex: number,
        targetType: 'day' | 'night',
        targetIndex: number
    ) => Promise<void> | void;
    onLongPressNonSenior?: (item: ShiftSlot) => void;
    longPressDelay?: number;
}

export interface UseShiftDragAndDropResult {
    // Функции для react-beautiful-dnd
    onDragEnd: (result: DropResult) => void;
    
    // Функции для обработки долгого нажатия
    handleItemPress: (
        event: React.MouseEvent | React.TouchEvent,
        item: ShiftSlot,
        type: 'day' | 'night',
        index: number
    ) => void;
    handleItemRelease: () => void;
    
    // Состояния для анимации
    pressAnimationActive: boolean;
    pressAnimationSlot: number | null;
    pressAnimationShiftType: 'day' | 'night' | null;
    isDragging: boolean;
    
    // Функции для рендеринга
    getDraggableProps: (provided: DraggableProvided) => any;
    getDroppableProps: (provided: DroppableProvided) => any;
}

export const useShiftDragAndDrop = ({
    isSeniorUser,
    onItemMove,
    onLongPressNonSenior,
    longPressDelay = 500
}: UseShiftDragAndDropProps): UseShiftDragAndDropResult => {
    console.log('[useShiftDragAndDrop] Initializing with props:', { isSeniorUser, longPressDelay });
    
    // Состояния для анимации долгого нажатия
    const [pressAnimationActive, setPressAnimationActive] = useState(false);
    const [pressAnimationSlot, setPressAnimationSlot] = useState<number | null>(null);
    const [pressAnimationShiftType, setPressAnimationShiftType] = useState<'day' | 'night' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    // Добавляем новое состояние для отслеживания последней операции перетаскивания
    const [lastDragOperation, setLastDragOperation] = useState<{
        sourceType: 'day' | 'night';
        sourceIndex: number;
        targetType: 'day' | 'night';
        targetIndex: number;
        timestamp: number;
    } | null>(null);
    
    // Реф для таймера и флаг для отслеживания перетаскивания
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const draggedItemRef = useRef<{
        item: ShiftSlot,
        type: 'day' | 'night',
        index: number
    } | null>(null);
    const draggingInProgressRef = useRef(false);
    
    // Очистить таймер при размонтировании
    useEffect(() => {
        return () => {
            if (pressTimerRef.current) {
                clearTimeout(pressTimerRef.current);
            }
        };
    }, []);
    
    // Эффект для сброса состояния перетаскивания, если компонент размонтирован во время перетаскивания
    useEffect(() => {
        // Функция для сброса перетаскивания при выходе
        const handleUnload = () => {
            if (draggingInProgressRef.current) {
                draggingInProgressRef.current = false;
                setIsDragging(false);
            }
        };
        
        // Функция для сброса перетаскивания при завершении из ShiftPanelContainer
        const handleCustomDragEnd = () => {
            console.log('[useShiftDragAndDrop] Received customDragEnd event');
            setIsDragging(false);
            draggingInProgressRef.current = false;
            setPressAnimationActive(false);
            setPressAnimationSlot(null);
            setPressAnimationShiftType(null);
            
            // Удаляем класс dragging со всех элементов
            const draggingElements = document.querySelectorAll('.dragging');
            draggingElements.forEach(el => {
                if (el.classList) {
                    el.classList.remove('dragging');
                }
            });
        };
        
        // Добавляем обработчики событий
        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('customDragEnd', handleCustomDragEnd);
        
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('customDragEnd', handleCustomDragEnd);
        };
    }, []);

    // Обработчик окончания перетаскивания
    const onDragEnd = useCallback((result: DropResult) => {
        console.log('[useShiftDragAndDrop] onDragEnd called with result:', result);
        
        // Сбрасываем состояние перетаскивания и флаги
        setIsDragging(false);
        draggingInProgressRef.current = false;
        setPressAnimationActive(false);
        setPressAnimationSlot(null);
        setPressAnimationShiftType(null);
        
        // Отправляем событие customDragEnd для синхронизации состояния компонентов
        const customDragEndEvent = new CustomEvent('customDragEnd', {
            bubbles: true,
            cancelable: true,
            detail: { result }
        });
        document.dispatchEvent(customDragEndEvent);
        
        // Если нет назначения, или перетаскивание было отменено
        if (!result.destination || result.reason === 'CANCEL') {
            console.log('[useShiftDragAndDrop] Drag cancelled or no destination');
            return;
        }

        // Проверяем, является ли пользователь старшим курьером
        if (!isSeniorUser) {
            console.log('[useShiftDragAndDrop] User is not senior, cannot move items');
            return;
        }

        // Извлекаем информацию о начальной и конечной позиции
        const sourceType = result.source.droppableId === 'day-shift' ? 'day' : 'night';
        const targetType = result.destination.droppableId === 'day-shift' ? 'day' : 'night';
        const sourceIndex = result.source.index;
        const targetIndex = result.destination.index;
        
        // Получаем информацию о перетаскиваемом элементе
        const draggedId = result.draggableId;
        const [itemType, itemIndex] = draggedId.split('-');
        const draggedItem = draggedItemRef.current?.item || {
            shiftType: itemType as 'day' | 'night',
            slotIndex: parseInt(itemIndex)
        };
        
        console.log('[useShiftDragAndDrop] Moving item:', {
            item: draggedItem,
            sourceType,
            sourceIndex,
            targetType,
            targetIndex
        });
        
        // Генерируем уникальный ID для операции перетаскивания
        const operationId = `drag-${Date.now()}-${draggedItem.userId || 'unknown'}`;
        
        // Сохраняем информацию о текущей операции перетаскивания
        setLastDragOperation({
            sourceType,
            sourceIndex,
            targetType,
            targetIndex,
            timestamp: Date.now()
        });

        // Создаем и рассылаем событие, уведомляющее о начале изменения состояния
        const dragStartEvent = new CustomEvent('dragOperationStart', {
            detail: {
                sourceType,
                sourceIndex,
                targetType,
                targetIndex,
                item: draggedItem,
                operationId,
                isDragOperation: true
            },
            bubbles: true
        });
        document.dispatchEvent(dragStartEvent);
        
        // Вызываем обработчик перемещения если он предоставлен
        if (onItemMove) {
            onItemMove(draggedItem, sourceType, sourceIndex, targetType, targetIndex);
        }
        
        // Очищаем референс перетаскиваемого элемента
        draggedItemRef.current = null;
        
        // Отправляем событие завершения через 5 секунд, чтобы убедиться,
        // что все операции были обработаны правильно и UI обновлен
        setTimeout(() => {
            const dragEndEvent = new CustomEvent('dragOperationComplete', {
                detail: {
                    operationId,
                    sourceType,
                    sourceIndex,
                    targetType,
                    targetIndex,
                    item: draggedItem,
                },
                bubbles: true
            });
            document.dispatchEvent(dragEndEvent);
            console.log('[useShiftDragAndDrop] Final cleanup for drag operation:', operationId);
        }, 5000);
    }, [isSeniorUser, onItemMove]);

    // Обработчик нажатия на элемент
    const handleItemPress = useCallback((
        event: React.MouseEvent | React.TouchEvent,
        item: ShiftSlot,
        type: 'day' | 'night',
        index: number
    ) => {
        console.log('[useShiftDragAndDrop] handleItemPress called:', { item, type, index });
        
        // Если перетаскивание уже началось, ничего не делаем
        if (draggingInProgressRef.current) {
            console.log('[useShiftDragAndDrop] Drag already in progress, ignoring press');
            return;
        }

        // Сохраняем информацию о текущем элементе
        draggedItemRef.current = { item, type, index };
        
        // Очищаем существующий таймер если он есть
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
        }
        
        // Устанавливаем состояние анимации
        setPressAnimationActive(true);
        setPressAnimationSlot(index);
        setPressAnimationShiftType(type);
        
        // Создаем таймер для долгого нажатия
        pressTimerRef.current = setTimeout(() => {
            console.log('[useShiftDragAndDrop] Long press detected');
            
            // Разные действия для старшего и обычного курьера
            if (isSeniorUser) {
                // Для старшего курьера - начинаем перетаскивание
                console.log('[useShiftDragAndDrop] Senior user - starting drag');
                setIsDragging(true);
                draggingInProgressRef.current = true;
                
                // Добавляем класс dragging для визуального эффекта
                const elements = document.querySelectorAll('.courier-avatar-container');
                elements.forEach(el => {
                    if (el.contains(event.target as Node)) {
                        el.classList.add('dragging');
                    }
                });
                
                // Рассылаем событие для компонента ShiftPanel, чтобы он начал отслеживать перетаскивание
                const customEvent = new CustomEvent('customDragStart', { 
                    detail: {
                        item, 
                        type, 
                        index,
                        position: 'touches' in event 
                            ? { x: event.touches[0].clientX, y: event.touches[0].clientY } 
                            : { x: event.clientX, y: event.clientY }
                    },
                    bubbles: true, 
                    cancelable: true 
                });
                document.dispatchEvent(customEvent);
                console.log('[useShiftDragAndDrop] Dispatched customDragStart event');
            } 
            else if (onLongPressNonSenior) {
                // Для обычного курьера - показываем профиль
                console.log('[useShiftDragAndDrop] Non-senior user - showing profile');
                onLongPressNonSenior(item);
                
                // Сбрасываем анимацию
                setPressAnimationActive(false);
                setPressAnimationSlot(null);
                setPressAnimationShiftType(null);
            }
        }, longPressDelay);
        
        // Добавляем глобальные обработчики для отслеживания окончания нажатия
        if ('touches' in event) {
            // Для мобильных устройств
            document.addEventListener('touchend', handleItemRelease, { once: true });
            document.addEventListener('touchcancel', handleItemRelease, { once: true });
        } else {
            // Для настольных устройств
            document.addEventListener('mouseup', handleItemRelease, { once: true });
            document.addEventListener('mouseleave', handleItemRelease, { once: true });
        }
    }, [isSeniorUser, longPressDelay, onLongPressNonSenior]);

    // Обработчик отпускания элемента
    const handleItemRelease = useCallback(() => {
        console.log('[useShiftDragAndDrop] handleItemRelease called');
        
        // Очищаем таймер долгого нажатия
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        
        // Сбрасываем состояние анимации
        setPressAnimationActive(false);
        setPressAnimationSlot(null);
        setPressAnimationShiftType(null);
        
        // Удаляем класс dragging со всех элементов
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(el => {
            el.classList.remove('dragging');
        });
        
        // Удаляем глобальные обработчики
        document.removeEventListener('mouseup', handleItemRelease);
        document.removeEventListener('mouseleave', handleItemRelease);
        document.removeEventListener('touchend', handleItemRelease);
        document.removeEventListener('touchcancel', handleItemRelease);
    }, []);

    // Хелперы для props react-beautiful-dnd
    const getDraggableProps = useCallback((provided: DraggableProvided) => {
        return {
            ...provided.draggableProps,
            ...provided.dragHandleProps,
            ref: provided.innerRef,
        };
    }, []);

    const getDroppableProps = useCallback((provided: DroppableProvided) => {
        return {
            ...provided.droppableProps,
            ref: provided.innerRef,
        };
    }, []);

    return {
        onDragEnd,
        handleItemPress,
        handleItemRelease,
        pressAnimationActive,
        pressAnimationSlot,
        pressAnimationShiftType,
        isDragging,
        getDraggableProps,
        getDroppableProps,
    };
};

export default useShiftDragAndDrop; 