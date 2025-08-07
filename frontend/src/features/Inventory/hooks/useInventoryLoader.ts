// --- useInventoryLoader ---
// Хук для загрузки инвентаря (общего или по чату) с прогрессом и обработкой ошибок.
// Используется для инициализации/перезагрузки данных инвентаря в компонентах.

import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/shared/store/hooks'; 
import { 
  fetchInventory, 
  fetchChatInventory, 
} from '@/store/slices/inventorySlice';

interface UseInventoryLoaderProps {
  chatId?: string;           // ID чата, если нужен инвентарь конкретной группы
  currentUserId: number | null; // ID текущего пользователя
  role: string | null;       // Роль пользователя (courier, chef и т.д.)
}

export const useInventoryLoader = ({ chatId, currentUserId, role }: UseInventoryLoaderProps) => {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(true); // Флаг загрузки
  const [error, setError] = useState<string | null>(null); // Ошибка загрузки
  const [loadingProgress, setLoadingProgress] = useState(0); // Прогресс (для UI)
  

  // Основная функция загрузки инвентаря (общий или по чату)
  const loadInventoryData = useCallback(async (forceReload = false) => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
        if (!currentUserId) {
            // Без userId не грузим ничего
            setIsLoading(false);
            return;
        }

        setLoadingProgress(10);
        
        if (chatId) {
            // Если указан chatId — грузим инвентарь конкретного чата
            
            // Для красоты прогресса — имитация загрузки
            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => Math.min(prev + 15, 80)); 
            }, 500); // Увеличиваем интервал с 200ms до 500ms
            
            // Загружаем данные чата
            const resultAction = await dispatch(fetchChatInventory(chatId));
            clearInterval(progressInterval);
            setLoadingProgress(90);

            // Обработка ошибки через match
            if (fetchChatInventory.rejected.match(resultAction)) {
                throw new Error(resultAction.payload || 'Не удалось загрузить данные чата');
            }
            
            setLoadingProgress(100);
        } else {
            // Если chatId нет — грузим общий список чатов пользователя
            if (currentUserId && role) { 
                await dispatch(fetchInventory({ userId: currentUserId, role }));
            }
        }
    } catch (err: any) {
        // Обработка ошибок загрузки
        setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных');
        setLoadingProgress(100);
    } finally {
        // Короткая задержка для плавности UI
        await new Promise(resolve => setTimeout(resolve, 300)); 
        setIsLoading(false);
    }
  }, [dispatch, chatId, currentUserId, role]);

  // Эффект для инициализации и перезагрузки при смене chatId и role
  useEffect(() => {
    // Грузим только если есть userId и (chatId или role)
    if (currentUserId && (chatId || role)) { 
      loadInventoryData(); 
    } else {
        // Если не хватает данных — не грузим, сразу снимаем isLoading
        if (!chatId && !role) {
            setIsLoading(false); 
        }
    }
    
    return () => {
      // Очистка эффекта инициализации.
    };
  }, [loadInventoryData, currentUserId, chatId, role]);
  
  // Периодическое обновление списка чатов (оставлено на будущее, сейчас не используется)
  useEffect(() => {
    if (!currentUserId) return;
    
    const updateInterval = setInterval(() => {
      if (!chatId) { // Обновляем только если не находимся в инвентаре
        if (currentUserId) {
            // Можно раскомментировать для авто-обновления списка чатов
            // dispatch(fetchInventory({ userId: currentUserId, role: role }));
        } else {
            console.warn('[useInventoryLoader] Попытка обновить список чатов без userId');
        }
      }
    }, 30000);
    
    return () => clearInterval(updateInterval);
  }, [dispatch, chatId, currentUserId, role]);
  
  // Возвращаем флаги загрузки, ошибку, прогресс и функцию ручной загрузки
  return {
    isLoading,
    error,
    loadInventoryData,
    loadingProgress,
  };
} 