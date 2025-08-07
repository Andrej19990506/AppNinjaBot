// --- useInventorySearch ---
// Хук для поиска по инвентарю с поддержкой истории, фокуса и выбора результата.
// Удобен для глобального поиска товаров по всем категориям.

import { useState, useCallback, useEffect } from 'react';
import { InventoryItem } from '../../../types/inventoryTypes';
import { normalizeString } from '../InventorySearch';

interface SearchResult {
  category: string; // Категория, где найден товар
  itemId: string;   // ID товара
  item: InventoryItem; // Сам товар
  matches: {
    field: string;  // В каком поле найдено совпадение
    value: string;  // Значение совпадения
  }[];
}

interface UseInventorySearchProps {
  inventory: {
    [category: string]: {
      [itemId: string]: InventoryItem;
    };
  } | undefined;
  onSelectResult?: (category: string, itemId: string) => void; // Колбэк при выборе результата
}

export function useInventorySearch({ inventory, onSelectResult }: UseInventorySearchProps) {
  // Состояния поиска
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Состояние истории поиска (загружаем из localStorage)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const savedHistory = localStorage.getItem('inventorySearchHistory');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
      console.error('Ошибка загрузки истории поиска:', e);
      return [];
    }
  });

  // Сохраняем историю поиска в localStorage при её изменении
  useEffect(() => {
    try {
      localStorage.setItem('inventorySearchHistory', JSON.stringify(searchHistory));
    } catch (e) {
      console.error('Ошибка сохранения истории поиска:', e);
    }
  }, [searchHistory]);

  // Главная функция поиска по инвентарю
  const handleSearch = useCallback((query: string) => {
    if (!inventory || query.length < 2) {
      setSearchResults([]);
      setSearchQuery('');
      return;
    }
    
    setIsSearching(true);
    setSearchQuery(query);
    
    // Небольшая задержка для UX (имитация поиска)
    setTimeout(() => {
      const normalizedQuery = normalizeString(query);
      const results: SearchResult[] = [];
      
      // Поиск по всем категориям и товарам
      Object.entries(inventory).forEach(([category, items]) => {
        Object.entries(items).forEach(([itemId, item]) => {
          const matches: { field: string; value: string }[] = [];
          
          // Поиск в названии товара
          if (normalizeString(itemId).includes(normalizedQuery)) {
            matches.push({ field: 'name', value: itemId });
          }
          
          // Поиск в описании товара, если оно есть
          if (item.raw && 'description' in item.raw && item.raw.description) {
            const description = item.raw.description as string;
            if (normalizeString(description).includes(normalizedQuery)) {
              matches.push({ field: 'description', value: description });
            }
          }
          
          // Если есть совпадения, добавляем в результаты
          if (matches.length > 0) {
            results.push({
              category,
              itemId,
              item,
              matches
            });
          }
        });
      });
      
      setSearchResults(results);
      setIsSearching(false);
      
      // Добавляем запрос в историю поиска, если его там еще нет и есть результаты
      if (results.length > 0 && !searchHistory.includes(query)) {
        setSearchHistory(prev => [query, ...prev].slice(0, 5)); // Ограничиваем историю 5 элементами
      }
    }, 300);
  }, [inventory, searchHistory]);
  
  // Очистка поиска (сброс запроса и результатов)
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);
  
  // Обработка фокуса поиска (для UI)
  const handleSearchFocusChange = useCallback((isFocused: boolean) => {
    setIsSearchFocused(isFocused);
  }, []);
  
  // Выбор результата поиска (переход к товару)
  const handleSearchResultSelect = useCallback((category: string, itemId: string) => {
    if (onSelectResult) {
      onSelectResult(category, itemId);
    }
    
    setIsSearchFocused(false); // Скрываем выпадающий список после выбора
    handleClearSearch();
  }, [onSelectResult, handleClearSearch]);
  
  // Выбор элемента из истории поиска
  const handleHistoryItemSelect = useCallback((query: string) => {
    handleSearch(query);
  }, [handleSearch]);

  // Возвращаем состояния и методы для поиска
  return {
    searchQuery,
    isSearching,
    searchResults,
    isSearchFocused,
    searchHistory,
    handleSearch,
    handleClearSearch,
    handleSearchFocusChange,
    handleSearchResultSelect,
    handleHistoryItemSelect,
    setSearchQuery
  };
} 