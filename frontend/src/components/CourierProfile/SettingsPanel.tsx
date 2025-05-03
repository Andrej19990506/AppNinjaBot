import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import EventNoteIcon from '@mui/icons-material/EventNote';
import TuneIcon from '@mui/icons-material/Tune';
import ArticleIcon from '@mui/icons-material/Article';
import CloseIcon from '@mui/icons-material/Close';

// Анимация выезда панели
const slideInRight = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

// Анимация скрытия панели
const slideOutRight = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
`;

// Стилизуем контейнер как боковую панель
const SidePanelContainer = styled.div<{ $isOpen: boolean; }>`
    padding-top: 50px;    
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0; 
    width: 40%;
    max-width: 450px; /* Добавим максимальную ширину для больших экранов */
    min-width: 300px; /* И минимальную */
    background: radial-gradient(circle at top right, var(--orange-dark) 0%, var(--orange-primary) 100%);
    box-shadow: -5px 0px 15px rgba(0, 0, 0, 0.15);
    z-index: 1100; /* Выше других элементов */
    border-left: 1px solid var(--border-color);
    /* Убираем animation */
    /* animation: ${props => props.$isOpen ? slideInRight : slideOutRight} 0.3s ease-out forwards; */
    /* Используем transition и transform */
    transform: translateX(${props => props.$isOpen ? '0' : '100%'});
    transition: transform 0.2s ease-out;
    display: flex;
    flex-direction: column; /* Чтобы контент растягивался */
    padding-bottom: env(safe-area-inset-bottom, 0);

    /* Убираем хвостик тултипа */
    /* &::before { ... } */

    @media (max-width: 768px) {
        width: 60%;
    }

    @media (max-width: 480px) {
        width: 100%;
        max-width: none;
        min-width: 0;
    }
`;

const PanelHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color-on-primary, rgba(255, 255, 255, 0.2));
    background: transparent;
    position: sticky;
    top: 0;
    z-index: 1;
`;

const PanelTitle = styled.h3`
    margin: 0;
    color: var(--text-color-on-primary);
    font-size: 1.2rem; /* Немного увеличим */
    font-weight: 600;
    display: flex;
    align-items: center;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: var(--text-color-on-primary);
    cursor: pointer;
    padding: 8px; /* Увеличим область клика */
    border-radius: 50%;
    transition: background-color var(--transition-fast), color var(--transition-fast);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px; /* Увеличим кнопку */
    height: 36px;

    &:hover {
        background: rgba(255, 255, 255, 0.15);
    }
`;

const PanelContent = styled.div`
    padding: 24px;
    flex-grow: 1; 
    overflow-y: auto; 
`;

// Убираем стили для выбора дня
// const DaySelectorContainer = styled.div` ... `;
// const SelectorLabel = styled.label` ... `;
// const DaySelect = styled.select` ... `;

// Убираем $disabled из стилей опции
const SettingsOption = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-radius: var(--radius-md);
    cursor: pointer; // Всегда pointer
    transition: background-color var(--transition-normal), transform var(--transition-fast);
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-color-on-primary, rgba(255, 255, 255, 0.1));

    &:last-child {
        margin-bottom: 0;
        border-bottom: none;
    }

    &:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateX(3px);
    }
`;

const OptionLabel = styled.span`
    color: var(--text-color-on-primary);
    font-size: 1rem; /* Увеличим шрифт */
    font-weight: 500;
`;

const OptionIcon = styled.span`
    font-size: 22px; /* Увеличим иконку */
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 16px; /* Добавим отступ слева */
    color: var(--text-color-on-primary);
`;

interface SettingsPanelProps { 
    isOpen: boolean;
    onClose: () => void;
    onOpenShiftAccess: () => void;
    onOpenSlotSettings: () => void; 
    onOpenTimesheet: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    isOpen, 
    onClose, 
    onOpenShiftAccess,
    onOpenSlotSettings,
    onOpenTimesheet 
}) => {
    const [hasMounted, setHasMounted] = useState(false);

    console.log(`[SettingsPanel] Render. Props isOpen: ${isOpen}, State hasMounted: ${hasMounted}`);

    useEffect(() => {
        console.log('[SettingsPanel] useEffect executed. Setting hasMounted to true.');
        setHasMounted(true);
    }, []);

    const handleShiftAccessClick = () => {
        onOpenShiftAccess(); 
    };
    
    const handleSlotSettingsClick = () => {
        onOpenSlotSettings();
    };

    const handleTimesheetClick = () => {
        onOpenTimesheet();
    };

    console.log(`[SettingsPanel] Checking condition !hasMounted && !isOpen: ${!hasMounted && !isOpen}`);
    if (!hasMounted && !isOpen) {
        console.log('[SettingsPanel] Condition met, returning null.');
        return null;
    }

    console.log('[SettingsPanel] Condition not met or already mounted, rendering panel.');
    // Добавляем явный return для основного JSX
    return (
        <SidePanelContainer $isOpen={isOpen}>
            <PanelHeader>
                <PanelTitle>Настройки</PanelTitle>
                <CloseButton onClick={onClose}><CloseIcon fontSize="inherit" /></CloseButton>
            </PanelHeader>

            <PanelContent>
                <SettingsOption onClick={handleShiftAccessClick}>
                    <OptionLabel>Доступ к записи смен</OptionLabel>
                    <OptionIcon><EventNoteIcon fontSize="inherit" /></OptionIcon>
                </SettingsOption>
                <SettingsOption onClick={handleSlotSettingsClick}> 
                    <OptionLabel>Настройка слотов</OptionLabel>
                    <OptionIcon><TuneIcon fontSize="inherit" /></OptionIcon> 
                </SettingsOption>
                <SettingsOption onClick={handleTimesheetClick}>
                    <OptionLabel>Табель</OptionLabel>
                    <OptionIcon><ArticleIcon fontSize="inherit" /></OptionIcon>
                </SettingsOption>
            </PanelContent>
        </SidePanelContainer>
    );
};

export default SettingsPanel; 