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

// Вариации для плавной анимации слотов
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
            delay: 0.02 * custom, // Уменьшаем задержку с 0.05 до 0.02
            duration: 0.15, // Сокращаем длительность с 0.25 до 0.15
            type: 'spring',
            stiffness: 300, // Увеличиваем жесткость с 260 до 300
            damping: 25 // Увеличиваем демпфирование с 20 до 25
        } 
    }),
    exit: { 
        opacity: 0, 
        scale: 0.5, 
        y: 15,
        transition: { 
            duration: 0.15, // Сокращаем с 0.2 до 0.15
            ease: 'easeOut'
        } 
    }
};

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
    hasSeniorSlot?: boolean;
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
    onLongPressEmptySlot,
    hasSeniorSlot = false
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

    const renderSlots = () => {
        const slots = [];
        const currentShifts = shifts;
        logger.debug(`[ShiftPanelContainer ${shiftType}] Rendering slots. Received shifts array:`, currentShifts.map(s => ({ id: s.id, userId: s.userId, index: s.slotIndex })) );
        logger.debug(`[ShiftPanelContainer ${shiftType}] Debugging senior slot rendering: shiftType=${shiftType}, hasSeniorSlot=${hasSeniorSlot}, isSenior=${isSenior}`);

        // Показываем слот старшего курьера, если это дневная смена и hasSeniorSlot=true
        if (shiftType === 'day' && hasSeniorSlot) {
            const seniorSlotData = currentShifts.find(shift => shift.slotIndex === -1);
            const isOccupied = Boolean(seniorSlotData);

            const shouldRenderSeniorSlot = isOccupied || (isSenior ?? false);
            logger.debug(`[ShiftPanelContainer ${shiftType}] Senior slot check: isOccupied=${isOccupied}, isSenior=${isSenior}, shouldRenderSeniorSlot=${shouldRenderSeniorSlot}`);

            if (shouldRenderSeniorSlot) {
                logger.debug(`[ShiftPanelContainer ${shiftType}] Rendering SENIOR slot with hasSeniorSlot=${hasSeniorSlot}. Found data:`, seniorSlotData ? { id: seniorSlotData.id, userId: seniorSlotData.userId } : 'No senior data found');
                const isSeniorSlotActiveTooltip = activeTooltipSlot?.type === shiftType && activeTooltipSlot?.index === -1;
                
                slots.push(
                    <motion.div
                        key={seniorSlotData ? seniorSlotData.id : 'day-senior-slot'}
                        layout
                        custom={-1} // Используем -1 как уникальный кастомный проп для анимации
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={slotVariants}
                    >
                        <ShiftSlotComponent
                            shiftType={shiftType}
                            slotIndex={-1} 
                            courier={seniorSlotData}
                            currentUserId={currentUserId}
                            isDisabled={!seniorSlotData && !(isSenior ?? false)}
                            onSlotClick={() => {
                                if ((!seniorSlotData && (isSenior ?? false)) || seniorSlotData) {
                                    handleCloseTooltip();
                                    onSlotSelect(shiftType, -1, seniorSlotData?.id, false);
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
                logger.debug(`[ShiftPanelContainer ${shiftType}] Senior slot added. Total slots so far: ${slots.length}`);
            } else {
                logger.debug(`[ShiftPanelContainer ${shiftType}] SENIOR slot for ${shiftType} WILL NOT BE RENDERED (empty and user is not senior).`);
            }
        }

        for (let i = 0; i < maxSlots; i++) {
            const slotData = currentShifts.find(shift => shift.slotIndex === i);
            // logger.debug(`[ShiftPanelContainer ${shiftType}] Finding data for slot index ${i}. Found:`, slotData ? { id: slotData.id, userId: slotData.userId } : null); // Закомментировано для уменьшения шума

            const isDisabled = !slotData && userHasShift; 
            const key = slotData ? slotData.id : `${shiftType}-empty-${i}`;
            const isActiveTooltipForThisSlot = activeTooltipSlot?.type === shiftType && activeTooltipSlot?.index === i;

            slots.push(
                <motion.div
                    key={key}
                    layout
                    custom={i} // Используем индекс для кастомного пропа анимации
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={slotVariants}
                >
                    <ShiftSlotComponent
                        shiftType={shiftType}
                        slotIndex={i}
                        courier={slotData}
                        currentUserId={currentUserId}
                        isDisabled={isDisabled || (isLoading && loadingSlot === i)}
                        onSlotClick={() => {
                            if (!isDisabled || slotData) { // Разрешаем клик если не disabled или если есть данные (для тултипа)
                                handleCloseTooltip();
                                onSlotSelect(shiftType, i, slotData?.id, false);
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
                        // Обычные слоты не являются isSeniorCourierSlot, если только не будет отдельной логики
                        isSeniorCourierSlot={false} 
                    />
                </motion.div>
            );
        }
        return slots;
    };

    const handleOpenProfile = useCallback((courier: ShiftSlot) => {
        console.log('[ShiftPanelContainer] handleOpenProfile called with courier:', courier);
        if (onOpenProfile) {
            console.log('[ShiftPanelContainer] Calling original onOpenProfile');
            onOpenProfile(courier);
        } else {
            console.error('[ShiftPanelContainer] onOpenProfile is not provided');
        }
    }, [onOpenProfile]);

    return (
        <>
            <SlotsGrid ref={containerRef}>
                 {/* @ts-ignore: Ignoring type errors with AnimatePresence */}
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