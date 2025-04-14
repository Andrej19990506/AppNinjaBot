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
    margin: 0;
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

// Типы смещения
enum OffsetType {
    NONE = 'none',
    DAYS = 'days',
    WEEKS = 'weeks'
}

const StepTwo: React.FC = () => {
    const { settings, updateSettings } = useStepAccessSettings();
    
    // --- Добавляем проверку на null при инициализации useState --- 
    const [offsetType, setOffsetType] = useState<OffsetType>(
        (settings?.offsetType as OffsetType) ?? OffsetType.WEEKS
    );
    const [offsetAmount, setOffsetAmount] = useState<number>(
        settings?.offsetAmount ?? 1
    );
    // --- ---------------------------------------------------- --- 
    
    useEffect(() => {
        // --- Добавляем проверку на null в useEffect --- 
        if (settings) {
            setOffsetType((settings.offsetType as OffsetType) ?? OffsetType.WEEKS);
            setOffsetAmount(settings.offsetAmount ?? 1);
        } else {
             // Если настроек нет, сбрасываем на дефолтные значения
             setOffsetType(OffsetType.WEEKS);
             setOffsetAmount(1);
        }
        // --- -------------------------------------- --- 
    }, [settings]);
    
    // Обработчик изменения типа смещения
    const handleOffsetTypeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const type = e.target.value as OffsetType;
        setOffsetType(type);
        // Обновляем настройки в Redux
        updateSettings({ 
            offsetType: type,
            // Если выбрано "Нет", устанавливаем offsetAmount в 0
            ...(type === OffsetType.NONE ? { offsetAmount: 0 } : {})
        });
    }, [updateSettings]);
    
    // Обработчик изменения величины смещения
    const handleOffsetAmountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const amount = parseInt(e.target.value, 10);
        setOffsetAmount(amount);
        // Обновляем настройки в Redux
        updateSettings({ offsetAmount: amount });
    }, [updateSettings]);
    
    // Формирование текста примера на основе выбранных значений
    const getExampleText = useCallback(() => {
        const today = new Date();
        
        if (offsetType === OffsetType.NONE) {
            return 'Регистрация будет открыта на текущую неделю.';
        }
        
        let futureDate = new Date(today);
        let unitText = '';
        
        if (offsetType === OffsetType.DAYS) {
            futureDate.setDate(today.getDate() + offsetAmount);
            unitText = offsetAmount === 1 ? 'день' : offsetAmount < 5 ? 'дня' : 'дней';
        } else if (offsetType === OffsetType.WEEKS) {
            futureDate.setDate(today.getDate() + offsetAmount * 7);
            unitText = offsetAmount === 1 ? 'неделю' : 'недели';
        }
        
        // Форматирование даты
        const options: Intl.DateTimeFormatOptions = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        const formattedDate = futureDate.toLocaleDateString('ru-RU', options);
        
        return `Если сегодня ${today.toLocaleDateString('ru-RU', options)}, то регистрация будет открыта на период, начинающийся через ${offsetAmount} ${unitText} - ${formattedDate}.`;
    }, [offsetType, offsetAmount]);
    
    return (
        <Container>
            <FormContainer>
                {/* Секция выбора типа смещения */}
                <FormSection 
                    variants={formSectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                >
                    <SectionTitle>
                        <CalendarIcon />
                        Период смены для регистрации
                    </SectionTitle>
                    
                    <OffsetTypeSelector>
                        <RadioGroup>
                            <RadioOption>
                                <input 
                                    type="radio" 
                                    name="offsetType" 
                                    value={OffsetType.NONE} 
                                    checked={offsetType === OffsetType.NONE}
                                    onChange={handleOffsetTypeChange}
                                />
                                <span className="radio-custom"></span>
                                <span className="radio-label">Текущий период</span>
                            </RadioOption>
                            
                            <RadioOption>
                                <input 
                                    type="radio" 
                                    name="offsetType" 
                                    value={OffsetType.DAYS}
                                    checked={offsetType === OffsetType.DAYS}
                                    onChange={handleOffsetTypeChange}
                                />
                                <span className="radio-custom"></span>
                                <span className="radio-label">В днях вперёд</span>
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
                                <span className="radio-label">В неделях вперёд</span>
                            </RadioOption>
                        </RadioGroup>
                    </OffsetTypeSelector>
                    
                    {offsetType !== OffsetType.NONE && (
                        <AmountSelector>
                            <AmountLabel>
                                {offsetType === OffsetType.DAYS ? 'Количество дней:' : 'Количество недель:'}
                            </AmountLabel>
                            
                            <AmountSelect 
                                value={offsetAmount}
                                onChange={handleOffsetAmountChange}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {Array.from({ length: offsetType === OffsetType.DAYS ? 14 : 6 }, (_, i) => i + 1).map(num => (
                                    <option key={num} value={num}>
                                        {num}
                                    </option>
                                ))}
                            </AmountSelect>
                            
                            <AmountUnit>
                                {offsetType === OffsetType.DAYS 
                                    ? offsetAmount === 1 
                                        ? 'день' 
                                        : offsetAmount < 5 
                                            ? 'дня' 
                                            : 'дней'
                                    : offsetAmount === 1 
                                        ? 'неделя' 
                                        : offsetAmount < 5 
                                            ? 'недели' 
                                            : 'недель'
                                }
                            </AmountUnit>
                        </AmountSelector>
                    )}
                    
                    <Description>
                        {offsetType === OffsetType.NONE 
                            ? 'Курьеры смогут записываться на текущий период (текущую неделю)'
                            : `Курьеры смогут записываться на период, который начинается через указанное количество ${offsetType === OffsetType.DAYS ? 'дней' : 'недель'}`
                        }
                    </Description>
                    
                    {/* Визуальный пример */}
                    <VisualExample
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <ExampleTitle>
                            <InfoIcon />
                            Пример
                        </ExampleTitle>
                        <ExampleText>
                            {getExampleText()}
                        </ExampleText>
                    </VisualExample>
                </FormSection>
            </FormContainer>
        </Container>
    );
};

export default StepTwo; 