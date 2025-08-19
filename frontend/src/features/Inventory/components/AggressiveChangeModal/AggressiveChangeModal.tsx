import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import styles from './AggressiveChangeModal.module.css';

interface AggressiveChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onEdit: () => void;
    itemName: string;
    category: string;
    newQuantity: number;
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
    newQuantity,
    averageDailyAmount,
    dailyChangesCount,
    totalHistoryAmount
}) => {
    if (!isOpen) return null;

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
                            <span className={styles.changeLabel}>Новое значение:</span>
                            <span className={styles.changeValue}>{newQuantity}</span>
                        </div>
                        {averageDailyAmount && (
                            <>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Среднее дневное изменение:</span>
                                    <span className={styles.changeValue}>{averageDailyAmount}</span>
                                </div>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Отклонение от среднего:</span>
                                    <span className={`${styles.changeValue} ${styles.warning}`}>
                                        {Math.abs(newQuantity - averageDailyAmount).toFixed(1)} 
                                        ({((Math.abs(newQuantity - averageDailyAmount) / averageDailyAmount) * 100).toFixed(1)}%)
                                    </span>
                                </div>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Дней в истории:</span>
                                    <span className={styles.changeValue}>{dailyChangesCount}</span>
                                </div>
                                <div className={styles.changeRow}>
                                    <span className={styles.changeLabel}>Общий объем изменений:</span>
                                    <span className={styles.changeValue}>{totalHistoryAmount}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className={styles.warningText}>
                        <p className={styles.warningMessage}>
                            <strong>Внимание!</strong> Новое значение отклоняется от общего среднего значения.
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
