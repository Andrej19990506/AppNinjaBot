import { useState, useCallback, useRef } from 'react';
import { DraggableProvided, DroppableProvided, DropResult } from '@hello-pangea/dnd';
import { ShiftSlot } from '../types/shifts';

interface UseShiftDragAndDropProps {
    isSeniorUser: boolean;
    onItemMove: (
        item: ShiftSlot,
        sourceType: 'day' | 'night',
        sourceIndex: number,
        targetType: 'day' | 'night',
        targetIndex: number
    ) => Promise<void> | void;
    onLongPressNonSenior?: (item: ShiftSlot) => void;
    longPressDelay?: number;
}

interface UseShiftDragAndDropResult {
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
    
    const [pressAnimationActive, setPressAnimationActive] = useState(false);
    const [pressAnimationSlot, setPressAnimationSlot] = useState<number | null>(null);
    const [pressAnimationShiftType, setPressAnimationShiftType] = useState<'day' | 'night' | null>(null);
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isDraggingRef = useRef(false);

    const onDragEnd = useCallback((result: DropResult) => {
        console.log('[useShiftDragAndDrop] onDragEnd called with result:', result);
        
        const { source, destination, draggableId, reason } = result;
        
        if (!destination) {
            console.log('[useShiftDragAndDrop] No destination, cancelling drag');
            return;
        }
        
        if (reason === 'CANCEL') {
            console.log('[useShiftDragAndDrop] Drag cancelled by user');
            return;
        }
        
        if (!isSeniorUser) {
            console.log('[useShiftDragAndDrop] User is not senior, cancelling drag');
            return;
        }

        const sourceType = source.droppableId as 'day' | 'night';
        const targetType = destination.droppableId as 'day' | 'night';
        const sourceIndex = source.index;
        const targetIndex = destination.index;
        
        console.log('[useShiftDragAndDrop] Processing drag:', {
            sourceType,
            targetType,
            sourceIndex,
            targetIndex,
            draggableId
        });
        
        const [shiftType, index] = draggableId.split('-');
        const draggedItem: ShiftSlot = {
            shiftType: shiftType as 'day' | 'night',
            slotIndex: parseInt(index, 10)
        };
        
        console.log('[useShiftDragAndDrop] Calling onItemMove with:', draggedItem);
        onItemMove(draggedItem, sourceType, sourceIndex, targetType, targetIndex);
        
        // Reset animation states after drag
        setPressAnimationActive(false);
        setPressAnimationSlot(null);
        setPressAnimationShiftType(null);
        isDraggingRef.current = false;
    }, [isSeniorUser, onItemMove]);

    const handleItemPress = useCallback((
        event: React.MouseEvent | React.TouchEvent,
        item: ShiftSlot,
        type: 'day' | 'night',
        index: number
    ) => {
        console.log('[useShiftDragAndDrop] handleItemPress called:', {
            item,
            type,
            index,
            isSeniorUser,
            isDragging: isDraggingRef.current
        });
        
        event.preventDefault();
        event.stopPropagation();
        
        // Clear any existing timer
        if (pressTimerRef.current) {
            console.log('[useShiftDragAndDrop] Clearing existing press timer');
            clearTimeout(pressTimerRef.current);
        }
        
        // Set animation state
        setPressAnimationActive(true);
        setPressAnimationSlot(index);
        setPressAnimationShiftType(type);
        
        console.log('[useShiftDragAndDrop] Animation states set:', {
            pressAnimationActive: true,
            pressAnimationSlot: index,
            pressAnimationShiftType: type
        });
        
        // Start long press timer
        pressTimerRef.current = setTimeout(() => {
            console.log('[useShiftDragAndDrop] Long press timer triggered');
            
            if (isSeniorUser) {
                console.log('[useShiftDragAndDrop] Senior user long press - enabling drag');
                isDraggingRef.current = true;
                
                // Get the target element
                const target = event.target as HTMLElement;
                const avatarContainer = target.closest('.courier-avatar-container') || target;
                
                if (avatarContainer) {
                    // Add dragging class to avatar container
                    avatarContainer.classList.add('dragging');
                    
                    // Create custom drag start event
                    const customEvent = new CustomEvent('customDragStart', {
                        detail: {
                            item,
                            type,
                            index,
                            position: 'touches' in event 
                                ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
                                : { x: event.clientX, y: event.clientY }
                        },
                        bubbles: true
                    });
                    
                    // Dispatch the custom event
                    avatarContainer.dispatchEvent(customEvent);
                    
                    console.log('[useShiftDragAndDrop] Dispatched custom drag start event:', customEvent);
                }
            } else if (onLongPressNonSenior) {
                console.log('[useShiftDragAndDrop] Non-senior user long press - showing profile');
                onLongPressNonSenior(item);
                // Reset animation for non-senior users
                setPressAnimationActive(false);
                setPressAnimationSlot(null);
                setPressAnimationShiftType(null);
            }
        }, longPressDelay);
        
    }, [isSeniorUser, onLongPressNonSenior, longPressDelay]);

    const handleItemRelease = useCallback(() => {
        console.log('[useShiftDragAndDrop] handleItemRelease called with animation state:', {
            pressAnimationActive,
            pressAnimationSlot,
            pressAnimationShiftType,
            isDragging: isDraggingRef.current
        });
        
        // Останавливаем анимацию, если она есть
        if (pressTimerRef.current) {
            console.log('[useShiftDragAndDrop] Clearing press timer');
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        
        // Сбрасываем состояние анимации
        setPressAnimationActive(false);
        setPressAnimationSlot(null);
        setPressAnimationShiftType(null);
        
        // Проверяем наличие элементов с классом dragging
        const draggingElements = document.querySelectorAll('.dragging');
        console.log(`[useShiftDragAndDrop] Found ${draggingElements.length} elements with dragging class`);
        
        if (isDraggingRef.current) {
            console.log('[useShiftDragAndDrop] Stopping drag operation, isDraggingRef was true');
            isDraggingRef.current = false;
            
            // Очищаем обработчики событий на document - не делаем это здесь, так как
            // эти обработчики не доступны в этом контексте
            console.log('[useShiftDragAndDrop] Note: Event listeners should be cleaned up elsewhere');
            
            // Убираем класс dragging со всех элементов, у которых он есть
            document.querySelectorAll('.dragging').forEach(el => {
                console.log('[useShiftDragAndDrop] Removing dragging class from element:', el);
                el.classList.remove('dragging');
            });
        } else if (draggingElements.length > 0) {
            console.log('[useShiftDragAndDrop] Drag ref was false but found dragging elements, cleaning up');
            
            draggingElements.forEach(el => {
                console.log('[useShiftDragAndDrop] Removing dragging class from orphaned element:', el);
                el.classList.remove('dragging');
            });
        }
    }, [
        pressAnimationActive, 
        pressAnimationSlot, 
        pressAnimationShiftType, 
        isDraggingRef,
        pressTimerRef
    ]);

    // Хелперы для props react-beautiful-dnd
    const getDraggableProps = useCallback((provided: DraggableProvided) => {
        console.log('[useShiftDragAndDrop] Getting draggable props');
        return {
            ...provided.draggableProps,
            ...provided.dragHandleProps,
            ref: provided.innerRef,
        };
    }, []);

    const getDroppableProps = useCallback((provided: DroppableProvided) => {
        console.log('[useShiftDragAndDrop] Getting droppable props');
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
        getDraggableProps,
        getDroppableProps,
    };
};

export default useShiftDragAndDrop; 