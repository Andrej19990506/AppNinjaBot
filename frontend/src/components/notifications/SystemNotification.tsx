// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { NotificationTypes } from '../../store/slices/notificationSlice';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import styles from './SystemNotification.module.css';

export interface NotificationItem {
    id?: string;
    type: NotificationTypes;
    message: string;
    title?: string;
    duration?: number;
    autoHideDuration?: number;
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

    // Обновляем активное уведомление, когда список уведомлений изменяется
    useEffect(() => {
        console.log("[SystemNotification] Проверка уведомлений:", 
            { 
                count: notifications.length, 
                prevCount: prevNotificationsLengthRef.current,
                notifications: notifications.map(n => ({ id: n.id, message: n.message }))
            }
        );
        
        // Если длина списка уведомлений изменилась
        if (notifications.length !== prevNotificationsLengthRef.current) {
            console.log("[SystemNotification] Изменение количества уведомлений");
            
            // Если есть новые уведомления
            if (notifications.length > 0) {
                // Получаем последнее уведомление
                const latestNotification = notifications[notifications.length - 1];
                
                // Проверяем, был ли ID этого уведомления уже обработан
                if (latestNotification && latestNotification.id && 
                    !processedNotificationsRef.current.has(latestNotification.id)) {
                    
                    console.log("[SystemNotification] Установка нового уведомления:", latestNotification.id);
                    
                    // Добавляем ID в список обработанных
                    processedNotificationsRef.current.add(latestNotification.id);
                    
                    // Устанавливаем новое активное уведомление
                    setCurrentNotification(latestNotification);
                }
            } else {
                // Если уведомлений нет, сбрасываем активное
                console.log("[SystemNotification] Сброс активного уведомления (нет уведомлений)");
                setCurrentNotification(null);
            }
            
            // Обновляем сохраненную длину списка
            prevNotificationsLengthRef.current = notifications.length;
        }
    }, [notifications]);

    // Обработчик свайпа
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, id: string) => {
        if (info.offset.x > 100) { // Если свайп вправо более 100px
            console.log("[SystemNotification] Свайп для удаления:", id);
            handleNotificationClose(id);
        }
    };

    // Установка автоматического закрытия для активного уведомления
    useEffect(() => {
        if (!currentNotification || !currentNotification.id) return;
        
        const duration = currentNotification.duration || currentNotification.autoHideDuration || 7000;
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
                        initial={{ opacity: 0, x: -50, height: 'auto' }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        exit={{ opacity: 0, x: 200, height: 0, marginBottom: 0 }}
                        className={`${styles.notification} ${styles[currentNotification.type]}`}
                        drag="x"
                        dragConstraints={{ left: 0, right: 300 }}
                        dragElastic={0.7}
                        onDragEnd={(event, info) => handleDragEnd(event, info, currentNotification.id)}
                        transition={{
                            layout: { type: "spring", bounce: 0.2, duration: 0.3 }
                        }}
                    >
                        <div className={styles.iconContainer}>
                            {getIcon(currentNotification.type)}
                        </div>
                        <div className={styles.content}>
                            {currentNotification.title && (
                                <div className={styles.title}>{currentNotification.title}</div>
                            )}
                            <div className={styles.message}>{currentNotification.message}</div>
                        </div>
                        <div className={styles.swipeHint}>
                            <span>Свайп вправо</span>
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
    duration = 5000,
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

    const notificationType = type === 'success' 
        ? NotificationTypes.SUCCESS 
        : type === 'error' 
            ? NotificationTypes.ERROR 
            : type === 'warning' 
                ? NotificationTypes.WARNING 
                : NotificationTypes.INFO;

    // Обработчик свайпа
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.x > 100) { // Если свайп вправо более 100px
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
                    initial={{ opacity: 0, x: -50, height: 'auto' }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: 200, height: 0 }}
                    className={`${styles.notification} ${styles[notificationType]} ${isDragging ? styles.dragging : ''}`}
                    drag="x"
                    dragConstraints={{ left: 0, right: 300 }}
                    dragElastic={0.7}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={(event, info) => {
                        setIsDragging(false);
                        handleDragEnd(event, info);
                    }}
                    whileDrag={{ scale: 0.98 }}
                    transition={{
                        layout: { type: "spring", bounce: 0.2, duration: 0.3 }
                    }}
                >
                    <div className={styles.iconContainer}>
                        {getIconByType(type)}
                    </div>
                    <div className={styles.content}>
                        {title && (
                            <div className={styles.title}>{title}</div>
                        )}
                        <div className={styles.message}>{message}</div>
                    </div>
                    <div className={styles.swipeHint}>
                        <span>Свайп вправо</span>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SystemNotification; 