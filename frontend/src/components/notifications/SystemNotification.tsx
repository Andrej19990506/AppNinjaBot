import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import styles from './SystemNotification.module.css';

interface NotificationItem {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning';
}

interface SystemNotificationProps {
    message: string;
    type: 'success' | 'error' | 'warning';
    duration?: number;
    onClose?: () => void;
}

const SystemNotification: React.FC<SystemNotificationProps> = ({
    message,
    type,
    duration = 5000,
    onClose
}) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        if (message) {
            // Добавляем новое уведомление
            const newNotification = {
                id: Date.now().toString(),
                message,
                type
            };
            setNotifications(prev => [...prev, newNotification]);

            // Автоматически удаляем уведомление через duration
            if (duration > 0) {
                const timer = setTimeout(() => {
                    handleClose(newNotification.id);
                }, duration);
                return () => clearTimeout(timer);
            }
        }
    }, [message, type, duration]);

    const handleClose = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (onClose) onClose();
    };

    const getIcon = (type: 'success' | 'error' | 'warning') => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className={styles.icon} />;
            case 'error':
                return <ErrorIcon className={styles.icon} />;
            case 'warning':
                return <WarningIcon className={styles.icon} />;
        }
    };

    return (
        <LazyMotion features={domAnimation}>
            <div className={styles.notificationsContainer}>
                <AnimatePresence mode="sync">
                    {notifications.map((notification) => (
                        <motion.div
                            key={notification.id}
                            className={`${styles.notification} ${styles[notification.type]}`}
                            initial={{ opacity: 0, y: -20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.8 }}
                            transition={{ 
                                type: "spring",
                                stiffness: 500,
                                damping: 40,
                                mass: 1
                            }}
                        >
                            {getIcon(notification.type)}
                            <span className={styles.message}>{notification.message}</span>
                            <motion.button
                                className={styles.closeButton}
                                onClick={() => handleClose(notification.id)}
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <CloseIcon fontSize="small" />
                            </motion.button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </LazyMotion>
    );
};

export default SystemNotification; 