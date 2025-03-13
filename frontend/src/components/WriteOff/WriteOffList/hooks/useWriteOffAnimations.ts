import { useState, useRef, useEffect } from 'react';
import { WriteOffItem } from '../../../../types/writeOff';

/**
 * Кастомный хук для управления анимациями элементов списка
 * @param items Массив элементов списания
 */
export const useWriteOffAnimations = (items: WriteOffItem[]) => {
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const animationTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Вспомогательный метод для пометки элемента как удаленного
  const markItemAsRemoved = (id: string) => {
    setRemovedItems(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
    
    // Убираем из списка анимируемых элементов
    setRemovingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    // Очищаем таймер
    if (animationTimers.current[id]) {
      clearTimeout(animationTimers.current[id]);
      delete animationTimers.current[id];
    }
  };

  // Запуск анимации удаления элемента
  const startRemoveAnimation = (id: string) => {
    console.log(`🔄 Запуск анимации удаления для элемента: ${id}`);
    setRemovingItems(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
    
    // Устанавливаем таймер для автоматического удаления элемента из DOM
    if (animationTimers.current[id]) {
      clearTimeout(animationTimers.current[id]);
    }
    
    animationTimers.current[id] = setTimeout(() => {
      markItemAsRemoved(id);
    }, 500); // Время анимации исчезновения
  };

  // Пометка элемента как постоянно удаленного
  const markItemAsPermanentlyRemoved = (id: string) => {
    console.log(`✅ Элемент окончательно удален: ${id}`);
    markItemAsRemoved(id);
  };

  // Отмена анимации удаления
  const cancelRemoveAnimation = (id: string) => {
    console.log(`❌ Отмена анимации удаления для элемента: ${id}`);
    // Очищаем таймер для этого элемента
    if (animationTimers.current[id]) {
      clearTimeout(animationTimers.current[id]);
      delete animationTimers.current[id];
    }
    
    // Удаляем элемент из списка удаляемых
    setRemovingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    // Удаляем элемент из списка удаленных (если он там есть)
    setRemovedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  // Очистка всех анимаций
  const clearAllRemovingItems = () => {
    console.log('🧹 Очистка всех анимаций удаления');
    // Очищаем все таймеры
    Object.values(animationTimers.current).forEach(timer => clearTimeout(timer));
    animationTimers.current = {};
    
    // Сбрасываем все состояния удаления
    setRemovingItems(new Set());
    setRemovedItems(new Set());
  };

  // Обновление состояния при изменении props.items
  useEffect(() => {
    // Если нет элементов, очищаем состояния удаления
    if (items.length === 0) {
      console.log('📋 WriteOffList: список пуст, очищаем состояния удаления');
      setRemovingItems(new Set());
      setRemovedItems(new Set());
      // Очищаем все таймеры
      Object.values(animationTimers.current).forEach(timer => clearTimeout(timer));
      animationTimers.current = {};
    } else {
      // Проверяем, есть ли элементы в removingItems или removedItems, которых нет в новом items
      const currentItemIds = new Set(items.map(item => item.id));
      
      // Обновляем removedItems, удаляя элементы, которых больше нет в списке
      setRemovedItems(prev => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach(id => {
          if (!currentItemIds.has(id)) {
            newSet.delete(id);
          }
        });
        return newSet;
      });
      
      // Аналогично обновляем removingItems
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach(id => {
          if (!currentItemIds.has(id)) {
            newSet.delete(id);
          }
        });
        return newSet;
      });
    }
  }, [items]);

  // Очищаем таймеры при размонтировании компонента
  useEffect(() => {
    return () => {
      // Очищаем все таймеры анимаций при размонтировании
      Object.values(animationTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return {
    removingItems,
    removedItems,
    startRemoveAnimation,
    markItemAsPermanentlyRemoved,
    cancelRemoveAnimation,
    clearAllRemovingItems
  };
}; 