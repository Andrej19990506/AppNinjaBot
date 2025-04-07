import React from 'react';
import styled from 'styled-components';

const TooltipContainer = styled.div`
    position: absolute;
    top: 38px;
    right: -20px;
    background: var(--card-background);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    padding: 18px;
    width: 320px;
    z-index: 1000;
    border: 1px solid var(--border-color);
    animation: tooltipFadeIn var(--transition-normal);
    transform-origin: top right;
    overflow: hidden;
    
    &::before {
        content: '';
        position: absolute;
        top: -8px;
        right: 26px;
        width: 16px;
        height: 16px;
        background: var(--card-background);
        border-left: 1px solid var(--border-color);
        border-top: 1px solid var(--border-color);
        transform: rotate(45deg);
        z-index: 2;
    }

    @keyframes tooltipFadeIn {
        from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    @media (max-width: 768px) {
        width: 300px;
        right: -10px;
    }

    @media (max-width: 480px) {
        width: 280px;
        right: -5px;
        top: 32px;
    }
`;

const TooltipHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
`;

const TooltipTitle = styled.h3`
    margin: 0;
    color: var(--text-color);
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    
    &::before {
        content: '⚙️';
        margin-right: 8px;
        font-size: 20px;
    }
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    transition: var(--transition-fast);
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;

    &:hover {
        background: var(--hover-overlay);
        color: var(--error-color);
        transform: var(--hover-transform);
    }
    
    &:active {
        transform: var(--active-transform);
    }
`;

const SettingsOption = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition-normal);
    background: var(--hover-overlay);
    margin-bottom: 10px;
    border: 1px solid transparent;

    &:last-child {
        margin-bottom: 0;
    }

    &:hover {
        background: var(--primary-transparent);
        border-color: var(--primary-light);
        transform: var(--hover-transform);
    }
    
    &:active {
        transform: var(--active-transform);
    }
`;

const OptionLabel = styled.span`
    color: var(--text-color);
    font-size: 15px;
    font-weight: 500;
`;

const OptionIcon = styled.span`
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary-transparent);
    color: var(--primary-color);
    transition: var(--transition-normal);
    
    ${SettingsOption}:hover & {
        background: var(--primary-color);
        color: white;
        transform: rotate(15deg);
    }
`;

interface SettingsTooltipProps {
    onClose: () => void;
    onOpenShiftAccess: () => void;
}

const SettingsTooltip: React.FC<SettingsTooltipProps> = ({ onClose, onOpenShiftAccess }) => {
    const handleShiftAccessClick = () => {
        onClose();
        onOpenShiftAccess();
    };

    return (
        <TooltipContainer>
            <TooltipHeader>
                <TooltipTitle>Настройки</TooltipTitle>
                <CloseButton onClick={onClose}>✕</CloseButton>
            </TooltipHeader>

            <SettingsOption onClick={handleShiftAccessClick}>
                <OptionLabel>Установить доступ к записи смен</OptionLabel>
                <OptionIcon>📅</OptionIcon>
            </SettingsOption>
        </TooltipContainer>
    );
};

export default SettingsTooltip; 