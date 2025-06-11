import React from 'react';
import { format } from 'date-fns';
import defaultAvatar from '@/assets/images/Ninja.jpg';
import { CourierShift } from '@features/courierSchedule/types/courierScheduleTypes';
import { WeeklySlotConfig } from '@features/courierSchedule/types/courierScheduleTypes';
import { SLOTS_CONFIG } from '@features/courierSchedule/constants';
import {
    DayCellContainer,
    CourierAvatar,
    DayNumber,
    EmptySlotIndicator,
    OccupiedSlotIndicator,
    ReserveSlotIndicator,
    ReserveIcon,
} from './styles';
import { User } from '@/types/user';

interface DayCellProps {
    date: Date | null;
    isToday: boolean;
    isSelected: boolean;
    hasShifts: boolean;
    isAvailable: boolean;
    onClick: () => void;
    currentUserId: string;
    getDayShifts: (date: Date) => CourierShift[];
    getNightShifts: (date: Date) => CourierShift[];
    hasUserShift: (date: Date) => boolean;
    userIsInReserve: (date: Date) => boolean;
    slotConfig: WeeklySlotConfig | null;
    usersById: { [key: string]: User };
    statusIcon?: React.ReactElement | null;
    openTooltip: { date: string | null, message: string };
    handleTooltipClose: () => void;
}

const DayCell: React.FC<DayCellProps> = ({
    date,
    isToday,
    isSelected,
    hasShifts,
    isAvailable,
    onClick: onOriginalClick,
    currentUserId,
    getDayShifts,
    getNightShifts,
    hasUserShift,
    userIsInReserve,
    slotConfig,
    usersById,
    statusIcon,
    openTooltip,
    handleTooltipClose
}) => {
    if (!date) {
        return <DayCellContainer as="div" />;
    }

    const handleCellClick = (event: React.MouseEvent) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const targetElement = event.target as HTMLElement;
        const clickedOnTooltipOrIcon = targetElement.closest('.MuiTooltip-popper') || targetElement.closest('[style*="background-color"]');
        
        if (clickedOnTooltipOrIcon) {
            return;
        }

        if (openTooltip.date === dateStr) {
            handleTooltipClose();
            onOriginalClick();
        } else {
            onOriginalClick();
        }
    };

    const renderContent = () => {
        const dayIndex = date.getDay();
        const dayConfig = slotConfig ? slotConfig[dayIndex] : undefined;
        const currentMaxDay = dayConfig?.maxDaySlots ?? SLOTS_CONFIG.DAY.MAX_SLOTS;
        const currentMaxNight = dayConfig?.maxNightSlots ?? SLOTS_CONFIG.NIGHT.MAX_SLOTS;
        
        const dayShifts = getDayShifts(date);
        const nightShifts = getNightShifts(date);
        const userHasShift = hasUserShift(date);
        const inReserve = userIsInReserve(date);

        if (userHasShift) {
            const userShift = [...dayShifts, ...nightShifts].find(shift => 
                String(shift.userId) === String(currentUserId)
            );
            const currentUserData = usersById[currentUserId];
            const photoUrl = currentUserData?.photo_url || userShift?.photoUrl || defaultAvatar;

            return (
                <CourierAvatar 
                    src={photoUrl}
                    alt={currentUserData?.first_name || 'Текущий'}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const img = e.currentTarget;
                        img.src = defaultAvatar;
                    }}
                />
            );
        }

        if (inReserve) {
            return (
                <ReserveSlotIndicator>
                    <DayNumber $isAvailable={true} style={{
                        color: '#FF9500',
                        fontWeight: '600',
                        textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
                    }}>
                        {format(date, 'd')}
                    </DayNumber>
                    <ReserveIcon title="Вы в резерве на эту дату" />
                </ReserveSlotIndicator>
            );
        }

        const occupiedDaySlots = dayShifts.filter(s => s.slotIndex !== -1).length;
        const occupiedNightSlots = nightShifts.filter(s => s.slotIndex !== -1).length;
        const allDaySlotsOccupied = occupiedDaySlots >= currentMaxDay;
        const allNightSlotsOccupied = occupiedNightSlots >= currentMaxNight;

        if (isAvailable || (allDaySlotsOccupied && allNightSlotsOccupied)) {
            if (allDaySlotsOccupied && allNightSlotsOccupied) {
                return (
                    <OccupiedSlotIndicator title="Все смены заняты">
                        <DayNumber 
                            $isAvailable={false} 
                            style={{ 
                                color: '#FF3B30', 
                            }}
                        >
                            {format(date, 'd')}
                        </DayNumber>
                    </OccupiedSlotIndicator>
                );
            }
            return (
                <EmptySlotIndicator>
                    <DayNumber $isAvailable={true}>{format(date, 'd')}</DayNumber>
                </EmptySlotIndicator>
            );
        }

        return <DayNumber $isAvailable={false}>{format(date, 'd')}</DayNumber>;
    };

    return (
        <DayCellContainer
            onClick={handleCellClick}
            $isToday={isToday}
            $isSelected={isSelected}
            $hasShifts={hasShifts}
            $isAvailable={isAvailable}
            aria-label={`День ${format(date, 'd')}`}
            role="button"
        >
            {renderContent()}
            {statusIcon}
        </DayCellContainer>
    );
};

export type { DayCellProps };
export default React.memo(DayCell); 