import React from 'react';
import { motion } from 'framer-motion';
import {
    DrawerOverlay,
    DrawerContainer,
    DrawerContent
} from './SlidingDrawer.styles';

// Анимации
const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3, delay: 0.1 } } // Небольшая задержка перед исчезновением фона
};

const drawerVariants = {
    hidden: { y: '80vh' }, // Начинаем ниже экрана (на всю высоту шторки)
    visible: { 
        y: 0, // Поднимаем до низа экрана
        transition: { 
            type: 'spring', // Пружинная анимация
            damping: 25, // Упругость (меньше = более упругий)
            stiffness: 150 // Жесткость (выше = быстрее)
        }
    },
    exit: { 
        y: '80vh', // Опускаем обратно
        transition: { duration: 0.25 } // Чуть быстрее, чем появление фона
    }
};

const SlidingDrawer = ({ children, onClose }) => {
    return (
        <>
            {/* Оверлей для затемнения фона */}
            <DrawerOverlay
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={onClose} // Закрытие по клику на фон
            />
            {/* Сам контейнер шторки */}
            <DrawerContainer
                variants={drawerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                {/* Сюда можно добавить "ручку" для закрытия, если нужно */}
                {/* <DrawerHandle /> */}
                <DrawerContent>
                    {children} { /* Рендерим дочерний компонент (CreateEvent) */}
                </DrawerContent>
            </DrawerContainer>
        </>
    );
};

export default SlidingDrawer; 