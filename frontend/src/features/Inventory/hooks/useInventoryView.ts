// --- useInventoryView ---
// Хук для оптимизации рендеринга и навигации по инвентарю.
// Позволяет удобно управлять отображением: список категорий → список товаров → детали товара.
// Использует мемоизацию, чтобы не было лишних перерисовок при навигации.

import { useCallback } from 'react';
import { InventoryItem } from '@/types/inventoryTypes';

interface UseInventoryViewProps {
  selectedCategory: string | null; // Текущая выбранная категория
  selectedItem: string | null;     // Текущий выбранный товар
  inventory: {
    [category: string]: {
      [itemId: string]: InventoryItem;
    };
  };
  renderCategories: () => JSX.Element; // Рендер списка категорий
  renderItems: (category: string) => JSX.Element; // Рендер списка товаров в категории
  renderItemDetail: (category: string, itemId: string) => JSX.Element; // Рендер деталей товара
  searchActive: boolean; // Флаг: активен ли поиск
  isLoading?: boolean;   // Флаг: идёт ли загрузка
}

/**
 * Главный хук для навигации и отображения инвентаря.
 * Возвращает мемоизированные функции для рендера и получения данных.
 */
export function useInventoryView({
  selectedCategory,
  selectedItem,
  inventory,
  renderCategories,
  renderItems,
  renderItemDetail,
  searchActive,
  isLoading = false
}: UseInventoryViewProps) {
  // Проверяем, есть ли вообще категории в инвентаре
  const hasCategories = useCallback(() => {
    return !!inventory && Object.keys(inventory).length > 0;
  }, [inventory]);
  
  // Мемоизированная функция: что сейчас показывать (категории, товары или детали)
  const currentView = useCallback(() => {
    // Если не выбрана категория — показываем список категорий
    if (!selectedCategory) {
      return renderCategories();
    }
    // Если выбрана категория, но не выбран товар — показываем список товаров
    if (!selectedItem) {
      return renderItems(selectedCategory);
    }
    // Если выбраны и категория, и товар — показываем детали товара
    return renderItemDetail(selectedCategory, selectedItem);
  }, [
    selectedCategory, 
    selectedItem, 
    renderCategories, 
    renderItems, 
    renderItemDetail
  ]);
  
  // Получить список всех категорий (для меню/навигации)
  const categories = useCallback(() => {
    if (!inventory) return [];
    return Object.keys(inventory);
  }, [inventory]);
  
  // Получить все товары в выбранной категории
  const categoryItems = useCallback(() => {
    if (!selectedCategory || !inventory || !inventory[selectedCategory]) {
      return {};
    }
    return inventory[selectedCategory];
  }, [selectedCategory, inventory]);
  
  // Получить объект выбранного товара (для деталей)
  const currentItem = useCallback(() => {
    if (!selectedCategory || !selectedItem || !inventory) {
      return null;
    }
    const categoryData = inventory[selectedCategory];
    if (!categoryData) return null;
    return categoryData[selectedItem] || null;
  }, [selectedCategory, selectedItem, inventory]);
  
  // Проверить, можно ли вообще что-то показывать (есть ли данные и не идёт ли загрузка)
  const hasValidInventory = useCallback(() => {
    // Если идёт загрузка — не валидно
    if (isLoading) {
      return false;
    }
    // Если не грузится — валидно, если есть хотя бы одна категория
    const isValid = hasCategories();
    console.log('🔍 Проверка валидности инвентаря (упрощенная):', {
      isLoading,
      hasCategories: hasCategories(),
      isValid,
    });
    return isValid;
  }, [isLoading, hasCategories]);
  
  // Возвращаем все мемоизированные функции и данные для использования в компоненте
  return {
    currentView,      // Что сейчас рендерить (категории, товары, детали)
    categories,       // Список всех категорий
    categoryItems,    // Все товары в выбранной категории
    currentItem,      // Объект выбранного товара
    hasValidInventory // Валиден ли инвентарь для показа
  };
} 