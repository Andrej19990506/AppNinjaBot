import { useMemo, useState, useEffect, useRef } from 'react';
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
  // Состояние для отслеживания, был ли инвентарь когда-либо не пустым
  const [wasInventoryLoaded, setWasInventoryLoaded] = useState(false);
  
  // Ref для хранения предыдущего состояния загрузки
  const prevLoadingRef = useRef(isLoading);
  
  // Ref для хранения таймера
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref для отслеживания попыток автоматической установки wasInventoryLoaded
  const autoSetAttemptsRef = useRef(0);
  const maxAutoSetAttempts = 3;
  
  // Проверяем, есть ли в инвентаре категории
  const hasCategories = useMemo(() => {
    return !!inventory && Object.keys(inventory).length > 0;
  }, [inventory]);
  
  // Если инвентарь был загружен хотя бы раз, запоминаем это
  useEffect(() => {
    if (hasCategories && !wasInventoryLoaded) {
      console.log('🎯 Инвентарь содержит категории, устанавливаем wasInventoryLoaded = true');
      setWasInventoryLoaded(true);
    }
  }, [hasCategories, wasInventoryLoaded]);
  
  // Эффект для обработки изменения состояния загрузки
  useEffect(() => {
    // Если загрузка завершилась
    if (prevLoadingRef.current && !isLoading) {
      console.log('🔍 Загрузка инвентаря завершена:', {
        hasCategories,
        wasInventoryLoaded,
        categories: Object.keys(inventory || {})
      });
      
      // Если после загрузки инвентарь все еще пуст, даем немного времени на применение шаблона
      if (!hasCategories) {
        console.log('⏱️ Ожидаем применения шаблона инвентаря...');
        
        // Очищаем предыдущий таймер, если он был
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        
        // Увеличиваем счетчик попыток
        autoSetAttemptsRef.current++;
        
        // Устанавливаем таймер на 2 секунды
        timerRef.current = setTimeout(() => {
          console.log(`⏱️ Таймер истек (попытка ${autoSetAttemptsRef.current}/${maxAutoSetAttempts}), считаем инвентарь загруженным`);
          setWasInventoryLoaded(true);
        }, 2000);
      }
    }
    
    // Обновляем ref с текущим состоянием загрузки
    prevLoadingRef.current = isLoading;
    
    // Очищаем таймер при размонтировании
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isLoading, hasCategories, inventory]);
  
  // Добавляем эффект для принудительной установки wasInventoryLoaded
  // после нескольких проверок, если инвентарь все еще пуст
  useEffect(() => {
    // Если инвентарь все еще не загружен, но мы уже пытались несколько раз
    if (!wasInventoryLoaded && autoSetAttemptsRef.current >= maxAutoSetAttempts) {
      console.log('⚠️ Превышено максимальное количество попыток, принудительно устанавливаем wasInventoryLoaded = true');
      setWasInventoryLoaded(true);
    }
  }, [wasInventoryLoaded]);
  
  // Мемоизированное представление для текущего состояния навигации
  const currentView = useMemo(() => {
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
  const categories = useMemo(() => {
    if (!inventory) return [];
    return Object.keys(inventory);
  }, [inventory]);
  
  // Получаем товары для выбранной категории
  const categoryItems = useMemo(() => {
    if (!selectedCategory || !inventory || !inventory[selectedCategory]) {
      return {};
    }
    return inventory[selectedCategory];
  }, [selectedCategory, inventory]);
  
  // Получаем выбранный товар
  const currentItem = useMemo(() => {
    if (!selectedCategory || !selectedItem || !inventory) {
      return null;
    }
    
    const categoryData = inventory[selectedCategory];
    if (!categoryData) return null;
    
    return categoryData[selectedItem] || null;
  }, [selectedCategory, selectedItem, inventory]);
  
  // Определяем, считать ли инвентарь валидным для отображения
  // Инвентарь считается валидным, если:
  // 1. Он не пустой (есть категории)
  // 2. ИЛИ он был когда-то загружен (wasInventoryLoaded)
  // 3. И при этом не находится в процессе загрузки (isLoading)
  const hasValidInventory = useMemo(() => {
    // Если инвентарь загружается, считаем его невалидным
    if (isLoading) {
      return false;
    }
    
    // Если у инвентаря есть категории, считаем его валидным
    if (hasCategories) {
      return true;
    }
    
    // Если инвентарь был когда-то загружен, считаем его валидным
    if (wasInventoryLoaded) {
      return true;
    }
    
    // В остальных случаях считаем инвентарь невалидным
    const isValid = false;
    
    console.log('🔍 Проверка валидности инвентаря:', {
      isLoading,
      hasCategories,
      wasInventoryLoaded,
      isValid,
      autoSetAttempts: autoSetAttemptsRef.current
    });
    
    return isValid;
  }, [isLoading, hasCategories, wasInventoryLoaded]);
  
  return {
    currentView,
    categories,
    categoryItems,
    currentItem,
    hasValidInventory,
    wasInventoryLoaded
  };
} 