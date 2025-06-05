import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';

export const EmptyContainer = styled(motion.div)`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    width: 100%; /* <<< Растягиваем на всю доступную ширину */
    max-width: 600px; /* <<< Ограничиваем максимальную ширину на больших экранах */
    margin: 0 auto; /* <<< Центрируем по горизонтали, когда max-width активен */
    background-color: var(--card-background);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
`;

export const Content = styled(motion.div)`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px; /* Пространство между иконкой и текстом */
`;

// Определяем анимацию пульсации
const pulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.3); /* Начальный теневой ореол */
  }
  70% {
    transform: scale(1.05); /* Небольшое увеличение */
    box-shadow: 0 0 0 15px rgba(var(--primary-rgb), 0); /* Исчезающий ореол */
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0);
  }
`;

export const IconWrapper = styled(motion.div)`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: var(--primary-transparent);
    cursor: pointer;
    transition: background-color var(--transition-fast), transform var(--transition-fast);
    /* Применяем анимацию */
    animation: ${pulse} 2.5s infinite cubic-bezier(0.4, 0, 0.6, 1); /* Имя, длительность, бесконечность, функция времени */

    &:hover {
        /* При наведении останавливаем основную анимацию и делаем ховер-эффект */
        animation-play-state: paused; /* Ставим основную анимацию на паузу */
        background-color: rgba(var(--primary-rgb), 0.15);
        transform: scale(1.1); /* Делаем увеличение при наведении чуть больше */
        box-shadow: 0 0 10px rgba(var(--primary-rgb), 0.2); /* Добавляем тень при ховере */
    }

    &:active {
        transform: scale(0.98);
        animation-play-state: paused; /* Пауза при клике */
    }
`;

export const IconSvg = styled.svg`
    width: 40px;
    height: 40px;
    color: var(--primary-color); /* Используем основной цвет для иконки */
    stroke-width: 2;
`;

export const Text = styled(motion.p)`
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
`;

export const MotionCircle = styled(motion.circle)`
    stroke: currentColor;
    stroke-width: inherit; /* Наследуем от SVG */
`;

export const MotionPath = styled(motion.path)`
    stroke: currentColor;
    stroke-width: inherit; /* Наследуем от SVG */
    stroke-linecap: round;
`; 