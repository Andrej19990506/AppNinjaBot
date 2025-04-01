import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { InventoryItem } from '../../types/inventory';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import styles from './InventorySearch.module.css';
import AnimatePresenceWrapper from '../common/AnimatePresenceWrapper';

interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: {
    field: string;
    value: string;
  }[];
}

export interface InventorySearchProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  onClearSearch: () => void;
  onFocusChange?: (isFocused: boolean) => void;
}

// Функция для нормализации строк поиска (удаление диакритики, перевод в нижний регистр)
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const InventorySearch: React.FC<InventorySearchProps> = ({
  onSearch,
  isSearching,
  searchResults,
  onClearSearch,
  onFocusChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Обрабатываем клики вне компонента для скрытия выпадающего списка
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Проверяем, был ли клик вне контейнера поиска и выпадающего списка
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        !document.querySelector(`.${styles.searchDropdown}`)?.contains(event.target as Node)
      ) {
        console.log('🔍 Клик вне компонента поиска - снимаем фокус');
        setIsFocused(false);
        if (onFocusChange) {
          onFocusChange(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onFocusChange]);

  // Обрабатываем изменения в поле поиска
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length >= 2) {
      onSearch(query);
    } else if (query.length === 0) {
      onClearSearch();
    }
  };

  // Обрабатываем клавиатурные сокращения
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Если нажата клавиша Esc, сбрасываем поиск
    if (e.key === 'Escape') {
      clearSearch();
    }
    
    // Ctrl+F для фокуса на поиске
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  };

  // Функция для очистки поиска
  const clearSearch = () => {
    setSearchQuery('');
    onClearSearch();
    // НЕ снимаем фокус при очистке, чтобы пользователь мог сразу ввести новый запрос
  };

  // Обработчики фокуса и блюра
  const handleFocus = () => {
    console.log('🔍 Фокус на поле поиска');
    setIsFocused(true);
    if (onFocusChange) {
      onFocusChange(true);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Не снимаем фокус сразу, это будет обрабатываться через клик вне компонента
    console.log('🔍 Блюр поля поиска, но не снимаем фокус сразу');
  };

  // Устанавливаем обработчик глобальных горячих клавиш
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F для фокуса на поиске
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown as any);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown as any);
    };
  }, []);

  console.log('🔍 Рендеринг InventorySearch, isFocused:', isFocused, 'searchQuery:', searchQuery);

  return (
    <div className={styles.searchWrapper} ref={containerRef}>
      <motion.div 
        className={styles.searchContainer}
        initial={{ opacity: 0, y: -10 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          scale: isFocused ? 1.01 : 1,
          zIndex: isFocused ? 9998 : 100 // Высокий z-index при фокусе
        }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'relative',
          zIndex: isFocused ? 9998 : 100
        }}
      >
        <motion.div
          animate={{ 
            rotate: isSearching ? [0, 180, 360] : 0,
            scale: isFocused ? 1.1 : 1
          }}
          transition={{ 
            duration: isSearching ? 1.5 : 0.3,
            repeat: isSearching ? Infinity : 0
          }}
        >
          <SearchIcon className={styles.searchIcon} />
        </motion.div>
        
        <input
          ref={searchInputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Поиск товаров по всем категориям..."
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        
        <AnimatePresenceWrapper>
          {searchQuery && (
            <motion.button 
              className={styles.clearSearchButton}
              onClick={clearSearch}
              aria-label="Очистить поиск"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              whileHover={{ rotate: 90 }}
            >
              <CloseIcon className={styles.clearSearchIcon} />
            </motion.button>
          )}
        </AnimatePresenceWrapper>
        
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CircularProgress size={20} className={styles.searchSpinner} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default InventorySearch; 