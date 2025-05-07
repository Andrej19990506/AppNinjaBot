import React, { useCallback, useRef, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import styles from './CategoryGrid.module.css';
import { Inventory } from '../../types/inventoryTypes';
import AnimatePresenceWrapper from '../common/AnimatePresenceWrapper';

interface CategoryGridProps {
    categories: string[];
    onSelect: (category: string) => void;
    inventory: Inventory;
    selectedCategory: string | null;
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onSelect, inventory, selectedCategory }) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();
    
    // Эффект для анимации при монтировании
    useEffect(() => {
        controls.start("show");
    }, [controls]);
    
    // Эффект для обработки вертикального скролла и преобразования его в горизонтальный
    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        
        const handleWheel = (e: WheelEvent) => {
            // Предотвращаем стандартное поведение скролла
            e.preventDefault();
            
            // Определяем скорость и направление скролла
            const scrollAmount = e.deltaY || e.deltaX;
            
            // Прокручиваем горизонтально
            grid.scrollLeft += scrollAmount;
        };
        
        // Добавляем обработчик события
        grid.addEventListener('wheel', handleWheel, { passive: false });
        
        // Очищаем обработчик при размонтировании
        return () => {
            grid.removeEventListener('wheel', handleWheel);
        };
    }, []);
    
    // Проверяем заполненность категории
    const isCategoryFilled = useCallback((category: string) => {
        const items = inventory[category] || {};
        return Object.values(items).every(item => {
            // Если товар помечен как "нет в наличии", он считается заполненным
            if (item.raw?.isOutOfStock) {
                return true;
            }

            // Проверяем заполненность сырья (должно быть filled === true ИЛИ quantity > 0)
            const isRawFilled = item.raw?.filled === true || (item.raw?.quantity ?? 0) > 0;
            
            // Проверяем наличие и заполненность полуфабриката
            const hasSemifinished = Boolean(item.semifinished);
            const isSemifinishedFilled = hasSemifinished ? 
                (item.semifinished?.filled === true || (item.semifinished?.quantity ?? 0) > 0) : 
                true;
            
            // Товар считается заполненным если:
            // - сырье заполнено (filled === true ИЛИ quantity > 0) И
            // - (либо нет полуфабриката, либо полуфабрикат тоже заполнен)
            return isRawFilled && (!hasSemifinished || isSemifinishedFilled);
        });
    }, [inventory]);

    if (!categories.length) {
        return (
            <motion.div 
                className={styles.placeholder}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <p>Нет доступных категорий</p>
            </motion.div>
        );
    }

    const handleCategoryClick = (category: string) => {
        console.log('Category clicked:', category);
        console.log('Inventory for category:', inventory[category]);
        onSelect(category);
    };

    // Сортируем категории: незаполненные вверху
    const sortedCategories = [...categories].sort((a, b) => {
        const aFilled = isCategoryFilled(a);
        const bFilled = isCategoryFilled(b);
        
        if (aFilled && !bFilled) return 1;
        if (!aFilled && bFilled) return -1;
        return a.localeCompare(b);
    });

    // Анимация для контейнера
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    // Анимация для отдельных карточек
    const itemVariants = {
        hidden: { 
            opacity: 0,
            y: 20,
            scale: 0.95
        },
        show: { 
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 25
            }
        }
    };

    return (
        <motion.div 
            className={styles.container}
            variants={containerVariants}
            initial="hidden"
            animate={controls}
        >
            <motion.div 
                className={styles.grid}
                ref={gridRef}
            >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {/* @ts-ignore */}
                <AnimatePresence mode="sync">
                    {sortedCategories.map((category, index) => {
                        const isFilled = isCategoryFilled(category);
                        return (
                            <motion.div
                                key={category}
                                className={`${styles.item} ${isFilled ? styles.filled : ''}`}
                                onClick={() => handleCategoryClick(category)}
                                variants={itemVariants}
                                whileHover={{ 
                                    scale: 1.02,
                                    y: -5,
                                    transition: { duration: 0.2 }
                                }}
                                whileTap={{ scale: 0.98 }}
                                layout
                            >
                                <h3 className={styles.title}>{category}</h3>
                                {isFilled && (
                                    <motion.div 
                                        className={styles.checkmark}
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 500,
                                            damping: 30,
                                            delay: 0.1 + index * 0.05
                                        }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <motion.path 
                                                d="M20 7L9 18L4 13"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ 
                                                    duration: 0.5,
                                                    delay: 0.2 + index * 0.05
                                                }}
                                            />
                                        </svg>
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default CategoryGrid; 