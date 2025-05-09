import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useStepAccessSettings } from '../../../ShiftAccessModal/hooks';
import { format } from 'date-fns';
import addDays from 'date-fns/addDays';
import addWeeks from 'date-fns/addWeeks';
import getDay from 'date-fns/getDay';
import { ru } from 'date-fns/locale';

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

// Пояснение
const Description = styled.p`
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 16px;
    font-style: italic;
`;

// Компонент Toggle Switch
const ToggleContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0;
`;

const ToggleLabel = styled.span`
    font-size: 15px;
    color: var(--text-color);
`;

const Toggle = styled.label`
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
    
    input {
        opacity: 0;
        width: 0;
        height: 0;
    }
`;

const Slider = styled.span<{ active: boolean }>`
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${props => props.active ? 'var(--primary-color)' : 'var(--border-color)'};
    transition: 0.4s;
    border-radius: 28px;
    box-shadow: ${props => props.active ? '0 0 8px rgba(var(--primary-rgb), 0.5)' : 'none'};
    
    &:before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
        transform: ${props => props.active ? 'translateX(24px)' : 'translateX(0)'};
    }
`;

// Визуальный пример (перенесен из StepTwo)
const VisualExample = styled(motion.div)`
    background-color: var(--background-light);
    border-radius: 8px;
    padding: 12px;
    margin-top: 24px;
    border-left: 3px solid var(--info-color);
`;

const ExampleTitle = styled.h5`
    font-size: 14px;
    color: var(--text-color);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    
    svg {
        margin-right: 6px;
        color: var(--info-color);
    }
`;

const ExampleText = styled.p`
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
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

// Компонент иконки настройки
const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

// Компонент иконки информации (перенесен из StepTwo)
const InfoIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

// Типы смещения и длины периода (перенесены из StepTwo)
enum OffsetType {
    NONE = 'none',
    DAYS = 'days',
    WEEKS = 'weeks'
}

enum PeriodLengthType {
    ONE_WEEK = '7',
    TWO_WEEKS = '14'
}

// Функция для получения даты ПОСЛЕДНЕГО дня недели (перенесена из StepTwo)
const getLastDayOfWeek = (date: Date, targetDayOfWeek: number): Date => {
    const currentDay = getDay(date); 
    let daysToSubtract = currentDay - targetDayOfWeek;
    if (daysToSubtract < 0) {
        daysToSubtract += 7; 
    }
    const resultDate = new Date(date);
    resultDate.setDate(resultDate.getDate() - daysToSubtract);
    return resultDate;
};

// Функция нахождения следующего дня регистрации (перенесена из StepTwo)
const getNextRegistrationDayOnOrAfter = (baseDate: Date, targetDayOfWeek: number, hour: number, minute: number): Date => {
    const baseDay = getDay(baseDate);
    let daysToAdd = (targetDayOfWeek - baseDay + 7) % 7;
    
    const nextRegDate = new Date(baseDate);
    nextRegDate.setDate(nextRegDate.getDate() + daysToAdd);
    nextRegDate.setHours(hour, minute, 0, 0);
    
    if (nextRegDate.getTime() < baseDate.getTime()) {
         nextRegDate.setDate(nextRegDate.getDate() + 7);
    }
    
    return nextRegDate;
};

// Вспомогательная функция для совместимости
const max = (a: number, b: number) => Math.max(a, b);

const StepThree: React.FC = () => {
    const { settings, updateSettings } = useStepAccessSettings();
    
    const [isActive, setIsActive] = useState<boolean>(settings?.isAlwaysActive ?? true);
    
    useEffect(() => {
        if (settings) {
            setIsActive(settings.isAlwaysActive ?? true);
        } else {
            setIsActive(true);
        }
    }, [settings]);
    
    const handleToggleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.checked;
        setIsActive(newValue);
        // Обновляем настройки в Redux
        updateSettings({ isAlwaysActive: newValue });
    }, [updateSettings]);
    
    // Функция для генерации текста примера (перенесена из StepTwo)
    const getExampleText = () => {
        const registrationDay = settings?.registrationStartDay ?? 4;
        const registrationHour = settings?.registrationStartHour ?? 12;
        const registrationMinute = settings?.registrationStartMinute ?? 0;
        const offsetType = settings?.offsetType as OffsetType ?? OffsetType.DAYS;
        const offsetAmount = settings?.offsetAmount ?? 4;
        const periodLength = settings?.periodLength ?? 7;
        
        const daysOfWeek = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
        const regDayName = daysOfWeek[registrationDay] ?? 'четверг';
        
        const now = new Date();
        let lastRegistrationDateTime = getLastDayOfWeek(now, registrationDay);
        lastRegistrationDateTime.setHours(registrationHour, registrationMinute, 0, 0);
        if (getDay(now) === registrationDay && now.getTime() < lastRegistrationDateTime.getTime()) {
            lastRegistrationDateTime.setDate(lastRegistrationDateTime.getDate() - 7);
        }
        
        const baseDateForNextCycle = addDays(lastRegistrationDateTime, max(1, periodLength) - 1);
        const predictedNextRegDay = getNextRegistrationDayOnOrAfter(
            baseDateForNextCycle,
            registrationDay,
            registrationHour,
            registrationMinute
        );
        
        let predictedAccessStartDate: Date;
        if (offsetType === OffsetType.WEEKS) {
            predictedAccessStartDate = addWeeks(predictedNextRegDay, offsetAmount);
        } else {
            const effectiveOffset = offsetType === OffsetType.NONE ? 0 : offsetAmount;
            predictedAccessStartDate = addDays(predictedNextRegDay, effectiveOffset);
        }
        
        const formattedStartDate = format(predictedAccessStartDate, 'EEEE, d MMMM', { locale: ru });
        
        // Функция для склонения слов (перенесена из StepTwo)
        const getOffsetUnitLabel = () => {
            switch (offsetType) {
                case OffsetType.DAYS: return offsetAmount === 1 ? 'день' : (offsetAmount >= 2 && offsetAmount <= 4) ? 'дня' : 'дней';
                case OffsetType.WEEKS: return offsetAmount === 1 ? 'неделя' : (offsetAmount >= 2 && offsetAmount <= 4) ? 'недели' : 'недель';
                default: return '';
            }
        };
        
        const periodText = periodLength === 7 ? "на неделю (7 дней)" : "на 2 недели (14 дней)";
        return `Если регистрация открывается в ${regDayName}, и доступ открывается ${periodText}, то с вашим смещением (${offsetAmount} ${getOffsetUnitLabel()}) следующий доступ начнется примерно с ${formattedStartDate}.`;
    };
    
    return (
        <Container>
            <Title>Подтверждение настроек</Title>
            
            <FormContainer>
                {/* Секция активации/деактивации */}
                <FormSection 
                    variants={formSectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                >
                    <SectionTitle>
                        <SettingsIcon />
                        Настройка активности
                    </SectionTitle>
                    
                    <ToggleContainer>
                        <ToggleLabel>Активировать автоматическую настройку доступа</ToggleLabel>
                        <Toggle>
                            <input 
                                type="checkbox" 
                                checked={isActive}
                                onChange={handleToggleChange}
                            />
                            <Slider active={isActive} />
                        </Toggle>
                    </ToggleContainer>
                    
                    <Description>
                        {isActive 
                            ? 'Настройки доступа к сменам будут применяться автоматически согласно вашим параметрам на постоянной основе'
                            : 'Настройки доступа будут применены только один раз и не будут действовать автоматически в будущем'
                        }
                    </Description>

                    {/* Дополнительная информация в зависимости от состояния тумблера */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ marginTop: '16px' }}
                    >
                        {isActive ? (
                            <Description style={{ color: 'var(--success-color)', fontWeight: 500 }}>
                                ✓ Режим автоматического применения активирован
                            </Description>
                        ) : (
                            <Description style={{ color: 'var(--warning-color)', fontWeight: 500 }}>
                                ⓘ Настройки будут применены только к текущему периоду
                            </Description>
                        )}
                    </motion.div>
                </FormSection>
                
                {/* Визуальный пример (перенесен из StepTwo) */}
                <VisualExample
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    <ExampleTitle>
                        <InfoIcon />
                        Как это работает (пример)
                    </ExampleTitle>
                    <ExampleText>
                        {getExampleText()}
                    </ExampleText>
                </VisualExample>
            </FormContainer>
        </Container>
    );
};

export default StepThree; 