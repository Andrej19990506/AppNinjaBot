import React from 'react';
import { motion } from 'framer-motion';
import styles from './Header.module.css';
import ChatNotification from './ChatNotification';
import NotificationCenter from '../notifications/NotificationCenter';

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
}

const Header: React.FC<HeaderProps> = ({
    title,
    progress,
    notifications,
    hasUnreadNotifications,
    onNotificationClose
}) => {
    return (
        <motion.div 
            className={styles.header}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <motion.h2 
                className={styles.headerTitle}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                data-text={title}
            >
                {title}
            </motion.h2>
            <div className={styles.headerActions}>
                {notifications.length > 0 && (
                    <ChatNotification 
                        notification={notifications[0]}
                        onClose={() => onNotificationClose(notifications[0].id)}
                        hasUnread={hasUnreadNotifications}
                    />
                )}
                <motion.div 
                    className={styles.progress}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
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
                        transition={{ delay: 0.6 }}
                    >
                        {progress}%
                    </motion.span>
                </motion.div>
            </div>
            <NotificationCenter />
        </motion.div>
    );
};

export default Header; 