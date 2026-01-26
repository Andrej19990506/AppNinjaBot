import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { ShiftTemplate, FutureVersionInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { deleteTemplateVersion, updateTemplateVersion } from '@features/courierSchedule/services/courierApi/shiftTemplatesApi';

// === СОВРЕМЕННЫЕ СТИЛИ (как в форме создания) ===

const pulse = keyframes`
    0%, 100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.4);
    }
    50% {
        opacity: 0.9;
        box-shadow: 0 0 0 4px rgba(255, 193, 7, 0);
    }
`;

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
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    
    @media (max-width: 768px) {
        gap: 8px;
        margin-bottom: 12px;
    }
`;

const TemplateHeaderTop = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    
    @media (max-width: 768px) {
        flex-direction: column;
        gap: 8px;
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
    gap: 12px;
    margin-bottom: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 10px;
        padding: 10px;
        margin-bottom: 10px;
    }
`;

const DetailItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const DetailLabel = styled.span`
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.7;
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

const ComparisonContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const OldValue = styled.span`
    font-size: 0.85rem;
    color: var(--danger-color);
    font-weight: 500;
    text-decoration: line-through;
    opacity: 0.75;
    display: flex;
    align-items: center;
    gap: 4px;
    
    svg {
        width: 14px;
        height: 14px;
    }
`;

const NewValue = styled.span`
    font-size: 0.95rem;
    color: rgb(46, 213, 115);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
    
    svg {
        width: 16px;
        height: 16px;
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
    min-height: 44px;
    
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

const IconEye = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
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

const IconCalendar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

const FutureVersionBanner = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: linear-gradient(135deg, rgba(46, 213, 115, 0.15), rgba(46, 213, 115, 0.08));
    border: 1.5px solid rgba(46, 213, 115, 0.4);
    border-radius: 8px;
    margin-bottom: 12px;
    animation: ${pulse} 2s ease-in-out infinite;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
    text-align: left;
    
    &:hover {
        background: linear-gradient(135deg, rgba(46, 213, 115, 0.25), rgba(46, 213, 115, 0.15));
        border-color: rgba(46, 213, 115, 0.6);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(46, 213, 115, 0.2);
    }
    
    &:active {
        transform: translateY(0);
    }
    
    @media (max-width: 768px) {
        padding: 8px 12px;
        font-size: 0.85rem;
    }
`;

const FutureVersionText = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
`;

const FutureVersionTitle = styled.div`
    font-size: 0.85rem;
    font-weight: 700;
    color: rgb(46, 213, 115);
    display: flex;
    align-items: center;
    gap: 6px;
    
    @media (max-width: 768px) {
        font-size: 0.8rem;
    }
`;

const FutureVersionDate = styled.div`
    font-size: 0.75rem;
    color: rgba(46, 213, 115, 0.9);
    font-weight: 500;
    
    @media (max-width: 768px) {
        font-size: 0.7rem;
    }
`;

const FutureVersionHint = styled.div`
    font-size: 0.75rem;
    color: rgb(46, 213, 115);
    font-weight: 600;
    font-style: normal;
    margin-top: 4px;
    padding: 4px 8px;
    background: rgba(46, 213, 115, 0.15);
    border-radius: 4px;
    display: inline-block;
    
    @media (max-width: 768px) {
        font-size: 0.7rem;
        padding: 3px 6px;
    }
`;

const FutureVersionIcon = styled.div`
    display: flex;
    align-items: center;
    color: rgb(46, 213, 115);
    flex-shrink: 0;
    
    svg {
        width: 20px;
        height: 20px;
        
        @media (max-width: 768px) {
            width: 18px;
            height: 18px;
        }
    }
`;

const VersionStatus = styled.div`
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    color: var(--primary-color);
    font-weight: 500;
    font-size: 0.8rem;
    text-align: center;
    line-height: 1.4;
`;

const DeleteConfirmationBox = styled.div`
    padding: 16px;
    background: rgba(231, 76, 60, 0.1);
    border: 1.5px solid rgba(231, 76, 60, 0.3);
    border-radius: 8px;
    margin-bottom: 16px;
`;

const DeleteConfirmationText = styled.div`
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 12px;
    text-align: center;
`;

const DeleteConfirmationButtons = styled.div`
    display: flex;
    gap: 8px;
    justify-content: center;
`;

interface ShiftTemplateSelectorProps {
    templates: ShiftTemplate[];
    selectedTemplateIds: string[];
    onTemplateSelect: (templateIds: string[]) => void;
    onTemplateEdit: (template: ShiftTemplate, version?: FutureVersionInfo) => void;
    onTemplateDelete: (templateId: string) => void;
    onTemplateCreate: () => void;
    onTemplateUnapply?: (templateId: string) => void;
    onTemplatesRefresh?: () => void;
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
    onTemplatesRefresh,
    isLoading = false,
    appliedTemplates = []
}) => {
    const [expandedVersionTemplateId, setExpandedVersionTemplateId] = useState<string | null>(null);
    const [isDeletingVersion, setIsDeletingVersion] = useState(false);
    const [confirmingDeleteVersionId, setConfirmingDeleteVersionId] = useState<string | null>(null);

    const handleTemplateToggle = useCallback((templateId: string) => {
        const isSelected = selectedTemplateIds.includes(templateId);
        if (isSelected) {
            onTemplateSelect(selectedTemplateIds.filter(id => id !== templateId));
        } else {
            onTemplateSelect([...selectedTemplateIds, templateId]);
        }
    }, [selectedTemplateIds, onTemplateSelect]);

    const handleVersionBannerClick = useCallback((templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedVersionTemplateId(prev => prev === templateId ? null : templateId);
    }, []);

    const handleDeleteVersionClick = useCallback((templateId: string, versionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmingDeleteVersionId(versionId);
    }, []);

    const handleConfirmDeleteVersion = useCallback(async (templateId: string, versionId: string) => {
        setIsDeletingVersion(true);
        setConfirmingDeleteVersionId(null);
        try {
            await deleteTemplateVersion(versionId);
            setExpandedVersionTemplateId(null);
            // Обновляем список шаблонов через callback
            if (onTemplatesRefresh) {
                onTemplatesRefresh();
            }
        } catch (error: any) {
            alert(`Ошибка удаления версии: ${error.message}`);
        } finally {
            setIsDeletingVersion(false);
        }
    }, [onTemplatesRefresh]);

    const handleCancelDeleteVersion = useCallback(() => {
        setConfirmingDeleteVersionId(null);
    }, []);

    const handleEditVersion = useCallback((template: ShiftTemplate, version: FutureVersionInfo, e: React.MouseEvent) => {
        e.stopPropagation();
        // Передаем шаблон и версию в onTemplateEdit с контекстом, что нужно редактировать версию
        onTemplateEdit(template, version);
        setExpandedVersionTemplateId(null);
    }, [onTemplateEdit]);

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

    const formatDate = (dateString: string): string => {
        try {
            const date = new Date(dateString);
            const day = date.getDate();
            const month = date.toLocaleDateString('ru-RU', { month: 'long' });
            const year = date.getFullYear();
            return `${day} ${month} ${year}`;
        } catch (e) {
            return dateString;
        }
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
                            {template.futureVersion && (
                                <FutureVersionBanner>
                                    <FutureVersionIcon>
                                        <IconCalendar />
                                    </FutureVersionIcon>
                                    <FutureVersionText>
                                        <FutureVersionTitle>
                                            Новая версия будет применена
                                        </FutureVersionTitle>
                                        <FutureVersionDate>
                                            С {formatDate(template.futureVersion.validFromDate)}: {template.futureVersion.maxSlots} слотов
                                            {template.futureVersion.hasSeniorSlot !== undefined && (
                                                template.futureVersion.hasSeniorSlot ? ', со старшим курьером' : ', без старшего курьера'
                                            )}
                                        </FutureVersionDate>
                                    </FutureVersionText>
                                </FutureVersionBanner>
                            )}
                            <TemplateHeaderTop>
                                <TemplateName>
                                    <IconTemplate />
                                    {template.name}
                                </TemplateName>
                                <TemplateStatus $isActive={template.isActive} $isApplied={isApplied}>
                                    {isApplied ? 'Применен' : template.isActive ? 'Активен' : 'Неактивен'}
                                </TemplateStatus>
                            </TemplateHeaderTop>
                        </TemplateHeader>
                        
                        {expandedVersionTemplateId === template.id && template.futureVersion ? (
                            <>
                                <VersionStatus>
                                    Вступит в силу с {formatDate(template.futureVersion.validFromDate)}. Действует бессрочно до создания новой версии.
                                </VersionStatus>
                                
                                <TemplateDetails>
                                    <DetailItem>
                                        <DetailLabel>Время работы</DetailLabel>
                                        {(() => {
                                            const oldTime = template.startTime && template.endTime 
                                                ? `${template.startTime.substring(0, 5)} - ${template.endTime.substring(0, 5)}`
                                                : 'Не указано';
                                            const newTime = template.futureVersion.startTime && template.futureVersion.endTime
                                                ? `${template.futureVersion.startTime.substring(0, 5)} - ${template.futureVersion.endTime.substring(0, 5)}`
                                                : 'Не указано';
                                            const isChanged = oldTime !== newTime;
                                            
                                            return isChanged ? (
                                                <ComparisonContainer>
                                                    <OldValue>
                                                        <IconClock />
                                                        {oldTime}
                                                    </OldValue>
                                                    <NewValue>
                                                        <IconClock />
                                                        {newTime}
                                                    </NewValue>
                                                </ComparisonContainer>
                                            ) : (
                                                <DetailValue>
                                                    <IconClock />
                                                    {oldTime}
                                                </DetailValue>
                                            );
                                        })()}
                                    </DetailItem>
                                    <DetailItem>
                                        <DetailLabel>Количество слотов</DetailLabel>
                                        {(() => {
                                            const isChanged = template.maxSlots !== template.futureVersion.maxSlots;
                                            
                                            return isChanged ? (
                                                <ComparisonContainer>
                                                    <OldValue>
                                                        <IconUsers />
                                                        {template.maxSlots}
                                                    </OldValue>
                                                    <NewValue>
                                                        <IconUsers />
                                                        {template.futureVersion.maxSlots}
                                                    </NewValue>
                                                </ComparisonContainer>
                                            ) : (
                                                <DetailValue>
                                                    <IconUsers />
                                                    {template.maxSlots}
                                                </DetailValue>
                                            );
                                        })()}
                                    </DetailItem>
                                    <DetailItem>
                                        <DetailLabel>Старший курьер</DetailLabel>
                                        {(() => {
                                            const newHasSenior = template.futureVersion.hasSeniorSlot !== undefined
                                                ? template.futureVersion.hasSeniorSlot
                                                : template.hasSeniorSlot;
                                            const isChanged = template.hasSeniorSlot !== newHasSenior;
                                            
                                            return isChanged ? (
                                                <ComparisonContainer>
                                                    <OldValue>
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
                                                    </OldValue>
                                                    <NewValue>
                                                        {newHasSenior ? (
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
                                                    </NewValue>
                                                </ComparisonContainer>
                                            ) : (
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
                                            );
                                        })()}
                                    </DetailItem>
                                    <DetailItem>
                                        <DetailLabel>Статус</DetailLabel>
                                        <DetailValue>
                                            <IconCalendar />
                                            Будущая версия
                                        </DetailValue>
                                    </DetailItem>
                                </TemplateDetails>
                                
                                {confirmingDeleteVersionId === template.futureVersion!.id ? (
                                    <DeleteConfirmationBox onClick={(e) => e.stopPropagation()}>
                                        <DeleteConfirmationText>
                                            Вы уверены, что хотите удалить эту версию? После удаления будет действовать последняя созданая версия.
                                        </DeleteConfirmationText>
                                        <DeleteConfirmationButtons>
                                            <ActionButton 
                                                onClick={() => handleConfirmDeleteVersion(template.id, template.futureVersion!.id)}
                                                disabled={isDeletingVersion || isLoading}
                                                $variant="danger"
                                            >
                                                <IconCheck />
                                                {isDeletingVersion ? 'Удаление...' : 'Да, удалить'}
                                            </ActionButton>
                                            <ActionButton 
                                                onClick={handleCancelDeleteVersion}
                                                disabled={isDeletingVersion || isLoading}
                                                $variant="secondary"
                                            >
                                                <IconX />
                                                Отмена
                                            </ActionButton>
                                        </DeleteConfirmationButtons>
                                    </DeleteConfirmationBox>
                                ) : (
                                    <ActionButtons onClick={(e) => e.stopPropagation()}>
                                        <ActionButton 
                                            onClick={(e) => handleVersionBannerClick(template.id, e)}
                                            $variant="success"
                                        >
                                            <IconEye />
                                            {expandedVersionTemplateId === template.id ? 'Скрыть' : 'Показать изменения'}
                                        </ActionButton>
                                        <ActionButton 
                                            onClick={(e) => handleEditVersion(template, template.futureVersion!, e)}
                                            disabled={isDeletingVersion || isLoading}
                                            $variant="secondary"
                                        >
                                            <IconEdit />
                                            Редактировать
                                        </ActionButton>
                                        <ActionButton 
                                            $variant="danger"
                                            onClick={(e) => handleDeleteVersionClick(template.id, template.futureVersion!.id, e)}
                                            disabled={isDeletingVersion || isLoading}
                                        >
                                            <IconDelete />
                                            Удалить
                                        </ActionButton>
                                    </ActionButtons>
                                )}
                            </>
                        ) : (
                            <>
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
                                    {template.futureVersion && (
                                        <ActionButton 
                                            onClick={(e) => handleVersionBannerClick(template.id, e)}
                                            $variant="success"
                                        >
                                            <IconEye />
                                            {expandedVersionTemplateId === template.id ? 'Скрыть' : 'Показать изменения'}
                                        </ActionButton>
                                    )}
                                    {expandedVersionTemplateId !== template.id && (
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
                                    )}
                                    <ActionButton 
                                        onClick={() => onTemplateEdit(template)}
                                        disabled={isLoading}
                                        $variant="secondary"
                                    >
                                        <IconEdit />
                                        Редактировать
                                    </ActionButton>
                                </ActionButtons>
                            </>
                        )}
                    </TemplateCard>
                );
            })}
        </SettingsSection>
    );
};

export default ShiftTemplateSelector;
