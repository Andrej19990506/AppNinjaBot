import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
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
    // Состояние для отслеживания перетаскивания
    const [isDragging, setIsDragging] = useState(false);
    
    // Значение для отслеживания позиции Y при перетаскивании
    const y = useMotionValue(0);
    
    // Прозрачность оверлея в зависимости от позиции перетаскивания
    const overlayOpacity = useTransform(y, [0, 300], [1, 0.5]);
    
    // Референс на контейнер для вычисления высоты
    const drawerRef = useRef(null);
    
    // Обработчик окончания перетаскивания
    const handleDragEnd = (event, info) => {
        const threshold = 150; // Порог для закрытия шторки (в пикселях)
        
        // Если перетащили вниз больше порогового значения, закрываем шторку
        if (info.offset.y > threshold) {
            onClose();
        } else {
            // Иначе возвращаем шторку на место
            y.set(0);
        }
        
        setIsDragging(false);
    };
    
    return (
        <>
            {/* Оверлей для затемнения фона */}
            <DrawerOverlay
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={onClose} // Закрытие по клику на фон
                style={{ opacity: overlayOpacity }} // Привязываем прозрачность к перетаскиванию
            />
            {/* Сам контейнер шторки */}
            <DrawerContainer
                ref={drawerRef}
                variants={drawerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag="y" // Разрешаем перетаскивание по оси Y
                dragConstraints={{ top: 0, bottom: 0 }} // Ограничения перетаскивания
                dragElastic={0.2} // Эластичность перетаскивания
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                style={{ y }} // Привязываем позицию Y к значению из useMotionValue
            >
                <DrawerContent>
                    {children} { /* Рендерим дочерний компонент */}
                </DrawerContent>
            </DrawerContainer>
        </>
    );
};

export default SlidingDrawer; 