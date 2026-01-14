import React from 'react';
import styles from './UnusedConfirmModal.module.css';

interface UnusedConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
}

const UnusedConfirmModal: React.FC<UnusedConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Пометить как "Не используется"?</h3>
        </div>

        <div className={styles.content}>
          <p>
            Товар <strong>{itemName}</strong> будет помечен как неиспользуемый.
          </p>
          <p>
            Количество обнулится, статус "Нет в наличии" снимется (если был).
          </p>

          <div className={styles.warning}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Действие нельзя отменить автоматически
          </div>
        </div>

        <div className={styles.buttons}>
          <button className={`${styles.button} ${styles.cancelButton}`} onClick={onClose}>
            Отмена
          </button>
          <button 
            className={`${styles.button} ${styles.confirmButton}`} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Да, не используется
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnusedConfirmModal;