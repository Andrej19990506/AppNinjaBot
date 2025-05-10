import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import AddIcon from '@mui/icons-material/Add';
import { InventoryItem } from '../../types/inventory';
import styles from './Inventory.module.css';

interface CategoriesListProps {
  categories: string[];
  items: Record<string, Record<string, InventoryItem>>;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  onSelectItem: (category: string, itemId: string) => void;
  selectedItem?: { category: string; itemId: string } | null;
}

const CategoriesList: React.FC<CategoriesListProps> = ({
  categories,
  items,
  selectedCategory,
  onSelectCategory,
  onSelectItem,
  selectedItem
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0 });
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Обновляем позицию выпадающего списка при выборе категории
  useEffect(() => {
    if (expandedCategory && categoryRefs.current[expandedCategory]) {
      const element = categoryRefs.current[expandedCategory];
      if (element) {
        const rect = element.getBoundingClientRect();
        setDropdownPosition({ top: rect.top });
      }
    }
  }, [expandedCategory]);

  // Обработчик клика по категории
  const handleCategoryClick = (category: string) => {
    if (expandedCategory === category) {
      // Если та же категория выбрана, закрываем выпадающий список
      setExpandedCategory(null);
    } else {
      // Открываем новый выпадающий список и обновляем выбранную категорию
      setExpandedCategory(category);
      onSelectCategory(category);
    }
  };

  // Количество товаров в категории
  const getCategoryItemsCount = (category: string) => {
    return items[category] ? Object.keys(items[category]).length : 0;
  };

  // Количество единиц всех товаров в категории
  const getCategoryTotalQuantity = (category: string) => {
    if (!items[category]) return 0;
    
    return Object.values(items[category]).reduce((sum, item) => {
      return sum + (item.quantity || 0);
    }, 0);
  };

  // Варианты анимации для выпадающего списка
  const dropdownVariants = {
    hidden: { opacity: 0, x: -20, width: 0 },
    visible: { 
      opacity: 1, 
      x: 0, 
      width: 300,
      transition: { 
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    exit: { 
      opacity: 0, 
      x: -20, 
      width: 0,
      transition: { 
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  };

  // Отображение количества товаров для бейджа
  const formatQuantity = (quantity: number) => {
    if (quantity > 999) {
      return `${Math.floor(quantity / 1000)}k+`;
    }
    return quantity.toString();
  };

  // Проверка на низкий уровень запасов
  const isLowStock = (item: InventoryItem) => {
    return item.quantity && item.quantity <= (item.lowStockThreshold || 5);
  };

  // Проверка на отсутствие товара на складе
  const isOutOfStock = (item: InventoryItem) => {
    return item.quantity === 0;
  };

  return (
    <div className={styles.categoriesList}>
      {categories.map((category) => (
        <div
          key={category}
          ref={(el) => categoryRefs.current[category] = el}
          className={`${styles.categoryItem} ${selectedCategory === category ? styles.active : ''}`}
          onClick={() => handleCategoryClick(category)}
        >
          <span className={styles.categoryName}>{category}</span>
          <span className={styles.categoryCount}>
            {formatQuantity(getCategoryItemsCount(category))}
          </span>
          
          {/* Выпадающий список товаров */}
          <AnimatePresence>
            {expandedCategory === category && (
              <motion.div
                className={styles.itemsDropdown}
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ top: `${Math.max(0, dropdownPosition.top - 200)}px` }}
              >
                <div className={styles.dropdownHeader}>
                  <h4 className={styles.dropdownTitle}>{category}</h4>
                  <span className={styles.categoryCount}>
                    {getCategoryTotalQuantity(category)} шт.
                  </span>
                </div>
                
                <div className={styles.itemsList}>
                  {items[category] && Object.entries(items[category]).map(([itemId, item]) => (
                    <div
                      key={itemId}
                      className={`${styles.itemRow} ${selectedItem && selectedItem.category === category && selectedItem.itemId === itemId ? styles.active : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(category, itemId);
                      }}
                    >
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemMeta}>
                          <ShoppingBasketIcon fontSize="small" />
                          Осталось: {item.quantity} {item.unit || 'шт'}
                        </span>
                      </div>
                      <span className={`${styles.itemQuantity} ${isLowStock(item) ? styles.low : ''} ${isOutOfStock(item) ? styles.empty : ''}`}>
                        {item.quantity}
                      </span>
                    </div>
                  ))}
                  
                  {/* Кнопка добавления товара */}
                  <div 
                    className={styles.itemRow}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Здесь будет логика добавления нового товара
                    }}
                  >
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName} style={{ color: 'var(--primary-color)' }}>
                        <AddIcon fontSize="small" />
                        Добавить товар
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export default CategoriesList; 