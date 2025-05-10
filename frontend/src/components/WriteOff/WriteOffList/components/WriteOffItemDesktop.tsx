import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import Chip from '@mui/material/Chip';
import { WriteOffItem } from '../../../../types/writeOff';
import styles from './WriteOffitemDesktop.module.css';
import { formatDate } from '../utils/dateUtils';

interface WriteOffItemDesktopProps {
  item: WriteOffItem;
  isRemoving: boolean;
  onEdit: (item: WriteOffItem) => void;
  onDelete: (item: WriteOffItem) => void;
  onClone: (item: WriteOffItem) => void;
}

/**
 * Компонент для отображения отдельного элемента списания (десктопная версия)
 * Использует memo для предотвращения лишних ререндеров
 */
const WriteOffItemDesktop: React.FC<WriteOffItemDesktopProps> = memo(({ 
  item, 
  isRemoving, 
  onEdit,
  onDelete,
  onClone
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: 'var(--primary-transparent)', color: 'var(--primary-color)' };
      case 'pending':
        return { bg: 'var(--warning-transparent)', color: 'var(--warning-color)' };
      case 'completed':
        return { bg: 'var(--success-transparent)', color: 'var(--success-color)' };
      case 'cancelled':
        return { bg: 'var(--error-transparent)', color: 'var(--error-color)' };
      default:
        return { bg: 'var(--gray-transparent)', color: 'var(--text-secondary)' };
    }
  };

  const statusColors = getStatusColor(item.status);
  const statusText = item.status === 'active' ? 'Активен' : item.status;

  // Используем useCallback для мемоизации обработчиков событий
  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Делаем копию элемента с правильным типом
    // Обратите внимание: убедитесь, что reason не может быть null
    const itemCopy = { 
      ...item,
      reason: item.reason
    };
    
    console.log('🔍 [WriteOffItemDesktop] Редактирование элемента:', {
      id: itemCopy.id,
      name: itemCopy.name,
      reason: itemCopy.reason?.title,
      quantity: itemCopy.quantity,
      unitType: itemCopy.unitType
    });
    
    onEdit(itemCopy);
  }, [item, onEdit]);

  const handleCloneClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Делаем копию элемента с правильным типом
    const itemCopy = { 
      ...item,
      reason: item.reason
    };
    
    console.log('🔍 [WriteOffItemDesktop] Клонирование элемента:', {
      id: itemCopy.id,
      name: itemCopy.name,
      reason: itemCopy.reason?.title,
      quantity: itemCopy.quantity,
      unitType: itemCopy.unitType
    });
    
    onClone(itemCopy);
  }, [item, onClone]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Делаем копию элемента с правильным типом
    const itemCopy = { 
      ...item,
      reason: item.reason
    };
    
    console.log('🔍 [WriteOffItemDesktop] Удаление элемента:', {
      id: itemCopy.id,
      name: itemCopy.name,
      quantity: itemCopy.quantity
    });
    
    onDelete(itemCopy);
  }, [item, onDelete]);

  return (
    <div 
      className={`${styles.container} ${isRemoving ? styles.removingContainer : ''}`}
      data-write-off-id={item.id}
    >
      <div className={styles.headerRow}>
        <div className={styles.titleContainer}>
          <Typography component="h3" className={styles.title} variant="body1">
            <InventoryIcon 
              fontSize="small" 
              sx={{ 
                mr: 1, 
                opacity: 0.7, 
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                transition: 'all var(--transition-fast)'
              }} 
            />
            {item.name}
          </Typography>
        </div>
        <Tooltip title={`Количество: ${item.quantity} ${item.unitType || 'шт'}`} arrow placement="top">
          <Box className={styles.quantityBadge}>
            <span>{item.quantity} {item.unitType || 'шт'}</span>
          </Box>
        </Tooltip>
      </div>
      
      <div className={styles.contentContainer}>
        {item.reason && (
          <div className={styles.reasonContainer}>
            <LocalOfferIcon sx={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              fontSize: '0.85rem', 
              opacity: 0.7,
              color: 'var(--text-secondary)',
              transition: 'all var(--transition-fast)'
            }} />
            <span className={styles.reasonLabel}>Причина:</span>
            <span className={styles.reason}>{item.reason.title}</span>
          </div>
        )}
        
        {item.description && (
          <div className={styles.description}>
            <DescriptionIcon sx={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              fontSize: '0.85rem', 
              opacity: 0.7,
              color: 'var(--text-secondary)',
              transition: 'all var(--transition-fast)'
            }} />
            {item.description}
          </div>
        )}
        
        <div className={styles.footerRow}>
          <Typography className={styles.date} variant="caption" component="span">
            <AccessTimeIcon sx={{ 
              mr: 0.5, 
              fontSize: '0.8rem', 
              opacity: 0.7,
              verticalAlign: 'text-bottom',
              color: 'var(--text-secondary)',
              transition: 'all var(--transition-fast)'
            }} />
            {formatDate(item.created_at)}
          </Typography>
          
          <div className={styles.actionsContainer}>
            <Chip
              size="small"
              label={statusText}
              sx={{ 
                height: '20px',
                fontSize: '0.7rem',
                mr: 1,
                backgroundColor: statusColors.bg, 
                color: statusColors.color,
                transition: 'all var(--transition-normal)',
                '& .MuiChip-label': {
                  px: 1
                }
              }}
            />
            
            <motion.div 
              className={styles.actionButtons}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Tooltip title="Редактировать" arrow placement="top">
                <IconButton 
                  size="small" 
                  className={`${styles.actionButton} ${styles.editButton}`} 
                  onClick={handleEditClick}
                  disabled={isRemoving}
                >
                  <EditIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Клонировать" arrow placement="top">
                <IconButton 
                  size="small" 
                  className={`${styles.actionButton} ${styles.cloneButton}`} 
                  onClick={handleCloneClick}
                  disabled={isRemoving}
                >
                  <FileCopyIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Удалить" arrow placement="top">
                <IconButton 
                  size="small" 
                  className={`${styles.actionButton} ${styles.deleteButton}`} 
                  onClick={handleDeleteClick}
                  disabled={isRemoving}
                >
                  <DeleteIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Tooltip>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Добавляем displayName для облегчения отладки
WriteOffItemDesktop.displayName = 'WriteOffItemDesktop';

export default WriteOffItemDesktop; 