import React, { useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

const Container = styled(motion.div)`
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    position: relative;
    max-height: 60vh; /* Максимальная высота для активации скроллинга */
    
    /* Стилизация скроллбара */
    &::-webkit-scrollbar {
        width: 6px;
    }
    
    &::-webkit-scrollbar-track {
        background: var(--background-light);
        border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
        background-color: var(--border-color);
        border-radius: 3px;
        
        &:hover {
            background-color: var(--primary-light);
        }
    }
    
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) var(--background-light);
`;

const StepContent = styled(motion.div)`
    width: 100%;
`;

// Варианты анимации для перелистывания
const stepVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => ({
        x: direction < 0 ? '100%' : '-100%',
        opacity: 0
    })
};

interface StepsContainerProps {
    children: React.ReactNode;
    currentStep: number;
    direction: number;
    onSwipe: (direction: number) => void;
    swipeThreshold?: number;
    maxHeight?: string; // Опция для задания максимальной высоты контейнера
}

const StepsContainer: React.FC<StepsContainerProps> = ({
    children,
    currentStep,
    direction,
    onSwipe,
    swipeThreshold = 100,
    maxHeight
}) => {
    // Обработчик завершения свайпа
    const handleDragEnd = useCallback((e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        // Проверяем, что свайп был преимущественно горизонтальным
        // Это позволяет отличать свайп от скролла
        const isHorizontalSwipe = Math.abs(info.offset.x) > Math.abs(info.offset.y);
        
        if (isHorizontalSwipe && Math.abs(info.offset.x) > swipeThreshold) {
            const direction = info.offset.x > 0 ? 1 : -1;
            onSwipe(direction);
        }
    }, [onSwipe, swipeThreshold]);

    return (
        <Container
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ maxHeight: maxHeight || '60vh' }}
        >
            {/* @ts-ignore: Ignoring type errors with AnimatePresence */}
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <StepContent
                    key={currentStep}
                    custom={direction}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 }
                    }}
                >
                    {children}
                </StepContent>
            </AnimatePresence>
        </Container>
    );
};

export default React.memo(StepsContainer); 