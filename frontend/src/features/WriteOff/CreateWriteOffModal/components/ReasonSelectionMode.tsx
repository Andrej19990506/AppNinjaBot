// @ts-nocheck
import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { WriteOffReason } from '../../../../types/writeOff';
import { ReasonCard } from './ReasonCard';
import styles from './ReasonSelectionMode.module.css';

interface ReasonSelectionModeProps {
  reasons: WriteOffReason[];
  selectedReason: WriteOffReason | null;
  onReasonSelect: (reason: WriteOffReason) => void;
  onInfoClick: (reasonId: string) => void;
  onClose: () => void;
  cardVariants: any;
}

/**
 * Компонент режима выбора причины списания
 */
export const ReasonSelectionMode: React.FC<ReasonSelectionModeProps> = ({
  reasons,
  selectedReason,
  onReasonSelect,
  onInfoClick,
  onClose,
  cardVariants
}) => {
  // Варианты анимации для контейнера
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3,
        ease: "easeOut",
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { 
        duration: 0.2,
        ease: "easeIn" 
      }
    }
  };

  // Варианты анимации для заголовка и элементов интерфейса
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        damping: 20, 
        stiffness: 300 
      }
    }
  };

  // Функция обработки выбора причины
  const handleReasonSelect = useCallback((reason: WriteOffReason) => {
    onReasonSelect(reason);
    onClose();
  }, [onReasonSelect, onClose]);

  return (
    <motion.div
      key="reason-selection"
      className={styles.modalContent}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div 
        className={styles.reasonSelectionHeader}
        variants={itemVariants}
      >
        <h2 className={`${styles.reasonSelectionTitle} text-gradient`}>
          Выберите причину списания
        </h2>
        
        <Tooltip title="Вернуться назад" placement="left">
          <Button
            className={styles.backButton}
            onClick={onClose}
            startIcon={<KeyboardArrowDownIcon />}
            variant="text"
          >
            Назад
          </Button>
        </Tooltip>
      </motion.div>
      
      <motion.div 
        className={styles.reasonsScrollContainer}
        variants={itemVariants}
      >
        <motion.div 
          className={styles.reasonsGrid}
          variants={containerVariants}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
          <AnimatePresence mode="popLayout">
            {reasons.map((reason, index) => (
              <ReasonCard
                key={reason.id}
                reason={reason}
                isSelected={selectedReason?.id === reason.id}
                onSelect={handleReasonSelect}
                onInfoClick={onInfoClick}
                variants={cardVariants}
                index={index}
              />
            ))}
          </AnimatePresence>
          
          {reasons.length === 0 && (
            <motion.div 
              className={styles.emptyReasons}
              variants={itemVariants}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p>Нет доступных причин списания</p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}; 