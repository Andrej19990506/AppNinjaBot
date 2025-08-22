import { useEffect, useRef } from 'react';
import { socketService } from '../services/socketService';
import { activityNotificationService } from '../services/activityNotificationService';
import { logger } from '../utils/logger';
import store from '../store/store';

/**
 * Глобальный хук для уведомлений активности пользователей
 * Работает независимо от компонентов и всегда активен
 * Показывает уведомления только для событий в комнатах инвентаризации
 */
export const useActivityNotifications = () => {
  // Добавляем ref для отслеживания последнего состояния активности
  const lastActivityStateRef = useRef<{ [userId: string]: string }>({});
  const lastActivityTimeRef = useRef<{ [userId: string]: number }>({});
  
  useEffect(() => {
    // Проверяем, есть ли ошибка сервера
    const state = store.getState();
    const initError = state.user.error;
    const isServerError = initError && (
      initError.includes('Сервер недоступен') ||
      initError.includes('Timeout: сервер не отвечает') ||
      initError.includes('Network Error: сервер недоступен') ||
      initError.includes('Failed to fetch: сервер недоступен') ||
      initError.includes('Критическая ошибка проверки сервера') ||
      initError.includes('Network Error') ||
      initError.includes('ERR_CONNECTION_REFUSED')
    );
    
    if (isServerError) {
      console.log('🔔 [useActivityNotifications] Обнаружена ошибка сервера, пропускаем инициализацию WebSocket');
      return;
    }
    
    console.log('🔔 [useActivityNotifications] Инициализация глобальных уведомлений активности');
    console.log('🔔 [useActivityNotifications] SocketService состояние:', {
      isInitialized: socketService.isInitialized(),
      isConnected: socketService.isConnected(),
      socketId: socketService.getSocket()?.id
    });

    // Функция для настройки подписок
    const setupSubscriptions = () => {
      if (!socketService.isInitialized() || !socketService.isConnected()) {
        console.log('🔔 [useActivityNotifications] SocketService не готов, пропускаем настройку подписок');
        return null;
      }

      console.log('🔔 [useActivityNotifications] Настраиваем подписки на события активности');

      // Подписываемся на события активности пользователей
      const unsubscribeUserActivityUpdate = socketService.onUserActivityUpdate((data: any) => {
        console.log('🔔 [useActivityNotifications] Получено событие user_activity_update:', data);
        
        // Определяем переменную room
        const room = data.room || data.room_id;
        
        // ВРЕМЕННО: Убираем фильтрацию по комнате для тестирования заставки
        // if (!room || !room.startsWith('inventory_')) {
        //   console.log('🔔 [useActivityNotifications] Событие не относится к комнате инвентаризации, пропускаем:', room);
        //   return;
        // }
        
        // Дополнительная проверка: показываем уведомления только если пользователь находится в разделе инвентаризации
        const currentPath = window.location.pathname;
        const isInInventorySection = currentPath.includes('/inventory') || currentPath.includes('/inventories');
        if (!isInInventorySection) {
          console.log('🔔 [useActivityNotifications] Пользователь не в разделе инвентаризации, пропускаем уведомление. Текущий путь:', currentPath);
          return;
        }
        
        const userId = data.userId || data.user_id || 'unknown';
        const activityState = data.activity_state || data.user_activity_state || 'active';
        const userName = data.first_name || data.user_info?.first_name || userId;
        let photoUrl = data.photo_url || data.user_info?.photo_url || data.user_info?.photoUrl;
        
        // Формируем полный URL для фотографии используя API endpoint
        if (photoUrl && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
          const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
          photoUrl = `${baseURL}/v1/users/${userId}/photo`;
        }
        
        console.log('🔔 [useActivityNotifications] Вызываем activityNotificationService.showActivityNotification:', {
          userId,
          userName,
          activityState,
          photoUrl,
          room,
          timestamp: Date.now()
        });
        
        // Проверяем, не было ли уже недавно уведомления для этого пользователя
        const now = Date.now();
        const lastTime = lastActivityTimeRef.current[userId] || 0;
        const lastState = lastActivityStateRef.current[userId];
        
        // Если прошло меньше 1 секунды или состояние не изменилось, пропускаем
        if (now - lastTime < 1000 || lastState === activityState) {
          console.log('🔔 [useActivityNotifications] Пропускаем уведомление - слишком часто или состояние не изменилось:', {
            userId,
            lastState,
            newState: activityState,
            timeDiff: now - lastTime
          });
          return;
        }
        
        // Обновляем последнее состояние и время
        lastActivityStateRef.current[userId] = activityState;
        lastActivityTimeRef.current[userId] = now;
        
        console.log('🔔 [useActivityNotifications] Показываем уведомление активности:', {
          userId,
          userName,
          activityState,
          lastState,
          timeDiff: now - lastTime
        });
        
        // Проверяем, это наш собственный пользователь или другой
        const currentUser = store.getState().user.user;
        const isOwnActivity = currentUser && currentUser.id === userId;
        
        // Формируем персонализированное сообщение
        let personalizedMessage = '';
        if (isOwnActivity) {
          if (activityState === 'active') {
            personalizedMessage = 'Вы вернулись';
          } else {
            personalizedMessage = 'Вы отошли';
          }
        } else {
          if (activityState === 'active') {
            personalizedMessage = `${userName} вернулся`;
          } else {
            personalizedMessage = `${userName} отошел`;
          }
        }
        
        // Показываем уведомление через сервис
        activityNotificationService.showActivityNotification({
          userId,
          userName: isOwnActivity ? 'Вы' : userName,
          activityState,
          photoUrl,
          timestamp: now,
          message: personalizedMessage
        });
      });

      // Подписываемся на события ухода пользователей
      const unsubscribeUserAway = socketService.onUserAway((data: any) => {
        console.log('🔔 [useActivityNotifications] Пользователь ушел:', data);
        
        // Проверяем, что событие относится к комнате инвентаризации
        const room = data.room || data.room_id;
        if (!room || !room.startsWith('inventory_')) {
          console.log('🔔 [useActivityNotifications] Событие ухода не относится к комнате инвентаризации, пропускаем:', room);
          return;
        }
        
        // Дополнительная проверка: показываем уведомления только если пользователь находится в разделе инвентаризации
        const currentPath = window.location.pathname;
        const isInInventorySection = currentPath.includes('/inventory') || currentPath.includes('/inventories');
        if (!isInInventorySection) {
          console.log('🔔 [useActivityNotifications] Пользователь не в разделе инвентаризации, пропускаем уведомление об уходе. Текущий путь:', currentPath);
          return;
        }
        
        const userId = data.userId || data.user_id || 'unknown';
        const userName = data.first_name || data.user_info?.first_name || userId;
        let photoUrl = data.photo_url || data.user_info?.photo_url || data.user_info?.photoUrl;
        
        // Формируем полный URL для фотографии используя API endpoint
        if (photoUrl && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
          const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
          photoUrl = `${baseURL}/v1/users/${userId}/photo`;
        }
        
        // Проверяем, не было ли уже недавно уведомления для этого пользователя
        const now = Date.now();
        const lastTime = lastActivityTimeRef.current[userId] || 0;
        const lastState = lastActivityStateRef.current[userId];
        
        // Если прошло меньше 1 секунды или состояние не изменилось, пропускаем
        if (now - lastTime < 1000 || lastState === 'inactive') {
          console.log('🔔 [useActivityNotifications] Пропускаем уведомление об уходе - слишком часто или состояние не изменилось:', {
            userId,
            lastState,
            newState: 'inactive',
            timeDiff: now - lastTime
          });
          return;
        }
        
        // Обновляем последнее состояние и время
        lastActivityStateRef.current[userId] = 'inactive';
        lastActivityTimeRef.current[userId] = now;
        
        console.log('🔔 [useActivityNotifications] Показываем уведомление о том, что пользователь ушел:', {
          userId,
          userName,
          room,
          photoUrl,
          lastState,
          timeDiff: now - lastTime
        });
        
        // Проверяем, это наш собственный пользователь или другой
        const currentUser = store.getState().user.user;
        const isOwnActivity = currentUser && currentUser.id === userId;
        
        // Формируем персонализированное сообщение
        let personalizedMessage = '';
        if (isOwnActivity) {
          personalizedMessage = 'Вы отошли';
        } else {
          personalizedMessage = `${userName} отошел`;
        }
        
        activityNotificationService.showActivityNotification({
          userId,
          userName: isOwnActivity ? 'Вы' : userName,
          activityState: 'inactive',
          photoUrl,
          timestamp: now,
          message: personalizedMessage
        });
      });

      // Подписываемся на события возвращения пользователей
      const unsubscribeUserBack = socketService.onUserBack((data: any) => {
        console.log('🔔 [useActivityNotifications] Пользователь вернулся:', data);
        
        // Проверяем, что событие относится к комнате инвентаризации
        const room = data.room || data.room_id;
        if (!room || !room.startsWith('inventory_')) {
          console.log('🔔 [useActivityNotifications] Событие возвращения не относится к комнате инвентаризации, пропускаем:', room);
          return;
        }
        
        // Дополнительная проверка: показываем уведомления только если пользователь находится в разделе инвентаризации
        const currentPath = window.location.pathname;
        const isInInventorySection = currentPath.includes('/inventory') || currentPath.includes('/inventories');
        if (!isInInventorySection) {
          console.log('🔔 [useActivityNotifications] Пользователь не в разделе инвентаризации, пропускаем уведомление о возвращении. Текущий путь:', currentPath);
          return;
        }
        
        const userId = data.userId || data.user_id || 'unknown';
        const userName = data.first_name || data.user_info?.first_name || userId;
        let photoUrl = data.photo_url || data.user_info?.photo_url || data.user_info?.photoUrl;
        
        // Формируем полный URL для фотографии используя API endpoint
        if (photoUrl && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
          const baseURL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
          photoUrl = `${baseURL}/v1/users/${userId}/photo`;
        }
        
        // Проверяем, не было ли уже недавно уведомления для этого пользователя
        const now = Date.now();
        const lastTime = lastActivityTimeRef.current[userId] || 0;
        const lastState = lastActivityStateRef.current[userId];
        
        // Если прошло меньше 1 секунды или состояние не изменилось, пропускаем
        if (now - lastTime < 1000 || lastState === 'active') {
          console.log('🔔 [useActivityNotifications] Пропускаем уведомление о возвращении - слишком часто или состояние не изменилось:', {
            userId,
            lastState,
            newState: 'active',
            timeDiff: now - lastTime
          });
          return;
        }
        
        // Обновляем последнее состояние и время
        lastActivityStateRef.current[userId] = 'active';
        lastActivityTimeRef.current[userId] = now;
        
        console.log('🔔 [useActivityNotifications] Показываем уведомление о том, что пользователь вернулся:', {
          userId,
          userName,
          room,
          photoUrl,
          lastState,
          timeDiff: now - lastTime
        });
        
        // Проверяем, это наш собственный пользователь или другой
        const currentUser = store.getState().user.user;
        const isOwnActivity = currentUser && currentUser.id === userId;
        
        // Формируем персонализированное сообщение
        let personalizedMessage = '';
        if (isOwnActivity) {
          personalizedMessage = 'Вы вернулись';
        } else {
          personalizedMessage = `${userName} вернулся`;
        }
        
        activityNotificationService.showActivityNotification({
          userId,
          userName: isOwnActivity ? 'Вы' : userName,
          activityState: 'active',
          photoUrl,
          timestamp: now,
          message: personalizedMessage
        });
      });

      return {
        unsubscribeUserActivityUpdate,
        unsubscribeUserAway,
        unsubscribeUserBack
      };
    };

    // Пытаемся настроить подписки сразу
    let subscriptions = setupSubscriptions();

    // Если SocketService не готов, пробуем периодически
    if (!subscriptions) {
      console.log('🔔 [useActivityNotifications] SocketService не готов, настраиваем retry логику');
      
      const retryInterval = setInterval(() => {
        console.log('🔔 [useActivityNotifications] Retry: проверяем готовность SocketService');
        
        if (socketService.isInitialized() && socketService.isConnected()) {
          console.log('🔔 [useActivityNotifications] SocketService готов, настраиваем подписки');
          clearInterval(retryInterval);
          subscriptions = setupSubscriptions();
        }
      }, 1000); // Проверяем каждую секунду

      // Очистка интервала при размонтировании
      return () => {
        clearInterval(retryInterval);
        if (subscriptions) {
          console.log('🔔 [useActivityNotifications] Очистка подписок');
          subscriptions.unsubscribeUserActivityUpdate();
          subscriptions.unsubscribeUserAway();
          subscriptions.unsubscribeUserBack();
        }
      };
    }

    // Очистка подписок при размонтировании
    return () => {
      if (subscriptions) {
        console.log('🔔 [useActivityNotifications] Очистка подписок');
        subscriptions.unsubscribeUserActivityUpdate();
        subscriptions.unsubscribeUserAway();
        subscriptions.unsubscribeUserBack();
      }
    };
  }, []); // Пустой массив зависимостей - хук выполняется только один раз
}; 