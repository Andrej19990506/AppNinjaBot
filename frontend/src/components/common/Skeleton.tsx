import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Skeleton.module.css';

interface SkeletonProps {
    variant?: 'text' | 'rectangular' | 'circular';
    width?: string | number;
    height?: string | number;
    className?: string;
    animation?: 'pulse' | 'wave' | 'shimmer';
    children?: React.ReactNode;
    theme?: 'light' | 'dark';
    customColors?: {
        from?: string;
        via?: string;
        to?: string;
    };
    count?: number;
    layout?: boolean;
}

// Интерфейс для скелетона по типу компонента
interface SkeletonByTypeProps {
    type: 'mainMenu' | 'inventory' | 'writeOff' | 'chatList';
    animation?: 'pulse' | 'wave' | 'shimmer';
    theme?: 'light' | 'dark';
    onAnimationComplete?: () => void;
}

// Компонент для скелетона главного меню
export const MainMenuSkeleton: React.FC<{
    animation?: 'pulse' | 'wave' | 'shimmer';
    theme?: 'light' | 'dark';
    onAnimationComplete?: () => void;
}> = ({ animation = 'shimmer', theme = 'dark', onAnimationComplete }) => {
    const menuItems = [
        { id: 'events', title: 'События' },
        { id: 'inventory', title: 'Инвентарь' },
        { id: 'write-off', title: 'Списание' }
    ];

    // Вызываем колбэк после задержки, чтобы обеспечить время для отображения скелетона
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onAnimationComplete) {
                onAnimationComplete();
            }
        }, 800);
        
        return () => clearTimeout(timer);
    }, [onAnimationComplete]);

    // Варианты анимации для плавного появления всех элементов вместе
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.06,
                delayChildren: 0.1,
                when: 'beforeChildren',
                duration: 0.3,
                ease: "easeOut"
            }
        },
        exit: {
            opacity: 0,
            scale: 0.96,
            filter: "blur(8px)",
            transition: {
                duration: 0.8,
                ease: "easeOut",
                when: 'afterChildren'
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 5, scale: 0.98 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { 
                duration: 0.2,
                ease: "easeOut"
            } 
        },
        exit: { 
            opacity: 0, 
            scale: 0.95,
            transition: { 
                duration: 0.2,
                ease: "easeOut"
            } 
        }
    };

    return (
        <motion.div 
            className={styles.mainMenuContainer}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            {/* Заголовок */}
            <motion.div variants={itemVariants}>
                <Skeleton
                    variant="rectangular"
                    width="180px"
                    height="36px"
                    animation={animation}
                    theme={theme}
                    className={styles.mainMenuTitle}
                />
            </motion.div>
            
            {/* Сетка меню */}
            <div className={styles.mainMenuGrid}>
                {menuItems.map((item, index) => (
                    <motion.div
                        key={item.id}
                        className={styles.mainMenuItem}
                        variants={itemVariants}
                        whileHover={{ 
                            scale: 1.03, 
                            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
                            transition: { 
                                duration: 0.2,
                                ease: "easeOut"
                            }
                        }}
                    >
                        {/* Иконка */}
                        <Skeleton
                            variant="circular"
                            width="40px"
                            height="40px"
                            animation={animation}
                            theme={theme}
                            className={styles.mainMenuIcon}
                        />
                        
                        {/* Текст меню */}
                        <Skeleton
                            variant="rectangular"
                            width="100px"
                            height="16px"
                            animation={animation}
                            theme={theme}
                            className={styles.mainMenuItemTitle}
                        />
                    </motion.div>
                ))}
            </div>
            
            {/* Кнопка переключения темы */}
            <motion.div
                className={styles.mainMenuThemeButton}
                variants={itemVariants}
            >
                <Skeleton
                    variant="rectangular"
                    width="150px"
                    height="38px"
                    animation={animation}
                    theme={theme}
                    className={styles.mainMenuButtonSkeleton}
                />
            </motion.div>
        </motion.div>
    );
};

// Компонент для скелетона списка чатов
export const ChatListSkeleton: React.FC<{
    animation?: 'pulse' | 'wave' | 'shimmer';
    theme?: 'light' | 'dark';
    onAnimationComplete?: () => void;
    itemCount?: number;
    loadingProgress?: number;
}> = ({ animation = 'shimmer', theme = 'dark', itemCount = 1, loadingProgress = 0 }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.06,
                delayChildren: 0.1,
                when: 'beforeChildren',
                duration: 0.3,
                ease: "easeOut"
            }
        }
    };

    const itemVariants = {
        hidden: { 
            opacity: 0, 
            y: -20,
            scale: 0.95
        },
        visible: { 
            opacity: 1, 
            y: 0,
            scale: 1,
            transition: { 
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
            } 
        }
    };

    return (
        <motion.div 
            className={styles.container}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Заголовок "Выберите чат для инвентаризации" */}
            <motion.div 
                className={styles.titleContainer}
                variants={itemVariants}
            >
                <div className={styles.titleWrapper}>
                    <Skeleton
                        variant="rectangular"
                        width="clamp(280px, 50vw, 400px)"
                        height="clamp(36px, 5vw, 48px)"
                        animation={animation}
                        theme={theme}
                        className={styles.titleSkeleton}
                    />
                </div>
            </motion.div>
            
            {/* Индикатор прогресса загрузки */}
            <motion.div 
                className={styles.progressContainer}
                variants={itemVariants}
            >
                <motion.div 
                    className={styles.progressBar}
                    initial={{ width: '0%' }}
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ duration: 0.3 }}
                />
            </motion.div>
            
            {/* Карточки чатов */}
            <motion.div 
                className={styles.chatList}
                variants={itemVariants}
            >
                {Array.from({ length: itemCount }).map((_, index) => (
                    <div key={index} className={styles.chatSkeleton}>
                        {/* Заголовок чата */}
                        <div className={styles.chatHeader}>
                            <div className={styles.chatInfo}>
                                <div className={styles.chatTitleWrapper}>
                                    <Skeleton
                                        variant="rectangular"
                                        width="180px"
                                        height="24px"
                                        animation={animation}
                                        theme={theme}
                                        className={styles.chatTitle}
                                    />
                                    <Skeleton
                                        variant="rectangular"
                                        width="80px"
                                        height="20px"
                                        animation={animation}
                                        theme={theme}
                                        className={styles.statusBadge}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Секция прогресса */}
                        <div className={styles.progressSection}>
                            <div className={styles.progressInfo}>
                                <div className={styles.progressStatus}>
                                    <Skeleton
                                        variant="circular"
                                        width="24px"
                                        height="24px"
                                        animation={animation}
                                        theme={theme}
                                        className={styles.icon}
                                    />
                                    <Skeleton
                                        variant="rectangular"
                                        width="45px"
                                        height="20px"
                                        animation={animation}
                                        theme={theme}
                                        className={styles.progressText}
                                    />
                                </div>
                                <div className={styles.progressActions}>
                                    <Skeleton
                                        variant="circular"
                                        width="32px"
                                        height="32px"
                                        animation={animation}
                                        theme={theme}
                                        className={styles.resetButton}
                                    />
                                </div>
                            </div>
                            <Skeleton
                                variant="rectangular"
                                width="100%"
                                height="4px"
                                animation={animation}
                                theme={theme}
                                className={styles.progress}
                            />
                        </div>

                        {/* Футер с временем последнего обновления */}
                        <div className={styles.chatFooter}>
                            <div className={styles.lastInventory}>
                                <Skeleton
                                    variant="circular"
                                    width="20px"
                                    height="20px"
                                    animation={animation}
                                    theme={theme}
                                    className={styles.icon}
                                />
                                <Skeleton
                                    variant="rectangular"
                                    width="200px"
                                    height="16px"
                                    animation={animation}
                                    theme={theme}
                                    className={styles.lastUpdate}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </motion.div>
            
            {/* Контейнер с кнопками */}
            <motion.div
                className={styles.chatSelectorContainer}
                variants={itemVariants}
            >
                {/* Кнопка домой */}
                <Skeleton
                    variant="circular"
                    width="56px"
                    height="56px"
                    animation={animation}
                    theme={theme}
                    className={styles.homeButton}
                />
                
                {/* Кнопка открытия списка */}
                <Skeleton
                    variant="circular"
                    width="56px"
                    height="56px"
                    animation={animation}
                    theme={theme}
                    className={styles.chatSelectorButton}
                />
            </motion.div>
        </motion.div>
    );
};

// Обновляем компонент SkeletonByType
export const SkeletonByType: React.FC<SkeletonByTypeProps> = ({ 
    type, 
    animation = 'shimmer', 
    theme = 'dark',
    onAnimationComplete
}) => {
    switch (type) {
        case 'mainMenu':
            return <MainMenuSkeleton animation={animation} theme={theme} onAnimationComplete={onAnimationComplete} />;
        case 'inventory':
            // TODO: добавить скелетон для инвентаря
            return <div>Inventory Skeleton</div>;
        case 'writeOff':
            // TODO: добавить скелетон для списания
            return <div>WriteOff Skeleton</div>;
        case 'chatList':
            return <ChatListSkeleton animation={animation} theme={theme} />;
        default:
            return null;
    }
};

const Skeleton: React.FC<SkeletonProps> = ({
    variant = 'rectangular',
    width,
    height,
    className,
    animation = 'pulse',
    children,
    theme = 'dark',
    customColors,
    count = 1,
    layout = false
}) => {
    const getDefaultColors = () => {
        if (theme === 'light') {
            return {
                from: 'rgba(255, 255, 255, 0.1)',
                via: 'rgba(255, 255, 255, 0.2)',
                to: 'rgba(255, 255, 255, 0.1)'
            };
        }
        return {
            from: 'rgba(42, 42, 42, 0.8)',
            via: 'rgba(58, 58, 58, 0.8)',
            to: 'rgba(42, 42, 42, 0.8)'
        };
    };

    const colors = customColors || getDefaultColors();

    const getAnimation = () => {
        switch (animation) {
            case 'pulse':
                return {
                    opacity: [0.5, 0.8, 0.5],
                    transition: {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                    }
                };
            case 'wave':
                return {
                    x: ['-100%', '100%'],
                    transition: {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                    }
                };
            case 'shimmer':
                return {
                    background: [
                        `linear-gradient(90deg, ${colors.from} 0%, ${colors.via} 50%, ${colors.to} 100%)`,
                        `linear-gradient(90deg, ${colors.via} 0%, ${colors.to} 50%, ${colors.via} 100%)`,
                        `linear-gradient(90deg, ${colors.to} 0%, ${colors.from} 50%, ${colors.to} 100%)`
                    ],
                    transition: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear"
                    }
                };
            default:
                return {};
        }
    };

    const getSkeletonStyle = () => {
        const baseStyle: React.CSSProperties = {
            width,
            height,
            background: colors.from
        };

        if (variant === 'circular') {
            baseStyle.borderRadius = '50%';
        } else if (variant === 'text') {
            baseStyle.borderRadius = '4px';
            baseStyle.height = height || '1em';
        } else {
            baseStyle.borderRadius = '8px';
        }

        return baseStyle;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: {
                duration: 0.3
            }
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                layout={layout}
                className={styles.flex}
            >
                {Array.from({ length: count }).map((_, index) => (
                    <motion.div
                        key={index}
                        variants={itemVariants}
                        className={`${styles.skeleton} ${styles[variant]} ${className || ''} ${styles[theme]}`}
                        style={getSkeletonStyle()}
                        animate={getAnimation()}
                        layout={layout}
                    >
                        {children}
                    </motion.div>
                ))}
            </motion.div>
        </AnimatePresence>
    );
};

export default Skeleton; 