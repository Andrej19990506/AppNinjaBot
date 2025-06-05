import React, { Profiler, useEffect, useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import CheckIcon from '@mui/icons-material/Check';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import styles from './DescriptionModal.module.css';

interface DescriptionModalProps {
  description: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onClose: (e?: React.MouseEvent | React.TouchEvent) => void;
  onSave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTextareaTouch: (e: React.TouchEvent<HTMLTextAreaElement>) => void;
  onRenderCallback: any;
}

/**
 * Компонент модального окна для добавления/редактирования описания
 */
export const DescriptionModal = React.forwardRef<HTMLDivElement, DescriptionModalProps>(({
  description,
  onChange,
  onClose,
  onSave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTextareaTouch,
  onRenderCallback
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Флаг для отслеживания состояния фокуса и клавиатуры
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Фокус на текстовом поле при открытии модального окна
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 400);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Обработка изменения размеров окна (для мобильных устройств при появлении клавиатуры)
  useEffect(() => {
    const handleResize = () => {
      // Определяем, видна ли клавиатура по изменению высоты окна
      // На мобильных устройствах высота окна уменьшается при открытии клавиатуры
      if (window.innerHeight < window.outerHeight * 0.8) {
        setIsKeyboardVisible(true);
      } else {
        setIsKeyboardVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Обработка взаимодействия с textarea
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Если документ становится видимым снова после блюра
      // (например, переключение приложений на мобильном)
      if (document.visibilityState === 'visible' && isFocused) {
        // Возвращаем фокус на текстовое поле
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isFocused]);
  
  // Обновляем обработчик клика на оверлей
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
      onClose();
    }
  };

  // Обработчик клика по модальному окну
  const handleModalClick = useCallback((e: React.MouseEvent) => {
    // Останавливаем всплытие события
    e.stopPropagation();
  }, []);
  
  // Обработчики фокуса и блюра для текстового поля
  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setIsFocused(true);
  }, []);
  
  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
  }, []);

  // Варианты анимации для различных элементов
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  const modalVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring", 
        damping: 25, 
        stiffness: 300,
        delayChildren: 0.1,
        staggerChildren: 0.1
      } 
    },
    exit: { 
      opacity: 0, 
      y: 20, 
      scale: 0.95,
      transition: { duration: 0.2 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", damping: 25, stiffness: 300 }
    }
  };

  return (
    <Profiler id="DescriptionModal" onRender={onRenderCallback}>
      <motion.div 
        ref={ref || overlayRef}
        className={styles.infoModalOverlay}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleOverlayClick}
        onTouchStart={(e) => {
          // Не обрабатываем события, если открыта клавиатура
          if (isKeyboardVisible) {
            e.stopPropagation();
            return;
          }
          
          // Останавливаем всплытие только если это событие на самом оверлее
          if (e.target === e.currentTarget) {
            onTouchStart(e);
          }
        }}
        onTouchMove={(e) => {
          // Не обрабатываем события, если открыта клавиатура
          if (isKeyboardVisible) {
            e.stopPropagation();
            return;
          }
          
          // Останавливаем всплытие только если это событие на самом оверлее
          if (e.target === e.currentTarget) {
            onTouchMove(e);
          }
        }}
        onTouchEnd={(e) => {
          // Не обрабатываем события, если открыта клавиатура
          if (isKeyboardVisible) {
            e.stopPropagation();
            return;
          }
          
          // Останавливаем всплытие только если это событие на самом оверлее
          if (e.target === e.currentTarget) {
            onTouchEnd(e);
          }
        }}
        style={{
          // Фиксируем высоту при появлении клавиатуры
          position: 'fixed',
          height: isKeyboardVisible ? '100%' : undefined
        }}
      >
        <motion.div 
          ref={modalRef}
          className={styles.infoModal}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleModalClick}
          style={{
            // Корректируем положение при появлении клавиатуры
            marginTop: isKeyboardVisible ? '-15%' : undefined
          }}
        >
          <motion.div 
            className={styles.infoModalHeader}
            variants={itemVariants}
          >
            <h3 className={`${styles.infoModalTitle} text-gradient`}>
              {description ? 'Редактирование описания' : 'Добавление описания'}
            </h3>
            
            <IconButton 
              className={styles.infoModalCloseButton} 
              onClick={(e) => {
                e.stopPropagation();
                // Не реагируем на кнопку закрытия, если открыта клавиатура
                if (!isKeyboardVisible) {
                  onClose(e);
                }
              }}
              aria-label="Закрыть"
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </motion.div>
          
          <motion.div 
            className={styles.infoModalContent}
            variants={itemVariants}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div 
              className={styles.descriptionHint}
              variants={itemVariants}
            >
              <p>
                <DescriptionOutlinedIcon 
                  fontSize="small" 
                  style={{ 
                    verticalAlign: 'middle', 
                    marginRight: '8px',
                    color: 'var(--primary-color)'
                  }}
                />
                Добавьте подробное описание к списанию (необязательно). Здесь вы можете указать дополнительную информацию о причинах списания, состоянии товара или другие важные детали.
              </p>
            </motion.div>
            
            <motion.textarea 
              className={styles.descriptionTextarea}
              ref={textareaRef}
              value={description}
              onChange={(e) => {
                e.stopPropagation();
                onChange(e);
              }}
              placeholder="Введите подробное описание списания..."
              rows={6}
              variants={itemVariants}
              onTouchStart={(e) => {
                e.stopPropagation();
                onTextareaTouch(e);
              }}
              onTouchMove={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoComplete="off"
              spellCheck="false"
            />
          </motion.div>
          
          <motion.div 
            className={styles.infoModalFooter}
            variants={itemVariants}
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ flex: 1 }}
            >
              <Button 
                variant="outlined" 
                className={styles.cancelDescriptionButton}
                onClick={(e) => {
                  e.stopPropagation();
                  // Не реагируем на кнопку отмены, если открыта клавиатура
                  if (!isKeyboardVisible) {
                    onClose(e);
                  }
                }}
                startIcon={<CloseOutlinedIcon style={{ color: 'var(--gray-500)' }} />}
                fullWidth
              >
                Отмена
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ flex: 1 }}
            >
              <Button 
                variant="contained" 
                className={styles.saveDescriptionButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                startIcon={<CheckIcon />}
                fullWidth
                disableElevation
              >
                Сохранить
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </Profiler>
  );
}); 