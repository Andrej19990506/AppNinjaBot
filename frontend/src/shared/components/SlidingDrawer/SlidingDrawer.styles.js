import styled from 'styled-components';
import { motion } from 'framer-motion';

export const DrawerOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6); /* Более темный фон */
    backdrop-filter: blur(8px); /* Размытие фона */
    -webkit-backdrop-filter: blur(8px); /* Для Safari */
    z-index: 999; /* Над остальным контентом */
`;

export const DrawerContainer = styled(motion.div)`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100vh; /* Полная высота экрана */
    background-color: var(--card-background); /* Фон самой шторки */
    box-shadow: 0px -4px 15px rgba(0, 0, 0, 0.1);
    z-index: 1000; /* Выше оверлея */
    display: flex;
    flex-direction: column;
    overflow: hidden; /* Предотвращает проблемы с внутренним содержимым */
`;

export const DrawerContent = styled.div`
    flex-grow: 1;
    overflow-y: auto; /* Скролл, если контент не помещается */
    padding: 0; /* Убираем отступы для полного заполнения */
    width: 100%; /* Явно указываем ширину 100% */
    display: flex; /* Используем flex для полного заполнения потомками */
    flex-direction: column;
    
    /* Обеспечиваем, чтобы дочерние элементы занимали всю доступную ширину */
    & > * {
        width: 100%;
        min-width: 100%;
        box-sizing: border-box;
    }
`;

// Можно добавить элемент для закрытия (например, ручку сверху)
// export const DrawerHandle = styled.div` ... `; 