import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';
import { activityNotificationService } from '../services/activityNotificationService';

export interface ConnectionStatus {
  sid: string;
  user_id?: string;
  connection_state: 'active' | 'away' | 'disconnected' | 'timeout' | 'unknown';
  connection_quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  connection_duration: number;
  last_activity: number;
  last_ping_time?: number;
  last_pong_time?: number;
  user_activity_state?: 'active' | 'inactive';
  last_user_activity?: number;
  ping_statistics: {
    total_pings: number;
    missed_pongs: number;
    success_rate: number;
  };
  rooms: string[];
  timestamp: string;
}

export interface UserConnectionEvent {
  sid: string;
  user_id?: string;
  reason?: string;
  connection_quality?: string;
  user_info?: any;
  timestamp: string;
  connection_duration?: number;
  consecutive_timeouts?: number;
  previous_state?: string;
  type?: 'away' | 'back' | 'disconnected';
}

export const useConnectionStatus = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Выносим useRef на уровень хука
  const lastActivityUpdateRef = useRef<{ [key: string]: number }>({});

  // Получение статуса подключения
  const getConnectionStatus = useCallback(() => {
    if (!socketService.isConnected()) {
      setError('Socket не подключен');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      socketService.getConnectionStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка получения статуса');
      setIsLoading(false);
    }
  }, []);

  // Обработчик получения статуса подключения
  useEffect(() => {
    const unsubscribe = socketService.onConnectionStatus((status: ConnectionStatus) => {
      logger.info('📊 [Connection Status] Получен статус подключения:', status);
      setConnectionStatus(status);
      setIsLoading(false);
      setError(null);
    });

    return unsubscribe;
  }, []);

  // Обработчик событий пользователей
  const [userEvents, setUserEvents] = useState<UserConnectionEvent[]>([]);

  useEffect(() => {
    const unsubscribeAway = socketService.onUserAway((data: UserConnectionEvent) => {
      logger.info('👤 [Connection] Пользователь ушел:', data);
      setUserEvents(prev => [...prev, { ...data, type: 'away' }]);
    });

    const unsubscribeBack = socketService.onUserBack((data: UserConnectionEvent) => {
      logger.info('👤 [Connection] Пользователь вернулся:', data);
      setUserEvents(prev => [...prev, { ...data, type: 'back' }]);
    });

    const unsubscribeDisconnected = socketService.onUserDisconnected((data: UserConnectionEvent) => {
      logger.info('👤 [Connection] Пользователь отключился:', data);
      setUserEvents(prev => [...prev, { ...data, type: 'disconnected' }]);
    });

    // Дебаунсинг для user_activity_update
    let activityUpdateTimeout: NodeJS.Timeout | null = null;

    // Добавляем обработчик для user_activity_update с дебаунсингом
    const unsubscribeUserActivityUpdate = socketService.onUserActivityUpdate((data: any) => {
      console.log('🔔 [useConnectionStatus] Получено событие user_activity_update:', data);
      
      const userId = data.userId || data.user_id || 'unknown';
      const now = Date.now();
      const lastUpdate = lastActivityUpdateRef.current[userId] || 0;
      
      // Дебаунсинг: игнорируем события от одного пользователя чаще чем раз в 2 секунды
      if (now - lastUpdate < 2000) {
        logger.debug('👤 [Connection] Игнорируем частое обновление активности пользователя:', userId);
        return;
      }
      
      lastActivityUpdateRef.current[userId] = now;
      
      if (activityUpdateTimeout) {
        clearTimeout(activityUpdateTimeout);
      }
      
      activityUpdateTimeout = setTimeout(() => {
        logger.info('👤 [Connection] Обновление активности пользователя:', data);
        
        
        // Также добавляем в список событий для ConnectionStatusPanel
        const eventData: UserConnectionEvent = {
          sid: userId,
          user_id: userId,
          user_info: { first_name: data.first_name || data.user_info?.first_name || userId },
          timestamp: new Date().toISOString(),
          type: (data.activity_state || data.user_activity_state) === 'inactive' ? 'away' : 'back'
        };
        
        setUserEvents(prev => [...prev, eventData]);
      }, 100); // Дебаунсинг 100ms
    });

    return () => {
      unsubscribeAway();
      unsubscribeBack();
      unsubscribeDisconnected();
      unsubscribeUserActivityUpdate();
      if (activityUpdateTimeout) {
        clearTimeout(activityUpdateTimeout);
      }
    };
  }, []);

  // Очистка старых событий
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUserEvents(prev => 
        prev.filter(event => {
          const eventTime = new Date(event.timestamp).getTime();
          return now - eventTime < 60000; // Храним события за последнюю минуту
        })
      );
    }, 30000); // Проверяем каждые 30 секунд

    return () => clearInterval(interval);
  }, []);

  // Получение статуса при подключении
  useEffect(() => {
    if (socketService.isConnected()) {
      getConnectionStatus();
    }
  }, [getConnectionStatus]);

  return {
    connectionStatus,
    userEvents,
    isLoading,
    error,
    getConnectionStatus,
    isConnected: socketService.isConnected(),
    isConnecting: socketService.isConnecting()
  };
}; 