import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Typography from '@mui/material/Typography';
import ListIcon from '@mui/icons-material/List';
import Grid from '@mui/material/Grid';
import { WriteOffItem } from '../../../../types/writeOff';
import styles from './WriteOffListDesktop.module.css';
import WriteOffItemDesktop from './WriteOffItemDesktop';
import AddWriteOffButton from './AddWriteOffButton';

interface WriteOffListDesktopProps {
  items: WriteOffItem[];
  removingItems: string[];
  removedItems: string[];
  onEdit: (item: WriteOffItem) => void;
  onDelete: (item: WriteOffItem) => void;
  onClone?: (item: WriteOffItem) => void;
  onAddNew?: () => void;
}

/**
 * Десктопная версия компонента списка списаний
 */
const WriteOffListDesktop: React.FC<WriteOffListDesktopProps> = ({
  items,
  removingItems,
  removedItems,
  onEdit,
  onDelete,
  onClone = () => {},
  onAddNew,
}) => {
  const activeItems = items.filter(item => !removedItems.includes(item.id));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  
  // Обработчик скроллинга для управления тенями
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      
      // Показываем верхнюю тень, когда не в самом верху
      setShowTopShadow(scrollTop > 5);
      
      // Показываем нижнюю тень, когда не в самом низу
      setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 5);
    }
  };
  
  // Проверяем необходимость теней при первом рендеринге
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowBottomShadow(scrollHeight > clientHeight);
      
      // Проверяем еще раз после полной загрузки компонентов
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const { scrollHeight, clientHeight } = scrollContainerRef.current;
          setShowBottomShadow(scrollHeight > clientHeight);
        }
      }, 500);
    }
  }, [activeItems.length]);
  
  return (
    <div className={styles.container}>
      <div className={styles.listContainer}>
        {activeItems.length > 0 ? (
          // Контейнер с прокруткой
          <div className={styles.listBorder}>
            <div className={styles.scrollContainer} ref={scrollContainerRef} onScroll={handleScroll}>
              {/* Тени для индикации скроллинга */}
              <div className={`${styles.scrollShadowTop} ${showTopShadow ? styles.scrollShadowVisible : ''}`} />
              <div className={`${styles.scrollShadowBottom} ${showBottomShadow ? styles.scrollShadowVisible : ''}`} />
              
              <div className={styles.listBorderInner}>
                <Grid container spacing={1} className={styles.gridContainer}>
                  <AnimatePresence>
                    {activeItems.map(item => (
                      <Grid item xs={12} key={item.id} className={styles.gridItem}>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                        >
                          <WriteOffItemDesktop
                            item={item}
                            isRemoving={removingItems.includes(item.id)}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onClone={onClone}
                          />
                        </motion.div>
                      </Grid>
                    ))}
                  </AnimatePresence>
                </Grid>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={styles.emptyState}
          >
            <ListIcon sx={{ 
              fontSize: 48, 
              opacity: 0.6, 
              mb: 1,
              color: 'var(--primary-color)',
              animation: 'bounce 2s infinite ease-in-out'
            }} />
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
              Нет элементов для отображения
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Добавьте новые списания с помощью кнопки ниже
            </Typography>
          </motion.div>
        )}
      </div>

      {/* Кнопка добавления нового списания */}
      {onAddNew && <AddWriteOffButton onAddNew={onAddNew} />}
    </div>
  );
};

export default WriteOffListDesktop; 