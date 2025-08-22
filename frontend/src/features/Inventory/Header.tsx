import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { animate } from 'framer-motion';
import styles from './Header.module.css';

interface HeaderProps {
    title: string;
    progress: number;
    notifications: Array<{
        id: string;
        type: string;
        message?: string;
        title?: string;
    }>;
    hasUnreadNotifications: boolean;
    onNotificationClose: (id: string) => void;
    isInitialContext?: boolean;
    startTime?: string; // Время начала инвентаризации
}

const Header: React.FC<HeaderProps> = ({
    title,
    progress,
    notifications,
    hasUnreadNotifications,
    onNotificationClose,
    isInitialContext = false,
    startTime
}) => {
    const [animatedProgress, setAnimatedProgress] = useState(progress);
    const [timerDisplay, setTimerDisplay] = useState<string>('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showExpandButton, setShowExpandButton] = useState(false);

    // Автоматическое сворачивание через 10 секунд
    useEffect(() => {
        const collapseTimer = setTimeout(() => {
            setIsCollapsed(true);
            setShowExpandButton(true);
        }, 10000);

        return () => clearTimeout(collapseTimer);
    }, []);

    // Функция разворачивания хедера
    const handleExpand = () => {
        setIsCollapsed(false);
        setShowExpandButton(false);
        
        // Через 10 секунд снова сворачиваем
        setTimeout(() => {
            setIsCollapsed(true);
            setShowExpandButton(true);
        }, 10000);
    };

    // Обновляем таймер каждую секунду без перерендера всего компонента
    useEffect(() => {
        // Если нет startTime, но есть progress > 0, пытаемся найти startTime в localStorage
        let effectiveStartTime = startTime;
        
        if (!effectiveStartTime && progress > 0) {
            const storedStartTime = localStorage.getItem('inventory_start_time');
            if (storedStartTime) {
                effectiveStartTime = storedStartTime;
                console.log('🔍 [Header] Восстановлен startTime из localStorage:', effectiveStartTime);
            }
        }
        
        if (!effectiveStartTime || progress === 0) {
            setTimerDisplay('');
            return;
        }

        const timer = setInterval(() => {
            try {
                const start = new Date(effectiveStartTime);
                const currentTime = new Date();
                
                // Проверяем, что время корректно парсится
                if (isNaN(start.getTime())) {
                    console.error('Некорректное время startTime:', effectiveStartTime);
                    setTimerDisplay('');
                    return;
                }
                
                const duration = currentTime.getTime() - start.getTime();
                
                if (duration < 0) {
                    setTimerDisplay('');
                    return;
                }
                
                // Вычисляем часы, минуты и секунды
                const totalSeconds = Math.floor(duration / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                
                // Форматируем время в ЧЧ:ММ:СС
                const formatTime = (num: number) => num.toString().padStart(2, '0');
                
                let timeString: string;
                if (hours > 0) {
                    timeString = `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
                } else {
                    timeString = `${formatTime(minutes)}:${formatTime(seconds)}`;
                }
                
                setTimerDisplay(timeString);
            } catch (error) {
                console.error('Ошибка вычисления времени работы:', error);
                setTimerDisplay('');
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [startTime, progress]);

    // Логируем и сохраняем startTime в localStorage при изменениях
    useEffect(() => {
        if (startTime && progress > 0) {
            console.log('Timer Debug:', {
                startTime,
                progress,
                timestamp: new Date().toISOString()
            });
            
            // Сохраняем startTime в localStorage для восстановления после перезагрузки
            try {
                localStorage.setItem('inventory_start_time', startTime);
                console.log('🔍 [Header] Сохранен startTime в localStorage:', startTime);
            } catch (error) {
                console.error('Ошибка сохранения startTime в localStorage:', error);
            }
        } else if (progress === 0) {
            // Очищаем localStorage при сбросе инвентаризации
            try {
                localStorage.removeItem('inventory_start_time');
                console.log('🔍 [Header] Очищен startTime из localStorage при сбросе');
            } catch (error) {
                console.error('Ошибка очистки startTime из localStorage:', error);
            }
        }
    }, [startTime, progress]);

    const getDisplayTitle = () => {
        if (isInitialContext) return title;
        return title;
    };

    // Анимация прогресса
    useEffect(() => {
        const controls = animate(animatedProgress, progress, {
            duration: 1.5,
            ease: "easeInOut",
            onUpdate: (latest) => {
                setAnimatedProgress(Math.round(latest));
            }
        });
        return () => controls.stop();
    }, [progress]);

    // Получаем цвет прогресса
    const getProgressColor = () => {
        if (progress === 0) return 'var(--text-secondary)';
        if (progress === 100) return 'var(--success-color)';
        if (progress < 25) return 'var(--warning-color)';
        if (progress < 50) return 'var(--info-color)';
        if (progress < 75) return 'var(--primary-color)';
        return 'var(--success-color)';
    };

    return (
        <>
            {/* Основной хедер */}
            <motion.div 
                className={`${styles.header} ${isCollapsed ? styles.collapsed : ''}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ 
                    opacity: 1, 
                    y: 0,
                    x: isCollapsed ? -300 : 0,
                    width: isCollapsed ? 80 : 'auto'
                }}
                transition={{ 
                    duration: 0.5, 
                    ease: "easeInOut",
                    delay: isCollapsed ? 0 : 0.2
                }}
            >
                {/* Верхняя секция с заголовком и статусом */}
                <div className={styles.headerTop}>
                    <div className={styles.titleSection}>
                        <motion.h2 
                            className={styles.headerTitle}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ 
                                opacity: isCollapsed ? 0 : 1, 
                                x: isCollapsed ? -50 : 0,
                                scale: isCollapsed ? 0.8 : 1
                            }}
                            transition={{ 
                                delay: isCollapsed ? 0 : 0.3,
                                duration: 0.3
                            }}
                            data-text={getDisplayTitle()}
                        >
                            {getDisplayTitle()}
                        </motion.h2>
                    </div>
                </div>

                {/* Простые часы с абсолютным позиционированием */}
                <AnimatePresence>
                    {timerDisplay && !isCollapsed && (
                        <motion.div 
                            className={styles.simpleTimer}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                        >
                            {timerDisplay}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Секция с прогрессом и таймером */}
                <div className={styles.progressSection}>
                    {/* Прогресс бар */}
                    <motion.div 
                        className={styles.progress}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ 
                            opacity: isCollapsed ? 0 : 1, 
                            y: isCollapsed ? 20 : 0,
                            scale: isCollapsed ? 0.8 : 1
                        }}
                        transition={{ 
                            delay: isCollapsed ? 0 : 0.5,
                            duration: 0.3
                        }}
                    >
                        <motion.div 
                            className={styles.progressBar}
                            initial={false}
                            animate={{ 
                                width: `${progress}%`,
                                backgroundColor: getProgressColor()
                            }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                        
                        {/* Анимированные элементы прогресса */}
                        <div className={styles.progressOverlay}>
                            <motion.div 
                                className={styles.progressShine}
                                animate={{ 
                                    x: ['-100%', '100%'],
                                    opacity: [0, 1, 0]
                                }}
                                transition={{ 
                                    duration: 2, 
                                    repeat: Infinity, 
                                    ease: "easeInOut" 
                                }}
                            />
                        </div>

                        {/* Текст прогресса */}
                        <div className={styles.progressTextContainer}>
                            <motion.span
                                className={styles.progressText}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ 
                                    opacity: isCollapsed ? 0 : 1, 
                                    scale: isCollapsed ? 0.8 : 1
                                }}
                                transition={{ 
                                    delay: isCollapsed ? 0 : 0.6, 
                                    duration: 0.3 
                                }}
                            >
                                {animatedProgress}%
                            </motion.span>
                        </div>
                    </motion.div>

                    {/* Таймер работы */}
                    <AnimatePresence>
                        {timerDisplay && !isCollapsed && (
                            <motion.div 
                                className={styles.timerContainer}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className={styles.timerIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                        <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                </div>
                                <div className={styles.timerContent}>
                                    <div className={styles.timerLabel}>Время работы</div>
                                    <div className={styles.timerValue}>{timerDisplay}</div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Кнопка разворачивания */}
            <AnimatePresence>
                {showExpandButton && (
                    <motion.button
                        className={styles.expandButton}
                        onClick={handleExpand}
                        initial={{ opacity: 0, scale: 0.8, x: -50 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: -50 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </motion.button>
                )}
            </AnimatePresence>
        </>
    );
};

export default Header; 