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

// Блок календаря и ручной настройки
const IntervalConfigSection = styled(motion.div)`
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px dashed var(--border-color);
`;

// Кнопка открытия интервала
const OpenIntervalButton = styled(motion.button)`
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
    margin-top: 8px;
    
    &:hover {
        background-color: var(--primary-dark);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
    }
    
    &:active {
        transform: translateY(0);
    }
    
    svg {
        width: 18px;
        height: 18px;
    }
`;

// Заглушка календаря
const CalendarPlaceholder = styled(motion.div)`
    background-color: var(--background-light);
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
    border: 1px dashed var(--border-color);
    min-height: 240px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
`;

const CalendarTitle = styled.h5`
    font-size: 15px;
    color: var(--text-color);
    margin: 0;
`;

const CalendarDescription = styled.p`
    font-size: 14px;
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
    max-width: 300px;
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

// Компонент иконки календаря
const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

// Компонент иконки успеха
const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const StepThree: React.FC = () => {
    // Получаем настройки доступа из контекста через хук
    const { settings, updateSettings } = useStepAccessSettings();
    
    // Состояние для переключателя активности
    const [isActive, setIsActive] = useState<boolean>(settings.isAlwaysActive ?? true);
    
    // Обновляем локальное состояние при изменении настроек
    useEffect(() => {
        setIsActive(settings.isAlwaysActive ?? true);
    }, [settings]);
    
    // Обработчик изменения состояния переключателя
    const handleToggleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.checked;
        setIsActive(newValue);
        // Обновляем настройки в Redux
        updateSettings({ isAlwaysActive: newValue });
    }, [updateSettings]);
    
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
            </FormContainer>
        </Container>
    );
};

export default StepThree; 