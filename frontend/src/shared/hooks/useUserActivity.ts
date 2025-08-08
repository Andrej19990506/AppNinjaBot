import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socketService';

export interface UserActivityState {
  isActive: boolean;
  lastActivityTime: number;
  timeSinceLastActivity: number;
}

export const useUserActivity = (inactivityTimeout: number = 120000) => {
  const [activityState, setActivityState] = useState<UserActivityState>({
    isActive: true,
    lastActivityTime: Date.now(),
    timeSinceLastActivity: 0
  });

  // Используем useRef для отслеживания последнего времени активности без перерендеров
  const lastActivityTimeRef = useRef(Date.now());
  const isActiveRef = useRef(true);
  const lastEventSentRef = useRef<{ type: 'active' | 'inactive'; timestamp: number } | null>(null);
  const pendingAwayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Функция для обновления активности с дебаунсингом
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityTimeRef.current = now;
    isActiveRef.current = true;
    
    setActivityState(prev => ({
      isActive: true,
      lastActivityTime: now,
      timeSinceLastActivity: 0
    }));

    // Отправляем событие активности только если последнее событие было неактивности или прошло больше 10 секунд
    const shouldSendEvent = !lastEventSentRef.current || 
                           lastEventSentRef.current.type === 'inactive' ||
                           (now - lastEventSentRef.current.timestamp) > 10000;

    if (shouldSendEvent) {
      // Отправляем событие активности на сервер
      socketService.emit('user_activity', {
        timestamp: now,
        type: 'activity'
      });
      lastEventSentRef.current = { type: 'active', timestamp: now };
    }
  }, []);

  // Функция для отправки состояния неактивности с дебаунсингом
  const sendInactiveState = useCallback(() => {
    const now = Date.now();
    
    // Отправляем событие неактивности только если последнее событие было активности или прошло больше 10 секунд
    const shouldSendEvent = !lastEventSentRef.current || 
                           lastEventSentRef.current.type === 'active' ||
                           (now - lastEventSentRef.current.timestamp) > 10000;

    if (shouldSendEvent) {
      socketService.emit('user_inactive', {
        timestamp: now,
        type: 'inactive'
      });
      lastEventSentRef.current = { type: 'inactive', timestamp: now };
    }
  }, []);

  useEffect(() => {
    // События для отслеживания активности
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ];

    // Дебаунсинг для обработчиков событий
    let activityTimeout: NodeJS.Timeout | null = null;

    // Обработчики событий с дебаунсингом
    const handleActivity = () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      activityTimeout = setTimeout(() => {
        updateActivity();
      }, 100); // Дебаунсинг 100ms
    };

    // Обработчик изменения видимости страницы с отложенным переводом в неактивность
    let visibilityTimeout: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      visibilityTimeout = setTimeout(() => {
        if (document.hidden) {
          // Страница скрыта — НЕ уходим в неактив сразу. Ждём 60 секунд.
          if (pendingAwayTimerRef.current) clearTimeout(pendingAwayTimerRef.current);
          pendingAwayTimerRef.current = setTimeout(() => {
            isActiveRef.current = false;
            setActivityState(prev => ({ ...prev, isActive: false }));
            sendInactiveState();
          }, 60000);
        } else {
          // Страница снова видна — отменяем отложенный уход и считаем активным
          if (pendingAwayTimerRef.current) {
            clearTimeout(pendingAwayTimerRef.current);
            pendingAwayTimerRef.current = null;
          }
          updateActivity();
        }
      }, 300); // Небольшой дебаунс на смену видимости
    };

    // Обработчик фокуса окна с дебаунсингом
    let focusTimeout: NodeJS.Timeout | null = null;
    const handleFocus = () => {
      if (focusTimeout) {
        clearTimeout(focusTimeout);
      }
      focusTimeout = setTimeout(() => {
        // Возврат фокуса — отменяем отложенный уход
        if (pendingAwayTimerRef.current) {
          clearTimeout(pendingAwayTimerRef.current);
          pendingAwayTimerRef.current = null;
        }
        updateActivity();
      }, 200); // Дебаунсинг 200ms
    };

    // Обработчик потери фокуса окна с отложенным переводом в неактивность
    let blurTimeout: NodeJS.Timeout | null = null;
    const handleBlur = () => {
      if (blurTimeout) {
        clearTimeout(blurTimeout);
      }
      blurTimeout = setTimeout(() => {
        // Не считаем «ушёл» мгновенно — ждём 60 секунд, если не вернулся
        if (pendingAwayTimerRef.current) clearTimeout(pendingAwayTimerRef.current);
        pendingAwayTimerRef.current = setTimeout(() => {
          isActiveRef.current = false;
          setActivityState(prev => ({ ...prev, isActive: false }));
          sendInactiveState();
        }, 60000);
      }, 300); // Небольшой дебаунс blur
    };

    // Добавляем обработчики событий
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Таймер для проверки неактивности
    const inactivityTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;

      if (timeSinceLastActivity >= inactivityTimeout && isActiveRef.current) {
        // Пользователь неактивен
        isActiveRef.current = false;
        setActivityState(prev => {
          // Проверяем, действительно ли состояние изменилось
          if (prev.isActive === false) return prev;
          return {
            ...prev,
            isActive: false,
            timeSinceLastActivity
          };
        });
        sendInactiveState();
      } else if (timeSinceLastActivity < inactivityTimeout && !isActiveRef.current) {
        // Пользователь снова активен
        isActiveRef.current = true;
        setActivityState(prev => {
          // Проверяем, действительно ли состояние изменилось
          if (prev.isActive === true) return prev;
          return {
            ...prev,
            isActive: true,
            timeSinceLastActivity
          };
        });
        updateActivity();
      } else if (isActiveRef.current) {
        // Обновляем время с последней активности только если пользователь активен
        setActivityState(prev => ({
          ...prev,
          timeSinceLastActivity
        }));
      }
    }, 5000); // Проверяем каждые 5 секунд вместо каждой секунды

    // Очистка обработчиков
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      clearInterval(inactivityTimer);
      
      // Очищаем таймауты дебаунсинга
      if (activityTimeout) clearTimeout(activityTimeout);
      if (visibilityTimeout) clearTimeout(visibilityTimeout);
      if (focusTimeout) clearTimeout(focusTimeout);
      if (blurTimeout) clearTimeout(blurTimeout);
      if (pendingAwayTimerRef.current) clearTimeout(pendingAwayTimerRef.current);
    };
  }, [inactivityTimeout, updateActivity, sendInactiveState]); // Убрали проблемные зависимости

  return activityState;
}; 