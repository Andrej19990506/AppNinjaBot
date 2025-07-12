import React from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { RootState } from '@/store';
import { canEditWriteOffsForDate } from '@/shared/utils/dateUtils';
import styles from '@/features/WriteOff/WriteOffList/WriteOffList.module.css';

interface AddWriteOffButtonProps {
  onAddNew: () => void;
}

/**
 * Компонент кнопки добавления нового списания с анимацией
 */
const AddWriteOffButton: React.FC<AddWriteOffButtonProps> = ({ onAddNew }) => {
  const selectedDate = useSelector((state: RootState) => state.writeOff.selectedDate);
  const canEdit = canEditWriteOffsForDate(selectedDate);

  return (
    <div className={styles.addButtonContainer}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 15
        }}
      >
        <Button
          variant="contained"
          startIcon={canEdit ? <AddIcon className={styles.addButtonIcon} /> : <EventBusyIcon className={styles.addButtonIcon} />}
          onClick={canEdit ? onAddNew : undefined}
          disabled={!canEdit}
          className={`${styles.addButton} ${!canEdit ? styles.addButtonDisabled : ''}`}
        >
          {canEdit ? 'Добавить списание' : 'Нельзя добавить в прошедшие дни'}
        </Button>
      </motion.div>
    </div>
  );
};

export default AddWriteOffButton; 