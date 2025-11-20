import React from 'react';
import styled from '@emotion/styled';
import { BookingPeriod, getCurrentBookingPeriod, getNextBookingPeriod } from '@features/courierSchedule/components/courier-calendar/utils/dateUtils';
import { AccessSettings } from '@features/courierSchedule/types/courierScheduleTypes';

const PeriodContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--card-background, #ffffff);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e0e0e0);
    margin-bottom: 16px;
`;

const PeriodTitle = styled.h3`
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: var(--text-color, #333);
`;

const PeriodCard = styled.div<{ $isSelected: boolean; $isCurrent: boolean }>`
    padding: 12px;
    border-radius: 8px;
    border: 2px solid ${props => props.$isSelected ? 'var(--primary-color, #007bff)' : 'var(--border-color, #e0e0e0)'};
    background: ${props => props.$isSelected ? 'var(--primary-color-light, rgba(0, 123, 255, 0.1))' : 'transparent'};
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        border-color: ${props => props.$isSelected ? 'var(--primary-color, #007bff)' : 'var(--primary-color-light, rgba(0, 123, 255, 0.3))'};
    }
    
    ${props => props.$isCurrent && `
        position: relative;
        
        &::before {
            content: 'Текущий';
            position: absolute;
            top: -8px;
            right: 8px;
            background: var(--success-color, #28a745);
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
        }
    `}
`;

const PeriodHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
`;

const PeriodLabel = styled.span`
    font-weight: 600;
    font-size: 14px;
    color: var(--text-color, #333);
`;

const PeriodDates = styled.div`
    font-size: 13px;
    color: var(--text-color-secondary, #666);
    margin-bottom: 4px;
`;

const PeriodRegistration = styled.div`
    font-size: 12px;
    color: var(--text-color-tertiary, #999);
    font-style: italic;
`;

const WarningBadge = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--warning-color-light, rgba(255, 193, 7, 0.1));
    color: var(--warning-color, #ffc107);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    margin-top: 8px;
`;

interface PeriodSelectorProps {
    accessSettings: AccessSettings | null;
    selectedPeriod: 'current' | 'next';
    onPeriodChange: (period: 'current' | 'next') => void;
    hasShiftsInCurrentPeriod?: boolean;
    shiftsCount?: number;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    accessSettings,
    selectedPeriod,
    onPeriodChange,
    hasShiftsInCurrentPeriod = false,
    shiftsCount = 0
}) => {
    const currentPeriod = getCurrentBookingPeriod(accessSettings);
    const nextPeriod = getNextBookingPeriod(accessSettings);
    
    if (!currentPeriod || !nextPeriod) {
        return null;
    }
    
    return (
        <PeriodContainer>
            <PeriodTitle>Выберите период для применения изменений</PeriodTitle>
            
            <PeriodCard
                $isSelected={selectedPeriod === 'current'}
                $isCurrent={true}
                onClick={() => onPeriodChange('current')}
            >
                <PeriodHeader>
                    <PeriodLabel>Текущий период</PeriodLabel>
                </PeriodHeader>
                <PeriodDates>
                    {currentPeriod.startDateStr} - {currentPeriod.endDateStr}
                </PeriodDates>
                <PeriodRegistration>
                    Регистрация: {currentPeriod.registrationDateStr}
                </PeriodRegistration>
                {hasShiftsInCurrentPeriod && (
                    <WarningBadge>
                        ⚠️ В этом периоде уже записаны курьеры ({shiftsCount} {shiftsCount === 1 ? 'курьер' : shiftsCount < 5 ? 'курьера' : 'курьеров'})
                    </WarningBadge>
                )}
            </PeriodCard>
            
            <PeriodCard
                $isSelected={selectedPeriod === 'next'}
                $isCurrent={false}
                onClick={() => onPeriodChange('next')}
            >
                <PeriodHeader>
                    <PeriodLabel>Следующий период</PeriodLabel>
                </PeriodHeader>
                <PeriodDates>
                    {nextPeriod.startDateStr} - {nextPeriod.endDateStr}
                </PeriodDates>
                <PeriodRegistration>
                    Регистрация откроется: {nextPeriod.registrationDateStr}
                </PeriodRegistration>
            </PeriodCard>
        </PeriodContainer>
    );
};

