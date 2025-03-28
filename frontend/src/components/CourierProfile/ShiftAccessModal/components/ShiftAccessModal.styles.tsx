import styled from 'styled-components';
import { motion } from 'framer-motion';

// Стили для главного модального окна настроек доступа к сменам

// Оверлей (затемненный фон) для модального окна
export const Overlay = styled(motion.div)`
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

// Контейнер модального окна с анимацией
export const ModalContainer = styled(motion.div)`
    background: var(--card-background);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    position: relative;

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
export const CloseButton = styled(motion.button)`
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
`;

// Секция внутри содержимого модального окна
export const Section = styled.div`
    margin-bottom: 24px;
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

// Варианты анимации для кнопки закрытия
export const closeButtonVariants = {
    initial: { 
        scale: 0.8, 
        rotate: -90,
        opacity: 0 
    },
    animate: { 
        scale: 1, 
        rotate: 0,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 20
        }
    },
    hover: { 
        scale: 1.1,
        rotate: 180,
        transition: {
            type: "spring",
            stiffness: 400,
            damping: 10
        }
    },
    tap: { 
        scale: 0.9,
        transition: {
            type: "spring",
            stiffness: 800,
            damping: 15
        }
    }
};

// Предустановленные варианты анимации
export const animationVariants = {
    // Варианты анимации для фона
    overlay: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
    },
    
    // Варианты анимации для модального окна
    modal: {
        hidden: { y: "100%" },
        visible: { y: 0 }
    }
};

// Настройки анимации для плавного появления/исчезновения
export const animationTransition = {
    // Для фона
    overlay: { 
        duration: 0.3 
    },
    
    // Для модального окна (пружинная анимация)
    modal: {
        type: "spring",
        damping: 30,
        stiffness: 300
    }
}; 