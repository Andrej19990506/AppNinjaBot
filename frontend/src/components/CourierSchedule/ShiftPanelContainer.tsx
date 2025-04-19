import React from 'react';
import styled from 'styled-components';
import ShiftSlotComponent from './components/ShiftSlot';
import { ShiftSlot } from '../../types/shifts';
import { useShiftUIState } from './hooks/useShiftUIState';
import { AnimatePresence, motion } from 'framer-motion';

const SlotsGrid = styled.div`
    position: relative;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
    justify-items: center;
    width: 100%;
    box-sizing: border-box;
    max-height: 100%;
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
    isSenior?: boolean;
    showSuccessMessage: (message: string) => void;
    showErrorMessage?: (message: string) => void;
    draggingShiftType?: 'day' | 'night' | null;
    isDraggingGlobal?: boolean;
}

const ShiftPanelContainer: React.FC<ShiftPanelContainerProps> = React.memo(({
    shiftType,
    shifts,
    maxSlots,
    currentUserId,
    currentUserName,
    onSlotSelect,
    isLoading,
    loadingSlot,
    userHasShift,
    chatId,
    isSenior,
    showSuccessMessage,
    showErrorMessage,
    draggingShiftType,
    isDraggingGlobal
}) => {
    
    useShiftUIState({
        onSlotSelect,
        currentUserId,
        isSenior: isSenior ?? false
    });

    // Animation variants
    const slotVariants = {
        exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } }
    };

    const renderSlots = () => {
        const slots = [];
        const currentShifts = shifts;

        for (let i = 0; i < maxSlots; i++) {
            const slotData = currentShifts.find(shift => shift.slotIndex === i);
            
            const isDisabled = !slotData && userHasShift;
            
            const key = slotData ? slotData.id : `${shiftType}-empty-${i}`;

            slots.push(
                <motion.div
                    key={key}
                    layout
                    exit="exit"
                    variants={slotVariants}
                >
                    <ShiftSlotComponent
                        shiftType={shiftType}
                        slotIndex={i}
                        courier={slotData}
                        currentUserId={currentUserId}
                        isDisabled={isDisabled}
                        onSlotClick={() => {
                            if (!slotData && !isDisabled) {
                                onSlotSelect(shiftType, i, undefined, false);
                            }
                        }}
                        isLoading={isLoading && loadingSlot === i}
                        successAnimation={false}
                        pressAnimationActive={false}
                        isError={false}
                        isSenior={isSenior}
                        showSuccessMessage={showSuccessMessage}
                        showErrorMessage={showErrorMessage}
                        draggingShiftType={draggingShiftType ?? null}
                        isDraggingGlobal={isDraggingGlobal ?? false}
                    />
                </motion.div>
            );
        }
        return slots;
    };

    return (
        <>
            <SlotsGrid>
                {/* @ts-ignore - Suppressing TS2786 related to AnimatePresence return type */}
                <AnimatePresence initial={false}>
                    <>
                        {renderSlots()}
                    </>
                </AnimatePresence>
            </SlotsGrid>
        </>
    );
});

export default ShiftPanelContainer; 