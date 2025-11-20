/// <reference types="vite/client" />
import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import EventEmitter from 'eventemitter3';

// Базовые типы событий
export type SocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'connect_error'
  | 'message'
  | 'users_list'
  | 'room_joined'
  | 'room_left'
  | 'room_users'
  | 'room_users_update'
  | 'user_joined'
  | 'writeoff_created'
  | 'writeoff_updated'
  | 'writeoff_deleted'
  | 'ping'
  | 'pong'
  | 'user_away'
  | 'user_back'
  | 'user_disconnected'
  | 'user_activity_update'
  | 'REGISTRATION_OPENED'
  | 'inventory_updated'
  | 'inventory_reset'
  | 'template_updated';

// Состояние сокета
export interface SocketState {
  isConnected: boolean;
  isConnecting: boolean;
  socketId: string | null;
  transport: string | null;
  error: string | null;
}

// Типы событий Socket.io
export interface ServerToClientEvents {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  message: (data: { text: string; room: string; user?: any }) => void;
  users_list: (data: any[]) => void;
  room_joined: (data: { room: string; status: string }) => void;
  room_left: (data: { room: string }) => void;
  room_users: (data: { room: string; users: any[] }) => void;
  room_users_update: (data: { room: string; users: any[] }) => void;
  user_joined: (data: { room: string; user: any }) => void;
  ping: (data: { timestamp: string }) => void;
  user_away: (data: { sid: string; user_info: any; room: string }) => void;
  user_back: (data: { sid: string; user_info: any; room: string }) => void;
  user_disconnected: (data: { sid: string; reason: 'manual' | 'timeout'; user_info: any; room: string }) => void;
  user_activity_update: (data: { sid: string; user_id: string; user_info: any; timestamp: string; activity_state: string; room: string }) => void;
  inventory_updated: (data: any) => void;
  inventory_reset: (data: any) => void;
  template_updated: (data: any) => void;
  item_editing_update: (data: { chat_id: string; category: string; item_id: string; editing: boolean; sid: string; user_info?: any; timestamp: string }) => void;
  bot_auth_token: (data: { token: string; session_id: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (data: { room: string; user_info?: any }, callback: (response: any) => void) => void;
  leave_room: (data: { room: string }, callback: (response: any) => void) => void;
  get_room_users: (data: { room: string }) => void;
  message: (data: { text: string; room: string }) => void;
  pong: (data: { timestamp: string }) => void;
  user_activity: (data: { timestamp: number; type: string }) => void;
  user_inactive: (data: { timestamp: number; type: string }) => void;
  item_editing: (data: { chat_id: string; category: string; item_id: string; editing: boolean; user_info?: any }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private state: SocketState = {
    isConnected: false,
    isConnecting: false,
    socketId: null,
    transport: null,
    error: null,
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private lastUsedUrl = 'ws://localhost:8001';

  // Дедупликация событий по event_id
  private processedEvents: Map<string, number> = new Map();
  private static EVENT_TTL_MS = 120000; // 2 минуты
  private static MAX_EVENTS = 5000;

  private shouldProcessEvent(eventId?: string): boolean {
    if (!eventId) return true;
    const now = Date.now();
    // cleanup
    this.processedEvents.forEach((ts, id) => {
      if (now - ts > SocketService.EVENT_TTL_MS) {
        this.processedEvents.delete(id);
      }
    });
    if (this.processedEvents.size > SocketService.MAX_EVENTS) {
      this.processedEvents.clear();
    }
    if (this.processedEvents.has(eventId)) return false;
    this.processedEvents.set(eventId, now);
    return true;
  }

  // Эмиттер для событий изменения состояния
  private stateChangeEmitter = new EventEmitter();

  // Инициализация Socket.IO
  init(wsUrl: string = import.meta.env.VITE_WS_URL || 'ws://localhost/socket.io', userId?: number | string): Socket | null {
    // Нормализуем URL, чтобы удалить возможные дублирования пути
    const normalizedUrl = wsUrl.includes('/socket.io') 
      ? wsUrl.split('/socket.io')[0] 
      : wsUrl;
    
    // Предотвращаем множественные попытки подключения
    if (this.state.isConnecting) {
      logger.warn('⚠️ Подключение уже в процессе');
      return this.socket;
    }

    // Возвращаем существующее подключение если оно активно
    if (this.socket?.connected && this.lastUsedUrl === normalizedUrl) {
      logger.log('✅ Сокет уже подключен к этому URL');
      return this.socket;
    }

    try {
      this.lastUsedUrl = normalizedUrl;
      logger.log('🔄 Инициализация Socket.IO:', normalizedUrl, `для User ID: ${userId ?? 'N/A'}`);

      // Отключаем предыдущий сокет если есть
      if (this.socket) {
        logger.log('🧹 Очищаем существующий сокет перед новым подключением');
        try {
          this.socket.removeAllListeners();
          this.socket.disconnect();
        } catch (e) {
          logger.error('❌ Ошибка при очистке старого сокета:', e);
        }
        this.socket = null;
      }

      logger.log('🛠️ Создаем новый экземпляр Socket.IO');
      try {
        // Попробуем создать сокет с более простой конфигурацией
        this.socket = io(normalizedUrl, {
          transports: ['polling', 'websocket'],
          reconnection: true,
          autoConnect: false,
          forceNew: true,
          timeout: 10000,
          path: '/socket.io/',
          auth: { userId: userId ? String(userId) : undefined }
        });

        if (!this.socket) {
          throw new Error('Не удалось создать объект сокета');
        }

        // Логируем детали сокета после создания
        logger.log('🔍 Детали сокета после создания:', {
          id: this.socket.id,
          connected: this.socket.connected,
          disconnected: this.socket.disconnected,
          engine: !!this.socket.io?.engine
        });

        this.setupEventHandlers();
        logger.log('✅ Socket.IO инициализирован успешно, id:', this.socket.id);
        logger.log('[socketService] init() завершен. Сокет готов к connect().');
        return this.socket;
      } catch (initError) {
        logger.error('❌ Ошибка при создании сокета:', initError);
        this.socket = null;
        this.state.isConnecting = false;
        return null;
      }
    } catch (error) {
      logger.error('[socketService] КРИТИЧЕСКАЯ ОШИБКА в init():', error);
      // При ошибке в init сбрасываем флаги
      this.updateState({ isConnecting: false, isConnected: false, error: error instanceof Error ? error.message : String(error) });
      this.socket = null;
      return null;
    }
  }

  // Настройка обработчиков событий
  private setupEventHandlers(): void {
    if (!this.socket) return;
    // Событие индикатора редактирования
    this.socket.on('item_editing_update', (data: any) => {
      logger.info('✏️ Получено событие: item_editing_update', data);
      this.stateChangeEmitter.emit('item_editing_update', data);
    });

    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectError);
    this.socket.on('error', this.handleGenericError);

    // Обработка системных сообщений
    this.socket.on('message', (data: any) => {
      if (data.isSystem) {
        logger.log('📢 Системное сообщение:', data.data);
      }
    });

    // Добавляем отслеживание состояния подключения
    this.socket.io.on("reconnect_attempt", (attempt) => {
      logger.log(`🔄 Попытка переподключения #${attempt}`);
      
      // Принудительно устанавливаем WebSocket в качестве транспорта при переподключении
      if (this.socket && this.socket.io && this.socket.io.opts) {
        this.socket.io.opts.transports = ['websocket'];
        logger.log('🔄 Принудительно устанавливаем WebSocket при переподключении');
      }
    });

    this.socket.io.on("reconnect", (attempt) => {
      logger.log(`✅ Успешное переподключение после ${attempt} попыток`);
    });

    this.socket.io.on("reconnect_error", (error) => {
      logger.error('❌ Ошибка переподключения:', error);
    });

    this.socket.io.on("reconnect_failed", () => {
      logger.error('❌ Все попытки переподключения исчерпаны');
    });
    
    // Вызываем также установку обработчиков Engine.IO
    this.setupEngineHandlers();
    
    // Добавляем обработчик для отладки первого handshake
    if (this.socket.io?.engine) {
      this.socket.io.engine.on('handshake', (data: any) => {
        logger.log('🤝 Socket.IO handshake:', {
          sid: data.sid,
          upgrades: data.upgrades,
          pingInterval: data.pingInterval,
          pingTimeout: data.pingTimeout
        });
      });
    }

    // Добавляем обработчик ping событий
    this.socket.on('ping', (data: { timestamp: string; ping_id?: number }) => {
      logger.log('📍 Получен ping от сервера:', data);
      // Немедленно отправляем pong обратно с дополнительной информацией
      this.socket?.emit('pong', { 
        ping_timestamp: data.timestamp, // Используем ping_timestamp как ожидает сервер
        ping_id: data.ping_id,
        client_time: Date.now().toString(),
        client_timestamp: new Date().toISOString()
      });
      logger.log('📍 Отправлен pong на сервер');
    });

    // Добавляем новый обработчик
    this.socket.on('REGISTRATION_OPENED', (data: any) => {
      logger.info('📬 Получено событие: REGISTRATION_OPENED', data);
      // TODO: Здесь нужно диспатчить Redux action для обновления UI
      // Например: store.dispatch(registrationOpened(data));
      // Или использовать event emitter, если store недоступен напрямую:
      // this.stateChangeEmitter.emit('registrationOpened', data);
    });

    // Добавляем обработчик user_activity_update
    this.socket.on('user_activity_update', (data: any) => {
      logger.info('👤 Получено событие: user_activity_update', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('user_activity_update', data);
    });

    // Добавляем обработчик user_away
    this.socket.on('user_away', (data: any) => {
      logger.info('👤 Получено событие: user_away', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('user_away', data);
    });

    // Добавляем обработчик user_back
    this.socket.on('user_back', (data: any) => {
      logger.info('👤 Получено событие: user_back', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('user_back', data);
    });

    // Индикатор фокуса категории
    this.socket.on('category_focus_update', (data: any) => {
      logger.info('📂 Получено событие: category_focus_update', data);
      this.stateChangeEmitter.emit('category_focus_update', data);
    });

    // Добавляем обработчик room_users_list
    this.socket.on('room_users_list', (data: any) => {
      logger.info('👥 Получено событие: room_users_list', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('room_users_list', data);
    });

    // Добавляем обработчик user_joined_room
    this.socket.on('user_joined_room', (data: any) => {
      logger.info('👤 Получено событие: user_joined_room', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('user_joined_room', data);
    });

    // Добавляем обработчик user_left_room
    this.socket.on('user_left_room', (data: any) => {
      logger.info('👤 Получено событие: user_left_room', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('user_left_room', data);
    });

    // Добавляем обработчик connection_status
    this.socket.on('connection_status', (data: any) => {
      logger.info('📊 Получено событие: connection_status', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('connection_status', data);
    });

    // Добавляем обработчик bot_auth_token для авторизации через бота
    this.socket.on('bot_auth_token', (data: { token: string; session_id: string }) => {
      logger.info('🔐 [Auth] Получено событие: bot_auth_token', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('bot_auth_token', data);
    });

    // Добавляем обработчик inventory_updated c дедупликацией
    this.socket.on('inventory_updated', (data: any) => {
      logger.info('📦 Получено событие: inventory_updated', data);
      if (!this.shouldProcessEvent(data?.event_id)) {
        logger.info('🧹 Дубликат inventory_updated отброшен:', data?.event_id);
        return;
      }
      this.stateChangeEmitter.emit('inventory_updated', data);
    });

    // Добавляем обработчик inventory_reset c дедупликацией
    this.socket.on('inventory_reset', (data: any) => {
      logger.info('🔄 Получено событие: inventory_reset', data);
      if (!this.shouldProcessEvent(data?.event_id)) {
        logger.info('🧹 Дубликат inventory_reset отброшен:', data?.event_id);
        return;
      }
      this.stateChangeEmitter.emit('inventory_reset', data);
    });

    // Добавляем обработчик template_updated
    this.socket.on('template_updated', (data: any) => {
      logger.info('📝 Получено событие: template_updated', data);
      // Эмитим событие для подписчиков
      this.stateChangeEmitter.emit('template_updated', data);
    });

    // Глобальный лог всех событий
    this.socket.onAny((event, ...args) => {
      logger.log(`[SOCKET][onAny] Событие: ${event}`, ...args);
    });
  }

  // Подписка на фокус категории
  public onCategoryFocusUpdate(callback: (data: any) => void): () => void {
    if (!this.socket) {
      logger.warn('[socketService] Подписка category_focus_update до инициализации сокета');
    }
    const handler = (data: any) => callback(data);
    this.stateChangeEmitter.on('category_focus_update', handler);
    return () => {
      this.stateChangeEmitter.off('category_focus_update', handler);
    };
  }

  // Новый метод для настройки обработчиков Engine.IO
  private setupEngineHandlers(): void {
    if (!this.socket?.io?.engine) return;

    this.socket.io.engine.on('upgrading', () => {
      const transport = this.socket?.io.engine.transport;
      logger.log('🔄 Начало upgrade транспорта:', {
        current: transport?.name
      });
    });

    this.socket.io.engine.on('upgrade', () => {
      const transport = this.socket?.io.engine.transport;
      logger.log('🔄 Upgrade успешен, новый транспорт:', {
        name: transport?.name
      });
    });

    this.socket.io.engine.on('upgradeError', (err) => {
      logger.error('❌ Ошибка при upgrade транспорта:', err);
    });

    // Отслеживаем изменение транспорта через ping/pong
    this.socket.io.engine.on('packet', (packet: any) => {
      if (packet.type === 'ping' || packet.type === 'pong') {
        const transport = this.socket?.io.engine.transport;
        logger.log(`📡 Транспорт при ${packet.type}:`, {
          name: transport?.name
        });
      }
    });
  }

  // Публичные методы
  public getSocket(): Socket | null {
    return this.socket;
  }

  public getState(): SocketState {
    return { ...this.state };
  }

  // --- Подписка на изменение состояния ---
  public onStateChange(listener: (state: SocketState) => void): () => void {
    this.stateChangeEmitter.on('change', listener);
    // Возвращаем функцию отписки
    return () => {
      this.stateChangeEmitter.off('change', listener);
    };
  }

  public offStateChange(listener: (state: SocketState) => void): void {
    this.stateChangeEmitter.off('change', listener);
  }

  // --- Геттеры состояния ---
  public isConnected(): boolean {
    return this.state.isConnected;
  }

  // Публичный геттер для isConnecting
  public isConnecting(): boolean {
    return this.state.isConnecting;
  }

  // --- Управление подключением ---
  public connect(): void {
    if (!this.socket) {
      logger.error('❌ Попытка подключения неинициализированного сокета');
      return;
    }
    if (this.state.isConnected || this.state.isConnecting) {
      logger.warn('⚠️ Сокет уже подключен или подключается');
      return;
    }

    logger.log('[socketService] Вызов connect()');
    this.updateState({ isConnecting: true, error: null });
    logger.log('[socketService] connect(): Установка isConnecting = true и вызов this.socket.connect()...');
    
    this.clearConnectionTimeout();

    this.connectionTimeout = setTimeout(() => {
      if (this.state.isConnecting && !this.state.isConnected) {
        logger.error('❌ Таймаут подключения Socket.IO');
        this.handleConnectError(new Error('Connection timeout'));
      }
    }, 15000);

    try {
        this.socket.connect();
        logger.log('[socketService] connect(): this.socket.connect() вызван успешно.');
    } catch (error) {
        logger.error('❌ Ошибка при вызове this.socket.connect():', error);
        this.handleConnectError(error instanceof Error ? error : new Error('Connect call failed'));
    }
  }

  private handleConnect = () => {
    if (!this.socket) return;
    logger.log(`✅ [socketService:handleConnect] Socket.IO подключен! ID: ${this.socket.id}, Transport: ${this.socket.io.engine.transport.name}`);
    this.clearConnectionTimeout();
    this.reconnectAttempts = 0;
    this.updateState({
      isConnected: true,
      isConnecting: false,
      socketId: this.socket.id,
      transport: this.socket.io.engine.transport.name,
      error: null,
    });
  };

  private handleDisconnect = (reason: Socket.DisconnectReason | string) => {
    logger.warn(`🔌 [socketService:handleDisconnect] Socket.IO отключен. Причина: ${reason}`);
    this.clearConnectionTimeout();
    this.updateState({
      isConnected: false,
      isConnecting: false,
      socketId: null,
      transport: null,
      error: (reason === 'io server disconnect' || reason === 'transport error' || reason === 'transport close') ? String(reason) : null 
    });
  };

  private handleConnectError = (error: Error) => {
    const errorDetails = {
        message: error.message || String(error),
        name: error.name || 'Unknown',
        code: (error as any).code,
        type: (error as any).type,
        description: (error as any).description,
      };
    logger.error('❌ [socketService:handleConnectError] Ошибка подключения Socket.IO:', errorDetails);
    this.clearConnectionTimeout();
    this.updateState({
      isConnected: false,
      isConnecting: false,
      error: error.message || 'Connection Error',
    });
  };

  private handleGenericError = (error: Error) => {
      const errorDetails = error instanceof Error ? {
        message: error.message,
        name: error.name,
      } : error;
      logger.error('❌ [socketService:handleGenericError] Общая ошибка сокета:', errorDetails);
      this.updateState({ error: error.message || 'Socket Error' });
  };

  private clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private updateState(newState: Partial<SocketState>) {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...newState };
    logger.log('🚦 SocketService: State updated', this.state);
    if (JSON.stringify(previousState) !== JSON.stringify(this.state)) {
       logger.log('📢 SocketService: Emitting state change');
       this.stateChangeEmitter.emit('change', this.state);
    } else {
       logger.log('💤 SocketService: State did not change, not emitting.');
    }
  }

  public disconnect(): void {
    logger.log('[socketService] disconnect() вызван');
    this.state.isConnecting = false;
    
    // Очищаем таймаут подключения, если он есть
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (error) {
        logger.warn('[socketService] Ошибка при отключении сокета:', error);
      }
      this.socket = null;
    }
    
    // Полностью сбрасываем состояние
    this.state = {
      isConnected: false,
      isConnecting: false,
      socketId: null,
      transport: null,
      error: null,
    };
    
    // Сбрасываем счетчик попыток переподключения
    this.reconnectAttempts = 0;
    
    // Очищаем все подписки на события
    this.stateChangeEmitter.removeAllListeners();
    
    // Очищаем кэш обработанных событий
    this.processedEvents.clear();
    
    // Уведомляем об изменении состояния
    this.stateChangeEmitter.emit('change', this.state);
    
    logger.log('[socketService] disconnect() завершен, состояние сброшено');
  }
  
  /**
   * Полный сброс сервиса (для логаута)
   */
  public reset(): void {
    logger.log('[socketService] reset() вызван - полный сброс сервиса');
    this.disconnect();
    this.lastUsedUrl = 'ws://localhost:8001';
    logger.log('[socketService] reset() завершен');
  }

  public on<T = any>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback);
  }

  public subscribe<T = any>(event: string, callback: (data: T) => void): () => void {
    if (!this.socket) {
      logger.warn(`[socketService] Попытка подписки (${event}) до инициализации сокета`);
      // Возвращаем пустую функцию-заглушку
      return () => { logger.warn(`[socketService] Отписка (${event}) от неинициализированного сокета`); };
    }
    logger.log(`[socketService] Подписка на событие: ${event}`);
    
    // Используем stateChangeEmitter для подписки на события
    this.stateChangeEmitter.on(event, callback);
    
    // Возвращаем функцию для отписки
    const unsubscribe = () => {
      logger.log(`[socketService] Отписка от события: ${event}`);
      this.stateChangeEmitter.off(event, callback);
    };
    return unsubscribe;
  }

  public off(event: string): void {
    this.socket?.off(event);
  }

  public unsubscribe(event: string): void {
    this.socket?.off(event);
  }

  public emit<T = any>(event: string, data?: T): void {
    this.socket?.emit(event, data);
  }

  public emitWithAck<T = any, R = any>(
    event: string, 
    data: T, 
    callback: (response: R) => void
  ): void {
    this.socket?.emit(event, data, callback);
  }

  public async joinRoom(room: string, userInfo?: Record<string, any>): Promise<boolean> {
    logger.log(`🚪 [joinRoom] Попытка присоединиться к комнате: ${room}`);
    logger.log(`🚪 [joinRoom] Состояние сокета: connected=${this.socket?.connected}, socket=${!!this.socket}`);
    
    if (!this.socket?.connected) {
      logger.error('❌ [joinRoom] Попытка присоединиться к комнате при отключенном сокете');
      return false;
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      // Таймаут для ответа (создаем ДО emit, чтобы можно было очистить)
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          logger.warn(`⏱️ [joinRoom] Таймаут ожидания ответа для комнаты: ${room}`);
          resolve(false);
        }
      }, 5000);
      
      logger.log(`🚪 [joinRoom] Отправляем событие join_room для комнаты: ${room}`, { userInfo });
      this.socket?.emit('join_room', { room, user_info: userInfo }, (response: any) => {
        if (resolved) return; // Предотвращаем двойной resolve
        resolved = true;
        clearTimeout(timeoutId); // Очищаем таймаут при получении ответа
        
        logger.log(`🚪 [joinRoom] Получен ответ от сервера:`, response);
        if (response?.error) {
          logger.error('❌ [joinRoom] Ошибка при присоединении к комнате:', response.error);
          resolve(false);
        } else {
          logger.log(`✅ [joinRoom] Успешно присоединились к комнате: ${room}`);
          this.updateState({ isConnected: true });
          resolve(true);
        }
      });
    });
  }

  public async leaveRoom(room: string): Promise<boolean> {
    if (!this.socket?.connected) {
      logger.error('❌ Попытка покинуть комнату при отключенном сокете');
      return false;
    }

    const socket = this.socket;

    return new Promise((resolve) => {
      logger.log(`🚪 Попытка покинуть комнату: ${room}`);
      try {
        socket.emit('leave_room', room, (response: any) => {
          if (response && response.status === 'success') {
            logger.log(`✅ Успешно покинули комнату: ${room}`);
            resolve(true);
          } else {
            logger.error('❌ Ошибка при выходе из комнаты:', response);
            resolve(false);
          }
        });
      } catch (error) {
        logger.error('❌ Ошибка при выходе из комнаты:', error);
        resolve(false);
      }
    });
  }

  public getRoomUsers(room: string): void {
    this.socket?.emit('get_room_users', { room });
  }

  // Новые методы для работы с состоянием подключения
  public getConnectionStatus(): void {
    this.socket?.emit('get_connection_status', {});
  }

  public onConnectionStatus(callback: (status: any) => void): () => void {
    return this.subscribe('connection_status', callback);
  }

  public onUserAway(callback: (data: any) => void): () => void {
    return this.subscribe('user_away', callback);
  }

  public onUserBack(callback: (data: any) => void): () => void {
    return this.subscribe('user_back', callback);
  }

  public onUserDisconnected(callback: (data: any) => void): () => void {
    return this.subscribe('user_disconnected', callback);
  }

  public onUserActivityUpdate(callback: (data: any) => void): () => void {
    return this.subscribe('user_activity_update', callback);
  }

  // Подписка на индикатор редактирования
  public onItemEditingUpdate(callback: (data: any) => void): () => void {
    return this.subscribe('item_editing_update', callback);
  }

  // Тестирование соединения
  async testConnection(): Promise<boolean> {
    if (!this.socket?.connected) {
      logger.warn('⚠️ Сокет не подключен');
      return false;
    }

    const socket = this.socket; // Сохраняем ссылку на сокет
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.error('❌ Таймаут эхо-теста');
        resolve(false);
      }, 5000);

      socket.emit('echo', { test: true, timestamp: Date.now() }, (response: any) => {
        clearTimeout(timeout);
        if (response?.status === 'success') {
          logger.log('✅ Эхо-тест успешен:', response);
          resolve(true);
        } else {
          logger.error('❌ Эхо-тест неуспешен:', response);
          resolve(false);
        }
      });
    });
  }

  // Метод для подписки на все события сокета (для отладки)
  debugAllEvents(): void {
    if (!this.socket) {
      logger.error('❌ Невозможно отслеживать события: сокет не инициализирован');
      return;
    }
    
    logger.log('🔍 Включаем отладку всех событий Socket.IO');
    
    // Обычные события сокета
    const commonEvents = [
      'connect', 'disconnect', 'connect_error', 'error', 'message',
      'users_list', 'room_joined', 'room_left', 'room_users', 'user_joined', 
      'room_users_update'
    ];
    
    commonEvents.forEach(event => {
      this.socket?.on(event as any, (data: any) => {
        logger.log(`🔄 [DEBUG] Событие ${event}:`, data);
      });
    });
    
    // События Engine.IO
    if (this.socket.io?.engine) {
      const engineEvents = [
        'open', 'close', 'packet', 'error', 'upgrade', 'upgradeError'
      ];
      
      engineEvents.forEach(event => {
        this.socket?.io?.engine?.on(event as any, (...args: any[]) => {
          logger.log(`🔧 [DEBUG] Engine событие ${event}:`, args);
        });
      });
    }
    
    logger.log('✅ Отладка событий включена');
  }

  // Добавляем метод для получения последнего использованного URL
  public getLastUsedUrl(): string {
    return this.lastUsedUrl;
  }

  // Новый метод для проверки инициализации
  public isInitialized(): boolean {
    return !!this.socket;
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
export const socketService = new SocketService();
export default socketService; 