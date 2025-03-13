import React from 'react';
import { motion } from 'framer-motion';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import Tooltip from '@mui/material/Tooltip';
import Zoom from '@mui/material/Zoom';
import styles from '../WriteOffList.module.css';

interface AddWriteOffButtonProps {
  onAddNew: () => void;
}

/**
 * Компонент кнопки добавления нового списания с анимацией
 */
const AddWriteOffButton: React.FC<AddWriteOffButtonProps> = ({ onAddNew }) => {
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
          startIcon={<AddIcon className={styles.addButtonIcon} />}
          onClick={onAddNew}
          className={styles.addButton}
        >
          Добавить списание
        </Button>
      </motion.div>
    </div>
  );
};

export default AddWriteOffButton; 