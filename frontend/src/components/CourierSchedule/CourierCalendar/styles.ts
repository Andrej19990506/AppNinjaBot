import styled from 'styled-components';
import { Z_INDICES } from './constants';

export const CalendarContainer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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
    margin: 0 auto;
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
    
    @media (max-width: 480px) {
        padding: 0;
        margin-bottom: 20px;
        width: 100%;
    }
`; 