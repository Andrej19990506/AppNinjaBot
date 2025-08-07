import React from 'react';
import styles from './OutOfStockConfirmModal.module.css';

interface OutOfStockConfirmModalProps {
    isOpen: boolean;
    itemName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const OutOfStockConfirmModal: React.FC<OutOfStockConfirmModalProps> = ({
    isOpen,
    itemName,
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Подтверждение</h3>
                </div>
                <div className={styles.content}>
                    <p>Вы уверены, что хотите пометить товар <strong>"{itemName}"</strong> как "Нет в наличии"?</p>
                    <p className={styles.warning}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Количество будет установлено в 0
                    </p>
                </div>
                <div className={styles.buttons}>
                    <button 
                        className={`${styles.button} ${styles.cancelButton}`}
                        onClick={onCancel}
                    >
                        Отмена
                    </button>
                    <button 
                        className={`${styles.button} ${styles.confirmButton}`}
                        onClick={onConfirm}
                    >
                        Подтвердить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OutOfStockConfirmModal; 