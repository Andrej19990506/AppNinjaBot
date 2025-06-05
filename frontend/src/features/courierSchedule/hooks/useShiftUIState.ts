import { useState, useCallback } from 'react';
import type { ShiftSlot } from '@features/courierSchedule/types/courierScheduleTypes';

interface UseShiftUIStateProps {
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    currentUserId: string;
    isSenior: boolean;
}

export const useShiftUIState = ({ 
    onSlotSelect, 
    currentUserId,
    isSenior
}: UseShiftUIStateProps) => {
    const [draggingItem, setDraggingItem] = useState<{ shiftType: 'day' | 'night', slotIndex: number, itemData: ShiftSlot } | null>(null);
    const [dropTarget, setDropTarget] = useState<{ shiftType: 'day' | 'night', slotIndex: number } | null>(null);

    const handleDragStart = useCallback((shiftType: 'day' | 'night', slotIndex: number, itemData: ShiftSlot) => {
        if (!itemData || !itemData.userId) {
            console.warn('[useShiftUIState] Attempted to drag an invalid item', itemData);
            return; 
        }
        console.log(`[useShiftUIState] Drag Start: ${shiftType} slot ${slotIndex}`, itemData);
        setDraggingItem({ shiftType, slotIndex, itemData });
    }, []);

    const handleDragEnter = useCallback((shiftType: 'day' | 'night', slotIndex: number) => {
        setDropTarget({ shiftType, slotIndex });
    }, []);

    const handleDragEnd = useCallback(() => {
        if (draggingItem && dropTarget && 
            (draggingItem.shiftType !== dropTarget.shiftType || draggingItem.slotIndex !== dropTarget.slotIndex)) {
            
            console.log(`[useShiftUIState] Performing Drop: move from ${draggingItem.shiftType} ${draggingItem.slotIndex} to ${dropTarget.shiftType} ${dropTarget.slotIndex}`);
            
            const draggedShiftData = draggingItem.itemData;

            if (draggedShiftData?.id) {
                onSlotSelect(dropTarget.shiftType, dropTarget.slotIndex, draggedShiftData.id, true);
            } else {
                console.warn('[useShiftUIState] Cannot move shift without ID', draggedShiftData);
            }
        }
        setDraggingItem(null);
        setDropTarget(null);
    }, [draggingItem, dropTarget, onSlotSelect]);

    const handleCourierClick = useCallback((courier: ShiftSlot, shiftType: 'day' | 'night', slotIndex: number) => {
        console.log(`[useShiftUIState] Courier clicked: user ${courier.userId} on ${shiftType} slot ${slotIndex}. Profile dialog opening is disabled.`);
     }, []);

    return {
        draggingItem,
        dropTarget,
        handleDragStart,
        handleDragEnter,
        handleDragEnd,
        handleCourierClick
    };
};

// export default useShiftUIState; 