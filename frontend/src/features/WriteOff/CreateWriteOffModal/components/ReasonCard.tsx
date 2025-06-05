import React, { useState } from 'react';
import { motion } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InfoIcon from '@mui/icons-material/Info';
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
export const ReasonCard = React.forwardRef<HTMLDivElement, ReasonCardProps>(({
  reason,
  isSelected,
  onSelect,
  onInfoClick,
  variants,
  index,
  isDesktop = false
}, ref) => {
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  
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
      ref={ref}
      className={`${styles.reasonCard} ${isSelected ? styles.selected : ''} ${isDesktop ? styles.desktopReasonCard : ''} reason-card`}
      data-reason-id={reason.id}
      variants={variants}
      custom={index}
      initial="hidden"
      animate="visible"
      exit="exit"
      layoutId={`reason-${reason.id}`}
      onClick={() => onSelect(reason)}
    >
      <div className={styles.reasonContent}>
        <div className={styles.reasonTitle}>{reason.title || 'Без названия'}</div>
        {reason.description && (
          <div className={styles.reasonDescription}>{reason.description}</div>
        )}
      </div>
      {isSelected && (
        <div className={styles.selectedBadge}>Выбрано</div>
      )}
    </motion.div>
  );
});