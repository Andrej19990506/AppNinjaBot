// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Typography from '@mui/material/Typography';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { WriteOffItem } from '../../../../types/writeOff';
import styles from './WriteOffListMobile.module.css';
import WriteOffItemMobile from './WriteOffItemMobile';
import WriteOffItemMenu from './WriteOffItemMenu';
import AddWriteOffButton from './AddWriteOffButton';

interface WriteOffListMobileProps {
  items: WriteOffItem[];
  removingItems: string[];
  removedItems: string[];
  selectedItem: WriteOffItem | null;
  menuAnchorEl: HTMLElement | null;
  menuOpen: boolean;
  handleMenuOpen: (event: React.MouseEvent<HTMLElement>, item: WriteOffItem) => void;
  handleMenuClose: () => void;
  handleEditClick: () => void;
  handleDeleteClick: () => void;
  handleCloneClick: () => void;
  onAddNew: () => void;
}

/**
 * Мобильная версия компонента списка списаний с улучшенным UX
 */
const WriteOffListMobile: React.FC<WriteOffListMobileProps> = ({
  items,
  removingItems,
  removedItems,
  selectedItem,
  menuAnchorEl,
  menuOpen,
  handleMenuOpen,
  handleMenuClose,
  handleEditClick,
  handleDeleteClick,
  handleCloneClick,
  onAddNew,
}) => {
  // Рефы для скролл-контейнера
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Состояния для теней при скролле
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(true);
  
  // Отфильтрованные элементы (без удаленных)
  const filteredItems = items.filter(item => !removedItems.includes(item.id));
  const isEmpty = filteredItems.length === 0;
  
  // Обработчик скролла для показа/скрытия теней
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // Показываем верхнюю тень, когда не в начале скролла
    setShowTopShadow(scrollTop > 5);
    
    // Показываем нижнюю тень, когда не в конце скролла
    setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 5);
  };
  
  // Добавляем обработчики при монтировании
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      // Инициализируем состояние теней
      handleScroll();
    }
    
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);
  
  // Обновляем тени при изменении списка элементов
  useEffect(() => {
    handleScroll();
  }, [items, removedItems]);
  
  return (
    <div className={styles.container}>
      <div className={styles.listContainer}>
        {/* Скролл-контейнер с тенями */}
        <div className={styles.scrollContainer} ref={scrollContainerRef}>
          {/* Тени для скролла */}
          <div className={`${styles.scrollShadowTop} ${showTopShadow ? styles.scrollShadowVisible : ''}`} />
          <div className={`${styles.scrollShadowBottom} ${showBottomShadow ? styles.scrollShadowVisible : ''}`} />
          
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={styles.emptyState}
            >
              <ListAltIcon className={styles.emptyStateIcon} />
              <Typography variant="body1" className={styles.emptyStateText}>
                Нет элементов для отображения
              </Typography>
            </motion.div>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            <AnimatePresence>
              {filteredItems.map(item => (
                <WriteOffItemMobile
                  key={item.id}
                  item={item}
                  isRemoving={removingItems.includes(item.id)}
                  onMenuOpen={(event: React.MouseEvent<HTMLElement>) => handleMenuOpen(event, item)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
      
      {/* Меню с опциями для элемента */}
      <WriteOffItemMenu
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        selectedItem={selectedItem}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onClone={handleCloneClick}
      />
      
      {/* Кнопка добавления списания в фиксированном контейнере */}
      <div className={styles.addButtonContainer}>
        {onAddNew && <AddWriteOffButton onAddNew={onAddNew} />}
      </div>
    </div>
  );
};

export default WriteOffListMobile; 