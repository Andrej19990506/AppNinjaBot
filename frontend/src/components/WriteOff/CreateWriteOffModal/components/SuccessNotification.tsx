import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@mui/material/Button';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircularProgress from '@mui/material/CircularProgress';
import styles from './SuccessNotification.module.css';

interface SuccessNotificationProps {
  isSubmitting: boolean;
  isSuccess: boolean;
  type: 'create' | 'update';
  onConfirm: () => void;
}

/**
 * Компонент уведомления об успешной отправке формы или индикатора загрузки
 */
export const SuccessNotification: React.FC<SuccessNotificationProps> = ({
  isSubmitting,
  isSuccess,
  type,
  onConfirm
}) => {
  return (
    <motion.div
      key="success-notification"
      className={`${styles.successContainer} ${isSubmitting && !isSuccess ? styles.loadingContainer : ''}`}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: {
          type: "spring",
          damping: 25,
          stiffness: 300,
          duration: 0.4
        }
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.95, 
        y: -20,
        transition: {
          duration: 0.35,
          ease: "easeInOut"
        } 
      }}
      layoutId="success-notification-container"
    >
      <AnimatePresence mode="wait">
        {isSubmitting && !isSuccess ? (
          <motion.div 
            key="loading"
            className={styles.successIcon}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              transition: { 
                type: "spring", 
                stiffness: 350,
                damping: 25,
                delay: 0.1
              }
            }}
            exit={{ 
              scale: 0, 
              opacity: 0,
              transition: {
                duration: 0.25,
                ease: "easeOut"
              }
            }}
            layoutId="success-icon"
          >
            <CircularProgress 
              size={40} 
              className={styles.loadingSpinner} 
              thickness={4}
            />
          </motion.div>
        ) : (
          <motion.div 
            key="success"
            className={styles.successIcon}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ 
              scale: 1, 
              rotate: 0,
              transition: { 
                type: "spring", 
                stiffness: 350,
                damping: 20,
                delay: 0.1
              } 
            }}
            exit={{ 
              scale: 0, 
              opacity: 0,
              transition: {
                duration: 0.25,
                ease: "easeOut"
              }
            }}
            layoutId="success-icon"
          >
            <CheckCircleIcon fontSize="large" />
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          transition: {
            delay: 0.2, 
            duration: 0.4,
            ease: "easeOut"
          }
        }}
        exit={{ 
          opacity: 0, 
          y: -10,
          transition: {
            duration: 0.2
          }
        }}
        className={styles.successTitle}
        layoutId="success-title"
      >
        {isSubmitting && !isSuccess 
          ? (type === 'create' ? 'Создание списания...' : 'Обновление списания...') 
          : (type === 'create' ? 'Списание создано' : 'Списание обновлено')}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          transition: {
            delay: 0.3, 
            duration: 0.4,
            ease: "easeOut"
          }
        }}
        exit={{ 
          opacity: 0, 
          y: -10,
          transition: {
            duration: 0.2
          }
        }}
        className={styles.successText}
        layoutId="success-text"
      >
        {isSubmitting && !isSuccess
          ? 'Пожалуйста, подождите...'
          : (type === 'create' 
            ? 'Новое списание успешно создано и сохранено' 
            : 'Изменения успешно сохранены')}
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          transition: {
            delay: 0.4, 
            duration: 0.4,
            ease: "easeOut"
          }
        }}
        exit={{ 
          opacity: 0, 
          y: -10,
          transition: {
            duration: 0.2
          }
        }}
        className={`${styles.successButton} ${styles.successButtonWrapper}`}
        layoutId="success-button"
      >
        <Button
          variant="contained"
          onClick={onConfirm}
          className={styles.successConfirmButton}
          disabled={isSubmitting && !isSuccess}
          disableRipple
          disableElevation
        >
          {isSubmitting && !isSuccess ? 'Отправка...' : 'OK'}
        </Button>
      </motion.div>
    </motion.div>
  );
}; 