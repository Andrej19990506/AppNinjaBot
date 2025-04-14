import React, { useMemo } from 'react';
import styled from 'styled-components';
import ShiftSlotComponent from './components/ShiftSlot';
import { ShiftSlot } from '../../types/shifts';
import { useShiftUIState } from './hooks/useShiftUIState';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

const SlotsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
    justify-items: center;
`;

interface ShiftPanelContainerProps {
    shiftType: 'day' | 'night';
    shifts: ShiftSlot[];
    maxSlots: number;
    currentUserId: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    isLoading: boolean;
    loadingSlot: number | null;
    userHasShift: boolean;
    chatId?: string;
}

const ShiftPanelContainer: React.FC<ShiftPanelContainerProps> = ({
    shiftType,
    shifts,
    maxSlots,
    currentUserId,
    currentUserName,
    onSlotSelect,
    isLoading,
    loadingSlot,
    userHasShift,
    chatId
}) => {
    const user = useSelector((state: RootState) => state.user.user);
    
    const isSenior = useMemo(() => {
        if (!user || !user.groups || !chatId) return false;
        const currentGroup = user.groups.find(g => String(g.chat_id) === chatId);
        return currentGroup?.is_senior_courier ?? false;
    }, [user, chatId]);

    const {
        draggingItem,
        handleDragStart,
        handleDragEnter,
        handleDragEnd,
        handleCourierClick
    } = useShiftUIState({
        onSlotSelect,
        currentUserId,
        isSenior
    });

    const renderSlots = () => {
        const slots = [];
        const currentShifts = shifts;

        for (let i = 0; i < maxSlots; i++) {
            const slotData = currentShifts.find(shift => shift.slotIndex === i);
            const isCurrentUserBooked = slotData?.userId === currentUserId;
            
            const isDisabled = userHasShift && !isCurrentUserBooked;
            
            const isBeingDragged = draggingItem?.shiftType === shiftType && draggingItem?.slotIndex === i;
            
            slots.push(
                <ShiftSlotComponent
                    key={`${shiftType}-${i}`}
                    shiftType={shiftType}
                    slotIndex={i}
                    courier={slotData}
                    currentUserId={currentUserId}
                    isDisabled={isDisabled}
                    onSlotClick={() => {
                        if (!isDisabled) {
                            onSlotSelect(shiftType, i, undefined, false);
                        }
                    }}
                    onCourierClick={(e, courier) => {
                         if (!isDisabled) handleCourierClick(courier, shiftType, i)
                    }}
                    isDragging={isBeingDragged}
                    onDragStart={() => {
                        if (!isDisabled && slotData) handleDragStart(shiftType, i, slotData)
                    }}
                    onDragEnter={() => {
                        if (!isDisabled) handleDragEnter(shiftType, i)
                    }}
                    onDragEnd={() => {
                        if (!isDisabled) handleDragEnd()
                    }}
                    isLoading={isLoading && loadingSlot === i}
                    isDraggable={!isDisabled && !!slotData?.userId}
                    successAnimation={false}
                    pressAnimationActive={false}
                    isError={false}
                />
            );
        }
        return slots;
    };

    return (
        <>
            <SlotsGrid>
                {renderSlots()}
            </SlotsGrid>
        </>
    );
};

export default ShiftPanelContainer; 