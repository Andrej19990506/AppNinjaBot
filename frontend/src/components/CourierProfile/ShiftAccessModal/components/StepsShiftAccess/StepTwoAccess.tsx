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

// Компонент выбора типа смещения (радио-кнопки)
const OffsetTypeSelector = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
`;

// Группа радио-кнопок
const RadioGroup = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 8px;
    
    @media (max-width: 480px) {
        flex-direction: column;
        gap: 12px;
    }
`;

// Вариант радио-кнопки
const RadioOption = styled.label`
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    
    input {
        position: absolute;
        opacity: 0;
        height: 0;
        width: 0;
    }
    
    .radio-custom {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid var(--border-color);
        display: inline-block;
        position: relative;
        margin-right: 10px;
        transition: all 0.2s ease;
    }
    
    input:checked + .radio-custom {
        border-color: var(--primary-color);
    }
    
    input:checked + .radio-custom::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: var(--primary-color);
    }
    
    &:hover .radio-custom {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-light);
    }
    
    .radio-label {
        font-size: 14px;
        color: var(--text-color);
    }
`;

// Селектор количества (число дней или недель)
const AmountSelector = styled.div`
    display: flex;
    align-items: center;
    margin-top: 16px;
`;

// Метка поля
const AmountLabel = styled.label`
    font-size: 14px;
    color: var(--text-secondary);
    margin-right: 12px;
`;

// Выбор количества
const AmountSelect = styled(motion.select)`
    background-color: var(--background-light);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text-color);
    font-size: 14px;
    cursor: pointer;
    appearance: none;
    transition: all 0.2s ease;
    width: 80px;
    
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

// Единица измерения
const AmountUnit = styled.span`
    font-size: 14px;
    color: var(--text-color);
    margin-left: 8px;
`;

// Визуальный пример
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

// Компонент иконки календаря
const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

// Компонент иконки информации
const InfoIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

// Типы смещения и длины периода
enum OffsetType {
    NONE = 'none',
    DAYS = 'days',
    WEEKS = 'weeks'
}

// <<< НОВОЕ: Enum для выбора длины периода >>>
enum PeriodLengthType {
    ONE_WEEK = '7', // Значения будут строками, т.к. value у radio - строка
    TWO_WEEKS = '14'
}

// Функция для получения даты ПОСЛЕДНЕГО дня недели (изменена для работы с Date) 
const getLastDayOfWeek = (date: Date, targetDayOfWeek: number): Date => {
    const currentDay = getDay(date); 
    let daysToSubtract = currentDay - targetDayOfWeek;
    if (daysToSubtract < 0) {
        daysToSubtract += 7; 
    }
    const resultDate = new Date(date); // Клонируем дату
    resultDate.setDate(resultDate.getDate() - daysToSubtract);
    return resultDate;
};

// <<< НОВАЯ функция: найти следующий день регистрации НА или ПОСЛЕ указанной даты >>>
const getNextRegistrationDayOnOrAfter = (baseDate: Date, targetDayOfWeek: number, hour: number, minute: number): Date => {
    const baseDay = getDay(baseDate);
    let daysToAdd = (targetDayOfWeek - baseDay + 7) % 7;
    
    const nextRegDate = new Date(baseDate); // Клонируем
    nextRegDate.setDate(nextRegDate.getDate() + daysToAdd);
    nextRegDate.setHours(hour, minute, 0, 0); // Устанавливаем время
    
    // Если мы получили дату раньше baseDate (например, из-за времени),
    // значит нужно взять следующую неделю
    if (nextRegDate.getTime() < baseDate.getTime()) {
         nextRegDate.setDate(nextRegDate.getDate() + 7);
    }
    
    return nextRegDate;
};

const StepTwo: React.FC = () => {
    const { settings, updateSettings } = useStepAccessSettings();
    
    const initialOffsetType = (settings?.offsetType as OffsetType) ?? OffsetType.DAYS;
    const [offsetType, setOffsetType] = useState<OffsetType>(initialOffsetType);
    const [offsetAmount, setOffsetAmount] = useState<number>(settings?.offsetAmount ?? 4);

    // <<< ИЗМЕНЕНО: Локальное состояние для periodLengthType и его инициализация >>>
    const initialPeriodLength = settings?.periodLength ?? 7;
    const initialPeriodLengthType = initialPeriodLength === 14 ? PeriodLengthType.TWO_WEEKS : PeriodLengthType.ONE_WEEK;
    const [periodLengthType, setPeriodLengthType] = useState<PeriodLengthType>(initialPeriodLengthType);

    useEffect(() => {
        if (settings) {
            setOffsetType((settings.offsetType as OffsetType) ?? OffsetType.DAYS);
            setOffsetAmount(settings.offsetAmount ?? 4);
            // <<< ИЗМЕНЕНО: Обновляем periodLengthType из settings.periodLength >>>
            const currentPeriodLength = settings.periodLength ?? 7;
            setPeriodLengthType(currentPeriodLength === 14 ? PeriodLengthType.TWO_WEEKS : PeriodLengthType.ONE_WEEK);
        } else {
            setOffsetType(OffsetType.DAYS);
            setOffsetAmount(4);
            setPeriodLengthType(PeriodLengthType.ONE_WEEK); // По умолчанию одна неделя
        }
    }, [settings]);

    const handleOffsetTypeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newType = e.target.value as OffsetType;
        setOffsetType(newType);
        const defaultAmount = newType === OffsetType.WEEKS ? 1 : 4;
        setOffsetAmount(defaultAmount);
        updateSettings({ offsetType: newType, offsetAmount: defaultAmount });
    }, [updateSettings]);

    const handleOffsetAmountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newAmount = parseInt(e.target.value, 10);
        setOffsetAmount(newAmount);
        updateSettings({ offsetAmount: newAmount });
    }, [updateSettings]);
    
    // <<< ИЗМЕНЕНО: Обработчик изменения длины периода через радио-кнопки >>>
    const handlePeriodLengthTypeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newType = e.target.value as PeriodLengthType;
        setPeriodLengthType(newType);
        const newLength = parseInt(newType, 10); // Преобразуем '7' или '14' в число
        updateSettings({ periodLength: newLength });
    }, [updateSettings]);

    const getOffsetAmountOptions = () => {
        const limit = offsetType === OffsetType.WEEKS ? 4 : 14;
        return Array.from({ length: limit }, (_, i) => i + 1);
    };
    
    // Опции для длины периода больше не нужны в виде селектора
    // const getPeriodLengthOptions = () => {
    //     return Array.from({ length: 14 }, (_, i) => i + 1); 
    // };

    const getOffsetUnitLabel = () => {
        switch (offsetType) {
            case OffsetType.DAYS: return offsetAmount === 1 ? 'день' : (offsetAmount >= 2 && offsetAmount <= 4) ? 'дня' : 'дней';
            case OffsetType.WEEKS: return offsetAmount === 1 ? 'неделя' : (offsetAmount >= 2 && offsetAmount <= 4) ? 'недели' : 'недель';
            default: return '';
        }
    };

    // Эта функция больше не нужна, текст будет в лейблах
    // const getPeriodLengthUnitLabel = () => { ... };

    return (
        <Container>
            <FormContainer>
                {/* Секция типа смещения (без изменений) */}
                <FormSection 
                    variants={formSectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                >
                    <SectionTitle>
                        <CalendarIcon />
                        Смещение начала записи
                    </SectionTitle>
                    <OffsetTypeSelector>
                        <RadioGroup>
                            <RadioOption>
                                <input 
                                    type="radio" 
                                    name="offsetType" 
                                    value={OffsetType.DAYS} 
                                    checked={offsetType === OffsetType.DAYS}
                                    onChange={handleOffsetTypeChange}
                                />
                                <span className="radio-custom"></span>
                                <span className="radio-label">Сместить на N дней</span>
                            </RadioOption>
                            <RadioOption>
                                <input 
                                    type="radio" 
                                    name="offsetType" 
                                    value={OffsetType.WEEKS} 
                                    checked={offsetType === OffsetType.WEEKS}
                                    onChange={handleOffsetTypeChange}
                                />
                                <span className="radio-custom"></span>
                                <span className="radio-label">Сместить на N недель</span>
                            </RadioOption>
                        </RadioGroup>
                    </OffsetTypeSelector>
                    <AmountSelector>
                        <AmountLabel htmlFor="offsetAmountSelect">Сместить на:</AmountLabel>
                        <AmountSelect 
                            id="offsetAmountSelect"
                            value={offsetAmount} 
                            onChange={handleOffsetAmountChange}
                            whileTap={{ scale: 0.95 }}
                        >
                            {getOffsetAmountOptions().map(num => (
                                <option key={num} value={num}>{num}</option>
                            ))}
                        </AmountSelect>
                        <AmountUnit>{getOffsetUnitLabel()}</AmountUnit>
                    </AmountSelector>
                    <Description>
                        Укажите, через сколько дней или недель после дня открытия регистрации начнется период, на который можно записываться.
                    </Description>
                </FormSection>

                {/* <<< ИЗМЕНЕНА СЕКЦИЯ: Длина периода доступа (радио-кнопки) >>> */}
                <FormSection
                    variants={formSectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                >
                    <SectionTitle>
                        <CalendarIcon />
                        Длительность периода записи
                    </SectionTitle>
                    
                    <RadioGroup> {/* Используем тот же RadioGroup для стилизации */}
                        <RadioOption>
                            <input 
                                type="radio" 
                                name="periodLengthType" 
                                value={PeriodLengthType.ONE_WEEK} 
                                checked={periodLengthType === PeriodLengthType.ONE_WEEK}
                                onChange={handlePeriodLengthTypeChange}
                            />
                            <span className="radio-custom"></span>
                            <span className="radio-label">На неделю (7 дней)</span>
                        </RadioOption>
                        <RadioOption>
                            <input 
                                type="radio" 
                                name="periodLengthType" 
                                value={PeriodLengthType.TWO_WEEKS} 
                                checked={periodLengthType === PeriodLengthType.TWO_WEEKS}
                                onChange={handlePeriodLengthTypeChange}
                            />
                            <span className="radio-custom"></span>
                            <span className="radio-label">На 2 недели (14 дней)</span>
                        </RadioOption>
                    </RadioGroup>
                    
                    <Description>
                        Выберите, на какой срок будет открыт доступ для записи в смены.
                    </Description>
                </FormSection>
            </FormContainer>
        </Container>
    );
}

// <<< НОВОЕ: Добавляем Math.max для совместимости >>>
const max = (a: number, b: number) => Math.max(a, b);

export default StepTwo; 