import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import Tooltip from '@mui/material/Tooltip';
import styles from './ReasonCard.module.css';
import { WriteOffReason } from '../../../../types/writeOff';

interface ReasonCardProps {
  reason: WriteOffReason;
  isSelected: boolean;
  onSelect: (reason: WriteOffReason) => void;
  onInfoClick: (reasonId: string) => void;
  variants: any;
  index: number;
  isDesktop?: boolean;
}

/**
 * Компонент карточки с причиной списания
 */
export const ReasonCard: React.FC<ReasonCardProps> = ({
  reason,
  isSelected,
  onSelect,
  onInfoClick,
  variants,
  index,
  isDesktop = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  
  // Обработчики наведения мыши
  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);
  
  // Обработчики наведения на иконку подсказки
  const handleInfoMouseEnter = () => setIsInfoHovered(true);
  const handleInfoMouseLeave = () => setIsInfoHovered(false);

  // Рендер кнопки информации в зависимости от типа устройства
  const renderInfoButton = () => {
    // Для десктопной версии используем тултип
    if (isDesktop) {
      return (
        <Tooltip 
          title={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {reason.description || "Нет дополнительной информации о причине списания"}
            </motion.div>
          }
          placement="top"
          arrow
          classes={{
            tooltip: styles.customTooltip,
            arrow: styles.customArrow,
            popper: styles.customPopper
          }}
        >
          <motion.div
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
          >
            <IconButton 
              className={`${styles.infoButton} ${isInfoHovered ? styles.infoButtonActive : ''}`}
              size="small"
              data-reason-id={reason.id}
              aria-label="Информация о причине"
              onMouseEnter={handleInfoMouseEnter}
              onMouseLeave={handleInfoMouseLeave}
            >
              {isInfoHovered ? <InfoIcon fontSize="small" /> : <InfoOutlinedIcon fontSize="small" />}
            </IconButton>
          </motion.div>
        </Tooltip>
      );
    }
    
    // Для мобильной версии оставляем стандартное поведение с модальным окном
    return (
      <motion.div
        whileHover={{ scale: 1.1, rotate: 15 }}
        whileTap={{ scale: 0.95 }}
      >
        <IconButton 
          className={`${styles.infoButton} ${isInfoHovered ? styles.infoButtonActive : ''}`}
          size="small"
          data-reason-id={reason.id}
          onClick={(e) => {
            e.stopPropagation();
            onInfoClick(reason.id);
          }}
          onMouseEnter={handleInfoMouseEnter}
          onMouseLeave={handleInfoMouseLeave}
          aria-label="Информация"
        >
          {isInfoHovered ? <InfoIcon fontSize="small" /> : <InfoOutlinedIcon fontSize="small" />}
        </IconButton>
      </motion.div>
    );
  };

  return (
    <motion.div
      className={`${styles.reasonCard} ${isSelected ? styles.selected : ''} ${isDesktop ? styles.desktopReasonCard : ''} reason-card`}
      data-reason-id={reason.id}
      variants={variants}
      custom={index}
      initial="hidden"
      animate="visible"
      exit="exit"
      layoutId={`reason-${reason.id}`}
      onClick={() => onSelect(reason)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: isDesktop ? 1.03 : 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className={styles.reasonContent}>
        <h4 className={styles.reasonTitle}>
          {reason.title}
          
          {isSelected && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              style={{ 
                color: 'var(--primary-color)',
                position: 'absolute',
                right: 8,
                top: 0
              }}
            >
              <CheckCircleIcon fontSize="small" />
            </motion.span>
          )}
        </h4>
        
        {renderInfoButton()}
        
        <AnimatePresence>
          {isSelected && (
            <motion.div 
              className={styles.selectedBadge}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              Выбрано
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Дополнительные визуальные эффекты для десктопной версии */}
      {isDesktop && isHovered && (
        <motion.div 
          className={styles.hoverEffect}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
}; 