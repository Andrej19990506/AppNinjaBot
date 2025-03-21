import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types';
import config from '../config';
import { logger } from '../utils/logger';

interface QueuedMessage {
    eventType: string;
    data: any;
    attempts: number;
}

class SocketService {
    private socket: Socket | null = null;
    private static instance: SocketService;
    private connectionPromise: Promise<boolean> | null = null;
    private messageQueue: { event: string; data: any }[] = [];
    private maxRetryAttempts = 3;
    private isConnecting: boolean = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private baseDelay: number = 1000;

    private constructor() {}

    static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    private getSocketUrl(): string {
        return process.env.REACT_APP_WS_URL || 'http://localhost:3001';
    }

    private async initializeSocket(): Promise<Socket> {
        const url = this.getSocketUrl();
        logger.info('🔧 Инициализируем Socket.IO:');
        logger.info(`🔗 URL: ${url}`);
        logger.info(`🛤️ Путь: /socket.io`);
        logger.info(`🚗 Транспорт: websocket, polling`);

        return io(url, {
            transports: ['websocket', 'polling'],
            path: '/socket.io',
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            timeout: 60000,
            forceNew: true,
            autoConnect: false
        });
    }

    public async connect(): Promise<void> {
        if (this.socket?.connected) {
            logger.info('✅ Socket.IO уже подключен');
            return;
        }

        if (this.isConnecting) {
            logger.info('🔄 Socket.IO подключение уже в процессе...');
            return;
        }

        this.isConnecting = true;

        try {
            logger.info('🔌 Попытка соединения с WebSocket ' + this.getSocketUrl());
            
            // Инициализируем сокет
            this.socket = await this.initializeSocket();

            // Устанавливаем обработчики событий
            this.socket.on('connect', () => {
                logger.info('✅ Socket.IO подключение установлено');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.processMessageQueue();
            });

            this.socket.on('connect_error', (error) => {
                logger.error('❌ Ошибка подключения к Socket.IO:', error);
                this.handleConnectionError();
            });

            this.socket.on('disconnect', (reason) => {
                logger.warn('🔌 Socket.IO отключен:', reason);
                this.handleDisconnect(reason);
            });

            this.socket.on('error', (error) => {
                logger.error('❌ Socket.IO ошибка:', error);
                this.handleConnectionError();
            });

            // Подключаемся
            this.socket.connect();

        } catch (error) {
            logger.error('❌ Ошибка при инициализации Socket.IO:', error);
            this.handleConnectionError();
        }
    }

    private handleConnectionError() {
        this.isConnecting = false;
        this.reconnectAttempts++;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(this.baseDelay * Math.pow(1.5, this.reconnectAttempts - 1), 5000);
            logger.info(`⏳ Планирование переподключения (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts}) через ${delay}ms`);
            setTimeout(() => this.reconnect(), delay);
        } else {
            logger.error('❌ Превышено максимальное количество попыток переподключения');
        }
    }

    private handleDisconnect(reason: string) {
        this.isConnecting = false;
        if (reason === 'io server disconnect' || reason === 'transport close') {
            this.reconnect();
        }
    }

    private reconnect() {
        logger.info(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect();
    }

    private processMessageQueue() {
        if (!this.socket?.connected) return;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.socket.emit(message.event, message.data);
                logger.info(`📨 Отправлено отложенное сообщение: ${message.event}`);
            }
        }
    }

    public emit(event: string, data: any): void {
        if (!this.socket?.connected) {
            logger.warn('⚠️ Сокет не подключен. Сообщение добавлено в очередь.');
            this.messageQueue.push({ event, data });
            logger.info(`📝 Добавление сообщения в очередь: ${event}`);
            this.connect();
            return;
        }

        // Добавляем логирование для события book_shift
        if (event === 'book_shift') {
            // Убедимся, что is_senior_courier имеет правильный логический тип
            if (data.is_senior_courier !== undefined) {
                data.is_senior_courier = Boolean(data.is_senior_courier);
            }
            
            console.info('📡 Отправка book_shift через WebSocket:', {
                event,
                data,
                isSeniorCourier: data.is_senior_courier
            });
        }

        this.socket.emit(event, data);
    }

    public emitWithAck(event: string, data: any, callback: (response: any) => void): void {
        if (!this.socket?.connected) {
            logger.warn('⚠️ Сокет не подключен при попытке отправки с подтверждением.');
            this.connect().then(() => {
                if (this.socket?.connected) {
                    logger.info(`📡 Отправка сообщения с подтверждением после переподключения: ${event}`);
                    this.socket.emit(event, data, callback);
                } else {
                    logger.error(`❌ Не удалось подключиться для отправки сообщения: ${event}`);
                    callback({ error: 'Failed to connect to server' });
                }
            });
            return;
        }

        logger.info(`📡 Отправка сообщения с подтверждением: ${event}`);
        this.socket.emit(event, data, callback);
    }

    public on(event: string, callback: (data: any) => void): void {
        if (!this.socket) {
            this.connect().then(() => {
                this.socket?.on(event, callback);
            });
            return;
        }
        this.socket.on(event, callback);
    }

    public off(event: string, callback?: (data: any) => void): void {
        if (!this.socket) return;
        if (callback) {
            this.socket.off(event, callback);
        } else {
            this.socket.off(event);
        }
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
}

export const socketService = SocketService.getInstance(); 