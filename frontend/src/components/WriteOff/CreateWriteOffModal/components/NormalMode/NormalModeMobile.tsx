// @ts-nocheck
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import styles from './NormalModeMobile.module.css';
import { WriteOffReason } from '../../../../../types/writeOff';
import CheckIcon from '@mui/icons-material/Check';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';

// Расширяем тип для использования в компоненте
interface ReasonInfo extends WriteOffReason {
  description: string;
}

interface NormalModeMobileProps {
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
  
  // Добавляем обработчики для кнопок
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isEditMode?: boolean;
  
  // Добавляем дополнительные параметры для согласованности с десктопной версией
  writeOffReasons?: WriteOffReason[];
  handleReasonSelect?: (reason: WriteOffReason) => void;
  handleDescriptionChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const NormalModeMobile: React.FC<NormalModeMobileProps> = ({
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
  
  // Добавляем обработчики для кнопок
  onClose,
  onSubmit,
  isSubmitting,
  isEditMode,
  
  // Добавляем дополнительные параметры для согласованности с десктопной версией
  writeOffReasons,
  handleReasonSelect,
  handleDescriptionChange
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Название списания */}
        <section className={styles.inputSection}>
          <label className={styles.inputLabel}>Название списания</label>
          <div className={styles.nameInputWrapper}>
            <TextField 
              className={styles.nameInput}
              variant="outlined"
              fullWidth
              placeholder="Введите название списания..."
              value={writeOffName}
              onChange={handleNameChange}
              inputRef={nameInputRef}
              InputProps={{
                endAdornment: (
                  <IconButton 
                    className={`${styles.descriptionButton} ${writeOffDescription ? styles.descriptionButtonActive : ''}`}
                    onClick={handleOpenDescriptionModal}
                    size="small"
                    aria-label="Добавить описание"
                  >
                    {writeOffDescription ? (
                      <div style={{ position: 'relative' }}>
                        <DescriptionIcon fontSize="small" />
                        <div className={styles.descriptionIndicator} />
                      </div>
                    ) : (
                      <DescriptionOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                )
              }}
            />
          </div>
          
          {/* Подсказка о добавлении описания */}
          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
          <AnimatePresence>
            {showDescriptionHint && (
              <motion.div 
                className={styles.descriptionHintContainer}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.descriptionHintArrow}></div>
                <InfoOutlinedIcon className={styles.descriptionHintIcon} />
                <div className={styles.descriptionHintText}>
                  Добавьте описание, чтобы уточнить детали списания
                </div>
                <IconButton 
                  className={styles.descriptionHintClose}
                  onClick={() => setShowDescriptionHint(false)}
                  size="small"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        
        {/* Секция количества */}
        <section className={styles.quantitySection}>
          <h3 className={styles.quantityTitle}>Количество</h3>
          
          {isQuantityInputOpen ? (
            <div className={styles.quantityInputContainer}>
              <TextField
                variant="outlined"
                type="number"
                placeholder="Введите количество"
                value={tempQuantity}
                onChange={handleQuantityInputChange}
                inputRef={quantityInputRef}
                autoFocus
                inputProps={{ min: 0 }}
              />
              <div style={{ display: 'flex' }}>
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
          ) : (
            <div className={styles.quantityControls}>
              <div className={styles.quantityActions}>
                <IconButton 
                  onClick={() => handleQuantityChange(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <RemoveIcon />
                </IconButton>
              </div>
              
              <div 
                className={styles.quantityValueContainer}
                onClick={handleOpenQuantityInput}
              >
                <div className={styles.quantityValue}>
                  <span className={styles.quantityNumber}>{quantity}</span>
                  <span className={styles.quantityUnit}>{unitType}</span>
                </div>
              </div>
              
              <div className={styles.quantityActions}>
                <IconButton onClick={() => handleQuantityChange(quantity + 1)}>
                  <AddIcon />
                </IconButton>
              </div>
            </div>
          )}
          
          <div className={styles.unitToggleContainer}>
            <div className={styles.unitToggleGroup}>
              <button 
                className={`${styles.unitToggleButton} ${unitType === 'шт' ? styles.unitToggleButtonActive : ''}`}
                onClick={() => handleUnitToggle('шт')}
              >
                Шт
              </button>
              <button 
                className={`${styles.unitToggleButton} ${unitType === 'гр' ? styles.unitToggleButtonActive : ''}`}
                onClick={() => handleUnitToggle('гр')}
              >
                Гр
              </button>
            </div>
          </div>
        </section>
        
        {/* Секция причин списания */}
        <section className={styles.reasonsSection}>
          <h3 className={styles.reasonsTitle}>Причина списания</h3>
          
          {selectedReason ? (
            <motion.div 
              className={styles.selectedReasonCard}
              onClick={handleOpenReasonModal}
              whileTap={{ scale: 0.97 }}
            >
              <div className={styles.reasonContent}>
                <h4 className={styles.reasonTitle}>{selectedReason.title}</h4>
                <IconButton 
                  className={styles.infoButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoModalOpen(selectedReason.id);
                  }}
                  size="small"
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </div>
            </motion.div>
          ) : (
            <motion.button 
              className={styles.selectReasonButton}
              onClick={handleOpenReasonModal}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0.9 }}
              whileHover={{ opacity: 1 }}
            >
              <AddCircleOutlineIcon className={styles.selectReasonIcon} />
              <span>Выбрать причину</span>
            </motion.button>
          )}
        </section>
      </div>
    </div>
  );
};

export default NormalModeMobile; 