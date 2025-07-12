import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';

// Используем те же стили что и в основном файле настроек
const SettingsSection = styled.div`
    margin-bottom: 24px;
`;

const SectionTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 16px;
`;

const SlotConfigRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px 16px;
    background-color: var(--background-secondary);
    border-radius: var(--radius-md);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
`;

const SlotTypeLabel = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--text-color);
`;

const SlotTypeIcon = styled.span`
    font-size: 1.2rem;
`;

const TimeControls = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const TimeGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const TimeLabel = styled.span`
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
`;

const TimeInput = styled.input`
    width: 60px;
    padding: 4px 6px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    font-weight: 500;
    text-align: center;
    color: var(--text-color);
    background: var(--card-background);
    transition: all var(--transition-fast);
    cursor: pointer;
    
    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-transparent);
    }
    
    &:hover:not(:focus) {
        border-color: var(--primary-color);
    }
    
    // Убираем кнопку календаря полностью
    &::-webkit-calendar-picker-indicator {
        display: none;
    }
    
    // Убираем стрелки в Firefox
    &::-moz-calendar-picker-indicator {
        display: none;
    }
    
    // Убираем стрелки в других браузерах
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
        display: none;
        -webkit-appearance: none;
        margin: 0;
    }
`;

const Separator = styled.span`
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 4px;
`;

const ResetButton = styled.button`
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--text-secondary);
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-left: auto;
    
    &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
    }
`;

interface ShiftTimeSelectorProps {
    dayShiftStartTime: string;
    dayShiftEndTime: string;
    nightShiftStartTime: string;
    nightShiftEndTime: string;
    onDayShiftStartChange: (time: string) => void;
    onDayShiftEndChange: (time: string) => void;
    onNightShiftStartChange: (time: string) => void;
    onNightShiftEndChange: (time: string) => void;
}

const ShiftTimeSelector: React.FC<ShiftTimeSelectorProps> = ({
    dayShiftStartTime,
    dayShiftEndTime,
    nightShiftStartTime,
    nightShiftEndTime,
    onDayShiftStartChange,
    onDayShiftEndChange,
    onNightShiftStartChange,
    onNightShiftEndChange,
}) => {
    const handleTimeChange = useCallback((
        value: string,
        onChange: (time: string) => void
    ) => {
        // Валидация времени
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (timeRegex.test(value)) {
            onChange(value);
        }
    }, []);

    const resetToDefaults = useCallback(() => {
        onDayShiftStartChange('10:00');
        onDayShiftEndChange('18:00');
        onNightShiftStartChange('18:00');
        onNightShiftEndChange('02:00');
    }, [onDayShiftStartChange, onDayShiftEndChange, onNightShiftStartChange, onNightShiftEndChange]);

    return (
        <SettingsSection>
            <SectionTitle>
                <SlotTypeIcon>⏰</SlotTypeIcon>
                Время смен
                <ResetButton onClick={resetToDefaults}>
                    Сбросить
                </ResetButton>
            </SectionTitle>
            
            <SlotConfigRow>
                <SlotTypeLabel>
                    <SlotTypeIcon>☀️</SlotTypeIcon>
                    Дневная смена
                </SlotTypeLabel>
                <TimeControls>
                    <TimeGroup>
                        <TimeLabel>c</TimeLabel>
                        <TimeInput
                            type="time"
                            value={dayShiftStartTime}
                            onChange={(e) => handleTimeChange(e.target.value, onDayShiftStartChange)}
                        />
                    </TimeGroup>
                    <Separator>до</Separator>
                    <TimeGroup>
                        <TimeInput
                            type="time"
                            value={dayShiftEndTime}
                            onChange={(e) => handleTimeChange(e.target.value, onDayShiftEndChange)}
                        />
                    </TimeGroup>
                </TimeControls>
            </SlotConfigRow>
            
            <SlotConfigRow>
                <SlotTypeLabel>
                    <SlotTypeIcon>🌙</SlotTypeIcon>
                    Вечерняя смена
                </SlotTypeLabel>
                <TimeControls>
                    <TimeGroup>
                        <TimeLabel>c</TimeLabel>
                        <TimeInput
                            type="time"
                            value={nightShiftStartTime}
                            onChange={(e) => handleTimeChange(e.target.value, onNightShiftStartChange)}
                        />
                    </TimeGroup>
                    <Separator>до</Separator>
                    <TimeGroup>
                        <TimeInput
                            type="time"
                            value={nightShiftEndTime}
                            onChange={(e) => handleTimeChange(e.target.value, onNightShiftEndChange)}
                        />
                    </TimeGroup>
                </TimeControls>
            </SlotConfigRow>
        </SettingsSection>
    );
};

export default ShiftTimeSelector; 