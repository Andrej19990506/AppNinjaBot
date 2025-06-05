import styled from 'styled-components';
// Импортируем Z_INDICES
import { Z_INDICES } from '@features/courierSchedule/constants'; 

// Стили для главного модального окна настроек доступа к сменам

// Оверлей (затемненный фон) для модального окна
export const Overlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
`;

// Контейнер модального окна
export const ModalContainer = styled.div`
    background: var(--card-background);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 600px;
    max-height: 96vh;
    overflow-y: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    position: relative;
    z-index: ${Z_INDICES.TOOLTIP + 2};

    &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: var(--gradient-primary);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        z-index: 3;
    }

    /* Стилизация скроллбара */
    scrollbar-width: thin;
    scrollbar-color: var(--gray-400) var(--card-background);

    &::-webkit-scrollbar {
        width: 8px;
    }

    &::-webkit-scrollbar-track {
        background: var(--card-background);
        border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
        background-color: var(--gray-400);
        border-radius: 4px;
        border: 2px solid var(--card-background);
    }
`;

// Шапка модального окна с заголовком и кнопкой закрытия
export const ModalHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    background: var(--card-background);
    z-index: 2;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

// Заголовок модального окна
export const ModalTitle = styled.h2`
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-color);
    font-weight: 600;
    display: flex;
    align-items: center;
`;

// Иконка заголовка
export const HeaderIcon = styled.div`
    margin-right: 12px;
    color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
`;

// Кнопка закрытия модального окна с улучшенным дизайном и анимациями
export const CloseButton = styled.button`
    background: var(--hover-overlay);
    border: none;
    cursor: pointer;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    position: relative;
    transition: background 0.2s ease;
    
    &::before, &::after {
        content: "";
        position: absolute;
        width: 20px;
        height: 2px;
        background: currentColor;
        border-radius: 2px;
        transition: all 0.3s ease;
    }
    
    &::before {
        transform: rotate(45deg);
    }
    
    &::after {
        transform: rotate(-45deg);
    }
    
    &:hover {
        background: var(--error-background);
        color: var(--error-color);
    }
`;

// Варианты анимации для кнопки закрытия
export const closeButtonVariants = {
    initial: { 
        opacity: 0, 
        scale: 0.8,
        rotate: -90 
    },
    animate: { 
        opacity: 1, 
        scale: 1,
        rotate: 0,
        transition: { 
            duration: 0.3,
            ease: "easeOut" 
        } 
    },
    hover: { 
        scale: 1.1,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        color: "#EF4444",
        transition: { 
            duration: 0.2 
        } 
    },
    tap: { 
        scale: 0.95,
        backgroundColor: "rgba(239, 68, 68, 0.2)",
        transition: { 
            duration: 0.1 
        } 
    }
};

// Основной контент модального окна
export const ModalContent = styled.div`
    padding: 28px 24px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: var(--text-color);
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    position: relative;
    z-index: 1001;
    margin-bottom: 45px;
`;

// Секция внутри содержимого модального окна
export const Section = styled.div`    margin-bottom: 24px;
`;

// Заголовок секции
export const SectionTitle = styled.h3`
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: var(--text-color);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
`;

// Параграф текста
export const Text = styled.p`
    margin: 0 0 12px 0;
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.5;
    max-width: 400px;
`;

// Подвал модального окна с кнопками
export const ModalFooter = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color);
    background: var(--card-background);
`;

// Add new styles for success notification
export const SuccessNotificationContainer = styled.div`
    position: relative;
    z-index: 1002;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    pointer-events: auto;
`; 
