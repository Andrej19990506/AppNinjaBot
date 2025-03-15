import { useState, useCallback } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setSelectedItem as setReduxSelectedItem } from '../store/slices/inventorySlice';

interface UseInventoryNavigationProps {
  initialCategory?: string | null;
  initialItem?: string | null;
  onNavigate?: (category: string | null, item: string | null) => void;
}

export function useInventoryNavigation({
  initialCategory = null,
  initialItem = null,
  onNavigate
}: UseInventoryNavigationProps = {}) {
  const dispatch = useAppDispatch();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedItem, setSelectedItem] = useState<string | null>(initialItem);

  /**
   * Обновляет выбранную категорию и сбрасывает выбранный товар
   */
  const handleCategorySelect = useCallback((category: string) => {
    console.log('Category selected:', category);
    setSelectedCategory(category);
    setSelectedItem(null);
    
    // Передаём null напрямую через действие 'inventory/setSelectedItem'
    dispatch({ type: 'inventory/setSelectedItem', payload: null });
    
    if (onNavigate) {
      onNavigate(category, null);
    }
  }, [dispatch, onNavigate]);

  /**
   * Обновляет выбранный товар
   */
  const handleItemSelect = useCallback((itemId: string) => {
    console.log('Item selected:', itemId);
    setSelectedItem(itemId);
    
    // Поскольку у нас нет доступа к объекту InventoryItem, используем действие напрямую
    dispatch({ type: 'inventory/setSelectedItem', payload: itemId });
    
    if (onNavigate) {
      onNavigate(selectedCategory, itemId);
    }
  }, [dispatch, selectedCategory, onNavigate]);

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
      
      if (onNavigate) {
        onNavigate(null, null);
      }
    }
  }, [selectedItem, selectedCategory, dispatch, onNavigate]);

  /**
   * Установка выбранной категории и товара из внешнего источника
   */
  const setNavigation = useCallback((category: string | null, item: string | null) => {
    setSelectedCategory(category);
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

  return {
    selectedCategory,
    selectedItem,
    handleCategorySelect,
    handleItemSelect,
    handleBack,
    setNavigation
  };
} 