import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { ShiftTemplate } from '@features/courierSchedule/types/courierScheduleTypes';

const SettingsSection = styled.div`
    margin-bottom: 24px;
`;

const SectionTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 16px;
`;

const SlotTypeIcon = styled.span`
    font-size: 1.2rem;
`;

const TemplateCard = styled.div<{ $isSelected: boolean; $isActive: boolean }>`
    padding: 16px;
    background-color: ${props => props.$isSelected ? 'var(--primary-transparent)' : 'var(--background-secondary)'};
    border: 2px solid ${props => props.$isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
    border-radius: var(--radius-md);
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: ${props => props.$isActive ? 1 : 0.6};
    
    &:hover {
        border-color: var(--primary-color);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
`;

const TemplateHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
`;

const TemplateName = styled.div`
    font-weight: 600;
    color: var(--text-color);
    font-size: 1rem;
`;

const TemplateStatus = styled.div<{ $isActive: boolean }>`
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
    background-color: ${props => props.$isActive ? 'var(--success-color)' : 'var(--text-secondary)'};
    color: white;
`;

const TemplateDetails = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 8px;
`;

const DetailItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const DetailLabel = styled.span`
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
`;

const DetailValue = styled.span`
    font-size: 0.9rem;
    color: var(--text-color);
    font-weight: 600;
`;

const TemplateDescription = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color);
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 12px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    ${props => {
        switch (props.$variant) {
            case 'primary':
                return `
                    background-color: var(--primary-color);
                    color: white;
                    &:hover {
                        background-color: var(--primary-dark);
                    }
                `;
            case 'danger':
                return `
                    background-color: var(--danger-color);
                    color: white;
                    &:hover {
                        background-color: var(--danger-dark);
                    }
                `;
            default:
                return `
                    background-color: var(--background-secondary);
                    color: var(--text-color);
                    border: 1px solid var(--border-color);
                    &:hover {
                        background-color: var(--hover-overlay);
                    }
                `;
        }
    }}
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
`;

const EmptyStateIcon = styled.div`
    font-size: 3rem;
    margin-bottom: 16px;
`;

const EmptyStateText = styled.div`
    font-size: 1rem;
    margin-bottom: 16px;
`;

const CreateTemplateButton = styled.button`
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px 20px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
        background-color: var(--primary-dark);
    }
`;

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
        // Просто переключаем выбор шаблона для применения
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
            // Если шаблон применен, отменяем его применение
            if (onTemplateUnapply) {
                onTemplateUnapply(templateId);
            }
        } else {
            // Если шаблон не применен, применяем его
            if (onTemplateUnapply) {
                // Используем onTemplateUnapply как общую функцию для применения/отмены
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
                    <SlotTypeIcon>📋</SlotTypeIcon>
                    Шаблоны смен
                </SectionTitle>
                <EmptyState>
                    <EmptyStateIcon>📝</EmptyStateIcon>
                    <EmptyStateText>Шаблоны смен не созданы</EmptyStateText>
                    <CreateTemplateButton onClick={onTemplateCreate}>
                        Создать первый шаблон
                    </CreateTemplateButton>
                </EmptyState>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection>
            <SectionTitle>
                <SlotTypeIcon>📋</SlotTypeIcon>
                Шаблоны смен
                <ActionButton onClick={onTemplateCreate}>
                    + Создать шаблон
                </ActionButton>
            </SectionTitle>
            
            {templates.map(template => (
                <TemplateCard
                    key={template.id}
                    $isSelected={(() => {
                        const isApplied = appliedTemplates.some(applied => applied.id === template.id);
                        return isApplied;
                    })()}
                    $isActive={template.isActive}
                    onClick={() => handleTemplateToggle(template.id)}
                >
                    <TemplateHeader>
                        <TemplateName>{template.name}</TemplateName>
                    </TemplateHeader>
                    
                    <TemplateDetails>
                        <DetailItem>
                            <DetailLabel>Время</DetailLabel>
                            <DetailValue>{getTimeRange(template.startTime, template.endTime)}</DetailValue>
                        </DetailItem>
                        <DetailItem>
                            <DetailLabel>Слотов</DetailLabel>
                            <DetailValue>{template.maxSlots}</DetailValue>
                        </DetailItem>
                        <DetailItem>
                            <DetailLabel>Старший курьер</DetailLabel>
                            <DetailValue>{template.hasSeniorSlot ? 'Да' : 'Нет'}</DetailValue>
                        </DetailItem>
                        <DetailItem>
                            <DetailLabel>Статус</DetailLabel>
                            <DetailValue>{(() => {
                                const isApplied = appliedTemplates.some(applied => applied.id === template.id);
                                return isApplied ? 'Применен' : 'Не применен';
                            })()}</DetailValue>
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
                        >
                            {(() => {
                                const isApplied = appliedTemplates.some(applied => applied.id === template.id);
                                return isApplied ? '❌ Отменить' : '✅ Применить';
                            })()}
                        </ActionButton>
                        <ActionButton 
                            onClick={() => onTemplateEdit(template)}
                            disabled={isLoading}
                        >
                            ✏️ Редактировать
                        </ActionButton>
                        <ActionButton 
                            $variant="danger"
                            onClick={() => onTemplateDelete(template.id)}
                            disabled={isLoading}
                        >
                            🗑️ Удалить
                        </ActionButton>
                    </ActionButtons>
                </TemplateCard>
            ))}
        </SettingsSection>
    );
};

export default ShiftTemplateSelector;
