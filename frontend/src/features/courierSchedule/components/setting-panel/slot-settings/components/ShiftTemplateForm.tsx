import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { ShiftTemplate, ShiftTemplateCreatePayload, ShiftTemplateUpdatePayload, FutureVersionInfo } from '@features/courierSchedule/types/courierScheduleTypes';

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

// === ТАБЫ ДНЕЙ НЕДЕЛИ ===

const DayTabsContainer = styled.div`
    padding: 16px 28px;
    border-bottom: 1px solid rgba(255, 95, 31, 0.1);
    background: rgba(255, 255, 255, 0.02);
`;

const DayTabsWrapper = styled.div`
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 0;
    
    /* Скроллбар */
    &::-webkit-scrollbar {
        height: 4px;
    }
    
    &::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 2px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 95, 31, 0.3);
        border-radius: 2px;
    }
`;

const DayTab = styled.button<{ $active: boolean; $filled: boolean }>`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: 1.5px solid ${props => props.$active 
        ? 'var(--primary-color)' 
        : props.$filled 
            ? 'rgba(255, 95, 31, 0.3)' 
            : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 8px;
    background: ${props => props.$active 
        ? 'linear-gradient(135deg, rgba(255, 95, 31, 0.15), rgba(255, 95, 31, 0.08))' 
        : props.$filled
            ? 'rgba(255, 95, 31, 0.05)'
            : 'rgba(255, 255, 255, 0.03)'};
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    
    &:hover {
        background: ${props => props.$active 
            ? 'linear-gradient(135deg, rgba(255, 95, 31, 0.2), rgba(255, 95, 31, 0.1))' 
            : 'rgba(255, 95, 31, 0.08)'};
        border-color: var(--primary-color);
        transform: translateY(-2px);
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const DayTabName = styled.span<{ $active: boolean }>`
    font-size: 0.85rem;
    font-weight: ${props => props.$active ? '600' : '500'};
    color: ${props => props.$active ? 'var(--primary-color)' : 'var(--text-primary)'};
`;

const DayTabIndicator = styled.div<{ $visible: boolean }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${props => props.$visible ? 'var(--primary-color)' : 'transparent'};
    transition: all 0.2s ease;
`;

const ExistingTemplatesInfo = styled.div`
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
`;

const ExistingTemplatesTitle = styled.div`
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    
    svg {
        width: 14px;
        height: 14px;
        color: var(--primary-color);
    }
`;

const ExistingTemplatesList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const ExistingTemplateItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(255, 95, 31, 0.05);
    border-radius: 4px;
    font-size: 0.8rem;
`;

const ExistingTemplateIcon = styled.div`
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 95, 31, 0.1);
    border-radius: 4px;
    flex-shrink: 0;
    
    svg {
        width: 12px;
        height: 12px;
        color: var(--primary-color);
    }
`;

const ExistingTemplateName = styled.div`
    flex: 1;
    color: var(--text-primary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ExistingTemplateDetails = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 0.75rem;
    flex-shrink: 0;
`;

const ExistingTemplateTime = styled.span`
    display: flex;
    align-items: center;
    gap: 3px;
    
    svg {
        width: 11px;
        height: 11px;
    }
`;

const ExistingTemplateSlots = styled.span`
    display: flex;
    align-items: center;
    gap: 3px;
    
    svg {
        width: 11px;
        height: 11px;
    }
`;

const NoTemplatesMessage = styled.div`
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-style: italic;
    padding: 6px 8px;
    text-align: center;
`;

const SmartHintBanner = styled.div`
    margin: 16px 0;
    padding: 12px 14px;
    background: linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 193, 7, 0.08));
    border: 1.5px solid rgba(255, 193, 7, 0.4);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 0.3s ease;
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const SmartHintIcon = styled.div`
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 193, 7, 0.2);
    border-radius: 5px;
    flex-shrink: 0;
    font-size: 1.1rem;
`;

const SmartHintContent = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
`;

const SmartHintTitle = styled.div`
    font-size: 0.85rem;
    font-weight: 600;
    color: rgb(255, 193, 7);
`;

const SmartHintText = styled.div`
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--text-primary);
    
    strong {
        color: var(--primary-color);
        font-weight: 600;
    }
`;

const SmartHintButton = styled.button`
    padding: 7px 14px;
    background: rgba(255, 193, 7, 0.2);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 5px;
    color: rgb(255, 193, 7);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-end;
    
    &:hover {
        background: rgba(255, 193, 7, 0.3);
        border-color: rgba(255, 193, 7, 0.5);
    }
`;

const QuickCreateSection = styled.div`
    margin-top: 20px;
    padding: 16px;
    background: rgba(255, 95, 31, 0.03);
    border: 1px dashed rgba(255, 95, 31, 0.2);
    border-radius: 10px;
`;

const QuickCreateButton = styled.button<{ $isPulsing?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 95, 31, 0.08);
    border: 1.5px dashed rgba(255, 95, 31, 0.3);
    border-radius: 8px;
    color: var(--primary-color);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    ${props => props.$isPulsing && `
        animation: pulseGlow 2s ease-in-out infinite;
        
        @keyframes pulseGlow {
            0%, 100% {
                background: rgba(255, 95, 31, 0.08);
                border-color: rgba(255, 95, 31, 0.3);
                box-shadow: 0 0 0 0 rgba(255, 95, 31, 0.4);
            }
            50% {
                background: rgba(255, 95, 31, 0.15);
                border-color: rgba(255, 95, 31, 0.6);
                box-shadow: 0 0 0 8px rgba(255, 95, 31, 0);
            }
        }
    `}
    
    svg {
        width: 20px;
        height: 20px;
    }
    
    &:hover {
        background: rgba(255, 95, 31, 0.12);
        border-color: var(--primary-color);
        border-style: solid;
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const QuickCreateHint = styled.div`
    margin-top: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-secondary);
    text-align: center;
    
    strong {
        color: var(--primary-color);
        font-weight: 600;
    }
`;

const BulkApplyExpanded = styled.div`
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border: 1px solid rgba(255, 95, 31, 0.2);
`;

const BulkApplyTitle = styled.div`
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    
    svg {
        width: 18px;
        height: 18px;
        color: var(--primary-color);
    }
`;

const BulkApplyGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
`;

const BulkApplyDayCard = styled.label<{ $checked: boolean; $disabled: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: ${props => props.$checked ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 255, 255, 0.03)'};
    border: 1.5px solid ${props => props.$checked ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 6px;
    cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
    transition: all 0.2s ease;
    opacity: ${props => props.$disabled ? 0.5 : 1};
    user-select: none;
    
    &:hover {
        background: ${props => !props.$disabled && (props.$checked ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 255, 255, 0.05)')};
        border-color: ${props => !props.$disabled && 'rgba(46, 213, 115, 0.3)'};
    }
`;

const BulkApplyDayLabel = styled.span`
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
`;

const BulkApplyActions = styled.div`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
`;

const BulkApplyActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    
    ${props => props.$variant === 'primary' ? `
        background: linear-gradient(135deg, rgb(46, 213, 115), rgb(32, 191, 96));
        color: white;
        box-shadow: 0 2px 6px rgba(46, 213, 115, 0.2);
        
        &:hover {
            transform: translateY(-1px);
            box-shadow: 0 3px 10px rgba(46, 213, 115, 0.3);
        }
        
        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
    ` : `
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary);
        border: 1px solid rgba(255, 255, 255, 0.1);
        
        &:hover {
            background: rgba(255, 255, 255, 0.08);
        }
    `}
    
    &:active {
        transform: translateY(0);
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

const IconCalendar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

const IconCopy = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

const IconTemplate = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

const IconClock = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);

const IconUsers = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
);

// === ИНТЕРФЕЙСЫ ===

interface DayFormData {
    name: string;
    startTime: string;
    endTime: string;
    maxSlots: number;
    hasSeniorSlot: boolean;
    isActive: boolean;
}

interface ShiftTemplateFormProps {
    template?: ShiftTemplate | null;
    version?: FutureVersionInfo | null;
    onSubmit: (data: ShiftTemplateCreatePayload | ShiftTemplateUpdatePayload | ShiftTemplateCreatePayload[] | ShiftTemplateUpdatePayload[]) => void;
    onCancel: () => void;
    isLoading?: boolean;
    currentDayIndex?: number;
    formId?: string;
    enableWeeklyMode?: boolean; // Новый проп для включения мульти-день режима
    existingTemplates?: ShiftTemplate[]; // Существующие шаблоны для отображения
}

const ShiftTemplateForm: React.FC<ShiftTemplateFormProps> = ({
    template,
    version,
    onSubmit,
    onCancel,
    isLoading = false,
    currentDayIndex = 0,
    formId = 'shift-template-form',
    enableWeeklyMode = true, // По умолчанию включен мульти-день режим
    existingTemplates = [] // Существующие шаблоны
}) => {
    const isEditing = !!template;
    const isEditingVersion = !!version;
    
    // Weekly режим доступен всегда кроме редактирования версии
    const isWeeklyMode = enableWeeklyMode && !isEditingVersion;
    
    // Состояние для мульти-день режима
    const [activeDay, setActiveDay] = useState<number>(currentDayIndex);
    const [weekData, setWeekData] = useState<Record<number, DayFormData | null>>({
        0: null,
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null
    });
    
    // Состояние для обычного режима (редактирование)
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
    const [showBulkApplyModal, setShowBulkApplyModal] = useState(false);
    const [selectedDaysForBulkApply, setSelectedDaysForBulkApply] = useState<number[]>([]);
    
    // Отслеживание для умной подсказки
    const [showDuplicateHintBanner, setShowDuplicateHintBanner] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [bulkAppliedDays, setBulkAppliedDays] = useState<Set<number>>(new Set()); // Дни, заполненные через Bulk Apply
    const [previousActiveDay, setPreviousActiveDay] = useState<number>(activeDay);

    // Инициализация для режима редактирования
    useEffect(() => {
        if (isWeeklyMode && template) {
            // В weekly режиме при редактировании загружаем данные во все дни где применен шаблон
            const templateData: DayFormData = {
                name: template.name,
                startTime: template.startTime,
                endTime: template.endTime,
                maxSlots: template.maxSlots,
                hasSeniorSlot: template.hasSeniorSlot,
                isActive: template.isActive
            };
            
            const newWeekData: Record<number, DayFormData | null> = {
                0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null
            };
            
            // Заполняем данные только для дней где применен шаблон
            if (template.daysOfWeek && template.daysOfWeek.length > 0) {
                template.daysOfWeek.forEach(dayIndex => {
                    newWeekData[dayIndex] = { ...templateData };
                });
            }
            
            setWeekData(newWeekData);
            
            // Устанавливаем активный день - первый из применяемых
            if (template.daysOfWeek && template.daysOfWeek.length > 0) {
                setActiveDay(template.daysOfWeek[0]);
            }
        } else if (!isWeeklyMode && version) {
            // Если редактируем версию (не weekly режим)
            setFormData({
                name: template?.name || '',
                startTime: version.startTime || template?.startTime || '10:00',
                endTime: version.endTime || template?.endTime || '18:00',
                maxSlots: version.maxSlots,
                hasSeniorSlot: version.hasSeniorSlot !== undefined ? version.hasSeniorSlot : (template?.hasSeniorSlot || false),
                isActive: template?.isActive ?? true,
                daysOfWeek: template?.daysOfWeek || [currentDayIndex]
            });
        }
    }, [template, version, currentDayIndex, isWeeklyMode]);
    
    // Хелпер: получить данные активного дня
    const getActiveDayData = useCallback((): DayFormData => {
        if (isWeeklyMode) {
            return weekData[activeDay] || {
                name: '',
                startTime: '10:00',
                endTime: '18:00',
                maxSlots: 1,
                hasSeniorSlot: false,
                isActive: true
            };
        }
        return {
            name: formData.name,
            startTime: formData.startTime,
            endTime: formData.endTime,
            maxSlots: formData.maxSlots,
            hasSeniorSlot: formData.hasSeniorSlot,
            isActive: formData.isActive
        };
    }, [isWeeklyMode, weekData, activeDay, formData]);
    
    // Хелпер: обновить данные активного дня
    const updateActiveDayData = useCallback((updates: Partial<DayFormData>) => {
        if (isWeeklyMode) {
            // Каждый день = отдельный шаблон, редактируем только активный день
            setWeekData(prev => ({
                ...prev,
                [activeDay]: {
                    ...getActiveDayData(),
                    ...updates
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                ...updates
            }));
        }
    }, [isWeeklyMode, activeDay, getActiveDayData]);
    
    // Хелпер: подсчет заполненных дней
    const getFilledDaysCount = useCallback(() => {
        return Object.values(weekData).filter(data => data !== null && data.name.trim() !== '').length;
    }, [weekData]);
    
    // Хелпер: проверка заполненности дня
    const isDayFilled = useCallback((dayIndex: number) => {
        const data = weekData[dayIndex];
        return data !== null && data.name.trim() !== '';
    }, [weekData]);
    
    // Хелпер: получить существующие шаблоны для текущего дня
    const getExistingTemplatesForDay = useCallback((dayIndex: number) => {
        return existingTemplates.filter(t => 
            t.daysOfWeek && t.daysOfWeek.includes(dayIndex)
        );
    }, [existingTemplates]);
    
    // Хелпер: проверка идентичности данных двух дней
    const areDaysIdentical = useCallback((day1Data: DayFormData, day2Data: DayFormData): boolean => {
        return day1Data.startTime === day2Data.startTime &&
               day1Data.endTime === day2Data.endTime &&
               day1Data.maxSlots === day2Data.maxSlots &&
               day1Data.hasSeniorSlot === day2Data.hasSeniorSlot;
    }, []);
    
    // Проверка дубликатов для показа подсказки
    const checkForDuplicateData = useCallback(() => {
        if (!isWeeklyMode || bannerDismissed || showBulkApplyModal) {
            return;
        }
        
        const currentData = weekData[previousActiveDay];
        
        // Если предыдущий день не заполнен или был заполнен через Bulk Apply - не проверяем
        if (!currentData || !currentData.name.trim() || bulkAppliedDays.has(previousActiveDay)) {
            return;
        }
        
        // Ищем другие дни с идентичными данными (исключая дни, заполненные через Bulk Apply)
        const duplicateDays = Object.entries(weekData)
            .filter(([dayIndexStr, data]) => {
                const dayIndex = parseInt(dayIndexStr);
                return dayIndex !== previousActiveDay && 
                       data !== null && 
                       data.name.trim() !== '' &&
                       !bulkAppliedDays.has(dayIndex) &&
                       areDaysIdentical(currentData, data);
            });
        
        // Показываем банер только если нашли минимум 1 дубликат
        if (duplicateDays.length >= 1) {
            setShowDuplicateHintBanner(true);
        }
    }, [isWeeklyMode, bannerDismissed, showBulkApplyModal, weekData, previousActiveDay, bulkAppliedDays, areDaysIdentical]);
    
    // Обработчик: переключение дня
    const handleDayChange = useCallback((dayIndex: number) => {
        // Проверяем дубликаты перед переключением
        checkForDuplicateData();
        
        // Обновляем предыдущий и текущий день
        setPreviousActiveDay(activeDay);
        setActiveDay(dayIndex);
    }, [activeDay, checkForDuplicateData]);

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
        
        // В мульти-день режиме собираем все заполненные дни
        if (isWeeklyMode) {
            const filledDaysEntries = Object.entries(weekData)
                .filter(([_, data]) => data !== null && data.name.trim() !== '');
            
            if (filledDaysEntries.length === 0) {
                setErrors({ general: 'Заполните хотя бы один день недели' });
                return;
            }
            
            // Если редактируем существующий шаблон
            if (isEditing && template) {
                // Находим все шаблоны для заполненных дней и обновляем каждый
                const updatesToSubmit: ShiftTemplateUpdatePayload[] = [];
                
                filledDaysEntries.forEach(([dayIndexStr, dayData]) => {
                    const dayIndex = parseInt(dayIndexStr);
                    
                    // Находим шаблон для этого дня
                    const dayTemplate = existingTemplates.find(t => 
                        t.daysOfWeek && t.daysOfWeek.includes(dayIndex)
                    );
                    
                    if (dayTemplate) {
                        // Обновляем существующий шаблон для этого дня
                        updatesToSubmit.push({
                            id: dayTemplate.id,
                            name: dayData!.name,
                            startTime: dayData!.startTime,
                            endTime: dayData!.endTime,
                            maxSlots: dayData!.maxSlots,
                            hasSeniorSlot: dayData!.hasSeniorSlot,
                            isActive: dayData!.isActive
                            // НЕ меняем daysOfWeek - каждый шаблон остается на своем дне
                        });
                    }
                });
                
                // Отправляем массив обновлений
                if (updatesToSubmit.length > 0) {
                    onSubmit(updatesToSubmit);
                }
            } else {
                // Создание новых шаблонов - каждый день отдельный шаблон
                const filledDays = filledDaysEntries.map(([dayIndex, data]) => ({
                    name: data!.name,
                    startTime: data!.startTime,
                    endTime: data!.endTime,
                    maxSlots: data!.maxSlots,
                    hasSeniorSlot: data!.hasSeniorSlot,
                    daysOfWeek: [parseInt(dayIndex)]
                }));
                
                onSubmit(filledDays);
            }
            
            // Сбрасываем состояния для следующей сессии
            setBannerDismissed(false);
            setBulkAppliedDays(new Set());
            setShowDuplicateHintBanner(false);
            
            return;
        }
        
        // Обычный режим (редактирование)
        if (!validateForm()) {
            return;
        }
        
        // При редактировании версии передаем данные для обновления версии
        if (isEditingVersion && version) {
            const updateData: ShiftTemplateUpdatePayload = {
                id: template!.id,
                name: formData.name,
                startTime: formData.startTime,
                endTime: formData.endTime,
                maxSlots: formData.maxSlots,
                hasSeniorSlot: formData.hasSeniorSlot,
                isActive: formData.isActive,
                daysOfWeek: formData.daysOfWeek
            };
            onSubmit(updateData);
        } else if (isEditing && template) {
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
    }, [isWeeklyMode, weekData, isEditing, isEditingVersion, template, version, formData, validateForm, onSubmit]);

    const handleSlotCountChange = (delta: number) => {
        const currentData = getActiveDayData();
        const newValue = Math.max(1, Math.min(20, currentData.maxSlots + delta));
        updateActiveDayData({ maxSlots: newValue });
    };

    const toggleDay = (dayIndex: number) => {
        if (!isWeeklyMode) {
            setFormData(prev => ({
                ...prev,
                daysOfWeek: prev.daysOfWeek.includes(dayIndex)
                    ? prev.daysOfWeek.filter(d => d !== dayIndex)
                    : [...prev.daysOfWeek, dayIndex]
            }));
        }
    };
    
    // Bulk Apply: применить настройки к выбранным дням
    const handleBulkApply = useCallback((targetDays: number[]) => {
        const currentData = getActiveDayData();
        
        setWeekData(prev => {
            const updated = { ...prev };
            targetDays.forEach(dayIndex => {
                updated[dayIndex] = {
                    ...currentData,
                    // Можно автоматически добавлять день в название
                    // name: currentData.name || ''
                };
            });
            return updated;
        });
        
        // Отмечаем дни как заполненные через Bulk Apply (чтобы не показывать подсказку)
        setBulkAppliedDays(prev => {
            const newSet = new Set(prev);
            targetDays.forEach(day => newSet.add(day));
            return newSet;
        });
        
        setShowBulkApplyModal(false);
    }, [getActiveDayData]);
    
    // Проверка дубликатов при переключении дня (с небольшой задержкой)
    useEffect(() => {
        if (!isWeeklyMode) return;
        
        const timer = setTimeout(() => {
            checkForDuplicateData();
        }, 500); // Задержка чтобы не проверять во время активного редактирования
        
        return () => clearTimeout(timer);
    }, [activeDay, isWeeklyMode, checkForDuplicateData]);

    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayShortNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    return (
        <FormContainer>
            <FormHeader>
                <FormTitle>
                    {isEditingVersion ? <IconCalendar /> : (isEditing ? <IconEdit /> : <IconPlus />)}
                    {isEditingVersion ? 'Редактировать версию шаблона' : (isEditing ? 'Редактировать шаблон' : 'Создать шаблон')}
                </FormTitle>
                <FormSubtitle>
                    {isEditingVersion
                        ? 'Измените параметры будущей версии шаблона'
                        : (isEditing 
                            ? (isWeeklyMode
                                ? 'Редактирование шаблонов для выбранных дней. Каждый день можно настроить отдельно.'
                                : 'Измените параметры существующего шаблона смены'
                            )
                            : 'Настройте параметры для нового шаблона смены'
                        )
                    }
                </FormSubtitle>
            </FormHeader>
            
            {/* Табы дней недели (только в мульти-день режиме) */}
            {isWeeklyMode && (
                <DayTabsContainer>
                    <DayTabsWrapper>
                        {dayShortNames.map((dayShortName, dayIndex) => {
                            const filled = isDayFilled(dayIndex);
                            const active = activeDay === dayIndex;
                            
                            return (
                                <DayTab
                                    key={dayIndex}
                                    type="button"
                                    $active={active}
                                    $filled={filled}
                                    onClick={() => handleDayChange(dayIndex)}
                                >
                                    <DayTabName $active={active}>{dayShortName}</DayTabName>
                                    <DayTabIndicator $visible={filled} />
                                </DayTab>
                            );
                        })}
                    </DayTabsWrapper>
                    
                    {/* Информация о существующих шаблонах для выбранного дня */}
                    <ExistingTemplatesInfo>
                        <ExistingTemplatesTitle>
                            <IconTemplate />
                            Шаблоны на {dayNames[activeDay]}
                        </ExistingTemplatesTitle>
                        {(() => {
                            const dayTemplates = getExistingTemplatesForDay(activeDay);
                            
                            if (dayTemplates.length === 0) {
                                return (
                                    <NoTemplatesMessage>
                                        Нет созданных шаблонов
                                    </NoTemplatesMessage>
                                );
                            }
                            
                            return (
                                <ExistingTemplatesList>
                                    {dayTemplates.map((tmpl) => (
                                        <ExistingTemplateItem key={tmpl.id}>
                                            <ExistingTemplateIcon>
                                                <IconTemplate />
                                            </ExistingTemplateIcon>
                                            <ExistingTemplateName>
                                                {tmpl.name}
                                            </ExistingTemplateName>
                                            <ExistingTemplateDetails>
                                                <ExistingTemplateTime>
                                                    <IconClock />
                                                    {tmpl.startTime.substring(0, 5)}-{tmpl.endTime.substring(0, 5)}
                                                </ExistingTemplateTime>
                                                <ExistingTemplateSlots>
                                                    <IconUsers />
                                                    {tmpl.maxSlots}
                                                </ExistingTemplateSlots>
                                            </ExistingTemplateDetails>
                                        </ExistingTemplateItem>
                                    ))}
                                </ExistingTemplatesList>
                            );
                        })()}
                    </ExistingTemplatesInfo>
                </DayTabsContainer>
            )}
            
            <FormContent id={formId} onSubmit={handleSubmit}>
                <Section>
                    <SectionTitle>Основная информация</SectionTitle>
                    
                    <Field>
                        <Label>
                            Название шаблона<span>*</span>
                        </Label>
                        <Input
                            type="text"
                            value={getActiveDayData().name}
                            onChange={(e) => updateActiveDayData({ name: e.target.value })}
                            placeholder={isWeeklyMode ? `Например: Дневная смена (${dayNames[activeDay]})` : "Например: Дневная смена"}
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
                                value={getActiveDayData().startTime}
                                onChange={(e) => updateActiveDayData({ startTime: e.target.value })}
                                $hasError={!!errors.startTime}
                                disabled={isLoading}
                            />
                            <TimeSeparator>—</TimeSeparator>
                            <TimeInput
                                type="time"
                                value={getActiveDayData().endTime}
                                onChange={(e) => updateActiveDayData({ endTime: e.target.value })}
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
                                disabled={isLoading || getActiveDayData().maxSlots <= 1}
                            >
                                −
                            </SlotButton>
                            <SlotValue>{getActiveDayData().maxSlots}</SlotValue>
                            <SlotButton
                                type="button"
                                onClick={() => handleSlotCountChange(1)}
                                disabled={isLoading || getActiveDayData().maxSlots >= 20}
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
                            checked={getActiveDayData().hasSeniorSlot}
                            onChange={(e) => updateActiveDayData({ hasSeniorSlot: e.target.checked })}
                            disabled={isLoading}
                        />
                        <CheckboxLabelText>
                            Включить слот для старшего курьера
                        </CheckboxLabelText>
                    </CheckboxRow>
                    
                    {/* Умная подсказка о дубликатах */}
                    {isWeeklyMode && showDuplicateHintBanner && !bannerDismissed && (
                        <SmartHintBanner>
                            <SmartHintIcon>💡</SmartHintIcon>
                            <SmartHintContent>
                                <SmartHintTitle>Подсказка</SmartHintTitle>
                                <SmartHintText>
                                    Мы заметили, что вы вводите одинаковые данные для разных дней недели. 
                                    Вы можете сделать это в один клик, воспользовавшись кнопкой{' '}
                                    <strong 
                                        style={{ 
                                            textDecoration: 'underline', 
                                            cursor: 'pointer' 
                                        }}
                                        onClick={() => {
                                            setShowBulkApplyModal(true);
                                            setBannerDismissed(true);
                                            setShowDuplicateHintBanner(false);
                                        }}
                                    >
                                        "Быстрое создание"
                                    </strong>
                                    {' '}ниже!
                                </SmartHintText>
                            </SmartHintContent>
                            <SmartHintButton 
                                type="button"
                                onClick={() => {
                                    setBannerDismissed(true);
                                    setShowDuplicateHintBanner(false);
                                }}
                            >
                                ОК, понятно
                            </SmartHintButton>
                        </SmartHintBanner>
                    )}

                    {/* Быстрое создание (только в мульти-день режиме) */}
                    {isWeeklyMode && (
                        <QuickCreateSection>
                            {!showBulkApplyModal ? (
                                <>
                                    <QuickCreateButton 
                                        type="button"
                                        onClick={() => setShowBulkApplyModal(true)}
                                        disabled={isLoading || !getActiveDayData().name.trim()}
                                        $isPulsing={showDuplicateHintBanner && !bannerDismissed}
                                    >
                                        <IconCopy />
                                        Быстрое создание
                                    </QuickCreateButton>
                                    <QuickCreateHint>
                                        Для создания тех же данных для других дней, или <strong>выберите сверху день недели</strong> для индивидуальной настройки
                                    </QuickCreateHint>
                                </>
                            ) : (
                                <BulkApplyExpanded>
                                    <BulkApplyTitle>
                                        <IconCopy />
                                        Выберите дни для применения настроек
                                    </BulkApplyTitle>
                                    <BulkApplyGrid>
                                        {dayNames.map((dayName, dayIndex) => {
                                            const isCurrentDay = dayIndex === activeDay;
                                            const isChecked = selectedDaysForBulkApply.includes(dayIndex);
                                            
                                            return (
                                                <BulkApplyDayCard
                                                    key={dayIndex}
                                                    $checked={isChecked}
                                                    $disabled={isCurrentDay}
                                                >
                                                    <Checkbox
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedDaysForBulkApply(prev => [...prev, dayIndex]);
                                                            } else {
                                                                setSelectedDaysForBulkApply(prev => prev.filter(d => d !== dayIndex));
                                                            }
                                                        }}
                                                        disabled={isCurrentDay}
                                                    />
                                                    <BulkApplyDayLabel>
                                                        {dayName} {isCurrentDay && '(текущий)'}
                                                    </BulkApplyDayLabel>
                                                </BulkApplyDayCard>
                                            );
                                        })}
                                    </BulkApplyGrid>
                                    <BulkApplyActions>
                                        <BulkApplyActionButton 
                                            type="button"
                                            $variant="secondary"
                                            onClick={() => {
                                                setShowBulkApplyModal(false);
                                                setSelectedDaysForBulkApply([]);
                                            }}
                                        >
                                            Отмена
                                        </BulkApplyActionButton>
                                        <BulkApplyActionButton 
                                            type="button"
                                            $variant="primary"
                                            onClick={() => {
                                                handleBulkApply(selectedDaysForBulkApply);
                                                setSelectedDaysForBulkApply([]);
                                            }}
                                            disabled={selectedDaysForBulkApply.length === 0}
                                        >
                                            Применить ({selectedDaysForBulkApply.length})
                                        </BulkApplyActionButton>
                                    </BulkApplyActions>
                                </BulkApplyExpanded>
                            )}
                        </QuickCreateSection>
                    )}
                </Section>

                {/* Секция "Дни недели" (только в обычном режиме) */}
                {!isWeeklyMode && (
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
                )}

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
