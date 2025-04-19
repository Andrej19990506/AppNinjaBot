import { useCallback } from 'react';
import { InventoryItem } from '../types/inventory';

interface UseInventoryViewProps {
  selectedCategory: string | null;
  selectedItem: string | null;
  inventory: {
    [category: string]: {
      [itemId: string]: InventoryItem;
    };
  };
  renderCategories: () => JSX.Element;
  renderItems: (category: string) => JSX.Element;
  renderItemDetail: (category: string, itemId: string) => JSX.Element;
  searchActive: boolean;
  renderSearch?: () => JSX.Element;
  isLoading?: boolean;
}

/**
 * Хук для оптимизации рендеринга компонентов инвентаря
 * Использует мемоизацию для предотвращения лишних перерисовок
 */
export function useInventoryView({
  selectedCategory,
  selectedItem,
  inventory,
  renderCategories,
  renderItems,
  renderItemDetail,
  searchActive,
  renderSearch,
  isLoading = false
}: UseInventoryViewProps) {
  // Проверяем, есть ли в инвентаре категории
  const hasCategories = useCallback(() => {
    return !!inventory && Object.keys(inventory).length > 0;
  }, [inventory]);
  
  // Мемоизированное представление для текущего состояния навигации
  const currentView = useCallback(() => {
    // Если поиск активен и есть компонент поиска, отображаем его
    if (searchActive && renderSearch) {
      return renderSearch();
    }
    
    // Определяем, какой компонент отображать на основе выбранной категории и товара
    if (!selectedCategory) {
      return renderCategories();
    }
    
    if (!selectedItem) {
      return renderItems(selectedCategory);
    }
    
    return renderItemDetail(selectedCategory, selectedItem);
  }, [
    selectedCategory, 
    selectedItem, 
    renderCategories, 
    renderItems, 
    renderItemDetail,
    searchActive,
    renderSearch
  ]);
  
  // Получаем список категорий из инвентаря
  const categories = useCallback(() => {
    if (!inventory) return [];
    return Object.keys(inventory);
  }, [inventory]);
  
  // Получаем товары для выбранной категории
  const categoryItems = useCallback(() => {
    if (!selectedCategory || !inventory || !inventory[selectedCategory]) {
      return {};
    }
    return inventory[selectedCategory];
  }, [selectedCategory, inventory]);
  
  // Получаем выбранный товар
  const currentItem = useCallback(() => {
    if (!selectedCategory || !selectedItem || !inventory) {
      return null;
    }
    
    const categoryData = inventory[selectedCategory];
    if (!categoryData) return null;
    
    return categoryData[selectedItem] || null;
  }, [selectedCategory, selectedItem, inventory]);
  
  // Определяем, считать ли инвентарь валидным для отображения
  // Упрощенная логика: валидно, если не грузится и есть категории
  const hasValidInventory = useCallback(() => {
    // Если инвентарь загружается, считаем его невалидным
    if (isLoading) {
      return false;
    }
    
    // Если не загружается, валидность определяется наличием категорий
    const isValid = hasCategories(); // hasCategories вычисляется выше
    
    console.log('🔍 Проверка валидности инвентаря (упрощенная):', {
      isLoading,
      hasCategories: hasCategories(),
      // wasInventoryLoaded, // Убрали эту зависимость
      isValid,
      // autoSetAttempts: autoSetAttemptsRef.current // Убрали счетчик попыток
    });
    
    return isValid;
  // Зависим только от isLoading и hasCategories
  }, [isLoading, hasCategories]);
  
  return {
    currentView,
    categories,
    categoryItems,
    currentItem,
    hasValidInventory,
    // wasInventoryLoaded // Больше не возвращаем
  };
} 