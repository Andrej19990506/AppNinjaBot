// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Typography from '@mui/material/Typography';
import ListIcon from '@mui/icons-material/List';
import Grid from '@mui/material/Grid';
import { WriteOffItem } from '@/types/writeOff';
import styles from '@/features/WriteOff/WriteOffList/components/WriteOffListDesktop.module.css';
import WriteOffItemDesktop from '@/features/WriteOff/WriteOffList/components/WriteOffItemDesktop';
import AddWriteOffButton from '@/features/WriteOff/WriteOffList/components/AddWriteOffButton';

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
  
  // Состояния для отслеживания позиции скролла
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  
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
  }, [activeItems.length]);
  
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
        
        {activeItems.length > 0 ? (
          // Контейнер с прокруткой
          <div className={styles.listBorder}>
            <div 
              className={`${styles.scrollContainer} ${isAtTop ? styles.atTop : ''} ${isAtBottom ? styles.atBottom : ''}`} 
              ref={scrollContainerRef}
            >
              
              <div className={styles.listBorderInner}>
                <Grid container spacing={1} className={styles.gridContainer}>
                  {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
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