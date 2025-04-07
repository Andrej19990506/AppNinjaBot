import React from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { WEEK_DAYS } from '../../constants';
import { CourierShift } from '../../types';
import DayCell from '../DayCell';
import { isToday, isSelected, isDateAvailable, getDaysInMonth } from '../../utils/dateUtils';
import {
    MonthSectionContainer,
    MonthTitle,
    WeekDaysGrid,
    WeekDay,
    DaysGrid
} from './styles';
import { AccessSettings } from '../../../../../store/slices/shiftsSlice';

interface MonthSectionProps {
    month: Date;
    selectedDate: Date | null;
    onDayClick: (date: Date) => void;
    getDayShifts: (date: Date) => CourierShift[];
    getNightShifts: (date: Date) => CourierShift[];
    hasUserShift: (date: Date) => boolean;
    userIsInReserve: (date: Date) => boolean;
    currentUserAvatar?: string;
    currentUserId: string;
    accessSettings?: AccessSettings;
    maxDaySlots: number;
    maxNightSlots: number;
}

const MonthSection: React.FC<MonthSectionProps> = ({
    month,
    selectedDate,
    onDayClick,
    getDayShifts,
    getNightShifts,
    hasUserShift,
    userIsInReserve,
    currentUserAvatar,
    currentUserId,
    accessSettings,
    maxDaySlots,
    maxNightSlots
}) => {
    const days = getDaysInMonth(month);

    return (
        <MonthSectionContainer>
            <MonthTitle>
                {format(month, 'LLLL yyyy', { locale: ru })}
            </MonthTitle>

            <WeekDaysGrid>
                {WEEK_DAYS.map(day => (
                    <WeekDay key={day}>{day}</WeekDay>
                ))}
            </WeekDaysGrid>

            <DaysGrid>
                {days.map((date, index) => {
                    if (date === null) {
                        return <div key={`empty-${index}`} />;
                    }

                    return (
                        <DayCell
                            key={date.toISOString()}
                            date={date}
                            isToday={isToday(date)}
                            isSelected={isSelected(date, selectedDate)}
                            hasShifts={getDayShifts(date).length > 0 || getNightShifts(date).length > 0}
                            isAvailable={isDateAvailable(date, currentUserId, accessSettings)}
                            onClick={() => onDayClick(date)}
                            currentUserId={currentUserId}
                            currentUserAvatar={currentUserAvatar}
                            getDayShifts={getDayShifts}
                            getNightShifts={getNightShifts}
                            hasUserShift={hasUserShift}
                            userIsInReserve={userIsInReserve}
                            maxDaySlots={maxDaySlots}
                            maxNightSlots={maxNightSlots}
                        />
                    );
                })}
            </DaysGrid>
        </MonthSectionContainer>
    );
};

export default React.memo(MonthSection); 