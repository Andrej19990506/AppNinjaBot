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
    defaultSingleDaySlotConfig,
    setLocalAppliedTemplates
} from '@features/courierSchedule/store/shiftsSlice/shiftsSlice';
import {
    updateSlotConfig} from '@features/courierSchedule/services/courierApi';
import { addNotification} from '@shared/store/notificationSlice/notificationSlice';
import { selectSlotConfig, selectSlotConfigForDay } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { 
    SlotConfigUpdatePayload, 
    ShiftTemplate, 
    ShiftTemplateCreatePayload,
    ShiftTemplateUpdatePayload,
    ShiftTemplateApplyPayload
} from '@features/courierSchedule/types/courierScheduleTypes';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
import { SlotConfigForDay } from '@features/courierSchedule/types/courierScheduleTypes';
import ShiftTemplateSelector from './components/ShiftTemplateSelector';
import ShiftTemplateForm from './components/ShiftTemplateForm';
import { 
    selectShiftTemplates, 
    selectShiftTemplatesLoading, 
    selectShiftTemplatesError 
} from '@features/courierSchedule/store/shiftsSlice/shiftTemplatesSelectors';
import {
    fetchShiftTemplatesThunk,
    fetchAllShiftTemplatesThunk,
    createShiftTemplateThunk,
    updateShiftTemplateThunk,
    deleteShiftTemplateThunk,
    applyShiftTemplatesThunk
} from '@features/courierSchedule/store/shiftsSlice/shiftTemplatesThunks';


const FullHeightContent = styled(SlotSettingsContent)`
    height: 100%;
    display: flex;
    flex-direction: column;
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

const DaysSelectorContainer = styled.div`
    display: flex;
    gap: 8px;
    justify-content: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--card-background);
    flex-shrink: 0;
`;

const DaySelectorTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
    text-align: center;
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

export interface ShiftTemplateSettingsRef {
    triggerSave: () => Promise<void>;
    triggerReset: () => void;
    isDirty: boolean;
    isValid: () => boolean;
}

interface IShiftTemplateSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: number;
    dayIndex: number;
    onDayChangeRequest: (newDayIndex: number) => void;
    onDirtyChange: (isDirty: boolean) => void;
}

const ShiftTemplateSettingsComponent: React.ForwardRefRenderFunction<ShiftTemplateSettingsRef, IShiftTemplateSettingsProps> = ({ 
    isOpen, 
    onClose, 
    chatId, 
    dayIndex,
    onDayChangeRequest,
    onDirtyChange
}, ref) => {
    const dispatch = useDispatch<AppDispatch>();

    const fullSlotConfig = useSelector(selectSlotConfig);
    
    // Получаем конфигурацию для текущего дня
    const dayConfig = useSelector(selectSlotConfigForDay(dayIndex));

    // Redux селекторы для шаблонов смен
    const templates = useSelector(selectShiftTemplates);
    const templatesLoading = useSelector(selectShiftTemplatesLoading);
    const templatesError = useSelector(selectShiftTemplatesError);
    const localAppliedTemplates = useSelector((state: any) => state.shifts.localAppliedTemplates);

    // Локальное состояние
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const dayOfWeekNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const dayShortNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    // Загрузка шаблонов с сервера
    useEffect(() => {
        if (isOpen && chatId) {
            dispatch(fetchShiftTemplatesThunk(chatId));
        }
    }, [isOpen, chatId, dispatch]);

    // Проверка изменений
    const isDirty = useMemo(() => {
        // Если открыта форма шаблона - всегда считаем что есть изменения (чтобы галочка была активной)
        if (showTemplateForm) {
            return true;
        }
        
        const originalAppliedIds = dayConfig.shiftTemplates?.map(template => template.id) || [];
        const currentAppliedIds = localAppliedTemplates[dayIndex] || [];
        const hasChanges = JSON.stringify([...originalAppliedIds].sort()) !== JSON.stringify([...currentAppliedIds].sort());
        return hasChanges;
    }, [showTemplateForm, localAppliedTemplates, dayIndex, dayConfig.shiftTemplates]);

    const prevIsDirtyRef = useRef<boolean>();
    useEffect(() => {
        if (prevIsDirtyRef.current !== isDirty) {
            onDirtyChange(isDirty);
            prevIsDirtyRef.current = isDirty;
        }
    }, [isDirty, onDirtyChange]);

    const handleDayIndicatorClick = (newDayIndex: number) => {
        if (newDayIndex !== dayIndex) {
            onDayChangeRequest(newDayIndex);
        }
    };

    const handleTemplateCreate = useCallback(() => {
        setEditingTemplate(null);
        setShowTemplateForm(true);
    }, []);

    const handleTemplateEdit = useCallback((template: ShiftTemplate) => {
        setEditingTemplate(template);
        setShowTemplateForm(true);
    }, []);

    const handleTemplateDelete = useCallback(async (templateId: string) => {
        if (!chatId) return;
        
        try {
            await dispatch(deleteShiftTemplateThunk(templateId)).unwrap();
            
            // Обновляем список шаблонов после удаления
            await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка удаления шаблона: ${error.message || error}`,
                duration: 5000
            }));
        }
    }, [dispatch, chatId]);

    const handleTemplateUnapply = useCallback(async (templateId: string) => {
        // Переключаем локальное состояние применения шаблона в Redux
        const currentApplied = localAppliedTemplates[dayIndex] || [];
        const isCurrentlyApplied = currentApplied.includes(templateId);
        
        const newAppliedTemplates = isCurrentlyApplied 
            ? currentApplied.filter((id: string) => id !== templateId)
            : [...currentApplied, templateId];
            
        dispatch(setLocalAppliedTemplates({ 
            dayOfWeek: dayIndex, 
            templateIds: newAppliedTemplates 
        }));
    }, [dispatch, dayIndex, localAppliedTemplates]);

    const handleTemplateSubmit = useCallback(async (data: ShiftTemplateCreatePayload | ShiftTemplateUpdatePayload) => {
        if (!chatId) return;

        try {
            if ('id' in data) {
                // Обновление существующего шаблона
                await dispatch(updateShiftTemplateThunk({ templateId: data.id, templateData: data })).unwrap();
            } else {
                // Создание нового шаблона
                await dispatch(createShiftTemplateThunk({ chatId, templateData: data })).unwrap();
            }
            
            // Обновляем список шаблонов после создания/обновления
            await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
            
            setShowTemplateForm(false);
            setEditingTemplate(null);
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка сохранения шаблона: ${error.message || error}`,
                duration: 5000
            }));
        }
    }, [chatId, dispatch]);

    const handleTemplateFormCancel = useCallback(() => {
        setShowTemplateForm(false);
        setEditingTemplate(null);
    }, []);

    const handleSave = useCallback(async (): Promise<void> => {
        // Если открыта форма создания/редактирования шаблона, submit её
        if (showTemplateForm) {
            const form = document.getElementById('shift-template-form') as HTMLFormElement;
            if (form) {
                form.requestSubmit();
            }
            return;
        }
        
        // Иначе обычное сохранение применения шаблонов к дню
        if (!isDirty || !chatId) {
            return;
        }

        setIsLoading(true);
        setShowSuccess(false);
        
        try {
            // Применяем локально измененные шаблоны к текущему дню
            await dispatch(applyShiftTemplatesThunk({
                chatId,
                applyData: {
                    dayOfWeek: dayIndex,
                    templateIds: localAppliedTemplates[dayIndex] || []
                }
            })).unwrap();
            
            setShowSuccess(true);
            setIsLoading(false); 
            
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка сохранения шаблонов смен: ${error.message || error}`,
                duration: 5000
            }));
            setIsLoading(false);
        }
    }, [showTemplateForm, isDirty, chatId, dayIndex, selectedTemplateIds, dispatch]);
    
    const handleReset = useCallback(() => {
        setSelectedTemplateIds([]);
        setIsLoading(false);
        setShowSuccess(false);
    }, []);

    useImperativeHandle(ref, () => ({
        triggerSave: handleSave,
        triggerReset: handleReset,
        isDirty,
        isValid: () => true
    }), [handleSave, handleReset, isDirty]);

    if (showSuccess) {
        return (
            <SlotSettingsContainer $isOpen={isOpen}>
                <SlotSettingsHeader>
                    <SlotSettingsTitle>Шаблоны смен</SlotSettingsTitle>
                </SlotSettingsHeader>
                <SlotSettingsContent>
                    <SuccessMessageContainer>
                        <AnimatedCheckmark />
                        <SuccessText>Шаблоны смен сохранены!</SuccessText>
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
            <FullHeightContent>
                {/* Селектор дня недели - показываем только когда НЕ открыта форма */}
                {!showTemplateForm && (
                    <DaysSelectorContainer>
                        <div style={{ width: '100%' }}>
                            <DaySelectorTitle>Шаблоны на: {dayOfWeekNames[dayIndex]}</DaySelectorTitle>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                {dayShortNames.map((dayName, index) => (
                                    <DayIndicator
                                        key={index}
                                        $isActive={index === dayIndex}
                                        $isModified={false}
                                        $clickable={true}
                                        onClick={() => handleDayIndicatorClick(index)}
                                        title={dayOfWeekNames[index]}
                                    >
                                        {dayName}
                                    </DayIndicator>
                                ))}
                            </div>
                        </div>
                    </DaysSelectorContainer>
                )}

                {showTemplateForm ? (
                    <ShiftTemplateForm
                        template={editingTemplate}
                        onSubmit={handleTemplateSubmit}
                        onCancel={handleTemplateFormCancel}
                        isLoading={isLoading || templatesLoading}
                        currentDayIndex={dayIndex}
                        formId="shift-template-form"
                    />
                ) : (
                    <ShiftTemplateSelector
                            templates={templates.filter(template => {
                                // Показываем шаблоны только если:
                                // 1. У шаблона есть дни недели И текущий день входит в список
                                // 2. Если у шаблона нет дней недели (пустой массив), не показываем его
                                const hasDaysOfWeek = template.daysOfWeek && template.daysOfWeek.length > 0;
                                const shouldShow = hasDaysOfWeek && template.daysOfWeek.includes(dayIndex);
                                return shouldShow;
                            })}
                        selectedTemplateIds={selectedTemplateIds}
                        onTemplateSelect={setSelectedTemplateIds}
                        onTemplateEdit={handleTemplateEdit}
                        onTemplateDelete={handleTemplateDelete}
                        onTemplateCreate={handleTemplateCreate}
                        onTemplateUnapply={handleTemplateUnapply}
                        isLoading={isLoading || templatesLoading}
                        appliedTemplates={(() => {
                            // Создаем локальный массив примененных шаблонов на основе Redux состояния
                            const currentAppliedIds = localAppliedTemplates[dayIndex] || [];
                            return templates.filter(template => 
                                currentAppliedIds.includes(template.id) && 
                                template.daysOfWeek && 
                                template.daysOfWeek.includes(dayIndex)
                            );
                        })()}
                    />
                )}

                {(isLoading || templatesLoading) && (
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <InlineSpinner /> {templatesLoading ? 'Загрузка...' : 'Сохранение...'}
                    </div>
                )}
                
                {templatesError && (
                    <div style={{ 
                        textAlign: 'center', 
                        marginTop: '10px', 
                        color: 'var(--danger-color)',
                        padding: '10px',
                        backgroundColor: 'var(--danger-transparent)',
                        borderRadius: 'var(--radius-sm)'
                    }}>
                        Ошибка: {templatesError}
                    </div>
                )}
            </FullHeightContent>
        </SlotSettingsContainer>
    );
};

const ShiftTemplateSettings = forwardRef(ShiftTemplateSettingsComponent);

ShiftTemplateSettings.displayName = 'ShiftTemplateSettings';

export default ShiftTemplateSettings;
