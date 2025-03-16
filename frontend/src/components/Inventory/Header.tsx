import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Header.module.css';
import ChatNotification from './ChatNotification';

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
}

const Header: React.FC<HeaderProps> = ({
    title,
    progress,
    notifications,
    hasUnreadNotifications,
    onNotificationClose,
    isInitialContext = false
}) => {
    const [isInitialAnimation, setIsInitialAnimation] = useState(true);
    const [displayedProgress, setDisplayedProgress] = useState(0);

    const getDisplayTitle = () => {
        if (isInitialContext) return title;
        return title;
    };

    useEffect(() => {
        if (isInitialAnimation) {
            const timer = setTimeout(() => {
                setIsInitialAnimation(false);
                setDisplayedProgress(progress);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setDisplayedProgress(progress);
        }
    }, [progress, isInitialAnimation]);

    return (
        <motion.div 
            className={styles.header}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <div className={styles.headerTop}>
                <motion.h2 
                    className={styles.headerTitle}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    data-text={getDisplayTitle()}
                >
                    {getDisplayTitle()}
                </motion.h2>
                {isInitialContext && notifications.length > 0 && (
                    <ChatNotification 
                        notification={notifications[0]}
                        onClose={() => onNotificationClose(notifications[0].id)}
                        hasUnread={hasUnreadNotifications}
                    />
                )}
            </div>
            <motion.div 
                className={styles.progress}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <motion.div 
                    className={styles.progressBar}
                    style={{ 
                        width: `${displayedProgress}%`,
                        transition: isInitialAnimation 
                            ? 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                            : 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
                <AnimatePresence mode="wait">
                    <motion.span
                        key={displayedProgress}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {displayedProgress}%
                    </motion.span>
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default Header; 