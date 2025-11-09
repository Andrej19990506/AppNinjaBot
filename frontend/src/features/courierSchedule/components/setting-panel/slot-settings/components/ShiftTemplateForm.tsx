import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { ShiftTemplate, ShiftTemplateCreatePayload, ShiftTemplateUpdatePayload } from '@features/courierSchedule/types/courierScheduleTypes';

// === СОВРЕМЕННЫЕ ЧИСТЫЕ СТИЛИ ===

const FormContainer = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--card-background);
    overflow: hidden;
`;

const FormHeader = styled.div`
    padding: 24px 28px;
    border-bottom: 1px solid rgba(255, 95, 31, 0.1);
    background: linear-gradient(135deg, rgba(255, 95, 31, 0.03), transparent);
`;

const FormTitle = styled.h2`
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
    
    svg {
        width: 24px;
        height: 24px;
        color: var(--primary-color);
    }
`;

const FormSubtitle = styled.p`
    margin: 6px 0 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 400;
`;

const FormContent = styled.form`
    flex: 1;
    overflow-y: auto;
    padding: 28px;
    padding-bottom: 100px; /* Отступ от футера */
    
    /* Кастомный скроллбар */
    &::-webkit-scrollbar {
        width: 8px;
    }
    
    &::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 95, 31, 0.3);
        border-radius: 4px;
        
        &:hover {
            background: rgba(255, 95, 31, 0.5);
        }
    }
`;

const Section = styled.div`
    margin-bottom: 28px;
    
    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionTitle = styled.h3`
    margin: 0 0 16px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &::before {
        content: '';
        width: 3px;
        height: 16px;
        background: var(--primary-color);
        border-radius: 2px;
    }
`;

const Field = styled.div`
    margin-bottom: 20px;
`;

const Label = styled.label`
    display: block;
    margin-bottom: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary);
    
    span {
        color: var(--danger-color);
        margin-left: 2px;
    }
`;

const Input = styled.input<{ $hasError?: boolean }>`
    width: 100%;
    padding: 12px 16px;
    border: 1px solid ${props => props.$hasError ? 'var(--danger-color)' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 8px;
    font-size: 1rem;
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.03);
    transition: all 0.2s ease;
    
    &::placeholder {
        color: var(--text-secondary);
        opacity: 0.6;
    }
    
    &:focus {
        outline: none;
        border-color: var(--primary-color);
        background: rgba(255, 255, 255, 0.05);
        box-shadow: 0 0 0 3px rgba(255, 95, 31, 0.1);
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const TimeRow = styled.div`
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    align-items: center;
`;

const TimeInput = styled(Input)`
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    text-align: center;
    letter-spacing: 1px;
`;

const TimeSeparator = styled.div`
    font-size: 1.2rem;
    color: var(--text-secondary);
    font-weight: 300;
    user-select: none;
`;

const SlotCounter = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 95, 31, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 95, 31, 0.1);
`;

const SlotButton = styled.button`
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gradient-primary);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1.4rem;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(255, 95, 31, 0.3);
    }
    
    &:active:not(:disabled) {
        transform: scale(0.95);
    }
    
    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const SlotValue = styled.div`
    flex: 1;
    text-align: center;
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary-color);
    font-variant-numeric: tabular-nums;
`;

const DaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
`;

const DayCard = styled.label<{ $checked: boolean }>`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: ${props => props.$checked ? 'rgba(255, 95, 31, 0.1)' : 'rgba(255, 255, 255, 0.03)'};
    border: 1px solid ${props => props.$checked ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    
    &:hover {
        background: ${props => props.$checked ? 'rgba(255, 95, 31, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
        border-color: ${props => props.$checked ? 'var(--primary-color)' : 'rgba(255, 95, 31, 0.3)'};
    }
`;

const DayCheckbox = styled.input`
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: var(--primary-color);
`;

const DayLabel = styled.span`
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
`;

const CheckboxRow = styled.label`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    
    &:hover {
        background: rgba(255, 255, 255, 0.05);
    }
`;

const Checkbox = styled.input`
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: var(--primary-color);
`;

const CheckboxLabelText = styled.span`
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-primary);
`;

const ErrorMessage = styled.div`
    margin-top: 6px;
    padding: 8px 12px;
    background: rgba(231, 76, 60, 0.1);
    border-left: 3px solid var(--danger-color);
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--danger-color);
    display: flex;
    align-items: center;
    gap: 8px;
    
    &::before {
        content: '⚠️';
        font-size: 1rem;
    }
`;

// === ИКОНКИ ===
const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const IconEdit = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);

// === ИНТЕРФЕЙС ===
interface ShiftTemplateFormProps {
    template?: ShiftTemplate | null;
    onSubmit: (data: ShiftTemplateCreatePayload | ShiftTemplateUpdatePayload) => void;
    onCancel: () => void;
    isLoading?: boolean;
    currentDayIndex?: number;
    formId?: string;
}

const ShiftTemplateForm: React.FC<ShiftTemplateFormProps> = ({
    template,
    onSubmit,
    onCancel,
    isLoading = false,
    currentDayIndex = 0,
    formId = 'shift-template-form'
}) => {
    const isEditing = !!template;
    
    const [formData, setFormData] = useState({
        name: '',
        startTime: '10:00',
        endTime: '18:00',
        maxSlots: 1,
        hasSeniorSlot: false,
        isActive: true,
        daysOfWeek: [currentDayIndex]
    });
    
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (template) {
            setFormData({
                name: template.name,
                startTime: template.startTime,
                endTime: template.endTime,
                maxSlots: template.maxSlots,
                hasSeniorSlot: template.hasSeniorSlot,
                isActive: template.isActive,
                daysOfWeek: template.daysOfWeek || [currentDayIndex]
            });
        }
    }, [template, currentDayIndex]);

    const validateForm = useCallback(() => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name.trim()) {
            newErrors.name = 'Название шаблона обязательно';
        }
        
        if (!formData.startTime) {
            newErrors.startTime = 'Время начала обязательно';
        }
        
        if (!formData.endTime) {
            newErrors.endTime = 'Время окончания обязательно';
        }
        
        if (formData.startTime && formData.endTime) {
            const start = new Date(`2000-01-01 ${formData.startTime}`);
            const end = new Date(`2000-01-01 ${formData.endTime}`);
            
            if (start >= end) {
                newErrors.endTime = 'Время окончания должно быть позже времени начала';
            }
        }
        
        if (formData.maxSlots < 1 || formData.maxSlots > 20) {
            newErrors.maxSlots = 'Количество слотов должно быть от 1 до 20';
        }
        
        if (!formData.daysOfWeek || formData.daysOfWeek.length === 0) {
            newErrors.daysOfWeek = 'Выберите хотя бы один день недели';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        if (isEditing && template) {
            const updateData: ShiftTemplateUpdatePayload = {
                id: template.id,
                name: formData.name,
                startTime: formData.startTime,
                endTime: formData.endTime,
                maxSlots: formData.maxSlots,
                hasSeniorSlot: formData.hasSeniorSlot,
                isActive: formData.isActive,
                daysOfWeek: formData.daysOfWeek
            };
            onSubmit(updateData);
        } else {
            const createData: ShiftTemplateCreatePayload = {
                name: formData.name,
                startTime: formData.startTime,
                endTime: formData.endTime,
                maxSlots: formData.maxSlots,
                hasSeniorSlot: formData.hasSeniorSlot,
                daysOfWeek: formData.daysOfWeek
            };
            onSubmit(createData);
        }
    }, [isEditing, template, formData, validateForm, onSubmit]);

    const handleSlotCountChange = (delta: number) => {
        setFormData(prev => ({
            ...prev,
            maxSlots: Math.max(1, Math.min(20, prev.maxSlots + delta))
        }));
    };

    const toggleDay = (dayIndex: number) => {
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(dayIndex)
                ? prev.daysOfWeek.filter(d => d !== dayIndex)
                : [...prev.daysOfWeek, dayIndex]
        }));
    };

    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    return (
        <FormContainer>
            <FormHeader>
                <FormTitle>
                    {isEditing ? <IconEdit /> : <IconPlus />}
                    {isEditing ? 'Редактировать шаблон' : 'Создать шаблон'}
                </FormTitle>
                <FormSubtitle>
                    {isEditing 
                        ? 'Измените параметры существующего шаблона смены' 
                        : 'Настройте параметры для нового шаблона смены'
                    }
                </FormSubtitle>
            </FormHeader>
            
            <FormContent id={formId} onSubmit={handleSubmit}>
                <Section>
                    <SectionTitle>Основная информация</SectionTitle>
                    
                    <Field>
                        <Label>
                            Название шаблона<span>*</span>
                        </Label>
                        <Input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Например: Дневная смена"
                            $hasError={!!errors.name}
                            disabled={isLoading}
                        />
                        {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
                    </Field>
                    
                    <Field>
                        <Label>
                            Время работы<span>*</span>
                        </Label>
                        <TimeRow>
                            <TimeInput
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                $hasError={!!errors.startTime}
                                disabled={isLoading}
                            />
                            <TimeSeparator>—</TimeSeparator>
                            <TimeInput
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                $hasError={!!errors.endTime}
                                disabled={isLoading}
                            />
                        </TimeRow>
                        {(errors.startTime || errors.endTime) && (
                            <ErrorMessage>{errors.startTime || errors.endTime}</ErrorMessage>
                        )}
                    </Field>
                </Section>

                <Section>
                    <SectionTitle>Настройки слотов</SectionTitle>
                    
                    <Field>
                        <Label>Количество слотов</Label>
                        <SlotCounter>
                            <SlotButton
                                type="button"
                                onClick={() => handleSlotCountChange(-1)}
                                disabled={isLoading || formData.maxSlots <= 1}
                            >
                                −
                            </SlotButton>
                            <SlotValue>{formData.maxSlots}</SlotValue>
                            <SlotButton
                                type="button"
                                onClick={() => handleSlotCountChange(1)}
                                disabled={isLoading || formData.maxSlots >= 20}
                            >
                                +
                            </SlotButton>
                        </SlotCounter>
                        {errors.maxSlots && <ErrorMessage>{errors.maxSlots}</ErrorMessage>}
                    </Field>
                    
                    <CheckboxRow>
                        <Checkbox
                            type="checkbox"
                            id="hasSeniorSlot"
                            checked={formData.hasSeniorSlot}
                            onChange={(e) => setFormData(prev => ({ ...prev, hasSeniorSlot: e.target.checked }))}
                            disabled={isLoading}
                        />
                        <CheckboxLabelText>
                            Включить слот для старшего курьера
                        </CheckboxLabelText>
                    </CheckboxRow>
                </Section>

                <Section>
                    <SectionTitle>Дни недели<span style={{ color: 'var(--danger-color)', marginLeft: '4px' }}>*</span></SectionTitle>
                    <DaysGrid>
                        {dayNames.map((dayName, index) => (
                            <DayCard 
                                key={index} 
                                $checked={formData.daysOfWeek.includes(index)}
                            >
                                <DayCheckbox
                                    type="checkbox"
                                    checked={formData.daysOfWeek.includes(index)}
                                    onChange={() => toggleDay(index)}
                                    disabled={isLoading}
                                />
                                <DayLabel>{dayName}</DayLabel>
                            </DayCard>
                        ))}
                    </DaysGrid>
                    {errors.daysOfWeek && <ErrorMessage>{errors.daysOfWeek}</ErrorMessage>}
                </Section>

                {isEditing && (
                    <Section>
                        <CheckboxRow>
                            <Checkbox
                                type="checkbox"
                                id="isActive"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                disabled={isLoading}
                            />
                            <CheckboxLabelText>
                                Шаблон активен
                            </CheckboxLabelText>
                        </CheckboxRow>
                    </Section>
                )}
            </FormContent>
        </FormContainer>
    );
};

export default ShiftTemplateForm;
