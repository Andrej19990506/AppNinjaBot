import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createPortal } from 'react-dom';
import styles from './ConfirmDialog.module.css';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { motion, AnimatePresence, domAnimation, LazyMotion } from 'framer-motion';
import AnimatePresenceWrapper from '../common/AnimatePresenceWrapper';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Подтвердить',
    type = 'warning'
}) => {
    if (!isOpen) return null;

    return (
        <LazyMotion features={domAnimation}>
            <div>
                <AnimatePresenceWrapper mode="sync">
                    {isOpen && (
                        <React.Fragment key="dialog">
                            <motion.div
                                className={styles.overlay}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onCancel}
                            >
                                <motion.div
                                    className={`${styles.dialog} ${styles[type]}`}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <h2 className={styles.title}>{title}</h2>
                                    <div className={styles.message}>
                                        {message.split('\n').map((line, index) => (
                                            <p key={index}>{line}</p>
                                        ))}
                                    </div>

                                    <div className={styles.buttons}>
                                        <motion.button
                                            className={`${styles.button} ${styles.cancel}`}
                                            onClick={onCancel}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            Отмена
                                        </motion.button>
                                        <motion.button
                                            className={`${styles.button} ${styles.confirm} ${styles[type]}`}
                                            onClick={onConfirm}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {confirmText}
                                        </motion.button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        </React.Fragment>
                    )}
                </AnimatePresenceWrapper>
            </div>
        </LazyMotion>
    );
};

export default ConfirmDialog; 