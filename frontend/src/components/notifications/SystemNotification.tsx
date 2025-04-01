// @ts-nocheck
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationTypes } from '../../store/slices/notificationSlice';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import styles from './SystemNotification.module.css';

export interface NotificationItem {
    id: string;
    type: NotificationTypes;
    message: string;
    title?: string;
    duration?: number;
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
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {/* @ts-ignore */}
            <AnimatePresence>
                {notifications.map((notification) => (
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
                        <IconButton
                            size="small"
                            onClick={() => onClose(notification.id)}
                            className={styles.closeButton}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </motion.div>
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
                    {onClose && (
                        <IconButton
                            size="small"
                            onClick={onClose}
                            className={styles.closeButton}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SystemNotification; 