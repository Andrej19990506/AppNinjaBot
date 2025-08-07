import { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import { socketService } from '@shared/services/socketService';

export const useAwayState = () => {
  const [isAwayOverlayVisible, setIsAwayOverlayVisible] = useState(false);
  const [isUserAway, setIsUserAway] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const user = useSelector(selectUser);
  const listenersSetupRef = useRef(false);

  const handleContinueWork = useCallback(() => {
    console.log('🔔 [useAwayState] Пользователь нажал "Продолжить работу"');
    setIsUserAway(false);
    setIsAwayOverlayVisible(false);
    // Отправляем событие на сервер, что пользователь вернулся
    if (socketService.isConnected()) {
      socketService.emit('user_activity', { timestamp: Date.now(), type: 'active' });
    }
  }, []);

  // Отслеживаем состояние подключения WebSocket
  useEffect(() => {
    const checkSocketState = () => {
      const isReady = socketService.isInitialized() && socketService.isConnected();
      setIsSocketReady(isReady);
      console.log('🔔 [useAwayState] Состояние WebSocket изменилось:', { 
        isInitialized: socketService.isInitialized(), 
        isConnected: socketService.isConnected(),
        isReady 
      });
    };

    // Проверяем текущее состояние
    checkSocketState();

    // Подписываемся на изменения состояния
    const unsubscribeStateChange = socketService.onStateChange((state) => {
      console.log('🔔 [useAwayState] Получено изменение состояния WebSocket:', state);
      const isReady = socketService.isInitialized() && socketService.isConnected();
      setIsSocketReady(isReady);
    });

    return () => {
      unsubscribeStateChange();
    };
  }, []);

  // Слушаем события отсутствия от WebSocket
  useEffect(() => {
    console.log('🔔 [useAwayState] useEffect для слушателей запущен', {
      isSocketReady,
      user: user ? { id: user.id, name: user.first_name } : null,
      listenersSetup: listenersSetupRef.current
    });

    if (!isSocketReady || !user || listenersSetupRef.current) {
      console.log('🔔 [useAwayState] WebSocket не готов, пользователь не загружен или слушатели уже настроены, пропускаем настройку слушателей');
      return;
    }

    // Небольшая задержка для стабилизации подключения
    const setupListeners = () => {
      if (listenersSetupRef.current) {
        console.log('🔔 [useAwayState] Слушатели уже настроены, пропускаем');
        return;
      }

      console.log('🔔 [useAwayState] Настраиваем слушатели событий отсутствия');
      listenersSetupRef.current = true;
    
      // Слушаем события user_away для текущего пользователя (не ответил на пинги)
      const handleUserAway = (data: any) => {
        const currentUser = user;
        // Сравниваем как строки, так и числа
        const isCurrentUser = currentUser && (
          data.user_id === currentUser.id || 
          data.user_id === currentUser.id.toString() || 
          data.user_id === String(currentUser.id)
        );
        
        if (isCurrentUser) {
          console.log('🔔 [useAwayState] Показываем заставку (user_away)');
          setIsUserAway(true);
          setIsAwayOverlayVisible(true);
        }
      };

      // Слушаем события user_back для текущего пользователя (вернулся после неответа на пинги)
      const handleUserBack = (data: any) => {
        const currentUser = user;
        // Сравниваем как строки, так и числа
        const isCurrentUser = currentUser && (
          data.user_id === currentUser.id || 
          data.user_id === currentUser.id.toString() || 
          data.user_id === String(currentUser.id)
        );
        
        if (isCurrentUser) {
          console.log('🔔 [useAwayState] Скрываем заставку (user_back)');
          setIsUserAway(false);
          setIsAwayOverlayVisible(false);
        }
      };

      // Слушаем события user_activity_update для текущего пользователя (активность/неактивность)
      const handleUserActivityUpdate = (data: any) => {
        const currentUser = user;
        // Сравниваем как строки, так и числа
        const isCurrentUser = currentUser && (
          data.user_id === currentUser.id || 
          data.user_id === currentUser.id.toString() || 
          data.user_id === String(currentUser.id)
        );
        
        if (isCurrentUser) {
          // Проверяем, что событие относится к комнате инвентаризации
          const room = data.room || data.room_id;
          if (!room || !room.startsWith('inventory_')) {
            return;
          }
          
          const activityState = data.activity_state;
          console.log('🔔 [useAwayState] Обрабатываем activity_update:', { activityState, room });
          
          if (activityState === 'inactive') {
            console.log('🔔 [useAwayState] Показываем заставку (inactive)');
            setIsUserAway(true);
            setIsAwayOverlayVisible(true);
          } else if (activityState === 'active') {
            console.log('🔔 [useAwayState] Скрываем заставку (active)');
            setIsUserAway(false);
            setIsAwayOverlayVisible(false);
          }
        }
      };

      // Подписываемся на события
      const unsubscribeAway = socketService.onUserAway(handleUserAway);
      const unsubscribeBack = socketService.onUserBack(handleUserBack);
      const unsubscribeActivityUpdate = socketService.onUserActivityUpdate(handleUserActivityUpdate);

      return () => {
        listenersSetupRef.current = false;
        unsubscribeAway();
        unsubscribeBack();
        unsubscribeActivityUpdate();
      };
    };

    // Запускаем настройку слушателей с небольшой задержкой
    const timer = setTimeout(setupListeners, 100);
    return () => {
      clearTimeout(timer);
      listenersSetupRef.current = false;
    };
  }, [user, isSocketReady]); // Зависимость от состояния готовности WebSocket

  // Автоматически скрываем заставку при получении фокуса окна
  useEffect(() => {
    const handleWindowFocus = () => {
      if (isAwayOverlayVisible) {
        handleContinueWork();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isAwayOverlayVisible, handleContinueWork]);

  return {
    isAwayOverlayVisible,
    isUserAway,
    handleContinueWork
  };
}; 