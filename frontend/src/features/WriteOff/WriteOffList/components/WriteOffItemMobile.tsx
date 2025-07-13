import React, { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import IconButton from '@mui/material/IconButton';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DescriptionIcon from '@mui/icons-material/Description';
import PhotoIcon from '@mui/icons-material/Photo';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { WriteOffItem } from '@/types/writeOff';
import styles from '@/features/WriteOff/WriteOffList/WriteOffList.module.css';
import { formatDate } from '@/features/WriteOff/WriteOffList/utils/dateUtils';
import PhotoThumbnail from '@shared/components/PhotoGallery/PhotoThumbnail';
import PhotoGallery from '@shared/components/PhotoGallery/PhotoGallery';
import WriteOffAuthor from './WriteOffAuthor';

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Логирование данных элемента
  console.log('📋 [WriteOffItemMobile] Данные элемента:', {
    id: item.id,
    name: item.name,
    photoPath: item.photoPath,
    hasPhotoPath: !!item.photoPath,
    photoUrl: item.photoPath ? `${window.APP_CONFIG?.API_URL || 'http://localhost:8000'}/api/v1/write-offs/photos/${item.photoPath}` : null,
    item: item
  });
  
  // URL фото для галереи
  const photoUrl = item.photoPath 
    ? `${window.APP_CONFIG?.API_URL || 'http://localhost:8000'}/v1/write-offs/photos/${item.photoPath}`
    : null;
  
  // Обработчик клика на фото
  const handlePhotoClick = () => {
    if (photoUrl) {
      setIsGalleryOpen(true);
    }
  };

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
        
        {/* Отображение фото */}
        {photoUrl && (
          <div className={styles.photoContainer}>
            <div className={styles.photoThumbnailsContainer}>
              <PhotoThumbnail
                src={photoUrl}
                alt={`Фото списания ${item.name}`}
                onClick={handlePhotoClick}
                width="60px"
                height="60px"
              />
            </div>
          </div>
        )}
        
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
        </div>
        
        {/* Футер карточки с информацией об авторе */}
        <div className={styles.cardFooter}>
          <WriteOffAuthor
            author={item.author}
            created_at={item.created_at}
            variant="mobile"
            showTime={true}
          />
        </div>
      </div>
      
      {/* Галерея для просмотра фото через Portal */}
      {photoUrl && isGalleryOpen && typeof document !== 'undefined' && createPortal(
        <PhotoGallery
          photos={[photoUrl]}
          initialIndex={0}
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
        />,
        document.body
      )}
    </motion.div>
  );
};

export default WriteOffItemMobile; 