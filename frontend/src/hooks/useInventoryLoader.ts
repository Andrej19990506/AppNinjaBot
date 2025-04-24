import { useState, useEffect, /* useRef, */ useCallback } from 'react';
// Удаляем неиспользуемый импорт useAppSelector
import { useAppDispatch, /* useAppSelector */ } from '../store/hooks'; 
import { 
  fetchInventory, 
  fetchChatInventory, 
  // Удаляем неиспользуемый импорт updateInventoryData
  // updateInventoryData,
  // Удаляем неиспользуемый импорт updateProgress
  // updateProgress,
} from '../store/slices/inventorySlice';
// Удаляем неиспользуемый импорт useNavigate
// import { useNavigate } from 'react-router-dom'; 
interface UseInventoryLoaderProps {
  chatId?: string;
  currentUserId: number | null;
  role: string | null;
}

export const useInventoryLoader = ({ chatId, currentUserId, role }: UseInventoryLoaderProps) => {
  const dispatch = useAppDispatch();
  // Удаляем неиспользуемую переменную navigate
  // const navigate = useNavigate(); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Удаляем неиспользуемую переменную chats
  // const chats = useAppSelector(state => state.inventory.items);
  const [loadingProgress, setLoadingProgress] = useState(0);
  

  // Удаляем неиспользуемую переменную handleInventoryUpdate
  // const handleInventoryUpdate = useCallback((data: any) => { 
  //   // ... (код обработчика)
  // }, [dispatch]);

  // Основная функция загрузки инвентаря
  const loadInventoryData = useCallback(async (forceReload = false) => {
    console.log('🔄 [loadInventoryData] Запуск загрузки данных:', { chatId, currentUserId, forceReload });
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
        if (!currentUserId) {
            console.warn('⚠️ [loadInventoryData] Отсутствует ID пользователя, загрузка прервана.');
            setIsLoading(false);
            return;
        }

        setLoadingProgress(10);
        
        if (chatId) {
            console.log('📥 [loadInventoryData] Загрузка данных для конкретного чата:', chatId);
            
            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => Math.min(prev + 15, 80)); 
            }, 200);
            
            // Загружаем данные чата
            const resultAction = await dispatch(fetchChatInventory(chatId));
            clearInterval(progressInterval);
            setLoadingProgress(90);

            if (fetchChatInventory.rejected.match(resultAction)) {
                throw new Error(resultAction.payload || 'Не удалось загрузить данные чата'); // Используем payload из rejectWithValue
            }
            
            setLoadingProgress(100);
        } else {
            console.log('[loadInventoryData] chatId не указан. Проверяем userId и role для загрузки списка.');
            if (currentUserId && role) { 
                console.log('🔄 [loadInventoryData] Загрузка общего списка чатов... (userId: ', currentUserId, ', role: ', role, ')');
                await dispatch(fetchInventory({ userId: currentUserId, role }));
                console.log('✅ [loadInventoryData] Общий список чатов загружен.');
            } else {
                 console.warn(`[loadInventoryData] Пропуск fetchInventory: currentUserId=${currentUserId}, role=${role}`);
            }
        }

        console.log('✅ [loadInventoryData] Логика загрузки данных успешно завершена.');
    } catch (err: any) {
        console.error('❌ [loadInventoryData] Ошибка при загрузке данных:', err);
        setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных');
        setLoadingProgress(100);
    } finally {
        await new Promise(resolve => setTimeout(resolve, 300)); 
        setIsLoading(false);
        console.log('🏁 [loadInventoryData] Состояние isLoading установлено в false.');
    }
  }, [dispatch, chatId, currentUserId, role]);

  // Эффект для инициализации и перезагрузки при смене chatId и role
  useEffect(() => {
    console.log(`🔄 [useEffect/init] Запуск эффекта. chatId: ${chatId}, currentUserId: ${currentUserId}, role: ${role}`);
    
    // Check for userId AND (EITHER chatId OR role) before calling loadInventoryData
    if (currentUserId && (chatId || role)) { 
      console.log(`🚀 [useEffect/init] Вызов loadInventoryData (chatId: ${chatId ? chatId : 'отсутствует'}, role: ${role})...`);
      loadInventoryData(); 
    } else {
        // Update the warning log to be more specific
        console.warn(`⚠️ [useEffect/init] Пропуск вызова loadInventoryData: currentUserId=${currentUserId}, chatId=${chatId}, role=${role}. Не хватает либо chatId, либо role.`);
        // If we skip the call, ensure loading is set to false eventually
        // If initial state prevents loading, setting isLoading to false might be needed here.
        // Let's try setting it false if we know we won't load.
        if (!chatId && !role) {
            setIsLoading(false); 
            console.log('🏁 [useEffect/init] Установлен isLoading=false, так как нет chatId и role.')
        }
    }
    
    return () => {
      console.log('🧹 [useEffect/init] Очистка эффекта инициализации.');
    };
  // Dependencies remain the same: loadInventoryData depends on role, effect depends on loadInventoryData
  }, [loadInventoryData, currentUserId, chatId, role]);
  
  // Периодическое обновление списка чатов (ОСТАВЛЯЕМ)
  useEffect(() => {
    if (!currentUserId) return;
    
    const updateInterval = setInterval(() => {
      if (!chatId) { // Обновляем только если не находимся в инвентаре
        if (currentUserId) { // Доп. проверка на userId
            // console.log('[useInventoryLoader] Периодическое обновление списка чатов...');
            // dispatch(fetchInventory({ userId: currentUserId, role: role })); // Пока закомментируем, чтобы не спамить
        } else {
            console.warn('[useInventoryLoader] Попытка обновить список чатов без userId');
        }
      }
    }, 30000);
    
    return () => clearInterval(updateInterval);
  }, [dispatch, chatId, currentUserId, role]);
  
  return {
    isLoading,
    error,
    loadInventoryData,
    loadingProgress,
  };
} 