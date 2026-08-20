import React from 'react';
import { format } from 'date-fns';
import defaultAvatar from '@/assets/images/Ninja.jpg';
import { CourierShift } from '@features/courierSchedule/types/courierScheduleTypes';
import { WeeklySlotConfig } from '@features/courierSchedule/types/courierScheduleTypes';
import { SLOTS_CONFIG } from '@features/courierSchedule/constants';
import {
    DayCellContainer,
    AvatarContainer,
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
    getShiftsForDate: (date: Date) => CourierShift[];
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
    getShiftsForDate,
    hasUserShift,
    userIsInReserve,
    slotConfig,
    usersById,
    statusIcon,
    openTooltip,
    handleTooltipClose,
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
        
        const allShifts = getShiftsForDate(date);
        const userHasShift = hasUserShift(date);
        const inReserve = userIsInReserve(date);

        if (userHasShift) {
            const userShift = allShifts.find(shift => 
                String(shift.userId) === String(currentUserId)
            );
            const currentUserData = usersById[currentUserId];
            const photoUrl = currentUserData?.photo_url || userShift?.photoUrl || defaultAvatar;

            return (
                <AvatarContainer>
                    <CourierAvatar 
                        src={photoUrl}
                        alt={currentUserData?.first_name || 'Текущий'}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            const img = e.currentTarget;
                            img.src = defaultAvatar;
                        }}
                    />
                </AvatarContainer>
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

        // Считаем все занятые слоты (исключая слот старшего курьера с slotIndex === -1)
        const occupiedSlots = allShifts.filter(s => s.slotIndex !== -1).length;
        
        // Используем новую логику с шаблонами
        const templates = dayConfig?.shiftTemplates || [];
        const totalSlotsFromTemplates = templates.reduce((sum, template) => {
            return sum + (template.maxSlots || 0);
        }, 0);
        
        // Если нет шаблонов, используем старую логику для обратной совместимости
        const totalMaxSlots = totalSlotsFromTemplates > 0 ? totalSlotsFromTemplates : (currentMaxDay + currentMaxNight);
        const allSlotsOccupied = totalMaxSlots > 0 && occupiedSlots >= totalMaxSlots;

        if (isAvailable || allSlotsOccupied) {
            if (allSlotsOccupied) {
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