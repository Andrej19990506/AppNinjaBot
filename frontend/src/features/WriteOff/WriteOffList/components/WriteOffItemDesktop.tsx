import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import { RootState } from '@/store';
import { WriteOffItem } from '@/types/writeOff';
import { canEditWriteOffsForDate } from '@/shared/utils/dateUtils';
import styles from '@/features/WriteOff/WriteOffList/components/WriteOffItemDesktop.module.css';
import { formatDate } from '@/features/WriteOff/WriteOffList/utils/dateUtils';
import WriteOffAuthor from './WriteOffAuthor';

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
  const selectedDate = useSelector((state: RootState) => state.writeOff.selectedDate);
  const canEdit = canEditWriteOffsForDate(selectedDate);



  // Используем useCallback для мемоизации обработчиков событий
  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!canEdit) return;
    
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
  }, [item, onEdit, canEdit]);

  const handleCloneClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!canEdit) return;
    
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
  }, [item, onClone, canEdit]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!canEdit) return;
    
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
  }, [item, onDelete, canEdit]);

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
        
        <div className={styles.cardFooter}>
          <WriteOffAuthor
            author={item.author}
            created_at={item.created_at}
            variant="desktop"
            showTime={true}
          />
          
          <div className={styles.actionsContainer}>
            <motion.div 
              className={styles.actionButtons}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Tooltip title={canEdit ? "Редактировать" : "Нельзя редактировать прошедшие дни"} arrow placement="top">
                <IconButton 
                  size="small" 
                  className={`${styles.actionButton} ${styles.editButton}`} 
                  onClick={handleEditClick}
                  disabled={isRemoving || !canEdit}
                >
                  <EditIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title={canEdit ? "Клонировать" : "Нельзя клонировать в прошедшие дни"} arrow placement="top">
                <IconButton 
                  size="small" 
                  className={`${styles.actionButton} ${styles.cloneButton}`} 
                  onClick={handleCloneClick}
                  disabled={isRemoving || !canEdit}
                >
                  <FileCopyIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title={canEdit ? "Удалить" : "Нельзя удалить в прошедшие дни"} arrow placement="top">
                <IconButton 
                  size="small" 
                  className={`${styles.actionButton} ${styles.deleteButton}`} 
                  onClick={handleDeleteClick}
                  disabled={isRemoving || !canEdit}
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