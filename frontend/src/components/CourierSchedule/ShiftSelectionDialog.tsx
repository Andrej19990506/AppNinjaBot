import React, { useState, useEffect, FC, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { ReserveEntry, CourierShift } from '../../types/shifts';
import { WeeklySlotConfig } from '../../store/slices/shiftsSlice';
import { SLOTS_CONFIG } from './CourierCalendar/constants';
import { format } from 'date-fns';
import ShiftPanel from './ShiftPanel';
import ReservePanel from './ReservePanel';
import { ru } from 'date-fns/locale';
import BottomDrawer from './components/BottomDrawer';
import ShiftConfirmationDialog from './components/ShiftConfirmationDialog';
import { logger } from '../../utils/logger';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/userSlice';

const ModeSwitchContainer = styled.div`
    display: flex;
    margin: 0 -24px 24px -24px;
    padding: 0 24px;
    background: var(--card-background);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: var(--shadow-sm);
`;

const ModeButton = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 16px;
    background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.$active ? 'white' : 'var(--text-color)'};
    border: none;
    cursor: pointer;
    transition: all var(--transition-normal);
    font-weight: ${props => props.$active ? '600' : '400'};
    position: relative;
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: ${props => props.$active ? 'white' : 'var(--primary-color)'};
        transform: scaleX(${props => props.$active ? 1 : 0});
        transform-origin: right;
        transition: transform var(--transition-normal);
    }

    &:hover {
        background: ${props => props.$active ? 'var(--primary-color)' : 'var(--primary-transparent)'};
        
        &::after {
            transform: scaleX(1);
            transform-origin: left;
        }
    }

    &:disabled {
        opacity: var(--disabled-opacity);
        cursor: not-allowed;
        pointer-events: none;
    }

    ${props => props.$active && `
        box-shadow: var(--shadow-md);
    `}
`;

interface ShiftSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    dayShifts: CourierShift[];
    nightShifts: CourierShift[];
    slotConfig: WeeklySlotConfig | null;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number) => Promise<any>;
    chatId?: string;
    getDisplayReservesForDate: (date: Date | null) => ReserveEntry[];
    isCurrentUserInReserveForDate: (date: Date | null) => boolean;
    addCurrentUserToReserve: (date: Date) => Promise<void>;
    cancelReserveById: (reserveId: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

interface PendingShiftAction {
    shiftType: 'day' | 'night';
    slotIndex: number;
}

const ShiftSelectionDialog: FC<ShiftSelectionDialogProps> = ({
    isOpen,
    onClose,
    date,
    dayShifts,
    nightShifts,
    slotConfig,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    chatId,
    getDisplayReservesForDate,
    isCurrentUserInReserveForDate,
    addCurrentUserToReserve,
    cancelReserveById,
    isLoading: isReserveLoading,
    error: reserveError,
}) => {
    const [mode, setMode] = useState<'shifts' | 'reserves'>('shifts');
    const [isBookingLoading, setIsBookingLoading] = useState(false);
    const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
    const [loadingType, setLoadingType] = useState<'day' | 'night' | null>(null);
    
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingShiftAction | null>(null);
    const [initialModeSet, setInitialModeSet] = useState(false);

    logger.debug(`[ShiftSelectionDialog] Rendering component. Current mode: ${mode}, isOpen: ${isOpen}, initialModeSet: ${initialModeSet}`);

    useEffect(() => {
        logger.debug(`[ShiftSelectionDialog] useEffect [isOpen, initialModeSet] running. isOpen: ${isOpen}, initialModeSet: ${initialModeSet}`);
        if (isOpen && !initialModeSet) {
            logger.debug('[ShiftSelectionDialog] Condition Met (isOpen && !initialModeSet): Setting mode to shifts and initialModeSet to true.');
            setMode('shifts');
            setInitialModeSet(true);
        }
        else if (!isOpen && initialModeSet) {
            logger.debug('[ShiftSelectionDialog] Condition Met (!isOpen && initialModeSet): Dialog closed, resetting initialModeSet to false.');
            setInitialModeSet(false);
        } else {
            logger.debug('[ShiftSelectionDialog] Conditions NOT met for mode/initialModeSet change in this effect.');
        }
    }, [isOpen, initialModeSet]);

    const showSuccessMessage = (message: string) => {
        console.log('[ShiftSelectionDialog] showSuccessMessage:', message);
    };

    const handleSlotSelectWrapper = useCallback((
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        setPendingAction({ shiftType, slotIndex });
        setIsConfirmationOpen(true);
        logger.info('[ShiftSelectionDialog] Opening confirmation for:', { shiftType, slotIndex });
    }, [setPendingAction, setIsConfirmationOpen]);

    const handleConfirmAction = useCallback(async () => {
        if (!pendingAction) return;

        const { shiftType, slotIndex } = pendingAction;
        
        setIsBookingLoading(true);
        setLoadingType(shiftType);
        setLoadingSlot(slotIndex);
        
        let bookingSuccess = false; 
        try {
            logger.info(`[ShiftSelectionDialog] Подтверждение действия: бронирование ${shiftType} слота ${slotIndex}`);
            await onSlotSelect(shiftType, slotIndex);
            logger.info(`[ShiftSelectionDialog] Бронирование смены успешно завершено.`);
            bookingSuccess = true;

            // <<< Закомментированный блок автоматической отмены резерва >>>
            // if (isCurrentUserInReserveForDate(date)) { ... }

        } catch (error) {
            logger.error('[ShiftSelectionDialog] Ошибка при подтверждении действия (бронировании смены):', error);
            // Используем showToast, если нужно показать ошибку (хотя тут он вроде не вызывается)
            // showToast('Произошла ошибка при выполнении действия'); 
        } finally {
            setLoadingType(null);
            setLoadingSlot(null);
            setIsBookingLoading(false);
            if (bookingSuccess) {
                 setIsConfirmationOpen(false);
                 setPendingAction(null);
            }
        }
    }, [
        pendingAction, 
        onSlotSelect, 
        // Убираем ненужные зависимости:
        // isCurrentUserInReserveForDate, 
        // getDisplayReservesForDate, 
        // cancelReserveById, 
        // date, 
        // currentUserId, 
        setIsBookingLoading, 
        setLoadingType, 
        setLoadingSlot, 
        setIsConfirmationOpen, 
        setPendingAction
        // showToast // Тоже не используется внутри, если не раскомментировать выше
    ]);

    const handleCloseConfirmation = useCallback(() => {
        setIsConfirmationOpen(false);
        setPendingAction(null);
    }, [setIsConfirmationOpen, setPendingAction]);

    const setModeWrapper = useCallback((newMode: 'shifts' | 'reserves') => {
        setMode(prevMode => {
            logger.debug(`[ShiftSelectionDialog] setMode called. Previous: ${prevMode}, Requested New: ${newMode}`);
            return newMode;
        });
    }, [setMode]);

    const dayIndex = date.getDay();
    const dayConfig = slotConfig ? slotConfig[dayIndex] : undefined;
    const currentMaxDay = dayConfig?.maxDaySlots ?? SLOTS_CONFIG.DAY.MAX_SLOTS;
    const currentMaxNight = dayConfig?.maxNightSlots ?? SLOTS_CONFIG.NIGHT.MAX_SLOTS;

    const user = useSelector(selectUser);
    const isCurrentUserSenior = useMemo(() => {
        if (!user || !user.groups || !chatId) {
            return false;
        }
        const currentGroup = user.groups.find(group => String(group.chat_id) === String(chatId));
        const isSenior = currentGroup?.is_senior_courier ?? false;
        logger.debug(`[ShiftSelectionDialog] Computed isCurrentUserSenior for chatId ${chatId}: ${isSenior}`);
        return isSenior;
    }, [user, chatId]);

    return (
        <BottomDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={`Смены и резерв на ${format(date, 'd MMMM yyyy', { locale: ru })}`}
        >
            <ModeSwitchContainer>
                <ModeButton
                    $active={mode === 'shifts'}
                    onClick={() => setModeWrapper('shifts')}
                >
                    Смены
                </ModeButton>
                <ModeButton
                    $active={mode === 'reserves'}
                    onClick={() => setModeWrapper('reserves')}
                >
                    Резерв
                </ModeButton>
            </ModeSwitchContainer>

            {mode === 'shifts' ? (
                isConfirmationOpen && pendingAction ? (
                    <ShiftConfirmationDialog
                        isOpen={isConfirmationOpen}
                        onCancel={handleCloseConfirmation}
                        onConfirm={handleConfirmAction}
                        date={date}
                        pendingShift={pendingAction}
                        userName={currentUserName}
                        userAvatar={currentUserAvatar}
                    />
                ) : (
                    <ShiftPanel
                        date={date}
                        dayShifts={dayShifts}
                        nightShifts={nightShifts}
                        maxDaySlots={currentMaxDay}
                        maxNightSlots={currentMaxNight}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        onSlotSelect={handleSlotSelectWrapper}
                        onSwitchToReserve={() => setModeWrapper('reserves')}
                        showSuccessMessage={showSuccessMessage}
                        isLoading={isBookingLoading}
                        loadingSlot={loadingSlot}
                        loadingType={loadingType}
                    />
                )
            ) : (
                <ReservePanel
                    date={date}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    currentUserName={currentUserName}
                    dayShifts={dayShifts}
                    nightShifts={nightShifts}
                    onSwitchToShifts={() => setModeWrapper('shifts')}
                    getDisplayReservesForDate={getDisplayReservesForDate}
                    isCurrentUserInReserveForDate={isCurrentUserInReserveForDate}
                    addCurrentUserToReserve={addCurrentUserToReserve}
                    cancelReserveById={cancelReserveById}
                    isLoading={isReserveLoading}
                    error={reserveError}
                    showSuccessMessage={showSuccessMessage}
                    chatId={chatId}
                    isCurrentUserSenior={isCurrentUserSenior}
                />
            )}
        </BottomDrawer>
    );
};

export default ShiftSelectionDialog; 