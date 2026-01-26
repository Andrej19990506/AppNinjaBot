// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import styles from '@shared/components/Notifications/SystemNotification.module.css';
import { soundService } from '@shared/services/soundService';

export interface NotificationItem {
    id?: string;
    type: NotificationTypes;
    message: string;
    title?: string;
    duration?: number;
    autoHideDuration?: number;
    photoUrl?: string; // URL фотографии пользователя
}

// Экспортируем интерфейс для упрощенного использования компонента с одним уведомлением
export interface SingleNotificationProps {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    title?: string;
    duration?: number;
    onClose?: () => void;
}

interface SystemNotificationProps {
    notifications: NotificationItem[];
    onClose: (id: string) => void;
}

// <<< Основной компонент SystemNotification >>>
const SystemNotification: React.FC<SystemNotificationProps> = ({ notifications, onClose }) => {
    // Храним ID обработанных уведомлений, чтобы избежать их повторного появления
    const processedNotificationsRef = useRef(new Set());
    
    // Для хранения активного уведомления в локальном состоянии
    const [currentNotification, setCurrentNotification] = useState(null);
    
    // Запоминаем последнее колличество уведомлений для отслеживания изменений
    const prevNotificationsLengthRef = useRef(0);
    
    // Отслеживаем уведомления с воспроизведенным звуком
    const playedSoundNotificationsRef = useRef(new Set());
    
    const getIcon = (type: NotificationTypes) => {
        switch (type) {
            case NotificationTypes.SUCCESS:
                return <CheckCircleIcon className={styles.icon} />;
            case NotificationTypes.ERROR:
                return <ErrorIcon className={styles.icon} />;
            case NotificationTypes.WARNING:
                return <WarningIcon className={styles.icon} />;
            default:
                return <InfoIcon className={styles.icon} />;
        }
    };

    const getGlowColor = (type: NotificationTypes) => {
        switch (type) {
            case NotificationTypes.SUCCESS:
                return "rgba(16, 185, 129, 0.5)";
            case NotificationTypes.ERROR:
                return "rgba(239, 68, 68, 0.5)";
            case NotificationTypes.WARNING:
                return "rgba(245, 158, 11, 0.5)";
            default:
                return "rgba(255, 95, 31, 0.5)";
        }
    };

    // Обновляем активное уведомление, когда список уведомлений изменяется
    useEffect(() => {
        console.log("[SystemNotification] Проверка уведомлений:", 
            { 
                count: notifications.length, 
                prevCount: prevNotificationsLengthRef.current,
                notifications: notifications.map(n => ({ 
                    id: n.id, 
                    message: n.message, 
                    isToast: n.isToast,
                    type: n.type 
                }))
            }
        );
        
        // Если есть новые уведомления
        if (notifications.length > 0) {
            // Получаем последнее уведомление
            const latestNotification = notifications[notifications.length - 1];
            
            console.log("[SystemNotification] Последнее уведомление:", {
                id: latestNotification.id,
                message: latestNotification.message,
                isToast: latestNotification.isToast,
                type: latestNotification.type,
                wasProcessed: processedNotificationsRef.current.has(latestNotification.id)
            });
            
            // Проверяем, был ли ID этого уведомления уже обработан
            if (latestNotification && latestNotification.id && 
                !processedNotificationsRef.current.has(latestNotification.id)) {
                
                console.log("[SystemNotification] Установка нового уведомления:", latestNotification.id);
                
                // Добавляем ID в список обработанных
                processedNotificationsRef.current.add(latestNotification.id);
                
                // НЕМЕДЛЕННО заменяем текущее уведомление новым (даже если старое еще показывается)
                setCurrentNotification(latestNotification);
                
                // Воспроизводим звук для новых уведомлений (кроме тех, что уже имеют звук)
                if (!playedSoundNotificationsRef.current.has(latestNotification.id)) {
                    // Воспроизводим разные звуки в зависимости от типа уведомления
                    if (latestNotification.type === NotificationTypes.SUCCESS) {
                        soundService.playSuccessSound();
                    } else if (latestNotification.type === NotificationTypes.ERROR) {
                        soundService.playErrorSound();
                    } else {
                        soundService.playNotificationSound();
                    }
                    // Помечаем, что звук уже воспроизведен для этого уведомления
                    playedSoundNotificationsRef.current.add(latestNotification.id);
                }
            } else {
                console.log("[SystemNotification] Уведомление уже обработано или не имеет ID");
            }
        } else if (currentNotification !== null) {
            // Если уведомлений нет, сбрасываем активное (только если оно уже установлено)
            console.log("[SystemNotification] Сброс активного уведомления (нет уведомлений)");
            setCurrentNotification(null);
        }
        
        // Обновляем сохраненную длину списка
        prevNotificationsLengthRef.current = notifications.length;
    }, [notifications]);

    // Обработчик свайпа
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, id: string) => {
        if (Math.abs(info.offset.x) > 80) { // Если свайп в любую сторону более 80px
            console.log("[SystemNotification] Свайп для удаления:", id, "offset:", info.offset.x);
            handleNotificationClose(id);
        }
    };

    // Установка автоматического закрытия для активного уведомления
    useEffect(() => {
        if (!currentNotification || !currentNotification.id) return;
        
        const duration = currentNotification.duration || currentNotification.autoHideDuration || 4000;
        console.log("[SystemNotification] Установка таймера для:", currentNotification.id, "Длительность:", duration);
        
        const timer = setTimeout(() => {
            console.log("[SystemNotification] Автоматическое закрытие:", currentNotification.id);
            handleNotificationClose(currentNotification.id);
        }, duration);
        
        return () => {
            console.log("[SystemNotification] Очистка таймера для:", currentNotification.id);
            clearTimeout(timer);
        };
    }, [currentNotification, onClose]);

    // Когда уведомление удаляется
    const handleNotificationClose = (id: string) => {
        console.log("[SystemNotification] Обработка закрытия уведомления:", id);
        
        // Если закрываемое уведомление является текущим активным
        if (currentNotification && currentNotification.id === id) {
            // Немедленно очищаем текущее уведомление, не дожидаясь обновления из props
            setCurrentNotification(null);
        }
        
        // Удаляем из отслеживания воспроизведенного звука
        playedSoundNotificationsRef.current.delete(id);
        
        // Вызываем родительский onClose
        onClose(id);
    };

    console.log("[SystemNotification] Рендер:", 
        { 
            currentNotification: currentNotification ? 
                { id: currentNotification.id, message: currentNotification.message } : null,
            processedCount: processedNotificationsRef.current.size
        }
    );

    return (
        <div className={styles.notificationContainer}>
            <AnimatePresence mode="popLayout">
                {currentNotification && (
                    <motion.div
                        key={`notification-${currentNotification.id}`}
                        layout
                        initial={{ 
                            opacity: 0, 
                            y: -120, 
                            scale: 0.8,
                            rotateX: -15,
                            filter: "blur(4px)"
                        }}
                        animate={{ 
                            opacity: 1, 
                            y: 0, 
                            scale: 1,
                            rotateX: 0,
                            filter: "blur(0px)"
                        }}
                        exit={{ 
                            opacity: 0, 
                            y: -120, 
                            scale: 0.8,
                            rotateX: -15,
                            filter: "blur(4px)"
                        }}
                        className={`${styles.notification} ${styles[currentNotification.type]}`}
                        drag="x"
                        dragConstraints={{ left: -100, right: 100 }}
                        dragElastic={0.8}
                        onDragEnd={(event, info) => handleDragEnd(event, info, currentNotification.id)}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 25,
                            mass: 0.8,
                            duration: 0.6
                        }}
                        whileHover={{ 
                            y: -4,
                            scale: 1.02,
                            transition: { 
                                type: "spring",
                                stiffness: 400,
                                damping: 20,
                                duration: 0.3
                            }
                        }}
                        whileTap={{ 
                            scale: 0.98,
                            transition: { duration: 0.1 }
                        }}
                        style={{
                            boxShadow: "var(--shadow-lg)"
                        }}
                    >
                        {/* Анимированная градиентная полоска */}
                        <motion.div
                            className={styles.gradientBorder}
                            animate={{
                                boxShadow: [
                                    `0 0 10px ${getGlowColor(currentNotification.type)}`,
                                    `0 0 20px ${getGlowColor(currentNotification.type)}`,
                                    `0 0 10px ${getGlowColor(currentNotification.type)}`
                                ]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                        <div className={styles.iconContainer}>
                            {console.log('[SystemNotification] Рендеринг уведомления с photoUrl:', currentNotification.photoUrl)}
                            {currentNotification.photoUrl ? (
                                <motion.img 
                                    src={currentNotification.photoUrl} 
                                    alt="User" 
                                    className={styles.userPhoto}
                                    whileHover={{
                                        scale: 1.05,
                                        rotateY: 5,
                                        filter: "brightness(1.1) contrast(1.05)",
                                        transition: { duration: 0.2 }
                                    }}
                                    onError={(e) => {
                                        console.log('[SystemNotification] Ошибка загрузки фото:', currentNotification.photoUrl);
                                        // Если фото не загрузилось, показываем иконку по умолчанию
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextSibling.style.display = 'block';
                                    }}
                                    onLoad={() => {
                                        console.log('[SystemNotification] Фото успешно загружено:', currentNotification.photoUrl);
                                    }}
                                />
                            ) : null}
                            <motion.div 
                                style={{ display: currentNotification.photoUrl ? 'none' : 'block' }}
                                whileHover={{
                                    scale: 1.1,
                                    rotateY: 10,
                                    filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))",
                                    transition: { duration: 0.2 }
                                }}
                            >
                                {getIcon(currentNotification.type)}
                            </motion.div>
                        </div>
                        <div className={styles.content}>
                            {currentNotification.title && (
                                <div className={styles.title}>{currentNotification.title}</div>
                            )}
                            <div className={styles.message}>{currentNotification.message}</div>
                        </div>
                        <div className={styles.swipeHint}>
                            <span>Свайп для закрытия</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Создаем альтернативный компонент для работы с единичным уведомлением
export const SingleSystemNotification: React.FC<SingleNotificationProps> = ({
    type, 
    message, 
    title,
    duration = 4000,
    onClose
}) => {
    const [isDragging, setIsDragging] = useState(false);
    
    const getIconByType = (notificationType: string) => {
        switch (notificationType) {
            case 'success':
                return <CheckCircleIcon className={styles.icon} />;
            case 'error':
                return <ErrorIcon className={styles.icon} />;
            case 'warning':
                return <WarningIcon className={styles.icon} />;
            default:
                return <InfoIcon className={styles.icon} />;
        }
    };

    const getGlowColorByType = (notificationType: string) => {
        switch (notificationType) {
            case 'success':
                return "rgba(16, 185, 129, 0.5)";
            case 'error':
                return "rgba(239, 68, 68, 0.5)";
            case 'warning':
                return "rgba(245, 158, 11, 0.5)";
            default:
                return "rgba(255, 95, 31, 0.5)";
        }
    };

    const notificationType = type === 'success' 
        ? NotificationTypes.SUCCESS 
        : type === 'error' 
            ? NotificationTypes.ERROR 
            : type === 'warning' 
                ? NotificationTypes.WARNING 
                : NotificationTypes.INFO;

    // Обработчик свайпа
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (Math.abs(info.offset.x) > 80) { // Если свайп в любую сторону более 80px
            if (onClose) {
                onClose();
            }
        }
    };

    return (
        <div className={styles.notificationContainer}>
            <AnimatePresence mode="popLayout">
                <motion.div
                    key="single-notification"
                    layout
                    initial={{ 
                        opacity: 0, 
                        y: -120, 
                        scale: 0.8,
                        rotateX: -15,
                        filter: "blur(4px)"
                    }}
                    animate={{ 
                        opacity: 1, 
                        y: 0, 
                        scale: 1,
                        rotateX: 0,
                        filter: "blur(0px)"
                    }}
                    exit={{ 
                        opacity: 0, 
                        y: -120, 
                        scale: 0.8,
                        rotateX: -15,
                        filter: "blur(4px)"
                    }}
                    className={`${styles.notification} ${styles[notificationType]} ${isDragging ? styles.dragging : ''}`}
                    drag="x"
                    dragConstraints={{ left: -100, right: 100 }}
                    dragElastic={0.8}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={(event, info) => {
                        setIsDragging(false);
                        handleDragEnd(event, info);
                    }}
                    whileDrag={{ 
                        scale: 0.96,
                        rotateZ: 2,
                        transition: { duration: 0.1 }
                    }}
                    whileHover={{ 
                        y: -4,
                        scale: 1.02,
                        transition: { 
                            type: "spring",
                            stiffness: 400,
                            damping: 20,
                            duration: 0.3
                        }
                    }}
                    whileTap={{ 
                        scale: 0.98,
                        transition: { duration: 0.1 }
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 25,
                        mass: 0.8,
                        duration: 0.6
                    }}
                    style={{
                        boxShadow: "var(--shadow-lg)"
                    }}
                >
                    {/* Анимированная градиентная полоска */}
                    <motion.div
                        className={styles.gradientBorder}
                        animate={{
                            boxShadow: [
                                `0 0 10px ${getGlowColorByType(type)}`,
                                `0 0 20px ${getGlowColorByType(type)}`,
                                `0 0 10px ${getGlowColorByType(type)}`
                            ]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <div className={styles.iconContainer}>
                        <motion.div
                            whileHover={{
                                scale: 1.1,
                                rotateY: 10,
                                filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))",
                                transition: { duration: 0.2 }
                            }}
                        >
                            {getIconByType(type)}
                        </motion.div>
                    </div>
                    <div className={styles.content}>
                        {title && (
                            <div className={styles.title}>{title}</div>
                        )}
                        <div className={styles.message}>{message}</div>
                    </div>
                                         <div className={styles.swipeHint}>
                         <span>Свайп для закрытия</span>
                     </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SystemNotification; 