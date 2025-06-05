import React, { useState, useEffect, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import styles from './DeleteConfirmationModal.module.css';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    itemName: string;
    category: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    isOpen,
    itemName,
    category,
    onConfirm,
    onCancel
}) => {
    const [timeLeft, setTimeLeft] = useState(5);
    const [timerActive, setTimerActive] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Reset states when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeLeft(5);
            setTimerActive(false);
            setIsConfirmed(false);
        }
    }, [isOpen]);

    // Timer countdown
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isOpen && timerActive && timeLeft > 0) {
            timer = setTimeout(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            onConfirm();
        }
        return () => clearTimeout(timer);
    }, [timeLeft, isOpen, timerActive, onConfirm]);

    const handleCancel = useCallback(() => {
        setTimerActive(false);
        setIsConfirmed(false);
        onCancel();
    }, [onCancel]);

    const handleInitialConfirm = useCallback(() => {
        setIsConfirmed(true);
        setTimerActive(true);
    }, []);

    const handleFinalConfirm = useCallback(() => {
        setTimerActive(false);
        onConfirm();
    }, [onConfirm]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className={styles.overlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className={styles.modal}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                    >
                        <div className={styles.header}>
                            <h2 className={styles.title}>
                                {isConfirmed ? 'Удаление товара' : 'Подтверждение удаления'}
                            </h2>
                        </div>

                        <div className={styles.itemInfo}>
                            <div className={styles.itemName}>{itemName}</div>
                            <div className={styles.itemCategory}>{category}</div>
                        </div>

                        <div className={styles.content}>
                            {isConfirmed ? (
                                'Товар будет удален через:'
                            ) : (
                                'Вы уверены, что хотите удалить этот товар?'
                            )}
                        </div>

                        {!isConfirmed && (
                            <div className={styles.warning}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Это действие нельзя отменить
                            </div>
                        )}

                        <div className={styles.buttons}>
                            <button 
                                className={`${styles.button} ${styles.cancelButton}`}
                                onClick={handleCancel}
                            >
                                {isConfirmed ? 'Отменить удаление' : 'Отмена'}
                            </button>
                            <button 
                                className={`${styles.button} ${styles.deleteButton}`}
                                onClick={isConfirmed ? handleFinalConfirm : handleInitialConfirm}
                            >
                                {isConfirmed ? (
                                    <>
                                        Удалить сейчас
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        >
                                            ({timeLeft}с)
                                        </motion.span>
                                    </>
                                ) : (
                                    'Удалить'
                                )}
                            </button>
                        </div>

                        {isConfirmed && (
                            <motion.div 
                                className={styles.timer}
                                initial={{ width: "100%" }}
                                animate={{ width: `${(timeLeft / 5) * 100}%` }}
                                transition={{ duration: 1, ease: "linear" }}
                            />
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DeleteConfirmationModal; 