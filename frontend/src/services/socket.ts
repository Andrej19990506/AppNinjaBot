import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

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
  | 'user_disconnected';

// Состояние сокета
export type SocketState = {
  connected: boolean;
  id?: string;
  socketId?: string;
  error?: string;
  transport?: string;
};

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
  user_away: (data: { sid: string; user_info: any }) => void;
  user_back: (data: { sid: string; user_info: any }) => void;
  user_disconnected: (data: { sid: string; reason: 'manual' | 'timeout'; user_info: any }) => void;
}

export interface ClientToServerEvents {
  join_room: (data: { room: string; user_info?: any }, callback: (response: any) => void) => void;
  leave_room: (data: { room: string }, callback: (response: any) => void) => void;
  get_room_users: (data: { room: string }) => void;
  message: (data: { text: string; room: string }) => void;
  pong: (data: { timestamp: string }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private baseReconnectDelay = 1000;
  // Отслеживание присоединенных комнат
  private joinedRooms: Set<string> = new Set();
  // Храним последний использованный URL
  private lastUsedUrl: string = 'ws://localhost/socket.io';

  // Инициализация Socket.IO
  init(wsUrl: string = 'ws://localhost/socket.io'): Socket | null {
    // Нормализуем URL, чтобы удалить возможные дублирования пути
    const normalizedUrl = wsUrl.includes('/socket.io') 
      ? wsUrl.split('/socket.io')[0] 
      : wsUrl;
    
    // Предотвращаем множественные попытки подключения
    if (this.isConnecting) {
      logger.warn('⚠️ Подключение уже в процессе');
      return this.socket;
    }

    // Возвращаем существующее подключение если оно активно
    if (this.socket?.connected) {
      logger.log('✅ Сокет уже подключен');
      return this.socket;
    }

    try {
      this.isConnecting = true;
      this.lastUsedUrl = normalizedUrl;
      logger.log('🔄 Инициализация Socket.IO:', normalizedUrl);

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
          transports: ['websocket'],
          reconnection: false, // Отключаем автоматическое переподключение
          autoConnect: false,
          forceNew: true,
          timeout: 10000,
          path: '/socket.io/',
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
        return this.socket;
      } catch (initError) {
        logger.error('❌ Ошибка при создании сокета:', initError);
        this.socket = null;
        this.isConnecting = false;
        return null;
      }
    } catch (error) {
      this.isConnecting = false;
      logger.error('❌ Ошибка при инициализации Socket.IO:', error);
      return null;
    }
  }

  // Настройка обработчиков событий
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnecting = false;
      logger.log('✅ Socket.IO подключен, id:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;
      logger.warn(`⚠️ Socket.IO отключен: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      
      // Более детальное логирование различных типов ошибок
      const errorDetails = {
        message: error.message || String(error),
        name: error.name || 'Unknown',
        stack: error.stack,
        code: (error as any).code,
        type: (error as any).type,
        description: (error as any).description,
      };
      
      logger.error('❌ Ошибка подключения Socket.IO:', errorDetails);
    });

    this.socket.on('error', (error) => {
      // Более детальное логирование различных типов ошибок
      const errorDetails = error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error;
      
      logger.error('❌ Ошибка сокета:', errorDetails);
    });

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
    this.socket.on('ping', (data: { timestamp: string }) => {
      logger.log('📍 Получен ping от сервера:', data.timestamp);
      // Немедленно отправляем pong обратно
      this.socket?.emit('pong', { 
        timestamp: data.timestamp,
        client_time: Date.now().toString()
      });
      logger.log('📍 Отправлен pong на сервер');
    });
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
    return {
      connected: this.socket?.connected || false,
      id: this.socket?.id,
      socketId: this.socket?.id,
      transport: this.socket?.io?.engine?.transport?.name,
      error: undefined
    };
  }

  public async connect(): Promise<boolean> {
    if (!this.socket) {
      logger.error('❌ Сокет не инициализирован');
      return false;
    }

    if (this.socket.connected) {
      logger.log('✅ Сокет уже подключен, повторное подключение не требуется');
      return true;
    }

    // Защита от параллельных попыток подключения
    if (this.isConnecting) {
      logger.warn('⚠️ Подключение уже в процессе, ожидаем завершения');
      // Ожидаем завершения текущей попытки (максимум 6 секунд)
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (this.socket?.connected) {
          logger.log('✅ Сокет подключился во время ожидания');
          return true;
        }
        if (!this.isConnecting) break;
      }
      
      // Если после ожидания сокет всё ещё пытается подключиться,
      // принудительно сбрасываем флаг для повторной попытки
      if (this.isConnecting) {
        logger.warn('⚠️ Сброс зависшей попытки подключения');
        this.isConnecting = false;
      }
    }

    this.isConnecting = true;
    logger.log('🔄 Начинаем подключение сокета...');

    return new Promise((resolve) => {
      if (!this.socket) {
        this.isConnecting = false;
        resolve(false);
        return;
      }

      // Устанавливаем таймаут для подключения
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.off('connect');
          this.socket.off('connect_error');
        }
        logger.error('❌ Таймаут соединения (5 секунд)');
        this.isConnecting = false;
        resolve(false);
      }, 5000);

      // Сохраняем локальную ссылку на сокет перед добавлением обработчиков
      const socket = this.socket;
      
      socket.once('connect', () => {
        clearTimeout(timeout);
        this.isConnecting = false;
        logger.log('✅ Socket.IO успешно подключен');
        resolve(true);
      });

      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        this.isConnecting = false;
        logger.error('❌ Ошибка при попытке подключения:', error);
        resolve(false);
      });

      try {
        logger.log('🔌 Вызов метода socket.connect()');
        socket.connect();
      } catch (error) {
        clearTimeout(timeout);
        this.isConnecting = false;
        logger.error('❌ Исключение при подключении:', error);
        resolve(false);
      }
    });
  }

  public disconnect(): void {
    this.isConnecting = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public on<T = any>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback);
  }

  public subscribe<T = any>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback);
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

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public async joinRoom(room: string, userInfo?: Record<string, any>): Promise<boolean> {
    if (!this.socket?.connected) {
      logger.error('❌ Попытка присоединиться к комнате при отключенном сокете');
      return false;
    }

    return new Promise((resolve) => {
      this.socket?.emit('join_room', { room, user_info: userInfo }, (response: any) => {
        if (response?.error) {
          logger.error('❌ Ошибка при присоединении к комнате:', response.error);
          resolve(false);
        } else {
          logger.log(`✅ Успешно присоединились к комнате: ${room}`);
          this.joinedRooms.add(room);
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

    return new Promise((resolve) => {
      this.socket?.emit('leave_room', { room }, (response: any) => {
        if (response?.error) {
          logger.error('❌ Ошибка при выходе из комнаты:', response.error);
          resolve(false);
        } else {
          logger.log(`✅ Успешно покинули комнату: ${room}`);
          this.joinedRooms.delete(room);
          resolve(true);
        }
      });
    });
  }

  public getRoomUsers(room: string): void {
    this.socket?.emit('get_room_users', { room });
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
}

// Создаем и экспортируем единственный экземпляр сервиса
export const socketService = new SocketService();
export default socketService; 