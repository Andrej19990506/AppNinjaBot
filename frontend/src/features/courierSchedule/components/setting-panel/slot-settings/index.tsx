import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import { 
    SlotSettingsContainer, 
    SlotSettingsHeader, 
    SlotSettingsTitle, 
    SlotSettingsContent
} from '@/features/courierSchedule/components/courier-calendar/styles';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import {
    updateSlotConfigLocal,
    defaultSingleDaySlotConfig
} from '@features/courierSchedule/store/shiftsSlice/shiftsSlice';
import {
    updateSlotConfig} from '@features/courierSchedule/services/courierApi';
import { addNotification} from '@shared/store/notificationSlice/notificationSlice';
import { selectSlotConfig, selectSlotConfigForDay } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { SlotConfigUpdatePayload } from '@features/courierSchedule/types/courierScheduleTypes';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
import { SlotConfigForDay } from '@features/courierSchedule/types/courierScheduleTypes';


const SettingsSection = styled.div`
    margin-bottom: 24px;
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

const SlotCountControls = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const SlotCountButton = styled.button`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background-color: var(--primary-transparent);
    color: var(--primary-color);
    font-size: 1.2rem;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
    
    &:hover:not(:disabled) {
        background-color: var(--primary-color);
        color: white;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: var(--hover-overlay);
        color: var(--text-secondary);
    }
`;

const SlotCountValue = styled.div`
    font-weight: 600;
    min-width: 40px;
    padding: 4px 8px;
    text-align: center;
    border-radius: var(--radius-sm);
    background-color: var(--card-background);
    color: var(--text-color);
    border: 1px solid var(--border-color);
`;

const InlineSpinner = styled.div`
    border: 2px solid rgba(var(--primary-rgb), 0.3);
    border-top: 2px solid var(--primary-color);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 8px;

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const stroke = keyframes`
  100% {
    stroke-dashoffset: 0;
  }
`;

const scale = keyframes`
  0%, 100% {
    transform: none;
  }
  50% {
    transform: scale3d(1.05, 1.05, 1);
  }
`;

const fillCircle = keyframes`
  100% {
    fill: var(--success-color);
  }
`;

const fadeInScaleUp = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const AnimatedCheckmarkWrapper = styled.div`
  width: 60px;
  height: 60px;
  margin-bottom: 20px;

  .checkmark__circle {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    stroke-width: 2;
    stroke-miterlimit: 10;
    stroke: var(--success-color); 
    fill: none;
    animation: 
      ${stroke} 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards, 
      ${fillCircle} 0.4s ease-in-out 0.4s forwards, 
      ${scale} 0.3s ease-in-out 0.9s both;
  }

  .checkmark {
    width: 100%;
    height: 100%;
    display: block; 
  }

  .checkmark__check {
    transform-origin: 50% 50%;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    stroke-width: 3;
    stroke: #fff;
    fill: none;
    animation: ${stroke} 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
  }
`;

const AnimatedCheckmark = () => (
    <AnimatedCheckmarkWrapper>
        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
    </AnimatedCheckmarkWrapper>
);

const SuccessMessageContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    min-height: 250px;
    animation: ${fadeInScaleUp} 0.5s ease-out forwards;
`;

const SuccessText = styled.p`
    font-size: 1.1rem;
    color: var(--text-color);
    margin-bottom: 24px;
`;

const OkButton = styled.button`
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px 20px;
    font-weight: 500;
    cursor: pointer;
    min-width: 100px;
    transition: background-color 0.2s;

    &:hover {
        background-color: var(--primary-dark);
    }
`;

// Убрали DaySelect - больше не нужен

const WeekIndicatorContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin: 16px 0;
    padding: 12px;
    background-color: var(--background-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
`;

const pulse = keyframes`
    0% { 
        opacity: 1; 
        transform: scale(1); 
    }
    50% { 
        opacity: 0.5; 
        transform: scale(1.3); 
    }
    100% { 
        opacity: 1; 
        transform: scale(1); 
    }
`;

const AnimatedDot = styled.div`
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background-color: #FF6B35;
    border-radius: 50%;
    border: 1px solid var(--card-background);
    animation: ${pulse} 1.2s ease-in-out infinite;
    transform-origin: center;
    z-index: 10;
`;

const DayIndicator = styled.div<{ 
    $isActive: boolean; 
    $isModified: boolean; 
    $clickable?: boolean;
}>`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    cursor: ${props => props.$clickable ? 'pointer' : 'default'};
    transition: all 0.2s ease;
    position: relative;
    
    ${props => {
        if (props.$isActive && props.$isModified) {
            return `
                background-color: #FF6B35;
                color: white;
                box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.3);
            `;
        } else if (props.$isActive) {
            return `
                background-color: var(--primary-color);
                color: white;
                box-shadow: 0 0 0 2px var(--primary-transparent);
            `;
        } else if (props.$isModified) {
            return `
                background-color: #FF6B35;
                color: white;
                border: 2px solid #FF6B35;
            `;
        } else {
            return `
                background-color: var(--card-background);
                color: var(--text-secondary);
                border: 1px solid var(--border-color);
            `;
        }
    }}

    &:hover {
        ${props => props.$clickable && `
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        `}
    }


`;

const WeekIndicatorTitle = styled.div`
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: 8px;
    font-weight: 500;
`;

const ToggleContainer = styled.div`
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
`;

const ToggleSwitch = styled.div<{ $active: boolean }>`
    position: relative;
    width: 50px;
    height: 24px;
    background-color: ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
    border-radius: 12px;
    transition: background-color 0.3s ease;
    margin-right: 10px;
    
    &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: ${props => props.$active ? '26px' : '2px'};
        width: 20px;
        height: 20px;
        background-color: white;
        border-radius: 50%;
        transition: left 0.3s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
`;

const ToggleLabel = styled.span`
    font-size: 14px;
    color: var(--text-color);
    font-weight: 500;
`;

export interface SlotSettingsRef {
    triggerSave: () => Promise<void>;
    triggerReset: () => void;
    isDirty: boolean;
    isValid: () => boolean;
}

interface ISlotSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: number;
    dayIndex: number;
    onDayChangeRequest: (newDayIndex: number) => void;
    onDirtyChange: (isDirty: boolean) => void;
}

const SlotSettingsComponent: React.ForwardRefRenderFunction<SlotSettingsRef, ISlotSettingsProps> = ({ 
    isOpen, 
    onClose, 
    chatId, 
    dayIndex,
    onDayChangeRequest,
    onDirtyChange
}, ref) => {
    const dispatch = useDispatch<AppDispatch>();

    const fullSlotConfig = useSelector(selectSlotConfig);

    // Локальное состояние для всех дней недели
    const [weekConfig, setWeekConfig] = useState<SlotConfigForDay[]>(() => {
        const initialConfig: SlotConfigForDay[] = [];
        for (let i = 0; i < 7; i++) {
            const dayConfig = Array.isArray(fullSlotConfig) 
                ? fullSlotConfig[i] 
                : fullSlotConfig?.[i as keyof typeof fullSlotConfig];
            initialConfig[i] = dayConfig || { ...defaultSingleDaySlotConfig };
        }
        return initialConfig;
    });

    // Получаем настройки для текущего выбранного дня
    const currentDayConfig = weekConfig[dayIndex];
    const daySlots = currentDayConfig?.maxDaySlots ?? defaultSingleDaySlotConfig.maxDaySlots;
    const nightSlots = currentDayConfig?.maxNightSlots ?? defaultSingleDaySlotConfig.maxNightSlots;
    const hasSeniorSlot = currentDayConfig?.hasSeniorSlot ?? false;
    
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const dayOfWeekNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const dayShortNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    // Функция для проверки изменений конкретного дня
    const isDayModified = useCallback((dayIndex: number): boolean => {
        if (!weekConfig[dayIndex]) return false;
        
        const dayConfig = weekConfig[dayIndex];
        const original = Array.isArray(fullSlotConfig) 
            ? fullSlotConfig[dayIndex] 
            : fullSlotConfig?.[dayIndex as keyof typeof fullSlotConfig];
        const initialConfig = original || defaultSingleDaySlotConfig;
        
        const isModified = dayConfig.maxDaySlots !== initialConfig.maxDaySlots ||
               dayConfig.maxNightSlots !== initialConfig.maxNightSlots ||
               dayConfig.hasSeniorSlot !== initialConfig.hasSeniorSlot;
        
        console.log(`[SlotSettings] isDayModified(${dayIndex}):`, {
            isModified,
            dayConfig,
            initialConfig
        });
        
        return isModified;
    }, [weekConfig, fullSlotConfig]);

    // Проверяем, есть ли изменения в любом дне недели
    const calculatedIsDirty = useMemo(() => {
        if (!isOpen || weekConfig.length === 0) return false;
        return weekConfig.some((_, index) => isDayModified(index));
    }, [isOpen, weekConfig, isDayModified]);

    const prevCalculatedIsDirtyRef = useRef<boolean>();
    useEffect(() => {
        if (prevCalculatedIsDirtyRef.current !== calculatedIsDirty) {
            console.log('[SlotSettings] Dirty state changed:', calculatedIsDirty);
            onDirtyChange(calculatedIsDirty);
            prevCalculatedIsDirtyRef.current = calculatedIsDirty;
        }
    }, [calculatedIsDirty, onDirtyChange]);

    useEffect(() => {
        if (isOpen) {
            // Обновляем состояние для всех дней недели при открытии
            const updatedConfig: SlotConfigForDay[] = [];
            for (let i = 0; i < 7; i++) {
                const dayConfig = Array.isArray(fullSlotConfig) 
                    ? fullSlotConfig[i] 
                    : fullSlotConfig?.[i as keyof typeof fullSlotConfig];
                updatedConfig[i] = dayConfig || { ...defaultSingleDaySlotConfig };
            }
            setWeekConfig(updatedConfig);
            setIsLoading(false);
        }
    }, [isOpen, fullSlotConfig]);



    const handleDayIndicatorClick = (newDayIndex: number) => {
        if (newDayIndex !== dayIndex) {
            onDayChangeRequest(newDayIndex);
        }
    };

    const handleDecreaseDaySlots = () => {
        setWeekConfig(prev => {
            const newConfig = [...prev];
            newConfig[dayIndex] = {
                ...newConfig[dayIndex],
                maxDaySlots: Math.max(newConfig[dayIndex].maxDaySlots - 1, 0)
            };
            return newConfig;
        });
    };

    const handleIncreaseDaySlots = () => {
        setWeekConfig(prev => {
            const newConfig = [...prev];
            newConfig[dayIndex] = {
                ...newConfig[dayIndex],
                maxDaySlots: Math.min(newConfig[dayIndex].maxDaySlots + 1, 20)
            };
            return newConfig;
        });
    }; 

    const handleDecreaseNightSlots = () => {
        setWeekConfig(prev => {
            const newConfig = [...prev];
            newConfig[dayIndex] = {
                ...newConfig[dayIndex],
                maxNightSlots: Math.max(newConfig[dayIndex].maxNightSlots - 1, 0)
            };
            return newConfig;
        });
    };

    const handleIncreaseNightSlots = () => {
        setWeekConfig(prev => {
            const newConfig = [...prev];
            newConfig[dayIndex] = {
                ...newConfig[dayIndex],
                maxNightSlots: Math.min(newConfig[dayIndex].maxNightSlots + 1, 20)
            };
            return newConfig;
        });
    };

    const handleToggleSeniorSlot = () => {
        setWeekConfig(prev => {
            const newConfig = [...prev];
            newConfig[dayIndex] = {
                ...newConfig[dayIndex],
                hasSeniorSlot: !newConfig[dayIndex].hasSeniorSlot
            };
            return newConfig;
        });
    };

    const handleSave = useCallback(async (): Promise<void> => {
        if (!calculatedIsDirty || !chatId) {
            return;
        }

        setIsLoading(true);
        setShowSuccess(false);
        
        const apiPayload: SlotConfigUpdatePayload = {
            config: Object.fromEntries(
                weekConfig.map((dayConfig, idx) => [String(idx), dayConfig])
            )
        };

        try {
            await updateSlotConfig(chatId, apiPayload); 
            
            // Обновляем Redux состояние для всех измененных дней недели
            weekConfig.forEach((dayConfig, dayIndex) => {
                dispatch(updateSlotConfigLocal({
                    dayIndex, 
                    maxDaySlots: dayConfig.maxDaySlots, 
                    maxNightSlots: dayConfig.maxNightSlots,
                    hasSeniorSlot: dayConfig.hasSeniorSlot
                }));
            });
            
            setShowSuccess(true);
            setIsLoading(false); 
            
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка сохранения настроек слотов: ${error.message || error}`,
                duration: 5000
            }));
            setIsLoading(false);
        }
    }, [calculatedIsDirty, chatId, weekConfig, dispatch]);
    
    const handleReset = useCallback(() => {
        // Сбрасываем к исходным значениям для всех дней недели
        const resetConfig: SlotConfigForDay[] = [];
        for (let i = 0; i < 7; i++) {
            const dayConfig = Array.isArray(fullSlotConfig) 
                ? fullSlotConfig[i] 
                : fullSlotConfig?.[i as keyof typeof fullSlotConfig];
            resetConfig[i] = dayConfig || { ...defaultSingleDaySlotConfig };
        }
        setWeekConfig(resetConfig);
        setIsLoading(false);
        setShowSuccess(false);
    }, [fullSlotConfig]);


    useImperativeHandle(ref, () => ({
        triggerSave: handleSave,
        triggerReset: handleReset,
        isDirty: calculatedIsDirty,
        isValid: () => {
            return true;
        }
    }), [handleSave, handleReset, calculatedIsDirty]);

    if (showSuccess) {
        return (
            <SlotSettingsContainer $isOpen={isOpen}>
                <SlotSettingsHeader>
                    <SlotSettingsTitle>Настройки слотов</SlotSettingsTitle>
                </SlotSettingsHeader>
                <SlotSettingsContent>
                    <SuccessMessageContainer>
                        <AnimatedCheckmark />
                        <SuccessText>Настройки слотов сохранены!</SuccessText>
                        <OkButton onClick={() => {
                            setShowSuccess(false);
                            onClose();
                        }}>
                            ОК
                        </OkButton>
                    </SuccessMessageContainer>
                </SlotSettingsContent>
            </SlotSettingsContainer>
        );
    }

    return (
        <SlotSettingsContainer $isOpen={isOpen}>
            <SlotSettingsHeader>
                <SlotSettingsTitle>
                    Настройки слотов на {dayOfWeekNames[dayIndex]}
                </SlotSettingsTitle>
            </SlotSettingsHeader>

            <SlotSettingsContent>
                {/* Индикаторы дней недели */}
                <div>
                    <WeekIndicatorTitle>
                        Дни недели {calculatedIsDirty && '(есть несохраненные изменения)'}
                    </WeekIndicatorTitle>
                    <WeekIndicatorContainer>
                        {dayShortNames.map((shortName, index) => (
                            <DayIndicator
                                key={index}
                                $isActive={index === dayIndex}
                                $isModified={isDayModified(index)}
                                $clickable={!isLoading}
                                onClick={() => !isLoading && handleDayIndicatorClick(index)}
                                title={`${dayOfWeekNames[index]}${isDayModified(index) ? ' (изменен)' : ''}`}
                            >
                                {shortName}
                                {isDayModified(index) && <AnimatedDot />}
                            </DayIndicator>
                        ))}
                    </WeekIndicatorContainer>
                </div>

                {( 
                    <SettingsSection>
                        <SlotConfigRow>
                            <SlotTypeLabel>
                                <SlotTypeIcon>🌟</SlotTypeIcon> Слот для старшего курьера
                            </SlotTypeLabel>
                            <ToggleContainer onClick={isLoading ? undefined : handleToggleSeniorSlot}>
                                <ToggleSwitch $active={hasSeniorSlot} />
                                <ToggleLabel>{hasSeniorSlot ? 'Включен' : 'Отключен'}</ToggleLabel>
                            </ToggleContainer>
                        </SlotConfigRow>

                        <SlotConfigRow>
                            <SlotTypeLabel>
                                <SlotTypeIcon>☀️</SlotTypeIcon> Дневные слоты
                            </SlotTypeLabel>
                            <SlotCountControls>
                                <SlotCountButton onClick={handleDecreaseDaySlots} disabled={isLoading || daySlots <= 0}>-</SlotCountButton>
                                <SlotCountValue>{daySlots}</SlotCountValue>
                                <SlotCountButton onClick={handleIncreaseDaySlots} disabled={isLoading || daySlots >= 20}>+</SlotCountButton>
                            </SlotCountControls>
                        </SlotConfigRow>
                        
                        <SlotConfigRow>
                            <SlotTypeLabel>
                                <SlotTypeIcon>🌙</SlotTypeIcon> Ночные слоты
                            </SlotTypeLabel>
                            <SlotCountControls>
                                <SlotCountButton onClick={handleDecreaseNightSlots} disabled={isLoading || nightSlots <= 0}>-</SlotCountButton>
                                <SlotCountValue>{nightSlots}</SlotCountValue>
                                <SlotCountButton onClick={handleIncreaseNightSlots} disabled={isLoading || nightSlots >= 20}>+</SlotCountButton>
                            </SlotCountControls>
                        </SlotConfigRow>
                    </SettingsSection>
                )}
                {isLoading && (
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <InlineSpinner /> Сохранение...
                    </div>
                )}
            </SlotSettingsContent>
        </SlotSettingsContainer>
    );
};

const SlotSettings = forwardRef(SlotSettingsComponent);

SlotSettings.displayName = 'SlotSettings';

export default SlotSettings; 