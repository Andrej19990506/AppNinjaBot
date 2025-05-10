import React from 'react';
import { motion } from 'framer-motion';
import styles from './ChatNotification.module.css';

interface ChatNotificationProps {
    notification: {
        id: string;
        type: string;
        message?: string;
        title?: string;
    };
    hasUnread: boolean;
    onClose: () => void;
}

const ChatNotification: React.FC<ChatNotificationProps> = ({
    notification,
    hasUnread,
    onClose
}) => {
    return (
        <motion.div 
            className={`${styles.notification} ${hasUnread ? styles.hasUnread : ''}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
        >
            <div className={styles.content}>
                {notification.title && (
                    <h4 className={styles.title}>{notification.title}</h4>
                )}
                {notification.message && (
                    <p className={styles.message}>{notification.message}</p>
                )}
            </div>
            <button 
                className={styles.closeButton}
                onClick={onClose}
            >
                ×
            </button>
            {hasUnread && <div className={styles.unreadDot} />}
        </motion.div>
    );
};

export default ChatNotification; 