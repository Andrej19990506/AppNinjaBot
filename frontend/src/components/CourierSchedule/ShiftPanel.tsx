import React from 'react';
import { ReserveShift } from '../../types/shifts';
import ShiftPanelContainer from './ShiftPanelContainer';

// Интерфейсы
interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

interface ShiftPanelProps {
    date: Date;
    dayShifts: ShiftSlotLocal[];
    nightShifts: ShiftSlotLocal[];
    maxDaySlots: number;
    maxNightSlots: number;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onSlotSelect: (shiftType: 'day' | 'night', slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    onSwitchToReserve: () => void;
    forceUpdate: () => void;
    reserves: ReserveShift[];
    showSuccessMessage: (message: string) => void;
    chatId?: string;
    isLoading?: boolean;
    loadingSlot?: number | null;
    loadingType?: 'day' | 'night' | null;
}

/**
 * ShiftPanel компонент
 * Отвечает за отображение и управление дневными и ночными сменами курьеров
 * 
 * Этот компонент был рефакторинг для улучшения читаемости и поддерживаемости
 * и теперь использует ShiftPanelContainer для основной логики
 */
const ShiftPanel = React.memo(({
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
}: ShiftPanelProps): JSX.Element => {
    
    // Просто передаем все пропсы в ShiftPanelContainer
    return (
        <ShiftPanelContainer
            date={date}
            dayShifts={dayShifts}
            nightShifts={nightShifts}
            maxDaySlots={maxDaySlots}
            maxNightSlots={maxNightSlots}
            currentUserId={currentUserId}
            currentUserAvatar={currentUserAvatar}
            currentUserName={currentUserName}
            onSlotSelect={onSlotSelect}
            onSwitchToReserve={onSwitchToReserve}
            forceUpdate={forceUpdate}
            reserves={reserves}
            showSuccessMessage={showSuccessMessage}
            chatId={chatId}
            loadingSlot={loadingSlot}
            loadingType={loadingType}
        />
    );
});

export default ShiftPanel; 