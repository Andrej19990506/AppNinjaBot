import React, { useMemo } from 'react';
import styled from 'styled-components';
import ShiftPanelContainer from '@/features/courierSchedule/components/shift-panel/ShiftPanelContainer';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion'; 
import { CourierShift } from '@features/courierSchedule/types/courierScheduleTypes'; // ОСТАВЛЯЕМ
import { format } from 'date-fns';
import CouriersPanel from '@/features/courierSchedule/components/CouriersPanel';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import { fetchCouriersIfAllowed } from '@features/courierSchedule/store/courierSlice/courierThunks';
import { selectUser } from '@shared/store/userSlice/userSelectors';

type ShiftType = CourierShift['shiftType'];
const COURIERS_PANEL_HEIGHT = 110; // px

const ShiftSection = styled(motion.div)`
    margin-bottom: 37px;
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

const SeniorHint = styled.div`
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(255, 213, 0, 0.1);
    border-left: 3px solid #FFD700;
    border-radius: 4px;
    color: #705E00;
    font-size: 0.9rem;
    line-height: 1.5;
`;

const NoSlotsMessage = styled.div`
    margin-top: 16px;
    padding: 16px;
    background-color: rgba(255, 152, 0, 0.1);
    border-left: 3px solid #FF9800;
    border-radius: 4px;
    color: #A66200;
    font-size: 0.95rem;
    text-align: center;
    line-height: 1.5;
`;

const ReserveLinkButton = styled.button`
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color);
    font-weight: bold;
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    font-family: inherit;
    &:hover {
        text-decoration: none;
    }
`;

const ShiftContentWrapper = styled(motion.div)`
  transition: padding-bottom 0.3s ease-out;
`;

// Анимации для слотов и секций
const fadeInVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
        opacity: 1,
        y: 0,
        transition: { 
            delay: custom * 0.03,
            duration: 0.2,
            ease: "easeOut"
        }
    }),
    exit: { opacity: 0, y: 20, transition: { duration: 0.15 } }
};

interface ShiftPanelProps {
    date: Date | null;
    dayShifts: CourierShift[];
    nightShifts: CourierShift[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number) => void;
    onSwitchToReserve: () => void;
    showSuccessMessage: (message: string) => void;
    showErrorMessage?: (message: string) => void;
    isLoading: boolean;
    loadingSlot: number | null;
    loadingType: 'day' | 'night' | null;
    chatId?: string;
    isSenior?: boolean;
    draggingShiftType?: 'day' | 'night' | null;
    isDraggingGlobal?: boolean;
    processingShiftId?: string | null;
    isProcessingMove?: boolean;
    onOpenProfile?: (courier: CourierShift) => void;
    onLongPressEmptySlot: (shiftType: 'day' | 'night', slotIndex: number) => void;
    isCouriersPanelOpen: boolean;
    panelTargetShiftType: ShiftType | null;
    panelTargetSlotIndex: number | null;
    onCloseCouriersPanel: () => void;
    activeDragId?: string | null;
    hasSeniorSlot?: boolean;
}


const ShiftPanel: React.FC<ShiftPanelProps> = React.memo(({ 
    date, 
    dayShifts, 
    nightShifts, 
    maxDaySlots, 
    maxNightSlots, 
    currentUserId, 
    currentUserName, 
    onSlotSelect, 
    onSwitchToReserve, 
    showSuccessMessage, 
    showErrorMessage, 
    isLoading = false,
    loadingSlot = null,
    loadingType = null,
    chatId,
    isSenior,
    draggingShiftType,
    isDraggingGlobal,
    onOpenProfile,
    onLongPressEmptySlot,
    isCouriersPanelOpen,
    panelTargetShiftType,
    panelTargetSlotIndex,
    onCloseCouriersPanel,
    hasSeniorSlot = false
}) => {
    const userHasDayShift = useMemo(() => dayShifts.some(shift => shift.userId === currentUserId), [dayShifts, currentUserId]);
    const userHasNightShift = useMemo(() => nightShifts.some(shift => shift.userId === currentUserId), [nightShifts, currentUserId]);
    const userHasShift = userHasDayShift || userHasNightShift; 
    const totalSlots = maxDaySlots + maxNightSlots;
    const totalOccupiedSlots = dayShifts.length + nightShifts.length;
    const isFullyBooked = totalOccupiedSlots >= totalSlots;
    
    const bottomPadding = isCouriersPanelOpen ? `${COURIERS_PANEL_HEIGHT}px` : '0px';
    
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectUser);

    React.useEffect(() => {
        const isSeniorOrAdmin = user?.groups?.some(
            g => String(g.chat_id) === String(chatId) && (g.is_senior_courier || g.role === 'creator')
        );
        if (isCouriersPanelOpen && chatId && user?.id && isSeniorOrAdmin) {
            dispatch(fetchCouriersIfAllowed({
                chatId,
                userId: user.id,
                isSeniorOrAdmin: !!isSeniorOrAdmin,
            }));
        }
    }, [isCouriersPanelOpen, chatId, user]);

    return (
        <>
            <ShiftContentWrapper 
                animate={{ paddingBottom: bottomPadding }}
                transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            >
                <ShiftSection 
                    key="day-shift-section"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={fadeInVariants}
                    custom={0}
                >
                    <ShiftTitle>
                        <ShiftIcon>☀️</ShiftIcon> Дневная смена
                    </ShiftTitle>
                    <LayoutGroup>
                        <ShiftPanelContainer
                            shiftType="day"
                            shifts={dayShifts}
                            maxSlots={maxDaySlots}
                            currentUserId={currentUserId}
                            currentUserName={currentUserName}
                            onSlotSelect={onSlotSelect}
                            isLoading={isLoading && loadingType === 'day'}
                            loadingSlot={loadingType === 'day' ? loadingSlot : null}
                            userHasShift={userHasDayShift}
                            chatId={chatId}
                            isSenior={isSenior}
                            showSuccessMessage={showSuccessMessage}
                            showErrorMessage={showErrorMessage}
                            draggingShiftType={draggingShiftType}
                            isDraggingGlobal={isDraggingGlobal}
                            onOpenProfile={onOpenProfile ? (shiftSlot) => {
                                console.log('[ShiftPanel] Opening day profile with data:', shiftSlot);
                                onOpenProfile({
                                    ...shiftSlot,
                                    date: format(date || new Date(), 'yyyy-MM-dd'),
                                    shiftType: 'day'
                                } as CourierShift)
                            } : undefined}
                            onLongPressEmptySlot={onLongPressEmptySlot}
                            hasSeniorSlot={hasSeniorSlot}
                        />
                    </LayoutGroup>
                </ShiftSection>

                <ShiftSection 
                    key="night-shift-section"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={fadeInVariants}
                    custom={1} 
                >
                    <ShiftTitle>
                        <ShiftIcon>🌙</ShiftIcon> Вечерняя смена
                    </ShiftTitle>
                    <LayoutGroup>
                        <ShiftPanelContainer
                            shiftType="night"
                            shifts={nightShifts}
                            maxSlots={maxNightSlots}
                            currentUserId={currentUserId}
                            currentUserName={currentUserName}
                            onSlotSelect={onSlotSelect}
                            isLoading={isLoading && loadingType === 'night'}
                            loadingSlot={loadingType === 'night' ? loadingSlot : null}
                            userHasShift={userHasNightShift}
                            chatId={chatId}
                            isSenior={isSenior}
                            showSuccessMessage={showSuccessMessage}
                            showErrorMessage={showErrorMessage}
                            draggingShiftType={draggingShiftType}
                            isDraggingGlobal={isDraggingGlobal}
                            onOpenProfile={onOpenProfile ? (shiftSlot) => {
                                console.log('[ShiftPanel] Opening night profile with data:', shiftSlot);
                                onOpenProfile({
                                    ...shiftSlot,
                                    date: format(date || new Date(), 'yyyy-MM-dd'),
                                    shiftType: 'night'
                                } as CourierShift)
                            } : undefined}
                            onLongPressEmptySlot={onLongPressEmptySlot}
                        />
                    </LayoutGroup>
                </ShiftSection>

                {isFullyBooked && !userHasShift && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: 0.05, duration: 0.2 }}
                    >
                        <NoSlotsMessage key="no-slots-message">
                            Все смены уже заняты.<br/>
                            Вы можете <ReserveLinkButton onClick={onSwitchToReserve}>записаться в резерв</ReserveLinkButton>.
                        </NoSlotsMessage>
                    </motion.div>
                )}
                
            </ShiftContentWrapper> 
   
            <AnimatePresence> 
                {isCouriersPanelOpen && panelTargetShiftType && panelTargetSlotIndex !== null && (
                     <CouriersPanel
                         key="couriers-panel" 
                         shiftType={panelTargetShiftType!}
                         slotIndex={panelTargetSlotIndex!}
                         onClose={onCloseCouriersPanel}
                         chatId={chatId}
                         date={date}
                     />
                )}
            </AnimatePresence> 
        </>
    );
});

export default ShiftPanel; 