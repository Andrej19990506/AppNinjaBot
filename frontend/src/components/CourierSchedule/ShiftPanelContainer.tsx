import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import ShiftSlotComponent from './components/ShiftSlot';
import { ShiftSlot } from '../../types/shifts';
import { useShiftUIState } from './hooks/useShiftUIState';
import { AnimatePresence, motion } from 'framer-motion';
import { logger } from '../../utils/logger';

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
    onOpenProfile?: (courier: ShiftSlot) => void;
    onLongPressEmptySlot: (shiftType: 'day' | 'night', slotIndex: number) => void;
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
    isDraggingGlobal,
    onOpenProfile,
    onLongPressEmptySlot
}) => {
    const [activeTooltipSlot, setActiveTooltipSlot] = useState<{ type: 'day' | 'night', index: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleRequestTooltip = useCallback((type: 'day' | 'night', index: number) => {
        if (activeTooltipSlot?.type === type && activeTooltipSlot?.index === index) {
            setActiveTooltipSlot(null);
        } else {
            setActiveTooltipSlot({ type, index });
        }
    }, [activeTooltipSlot]);

    const handleCloseTooltip = useCallback(() => {
        setActiveTooltipSlot(null);
    }, []);

    useEffect(() => {
        if (!activeTooltipSlot) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                handleCloseTooltip();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeTooltipSlot, handleCloseTooltip]);

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
        logger.debug(`[ShiftPanelContainer ${shiftType}] Rendering slots. Received shifts array:`, currentShifts.map(s => ({ id: s.id, userId: s.userId, index: s.slotIndex })) );

        for (let i = 0; i < maxSlots; i++) {
            const slotData = currentShifts.find(shift => shift.slotIndex === i);
            logger.debug(`[ShiftPanelContainer ${shiftType}] Finding data for slot index ${i}. Found:`, slotData ? { id: slotData.id, userId: slotData.userId } : null);

            const isDisabled = !slotData && userHasShift;
            
            const key = slotData ? slotData.id : `${shiftType}-empty-${i}`;

            const isActiveTooltipForThisSlot = activeTooltipSlot?.type === shiftType && activeTooltipSlot?.index === i;

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
                                handleCloseTooltip();
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
                        onOpenProfile={onOpenProfile}
                        isActiveTooltip={isActiveTooltipForThisSlot}
                        onRequestTooltip={handleRequestTooltip}
                        onLongPressEmptySlot={onLongPressEmptySlot}
                    />
                </motion.div>
            );
        }
        return slots;
    };

    return (
        <>
            <SlotsGrid ref={containerRef}>
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