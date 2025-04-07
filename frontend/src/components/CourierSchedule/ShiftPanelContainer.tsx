import React, { useCallback } from 'react';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { useShiftUIState } from './hooks/useShiftUIState';
import ShiftSlot from './components/ShiftSlot';
import ShiftConfirmationDialog from './components/ShiftConfirmationDialog';
import UserProfileDialog from './CourierProfileDialog';

// Интерфейсы
interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    is_senior_courier?: boolean;
    isSeniorCourier?: boolean; // Добавляем для совместимости с ShiftSlot
}

interface ShiftPanelContainerProps {
    date: Date;
    dayShifts: ShiftSlotLocal[];
    nightShifts: ShiftSlotLocal[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string) => void;
    onSwitchToReserve: () => void;
    forceUpdate: () => void;
    reserves: any[];
    showSuccessMessage: (message: string) => void;
    chatId?: string;
    isLoading?: boolean;
    loadingSlot?: number | null;
    loadingType?: 'day' | 'night' | null;
}

// Стили
const ShiftSection = styled.div`
    margin-bottom: 24px;

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

const SlotsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 12px;
    justify-items: center;
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
    font-size: inherit; /* Наследуем размер шрифта */
    font-family: inherit; /* Наследуем шрифт */

    &:hover {
        text-decoration: none;
    }
`;

const ShiftPanelContainer: React.FC<ShiftPanelContainerProps> = ({
    date,
    dayShifts,
    nightShifts,
    maxDaySlots,
    maxNightSlots,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onSlotSelect,
    onSwitchToReserve,
    forceUpdate,
    reserves,
    showSuccessMessage,
    chatId,
    isLoading,
    loadingSlot,
    loadingType
}) => {
    const currentUser = useSelector((state: RootState) => state.user.user);
    const isCurrentUserSenior = currentUser?.is_senior_courier || false;
    
    const uiState = useShiftUIState({
        dayShifts,
        nightShifts
    });
    
    const userHasShift = [...uiState.localDayShifts, ...uiState.localNightShifts]
        .some(shift => shift.userId === currentUserId);
    
    const totalSlots = maxDaySlots + maxNightSlots;
    const totalOccupiedSlots = uiState.localDayShifts.length + uiState.localNightShifts.length;
    const isFullyBooked = totalOccupiedSlots >= totalSlots;
    
    const handleSlotInteraction = useCallback((shiftType: 'day' | 'night', slotIndex: number, slotData?: ShiftSlotLocal) => {
        console.log('[ShiftPanelContainer] handleSlotInteraction called:', { shiftType, slotIndex, slotData, isCurrentUserSenior });

        const isOccupied = !!slotData?.userId;
        const isOwnSlot = isOccupied && slotData?.userId === currentUserId;

        if (!isOccupied || isOwnSlot) {
            // Клик по пустому слоту или по своему занятому слоту -> открываем подтверждение
            uiState.openConfirmation(shiftType, slotIndex, slotData?.id);
        } else if (isOccupied && !isOwnSlot && isCurrentUserSenior) {
            // Клик старшего по чужому занятому слоту -> открываем подтверждение на освобождение
            uiState.openConfirmation(shiftType, slotIndex, slotData?.id);
        } else if (isOccupied && !isOwnSlot && !isCurrentUserSenior) {
            // Клик обычного пользователя по чужому занятому слоту -> показываем профиль
             if (slotData) {
                 uiState.openProfileDialog(slotData);
             }
        }
    }, [currentUserId, isCurrentUserSenior, uiState]);

    const handleConfirmShift = useCallback(async () => {
        if (!uiState.pendingShift) return;

        try {
            console.log('[ShiftPanel] Confirming shift selection:', uiState.pendingShift);

            await onSlotSelect(
                uiState.pendingShift.shiftType,
                uiState.pendingShift.slotIndex,
                uiState.pendingShift.existingShiftId
            );

             uiState.showSuccessAnimation(
                 uiState.pendingShift.shiftType,
                 uiState.pendingShift.slotIndex
             );

            uiState.closeConfirmation();

            console.log('[ShiftPanel] Slot selection successful');

        } catch (error) {
            console.error('[ShiftPanel] Error in handleConfirmShift:', error);
            showSuccessMessage('Ошибка при сохранении смены.');
            uiState.closeConfirmation();
        }
    }, [uiState, onSlotSelect, showSuccessMessage]);

    const handleCancelShift = useCallback(() => {
        uiState.closeConfirmation();
    }, [uiState]);

    const handleCourierClick = useCallback((
        event: React.MouseEvent | React.TouchEvent,
        courier: ShiftSlotLocal,
        shiftType: 'day' | 'night',
        slotIndex: number
    ) => {
        event.stopPropagation();
        console.log('[ShiftPanelContainer] handleCourierClick called:', { courier, shiftType, slotIndex });
        uiState.openProfileDialog(courier);
    }, [uiState]);

    const handleTouchMove = useCallback(() => {}, []);

    const renderSlots = (type: 'day' | 'night', shifts: ShiftSlotLocal[], maxSlots: number) => {
        const slots = [];
        const occupiedSlots = new Map(shifts.map(s => [s.slotIndex, s]));

        for (let i = 0; i < maxSlots; i++) {
            const slotData = occupiedSlots.get(i);
            const isLoadingThisSlot = isLoading && loadingType === type && loadingSlot === i;

            const courierForSlot = slotData ? {
                id: slotData.id,
                userId: slotData.userId,
                photo_url: slotData.photo_url,
                firstName: slotData.firstName,
                lastName: slotData.lastName,
                shiftType: slotData.shiftType,
                slotIndex: slotData.slotIndex,
                isSeniorCourier: slotData.is_senior_courier ?? slotData.isSeniorCourier ?? false
            } : undefined;

            slots.push(
                <ShiftSlot
                    key={`${type}-${i}`}
                    slotIndex={i}
                    shiftType={type}
                    courier={courierForSlot}
                    currentUserId={currentUserId}
                    isDraggable={false}
                    onSlotClick={handleSlotInteraction}
                    onCourierClick={handleCourierClick}
                    onTouchMove={handleTouchMove}
                    successAnimation={uiState.successAnimations.has(`${type}-${i}`)}
                    pressAnimationActive={false}
                    isDragging={false}
                    isLoading={isLoadingThisSlot}
                    isError={false}
                />
            );
        }
        return slots;
    };

    return (
        <>
            <React.Fragment key="shift-panel-root">
                {uiState.confirmationOpen && (
                    <ShiftConfirmationDialog
                        date={date}
                        pendingShift={uiState.pendingShift}
                        onConfirm={handleConfirmShift}
                        onCancel={handleCancelShift}
                        isOpen={uiState.confirmationOpen}
                        userName={currentUserName}
                    />
                )}
                {uiState.profileDialogOpen && uiState.selectedCourier && (
                    <UserProfileDialog
                        isOpen={uiState.profileDialogOpen}
                        onClose={uiState.closeProfileDialog}
                        profileData={uiState.selectedCourier}
                    />
                )}
                {!uiState.confirmationOpen && !uiState.profileDialogOpen && (
                    <>
                        <ShiftSection key="day-shift-section">
                            <ShiftTitle>
                                <ShiftIcon>☀️</ShiftIcon> Дневная смена
                            </ShiftTitle>
                            <SlotsGrid
                                style={{ minHeight: '80px' }}
                            >
                                {renderSlots('day', dayShifts, maxDaySlots)}
                            </SlotsGrid>
                        </ShiftSection>

                        <ShiftSection key="night-shift-section">
                            <ShiftTitle>
                                <ShiftIcon>🌙</ShiftIcon> Вечерняя смена
                            </ShiftTitle>
                            <SlotsGrid
                                style={{ minHeight: '80px' }}
                            >
                                {renderSlots('night', nightShifts, maxNightSlots)}
                            </SlotsGrid>
                        </ShiftSection>

                        {isCurrentUserSenior && (
                            <SeniorHint>
                                ⭐ Как старший курьер, вы можете записывать или снимать со слотов других курьеров, нажимая на соответствующие слоты.
                            </SeniorHint>
                        )}

                        {isFullyBooked && !userHasShift && (
                            <NoSlotsMessage key="no-slots-message">
                                Все смены уже заняты.<br/>
                                Вы можете <ReserveLinkButton onClick={onSwitchToReserve}>записаться в резерв</ReserveLinkButton>.
                            </NoSlotsMessage>
                        )}
                    </>
                )}
            </React.Fragment>
        </>
    );
};

export default React.memo(ShiftPanelContainer); 