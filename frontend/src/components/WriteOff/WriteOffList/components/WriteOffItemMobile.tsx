import React from 'react';
import { motion } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DescriptionIcon from '@mui/icons-material/Description';
import { WriteOffItem } from '../../../../types/writeOff';
import styles from '../WriteOffList.module.css';
import { formatDate } from '../utils/dateUtils';

interface WriteOffItemMobileProps {
  item: WriteOffItem;
  isRemoving: boolean;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Компонент для отображения отдельного элемента списания (мобильная версия)
 */
const WriteOffItemMobile: React.FC<WriteOffItemMobileProps> = ({ 
  item, 
  isRemoving, 
  onMenuOpen 
}) => {
  return (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isRemoving ? 0 : 1,
        y: isRemoving ? -50 : 0,
        scale: isRemoving ? 0.9 : 1,
        height: isRemoving ? 0 : 'auto',
        marginTop: isRemoving ? -20 : 0,
        marginBottom: isRemoving ? 0 : 12,
      }}
      exit={{ opacity: 0, y: -50, scale: 0.9, height: 0 }}
      transition={{ 
        duration: isRemoving ? 0.5 : 0.3,
        ease: isRemoving ? 'anticipate' : 'easeOut'
      }}
      className={`${styles.todoItem} ${isRemoving ? styles.removing : ''}`}
      data-write-off-id={item.id}
    >
      <div className={styles.todoContent}>
        <div className={styles.todoHeader}>
          <InventoryIcon className={styles.titleIcon} fontSize="small" />
          <h3 className={styles.todoTitle}>
            {item.name}
          </h3>
          <div className={styles.quantityBadge}>
            <span>{item.quantity} {item.unitType || 'шт'}</span>
          </div>
          <IconButton 
            size="small" 
            onClick={onMenuOpen}
            className={styles.actionButton}
            disabled={isRemoving}
            aria-label="Опции"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </div>
        
        <div className={styles.todoInfo}>
          {item.reason && (
            <div className={styles.infoRow}>
              <LocalOfferIcon className={styles.infoIcon} fontSize="small" />
              <span className={styles.infoText}>{item.reason.title}</span>
            </div>
          )}
          
          {item.description && (
            <div className={styles.todoDescription}>
              <DescriptionIcon className={styles.descriptionIcon} fontSize="small" />
              <span className={styles.descriptionText}>{item.description}</span>
            </div>
          )}
          
          <div className={styles.infoRow}>
            <AccessTimeIcon className={styles.infoIcon} fontSize="small" />
            <span className={styles.infoText}>{formatDate(item.created_at)}</span>
          </div>
          
          <div className={styles.status}>
            {item.status === 'active' ? 'Активен' : item.status}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WriteOffItemMobile; 