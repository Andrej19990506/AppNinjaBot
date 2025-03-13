import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types';
import config from '../config';

interface QueuedMessage {
    eventType: string;
    data: any;
    attempts: number;
}

class SocketService {
    private socket: Socket | null = null;
    private static instance: SocketService;
    private connectionPromise: Promise<boolean> | null = null;
    private messageQueue: QueuedMessage[] = [];
    private maxRetryAttempts = 3;
    private isConnecting: boolean = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = config.SOCKET_CONFIG?.reconnectionAttempts || 5;

    private constructor() {}

    static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    connect(): Promise<boolean> {
        // Если уже подключены, сразу возвращаем успешное обещание
        if (this.socket?.connected) {
            console.log('🔌 Socket.IO уже подключен, ID:', this.socket.id);
            return Promise.resolve(true);
        }

        // Если уже идет процесс подключения, возвращаем текущее обещание
        if (this.isConnecting && this.connectionPromise) {
            console.log('🔄 Socket.IO подключение уже в процессе...');
            return this.connectionPromise;
        }

        // Сбрасываем таймер переподключения, если он был запущен
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve) => {
            const wsUrl = new URL(config.WS_URL);
            
            console.log(`🔌 Попытка соединения с WebSocket ${wsUrl.toString()}`);
            
            // Очищаем предыдущее соединение если оно есть
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
            }
            
            // Более гибкая обработка различных форматов URL
            let socketUrl = '';
            let socketPath = '';
            
            // Корректное формирование URL и пути для работы с сервером Flask-SocketIO
            socketUrl = wsUrl.origin;
            socketPath = '/ws/socket.io'; // Явно указываем полный путь, используемый на сервере
            
            console.log(`🔧 Инициализируем Socket.IO:`);
            console.log(`🔗 URL: ${socketUrl}`);
            console.log(`🛤️ Путь: ${socketPath}`);
            console.log(`🚗 Транспорт: websocket, polling`);
            
            // Функция для инициализации основного соединения
            const initializeMainConnection = () => {
                // Создаем основное соединение
                this.socket = io(socketUrl, {
                    path: socketPath,
                    transports: ['websocket', 'polling'],
                    timeout: 30000, // Увеличиваем таймаут до 30 секунд
                    autoConnect: config.SOCKET_CONFIG?.autoConnect !== false,
                    reconnection: true,
                    reconnectionAttempts: config.SOCKET_CONFIG?.reconnectionAttempts || 5,
                    reconnectionDelay: config.SOCKET_CONFIG?.reconnectionDelay || 1000,
                    secure: wsUrl.protocol === 'wss:',
                    forceNew: config.SOCKET_CONFIG?.forceNew || false,
                    extraHeaders: {
                        "X-Client-Version": "1.0.0"
                    },
                    query: {
                        "client": "frontend-app",
                        "t": Date.now().toString() // Предотвращаем кеширование
                    }
                });

                // Обработчик успешного подключения
                this.socket.on('connect', () => {
                    console.log('✅ Socket.IO успешно подключено, ID:', this.socket?.id);
                    this.isConnecting = false;
                    this.reconnectAttempts = 0; // Сбрасываем счетчик попыток после успешного подключения
                    
                    // Обрабатываем очередь сообщений при успешном подключении
                    if (this.messageQueue.length > 0) {
                        this.processMessageQueue();
                    }
                    
                    resolve(true);
                });

                // Обработчик ошибки подключения
                this.socket.on('connect_error', (error) => {
                    console.error('❌ Ошибка подключения к Socket.IO:', error);
                    this.isConnecting = false;
                    
                    // Планируем переподключение при ошибке
                    this.scheduleReconnect();
                    
                    resolve(false);
                });

                // Обработчик отключения
                this.socket.on('disconnect', (reason) => {
                    console.warn('🔌 Socket.IO отключен:', reason);
                    
                    // Если отключение не было инициировано пользователем, пытаемся переподключиться
                    if (reason !== 'io client disconnect') {
                        this.scheduleReconnect();
                    }
                });
                
                // Обработчик пинга (для мониторинга задержки)
                this.socket.on('ping', () => {
                    const timestamp = Date.now();
                    console.log(`📡 Отправлен PING (${timestamp})`);
                    
                    // Отправляем pong в ответ
                    this.socket?.emit('pong', { timestamp });
                });
            };

            // Инициализируем соединение
            initializeMainConnection();
        });

        return this.connectionPromise;
    }

    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.connectionPromise = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }

    subscribe(event: string, callback: (data: any) => void): void {
        console.log(`🔌 Подписка на WebSocket событие: ${event}`);
        if (this.socket) {
            // Добавляем обертку для логирования всех событий
            const wrappedCallback = (data: any) => {
                console.log(`📡 Получено WebSocket событие: ${event}`, data);
                callback(data);
            };
            
            this.socket.on(event, wrappedCallback);
            console.log(`✅ Успешно подписались на событие: ${event}`);
        } else {
            console.warn(`⚠️ Не удалось подписаться на событие ${event}: сокет не инициализирован`);
        }
    }

    unsubscribe(event: string): void {
        console.log(`🔌 Отписка от WebSocket события: ${event}`);
        if (this.socket) {
            this.socket.off(event);
            console.log(`✅ Успешно отписались от события: ${event}`);
        } else {
            console.warn(`⚠️ Не удалось отписаться от события ${event}: сокет не инициализирован`);
        }
    }

    // Обрабатывает очередь сообщений
    private processMessageQueue(): void {
        if (this.messageQueue.length === 0) {
            return;
        }
        
        console.log(`📩 Обработка очереди сообщений: ${this.messageQueue.length} сообщений`);
        
        if (this.isConnected()) {
            // Создаем копию очереди и очищаем оригинал перед обработкой
            // чтобы избежать бесконечных циклов если возникнет ошибка при отправке
            const queueCopy = [...this.messageQueue];
            this.messageQueue = [];
            
            for (const item of queueCopy) {
                try {
                    console.log(`📨 Отправка отложенного сообщения: ${item.eventType}`);
                    this.socket?.emit(item.eventType, item.data);
                } catch (error) {
                    console.error(`❌ Ошибка при отправке сообщения из очереди: ${item.eventType}`, error);
                    
                    // Увеличиваем счетчик попыток и добавляем обратно в очередь,
                    // если не превышен лимит попыток
                    item.attempts++;
                    if (item.attempts < this.maxRetryAttempts) {
                        this.messageQueue.push(item);
                    } else {
                        console.error(`❌ Сообщение ${item.eventType} отброшено после ${item.attempts} попыток`);
                    }
                }
            }
            
            console.log('✅ Очередь сообщений обработана');
        } else {
            console.warn('⚠️ Не удалось обработать очередь: сокет не подключен');
        }
    }

    // Добавляет сообщение в очередь
    private enqueueMessage(eventType: string, data: any): void {
        console.log(`📝 Добавление сообщения в очередь: ${eventType}`);
        
        this.messageQueue.push({
            eventType,
            data,
            attempts: 0
        });
    }

    // Улучшенный метод emit, который поддерживает очередь
    async emit(eventType: string, data: any): Promise<boolean> {
        // Если сокет подключен, отправляем сообщение сразу
        if (this.socket?.connected) {
            try {
                this.socket.emit(eventType, data);
                console.log(`📤 Сообщение "${eventType}" отправлено:`, data);
                return Promise.resolve(true);
            } catch (error) {
                console.error(`❌ Ошибка при отправке сообщения "${eventType}":`, error);
                // В случае ошибки добавляем сообщение в очередь
                this.enqueueMessage(eventType, data);
                return Promise.resolve(false);
            }
        }

        // Если сокет не подключен
        console.warn(`⚠️ Сокет не подключен. Сообщение "${eventType}" добавлено в очередь.`);
        
        // Если не идет процесс подключения, запускаем его
        if (!this.isConnecting) {
            console.log(`🔄 Попытка подключения перед отправкой сообщения "${eventType}"`);
            this.connect().then(connected => {
                if (connected) {
                    // Если подключились, обрабатываем очередь сообщений
                    this.processMessageQueue();
                }
            });
        }
        
        // Добавляем сообщение в очередь
        this.enqueueMessage(eventType, data);
        return Promise.resolve(false);
    }

    joinRoom(chatId: string): void {
        if (this.socket) {
            this.socket.emit('join_room', { chatId });
        }
    }

    leaveRoom(chatId: string): void {
        if (this.socket) {
            this.socket.emit('leave_room', { chatId });
        }
    }

    // Интеллектуальное переподключение с экспоненциальной задержкой
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Достигнуто максимальное количество попыток переподключения (${this.maxReconnectAttempts})`);
            this.isConnecting = false;
            return;
        }
        
        this.reconnectAttempts++;
        
        // Экспоненциальная задержка с минимальным временем 1 секунда и максимальным 30 секунд
        const delay = Math.min(
            1000 * Math.pow(1.5, this.reconnectAttempts - 1),
            30000
        );
        
        console.log(`⏳ Планирование переподключения (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts}) через ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            this.connect();
        }, delay);
    }
}

export const socketService = SocketService.getInstance(); 