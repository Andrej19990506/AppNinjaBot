import React from 'react';
import { motion } from 'framer-motion';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
    title: string;
    mode: 'inventory' | 'writeoff';
    progress?: number;
    notifications?: Array<{
        id: string;
        type: string;
        message?: string;
        title?: string;
    }>;
    hasUnreadNotifications?: boolean;
    onNotificationClose?: (id: string) => void;
    isVisible?: boolean;
    isLoading?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    title,
    mode,
    progress = 0,
    notifications = [],
    hasUnreadNotifications = false,
    onNotificationClose = () => {},
    isVisible = true,
    isLoading = false
}) => {
    if (!isVisible) return null;

    return (
        <motion.div 
            className={`${styles.header} ${styles[mode]} ${isLoading ? styles.loading : ''}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
        >
            <motion.h2 
                className={styles.headerTitle}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                data-text={title}
            >
                {title}
            </motion.h2>

            {/* Отображаем прогресс и уведомления только для режима инвентаризации */}
            {mode === 'inventory' && (
                <div className={styles.headerActions}>
                    {notifications.length > 0 && (
                        <div className={styles.notification}>
                            <div 
                                className={`${styles.notificationIcon} ${hasUnreadNotifications ? styles.hasUnread : ''}`}
                                onClick={() => notifications[0] && onNotificationClose(notifications[0].id)}
                            >
                                <span className={styles.notificationDot}></span>
                            </div>
                        </div>
                    )}
                    
                    {(progress > 0 || isLoading) && (
                        <motion.div 
                            className={styles.progress}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                        >
                            <motion.div 
                                className={styles.progressBar}
                                style={{ width: `${progress}%` }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3, duration: 0.3 }}
                            >
                                {progress}%
                            </motion.span>
                        </motion.div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default AppHeader; 