/**
 * Вспомогательные функции для работы с WebSocket
 * 
 * Этот файл содержит улучшенные обертки над базовыми функциями сокетов
 * для более надежной работы с WebSocket-событиями.
 */

import { socketService } from './socket';

// Объект для хранения всех обработчиков событий
const eventHandlers: Record<string, Array<(data: any) => void>> = {};

/**
 * Улучшенная подписка на WebSocket событие с множественными обработчиками
 */
export function subscribeToEvent(eventName: string, handler: (data: any) => void): void {
    console.log(`🔌 [WebSocketHelper] Подписка на событие: ${eventName}`);
    
    // Добавляем обработчик в список
    if (!eventHandlers[eventName]) {
        eventHandlers[eventName] = [];
    }
    
    // Проверяем, не добавлен ли уже такой обработчик
    if (!eventHandlers[eventName].includes(handler)) {
        eventHandlers[eventName].push(handler);
    }
    
    // Если это первый обработчик, подписываемся на событие
    if (eventHandlers[eventName].length === 1) {
        // Создаем единый обработчик, который вызовет все зарегистрированные функции
        const wrappedHandler = (data: any) => {
            console.log(`📡 [WebSocketHelper] Получено событие: ${eventName}`, data);
            
            // Вызываем все зарегистрированные обработчики
            eventHandlers[eventName].forEach(h => {
                try {
                    h(data);
                } catch (error) {
                    console.error(`❌ [WebSocketHelper] Ошибка в обработчике события ${eventName}:`, error);
                }
            });
        };
        
        // Подписываемся на событие через сокет
        socketService.subscribe(eventName, wrappedHandler);
    }
}

/**
 * Отписка от WebSocket события
 */
export function unsubscribeFromEvent(eventName: string, handler: (data: any) => void): void {
    console.log(`🔌 [WebSocketHelper] Отписка от события: ${eventName}`);
    
    if (!eventHandlers[eventName]) {
        return;
    }
    
    // Удаляем обработчик из списка
    const index = eventHandlers[eventName].indexOf(handler);
    if (index !== -1) {
        eventHandlers[eventName].splice(index, 1);
    }
    
    // Если список обработчиков пуст, отписываемся от события
    if (eventHandlers[eventName].length === 0) {
        socketService.unsubscribe(eventName);
        delete eventHandlers[eventName];
    }
}

/**
 * Прямое подключение к комнате чата через WebSocket
 */
export function joinChatRoom(chatId: string, userInfo: any): void {
    console.log(`🔌 [WebSocketHelper] Подключение к комнате чата: ${chatId}`);
    
    if (!socketService.isConnected()) {
        console.warn('⚠️ [WebSocketHelper] WebSocket не подключен');
        socketService.connect()
            .then(connected => {
                if (connected) {
                    console.log('✅ [WebSocketHelper] WebSocket подключен, присоединяемся к комнате');
                    socketService.emit('join', { 
                        chat_id: chatId, 
                        user_info: userInfo
                    });
                } else {
                    console.error('❌ [WebSocketHelper] Не удалось подключить WebSocket');
                }
            });
    } else {
        socketService.emit('join', { 
            chat_id: chatId, 
            user_info: userInfo
        });
    }
}

/**
 * Отключение от комнаты чата
 */
export function leaveChatRoom(chatId: string, userInfo: any): void {
    console.log(`🔌 [WebSocketHelper] Отключение от комнаты чата: ${chatId}`);
    
    if (socketService.isConnected()) {
        socketService.emit('leave', { 
            chat_id: chatId, 
            user_info: userInfo
        });
    }
}

export default {
    subscribeToEvent,
    unsubscribeFromEvent,
    joinChatRoom,
    leaveChatRoom
}; 