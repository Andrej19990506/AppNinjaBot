import { useState, useEffect, useCallback } from 'react';
// import { useIdleTimer } from 'react-idle-timer'; // Оставляем пока закомментированным или удалим позже
import { socketService, SocketState } from '../services/socket';
import { logger } from '../utils/logger';
import { useAppSelector } from '../store/hooks'; // <-- Правильный импорт

// Убираем глобальные переменные
// let isGlobalConnecting = false;
// let connectionPromise: Promise<boolean> | null = null;
// let isSocketInitialized = false;

// Константы (если нужны)
// const ACTIVITY_TIMEOUT = 20 * 1000;

export const useWebSocketConnection = () => {
  // --- Состояние хука ---
  // Основное состояние получаем из сервиса
  const [socketState, setSocketState] = useState<SocketState>(socketService.getState());
  // Локальные состояния хука (только для UI или специфичной логики хука)
  const [isJoiningRoom, setIsJoiningRoom] =useState(false);

  // --- Получение данных из Redux ---
  const userId = useAppSelector((state) => state.user.user?.id);
  const stringUserId = userId ? String(userId) : undefined;

  // --- Главный useEffect для управления соединением ---
  useEffect(() => {
    logger.log(`🚀 [WebSocketHook] Главный useEffect. UserID: ${stringUserId}`);

    // --- Шаг 1: Инициализация сокета при появлении userId ---
    if (stringUserId && !socketService.isInitialized()) {
      logger.log(`✨ [WebSocketHook] UserID есть (${stringUserId}), сокет не инициализирован. Вызов init()...`);
      // Инициализируем сервис с userId
      socketService.init(undefined, stringUserId);
      // Сразу обновляем локальное состояние, чтобы отразить возможные изменения от init
      setSocketState(socketService.getState());
    }

    // --- Шаг 2: Подключение, если инициализирован, но не подключен ---
    // Сервис сам управляет флагом isConnecting, чтобы не было гонок
    if (socketService.isInitialized() && !socketService.isConnected() && !socketService.isConnecting()) {
      logger.log(`🔌 [WebSocketHook] Сокет инициализирован, не подключен и не подключается. Вызов connect()...`);
      socketService.connect(); // Сервис сам обработает попытку подключения
    }

    // --- Шаг 3: Подписка на ИЗМЕНЕНИЯ состояния из сервиса ---
    logger.log('👂 [WebSocketHook] Подписка на изменения состояния сокета...');
    const unsubscribeStateChange = socketService.onStateChange((newState) => {
      logger.log(`🚦 [WebSocketHook] Получено новое состояние от сервиса:`, newState);
      setSocketState(newState); // Просто обновляем состояние хука
      // Дополнительная логика при смене состояния (если нужна)
      if (!newState.isConnected) {
        setIsJoiningRoom(false); // Сбрасываем флаг входа в комнату при дисконнекте
      }
    });

    // --- Шаг 4: Очистка при размонтировании хука ---
    return () => {
      logger.log(`🧹 [WebSocketHook] Очистка главного useEffect (размонтирование?). UserID: ${stringUserId}`);
      unsubscribeStateChange(); // ОБЯЗАТЕЛЬНО отписываемся
      // Решение о disconnect принимается ВНЕ хука или на уровне всего приложения.
      // Хук не должен сам решать, когда рвать соединение.
      // socketService.disconnect(); // НЕ ЗДЕСЬ
    };
  }, [stringUserId]); // Зависит ТОЛЬКО от userId

  // --- Методы для взаимодействия с сокетом (прокси к сервису) ---
  const sendMessage = useCallback(<T = any>(event: string, data?: T) => {
    // logger.log('📤 [WebSocketHook] Отправка сообщения:', { event, data }); // Опционально для дебага
    socketService.emit(event, data);
  }, []);

  const subscribe = useCallback(<T = any>(event: string, callback: (data: T) => void): (() => void) => {
    logger.log(`📡 [WebSocketHook] Подписка на событие: ${event}`);
    // Делегируем сервису, он вернет функцию отписки
    return socketService.subscribe(event, callback);
  }, []);

  const unsubscribe = useCallback((event: string, callback?: Function) => {
    logger.log(`🧹 [WebSocketHook] Отписка от события: ${event}`);
    // У сервиса должен быть метод unsubscribe или off, который принимает колбэк для точности
    socketService.unsubscribe(event); // Или socketService.off(event, callback)
  }, []);

  // --- Вход в комнату (пример) ---
  // Может быть и в компоненте, если логика специфична
  const joinGlobalRoom = useCallback(async (userInfo: any) => {
    if (!socketService.isConnected()) {
      logger.warn('⚠️ [WebSocketHook] Попытка войти в global до подключения сокета');
      // Можно попробовать инициировать подключение, если сокет инициализирован
      if (socketService.isInitialized() && !socketService.isConnecting()) {
          logger.log('🔌 [WebSocketHook] Пытаемся подключиться перед входом в комнату...');
          socketService.connect();
          // Дальше нужно дождаться подключения, это усложняет...
          // Проще требовать, чтобы сокет уже был подключен.
          return false;
      }
      return false;
    }
    setIsJoiningRoom(true);
    logger.log('🚪 [WebSocketHook] Вход в глобальную комнату...', userInfo);
    try {
      // Используем emitWithAck из сервиса
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
          // Добавляем таймаут на ack
          setTimeout(() => {
              logger.warn('⏳ Таймаут ожидания ack для join_room');
              resolve(false);
          }, 5000); // 5 секунд
      });
      setIsJoiningRoom(false);
      return result;
    } catch (error) {
      logger.error('❌ Исключение при входе в глобальную комнату:', error);
      setIsJoiningRoom(false);
      return false;
    }
  }, []); // Зависимости? connectToServer убрали, isConnected берем из сервиса

  // --- Функции, которые больше не нужны ---
  // const connectToServer = ... // Убрали, сервис рулит
  // const handleReconnect = ... // Убрали, сервис рулит
  // const reinitializeSocket = ... // Убрали, сервис рулит

  // --- Возвращаемое API хука ---
  return {
    // Состояние соединения из сервиса
    socketState,

    // Методы для взаимодействия
    sendMessage,
    subscribe,
    unsubscribe,
    joinGlobalRoom, // Пример

    // Состояния UI
    isJoiningRoom,

    // Возможно, стоит вернуть сам userId, чтобы не дергать useAppSelector в компонентах
    userId: stringUserId,

    // Методы, которые убрали:
    // connectToServer,
    // handleReconnect,
    // reinitializeSocket,
    // lastPingTime, // Сервис сам следит
    // lastActivityTime, // Реф остался, но не возвращаем пока
    // updateLastActivity // Если idle timer используется
  };
};

// --- Исправляем линтер ---
// Убираем второй export default
// export default useWebSocketConnection;
// --- ----------------- --- 