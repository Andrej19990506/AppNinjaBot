import React, { useEffect, useState } from 'react';
import { motion} from 'framer-motion';
import { animate } from 'framer-motion';
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
    const [animatedProgress, setAnimatedProgress] = useState(progress);

    const getDisplayTitle = () => {
        if (isInitialContext) return title;
        return title;
    };

    useEffect(() => {
        const controls = animate(animatedProgress, progress, {
            duration: 1.5,
            ease: "easeInOut",
            onUpdate: (latest) => {
                setAnimatedProgress(Math.round(latest));
            }
        });
        return () => controls.stop();
    }, [progress]);

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
            >
                <motion.div 
                    className={styles.progressBar}
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                />
                <div className={styles.progressTextContainer}>
                    {/* @ts-ignore suppressing TS2786 error temporarily */}
                    <motion.span
                        className={styles.progressText}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        {animatedProgress}%
                    </motion.span>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default Header; 