import React, { Profiler, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { WriteOffReason } from '../../../../types/writeOff';
import styles from './InfoModal.module.css';

interface InfoModalProps {
  reason: WriteOffReason | undefined;
  onClose: (e?: React.MouseEvent | React.TouchEvent) => void;
  variants: any;
  onRenderCallback: any;
}

/**
 * Компонент модального окна с информацией о причине списания
 */
export const InfoModal: React.FC<InfoModalProps> = ({
  reason,
  onClose,
  variants,
  onRenderCallback
}) => {
  if (!reason) return null;
  
  // Состояние для кнопки закрытия
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  
  // Определяем анимацию для контента
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6,
        ease: "easeOut",
        delay: 0.2
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { 
        duration: 0.4,
        ease: "easeIn"
      }
    }
  };
  
  // Определяем анимацию для кнопки
  const buttonVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.5,
        ease: "easeOut",
        delay: 0.4
      }
    },
    hover: { 
      scale: 1.05, 
      y: -2,
      boxShadow: "0 6px 15px rgba(var(--primary-rgb), 0.3), 0 2px 5px rgba(0, 0, 0, 0.15)"
    },
    tap: { 
      scale: 0.98, 
      y: 1,
      boxShadow: "0 2px 8px rgba(var(--primary-rgb), 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)"
    }
  };
  
  // Анимация для кнопки закрытия
  const closeButtonVariants = {
    initial: { opacity: 0, scale: 0.5, rotate: -45 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      rotate: 0,
      transition: { 
        duration: 0.6, 
        delay: 0.4, 
        ease: [0.34, 1.56, 0.64, 1] 
      }
    },
    hover: { 
      rotate: 90,
      boxShadow: "0 3px 8px rgba(var(--primary-rgb), 0.2), 0 0 0 1px rgba(var(--primary-rgb), 0.1) inset"
    },
    tap: { 
      scale: 0.9, 
      rotate: 90 
    }
  };
  
  // Обработка нажатия клавиши Escape для закрытия модального окна
  useEffect(() => {
    const handleEscKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleEscKeyPress);
    };
  }, [onClose]);
  
  // Обработчики для кнопки закрытия
  const handleCloseMouseEnter = () => setIsCloseHovered(true);
  const handleCloseMouseLeave = () => setIsCloseHovered(false);
  
  return (
    <Profiler id="InfoModal" onRender={onRenderCallback}>
      <motion.div 
        className={styles.infoModalOverlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          
          // Проверяем, что клик был не по футеру
          const isFooterClick = 
            target.closest('[class*="Footer_footer"]') || 
            target.closest('[class*="Footer_createButton"]') ||
            target.closest('[class*="Footer_chatButton"]') ||
            target.closest('[class*="Footer_iconButton"]') ||
            target.closest('[class*="Footer_backButton"]') ||
            target.closest('[data-footer-element="true"]') ||
            target.closest('.footer');
            
          // Если клик по футеру - игнорируем
          if (isFooterClick) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          
          // Проверяем, был ли клик по оверлею, а не по модальному окну
          if (target.classList.contains(styles.infoModalOverlay)) {
            e.stopPropagation();
            onClose(e);
          }
        }}
      >
        <motion.div 
          className={styles.infoModal}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()} // Предотвращаем закрытие при касании внутри модального окна
        >
          <div className={styles.infoModalHeader}>
            <motion.h3 
              className={styles.infoModalTitle}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {reason.title}
            </motion.h3>
            
            <motion.div
              variants={closeButtonVariants}
              initial="initial"
              animate="animate"
              whileHover="hover"
              whileTap="tap"
              onMouseEnter={handleCloseMouseEnter}
              onMouseLeave={handleCloseMouseLeave}
            >
              <IconButton 
                className={styles.infoModalCloseButton} 
                onClick={(e) => onClose(e)}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  onClose(e);
                }}
                aria-label="Закрыть"
                size="small"
              >
                {isCloseHovered ? (
                  <CancelIcon fontSize="small" />
                ) : (
                  <CloseIcon fontSize="small" />
                )}
              </IconButton>
            </motion.div>
          </div>
          
          <motion.div 
            className={styles.infoModalContent}
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles.contentText}>
              {reason.description}
            </div>
          </motion.div>
          
          <div className={styles.infoModalFooter}>
            <motion.div
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
            >
              <Button 
                variant="contained" 
                className={styles.infoModalButton}
                onClick={(e) => onClose(e)}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  onClose(e);
                }}
                fullWidth
                startIcon={<CheckCircleOutlineIcon />}
              >
                Понятно
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </Profiler>
  );
}; 