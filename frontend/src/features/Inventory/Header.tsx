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
    isEditing?: boolean; // Флаг режима редактирования
}

const Header: React.FC<HeaderProps> = ({
    title,
    progress,
    notifications,
    hasUnreadNotifications,
    onNotificationClose,
    isInitialContext = false,
    isEditing = false
}) => {
    const [animatedProgress, setAnimatedProgress] = useState(progress);
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

                </div>
                

            </div>



            {/* Элементы слева от экрана для свернутого состояния */}
            {isCollapsed && (
                <div className={styles.collapsedControls}>
                    {/* Иконка прогресса */}
                    <div className={styles.collapsedProgressIcon}>
                        {animatedProgress}%
                    </div>
                    
                </div>
            )}
        </>
    );
};

export default Header; 