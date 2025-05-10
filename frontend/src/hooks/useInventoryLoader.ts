import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchInventory, 
  fetchChatInventory, 
  updateInventoryData,
  updateProgress 
} from '../store/slices/inventorySlice';
import { useNavigate } from 'react-router-dom';
import { Inventory, ChatResponse, Admin } from '../types/inventory';
import { useWebSocket } from './useWebSocket';

interface ChatData {
    inventory: any;
    metadata: {
        lastUpdated: string;
        progress: number;
    };
    admins: Array<{
        user_id: number;
        first_name: string;
        status: string;
    }>;
}

interface UseInventoryLoaderProps {
  chatId?: string;
  currentUserId: number | null;
  isAdmin: boolean;
}

interface InventoryState {
    selectedChat?: {
        inventory: any;
        chat_id: string;
    };
}

export const useInventoryLoader = ({ chatId, currentUserId, isAdmin }: UseInventoryLoaderProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialized = useRef<boolean>(false);
  const templateApplied = useRef<boolean>(false);
  const retryCount = useRef<number>(0);
  const maxRetries = 3;
  const chats = useAppSelector(state => state.inventory.items);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Инициализируем WebSocket хук
  const { socket } = useWebSocket(chatId);

  // Обработчик обновлений инвентаря через WebSocket
  const handleInventoryUpdate = useCallback((data: any) => {
    const updateData = data.data || data;
    const chatId = updateData.metadata?.chat_id || updateData.chatId;
    
    if (!chatId) {
        console.warn('⚠️ Отсутствует chatId в данных обновления:', updateData);
        return;
    }

    console.log('📦 Получено обновление инвентаря:', {
        chatId,
        hasInventory: !!updateData.inventory,
        type: updateData.type || 'full',
        timestamp: new Date().toISOString()
    });

    // Формируем данные для обновления Redux
    const payload = {
        chatId,
        data: {
            type: updateData.type || 'full',
            inventory: updateData.inventory,
            metadata: updateData.metadata,
            category: updateData.category,
            itemId: updateData.itemId,
            item: updateData.item
        }
    };

    console.log('📤 Отправка обновления в Redux:', payload);

    // Отправляем обновление в Redux
    dispatch(updateInventoryData(payload));
    console.log('✅ Данные отправлены в Redux для обновления');

    // Обновляем прогресс после обновления инвентаря
    dispatch(updateProgress());
  }, [dispatch]);

  // Подписываемся на обновления через WebSocket
  useEffect(() => {
    if (socket) {
      socket.on('inventory_update', handleInventoryUpdate);
      
      return () => {
        socket.off('inventory_update', handleInventoryUpdate);
      };
    }
  }, [socket, handleInventoryUpdate]);

  // Функция для загрузки шаблона инвентаря из JSON-файла
  const loadInventoryTemplate = useCallback(async () => {
    console.log('🔄 Загрузка шаблона инвентаря...');
    console.log('📊 Параметры:', { chatId, currentUserId, isAdmin });
    
    try {
      setIsLoading(true);
      console.log('⏳ Начало загрузки шаблона...');
      const result = await dispatch(fetchInventory()).unwrap();
      console.log('✅ Шаблон успешно загружен:', result);
      return result;
    } catch (error) {
      console.error('❌ Ошибка при загрузке шаблона:', error);
      setError('Не удалось загрузить шаблон инвентаря');
      throw error;
    } finally {
      setIsLoading(false);
      console.log('⏳ Загрузка шаблона завершена');
    }
  }, [dispatch]);
  
  // Функция для проверки и применения шаблона инвентаря, если инвентарь пуст
  const checkAndApplyTemplate = useCallback(async (currentState: InventoryState) => {
    console.log('🔍 Проверка и применение шаблона...');
    const inventory = currentState.selectedChat?.inventory;
    const inventoryKeys = inventory ? Object.keys(inventory) : [];
    
    console.log('📊 Текущее состояние инвентаря:', {
      chatId,
      isEmpty: !inventory || inventoryKeys.length === 0,
      inventoryKeys,
      inventoryType: typeof inventory,
      retryCount: retryCount.current
    });

    if (!inventory || inventoryKeys.length === 0) {
      console.log('📋 Инвентарь пуст, загружаем шаблон...');
      try {
        await loadInventoryTemplate();
        console.log('✅ Шаблон успешно применен');
      } catch (error) {
        console.error('❌ Ошибка при применении шаблона:', error);
        if (retryCount.current < 3) {
          console.log('🔄 Повторная попытка загрузки шаблона...');
          retryCount.current += 1;
          setTimeout(() => checkAndApplyTemplate(currentState), 1000);
        } else {
          console.error('❌ Превышено количество попыток загрузки шаблона');
          setError('Не удалось загрузить шаблон после нескольких попыток');
        }
      }
    } else {
      console.log('✅ Инвентарь уже содержит данные:', inventoryKeys);
    }
  }, [loadInventoryTemplate]);

  // Основная функция загрузки инвентаря
  const loadInventoryData = useCallback(async (forceReload = false) => {
    try {
        setIsLoading(true);
        setLoadingProgress(0);
        console.log('🔄 Загрузка данных инвентаря:', { chatId, currentUserId, isAdmin });

        // Проверяем наличие необходимых параметров
        if (!currentUserId) {
            console.warn('⚠️ Отсутствует ID пользователя');
            return;
        }

        // Имитация прогресса во время искусственной задержки
        const progressInterval = setInterval(() => {
            setLoadingProgress(prev => Math.min(prev + 5, 70));
        }, 100);

        // Искусственная задержка для демонстрации анимации
        await new Promise(resolve => setTimeout(resolve, 1000));
        clearInterval(progressInterval);
        setLoadingProgress(80);

        if (chatId) {
            console.log('📥 Загрузка данных для конкретного чата:', chatId);
            const result = await dispatch(fetchChatInventory(chatId)).unwrap() as ChatResponse;
            setLoadingProgress(90);
            
            // Проверяем доступ к чату
            if (result && result.data) {
                const hasAccess = isAdmin || (result.data.admins && result.data.admins.some((admin: Admin) => admin.user_id === currentUserId));
                if (!hasAccess) {
                    throw new Error('У вас нет доступа к этому чату');
                }
            }
            
            // Проверяем, пустой ли инвентарь
            if (result && result.data && (!result.data.inventory || Object.keys(result.data.inventory).length === 0)) {
                console.log('⚠️ Инвентарь пуст, загружаем шаблон...');
                // Здесь можно добавить логику загрузки шаблона
            }
        } else {
            console.log('📥 Загрузка списка чатов');
            await dispatch(fetchInventory()).unwrap();
        }

        setLoadingProgress(100);
        setError(null);
        isInitialized.current = true;
    } catch (error) {
        console.error('❌ Ошибка при загрузке данных:', error);
        setError(error instanceof Error ? error.message : 'Произошла ошибка при загрузке данных');
        setLoadingProgress(100);
    } finally {
        // Добавляем небольшую задержку перед скрытием скелетона
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoading(false);
    }
}, [chatId, currentUserId, isAdmin, dispatch]);

  // Эффект для инициализации приложения
  useEffect(() => {
    let isMounted = true;
    
    const initializeApp = async () => {
      if (!isInitialized.current && isMounted) {
        console.log('🔍 Начало инициализации:', {
          chatId,
          currentUserId,
          isAdmin,
          isInitialized: isInitialized.current
        });
        
        try {
          await loadInventoryData();
          console.log('✅ Инициализация завершена успешно');
        } catch (error) {
          console.error('❌ Ошибка при инициализации:', error);
        }
      }
    };
    
    if (currentUserId) {
      initializeApp();
    }
    
    return () => {
      isMounted = false;
    };
  }, [currentUserId, loadInventoryData]);
  
  // Добавляем новый эффект для принудительной проверки пустого инвентаря
  useEffect(() => {
    let isMounted = true;
    
    // Если инициализация завершена, но шаблон не применен, и у нас есть ID чата
    if (isInitialized.current && !templateApplied.current && chatId && !isLoading) {
      console.log('⚠️ Инициализация завершена, но шаблон не применен, проверяем инвентарь...');
      
      // Загружаем инвентарь чата и проверяем, нужно ли применить шаблон
      dispatch(fetchChatInventory(chatId)).then(result => {
        if (isMounted && result.payload) {
          console.log('📦 Получены данные чата:', result.payload);
          const inventory = typeof result.payload === 'object' && result.payload ? result.payload : {};
          
          const currentState: InventoryState = {
            selectedChat: {
              chat_id: chatId,
              inventory: inventory
            }
          };
          checkAndApplyTemplate(currentState);
        }
      });
    }
    
    return () => {
      isMounted = false;
    };
  }, [chatId, isLoading, dispatch, checkAndApplyTemplate]);
  
  // Периодическое обновление списка чатов
  useEffect(() => {
    if (!isInitialized.current || !currentUserId) return;
    
    const updateInterval = setInterval(() => {
      if (!chatId) { // Обновляем только если не находимся в инвентаре
        dispatch(fetchInventory());
      }
    }, 30000);
    
    return () => clearInterval(updateInterval);
  }, [dispatch, chatId, currentUserId]);
  
  // Эффект для проверки прав администратора
  useEffect(() => {
    if (!currentUserId) return;
    
    // Если мы на странице инвентаризации и пользователь потерял права админа
    if (chatId && !isAdmin) {
      console.debug('⚠️ Потеря прав администратора в инвентаризации:', {
        chatId
      });
      
      // Сохраняем ID чата для отображения уведомления
      sessionStorage.setItem('wasKickedFromInventory', chatId);
      
      // Если мы находимся на странице инвентаризации, возвращаемся к списку
      if (window.location.pathname.includes(`/inventory/${chatId}`)) {
        dispatch(fetchChatInventory(chatId));
        navigate('/inventory');
      }
    }
  }, [chatId, isAdmin, currentUserId, dispatch, navigate]);
  
  return {
    isLoading,
    error,
    isInitialized: isInitialized.current,
    loadInventoryData,
    loadInventoryTemplate,
    loadingProgress
  };
} 