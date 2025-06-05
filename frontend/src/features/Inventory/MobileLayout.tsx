import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ItemList from '@/features/Inventory/ItemList';
import ItemEdit from '@/features/Inventory/ItemEdit';
import SearchBar from '@/features/Inventory/SearchBar';
import { InventoryItem } from '@/types/inventoryTypes';
import { SearchResult } from '@/types/search';
import styles from './Inventory.module.css';

interface MobileLayoutProps {
  categories: string[];
  inventory: Record<string, Record<string, InventoryItem>>;
  selectedCategory: string | null;
  selectedItem: { category: string; itemId: string; item: InventoryItem } | null;
  onCategorySelect: (category: string) => void;
  onItemSelect: (category: string, itemId: string) => void;
  onSearchItems: (query: string) => void;
  searchResults?: SearchResult[];
  searchQuery: string;
  onClearSearch: () => void;
  onUpdateItem?: (category: string, itemId: string, item: InventoryItem) => void;
  onDeleteItem?: (category: string, itemId: string) => void;
  onAddItem?: (category: string, item: InventoryItem) => void;
  isLoading?: boolean;
  error?: string | null;
  chatId?: string;
  onItemClose?: () => void;
  onSearchFocusChange?: (isFocused: boolean) => void;
  onHistoryItemSelect?: (query: string) => void;
  onSearchResultSelect?: (category: string, itemId: string) => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  categories,
  inventory,
  selectedCategory,
  selectedItem,
  onCategorySelect,
  onItemSelect,
  onSearchItems,
  searchResults = [],
  searchQuery,
  onClearSearch,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  isLoading = false,
  error = null,
  chatId,
  onItemClose,
  onSearchFocusChange,
  onHistoryItemSelect,
  onSearchResultSelect,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Функция для обработки выбора категории
  const handleCategorySelect = (category: string) => {
    onCategorySelect(category);
    setIsMenuOpen(false);
  };

  // Функция для обработки выбора результата поиска
  const handleSearchResultSelect = (category: string, itemId: string) => {
    onItemSelect(category, itemId);
    setIsSearchOpen(false);
  };

  // Варианты анимации
  const menuVariants = {
    closed: { x: '-100%', opacity: 0 },
    open: { x: 0, opacity: 1, transition: { duration: 0.3 } }
  };

  const searchVariants = {
    closed: { y: '-100%', opacity: 0 },
    open: { y: 0, opacity: 1, transition: { duration: 0.3 } }
  };

  return (
    <div className={styles.mobile}>
      {/* Панель навигации */}
      <div className={styles.navigationBar}>
        {selectedCategory || selectedItem ? (
          <button 
            className={styles.backButton}
            onClick={() => {
              if (selectedItem) {
                // Если выбран товар, возвращаемся к категории
                onItemSelect('', '');
              } else {
                // Если выбрана категория, возвращаемся к списку категорий
                onCategorySelect('');
              }
            }}
          >
            <ArrowBackIcon />
            <span>Назад</span>
          </button>
        ) : (
          <button 
            className={styles.menuButton}
            onClick={() => setIsMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        )}
        
        <div className={styles.pageTitle}>
          {selectedItem ? selectedItem.item.name : 
            selectedCategory ? selectedCategory : 
            'Инвентарь'}
        </div>
        
        <button 
          className={styles.searchButton}
          onClick={() => setIsSearchOpen(true)}
        >
          <SearchIcon />
        </button>
      </div>
      
      {/* Главный контент */}
      <div className={styles.mainSection}>
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <motion.div
              key="itemEdit"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className={styles.itemEditContainer}
            >
              <ItemEdit 
                item={selectedItem.item}
                category={selectedItem.category}
                itemId={selectedItem.itemId}
                onSave={(updatedItem) => {
                  if (onUpdateItem) {
                    onUpdateItem(selectedItem.category, selectedItem.itemId, updatedItem);
                  }
                }}
                onDelete={() => {
                  if (onDeleteItem) {
                    onDeleteItem(selectedItem.category, selectedItem.itemId);
                  }
                }}
                onCancel={() => onItemSelect('', '')}
                chatId={chatId || ''}
                onClose={() => onItemSelect('', '')}
                onUpdate={() => {}} // Пустая функция как заглушка
              />
            </motion.div>
          ) : selectedCategory ? (
            <motion.div
              key="itemsList"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className={styles.itemsContainer}
            >
              <ItemList
                category={selectedCategory}
                items={inventory[selectedCategory] || {}}
                onSelect={(itemId) => onItemSelect(selectedCategory, itemId)}
                chatId={chatId || ''}
              />
            </motion.div>
          ) : (
            <motion.div
              key="categories"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className={styles.categoriesContainer}
            >
              <div className={styles.categoriesList}>
                {categories.map((category) => (
                  <div
                    key={category}
                    className={styles.categoryItem}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <span className={styles.categoryName}>{category}</span>
                    <span className={styles.categoryCount}>
                      {Object.keys(inventory[category] || {}).length}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Боковое меню */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              className={styles.sideMenu}
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <div className={styles.sideMenuHeader}>
                <h3>Меню</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.sideMenuContent}>
                <div className={styles.sideMenuTitle}>Категории</div>
                {categories.map((category) => (
                  <div
                    key={category}
                    className={styles.sideMenuItem}
                    onClick={() => handleCategorySelect(category)}
                  >
                    {category}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Панель поиска */}
      <AnimatePresence>
        {isSearchOpen && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
            />
            <motion.div
              className={styles.searchPanel}
              variants={searchVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <div className={styles.searchHeader}>
                <SearchBar
                  onSearch={onSearchItems}
                  searchResults={searchResults}
                  searchQuery={searchQuery}
                  onClear={onClearSearch}
                  onResultSelect={handleSearchResultSelect}
                  isLoading={isLoading}
                />
                <button 
                  className={styles.closeButton}
                  onClick={() => setIsSearchOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileLayout; 