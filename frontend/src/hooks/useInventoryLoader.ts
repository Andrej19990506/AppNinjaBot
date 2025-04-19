import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchInventory, 
  fetchChatInventory, 
  updateInventoryData,
  updateProgress,
  // updateInventoryItem, // <-- Закомментировано, т.к. не используется в этом хуке
  selectChat
} from '../store/slices/inventorySlice';
import { useNavigate } from 'react-router-dom';
import { ChatResponse } from '../types/inventory'; // Убрали Admin, т.к. не используется
import axios from 'axios';
import config from '../config';
import { axiosInstance } from '../services/api'; // <-- ДОБАВЛЯЕМ ИМПОРТ

interface UseInventoryLoaderProps {
  chatId?: string;
  currentUserId: number | null;
  isAdmin: boolean;
  role: string | null;
}

interface InventoryState {
    selectedChat?: {
        inventory: any;
        chat_id: string;
    };
}

export const useInventoryLoader = ({ chatId, currentUserId, isAdmin, role }: UseInventoryLoaderProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialized = useRef<boolean>(false);
  const templateApplied = useRef<boolean>(false);
  const retryCount = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const chats = useAppSelector(state => state.inventory.items);
  const [loadingProgress, setLoadingProgress] = useState(0);
  

  // Обработчик обновлений инвентаря через WebSocket
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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



  // Функция для загрузки шаблона инвентаря из JSON-файла
  const loadInventoryTemplate = useCallback(async () => {
    console.log('🔄 Загрузка шаблона инвентаря с API...');
    // console.log('📊 Параметры:', { chatId, currentUserId, isAdmin }); // Параметры больше не нужны для шаблона
    
    try {
      setIsLoading(true); // Можно оставить или убрать, если загрузка быстрая
      console.log('⏳ [loadInventoryTemplate] Запрос к GET /inventory/template...');
      
      // ИСПРАВЛЕНО: Запрос к новому эндпоинту с правильным префиксом
      // ПРЕДПОЛОЖЕНИЕ: config.API_URL = http://localhost:8000
      const response = await axios.get(`${config.API_URL}/api/v1/groups/inventory/template`);
      
      const templateData = response.data;
      if (!templateData || typeof templateData !== 'object') {
          console.error('❌ [loadInventoryTemplate] Получены неверные данные шаблона:', templateData);
          throw new Error('Invalid template data received from server');
      }

      console.log('✅ [loadInventoryTemplate] Шаблон успешно загружен с API:', templateData);
      return templateData; // Возвращаем структуру шаблона

    } catch (error) {
      console.error('❌ [loadInventoryTemplate] Ошибка при загрузке шаблона с API:', error);
      setError('Не удалось загрузить шаблон инвентаря с сервера');
      throw error;
    } finally {
      setIsLoading(false);
      console.log('⏳ [loadInventoryTemplate] Загрузка шаблона завершена');
    }
  // Убираем лишние зависимости, оставляем только setIsLoading и setError, если они используются
  }, [setIsLoading, setError]); 
  
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

    if ((!inventory || inventoryKeys.length === 0) && chatId) { // Добавили проверку chatId
      console.log('📋 [checkAndApplyTemplate] Инвентарь пуст, загружаем шаблон...');
      try {
        const templateData = await loadInventoryTemplate(); // Получаем шаблон
        console.log('✅ [checkAndApplyTemplate] Шаблон загружен:', templateData);

        if (templateData && Object.keys(templateData).length > 0) { 
             console.log(`📤 [checkAndApplyTemplate] Отправка шаблона через axiosInstance на POST /api/v1/groups/inventory/${chatId}...`);
             
             // Формируем payload для API БЕЗ ПОЛЯ history
             const payloadToSend = {
                inventory: templateData,
                metadata: { 
                     lastUpdated: new Date().toISOString(),
                     progress: 0, 
                     chat_id: chatId,
                     currentUser: { id: currentUserId, first_name: 'Неизвестно' } 
                }
             };
             
             const response = await axiosInstance.post(`/api/v1/groups/inventory/${chatId}`, payloadToSend);
             console.log('✅ [checkAndApplyTemplate] Ответ от сервера на POST шаблона:', response.data);
             
             // Важно: После успешной отправки нужно обновить состояние в Redux,
             // чтобы интерфейс отобразил загруженный инвентарь.
             // Диспатчим обновление данных, имитируя ответ от WebSocket или API.
             dispatch(updateInventoryData({
                 chatId: chatId,
                 data: {
                     inventory: templateData,
                     metadata: payloadToSend.metadata,
                     type: 'full' // Указываем, что это полное обновление
                 }
             }));

             console.log(`✅ [checkAndApplyTemplate] Шаблон успешно отправлен и применен локально для chatId: ${chatId}`);
        } else {
            console.warn('❌ [checkAndApplyTemplate] Не удалось отправить шаблон: templateData пусто.');
        }

        templateApplied.current = true; // Отмечаем, что попытка применения была
      } catch (error) { // Обработка ошибок axios и loadInventoryTemplate
        console.error('❌ [checkAndApplyTemplate] Ошибка при загрузке или отправке шаблона:', error);
        // Логика повторных попыток
        if (retryCount.current < 3) {
          console.log('🔄 Повторная попытка применения шаблона...');
          retryCount.current += 1;
          setTimeout(() => checkAndApplyTemplate({ // Передаем фиктивное состояние
             selectedChat: { chat_id: chatId || '', inventory: {}}
          }), 2000); // Увеличим задержку
        } else {
          console.error('❌ Превышено количество попыток применения шаблона');
          setError('Не удалось применить шаблон инвентаря после нескольких попыток');
        }
      }
    } else {
      if (!chatId) {
          console.warn('[checkAndApplyTemplate] Пропуск применения шаблона: chatId не определен.');
      }
      console.log('✅ [checkAndApplyTemplate] Инвентарь уже содержит данные или chatId не определен.');
      templateApplied.current = true; // Считаем, что шаблон не нужен или уже применен
    }
  // Обновляем зависимости: добавляем dispatch, currentUserId (если используется в payloadToSend)
  }, [loadInventoryTemplate, chatId, dispatch, setError, currentUserId]); // Убираем checkAndApplyTemplate из зависимостей самого себя

  // Основная функция загрузки инвентаря
  const loadInventoryData = useCallback(async (forceReload = false) => {
    console.log('🔄 [loadInventoryData] Запуск загрузки данных:', { chatId, currentUserId, isAdmin, forceReload });
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
        // Проверяем наличие необходимых параметров
        if (!currentUserId) {
            console.warn('⚠️ [loadInventoryData] Отсутствует ID пользователя, загрузка прервана.');
            setIsLoading(false);
            return;
        }

        // Имитация начального прогресса
        setLoadingProgress(10);
        
        if (chatId) {
            console.log('📥 [loadInventoryData] Загрузка данных для конкретного чата:', chatId);
            
            // Имитация прогресса во время запроса
            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => Math.min(prev + 15, 80)); 
            }, 200);
            
            // Загружаем данные чата
            const resultAction = await dispatch(fetchChatInventory(chatId));
            clearInterval(progressInterval);
            setLoadingProgress(90);

            // Проверяем результат thunk
            if (fetchChatInventory.rejected.match(resultAction)) {
                throw new Error(resultAction.error.message || 'Не удалось загрузить данные чата');
            }
            
            const result = resultAction.payload as ChatResponse; // Утверждаем тип payload
            
            if (!result || !result.data) {
                throw new Error('Получен неверный ответ от API');
            }

            // Проверяем доступ (опционально, если права не проверяются иначе)
            // const hasAccess = isAdmin || (result.data.admins && result.data.admins.some((admin: Admin) => admin.user_id === currentUserId));
            // if (!hasAccess) {
            //     throw new Error('У вас нет доступа к этому чату');
            // }

            // --- ЛОГИКА ПРИМЕНЕНИЯ ШАБЛОНА ПЕРЕНЕСЕНА СЮДА ---
            const inventory = result.data.inventory;
            const inventoryKeys = inventory ? Object.keys(inventory) : [];
            console.log('[loadInventoryData] Проверка инвентаря после загрузки:', { inventoryKeys });

            if (!inventory || inventoryKeys.length === 0) {
                console.log('⚠️ [loadInventoryData] Инвентарь пуст после загрузки, пытаемся применить шаблон...');
                // Создаем фиктивное состояние, т.к. checkAndApplyTemplate его ожидает
                const currentState: InventoryState = {
                    selectedChat: {
                        chat_id: chatId,
                        inventory: {}
                    }
                };
                // Вызываем проверку и применение шаблона
                await checkAndApplyTemplate(currentState);
                // Отмечаем, что шаблон применен (или была попытка)
                templateApplied.current = true; 
            } else {
                 console.log('✅ [loadInventoryData] Инвентарь содержит данные, шаблон не требуется.');
                 templateApplied.current = true; // Считаем, что шаблон уже есть
            }
            // -----------------------------------------------------

            setLoadingProgress(100);

            // <<< ШАГ 2: ДИСПАТЧ selectChat ПОСЛЕ ЗАВЕРШЕНИЯ ЗАГРУЗКИ >>>
            if (chatId) {
                console.log(`🎯 [loadInventoryData] Диспатчим selectChat для chatId: ${chatId}`);
                dispatch(selectChat(chatId)); // Выбираем чат в Redux
            }
            
            isInitialized.current = true; // Отмечаем, что инициализация завершена
        } else {
            // Если chatId не указан (например, на главной /inventory)
            console.log('[loadInventoryData] chatId не указан, загрузка данных чата не выполняется.');
            // Загрузка общего списка чатов (если требуется при начальном входе)
            if (currentUserId && role) {
                console.log('🔄 [loadInventoryData] Загрузка общего списка чатов...');
                await dispatch(fetchInventory({ userId: currentUserId, role }));
                console.log('✅ [loadInventoryData] Общий список чатов загружен.');
            } else {
                 console.warn('[loadInventoryData] Недостаточно данных для загрузки общего списка чатов (userId, role).');
            }
        }

        console.log('✅ [loadInventoryData] Загрузка данных успешно завершена.');
    } catch (err: any) {
        console.error('❌ [loadInventoryData] Ошибка при загрузке данных:', err);
        setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных');
        setLoadingProgress(100);
    } finally {
        // Добавляем небольшую задержку перед скрытием скелетона
        await new Promise(resolve => setTimeout(resolve, 300)); // Уменьшил задержку
        setIsLoading(false);
        console.log('🏁 [loadInventoryData] Состояние isLoading установлено в false.');
    }
  }, [dispatch, chatId, currentUserId, isAdmin, checkAndApplyTemplate, role]);

  // Эффект для инициализации и перезагрузки при смене chatId
  useEffect(() => {
    console.log(`🔄 [useEffect/init] Запуск эффекта инициализации/перезагрузки. chatId: ${chatId}, currentUserId: ${currentUserId}`);
    
    if (currentUserId) {
        console.log('🚀 [useEffect/init] Вызов loadInventoryData...');
        loadInventoryData(); 
    } else {
        console.warn('⚠️ [useEffect/init] currentUserId отсутствует, инициализация пропускается.');
    }
    
    return () => {
      console.log('🧹 [useEffect/init] Очистка эффекта инициализации.');
    };
  // Зависим от loadInventoryData, currentUserId и chatId
  }, [loadInventoryData, currentUserId, chatId]);
  
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
  
  // Эффект для проверки прав администратора
  useEffect(() => {
    if (!currentUserId) return;
    
    if (chatId && !isAdmin) { // Используется chatId
      console.debug('⚠️ Потеря прав администратора в инвентаризации:', {
        chatId
      });
      
      sessionStorage.setItem('wasKickedFromInventory', chatId);
      
      if (window.location.pathname.includes(`/inventory/${chatId}`)) {
        navigate('/inventory');
      }
    }
  }, [chatId, isAdmin, currentUserId, dispatch, navigate]); // <-- ДОБАВЛЯЕМ chatId в зависимости
  
  // УДАЛЯЕМ отдельный useEffect для проверки и применения шаблона
  // useEffect(() => {
  //   let isMounted = true;
  //   if (isInitialized.current && !templateApplied.current && chatId && !isLoading) {
  //     // ... логика вызова checkAndApplyTemplate ...
  //   }
  //   return () => { isMounted = false; };
  // }, [isInitialized, templateApplied, chatId, isLoading, dispatch, checkAndApplyTemplate, chats]); 
  
  return {
    isLoading,
    error,
    // isInitialized: isInitialized.current, // Больше не нужно наружу
    loadInventoryData,
    loadInventoryTemplate,
    loadingProgress,
    isAdmin
  };
} 