import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import { InventoryItem } from '../../types/inventoryTypes';
import styles from './Inventory.module.css';

interface CategoriesListProps {
  categories: string[];
  items: Record<string, Record<string, InventoryItem>>;
  selectedCategory: string | null;
  selectedItem: { category: string; itemId: string } | null;
  onSelectCategory: (category: string) => void;
  onSelectItem: (category: string, itemId: string) => void;
}

const CategoriesList: React.FC<CategoriesListProps> = ({
  categories,
  items,
  selectedCategory,
  selectedItem,
  onSelectCategory,
  onSelectItem
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string>('');
  
  // Проверка на низкий уровень запасов
  const isLowStock = (item: InventoryItem) => {
    const quantity = item.raw?.quantity ?? 0;
    const threshold = 5;
    return quantity > 0 && quantity <= threshold;
  };
  
  // Проверка на отсутствие товара на складе
  const isOutOfStock = (item: InventoryItem) => {
    const quantity = item.raw?.quantity ?? 0;
    return quantity === 0 || item.raw?.isOutOfStock;
  };
  
  // Получение общего количества товаров в категории
  const getCategoryTotalQuantity = (category: string) => {
    if (!items[category]) return 0;
    
    return Object.values(items[category]).reduce((total, item) => total + (item.raw?.quantity ?? 0), 0);
  };
  
  return (
    <div className={styles.categoriesList}>
      {categories.map((category) => (
        <div key={category} className={styles.categoryContainer}>
          <div 
            className={`${styles.categoryItem} ${selectedCategory === category ? styles.active : ''}`}
            onClick={() => onSelectCategory(category)}
          >
            <div className={styles.categoryName}>{category}</div>
            <div className={styles.categoryCount}>{Object.keys(items[category] || {}).length} товаров</div>
          </div>
          
          {/* Выпадающий список товаров */}
          {expandedCategory === category && (
            <div className={styles.itemsDropdown}>
              {/* Содержимое выпадающего списка */}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CategoriesList; 