import { useEffect, useState, useCallback, useRef } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { socketService, SocketState } from '../services/socket';
import { logger } from '../utils/logger';

// Глобальный флаг для отслеживания текущей попытки подключения
let isGlobalConnecting = false;
let connectionPromise: Promise<boolean> | null = null;

// Для отслеживания глобального состояния инициализации
let isSocketInitialized = false;

// Константы
const ACTIVITY_TIMEOUT = 20 * 1000; // 20 секунд неактивности = away для тестирования

// Хук для работы с WebSocket
export const useWebSocketConnection = () => {
  const [socketState, setSocketState] = useState<SocketState>(socketService.getState());
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const isHookInitializedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | undefined>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const lastPingRef = useRef<number>(Date.now());
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const pongTimeoutRef = useRef<NodeJS.Timeout>();
  const [isAway, setIsAway] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Функция для инициализации сокета с гарантией
  const ensureSocketInitialized = useCallback(() => {
    if (isSocketInitialized) {
      return socketService.getSocket();
    }

    logger.log('🔄 [useWebSocketConnection] Инициализация сокета');
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost';
    const socket = socketService.init(wsUrl);
    if (socket) {
      isSocketInitialized = true;
    } else {
      logger.error('❌ [useWebSocketConnection] Не удалось инициализировать Socket.IO');
    }
    return socket;
  }, []);

  // Функция подключения с дедупликацией
  const connectToServer = useCallback(async () => {
    if (isGlobalConnecting) {
      logger.log('🔄 Ожидание существующей попытки подключения...');
      return connectionPromise;
    }

    if (socketService.isConnected()) {
      logger.log('✅ Соединение уже установлено');
      return true;
    }

    isGlobalConnecting = true;
    connectionPromise = (async () => {
      try {
        logger.log('🔄 Начало новой попытки подключения');
        const connected = await socketService.connect();
        if (connected) {
          setIsConnected(true);
          setSocketId(socketService.getSocket()?.id);
          reconnectAttemptsRef.current = 0;
          logger.log('✅ Подключение успешно установлено');
          return true;
        }
        throw new Error('Не удалось подключиться');
      } catch (error) {
        logger.error('❌ Ошибка при подключении:', error);
        return false;
      } finally {
        isGlobalConnecting = false;
        connectionPromise = null;
      }
    })();

    return connectionPromise;
  }, []);

  // Функция переподключения с экспоненциальной задержкой
  const handleReconnect = useCallback(async () => {
    if (isGlobalConnecting || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
    reconnectAttemptsRef.current++;

    logger.log(`🔄 Попытка переподключения ${reconnectAttemptsRef.current}/${maxReconnectAttempts} через ${delay}ms`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(async () => {
      await connectToServer();
    }, delay);
  }, [connectToServer]);

  // Инициализация и подключение
  useEffect(() => {
    // Предотвращаем повторную инициализацию в этом экземпляре хука
    if (isHookInitializedRef.current) {
      return;
    }
    
    isHookInitializedRef.current = true;
    logger.log('🔄 [useWebSocketConnection] Инициализация хука');
    
    // Гарантированная инициализация сокета
    const socket = ensureSocketInitialized();
    if (!socket) {
      return;
    }

    // Подписываемся на изменения состояния сокета
    const handleStateChange = () => {
      setSocketState(socketService.getState());
    };

    socket.on('connect', handleStateChange);
    socket.on('disconnect', handleStateChange);
    socket.on('connect_error', handleStateChange);
    
    const cleanup = () => {
      logger.log('🧹 [useWebSocketConnection] Очистка подписок');
      if (socket) {
        socket.off('connect', handleStateChange);
        socket.off('disconnect', handleStateChange);
        socket.off('connect_error', handleStateChange);
      }
    };

    return cleanup;
  }, [ensureSocketInitialized]);

  // Инициализация подключения
  useEffect(() => {
    logger.log('🔄 [useWebSocketConnection] Инициализация хука');
    
    const initConnection = async () => {
      await connectToServer();
    };

    initConnection();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketService.disconnect();
    };
  }, [connectToServer]);

  // Функция обновления времени последней активности
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Если пользователь был неактивен, отправляем событие возвращения
    if (isAway) {
      logger.log('👋 Пользователь вернулся к активности');
      socketService.emit('user_activity', {
        type: 'back',
        timestamp: now,
        socket_id: socketId
      });
      setIsAway(false);
    }
  }, [isAway, socketId]);

  // Обработчик неактивности
  const onIdle = () => {
    const now = Date.now();
    logger.warn('⚠️ Пользователь неактивен');
    setIsAway(true);
    socketService.emit('user_activity', {
      type: 'away',
      timestamp: now,
      socket_id: socketId,
      last_activity: lastActivityRef.current
    });
  };

  // Обработчик активности
  const onActive = () => {
    updateLastActivity();
  };

  // Инициализация IdleTimer
  useIdleTimer({
    timeout: ACTIVITY_TIMEOUT,
    onIdle,
    onActive,
    debounce: 500
  });

  // Обработка пингов
  const handlePing = useCallback((data: { timestamp: string }) => {
    lastPingRef.current = Date.now();
    
    // Отправляем в pong информацию о последней активности
    socketService.emit('pong', {
      timestamp: data.timestamp,
      client_time: Date.now().toString(),
      socket_id: socketId,
      last_activity: lastActivityRef.current,
      is_away: isAway
    });
    
    // Очищаем предыдущий таймаут pong если есть
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
    }
    
    // Отправляем pong немедленно
    socketService.emit('pong', {
      timestamp: data.timestamp,
      client_time: Date.now().toString(),
      socket_id: socketId
    });
    logger.log('📍 Отправлен pong на сервер');
    
    // Устанавливаем новый таймаут для следующего pong
    pongTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastPingRef.current > 25000) { // 25 секунд без пинга
        logger.warn('⚠️ Длительное отсутствие пингов от сервера');
        handleReconnect();
      }
    }, 30000); // 30 секунд максимальное ожидание
  }, [socketId, handleReconnect, isAway]);

  // Отправка keepalive пингов
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (socketService.isConnected()) {
        socketService.emit('ping', {
          timestamp: Date.now().toString(),
          client_time: Date.now().toString(),
          socket_id: socketId
        });
      }
    }, 15000); // Отправляем ping каждые 15 секунд
  }, [socketId]);

  // Обновляем эффект мониторинга состояния подключения
  useEffect(() => {
    const handleDisconnect = () => {
      setIsConnected(false);
      // Очищаем интервалы при отключении
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
      }
      handleReconnect();
    };

    const handleConnect = () => {
      setIsConnected(true);
      setIsAway(false); // Сбрасываем состояние away при подключении
      startPingInterval(); // Запускаем пинги при подключении
    };

    const handleAway = (data: { sid: string; user_info: any }) => {
      if (data.sid === socketId) {
        setIsAway(true);
        logger.warn('⚠️ Сервер отметил клиента как отошедший');
      }
    };

    const handleBack = (data: { sid: string; user_info: any }) => {
      if (data.sid === socketId) {
        setIsAway(false);
        logger.log('✅ Клиент снова активен');
      }
    };

    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleDisconnect);
    socketService.on('connect', handleConnect);
    socketService.on('ping', handlePing);
    socketService.on('user_away', handleAway);
    socketService.on('user_back', handleBack);

    // Запускаем пинги если уже подключены
    if (socketService.isConnected()) {
      startPingInterval();
    }

    return () => {
      socketService.off('disconnect');
      socketService.off('connect_error');
      socketService.off('connect');
      socketService.off('ping');
      socketService.off('user_away');
      socketService.off('user_back');
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
      }
    };
  }, [handleReconnect, startPingInterval, handlePing, socketId]);

  // Подключение к глобальной комнате
  const joinGlobalRoom = useCallback(async (userInfo?: { first_name?: string; last_name?: string }) => {
    if (isJoiningRoom) {
      logger.warn('🚫 [useWebSocketConnection] Уже идет процесс подключения к комнате');
      return false;
    }
    
    try {
      setIsJoiningRoom(true);
      
      // Проверяем текущее состояние подключения
      const state = socketService.getState();
      logger.log('🔄 [useWebSocketConnection] Начало процесса присоединения к комнате:', {
        room: 'global',
        userInfo,
        socketId: state.socketId,
        connected: state.connected,
        transport: state.transport,
        timestamp: new Date().toISOString()
      });

      // Если нет подключения, пытаемся подключиться
      if (!socketService.isConnected()) {
        const connected = await connectToServer();
        if (!connected) {
          throw new Error('Не удалось установить WebSocket соединение после нескольких попыток');
        }
      }

      // Проверяем подключение еще раз перед присоединением к комнате
      if (!socketService.isConnected()) {
        throw new Error('Соединение потеряно перед присоединением к комнате');
      }

      // Подключаемся к комнате
      logger.log('🚪 [useWebSocketConnection] Подключаемся к глобальной комнате...');
      const result = await socketService.joinRoom('global', userInfo);
      
      if (result) {
        logger.log('✅ [useWebSocketConnection] Успешно подключились к глобальной комнате');
      } else {
        throw new Error('Не удалось подключиться к глобальной комнате');
      }
      
      return result;
    } catch (error) {
      logger.error('❌ [useWebSocketConnection] Ошибка при подключении к глобальной комнате:', error);
      return false;
    } finally {
      setIsJoiningRoom(false);
    }
  }, [isJoiningRoom, connectToServer]);

  // Функция для принудительной инициализации сокета (в случае проблем)
  const reinitializeSocket = useCallback(() => {
    logger.log('🔄 [useWebSocketConnection] Принудительная реинициализация сокета');
    isSocketInitialized = false;
    socketService.disconnect();
    return ensureSocketInitialized();
  }, [ensureSocketInitialized]);

  // Отправка сообщения
  const sendMessage = useCallback(<T = any>(event: string, data?: T) => {
    logger.log('📤 [useWebSocketConnection] Отправка сообщения:', { event, data });
    socketService.emit(event, data);
  }, []);

  // Подписка на события
  const subscribe = useCallback(<T = any>(event: string, callback: (data: T) => void) => {
    logger.log('📡 [useWebSocketConnection] Подписка на событие:', event);
    socketService.on(event, callback);
    return () => {
      logger.log('🧹 [useWebSocketConnection] Отписка от события:', event);
      socketService.off(event);
    };
  }, []);

  return {
    isConnected,
    socketId,
    transport: socketState.transport,
    error: socketState.error,
    connectToServer,
    reinitializeSocket,
    sendMessage,
    subscribe,
    unsubscribe: (event: string) => {
      logger.log('🧹 [useWebSocketConnection] Отписка от события:', event);
      socketService.unsubscribe(event);
    },
    joinGlobalRoom,
    isJoiningRoom,
    handleReconnect,
    isAway,
    lastPingTime: lastPingRef.current,
    lastActivityTime: lastActivityRef.current,
    updateLastActivity
  };
};

export default useWebSocketConnection; 