import React from 'react';
import styled from 'styled-components';
import MonthSection from '@features/courierSchedule/components/courier-calendar/components/layout/mobile-layout/courier-calendar/month-section';

const DesktopCalendarContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  background: var(--card-background, #fff);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 32px 40px 40px 40px;
  min-height: 600px;
  display: flex;
  flex-direction: column;
`;

const CalendarHeader = styled.div`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 32px;
  color: var(--primary-color, #1a1a1a);
`;

const CalendarGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 32px;
  background: var(--calendar-bg, #f7f7f7);
  border-radius: 12px;
  padding: 24px;
`;

// Пропсы для десктопной версии (универсальные, без бизнес-логики)
interface CourierCalendarDesktopProps {
  monthsToDisplay: Date[];
  selectedDate: Date | null;
  onDayClick: (date: Date) => void;
  getDayShifts: (date: Date) => any[];
  getNightShifts: (date: Date) => any[];
  hasUserShift: (date: Date) => boolean;
  userIsInReserve: (date: Date) => boolean;
  currentUserId: string;
  slotConfig: any;
  isDateAvailable: (date: Date) => boolean;
  usersById: any;
  isCurrentUserSenior: boolean;
  accessSettings: any;
}

const CourierCalendarDesktop: React.FC<CourierCalendarDesktopProps> = ({
  monthsToDisplay,
  selectedDate,
  onDayClick,
  getDayShifts,
  getNightShifts,
  hasUserShift,
  userIsInReserve,
  currentUserId,
  slotConfig,
  isDateAvailable,
  usersById,
  isCurrentUserSenior,
  accessSettings
}) => {
  return (
    <DesktopCalendarContainer>
      <CalendarHeader>Календарь смен (Десктоп)</CalendarHeader>
      <CalendarGrid>
        {monthsToDisplay.map(month => (
          <MonthSection
            key={month.toISOString()}
            month={month}
            selectedDate={selectedDate}
            onDayClick={onDayClick}
            getDayShifts={getDayShifts}
            getNightShifts={getNightShifts}
            hasUserShift={hasUserShift}
            userIsInReserve={userIsInReserve}
            currentUserId={currentUserId}
            slotConfig={slotConfig}
            isDateAvailable={isDateAvailable}
            usersById={usersById}
            isCurrentUserSenior={isCurrentUserSenior}
            accessSettings={accessSettings}
          />
        ))}
      </CalendarGrid>
    </DesktopCalendarContainer>
  );
};

export default CourierCalendarDesktop; 