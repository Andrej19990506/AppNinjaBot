import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch } from '../../../../../store/store';
import { 
    SlotSettingsContainer, 
    SlotSettingsHeader, 
    SlotSettingsTitle, 
    SlotSettingsContent
} from '../../styles';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import {
    selectSlotConfigForDay,
    updateSlotConfigLocal,
    selectSlotConfig,
    defaultSingleDaySlotConfig
} from '../../../../../store/slices/shiftsSlice';
import {
    updateSlotConfig,
    SlotConfigUpdatePayload
} from '../../../../../services/courierApi';
import { logger } from '../../../../../utils/logger';

// Styled components for the settings content
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

// --- Стили для сообщений и спиннера ---
// const MessageContainer = styled.div`
//     padding: 20px;
//     text-align: center;
//     color: var(--text-secondary);
//     min-height: 150px; 
//     display: flex;
//     flex-direction: column;
//     justify-content: center;
//     align-items: center;
// `;

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

// --- Анимации --- 

// Keyframes для анимации галочки (круг и путь)
const stroke = keyframes`
  100% {
    stroke-dashoffset: 0;
  }
`;

// Keyframes для небольшого "пульсирования" круга после отрисовки
const scale = keyframes`
  0%, 100% {
    transform: none;
  }
  50% {
    transform: scale3d(1.05, 1.05, 1); // Меньше масштаб
  }
`;

// Keyframes для заливки КРУГА цветом
const fillCircle = keyframes`
  100% {
    fill: var(--success-color); // Заливаем круг
  }
`;

// Keyframes для появления контейнера
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

// --- Стили для галочки --- 
const AnimatedCheckmarkWrapper = styled.div`
  width: 60px; // Можно чуть меньше
  height: 60px;
  margin-bottom: 20px;

  .checkmark__circle {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    stroke-width: 2;
    stroke-miterlimit: 10;
    stroke: var(--success-color); 
    fill: none; // Изначально нет заливки
    /* Анимация: сначала рисуем контур, потом заливаем круг, потом пульсация */
    animation: 
      ${stroke} 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards, 
      ${fillCircle} 0.4s ease-in-out 0.4s forwards, 
      ${scale} 0.3s ease-in-out 0.9s both;
  }

  .checkmark {
    width: 100%;
    height: 100%;
    display: block; 
    /* Убираем border-radius и box-shadow отсюда, они теперь не нужны для заливки */
  }

  .checkmark__check {
    transform-origin: 50% 50%;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    stroke-width: 3; // Можно оставить или 2
    stroke: #fff; // Белая галочка поверх зеленого круга
    fill: none; // Галочка без заливки
    /* Анимация: рисуем галочку после заливки круга */
    animation: ${stroke} 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
  }
`;

// Компонент для анимированной галочки
const AnimatedCheckmark = () => (
    <AnimatedCheckmarkWrapper>
        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
    </AnimatedCheckmarkWrapper>
);

// --- Обновленные стили для успеха --- 
const SuccessMessageContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    min-height: 250px; // Немного увеличим высоту под анимацию
    animation: ${fadeInScaleUp} 0.5s ease-out forwards; // Добавляем анимацию появления
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

// Добавляем стили для селекта дня
const DaySelect = styled.select`
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background-color: var(--background-color);
    color: var(--text-color);
    font-size: 0.95rem;
    cursor: pointer;
    /* Ограничиваем ширину, чтобы не растягивался сильно */
    max-width: 180px; 
    flex-shrink: 0; /* Предотвращаем сжатие */

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px var(--primary-transparent);
    }
`;

// Интерфейс для рефа
export interface SlotSettingsRef {
    triggerSave: () => Promise<boolean>;
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
}

// Используем React.ForwardRefRenderFunction для явного типизирования
// Убираем явную аннотацию типа возвращаемого значения
const SlotSettingsComponent: React.ForwardRefRenderFunction<SlotSettingsRef, ISlotSettingsProps> = ({ 
    isOpen, 
    onClose, 
    chatId, 
    dayIndex,
    onDayChangeRequest
}, ref) => {
    const dispatch = useDispatch<AppDispatch>();
    const containerRef = useRef<HTMLDivElement>(null);

    // Получаем КОНКРЕТНУЮ конфигурацию для выбранного дня
    const initialDayConfig = useSelector(selectSlotConfigForDay(dayIndex));
    
    // Получаем ВСЮ конфигурацию
    const fullSlotConfig = useSelector(selectSlotConfig);

    // Используем импортированные дефолты как fallback
    const [daySlots, setDaySlots] = useState<number>(
        initialDayConfig?.maxDaySlots ?? defaultSingleDaySlotConfig.maxDaySlots
    );
    const [nightSlots, setNightSlots] = useState<number>(
        initialDayConfig?.maxNightSlots ?? defaultSingleDaySlotConfig.maxNightSlots
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const dayOfWeekNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

    useEffect(() => {
        if (isOpen) {
            logger.log(`[SlotSettings] Syncing state for day ${dayIndex}:`, initialDayConfig);
            // Используем импортированные дефолты как fallback
            setDaySlots(initialDayConfig?.maxDaySlots ?? defaultSingleDaySlotConfig.maxDaySlots);
            setNightSlots(initialDayConfig?.maxNightSlots ?? defaultSingleDaySlotConfig.maxNightSlots);
            setIsDirty(false);
            setIsSuccess(false);
            setIsLoading(false);
        }
    }, [isOpen, dayIndex, initialDayConfig]);

    useEffect(() => {
        if (!isOpen) {
            setIsDirty(false);
            return;
        }
        const initialDay = initialDayConfig?.maxDaySlots ?? 0;
        const initialNight = initialDayConfig?.maxNightSlots ?? 0;
        const dirty = daySlots !== initialDay || nightSlots !== initialNight;
        setIsDirty(dirty);
    }, [isOpen, daySlots, nightSlots, initialDayConfig]);

    // --- Обработчик изменения дня в селекте --- 
    const handleDayChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newDayIndex = parseInt(event.target.value, 10);
        logger.log(`[SlotSettings] Day selected in dropdown: ${newDayIndex}`);
        // Вызываем колбэк родителя, чтобы он переключил панель
        onDayChangeRequest(newDayIndex);
    };
    // --- ------------------------------------ ---

    // Функции изменения слотов с явным указанием типа для prev
    const handleDecreaseDaySlots = () => setDaySlots((prev: number) => Math.max(prev - 1, 0));
    const handleIncreaseDaySlots = () => setDaySlots((prev: number) => Math.min(prev + 1, 20)); 
    const handleDecreaseNightSlots = () => setNightSlots((prev: number) => Math.max(prev - 1, 0));
    const handleIncreaseNightSlots = () => setNightSlots((prev: number) => Math.min(prev + 1, 20));

    // Функция сохранения (вызывается через ref)
    const handleSave = async (): Promise<boolean> => {
        if (chatId === undefined) {
            logger.error("[SlotSettings] Chat ID became undefined before API call.");
            setIsLoading(false);
            return false;
        }
        if (!isDirty) {
            logger.warn("[SlotSettings] No changes, skipping save.");
            return true;
        }

        setIsLoading(true);
        setIsSuccess(false);

        const currentFullConfig = { ...(fullSlotConfig || {}) }; 
        // Используем dayIndex (number) напрямую как ключ
        currentFullConfig[dayIndex] = { maxDaySlots: daySlots, maxNightSlots: nightSlots };
        
        const slotConfigPayload: SlotConfigUpdatePayload = {
            config: currentFullConfig
        };
        
        // Убедимся, что chatId это number перед вызовом API
        if (typeof chatId !== 'number') {
            logger.error(`[SlotSettings] Invalid chatId type: ${typeof chatId}`);
            setIsLoading(false);
            return false;
        }

        logger.log(`[SlotSettings] Calling updateSlotConfig for chatId ${chatId}:`, slotConfigPayload);

        try {
            // Теперь chatId точно number
            await updateSlotConfig(chatId, slotConfigPayload);
            
            dispatch(updateSlotConfigLocal({
                 dayIndex: Number(dayIndex), 
                 maxDaySlots: daySlots, 
                 maxNightSlots: nightSlots
            }));
            
            logger.log("[SlotSettings] Save successful.");
            setIsSuccess(true);
            setIsLoading(false);
            setIsDirty(false);
            
            setTimeout(() => {
                setIsSuccess(false);
                onClose(); 
            }, 1800);
            return true;
        } catch (error) {
            logger.error("[SlotSettings] Error saving:", error);
            setIsLoading(false);
            return false;
        }
    };
    
    // Функция сброса (вызывается через ref)
    const handleReset = useCallback(() => {
        logger.log("[SlotSettings] Resetting changes.");
        setDaySlots(initialDayConfig?.maxDaySlots ?? 0);
        setNightSlots(initialDayConfig?.maxNightSlots ?? 0);
        setIsDirty(false);
        setIsLoading(false);
        setIsSuccess(false);
    }, [initialDayConfig]);

    // Функция валидации (вызывается через ref)
    const handleIsValid = useCallback((): boolean => {
        return true;
    }, []);

    // Передача функций через ref
    useImperativeHandle(ref, () => ({
        triggerSave: handleSave,
        triggerReset: handleReset,
        isDirty: isDirty,
        isValid: handleIsValid
    }));

    // Возвращаем JSX
    return (
        <SlotSettingsContainer ref={containerRef} $isOpen={isOpen}>
            <SlotSettingsHeader>
                <SlotSettingsTitle>Настройка слотов</SlotSettingsTitle>
                <DaySelect value={dayIndex} onChange={handleDayChange}>
                    {dayOfWeekNames.map((name, index) => (
                        <option key={index} value={index}>
                            {name}
                        </option>
                    ))}
                </DaySelect>
            </SlotSettingsHeader>
            
            <SlotSettingsContent>
                {isSuccess ? (
                    <SuccessMessageContainer>
                        <AnimatedCheckmark />
                        <SuccessText>Настройки сохранены!</SuccessText>
                        <OkButton onClick={onClose}>OK</OkButton>
                    </SuccessMessageContainer>
                ) : (
                    <SettingsSection>
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
                        {isLoading && (
                            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                <InlineSpinner /> Сохранение...
                            </div>
                        )}
                    </SettingsSection>
                )}
            </SlotSettingsContent>
        </SlotSettingsContainer>
    );
};

// Оборачиваем компонент в forwardRef и экспортируем
const SlotSettings = forwardRef(SlotSettingsComponent);

// Добавляем displayName для удобства отладки
SlotSettings.displayName = 'SlotSettings';

export default SlotSettings; 