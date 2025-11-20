import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { ShiftTemplate } from '@features/courierSchedule/types/courierScheduleTypes';

// === СОВРЕМЕННЫЕ СТИЛИ (как в форме создания) ===

const SettingsSection = styled.div`
    margin-bottom: 28px;
`;

const SectionTitle = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 95, 31, 0.1);
    
    @media (max-width: 768px) {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
    }
`;

const SectionTitleLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    width: 100%;
    
    svg {
        width: 22px;
        height: 22px;
        color: var(--primary-color);
        flex-shrink: 0;
    }
    
    @media (max-width: 768px) {
        font-size: 1rem;
        
        svg {
            width: 20px;
            height: 20px;
        }
    }
`;

const TemplateCard = styled.div<{ $isSelected: boolean; $isActive: boolean }>`
    padding: 16px;
    background: ${props => props.$isSelected 
        ? 'linear-gradient(135deg, rgba(255, 95, 31, 0.08), rgba(255, 95, 31, 0.03))' 
        : 'rgba(255, 255, 255, 0.03)'};
    border: 1.5px solid ${props => props.$isSelected 
        ? 'rgba(255, 95, 31, 0.3)' 
        : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 12px;
    margin-bottom: 16px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: ${props => props.$isActive ? 1 : 0.65};
    position: relative;
    overflow: hidden;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        height: 100%;
        background: ${props => props.$isSelected ? 'var(--primary-color)' : 'transparent'};
        transition: background 0.3s ease;
    }
    
    &:hover {
        border-color: ${props => props.$isSelected 
            ? 'rgba(255, 95, 31, 0.5)' 
            : 'rgba(255, 95, 31, 0.2)'};
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(255, 95, 31, 0.15);
        background: ${props => props.$isSelected 
            ? 'linear-gradient(135deg, rgba(255, 95, 31, 0.12), rgba(255, 95, 31, 0.05))' 
            : 'rgba(255, 255, 255, 0.05)'};
    }
    
    @media (max-width: 768px) {
        padding: 14px;
        margin-bottom: 12px;
        border-radius: 10px;
        
        &:hover {
            transform: none;
        }
        
        &:active {
            transform: scale(0.98);
        }
    }
`;

const TemplateHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 12px;
    
    @media (max-width: 768px) {
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
    }
`;

const TemplateName = styled.div`
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1.1rem;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    
    svg {
        width: 18px;
        height: 18px;
        color: var(--primary-color);
        opacity: 0.7;
        flex-shrink: 0;
    }
    
    @media (max-width: 768px) {
        font-size: 1rem;
        width: 100%;
        
        svg {
            width: 16px;
            height: 16px;
        }
    }
`;

const TemplateStatus = styled.div<{ $isActive: boolean; $isApplied: boolean }>`
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${props => {
        if (props.$isApplied) {
            return 'linear-gradient(135deg, rgba(46, 213, 115, 0.2), rgba(46, 213, 115, 0.1))';
        }
        return props.$isActive 
            ? 'linear-gradient(135deg, rgba(255, 95, 31, 0.2), rgba(255, 95, 31, 0.1))' 
            : 'rgba(255, 255, 255, 0.05)';
    }};
    color: ${props => {
        if (props.$isApplied) return 'rgb(46, 213, 115)';
        return props.$isActive ? 'var(--primary-color)' : 'var(--text-secondary)';
    }};
    border: 1px solid ${props => {
        if (props.$isApplied) return 'rgba(46, 213, 115, 0.3)';
        return props.$isActive 
            ? 'rgba(255, 95, 31, 0.3)' 
            : 'rgba(255, 255, 255, 0.1)';
    }};
    white-space: nowrap;
    flex-shrink: 0;
    
    @media (max-width: 768px) {
        font-size: 0.7rem;
        padding: 5px 10px;
        align-self: flex-start;
    }
`;

const TemplateDetails = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 12px;
        padding: 12px;
        margin-bottom: 12px;
    }
`;

const DetailItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const DetailLabel = styled.span`
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.8;
`;

const DetailValue = styled.span`
    font-size: 1rem;
    color: var(--text-primary);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    
    svg {
        width: 16px;
        height: 16px;
        color: var(--primary-color);
        opacity: 0.7;
    }
`;

const TemplateDescription = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    line-height: 1.5;
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    
    @media (max-width: 768px) {
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
    }
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' | 'success' }>`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex: 1;
    min-height: 44px; /* Минимальная высота для тач-интерфейса */
    
    svg {
        width: 16px;
        height: 16px;
        stroke-width: 2;
        flex-shrink: 0;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
        padding: 12px 16px;
        font-size: 0.9rem;
        min-height: 48px;
        
        svg {
            width: 18px;
            height: 18px;
        }
    }
    
    ${props => {
        switch (props.$variant) {
            case 'primary':
                return `
                    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
                    color: white;
                    box-shadow: 0 2px 8px rgba(255, 95, 31, 0.2);
                    &:hover:not(:disabled) {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(255, 95, 31, 0.3);
                    }
                    &:active:not(:disabled) {
                        transform: translateY(0);
                    }
                `;
            case 'success':
                return `
                    background: linear-gradient(135deg, rgba(46, 213, 115, 0.2), rgba(46, 213, 115, 0.1));
                    color: rgb(46, 213, 115);
                    border: 1px solid rgba(46, 213, 115, 0.3);
                    &:hover:not(:disabled) {
                        background: linear-gradient(135deg, rgba(46, 213, 115, 0.3), rgba(46, 213, 115, 0.15));
                        transform: translateY(-1px);
                    }
                `;
            case 'danger':
                return `
                    background: linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(231, 76, 60, 0.1));
                    color: var(--danger-color);
                    border: 1px solid rgba(231, 76, 60, 0.3);
                    &:hover:not(:disabled) {
                        background: linear-gradient(135deg, rgba(231, 76, 60, 0.3), rgba(231, 76, 60, 0.15));
                        transform: translateY(-1px);
                    }
                `;
            default:
                return `
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    &:hover:not(:disabled) {
                        background: rgba(255, 255, 255, 0.08);
                        border-color: rgba(255, 95, 31, 0.2);
                        transform: translateY(-1px);
                    }
                `;
        }
    }}
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
`;

const EmptyStateIcon = styled.div`
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
    
    svg {
        width: 64px;
        height: 64px;
        color: var(--text-secondary);
        opacity: 0.3;
    }
`;

const EmptyStateText = styled.div`
    font-size: 1rem;
    margin-bottom: 24px;
    color: var(--text-primary);
    font-weight: 500;
`;

const CreateTemplateButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-weight: 500;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(255, 95, 31, 0.2);
    min-height: 44px;
    
    svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(255, 95, 31, 0.3);
    }
    
    &:active {
        transform: translateY(0);
    }
    
    @media (max-width: 768px) {
        width: 100%;
        justify-content: center;
        padding: 14px 24px;
        font-size: 1rem;
        min-height: 48px;
        
        &:hover {
            transform: none;
        }
        
        &:active {
            transform: scale(0.98);
        }
    }
`;

// === ИКОНКИ ===

const IconTemplate = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

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

const IconDelete = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
);

const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
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

const IconEmpty = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="12" y1="18" x2="12" y2="12"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>
);

interface ShiftTemplateSelectorProps {
    templates: ShiftTemplate[];
    selectedTemplateIds: string[];
    onTemplateSelect: (templateIds: string[]) => void;
    onTemplateEdit: (template: ShiftTemplate) => void;
    onTemplateDelete: (templateId: string) => void;
    onTemplateCreate: () => void;
    onTemplateUnapply?: (templateId: string) => void;
    isLoading?: boolean;
    appliedTemplates?: ShiftTemplate[];
}

const ShiftTemplateSelector: React.FC<ShiftTemplateSelectorProps> = ({
    templates,
    selectedTemplateIds,
    onTemplateSelect,
    onTemplateEdit,
    onTemplateDelete,
    onTemplateCreate,
    onTemplateUnapply,
    isLoading = false,
    appliedTemplates = []
}) => {
    const handleTemplateToggle = useCallback((templateId: string) => {
        const isSelected = selectedTemplateIds.includes(templateId);
        if (isSelected) {
            onTemplateSelect(selectedTemplateIds.filter(id => id !== templateId));
        } else {
            onTemplateSelect([...selectedTemplateIds, templateId]);
        }
    }, [selectedTemplateIds, onTemplateSelect]);

    const handleApplyToggle = useCallback((templateId: string) => {
        const isApplied = appliedTemplates.some(applied => applied.id === templateId);
        
        if (isApplied) {
            if (onTemplateUnapply) {
                onTemplateUnapply(templateId);
            }
        } else {
            if (onTemplateUnapply) {
                onTemplateUnapply(templateId);
            }
        }
    }, [onTemplateUnapply, appliedTemplates]);

    const formatTime = (time: string) => {
        return time;
    };

    const getTimeRange = (startTime: string, endTime: string) => {
        return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    };

    if (templates.length === 0) {
        return (
            <SettingsSection>
                <SectionTitle>
                    <SectionTitleLeft>
                        <IconTemplate />
                        Шаблоны смен
                    </SectionTitleLeft>
                </SectionTitle>
                <EmptyState>
                    <EmptyStateIcon>
                        <IconEmpty />
                    </EmptyStateIcon>
                    <EmptyStateText>Шаблоны смен не созданы</EmptyStateText>
                    <CreateTemplateButton onClick={onTemplateCreate}>
                        <IconPlus />
                        Создать первый шаблон
                    </CreateTemplateButton>
                </EmptyState>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection>
            <SectionTitle>
                <SectionTitleLeft>
                    <IconTemplate />
                    Шаблоны смен
                </SectionTitleLeft>
                <ActionButton onClick={onTemplateCreate} $variant="primary">
                    <IconPlus />
                    Создать шаблон
                </ActionButton>
            </SectionTitle>
            
            {templates.map(template => {
                const isApplied = appliedTemplates.some(applied => applied.id === template.id);
                
                return (
                    <TemplateCard
                        key={template.id}
                        $isSelected={isApplied}
                        $isActive={template.isActive}
                        onClick={() => handleTemplateToggle(template.id)}
                    >
                        <TemplateHeader>
                            <TemplateName>
                                <IconTemplate />
                                {template.name}
                            </TemplateName>
                            <TemplateStatus $isActive={template.isActive} $isApplied={isApplied}>
                                {isApplied ? 'Применен' : template.isActive ? 'Активен' : 'Неактивен'}
                            </TemplateStatus>
                        </TemplateHeader>
                        
                        <TemplateDetails>
                            <DetailItem>
                                <DetailLabel>Время работы</DetailLabel>
                                <DetailValue>
                                    <IconClock />
                                    {getTimeRange(template.startTime, template.endTime)}
                                </DetailValue>
                            </DetailItem>
                            <DetailItem>
                                <DetailLabel>Количество слотов</DetailLabel>
                                <DetailValue>
                                    <IconUsers />
                                    {template.maxSlots}
                                </DetailValue>
                            </DetailItem>
                            <DetailItem>
                                <DetailLabel>Старший курьер</DetailLabel>
                                <DetailValue>
                                    {template.hasSeniorSlot ? (
                                        <>
                                            <IconCheck />
                                            Да
                                        </>
                                    ) : (
                                        <>
                                            <IconX />
                                            Нет
                                        </>
                                    )}
                                </DetailValue>
                            </DetailItem>
                            <DetailItem>
                                <DetailLabel>Статус</DetailLabel>
                                <DetailValue>
                                    {isApplied ? (
                                        <>
                                            <IconCheck />
                                            Применен
                                        </>
                                    ) : (
                                        <>
                                            <IconX />
                                            Не применен
                                        </>
                                    )}
                                </DetailValue>
                            </DetailItem>
                        </TemplateDetails>
                        
                        {template.description && (
                            <TemplateDescription>
                                {template.description}
                            </TemplateDescription>
                        )}
                        
                        <ActionButtons onClick={(e) => e.stopPropagation()}>
                            <ActionButton 
                                onClick={() => handleApplyToggle(template.id)}
                                disabled={isLoading}
                                $variant={isApplied ? 'secondary' : 'success'}
                            >
                                {isApplied ? (
                                    <>
                                        <IconX />
                                        Отменить
                                    </>
                                ) : (
                                    <>
                                        <IconCheck />
                                        Применить
                                    </>
                                )}
                            </ActionButton>
                            <ActionButton 
                                onClick={() => onTemplateEdit(template)}
                                disabled={isLoading}
                                $variant="secondary"
                            >
                                <IconEdit />
                                Редактировать
                            </ActionButton>
                            <ActionButton 
                                $variant="danger"
                                onClick={() => onTemplateDelete(template.id)}
                                disabled={isLoading}
                            >
                                <IconDelete />
                                Удалить
                            </ActionButton>
                        </ActionButtons>
                    </TemplateCard>
                );
            })}
        </SettingsSection>
    );
};

export default ShiftTemplateSelector;
