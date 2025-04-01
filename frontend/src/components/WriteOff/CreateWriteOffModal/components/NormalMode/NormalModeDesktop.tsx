// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import CircularProgress from '@mui/material/CircularProgress';

// Импортируем новые стили из отдельного файла
import styles from './NormalModeDesktop.module.css';
import { WriteOffReason } from '../../../../../types/writeOff';

// Расширяем тип для использования в компоненте
interface ReasonInfo extends WriteOffReason {
  description: string;
}

interface NormalModeDesktopProps {
  writeOffName: string;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  writeOffDescription: string;
  showDescriptionHint: boolean;
  setShowDescriptionHint: (show: boolean) => void;
  handleOpenDescriptionModal: (e: React.MouseEvent) => void;
  
  quantity: number;
  unitType: 'шт' | 'гр';
  handleQuantityChange: (newQuantity: number) => void;
  isQuantityInputOpen: boolean;
  tempQuantity: string;
  handleOpenQuantityInput: () => void;
  handleQuantityInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmQuantityInput: (e: React.MouseEvent) => void;
  handleCancelQuantityInput: (e: React.MouseEvent) => void;
  handleUnitToggle: (newUnitType: 'шт' | 'гр') => void;

  selectedReason: ReasonInfo | null;
  handleOpenReasonModal: () => void;
  setInfoModalOpen: (reasonId: string) => void;
  
  nameInputRef: React.RefObject<HTMLInputElement>;
  quantityInputRef: React.RefObject<HTMLInputElement>;
  
  // Обработчики для кнопок
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isEditMode?: boolean;
  
  // Параметры для интегрированных компонентов
  writeOffReasons: WriteOffReason[];
  handleReasonSelect: (reason: WriteOffReason) => void;
  handleDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Компонент для десктопной версии модального окна списания
 * Улучшенная версия с анимациями и эффектами
 */
export const NormalModeDesktop: React.FC<NormalModeDesktopProps> = ({
  writeOffName,
  handleNameChange,
  writeOffDescription,
  showDescriptionHint,
  setShowDescriptionHint,
  handleOpenDescriptionModal,
  
  quantity,
  unitType,
  handleQuantityChange,
  isQuantityInputOpen,
  tempQuantity,
  handleOpenQuantityInput,
  handleQuantityInputChange,
  handleConfirmQuantityInput,
  handleCancelQuantityInput,
  handleUnitToggle,

  selectedReason,
  handleOpenReasonModal,
  setInfoModalOpen,
  
  nameInputRef,
  quantityInputRef,
  
  // Используем обработчики для кнопок
  onClose,
  onSubmit,
  isSubmitting = false,
  isEditMode = false,
  
  // Параметры для интегрированных компонентов
  writeOffReasons = [],
  handleReasonSelect,
  handleDescriptionChange
}) => {
  // Локальное состояние для выбора причины
  const [isReasonsListOpen, setIsReasonsListOpen] = useState(false);
  const reasonsContainerRef = useRef<HTMLDivElement>(null);
  
  // Эффект для обработки кликов вне выпадающего списка
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reasonsContainerRef.current && 
        !reasonsContainerRef.current.contains(event.target as Node) &&
        isReasonsListOpen
      ) {
        setIsReasonsListOpen(false);
      }
    };

    // Добавляем слушатель событий
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isReasonsListOpen]);
  
  // Анимации для компонентов и секций
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1,
        duration: 0.3
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 25 }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dropdownVariants = {
    closed: { height: 0, opacity: 0, overflow: 'hidden' },
    open: { 
      height: 'auto',
      opacity: 1,
      transition: {
        height: { type: "spring", stiffness: 400, damping: 30 },
        opacity: { duration: 0.2 }
      }
    }
  };

  // Анимация для элементов списка причин
  const reasonItemVariants = {
    hidden: { 
      opacity: 0,
      x: -20 
    },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.2
      }
    }),
    exit: { 
      opacity: 0,
      x: 20,
      transition: {
        duration: 0.1
      }
    }
  };

  // Функция для открытия/закрытия списка причин
  const toggleReasonsList = () => {
    setIsReasonsListOpen(prev => !prev);
  };

  // Функция для выбора причины
  const selectReason = (reason: WriteOffReason) => {
    // Подсветим выбранный элемент перед закрытием списка
    handleReasonSelect(reason);
    
    // Немного задержим закрытие списка для лучшего UX
    setTimeout(() => {
      setIsReasonsListOpen(false);
    }, 300);
  };

  return (
    <motion.div 
      className={styles.container}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.layout}>
        {/* Левая колонка - название и количество */}
        <div className={styles.leftColumn}>
          {/* Секция названия */}
          <motion.div className={styles.section} variants={itemVariants}>
            <div className={styles.sectionTitle}>
              <h4>Название списания</h4>
            </div>
            <TextField
              className={styles.nameInput}
              variant="outlined"
              placeholder="Введите название списания..."
              value={writeOffName}
              onChange={handleNameChange}
              inputRef={nameInputRef}
              fullWidth
              autoComplete="off"
              InputProps={{
                className: styles.input
              }}
            />
          </motion.div>

          {/* Секция количества */}
          <motion.div className={styles.section} variants={itemVariants}>
            <div className={styles.sectionTitle}>
              <h4>Количество</h4>
            </div>
            
            {isQuantityInputOpen ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <div className={styles.quantityInputContainer}>
                  <TextField
                    variant="outlined"
                    value={tempQuantity}
                    onChange={handleQuantityInputChange}
                    inputRef={quantityInputRef}
                    fullWidth
                    autoFocus
                    type="text"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button 
                      className={styles.cancelQuantityButton} 
                      onClick={handleCancelQuantityInput}
                    >
                      <CloseIcon fontSize="small" />
                    </button>
                    <button 
                      className={styles.confirmQuantityButton} 
                      onClick={handleConfirmQuantityInput}
                    >
                      <CheckIcon fontSize="small" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className={styles.quantityControls}>
                  <div className={styles.quantityValueContainer} onClick={handleOpenQuantityInput}>
                    <div className={styles.quantityValue}>
                      <span className={styles.quantityNumber}>{quantity}</span>
                      <span className={styles.quantityUnit}>{unitType}</span>
                    </div>
                  </div>
                  <div className={styles.quantityActions}>
                    <IconButton 
                      aria-label="Уменьшить количество" 
                      onClick={() => handleQuantityChange(Math.max(0, quantity - 1))}
                      disabled={quantity <= 0}
                    >
                      <RemoveIcon />
                    </IconButton>
                    <IconButton 
                      aria-label="Увеличить количество" 
                      onClick={() => handleQuantityChange(quantity + 1)}
                    >
                      <AddIcon />
                    </IconButton>
                  </div>
                </div>
                
                {/* Переключатель единиц измерения */}
                <div className={styles.unitToggleContainer}>
                  <ToggleButtonGroup
                    exclusive
                    value={unitType}
                    onChange={(e, value) => value && handleUnitToggle(value as 'шт' | 'гр')}
                    aria-label="Единицы измерения"
                    className={styles.unitToggleGroup}
                  >
                    <ToggleButton 
                      className={`${styles.unitToggleButton} ${unitType === 'шт' ? styles.unitToggleButtonActive : ''}`} 
                      value="шт" 
                      aria-label="штуки"
                    >
                      шт
                    </ToggleButton>
                    <ToggleButton 
                      className={`${styles.unitToggleButton} ${unitType === 'гр' ? styles.unitToggleButtonActive : ''}`} 
                      value="гр" 
                      aria-label="граммы"
                    >
                      гр
                    </ToggleButton>
                  </ToggleButtonGroup>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Правая колонка - причина и описание */}
        <div className={styles.rightColumn}>
          {/* Секция причины списания */}
          <motion.div 
            className={`${styles.section} ${styles.reasonSection}`} 
            variants={itemVariants}
            ref={reasonsContainerRef}
          >
            <div className={styles.sectionTitle}>
              <h4>Причина списания</h4>
            </div>
            
            {/* Переключатель списка причин */}
            <div 
              className={`${styles.reasonSelector} ${isReasonsListOpen ? styles.reasonSelectorActive : ''}`}
              onClick={toggleReasonsList}
            >
              {selectedReason ? (
                <motion.div 
                  className={styles.reasonSelected}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <h5>{selectedReason.title}</h5>
                  <p>{selectedReason.description}</p>
                  
                  {/* Кнопка информации */}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectedReason && setInfoModalOpen(selectedReason.id);
                    }}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: 'var(--primary-color)',
                      opacity: 0.7,
                      '&:hover': {
                        opacity: 1,
                      },
                    }}
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                  
                  {/* Иконка стрелки для разворачивания */}
                  <div className={styles.arrowIcon}>
                    {isReasonsListOpen ? (
                      <KeyboardArrowUpIcon />
                    ) : (
                      <KeyboardArrowDownIcon />
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  className={styles.reasonPlaceholder}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.97 }}
                >
                  <h5>Выберите причину списания</h5>
                  <KeyboardArrowDownIcon />
                </motion.div>
              )}
            </div>
            
            {/* Выпадающий список причин */}
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            <AnimatePresence>
              {isReasonsListOpen && (
                <motion.div
                  className={styles.reasonsList}
                  initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -5, scaleY: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {/* Показываем все доступные причины */}
                  {writeOffReasons.map((reason, index) => (
                    <motion.div
                      key={reason.id}
                      className={`${styles.reasonItem} ${selectedReason?.id === reason.id ? styles.reasonItemSelected : ''}`}
                      variants={reasonItemVariants}
                      custom={index}
                      onClick={() => selectReason(reason)}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <div className={styles.reasonItemContent}>
                        <h5>{reason.title}</h5>
                        <p>{reason.description}</p>
                      </div>
                      
                      {selectedReason?.id === reason.id && (
                        <CheckCircleIcon 
                          className={styles.checkIcon} 
                          fontSize="small"
                        />
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Секция описания */}
          <motion.div className={styles.section} variants={itemVariants}>
            <div className={styles.sectionTitle}>
              <h4>Описание (необязательно)</h4>
            </div>
            
            <div className={styles.descriptionContainer}>
              <textarea
                className={styles.descriptionTextarea}
                value={writeOffDescription}
                onChange={handleDescriptionChange}
                placeholder="Описание (необязательно)"
                onFocus={(e) => {
                  // Сохраняем размеры при фокусе
                  e.currentTarget.style.height = '120px';
                  e.currentTarget.style.transform = 'none';
                  
                  // Закрываем выпадающий список причин если он открыт
                  if (isReasonsListOpen) {
                    setIsReasonsListOpen(false);
                  }
                }}
                onBlur={(e) => {
                  // Сохраняем размеры при потере фокуса
                  e.currentTarget.style.height = '120px';
                  e.currentTarget.style.transform = 'none';
                }}
                maxLength={250} // Ограничиваем длину текста
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Футер с кнопками */}
      <motion.div 
        className={styles.footer}
        variants={itemVariants}
      >
        <Button
          className={styles.cancelButton}
          onClick={onClose}
          disabled={isSubmitting}
        >
          Отмена
        </Button>

        <Button
          className={styles.submitButton}
          onClick={onSubmit}
          disabled={!writeOffName || !selectedReason || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={20} color="inherit" className={styles.loadingSpinner} />
              {isEditMode ? 'Обновление...' : 'Создание...'}
            </>
          ) : (
            isEditMode ? 'Обновить' : 'Создать'
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default NormalModeDesktop; 