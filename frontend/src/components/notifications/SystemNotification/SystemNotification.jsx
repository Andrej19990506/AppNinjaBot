import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './SystemNotification.module.css';

const SystemNotification = ({ message, type = 'success', duration = 3000 }) => {
    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration]);

    if (!message) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className={`${styles.notification} ${styles[type]}`}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                >
                    <div className={styles.content}>
                        {type === 'success' && (
                            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {type === 'error' && (
                            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                        {type === 'info' && (
                            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span>{message}</span>
                    </div>
                    <motion.div 
                        className={styles.progressBar}
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ duration: duration / 1000, ease: 'linear' }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SystemNotification; 