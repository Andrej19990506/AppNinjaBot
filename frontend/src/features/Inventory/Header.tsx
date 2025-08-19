import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { animate } from 'framer-motion';
import styles from './Header.module.css';
import ChatNotification from './ChatNotification';

// SVG иконки
const StatusIcons = {
    not_started: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    early: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    in_progress: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M7.76 16.24L4.93 19.07M19.07 4.93L16.24 7.76" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    quarter: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12L11 14L15 10" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    half: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    almost_done: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12L11 14L15 10" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    completed: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                  fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
};

const TimerIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
        <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

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

    // Определяем статус инвентаризации с учетом времени работы
    const inventoryStatus = useMemo(() => {
        if (progress === 0) return 'not_started';
        if (progress === 100) return 'completed';
        
        // Если прошло больше часа, показываем "в процессе" вместо "начальный этап"
        if (timerDisplay && timerDisplay.includes(':')) {
            const parts = timerDisplay.split(':');
            if (parts.length === 3) { // формат ЧЧ:ММ:СС
                const hours = parseInt(parts[0]);
                if (hours >= 1) {
                    if (progress < 25) return 'in_progress';
                    if (progress < 50) return 'quarter';
                    if (progress < 75) return 'half';
                    if (progress < 100) return 'almost_done';
                }
            }
        }
        
        // Стандартная логика для коротких промежутков времени
        if (progress < 25) return 'early';
        if (progress < 50) return 'quarter';
        if (progress < 75) return 'half';
        if (progress < 100) return 'almost_done';
        return 'completed';
    }, [progress, timerDisplay]);

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

    // Получаем цвет прогресса в зависимости от статуса
    const getProgressColor = () => {
        switch (inventoryStatus) {
            case 'not_started': return 'var(--text-secondary)';
            case 'early': return 'var(--warning-color)';
            case 'in_progress': return 'var(--info-color)';
            case 'quarter': return 'var(--info-color)';
            case 'half': return 'var(--primary-color)';
            case 'almost_done': return 'var(--success-color)';
            case 'completed': return 'var(--success-color)';
            default: return 'var(--primary-color)';
        }
    };

    // Получаем иконку статуса
    const getStatusIcon = () => {
        return StatusIcons[inventoryStatus] || StatusIcons.not_started;
    };

    // Получаем текст статуса
    const getStatusText = () => {
        switch (inventoryStatus) {
            case 'not_started': return 'Инвентаризация не начата';
            case 'early': return 'Начальный этап';
            case 'in_progress': return 'В процессе';
            case 'quarter': return 'Четверть пути';
            case 'half': return 'Половина пути';
            case 'almost_done': return 'Почти готово';
            case 'completed': return 'Инвентаризация завершена';
            default: return 'В процессе';
        }
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
                    
                    {/* Статус инвентаризации */}
                    <motion.div 
                        className={styles.statusBadge}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <motion.span 
                            className={styles.statusIcon}
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            {getStatusIcon()}
                        </motion.span>
                        <span className={styles.statusText}>{getStatusText()}</span>
                    </motion.div>
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