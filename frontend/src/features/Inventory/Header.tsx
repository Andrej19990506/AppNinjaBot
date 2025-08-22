import React, { useEffect, useState } from 'react';
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
    isEditing?: boolean; // Флаг режима редактирования
}

const Header: React.FC<HeaderProps> = ({
    title,
    progress,
    notifications,
    hasUnreadNotifications,
    onNotificationClose,
    isInitialContext = false,
    startTime,
    isEditing = false
}) => {
    const [animatedProgress, setAnimatedProgress] = useState(progress);
    const [timerDisplay, setTimerDisplay] = useState<string>('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showExpandButton, setShowExpandButton] = useState(false);

    // Автоматическое сворачивание через 15 секунд (только если не в режиме редактирования)
    useEffect(() => {
        console.log('🔍 [Header] isEditing:', isEditing);
        
        // Если пользователь в режиме редактирования, не сворачиваем автоматически
        if (isEditing) {
            console.log('🔍 [Header] В режиме редактирования - отключаем автоматическое сворачивание');
            return;
        }

        console.log('🔍 [Header] Не в режиме редактирования - включаем автоматическое сворачивание через 15 секунд');
        const collapseTimer = setTimeout(() => {
            setIsCollapsed(true);
            setShowExpandButton(true);
        }, 15000);

        return () => clearTimeout(collapseTimer);
    }, [isEditing]);

    // Автоматическое разворачивание хедера при входе в режим редактирования
    useEffect(() => {
        if (isEditing && isCollapsed) {
            console.log('🔍 [Header] Вход в режим редактирования - автоматически разворачиваем хедер');
            setIsCollapsed(false);
            setShowExpandButton(false);
        }
    }, [isEditing, isCollapsed]);

    // Автоматическое сворачивание хедера при выходе из режима редактирования
    useEffect(() => {
        if (!isEditing && !isCollapsed) {
            console.log('🔍 [Header] Выход из режима редактирования - автоматически сворачиваем хедер');
            setIsCollapsed(true);
            setShowExpandButton(true);
        }
    }, [isEditing]);

    // Функция ручного сворачивания хедера
    const handleCollapse = () => {
        console.log('🔍 [Header] Ручное сворачивание хедера, isEditing:', isEditing);
        setIsCollapsed(true);
        setShowExpandButton(true);
    };

    // Функция разворачивания хедера
    const handleExpand = () => {
        console.log('🔍 [Header] Разворачиваем хедер, isEditing:', isEditing);
        setIsCollapsed(false);
        setShowExpandButton(false);
        
        // Через 10 секунд снова сворачиваем (только если не в режиме редактирования)
        if (!isEditing) {
            console.log('🔍 [Header] Не в режиме редактирования - планируем сворачивание через 10 секунд');
            setTimeout(() => {
                setIsCollapsed(true);
                setShowExpandButton(true);
            }, 10000);
        } else {
            console.log('🔍 [Header] В режиме редактирования - не планируем автоматическое сворачивание');
        }
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
        const animateProgress = () => {
            const startTime = Date.now();
            const duration = 1500;
            const startProgress = animatedProgress;
            const targetProgress = progress;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Плавная функция анимации
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const currentProgress = startProgress + (targetProgress - startProgress) * easeProgress;
                
                setAnimatedProgress(Math.round(currentProgress));
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            
            requestAnimationFrame(animate);
        };
        
        animateProgress();
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
            <div 
                className={`${styles.header} ${isCollapsed ? styles.collapsed : ''}`}
            >
                {/* Кнопка сворачивания хедера (скрыта в режиме редактирования) */}
                {!isCollapsed && !isEditing && (
                    <button
                        className={styles.collapseButton}
                        onClick={handleCollapse}
                        title="Свернуть хедер"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M19 13H5V11H19V13Z" fill="currentColor"/>
                        </svg>
                    </button>
                )}

                {/* Верхняя секция с заголовком и статусом */}
                <div className={styles.headerTop}>
                    <div className={styles.titleSection}>
                        <h2 
                            className={styles.headerTitle}
                            data-text={getDisplayTitle()}
                        >
                            {getDisplayTitle()}
                        </h2>
                    </div>
                </div>



                {/* Секция с прогрессом и таймером */}
                <div className={styles.progressSection}>
                    {/* Прогресс бар */}
                    <div className={styles.progress}>
                        <div 
                            className={styles.progressBar}
                            style={{
                                width: `${progress}%`,
                                backgroundColor: getProgressColor()
                            }}
                        />
                        
                        {/* Анимированные элементы прогресса */}
                        <div className={styles.progressOverlay}>
                            <div className={styles.progressShine} />
                        </div>

                        {/* Текст прогресса */}
                        <div className={styles.progressTextContainer}>
                            <span className={styles.progressText}>
                                {animatedProgress}%
                            </span>
                        </div>
                    </div>

                    {/* Таймер работы */}
                    {timerDisplay && !isCollapsed && (
                        <div className={styles.timerContainer}>
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
                        </div>
                    )}
                </div>
                

            </div>



            {/* Элементы слева от экрана для свернутого состояния */}
            {isCollapsed && (
                <div className={styles.collapsedControls}>
                    {/* Иконка прогресса */}
                    <div className={styles.collapsedProgressIcon}>
                        {animatedProgress}%
                    </div>
                    
                    {/* Простые часы */}
                    {timerDisplay && (
                        <div className={styles.collapsedTimer}>
                            {timerDisplay}
                        </div>
                    )}
                    
                    {/* Кнопка разворачивания */}
                    <button
                        className={styles.collapsedExpandButton}
                        onClick={handleExpand}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
            )}
        </>
    );
};

export default Header; 