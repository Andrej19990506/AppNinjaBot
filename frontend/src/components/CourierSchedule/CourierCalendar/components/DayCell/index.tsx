import React from 'react';
import { format } from 'date-fns';
import defaultAvatar from '../../../../../assets/images/Ninja.jpg';
import { CourierShift } from '../../types';
import { WeeklySlotConfig } from '../../../../../store/slices/shiftsSlice';
import { SLOTS_CONFIG } from '../../constants';
import { User } from '../../../../../types/user';
import {
    DayCellContainer,
    CourierAvatar,
    DayNumber,
    EmptySlotIndicator,
    OccupiedSlotIndicator,
    ReserveSlotIndicator,
    ReserveIcon,
    LockIcon
} from './styles';

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
}

const DayCell: React.FC<DayCellProps> = ({
    date,
    isToday,
    isSelected,
    hasShifts,
    isAvailable,
    onClick,
    currentUserId,
    getDayShifts,
    getNightShifts,
    hasUserShift,
    userIsInReserve,
    slotConfig,
    usersById
}) => {
    if (!date) {
        return <DayCellContainer as="div" />;
    }

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

            return (
                <CourierAvatar 
                    src={currentUserData?.photo_url || defaultAvatar}
                    alt={currentUserData?.first_name || 'Текущий'}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const img = e.currentTarget;
                        img.src = defaultAvatar;
                    }}
                />
            );
        }

        if (isAvailable && !userHasShift) {
            if (dayShifts.length > 0) {
                const shift = dayShifts[0];
                const courier = usersById[shift.userId];
                return (
                    <CourierAvatar 
                        src={courier?.photo_url || defaultAvatar}
                        alt={courier?.first_name || 'Курьер'}
                        title={`${courier?.first_name || 'Курьер'} ${courier?.last_name || ''} (День)`}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            const img = e.currentTarget;
                            img.src = defaultAvatar;
                        }}
                    />
                );
            }
            if (nightShifts.length > 0) {
                const shift = nightShifts[0];
                const courier = usersById[shift.userId];
                return (
                    <CourierAvatar 
                        src={courier?.photo_url || defaultAvatar}
                        alt={courier?.first_name || 'Курьер'}
                        title={`${courier?.first_name || 'Курьер'} ${courier?.last_name || ''} (Ночь)`}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            const img = e.currentTarget;
                            img.src = defaultAvatar;
                        }}
                    />
                );
            }
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

        if (isAvailable) {
            const allDaySlotsOccupied = dayShifts.length >= currentMaxDay;
            const allNightSlotsOccupied = nightShifts.length >= currentMaxNight;

            if (allDaySlotsOccupied && allNightSlotsOccupied) {
                return (
                    <OccupiedSlotIndicator title="Все смены заняты">
                        <DayNumber 
                            $isAvailable={false} 
                            style={{ 
                                color: '#FF3B30', 
                                opacity: 0.9,
                                fontSize: '0.85rem',
                                position: 'absolute',
                                top: '24%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontWeight: '600',
                                textShadow: '0 0 3px rgba(255, 255, 255, 0.9)'
                            }}
                        >
                            {format(date, 'd')}
                        </DayNumber>
                        <LockIcon />
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
            onClick={onClick}
            $isToday={isToday}
            $isSelected={isSelected}
            $hasShifts={hasShifts}
            $isAvailable={isAvailable}
            aria-label={`День ${format(date, 'd')}`}
            role="button"
        >
            {renderContent()}
        </DayCellContainer>
    );
};

export type { DayCellProps };
export default React.memo(DayCell); 