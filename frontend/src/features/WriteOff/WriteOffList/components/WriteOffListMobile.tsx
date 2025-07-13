// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Typography from '@mui/material/Typography';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { WriteOffItem } from '@/types/writeOff';
import styles from '@/features/WriteOff/WriteOffList/components/WriteOffListMobile.module.css';
import WriteOffItemMobile from '@/features/WriteOff/WriteOffList/components/WriteOffItemMobile';
import WriteOffItemMenu from '@/features/WriteOff/WriteOffList/components/WriteOffItemMenu';
import AddWriteOffButton from '@/features/WriteOff/WriteOffList/components/AddWriteOffButton';

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
  onAddNew?: () => void;
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
  
  // Состояния для отслеживания позиции скролла
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  
  // Отфильтрованные элементы (без удаленных)
  const filteredItems = items.filter(item => !removedItems.includes(item.id));
  const isEmpty = filteredItems.length === 0;

  // Обработчик скролла для управления эффектом размытия
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // Определяем находимся ли мы в самом верху (с небольшим допуском)
    setIsAtTop(scrollTop <= 5);
    
    // Определяем находимся ли мы в самом низу (с небольшим допуском)
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 5);
  };

  // Добавляем обработчик скролла
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      // Проверяем начальное состояние
      handleScroll();
    }
    
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Обновляем состояние при изменении элементов
  useEffect(() => {
    // Небольшая задержка для корректного расчета размеров
    setTimeout(() => {
      handleScroll();
    }, 100);
  }, [items, removedItems]);
  
  return (
    <div className={styles.container}>
      <div className={styles.listContainer}>
        {/* Плавающие частицы */}
        <div className={styles.particles}>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
        </div>
        
        {/* Скролл-контейнер */}
        <div 
          className={`${styles.scrollContainer} ${isAtTop ? styles.atTop : ''} ${isAtBottom ? styles.atBottom : ''}`} 
          ref={scrollContainerRef}
        >
          
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