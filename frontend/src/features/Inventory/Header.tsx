import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { animate } from 'framer-motion';
import styles from './Header.module.css';
import ChatNotification from './ChatNotification';





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
        <motion.div 
            className={styles.header}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            {/* Верхняя секция с заголовком и статусом */}
            <div className={styles.headerTop}>
                <div className={styles.titleSection}>
                    <motion.h2 
                        className={styles.headerTitle}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        data-text={getDisplayTitle()}
                    >
                        {getDisplayTitle()}
                    </motion.h2>
                </div>

                {/* Уведомления - показываем только если есть уведомления */}
                {isInitialContext && notifications.length > 0 && (
                    <ChatNotification 
                        notification={notifications[0]}
                        onClose={() => onNotificationClose(notifications[0].id)}
                        hasUnread={hasUnreadNotifications}
                    />
                )}
            </div>

            {/* Простые часы с абсолютным позиционированием */}
            {timerDisplay && (
                <div className={styles.simpleTimer}>
                    {timerDisplay}
                </div>
            )}

            {/* Секция с прогрессом и таймером */}
            <div className={styles.progressSection}>
                {/* Прогресс бар */}
                <motion.div 
                    className={styles.progress}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
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
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 0.3 }}
                        >
                            {animatedProgress}%
                        </motion.span>
                    </div>
                </motion.div>

                {/* Таймер работы */}
                {/* The timer container and its content are removed as per the edit hint. */}
            </div>
        </motion.div>
    );
};

export default Header; 