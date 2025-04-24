import { useState, useCallback, useEffect } from 'react';
import { InventoryItem } from '../types/inventoryTypes';
import { normalizeString } from '../components/Inventory/InventorySearch';

interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: {
    field: string;
    value: string;
  }[];
}

interface UseInventorySearchProps {
  inventory: {
    [category: string]: {
      [itemId: string]: InventoryItem;
    };
  } | undefined;
  onSelectResult?: (category: string, itemId: string) => void;
}

export function useInventorySearch({ inventory, onSelectResult }: UseInventorySearchProps) {
  // Состояния поиска
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Состояние истории поиска
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    // Загружаем историю поиска из localStorage при инициализации
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

  // Функция для глобального поиска по инвентарю
  const handleSearch = useCallback((query: string) => {
    if (!inventory || query.length < 2) {
      setSearchResults([]);
      setSearchQuery('');
      return;
    }
    
    setIsSearching(true);
    setSearchQuery(query);
    
    console.log('🔍 Начинаем поиск по запросу:', query);
    
    // Небольшая задержка для улучшения UX
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
            console.log(`✅ Найдено совпадение в названии: "${itemId}" в категории "${category}"`);
          }
          
          // Поиск в описании товара, если оно есть
          if (item.raw && 'description' in item.raw && item.raw.description) {
            const description = item.raw.description as string;
            if (normalizeString(description).includes(normalizedQuery)) {
              matches.push({ field: 'description', value: description });
              console.log(`✅ Найдено совпадение в описании товара "${itemId}"`);
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
      
      console.log(`🔎 Результаты поиска: найдено ${results.length} совпадений`);
      if (results.length > 0) {
        console.log('📋 Первый результат:', {
          category: results[0].category,
          itemId: results[0].itemId,
          matches: results[0].matches
        });
      }
      
      setSearchResults(results);
      setIsSearching(false);
      
      // Добавляем запрос в историю поиска, если его там еще нет и есть результаты
      if (results.length > 0 && !searchHistory.includes(query)) {
        setSearchHistory(prev => [query, ...prev].slice(0, 5)); // Ограничиваем историю 5 элементами
        console.log('📝 Запрос добавлен в историю поиска');
      }
    }, 300);
  }, [inventory, searchHistory]);
  
  // Очистка поиска
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);
  
  // Функция для обработки изменения состояния фокуса поиска
  const handleSearchFocusChange = useCallback((isFocused: boolean) => {
    console.log(`🔍 Изменение состояния фокуса поиска: ${isFocused ? 'в фокусе' : 'не в фокусе'}`);
    setIsSearchFocused(isFocused);
    
    // Комментарий: логика ниже может понадобиться позже, но сейчас не влияет
    if (!isFocused && searchQuery) { 
      console.log('🔍 Фокус снят, но запрос остался, результаты для дропдауна должны сохраниться');
    }
  }, [searchQuery]);
  
  // Функция для перехода к товару из результатов поиска
  const handleSearchResultSelect = useCallback((category: string, itemId: string) => {
    console.log(`🔍 Выбран результат поиска: ${itemId} в категории ${category}`);
    
    if (onSelectResult) {
      onSelectResult(category, itemId);
    }
    
    setIsSearchFocused(false); // Скрываем выпадающий список после выбора
    handleClearSearch();
  }, [onSelectResult, handleClearSearch]);
  
  // Функция для работы с историей поиска
  const handleHistoryItemSelect = useCallback((query: string) => {
    handleSearch(query);
  }, [handleSearch]);

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