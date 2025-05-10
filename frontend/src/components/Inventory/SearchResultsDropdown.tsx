import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InventoryItem } from '../../types/inventory';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import styles from './InventorySearch.module.css';

interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: {
    field: string;
    value: string;
  }[];
}

interface SearchResultsDropdownProps {
  isVisible: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchHistory?: string[];
  onSelectResult: (category: string, itemId: string) => void;
  onSelectHistoryItem?: (query: string) => void;
}

// Функция для выделения совпадений в тексте
const highlightMatch = (text: string, query: string) => {
  if (!query || !text) return text;
  
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  
  if (!normalizedText.includes(normalizedQuery)) return text;
  
  const parts = normalizedText.split(normalizedQuery);
  const result = [];
  let lastIndex = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partEndIndex = lastIndex + part.length;
    
    // Добавляем текст до совпадения
    if (part) {
      result.push(text.substring(lastIndex, partEndIndex));
    }
    
    // Добавляем выделенное совпадение, если это не последняя часть
    if (i < parts.length - 1) {
      const matchStartIndex = partEndIndex;
      const matchEndIndex = matchStartIndex + normalizedQuery.length;
      const matchText = text.substring(matchStartIndex, matchEndIndex);
      
      result.push(<span key={`match-${i}`} className={styles.highlight}>{matchText}</span>);
      
      lastIndex = matchEndIndex;
    }
  }
  
  return result;
};

const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({
  isVisible,
  searchQuery,
  searchResults,
  isSearching,
  searchHistory = [],
  onSelectResult,
  onSelectHistoryItem
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Добавляем логирование при изменении состояний
  useEffect(() => {
    console.log('🔍 Состояние SearchResultsDropdown обновлено:');
    console.log(`🔍 isVisible: ${isVisible}, isHovering: ${isHovering}`);
    console.log(`🔍 Текущий поисковый запрос: "${searchQuery}"`);
    console.log(`🔍 Количество результатов: ${searchResults.length}`);
    console.log(`🔍 Идет поиск: ${isSearching}`);
    console.log(`🔍 История поиска: ${searchHistory.length} записей`);
    
    if (searchResults.length > 0) {
      console.log('🔍 Первые результаты поиска:', searchResults.slice(0, 2));
      console.log('🔍 Должны ли отображаться результаты:', isVisible || isHovering);
    }
  }, [isVisible, searchQuery, searchResults, isSearching, searchHistory, isHovering]);
  
  // Отслеживаем, когда компонент должен скрыться
  useEffect(() => {
    if (!isVisible && !isHovering) {
      console.log('🔍 Условие скрытия выпадающего списка выполнено: !isVisible && !isHovering');
    }
  }, [isVisible, isHovering]);
  
  const handleMouseEnter = () => {
    console.log('🔍 Курсор наведен на выпадающий список');
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    console.log('🔍 Курсор покинул выпадающий список');
    setIsHovering(false);
  };

  // Расширенный обработчик клика по результату поиска с более надежным предотвращением всплытия
  const handleResultClick = (e: React.MouseEvent, category: string, itemId: string) => {
    // Полная остановка события
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`🔍 Клик по результату: ${itemId} в категории ${category}`);
    
    // Увеличиваем задержку, чтобы убедиться, что событие завершилось
    setTimeout(() => {
      console.log(`🔍 Вызов onSelectResult для ${itemId} в категории ${category}`);
      onSelectResult(category, itemId);
    }, 100);
  };

  // Расширенный обработчик клика по элементу истории
  const handleHistoryClick = (e: React.MouseEvent, query: string) => {
    // Полная остановка события
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`🔍 Клик по истории поиска: "${query}"`);
    
    // Увеличиваем задержку для лучшего UX
    setTimeout(() => {
      console.log(`🔍 Вызов onSelectHistoryItem для "${query}"`);
      onSelectHistoryItem?.(query);
    }, 100);
  };

  // Если не должны показывать, просто возвращаем null
  if (!isVisible && !isHovering) {
    return null;
  }

  console.log('🔍 Рендеринг выпадающего списка - видимость:', isVisible || isHovering);

  return (
    <AnimatePresence>
      <motion.div 
        ref={dropdownRef}
        className={styles.searchDropdown}
        initial={{ opacity: 0, scaleY: 0, height: 0 }}
        animate={{ 
          opacity: 1, 
          scaleY: 1, 
          height: 'auto',
          zIndex: 9999 // Высокий z-index для перекрытия других элементов
        }}
        exit={{ opacity: 0, scaleY: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        style={{ 
          transformOrigin: 'top',
          position: 'absolute',
          width: '100%',
          top: '100%',
          left: 0,
          zIndex: 9999, // Гарантированно высокий z-index
          maxHeight: '70vh', // Ограничиваем высоту для активации скролла
          overflowY: 'auto' // Добавляем скролл для высоких списков
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {searchQuery && (
          <div className={styles.searchDropdownHeader}>
            <h3 className={styles.searchResultsTitle}>
              {isSearching ? 'Поиск...' : 'Результаты поиска'}
            </h3>
            {!isSearching && searchResults.length > 0 && (
              <span className={styles.searchResultsCount}>
                {searchResults.length}
              </span>
            )}
          </div>
        )}

        <div className={styles.searchDropdownContent}>
          {searchQuery && (
            <>
              {isSearching ? (
                <div className={styles.noResultsMessage}>
                  <motion.div
                    animate={{ 
                      rotate: 360,
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    <SearchIcon className={styles.noResultsIcon} />
                  </motion.div>
                  <p className={styles.noResultsText}>Выполняется поиск...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className={styles.searchResultsList}>
                  {searchResults.map((result, index) => {
                    console.log(`🔍 Рендеринг результата ${index}: ${result.itemId} (${result.category})`);
                    return (
                      <motion.div
                        key={`${result.category}-${result.itemId}-${index}`}
                        className={styles.searchResultItem}
                        onClick={(e) => handleResultClick(e, result.category, result.itemId)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 30,
                          delay: index * 0.05 // Каскадная анимация
                        }}
                      >
                        <div className={styles.resultItemInfo}>
                          <h4 className={styles.resultItemTitle}>
                            {highlightMatch(result.itemId, searchQuery)}
                          </h4>
                          <span className={styles.resultItemCategory}>
                            {result.category}
                          </span>
                        </div>
                        <div className={styles.resultItemStatus}>
                          {result.item.raw.filled && (
                            <span className={styles.filledStatus}>Заполнен</span>
                          )}
                          {result.item.raw.isOutOfStock && (
                            <span className={styles.outOfStockStatus}>Нет в наличии</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noResultsMessage}>
                  <SearchOffIcon className={styles.noResultsIcon} />
                  <p className={styles.noResultsText}>Ничего не найдено</p>
                </div>
              )}
            </>
          )}

          {/* История поиска отображается всегда при фокусе на инпуте */}
          {searchHistory.length > 0 && (
            <div className={styles.searchHistorySection}>
              <h3 className={styles.searchHistoryTitle}>
                <HistoryIcon style={{ fontSize: '16px' }} />
                История поиска
              </h3>
              <div className={styles.searchHistoryList}>
                {searchHistory.map((query, index) => (
                  <motion.div
                    key={`history-${index}`}
                    className={styles.searchHistoryItem}
                    onClick={(e) => handleHistoryClick(e, query)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30, delay: index * 0.05 }}
                  >
                    <HistoryIcon style={{ fontSize: '14px' }} />
                    <span className={styles.searchHistoryItemText}>{query}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {!searchQuery && searchHistory.length === 0 && (
            <div className={styles.noResultsMessage}>
              <SearchIcon className={styles.noResultsIcon} />
              <p className={styles.noResultsText}>Начните вводить текст для поиска товаров</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchResultsDropdown; 