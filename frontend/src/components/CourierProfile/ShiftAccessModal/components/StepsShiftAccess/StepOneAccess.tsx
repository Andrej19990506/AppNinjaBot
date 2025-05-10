import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useStepAccessSettings } from '../../../ShiftAccessModal/hooks';

// Стили для контейнера
const Container = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
`;

const Title = styled.h3`
    font-size: 18px;
    margin-bottom: 24px;
    color: var(--text-color);
    text-align: center;
`;

const FormContainer = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
`;

// Секция формы
const FormSection = styled(motion.div)`
    background-color: var(--card-background);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease;
    position: relative;
    border-left: 4px solid var(--primary-color);
    
    
    &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
`;

// Заголовок секции
const SectionTitle = styled.h4`
    font-size: 16px;
    margin-bottom: 16px;
    color: var(--text-color);
    display: flex;
    align-items: center;
    
    svg {
        margin-right: 8px;
        color: var(--primary-color);
    }
`;

// Компонент выбора дня недели
const DaySelector = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
    
    @media (max-width: 480px) {
        justify-content: center;
    }
`;

// Кнопка дня недели
const DayButton = styled(motion.button)<{ isSelected: boolean }>`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid ${props => props.isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
    background-color: ${props => props.isSelected ? 'var(--primary-light)' : 'transparent'};
    color: ${props => props.isSelected ? 'var(--primary-color)' : 'var(--text-secondary)'};
    font-weight: ${props => props.isSelected ? 'bold' : 'normal'};
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover, &:focus {
        border-color: var(--primary-color);
        background-color: var(--primary-light);
        color: var(--primary-color);
    }
    
    &:active {
        transform: scale(0.95);
    }
`;

// Компонент выбора времени
const TimeSelector = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
`;

// Поле времени
const TimeField = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

// Метка поля
const TimeLabel = styled.label`
    font-size: 14px;
    color: var(--text-secondary);
`;

// Выбор часа/минуты
const TimeSelect = styled(motion.select)`
    background-color: var(--background-light);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text-color);
    font-size: 14px;
    cursor: pointer;
    appearance: none;
    transition: all 0.2s ease;
    min-width: 70px;
    
    &:hover, &:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-light);
    }
    
    /* Стрелка для селекта */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
`;

// Разделитель времени
const TimeSeparator = styled.span`
    font-size: 18px;
    color: var(--text-color);
    margin: 0 4px;
`;

// Пояснение
const Description = styled.p`
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 16px;
    font-style: italic;
`;

// Анимации для элементов формы
const formSectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.5,
            ease: "easeOut"
        }
    })
};

// Компонент иконки календаря
const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

// Компонент иконки часов
const ClockIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);

const StepOne: React.FC = () => {
    // Получаем настройки доступа из контекста через хук
    const { settings, updateSettings } = useStepAccessSettings();
    
    // Состояния для выбранного дня, часа и минуты
    const [selectedDay, setSelectedDay] = useState<number>(settings.registrationStartDay ?? 1); // По умолчанию понедельник
    const [startHour, setStartHour] = useState<number>(settings.registrationStartHour ?? 9);
    const [startMinute, setStartMinute] = useState<number>(settings.registrationStartMinute ?? 0);
    
    // Обновляем локальные состояния при изменении настроек
    useEffect(() => {
        setSelectedDay(settings.registrationStartDay ?? 1);
        setStartHour(settings.registrationStartHour ?? 9);
        setStartMinute(settings.registrationStartMinute ?? 0);
    }, [settings]);
    
    // Дни недели
    const daysOfWeek = [
        { id: 1, short: 'Пн' },
        { id: 2, short: 'Вт' },
        { id: 3, short: 'Ср' },
        { id: 4, short: 'Чт' },
        { id: 5, short: 'Пт' },
        { id: 6, short: 'Сб' },
        { id: 0, short: 'Вс' }
    ];
    
    // Обработчик выбора дня недели
    const handleDaySelect = useCallback((day: number) => {
        setSelectedDay(day);
        // Обновляем настройки в Redux
        updateSettings({ registrationStartDay: day });
    }, [updateSettings]);
    
    // Обработчик изменения часа
    const handleHourChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const hour = parseInt(e.target.value, 10);
        setStartHour(hour);
        // Обновляем настройки в Redux
        updateSettings({ registrationStartHour: hour });
    }, [updateSettings]);
    
    // Обработчик изменения минут
    const handleMinuteChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const minute = parseInt(e.target.value, 10);
        setStartMinute(minute);
        // Обновляем настройки в Redux
        updateSettings({ registrationStartMinute: minute });
    }, [updateSettings]);
    
    return (
        <Container>
            <FormContainer>
                {/* Секция выбора дня недели */}
                <FormSection 
                    variants={formSectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                >
                    <SectionTitle>
                        <CalendarIcon />
                        День открытия регистрации
                    </SectionTitle>
                    
                    <DaySelector>
                        {daysOfWeek.map(day => (
                            <DayButton 
                                key={day.id}
                                isSelected={selectedDay === day.id}
                                onClick={() => handleDaySelect(day.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {day.short}
                            </DayButton>
                        ))}
                    </DaySelector>
                    
                    <Description>
                        День недели, в который курьерам будет открываться возможность записи на смены
                    </Description>
                </FormSection>
                
                {/* Секция настройки времени */}
                <FormSection 
                    variants={formSectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                >
                    <SectionTitle>
                        <ClockIcon />
                        Время открытия регистрации
                    </SectionTitle>
                    
                    <TimeSelector>
                        <TimeField>
                            <TimeLabel>Часы:</TimeLabel>
                            <TimeSelect 
                                value={startHour}
                                onChange={handleHourChange}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>
                                        {i.toString().padStart(2, '0')}
                                    </option>
                                ))}
                            </TimeSelect>
                        </TimeField>
                        
                        <TimeSeparator>:</TimeSeparator>
                        
                        <TimeField>
                            <TimeLabel>Минуты:</TimeLabel>
                            <TimeSelect 
                                value={startMinute}
                                onChange={handleMinuteChange}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {Array.from({ length: 12 }, (_, i) => i * 5).map(minute => (
                                    <option key={minute} value={minute}>
                                        {minute.toString().padStart(2, '0')}
                                    </option>
                                ))}
                            </TimeSelect>
                        </TimeField>
                    </TimeSelector>
                    
                    <Description>
                        Точное время, когда откроется доступ к записи на смены
                    </Description>
                </FormSection>
            </FormContainer>
        </Container>
    );
};

export default StepOne; 