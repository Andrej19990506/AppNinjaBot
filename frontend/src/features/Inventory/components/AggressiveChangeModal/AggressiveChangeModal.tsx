import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import styles from './AggressiveChangeModal.module.css';

interface AggressiveChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onEdit: () => void;
    itemName: string;
    category: string;
    oldQuantity: number;
    newQuantity: number;
    changePercent: number;
    changeType: 'increase' | 'decrease';
    averageDailyAmount?: number;
    dailyChangesCount?: number;
    totalHistoryAmount?: number;
}

const AggressiveChangeModal: React.FC<AggressiveChangeModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onEdit,
    itemName,
    category,
    oldQuantity,
    newQuantity,
    changePercent,
    changeType,
    averageDailyAmount,
    dailyChangesCount,
    totalHistoryAmount
}) => {
    if (!isOpen) return null;

    const isIncrease = changeType === 'increase';
    const changeAmount = Math.abs(newQuantity - oldQuantity);

    return (
        <AnimatePresence>
            <motion.div
                className={styles.modalOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className={styles.modalContent}
                    initial={{ scale: 0.8, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 50 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <motion.button
                        className={styles.closeButton}
                        onClick={onClose}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <CloseIcon />
                    </motion.button>

                    <div className={styles.warningHeader}>
                        <div className={styles.warningIconWrapper}>
                            <WarningIcon className={styles.warningIcon} />
                        </div>
                        <div className={styles.headerText}>
                            <h2 className={styles.title}>Резкое изменение товара</h2>
                            <p className={styles.subtitle}>
                                Обнаружено агрессивное изменение количества товара
                            </p>
                        </div>
                    </div>

                    <div className={styles.changeDetails}>
                        <div className={styles.changeRow}>
                            <span className={styles.changeLabel}>Товар:</span>
                            <span className={styles.changeValue}>{itemName}</span>
                        </div>
                        <div className={styles.changeRow}>
                            <span className={styles.changeLabel}>Категория:</span>
                            <span className={styles.changeValue}>{category}</span>
                        </div>
                        <div className={styles.changeRow}>
                            <span className={styles.changeLabel}>Было:</span>
                            <span className={styles.changeValue}>{oldQuantity}</span>
                        </div>
                        <div className={styles.changeRow}>
                            <span className={styles.changeLabel}>Стало:</span>
                            <span className={styles.changeValue}>{newQuantity}</span>
                        </div>
                        <div className={styles.changeRow}>
                            <span className={styles.changeLabel}>Изменение:</span>
                            <span className={`${styles.changeValue} ${isIncrease ? styles.increase : styles.decrease}`}>
                                {isIncrease ? '+' : '-'}{changeAmount} ({changePercent.toFixed(1)}%)
                            </span>
                        </div>
                        {averageDailyAmount && (
                            <>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Среднее за день:</span>
                                    <span className={styles.changeValue}>{averageDailyAmount}</span>
                                </div>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Дней в истории:</span>
                                    <span className={styles.changeValue}>{dailyChangesCount}</span>
                                </div>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Общий объем:</span>
                                    <span className={styles.changeValue}>{totalHistoryAmount}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className={styles.warningText}>
                        <p className={styles.warningMessage}>
                            <strong>Внимание!</strong> Изменение превышает 40% от предыдущего значения.
                            Рекомендуется перепроверить корректность введенных данных.
                        </p>
                        <p className={styles.warningHint}>
                            Если данные верны - нажмите "Подтвердить".
                            Если нужно исправить - нажмите "Изменить".
                        </p>
                    </div>

                    <div className={styles.actionButtons}>
                        <motion.button
                            className={`${styles.button} ${styles.buttonSecondary}`}
                            onClick={onEdit}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <EditIcon className={styles.buttonIcon} />
                            Изменить
                        </motion.button>
                        <motion.button
                            className={`${styles.button} ${styles.buttonPrimary}`}
                            onClick={onConfirm}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <CheckCircleIcon className={styles.buttonIcon} />
                            Подтвердить
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AggressiveChangeModal;
