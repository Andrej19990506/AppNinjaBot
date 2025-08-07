// --- useInventoryNavigation ---
// Хук для управления навигацией по инвентарю: выбор категории, товара, возврат назад.
// Удобен для экранов с вложенной структурой (категории → товары → детали).

import { useState, useCallback, useRef } from 'react';
import { useAppDispatch } from '@/shared/store/hooks';

interface UseInventoryNavigationProps {
  initialCategory?: string | null; // Начальная категория (если нужно)
  initialItem?: string | null;     // Начальный товар (если нужно)
  onNavigate?: (category: string | null, item: string | null) => void; // Колбэк при навигации
}

export function useInventoryNavigation({
  initialCategory = null,
  initialItem = null,
  onNavigate
}: UseInventoryNavigationProps = {}) {
  const dispatch = useAppDispatch();
  // Локальное состояние выбранной категории и товара
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedItem, setSelectedItem] = useState<string | null>(initialItem);
  
  // Используем ref для отслеживания текущей категории без перерендеров
  const currentCategoryRef = useRef<string | null>(initialCategory);

  /**
   * Выбор категории: обновляет выбранную категорию и сбрасывает выбранный товар
   */
  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category);
    setSelectedItem(null);
    
    // Сброс выбранного товара в Redux
    dispatch({ type: 'inventory/setSelectedItem', payload: null });
    
    if (onNavigate) {
      onNavigate(category, null);
    }
  }, [dispatch, onNavigate]);

  /**
   * Выбор товара: обновляет выбранный товар
   */
  const handleItemSelect = useCallback((itemId: string) => {
    setSelectedItem(itemId);
    
    // Устанавливаем выбранный товар в Redux
    dispatch({ type: 'inventory/setSelectedItem', payload: itemId });
    
    if (onNavigate) {
      onNavigate(currentCategoryRef.current, itemId);
    }
  }, [dispatch, onNavigate]);

  /**
   * Навигация назад: от товара к категории, от категории к списку категорий
   */
  const handleBack = useCallback(() => {
    if (selectedItem) {
      setSelectedItem(null);
      dispatch({ type: 'inventory/setSelectedItem', payload: null });
      
      if (onNavigate) {
        onNavigate(selectedCategory, null);
      }
    } else if (selectedCategory) {
      setSelectedCategory(null);
      currentCategoryRef.current = null;
      
      if (onNavigate) {
        onNavigate(null, null);
      }
    }
  }, [selectedItem, selectedCategory, dispatch, onNavigate]);

  /**
   * Программная установка выбранной категории и товара (например, при переходе по ссылке)
   */
  const setNavigation = useCallback((category: string | null, item: string | null) => {
    setSelectedCategory(category);
    currentCategoryRef.current = category;
    setSelectedItem(item);
    
    if (item) {
      dispatch({ type: 'inventory/setSelectedItem', payload: item });
    } else {
      dispatch({ type: 'inventory/setSelectedItem', payload: null });
    }
    
    if (onNavigate) {
      onNavigate(category, item);
    }
  }, [dispatch, onNavigate]);

  // Возвращаем состояние и методы для навигации
  return {
    selectedCategory,
    selectedItem,
    handleCategorySelect,
    handleItemSelect,
    handleBack,
    setNavigation
  };
} 