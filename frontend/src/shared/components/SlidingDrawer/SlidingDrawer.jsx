import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
    DrawerOverlay,
    DrawerContainer,
    DrawerContent
} from './SlidingDrawer.styles';

// Анимации
const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
    exit: { opacity: 0, transition: { duration: 0.3, delay: 0.1 } } // Небольшая задержка перед исчезновением фона
};

const drawerVariants = {
    hidden: { y: '100vh' }, // Начинаем ниже экрана (на всю высоту экрана)
    visible: { 
        y: 0, // Поднимаем до низа экрана
        transition: { 
            type: 'spring', // Пружинная анимация
            damping: 30, // Упругость (меньше = более упругий)
            stiffness: 200, // Жесткость (выше = быстрее)
            duration: 0.6
        }
    },
    exit: { 
        y: '100vh', // Опускаем обратно
        transition: { 
            type: 'spring',
            damping: 25,
            stiffness: 300,
            duration: 0.4
        }
    }
};

const SlidingDrawer = ({ children, onClose }) => {
    // Состояние для отслеживания перетаскивания
    const [isDragging, setIsDragging] = useState(false);
    
    // Значение для отслеживания позиции Y при перетаскивании
    const y = useMotionValue(0);
    
    // Прозрачность оверлея в зависимости от позиции перетаскивания
    const overlayOpacity = useTransform(y, [0, 300], [1, 0.3]);
    
    // Референс на контейнер для вычисления высоты
    const drawerRef = useRef(null);
    
    // 🚫 Блокировка скролла страницы при открытии модалки
    useEffect(() => {
        // Сохраняем текущее значение overflow для восстановления
        const originalStyle = window.getComputedStyle(document.body).overflow;
        
        // Блокируем скролл
        document.body.style.overflow = 'hidden';
        
        // Восстанавливаем скролл при размонтировании
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);
    
    // Обработчик окончания перетаскивания
    const handleDragEnd = (event, info) => {
        const threshold = 200; // Увеличиваем порог для закрытия шторки (в пикселях)
        
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
                dragConstraints={{ top: 0, bottom: 600 }} /* Увеличиваем лимит перетаскивания */
                dragElastic={0.1} // Уменьшаем эластичность для более контролируемого перетаскивания
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