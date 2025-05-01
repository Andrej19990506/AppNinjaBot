import styled from 'styled-components';
import { motion } from 'framer-motion';

export const DrawerOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5); /* Полупрозрачный фон */
    z-index: 999; /* Над остальным контентом */
`;

export const DrawerContainer = styled(motion.div)`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80vh; /* Высота шторки */
    background-color: var(--card-background); /* Фон самой шторки */
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
    box-shadow: 0px -4px 15px rgba(0, 0, 0, 0.1);
    z-index: 1000; /* Выше оверлея */
    display: flex;
    flex-direction: column;
`;

export const DrawerContent = styled.div`
    flex-grow: 1;
    overflow-y: auto; /* Скролл, если контент не помещается */
    padding: 20px;
    /* Дополнительные стили для контента, если нужно */
`;

// Можно добавить элемент для закрытия (например, ручку сверху)
// export const DrawerHandle = styled.div` ... `; 