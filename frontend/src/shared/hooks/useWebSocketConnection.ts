import { useState, useEffect, useCallback } from 'react';
import { socketService, SocketState } from '../services/socketService';
import { logger } from '../utils/logger';
import { useAppSelector } from '../store/hooks';

// --- useWebSocketConnection ---
// Хук для инициализации и управления WebSocket соединением через socketService.
// Удобен для компонентов, которым нужно слушать события или отправлять сообщения через сокет.

export const useWebSocketConnection = () => {

  const [socketState, setSocketState] = useState<SocketState>(socketService.getState());
  const [isJoiningRoom, setIsJoiningRoom] =useState(false);


  const userId = useAppSelector((state) => state.user.user?.id);
  const stringUserId = userId ? String(userId) : undefined;
  const initError = useAppSelector((state) => state.user.error);
  
  // Проверяем, есть ли ошибка сервера
  const isServerError = initError && (
    initError.includes('Сервер недоступен') ||
    initError.includes('Timeout: сервер не отвечает') ||
    initError.includes('Network Error: сервер недоступен') ||
    initError.includes('Failed to fetch: сервер недоступен') ||
    initError.includes('Критическая ошибка проверки сервера') ||
    initError.includes('Network Error') ||
    initError.includes('ERR_CONNECTION_REFUSED')
  );

  useEffect(() => {
    logger.log(`🚀 [WebSocketHook] Главный useEffect. UserID: ${stringUserId}, isServerError: ${isServerError}`);

    // Не подключаемся к WebSocket при ошибках сервера
    if (isServerError) {
      logger.log(`❌ [WebSocketHook] Обнаружена ошибка сервера, пропускаем подключение WebSocket`);
      return;
    }

    if (stringUserId && !socketService.isInitialized()) {
      logger.log(`✨ [WebSocketHook] UserID есть (${stringUserId}), сокет не инициализирован. Вызов init()...`);
      // Используем URL из конфига или переменных окружения
      const wsUrl = (window as any).APP_CONFIG?.WS_URL || import.meta.env.VITE_WS_URL || 'ws://localhost:8001';
      socketService.init(wsUrl, stringUserId);
      setSocketState(socketService.getState());
    }

    if (socketService.isInitialized() && !socketService.isConnected() && !socketService.isConnecting()) {
      logger.log(`🔌 [WebSocketHook] Сокет инициализирован, не подключен и не подключается. Вызов connect()...`);
      socketService.connect();
    }

    logger.log('👂 [WebSocketHook] Подписка на изменения состояния сокета...');
    const unsubscribeStateChange = socketService.onStateChange((newState) => {
      logger.log(`🚦 [WebSocketHook] Получено новое состояние от сервиса:`, newState);
      setSocketState(newState);

      if (!newState.isConnected) {
        setIsJoiningRoom(false);
      }
    });

    return () => {
      logger.log(`🧹 [WebSocketHook] Очистка главного useEffect (размонтирование?). UserID: ${stringUserId}`);
      unsubscribeStateChange();
      // Не отключаем сокет при размонтировании, так как он может использоваться другими компонентами
      // socketService.disconnect();
    };
  }, [stringUserId]);

  const sendMessage = useCallback(<T = any>(event: string, data?: T) => {
    socketService.emit(event, data);
  }, []);

  const subscribe = useCallback(<T = any>(event: string, callback: (data: T) => void): (() => void) => {
    logger.log(`📡 [WebSocketHook] Подписка на событие: ${event}`);
    return socketService.subscribe(event, callback);
  }, []);

  const unsubscribe = useCallback((event: string, callback?: Function) => {
    logger.log(`🧹 [WebSocketHook] Отписка от события: ${event}`);
    socketService.unsubscribe(event);
  }, []);

  const joinGlobalRoom = useCallback(async (userInfo: any) => {
    if (!socketService.isConnected()) {
      logger.warn('⚠️ [WebSocketHook] Попытка войти в global до подключения сокета');
      if (socketService.isInitialized() && !socketService.isConnecting()) {
          logger.log('🔌 [WebSocketHook] Пытаемся подключиться перед входом в комнату...');
          socketService.connect();
          return false;
      }
      return false;
    }
    setIsJoiningRoom(true);
    logger.log('🚪 [WebSocketHook] Вход в глобальную комнату...', userInfo);
    try {
      const result = await new Promise<boolean>((resolve) => {
          socketService.emitWithAck<{ room: string; user_info: any }, { status?: string; error?: string }>(
              'join_room',
              { room: 'global', user_info: userInfo },
              (response) => {
                  if (response?.status === 'success' || !response?.error) {
                      logger.log('✅ Успешно вошли в глобальную комнату (ack)');
                      resolve(true);
                  } else {
                      logger.error('❌ Ошибка при входе в глобальную комнату (ack):', response?.error);
                      resolve(false);
                  }
              }
          );
          setTimeout(() => {
              logger.warn('⏳ Таймаут ожидания ack для join_room');
              resolve(false);
          }, 5000);
      });
      setIsJoiningRoom(false);
      return result;
    } catch (error) {
      logger.error('❌ Исключение при входе в глобальную комнату:', error);
      setIsJoiningRoom(false);
      return false;
    }
  }, []);


  return {
    socketState,
    sendMessage,
    subscribe,
    unsubscribe,
    joinGlobalRoom,
    isJoiningRoom,
    userId: stringUserId,
  };
};
