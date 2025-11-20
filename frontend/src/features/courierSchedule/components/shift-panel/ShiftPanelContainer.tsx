import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import ShiftSlotComponent from '@/features/courierSchedule/components/ShiftSlot';
import { ShiftSlot } from '@features/courierSchedule/types/courierScheduleTypes';
import { useShiftUIState } from '@features/courierSchedule/hooks/useShiftUIState';
import { AnimatePresence, motion } from 'framer-motion';
import { logger } from '@shared/utils/logger';

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

const slotVariants = {
    initial: (custom: number) => ({ 
        opacity: 0, 
        scale: 0.6,
        y: 15 
    }),
    animate: (custom: number) => ({ 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { 
            delay: 0.02 * custom, 
            duration: 0.15, 
            type: 'spring',
            stiffness: 300, 
            damping: 25 
        } 
    }),
    exit: { 
        opacity: 0, 
        scale: 0.5, 
        y: 15,
        transition: { 
            duration: 0.15, 
            ease: 'easeOut'
        } 
    }
};

interface ShiftPanelContainerProps {
    shiftType: 'day' | 'night' | null; // Deprecated - оставлено для совместимости
    templateId?: string | null; // ID шаблона смены (обязателен для новых смен)
    shifts: ShiftSlot[];
    maxSlots: number;
    currentUserId: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean, templateId?: string) => void;
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
    hasSeniorSlot?: boolean;
}

const ShiftPanelContainer: React.FC<ShiftPanelContainerProps> = React.memo(({
    shiftType,
    templateId, // ID шаблона смены
    shifts,
    maxSlots,
    currentUserId,
    onSlotSelect,
    isLoading,
    loadingSlot,
    userHasShift,
    isSenior,
    showSuccessMessage,
    showErrorMessage,
    draggingShiftType,
    isDraggingGlobal,
    onOpenProfile,
    onLongPressEmptySlot,
    hasSeniorSlot = false
}) => {
    const [activeTooltipSlot, setActiveTooltipSlot] = useState<{ type: 'day' | 'night', index: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Используем shiftType для совместимости, если templateId не передан
    const effectiveShiftType = shiftType || 'day'; // Fallback для совместимости

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

    const renderSlots = () => {
        const slots = [];
        const currentShifts = shifts;

        if (hasSeniorSlot) {
            const seniorSlotData = currentShifts.find(shift => shift.slotIndex === -1);
            const isOccupied = Boolean(seniorSlotData);

            const shouldRenderSeniorSlot = isOccupied || (isSenior ?? false);

            if (shouldRenderSeniorSlot) {
                const isSeniorSlotActiveTooltip = activeTooltipSlot?.type === effectiveShiftType && activeTooltipSlot?.index === -1;
                
                slots.push(
                    <motion.div
                        key={seniorSlotData ? seniorSlotData.id : 'senior-slot'}
                        layout
                        custom={-1} 
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={slotVariants}
                    >
                        <ShiftSlotComponent
                            shiftType={effectiveShiftType}
                            templateId={templateId}
                            slotIndex={-1} 
                            courier={seniorSlotData}
                            currentUserId={currentUserId}
                            isDisabled={!seniorSlotData && !(isSenior ?? false)}
                            onSlotClick={() => {
                                if ((!seniorSlotData && (isSenior ?? false)) || seniorSlotData) {
                                    handleCloseTooltip();
                                    onSlotSelect(effectiveShiftType, -1, seniorSlotData?.id, false, templateId || undefined);
                                }
                            }}
                            isLoading={isLoading && loadingSlot === -1}
                            successAnimation={false}
                            pressAnimationActive={false}
                            isError={false}
                            isSenior={isSenior} 
                            showSuccessMessage={showSuccessMessage}
                            showErrorMessage={showErrorMessage}
                            draggingShiftType={draggingShiftType ?? null}
                            isDraggingGlobal={isDraggingGlobal ?? false}
                            onOpenProfile={handleOpenProfile}
                            isActiveTooltip={isSeniorSlotActiveTooltip}
                            onRequestTooltip={handleRequestTooltip}
                            onLongPressEmptySlot={onLongPressEmptySlot}
                            isSeniorCourierSlot={true} 
                        />
                    </motion.div>
                );
            }
        }

        for (let i = 0; i < maxSlots; i++) {
            const slotData = currentShifts.find(shift => shift.slotIndex === i);

            const isDisabled = !slotData && userHasShift; 
            const key = slotData ? slotData.id : `${templateId || effectiveShiftType}-empty-${i}`;
            const isActiveTooltipForThisSlot = activeTooltipSlot?.type === effectiveShiftType && activeTooltipSlot?.index === i;

            slots.push(
                <motion.div
                    key={key}
                    layout
                    custom={i} 
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={slotVariants}
                >
                    <ShiftSlotComponent
                        shiftType={effectiveShiftType}
                        templateId={templateId}
                        slotIndex={i}
                        courier={slotData}
                        currentUserId={currentUserId}
                        isDisabled={isDisabled || (isLoading && loadingSlot === i)}
                        onSlotClick={() => {
                            if (!isDisabled || slotData) { 
                                handleCloseTooltip();
                                onSlotSelect(effectiveShiftType, i, slotData?.id, false, templateId || undefined);
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
                        onOpenProfile={handleOpenProfile}
                        isActiveTooltip={isActiveTooltipForThisSlot}
                        onRequestTooltip={handleRequestTooltip}
                        onLongPressEmptySlot={onLongPressEmptySlot}
                        isSeniorCourierSlot={false} 
                    />
                </motion.div>
            );
        }
        return slots;
    };

    const handleOpenProfile = useCallback((courier: ShiftSlot) => {
        if (onOpenProfile) {
            onOpenProfile(courier);
        } else {
        }
    }, [onOpenProfile]);

    return (
        <>
            <SlotsGrid ref={containerRef}>
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