// @ts-nocheck
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// <<< Отдельный компонент для одного уведомления с таймером >>>
const NotificationMessage: React.FC<{ 
    notification: NotificationItem;
    onClose: (id: string) => void;
    getIcon: (type: NotificationTypes) => JSX.Element;
}> = ({ notification, onClose, getIcon }) => {
    
    useEffect(() => {
        // Убеждаемся, что id есть (хотя он должен быть на этом этапе)
        if (!notification.id) return;
        
        // Определяем длительность: из пропса или 7 секунд по умолчанию
        const duration = notification.duration || notification.autoHideDuration || 7000;
        
        // Устанавливаем таймер
        const timer = setTimeout(() => {
            onClose(notification.id!); // Вызываем onClose с id
        }, duration);
        
        // Очищаем таймер при размонтировании или изменении notification/onClose
        return () => clearTimeout(timer);
        
    }, [notification, onClose]); // Перезапускаем эффект, если уведомление или функция onClose изменились

    // Возвращаем JSX для одного уведомления
    return (
        <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`${styles.notification} ${styles[notification.type]}`}
        >
            <div className={styles.iconContainer}>
                {getIcon(notification.type)}
            </div>
            <div className={styles.content}>
                {notification.title && (
                    <div className={styles.title}>{notification.title}</div>
                )}
                <div className={styles.message}>{notification.message}</div>
            </div>
        </motion.div>
    );
};

// <<< Основной компонент SystemNotification теперь использует NotificationMessage >>>
const SystemNotification: React.FC<SystemNotificationProps> = ({ notifications, onClose }) => {
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

    return (
        <div className={styles.notificationContainer}>
            <AnimatePresence>
                {notifications.map((notification) => (
                    // Используем новый компонент с таймером
                    <NotificationMessage 
                        key={notification.id} // Ключ теперь на обертке
                        notification={notification}
                        onClose={onClose}
                        getIcon={getIcon}
                    />
                ))}
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

    return (
        <div className={styles.notificationContainer}>
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {/* @ts-ignore */}
            <AnimatePresence>
                <motion.div
                    key="single-notification"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    className={`${styles.notification} ${styles[notificationType]}`}
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
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SystemNotification; 