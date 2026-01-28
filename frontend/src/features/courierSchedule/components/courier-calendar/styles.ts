import styled, { keyframes } from 'styled-components';
import { Z_INDICES } from '../../constants';

// --- Анимации --- 
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

// --- Стили --- 

export const CalendarContainer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    background: var(--card-background);
    z-index: ${Z_INDICES.CALENDAR_HEADER};
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    -webkit-overflow-scrolling: touch;
    max-width: 100vw;
    /* Предотвращаем зуммирование при тапе на iOS */
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    
    /* Предотвращаем выплывание за пределы экрана и зум на iOS */
    overflow-x: hidden !important;  
    width: 100vw;
    /* Важно для предотвращения зума на iOS */
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    perspective: 1000;
    -webkit-perspective: 1000;
    isolation: isolate;
`;

export const MonthsContainer = styled.div`
    flex: 1;
    padding: 8px 0;
    max-width: 100%;
    margin: 0 auto 0 auto;
    width: 100%;
    overflow-x: hidden;
    /* Предотвращаем зуммирование при тапе на iOS */
    touch-action: manipulation;
    -ms-touch-action: manipulation;
    
    /* Предотвращаем выплывание за пределы экрана на iOS */
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    
    /* Выравнивание календаря по центру */
    display: flex;
    flex-direction: column;
    align-items: center;
    
    @media (min-width: 768px) {
        padding: 12px;
        max-width: 480px;
    }
    
    @media (max-width: 480px) {
        max-width: 100vw;
        width: 100%;
        padding: 8px 4px; /* Меньшие боковые отступы для предотвращения выхода за пределы экрана */
    }
`;

// Добавляем контейнер для отдельного месяца
export const MonthContainer = styled.div`
    width: 100%;
    max-width: 100%;
    margin-bottom: 24px;
    box-sizing: border-box;

    &:first-child {
        margin-top: 16px;
    }
    

    @media (max-width: 480px) {
        padding: 0;
        margin-bottom: 20px;
        width: 100%;
        
        &:last-child {
            margin-bottom: 60px;
        }
    }
`;

// Оверлей для настроек
export const SettingsOverlay = styled.div<{ $isOpen: boolean }>`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4); // Полупрозрачный темный фон
    backdrop-filter: blur(4px); // Размытие
    -webkit-backdrop-filter: blur(4px); // Для Safari
    z-index: 950; // Ниже футера (1051) и ниже SlotSettingsContainer (1000)
    opacity: ${props => props.$isOpen ? 1 : 0};
    pointer-events: ${props => props.$isOpen ? 'auto' : 'none'}; // Отключаем клики, когда не видно
    animation: ${props => props.$isOpen ? fadeIn : fadeOut} 0.3s ease-in-out forwards;
`;

// Контейнер настроек слотов, выезжающий снизу
export const SlotSettingsContainer = styled.div<{ $isOpen: boolean }>`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--card-background);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    border-top: 3px solid var(--orange-primary);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    padding: 24px 16px;
    transform: translateY(${props => props.$isOpen ? '0' : '100%'});
    transition: transform 0.3s ease-in-out;
    pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
    z-index: 1000; /* Значение ниже футера (z-index 1051) */
    max-height: 89vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
`;

export const SlotSettingsHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
`;

export const SlotSettingsTitle = styled.h3`
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-color);
`;

export const CloseSettingsButton = styled.button`
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
        background-color: var(--hover-overlay);
        color: var(--text-color);
    }
`;

export const SlotSettingsContent = styled.div`
    flex: 1;
    text-align: center;
    color: var(--text-secondary);
    font-size: 1.1rem;
`; 