import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch } from '../store/hooks';
import { receiveHistoryUpdate, addInventoryItem, updateInventoryData } from '../store/slices/inventorySlice';
import { Admin } from '../types/inventory';
import config from '../config';
import { addNotification, removeNotification, NotificationTypes } from '../store/slices/notificationSlice';
import { socketService } from '../services/socket';
import axios from 'axios';
import { store, RootState } from '../store';

const PING_INTERVAL = 10000;
const PING_TIMEOUT = 5000;
const GLOBAL_ROOM = 'inventory_global'; // Глобальная комната для всех чатов
const GLOBAL_ROOM_ID = 'global'; // ID глобальной комнаты для запросов к серверу

interface AdminRightsUpdate {
    chat_id: string;
    admins: Admin[];
}

// Глобальные переменные для синглтона
let globalSocket: Socket | null = null;
let isInitialized = false;
let globalPingInterval: NodeJS.Timeout | null = null;
let globalPingTimeout: NodeJS.Timeout | null = null;

// Вспомогательная функция для генерации уникальных ID для уведомлений
const generateUniqueNotificationId = (prefix: string = 'notification'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const clearGlobalTimers = () => {
    if (globalPingInterval) {
        clearInterval(globalPingInterval);
        globalPingInterval = null;
    }
    if (globalPingTimeout) {
        clearTimeout(globalPingTimeout);
        globalPingTimeout = null;
    }
};

// Добавляем Set для отслеживания уже обработанных уведомлений
const processedNotifications = new Set<string>();

// Функция для очистки старых уведомлений из localStorage
const clearOldNotifications = () => {
    try {
        const PERSISTENT_NOTIFICATIONS_KEY = 'app_persistent_notifications';
        const savedData = localStorage.getItem(PERSISTENT_NOTIFICATIONS_KEY);
        if (savedData) {
            const notifications = JSON.parse(savedData);
            // Сохраняем только активные предложения товаров
            const filteredNotifications = notifications.filter((n: any) => {
                // Проверяем тип уведомления
                if (n.payload && n.payload.type === 'suggestion_status') {
                    return false; // Удаляем все уведомления о статусе
                }
                if (n.payload && n.payload.type === 'item_suggestion') {
                    return !n.payload.status; // Оставляем только активные предложения
                }
                return false; // Удаляем все остальные уведомления
            });
            
            if (filteredNotifications.length > 0) {
                localStorage.setItem(PERSISTENT_NOTIFICATIONS_KEY, JSON.stringify(filteredNotifications));
                console.log(`🧹 Очищено ${notifications.length - filteredNotifications.length} старых уведомлений`);
            } else {
                localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
                console.log('🧹 Все уведомления очищены из localStorage');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при очистке устаревших уведомлений:', error);
    }
};

// Получаем данные о последнем отправленном предложении из state
const getLastSentItemSuggestion = (state: RootState) => state.inventory.lastSentItemSuggestion;

export const useWebSocket = (chatId?: string) => {
    const dispatch = useAppDispatch();
    const activeRooms = useRef(new Set<string>());
    const globalSocket = useRef<Socket | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout>();
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const [isConnected, setIsConnected] = useState(socketService.isConnected());
    const joinRoomAttempts = useRef<{[key: string]: number}>({});
    const MAX_JOIN_ATTEMPTS = 5;
    const joinedRooms = useRef<string[]>([]);
    const joinTimestamps = useRef<{[key: string]: number}>({});

    // Все объявления useCallback перемещаем в начало компонента, до useEffect
    // Обработчик обновления истории
    const handleHistoryUpdate = useCallback((data: any) => {
        console.log('=== 📜 Получено обновление истории ===');
        console.log('📊 Данные:', data);
        
        if (data.chatId && data.itemId) {
            console.log(`🏠 Чат: ${data.chatId}`);
            console.log(`📦 Товар: ${data.itemId}`);
            console.log('📝 Действие:', data.record.action);
            console.log('🔄 Тип:', data.record.type);
            console.log('📊 Количество:', {
                старое: data.record.oldQuantity,
                новое: data.record.newQuantity
            });

            // Убедимся, что все необходимые поля присутствуют в записи
            const historyRecord = {
                ...data.record,
                id: data.record.id || Date.now(),
                timestamp: data.record.timestamp || new Date().toISOString(),
                action: data.record.action || 'update',
                type: data.record.type || 'raw',
                category: data.category,
                item_name: data.itemId,
                oldQuantity: data.record.oldQuantity,
                newQuantity: data.record.newQuantity,
                author: data.record.author || {
                    id: null,
                    first_name: 'Система',
                    photo_url: null
                }
            };
            
            dispatch(receiveHistoryUpdate({ 
                itemId: data.itemId, 
                record: historyRecord 
            }));
            console.log('✅ История обновлена в Redux');
        }
    }, [dispatch]);

    const startPingTimer = useCallback(() => {
        clearGlobalTimers();

        globalPingInterval = setInterval(() => {
            if (!globalSocket.current?.connected) return;

            console.log('📤 Отправка ping');
            globalSocket.current?.emit('ping', {
                last_activity: new Date().toISOString()
            });

            globalPingTimeout = setTimeout(() => {
                console.log('⚠️ Не получен pong, переподключаемся...');
                if (globalSocket.current) {
                    globalSocket.current.disconnect();
                    initializeSocket();
                }
            }, PING_TIMEOUT);
        }, PING_INTERVAL);
    }, []);

    const initializeSocket = useCallback(() => {
        console.log('🔄 Инициализация WebSocket из хука useWebSocket...');
        
        // Используем обновленный сервис сокетов для подключения
        socketService.connect()
            .then(connected => {
                console.log(`🔌 WebSocket соединение ${connected ? 'установлено' : 'не удалось'}`);
                setIsConnected(socketService.isConnected());
                
                if (connected) {
                    // Обновляем ссылку на глобальный сокет
                    globalSocket.current = socketService['socket'];
                    
                    // Повторяем подключение к комнатам, если были активные
                    if (activeRooms.current.size > 0) {
                        console.log(`🔄 Переподключение к ${activeRooms.current.size} активным комнатам`);
                        // Комнаты очищаются при отключении, нужно повторить подключение
                    }
                } else {
                    console.error('❌ Не удалось установить соединение WebSocket');
                    // Показываем уведомление пользователю
                    dispatch(addNotification({
                        id: generateUniqueNotificationId('error'),
                        type: NotificationTypes.ERROR,
                        message: 'Проблема с подключением. Некоторые функции могут быть недоступны.',
                        autoHideDuration: 5000
                    }));
                }
            })
            .catch(error => {
                console.error('❌ Ошибка при инициализации WebSocket:', error);
                dispatch(addNotification({
                    id: generateUniqueNotificationId('error'),
                    type: NotificationTypes.ERROR,
                    message: 'Ошибка соединения: ' + (error.message || 'неизвестная ошибка'),
                    autoHideDuration: 5000
                }));
            });
    }, [dispatch]);
    
    // Объявляем retryJoinRoom как обычную функцию (не useCallback)
    const retryJoinRoom = (chatId: string, userInfo: any, delay: number = 2000) => {
        const currentAttempts = joinRoomAttempts.current[chatId] || 0;
        
        if (currentAttempts >= MAX_JOIN_ATTEMPTS) {
            console.error(`❌ Превышено максимальное количество попыток (${MAX_JOIN_ATTEMPTS}) подключения к комнате ${chatId}`);
            joinRoomAttempts.current[chatId] = 0;
            return;
        }
        
        joinRoomAttempts.current[chatId] = currentAttempts + 1;
        
        console.log(`⏳ Повторная попытка (${joinRoomAttempts.current[chatId]}/${MAX_JOIN_ATTEMPTS}) подключения к комнате ${chatId} через ${delay}ms`);
        
        setTimeout(() => {
            if (socketService.isConnected()) {
                const roomName = `inventory_${chatId}`;
                if (!activeRooms.current.has(roomName)) {
                    activeRooms.current.add(roomName);
                    socketService.emit('join', { 
                        chat_id: chatId, 
                        user_info: {
                            ...userInfo,
                            socket_id: globalSocket.current?.id
                        }
                    });
                    console.log(`🔄 Повторное подключение к комнате ${roomName}`);
                    // Сбрасываем счетчик попыток после успешного подключения
                    joinRoomAttempts.current[chatId] = 0;
                }
            } else {
                // Еще не подключен, пробуем переподключиться к сокету и затем повторяем
                socketService.connect().then(connected => {
                    if (connected) {
                        // Рекурсивно вызываем retryJoinRoom с небольшой задержкой
                        retryJoinRoom(chatId, userInfo, 1000);
                    } else {
                        // Увеличиваем задержку для следующей попытки
                        retryJoinRoom(chatId, userInfo, Math.min(delay * 1.5, 15000));
                    }
                });
            }
        }, delay);
    };

    // Объявляем retryJoinGlobalRoom как обычную функцию (не useCallback)
    const retryJoinGlobalRoom = (userInfo: any, delay: number = 2000) => {
        console.log(`⏳ Повторная попытка подключения к глобальной комнате через ${delay}ms`);
        
        setTimeout(() => {
            if (socketService.isConnected()) {
                // Всегда пытаемся переподключиться, даже если уже подключены
                const forceReconnect = true;
                
                // Добавляем в список активных комнат
                activeRooms.current.add(GLOBAL_ROOM);
                
                // Отправляем запрос с force=true
                socketService.emit('join', { 
                    chat_id: GLOBAL_ROOM_ID,
                    user_info: {
                        ...userInfo,
                        socket_id: globalSocket.current?.id
                    },
                    force: forceReconnect
                });
                
                console.log(`🔄 Повторное подключение к глобальной комнате ${GLOBAL_ROOM}`);
                console.log(`🔄 Socket ID: ${globalSocket.current?.id}`);
                console.log(`🔄 Принудительное переподключение: ${forceReconnect}`);
            } else {
                // Еще не подключен, пробуем переподключиться к сокету и затем повторяем
                socketService.connect().then(connected => {
                    if (connected) {
                        // Рекурсивно вызываем retryJoinGlobalRoom с небольшой задержкой
                        retryJoinGlobalRoom(userInfo, 1000);
                    } else {
                        // Увеличиваем задержку для следующей попытки
                        retryJoinGlobalRoom(userInfo, Math.min(delay * 1.5, 15000));
                    }
                });
            }
        }, delay);
    };

    // Функция для загрузки ожидающих уведомлений
    const fetchPendingNotifications = async (chatId: string) => {
        try {
            console.log(`🔄 Загрузка ожидающих уведомлений для чата ${chatId}...`);
            const response = await axios.get(`${config.API_URL}/notifications?chat_id=${chatId}`);
            
            if (response.data && Array.isArray(response.data)) {
                console.log(`📩 Получено ${response.data.length} ожидающих уведомлений для чата ${chatId}`);
                
                // Обрабатываем каждое уведомление
                response.data.forEach((notification: any) => {
                    // Обрабатываем уведомление вручную
                    try {
                        if (notification.type === 'item_suggestion') {
                            dispatch(addNotification({
                                id: generateUniqueNotificationId('item-suggestion'),
                                type: NotificationTypes.INFO,
                                title: 'Предложение товара',
                                message: `Предложено добавить товар "${notification.item.itemId}" в категорию "${notification.item.category}" от ${notification.source.userName} (${notification.source.chatTitle})`,
                                autoHideDuration: 0, // Не скрывать автоматически
                                payload: notification, // Передаем все данные в payload
                                timestamp: notification.timestamp || new Date().toISOString()
                            }));
                        }
                    } catch (error) {
                        console.error('❌ Ошибка обработки сохраненного уведомления:', error);
                    }
                });
            }
        } catch (error) {
            console.error('❌ Ошибка при загрузке уведомлений:', error);
        }
    };

    // Функции обратного вызова с useCallback
    const handleNotificationSent = useCallback((data: any) => {
        console.log('=== 📣 Notification sent ===', data);
        console.log('📋 Тип уведомления:', data.type);
        console.log('🏷️ Содержит suggestionId:', !!data.suggestionId);
        console.log('📦 Содержит данные item:', !!data.item, data.item);
        console.log('👤 Содержит данные source:', !!data.source, data.source);
        console.log('🆔 Идентификаторы:', {
            targetChatId: data.targetChatId,
            suggestionId: data.suggestionId,
            userId: data.userId || (data.source && data.source.userId)
        });

        // Получаем правильное значение получателей (иногда приходит как число, иногда как массив)
        const recipientsCount = Array.isArray(data.recipients) ? data.recipients.length : (typeof data.recipients === 'number' ? data.recipients : 0);
        
        // Определяем заголовок чата
        let targetChatTitle = '';
        if (data.targetChatId && data.targetChatTitle) {
            targetChatTitle = data.targetChatTitle;
        } else if (data.room?.title) {
            targetChatTitle = data.room.title;
        } else if (data.chatTitle) {
            targetChatTitle = data.chatTitle;
        }
        
        // Генерируем уникальный ID уведомления, включающий целевой чат и тип для лучшего отслеживания
        const notificationId = `${data.targetChatId || 'global'}-${data.type}-${Date.now()}`;
        
        // Если уведомление отправлено в глобальную комнату
        if (data.roomId === 'global' || data.targetChatId === 'global') {
            console.log('Global notification sent');
            return;
        }

        // Если это предложение товара, показываем специальное уведомление статуса
        if (data.type === 'item_suggestion') {
            console.log('🔍 Обработка уведомления item_suggestion');
            
            // Получаем информацию о текущем пользователе, чтобы знать, что он инициатор
            const currentUser = store.getState().user;
            console.log('👤 Текущий пользователь (отправитель):', currentUser);
            
            if (data.suggestionId) {
                console.log('✅ Есть suggestionId, создаем уведомление статуса');
                // Создаем более информативное уведомление с данными о целевом чате и статусе
                dispatch(addNotification({
                    id: `suggestion-${data.suggestionId}`,
                    type: NotificationTypes.SUGGESTION_STATUS,
                    title: 'Ожидание подтверждения',
                    message: `Предложение товара в чат "${targetChatTitle}"`,
                    payload: {
                        status: 'pending',
                        targetChatId: data.targetChatId,
                        targetChatTitle: targetChatTitle,
                        suggestionId: data.suggestionId,
                        itemName: data.item?.itemId || 'Неизвестный товар',
                        category: data.item?.category || 'Неизвестная категория',
                        animated: true, // Флаг для анимированной иконки состояния
                        recipientsCount: recipientsCount,
                        type: 'suggestion_status' // Важно: указываем тип для сохранения в хранилище
                    },
                    timestamp: new Date().toISOString(),
                    autoHideDuration: 0 // Не скрывать автоматически
                }));
            } else {
                console.warn('⚠️ Уведомление item_suggestion без suggestionId!');
                console.log('Данные:', JSON.stringify(data, null, 2));
                
                // Создаем идентификатор на основе времени и targetChatId
                // Добавляем случайную строку для гарантии уникальности
                const randomString = Math.random().toString(36).substring(2, 8);
                const tempSuggestionId = `temp-${data.targetChatId}-${Date.now()}-${randomString}`;
                console.log(`🔧 Создаем временный suggestionId: ${tempSuggestionId}`);
                
                // Получаем данные о последнем отправленном предложении из state
                const lastSentSuggestion = getLastSentItemSuggestion(store.getState());
                console.log('📦 Последнее отправленное предложение:', lastSentSuggestion);
                
                let itemName = 'Неизвестный товар';
                let category = 'Неизвестная категория';
                
                // Если есть данные о последнем отправленном предложении, используем их
                if (lastSentSuggestion && lastSentSuggestion.item) {
                    itemName = lastSentSuggestion.item.itemId || 'Неизвестный товар';
                    category = lastSentSuggestion.item.category || 'Неизвестная категория';
                }
                
                // Создаем уведомление статуса с временным ID
                // Важно: для идентификации как предложение товара добавляем type: 'suggestion_status'
                dispatch(addNotification({
                    id: `suggestion-status-${tempSuggestionId}`,
                    type: NotificationTypes.SUGGESTION_STATUS, // Используем стандартный тип SUGGESTION_STATUS
                    title: 'Предложение отправлено',
                    message: targetChatTitle 
                        ? `Предложение товара в чат "${targetChatTitle}"`
                        : `Предложение товара отправлено в неизвестный чат`,
                    payload: {
                        status: 'pending',
                        targetChatId: data.targetChatId,
                        targetChatTitle: targetChatTitle,
                        suggestionId: tempSuggestionId,
                        itemName: itemName,
                        category: category,
                        type: 'suggestion_status', // Важно: указываем тип для сохранения в хранилище
                        animated: true,
                        recipientsCount: recipientsCount,
                        isSent: true // Признак, что это уведомление об отправке
                    },
                    timestamp: new Date().toISOString(),
                    autoHideDuration: 0 // Не скрывать автоматически
                }));
            }
            
            // Также показываем всплывающее уведомление
            const toastId = generateUniqueNotificationId('suggestion-toast');
            dispatch(addNotification({
                id: toastId,
                type: NotificationTypes.INFO,
                message: targetChatTitle
                    ? `Предложение товара отправлено в чат "${targetChatTitle}"`
                    : `Предложение товара отправлено ${recipientsCount > 1 ? recipientsCount + ' пользователям' : '1 пользователю'}`,
                autoHideDuration: 5000,
                isToast: true
            }));
            
            return;
        }

        // Не показываем уведомление, если нет получателей
        if (recipientsCount === 0) {
            return;
        }

        // Формируем сообщение о целевом чате для всех типов уведомлений
        const chatMessage = targetChatTitle 
            ? `Отправлено в чат "${targetChatTitle}"` 
            : `Отправлено ${recipientsCount > 1 ? recipientsCount + ' пользователям' : '1 пользователю'}`;

        // Проверка статуса и формирование соответствующего сообщения
        switch (data.status) {
            case 'warning':
                dispatch(addNotification({
                    id: notificationId,
                    type: NotificationTypes.WARNING,
                    title: data.message || `Предупреждение: ${data.type}`,
                    message: chatMessage,
                    payload: {
                        chatTitle: targetChatTitle,
                        recipientsCount: recipientsCount,
                        type: data.type
                    },
                    autoHideDuration: 5000
                }));
                break;
            case 'error':
                dispatch(addNotification({
                    id: notificationId,
                    type: NotificationTypes.ERROR,
                    title: data.message || `Ошибка: ${data.type}`,
                    message: chatMessage,
                    payload: {
                        chatTitle: targetChatTitle,
                        recipientsCount: recipientsCount,
                        type: data.type
                    },
                    autoHideDuration: 5000
                }));
                break;
            case 'info':
                // Показываем уведомления для всех типов сообщений, включая стандартные
                dispatch(addNotification({
                    id: notificationId,
                    type: NotificationTypes.INFO,
                    title: data.type === 'message' ? 'Сообщение отправлено' : (data.message || `Уведомление отправлено`),
                    message: chatMessage,
                    payload: {
                        chatTitle: targetChatTitle,
                        recipientsCount: recipientsCount,
                        type: data.type
                    },
                    autoHideDuration: 5000
                }));
                break;
            case 'success':
            default:
                // Показываем уведомления для всех типов сообщений, включая стандартные
                dispatch(addNotification({
                    id: notificationId,
                    type: NotificationTypes.SUCCESS,
                    title: data.type === 'message' ? 'Сообщение отправлено' : (data.message || `Уведомление отправлено`),
                    message: chatMessage,
                    payload: {
                        chatTitle: targetChatTitle,
                        recipientsCount: recipientsCount,
                        type: data.type
                    },
                    autoHideDuration: 5000
                }));
                break;
        }
    }, [dispatch]);

    // Добавляем обработчик для входящих уведомлений inventory_notification
    const handleInventoryNotification = (data: any) => {
        console.log('=== 📢 Получено уведомление инвентаря ===', data);
        console.log('📋 Тип уведомления:', data.type);
        console.log('🏷️ Содержит id:', data.id);
        
        // Проверяем, был ли уже обработан этот notification_id
        if (data.id && processedNotifications.has(data.id)) {
            console.log('⏭️ Пропуск дублирующегося уведомления:', data.id);
            return;
        }

        // Добавляем ID в список обработанных
        if (data.id) {
            processedNotifications.add(data.id);
            
            // Ограничиваем размер Set, чтобы избежать утечки памяти
            if (processedNotifications.size > 1000) {
                const toRemove = Array.from(processedNotifications).slice(0, 500);
                toRemove.forEach(id => processedNotifications.delete(id));
                console.log('🧹 Очищено', toRemove.length, 'старых ID уведомлений');
            }
        }
        
        try {
            // Проверяем, есть ли у уведомления ID
            if (!data.id) {
                console.log('⚠️ Уведомление не имеет ID, генерируем новый');
                data.id = generateUniqueNotificationId('autogen');
                console.log(`🆔 Сгенерирован ID: ${data.id}`);
            }
            
            // Для item_suggestion особая логика - не показываем инициатору
            if (data.type === 'item_suggestion' && data.source && data.source.userId) {
                // Получаем текущего пользователя напрямую из store для синхронного доступа
                const currentUser = store.getState().user;
                
                if (currentUser && currentUser.id && 
                    String(currentUser.id) === String(data.source.userId)) {
                    console.log(`🔍 Текущий пользователь (${currentUser.id}) является инициатором уведомления, не показываем`);
                    return;
                }
            }
            
            // Проверяем тип уведомления
            if (data.type === 'item_suggestion') {
                // ID для уведомления в списке
                const notificationId = data.id;
                
                // Создаем уведомление в интерфейсе с правильной структурой данных
                dispatch(addNotification({
                    id: notificationId,
                    type: NotificationTypes.INFO,
                    title: 'Предложение товара',
                    message: `Предложено добавить товар "${data.item.itemId}" в категорию "${data.item.category}" от ${data.source.userName} (${data.source.chatTitle})`,
                    autoHideDuration: 0,
                    payload: {
                        ...data,
                        notificationId: notificationId,
                        isPersistent: false
                    },
                    timestamp: data.timestamp || new Date().toISOString()
                }));
                
                console.log('✅ Создано уведомление в списке с ID:', notificationId);
                
                // Показываем toast-уведомление
                const toastId = generateUniqueNotificationId('item-suggestion-toast');
                dispatch(addNotification({
                    id: toastId,
                    type: NotificationTypes.INFO,
                    message: `Новое предложение товара от ${data.source.userName}`,
                    autoHideDuration: 5000,
                    isToast: true
                }));
            }
            // Обработка ответов на предложения товаров
            else if (data.type === 'suggestion_response') {
                console.log('📦 Получен ответ на предложение товара:', data);
                
                // Проверяем наличие всех необходимых полей
                const hasStatus = !!data.status;
                const hasItem = !!data.item;
                const hasSource = !!data.source;
                
                if (!hasStatus || !hasItem || !hasSource) {
                    console.error('❌ Неполные данные в ответе на предложение товара!');
                    return;
                }
                
                // Получаем текущего пользователя
                const currentUser = store.getState().user;
                
                // Проверяем, что это ответ на наше предложение
                if (data.originalSource && data.originalSource.userId && 
                    String(currentUser.id) === String(data.originalSource.userId)) {
                    
                    console.log('✅ Получен ответ на наше предложение товара');
                    
                    // Ищем и удаляем старое уведомление о предложении
                    const notifications = store.getState().notification.items;
                    const oldNotifications = notifications.filter((n: any) => 
                        n.type === NotificationTypes.SUGGESTION_STATUS && 
                        n.payload?.type === 'suggestion_status' &&
                        n.payload?.itemName === data.item.itemId &&
                        n.payload?.category === data.item.category &&
                        n.payload?.targetChatId === data.source.chatId
                    );
                    
                    // Удаляем старые уведомления
                    oldNotifications.forEach((n: any) => {
                        console.log('🗑️ Удаляем старое уведомление:', n.id);
                        dispatch(removeNotification(n.id));
                        processedNotifications.delete(n.id);
                    });
                    
                    // Создаем уведомление с оригинальным ID
                    const notificationId = data.id;
                    
                    // Создаем уведомление о статусе
                    dispatch(addNotification({
                        id: notificationId,
                        type: NotificationTypes.SUGGESTION_STATUS,
                        title: data.status === 'accepted' ? 'Предложение принято' : 'Предложение отклонено',
                        message: `Предложение товара "${data.item.itemId}" в чат "${data.source.chatTitle}"`,
                        payload: {
                            status: data.status,
                            targetChatId: data.source.chatId,
                            targetChatTitle: data.source.chatTitle,
                            suggestionId: notificationId,
                            itemName: data.item.itemId,
                            category: data.item.category,
                            type: 'suggestion_status',
                            animated: false,
                            isPersistent: false
                        },
                        timestamp: data.timestamp || new Date().toISOString(),
                        autoHideDuration: 10000
                    }));
                    
                    console.log('✅ Создано уведомление о статусе предложения с ID:', notificationId);
                    
                    // Показываем toast-уведомление
                    const toastId = generateUniqueNotificationId('suggestion-response-toast');
                    
                    dispatch(addNotification({
                        id: toastId,
                        type: data.status === 'accepted' ? NotificationTypes.SUCCESS : NotificationTypes.INFO,
                        message: data.status === 'accepted' 
                            ? `Чат "${data.source.chatTitle}" принял ваше предложение товара "${data.item.itemId}"` 
                            : `Чат "${data.source.chatTitle}" отклонил ваше предложение товара "${data.item.itemId}"`,
                        autoHideDuration: 5000,
                        isToast: true
                    }));
                    
                    // Очищаем localStorage после обработки ответа
                    clearOldNotifications();
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обработки уведомления:', error);
            console.error('Данные уведомления:', data);
        }
    };

    const handleSuggestionStatusUpdate = useCallback((data: any) => {
        const { status, targetChatId, targetChatTitle, suggestionId } = data;
        
        if (suggestionId) {
            const notificationId = `suggestion-${suggestionId}`;
            
            // If the status is 'accepted' or 'rejected', update existing notification
            if (status === 'accepted' || status === 'rejected') {
                dispatch(addNotification({
                    id: notificationId,
                    type: NotificationTypes.SUGGESTION_STATUS,
                    message: status === 'accepted' 
                        ? 'Предложение товара принято' 
                        : 'Предложение товара отклонено',
                    payload: {
                        status,
                        targetChatId,
                        targetChatTitle,
                        suggestionId
                    },
                    timestamp: new Date().toISOString()
                }));
            }
        }
    }, [dispatch]);

    const joinRoomCallback = useCallback((chatId: string, userInfo: any) => {
        if (!socketService.isConnected()) {
            console.warn('⚠️ Socket не подключен, пытаемся переподключиться...');
            socketService.connect().then(connected => {
                if (connected) {
                    console.log('🔄 Socket подключен, повторяем присоединение к комнате');
                    // Используем retryJoinRoom вместо рекурсивного вызова
                    retryJoinRoom(chatId, userInfo, 1000);
                } else {
                    // Если не удалось подключиться, планируем повторную попытку
                    retryJoinRoom(chatId, userInfo, 3000);
                }
            });
            return;
        }
        
        const roomName = `inventory_${chatId}`;
        // Проверяем, есть ли уже активное подключение к комнате
        if (!activeRooms.current.has(roomName)) {
            console.log('🔌 Подключение к комнате:', roomName);
            console.log('👤 Пользователь:', userInfo.first_name);
            console.log('🆔 Socket ID:', globalSocket.current?.id);
            
            // Добавляем комнату в список активных
            activeRooms.current.add(roomName);
            
            // Отправляем запрос на присоединение
            socketService.emit('join', { 
                chat_id: chatId, 
                user_info: {
                    ...userInfo,
                    socket_id: globalSocket.current?.id
                }
            });
            
            // Сбрасываем счетчик попыток после успешного подключения
            joinRoomAttempts.current[chatId] = 0;
        } else {
            console.log('ℹ️ Уже подключены к комнате:', roomName);
        }
    }, []);
    
    const joinGlobalRoomCallback = useCallback((userInfo: any) => {
        if (!socketService.isConnected()) {
            console.warn('⚠️ Socket не подключен, пытаемся переподключиться для глобальной комнаты...');
            socketService.connect().then(connected => {
                if (connected) {
                    console.log('🔄 Socket подключен, повторяем присоединение к глобальной комнате');
                    retryJoinGlobalRoom(userInfo, 1000);
                } else {
                    retryJoinGlobalRoom(userInfo, 3000);
                }
            });
            return;
        }
        
        // Проверяем, нужно ли принудительное переподключение
        // Форсированное переподключение делаем только если комната не активна или прошло больше 5 минут с последнего подключения
        const lastJoinTimestamp = joinTimestamps.current[GLOBAL_ROOM] || 0;
        const forceReconnect = !activeRooms.current.has(GLOBAL_ROOM) || (Date.now() - lastJoinTimestamp > 5 * 60 * 1000);
        
        // Проверяем, есть ли уже активное подключение к глобальной комнате
        if (!activeRooms.current.has(GLOBAL_ROOM) || forceReconnect) {
            console.log('🌐 Подключение к глобальной комнате:', GLOBAL_ROOM);
            console.log('👤 Пользователь:', userInfo);
            console.log('🆔 Socket ID:', globalSocket.current?.id);
            console.log('🔗 Socket подключен:', socketService.isConnected());
            console.log('🦺 Принудительное переподключение:', forceReconnect);
            
            // Добавляем комнату в список активных и обновляем время подключения
            activeRooms.current.add(GLOBAL_ROOM);
            joinTimestamps.current[GLOBAL_ROOM] = Date.now();
            
            // Отправляем запрос на присоединение к глобальной комнате
            socketService.emit('join', { 
                chat_id: GLOBAL_ROOM_ID,
                user_info: {
                    ...userInfo,
                    socket_id: globalSocket.current?.id
                },
                force: forceReconnect
            });
        } else {
            console.log('ℹ️ Уже подключены к глобальной комнате:', GLOBAL_ROOM);
            console.log('🔍 Список активных комнат:', Array.from(activeRooms.current));
            console.log('🔄 Но всё равно отправляем запрос на обновление подключения...');
            
            // Отправляем запрос на обновление подключения
            socketService.emit('join', { 
                chat_id: GLOBAL_ROOM_ID,
                user_info: {
                    ...userInfo,
                    socket_id: globalSocket.current?.id
                },
                refresh: true
            });
        }
    }, []);
    
    const leaveGlobalRoomCallback = useCallback((userInfo: any) => {
        if (socketService.isConnected()) {
            // Проверяем, есть ли активное подключение к глобальной комнате
            if (activeRooms.current.has(GLOBAL_ROOM)) {
                console.log('👋 Отключение от глобальной комнаты:', GLOBAL_ROOM);
                console.log('👤 Пользователь:', userInfo.first_name);
                console.log('🆔 Socket ID:', globalSocket.current?.id);
                
                // Удаляем комнату из списка активных
                activeRooms.current.delete(GLOBAL_ROOM);
                
                // Отправляем запрос на отключение от глобальной комнаты
                socketService.emit('leave', { 
                    chat_id: GLOBAL_ROOM_ID, // Используем константу GLOBAL_ROOM_ID
                    user_info: {
                        ...userInfo,
                        socket_id: globalSocket.current?.id
                    }
                });
            } else {
                console.log('ℹ️ Уже отключены от глобальной комнаты:', GLOBAL_ROOM);
            }
        }
    }, []);
    
    const leaveRoomCallback = useCallback((chatId: string, userInfo: any) => {
        if (socketService.isConnected()) {
            const roomName = `inventory_${chatId}`;
            // Проверяем, есть ли активное подключение к комнате
            if (activeRooms.current.has(roomName)) {
                console.log('👋 Отключение от комнаты:', roomName);
                console.log('👤 Пользователь:', userInfo.first_name);
                console.log('🆔 Socket ID:', globalSocket.current?.id);
                
                // Удаляем комнату из списка активных
                activeRooms.current.delete(roomName);
                
                // Отправляем запрос на отключение
                socketService.emit('leave', { 
                    chat_id: chatId, 
                    user_info: {
                        ...userInfo,
                        socket_id: globalSocket.current?.id
                    }
                });
            } else {
                console.log('ℹ️ Уже отключены от комнаты:', roomName);
            }
        }
    }, []);
    
    const clearNotificationsCallback = useCallback(() => {
        processedNotifications.clear();
    }, []);

    const handleInventoryUpdate = useCallback((data: any) => {
        console.log('=== 📦 Получено обновление инвентаря ===');
        console.log('📊 Данные:', data);
        
        // Извлекаем данные из обновления
        const updateData = data.data || data;
        const chatId = updateData.metadata?.chat_id || updateData.chatId;
        
        if (!chatId) {
            console.warn('⚠️ Отсутствует chatId в данных обновления:', updateData);
            return;
        }

        if (updateData.type === 'item_update' && updateData.category && updateData.itemId && updateData.item) {
            // Обработка обновления отдельного товара
            console.log(`🏠 Чат: ${chatId}`);
            console.log('📦 Тип обновления: item_update');
            
            dispatch(updateInventoryData({
                chatId,
                data: {
                    type: 'item_update',
                    category: updateData.category,
                    itemId: updateData.itemId,
                    item: updateData.item,
                    metadata: updateData.metadata || {
                        lastUpdated: new Date().toISOString()
                    }
                }
            }));
        } else if (updateData.inventory) {
            // Обработка полного обновления инвентаря
            console.log(`🏠 Чат: ${chatId}`);
            console.log('📦 Тип обновления: full');
            
            const payload = {
                chatId,
                data: {
                    type: 'full',
                    inventory: updateData.inventory,
                    metadata: updateData.metadata || {
                        lastUpdated: new Date().toISOString()
                    }
                }
            };
            
            console.log('📤 Отправка обновления в Redux:', payload);
            dispatch(updateInventoryData(payload));
        } else {
            console.warn('⚠️ Получены некорректные данные обновления:', updateData);
            return;
        }
        
        console.log('✅ Данные отправлены в Redux для обновления');
    }, [dispatch]);

    // Далее идут все useEffect
    useEffect(() => {
        // Инициализируем сокет только если его еще нет
        if (!socketService.isConnected()) {
            initializeSocket();
        } else {
            // Если сокет уже существует, обновляем ссылку
            globalSocket.current = socketService['socket'];
            setIsConnected(true);
            
            // Проверяем, что подключены к глобальной комнате
            console.log('🔍 Проверка подключения к глобальной комнате при инициализации');
            console.log('🔍 Текущие активные комнаты:', Array.from(activeRooms.current));
        }
        
        // Добавляем обработчик для отслеживания статуса соединения
        const handleConnect = () => {
            console.log('✅ WebSocket соединение установлено');
            setIsConnected(true);
            globalSocket.current = socketService['socket'];
            
            // При установлении соединения очищаем список активных комнат,
            // так как при переподключении комнаты сбрасываются на сервере
            console.log('🔄 Сброс списка активных комнат при подключении');
            activeRooms.current.clear();
            
            // Очищаем устаревшие уведомления при подключении
            clearOldNotifications();
        };
        
        const handleDisconnect = () => {
            console.log('❌ WebSocket соединение разорвано');
            setIsConnected(false);
        };
        
        socketService.subscribe('connect', handleConnect);
        socketService.subscribe('disconnect', handleDisconnect);
        
        return () => {
            socketService.unsubscribe('connect');
            socketService.unsubscribe('disconnect');
        };
    }, [initializeSocket]);

    useEffect(() => {
        if (!globalSocket.current) return;

        // Подписываемся на обновления истории
        globalSocket.current.on('history_update', handleHistoryUpdate);
        
        // Обработчик подключения к комнате
        const handleJoined = (data: any) => {
            console.log('=== 🔌 Успешное подключение к комнате ===');
            console.log('🏠 Комната:', data.room);
            console.log('👥 Активных пользователей:', data.active_users?.length || 0);
            console.log('🚦 Статус:', data.status);
            console.log('🔄 Принудительное переподключение:', data.forced ? 'Да' : 'Нет');
            console.log('🔄 Обновление данных:', data.refresh ? 'Да' : 'Нет');
            
            // Для глобальной комнаты выводим дополнительную информацию
            if (data.room === GLOBAL_ROOM) {
                console.log('🌐 Подключение к глобальной комнате подтверждено');
                console.log('🌐 Список активных пользователей:', data.active_users);
                
                // Запоминаем присоединение к глобальной комнате
                joinedRooms.current.push(GLOBAL_ROOM_ID);
            }
            
            // Если подключились к комнате чата, запоминаем для последующей загрузки уведомлений
            if (data.room.startsWith('inventory_') && data.room !== GLOBAL_ROOM) {
                const chatRoomId = data.room.replace('inventory_', '');
                joinedRooms.current.push(chatRoomId);
            }
        };
        
        globalSocket.current.on('joined', handleJoined);
        
        return () => {
            globalSocket.current?.off('history_update', handleHistoryUpdate);
            globalSocket.current?.off('joined', handleJoined);
        };
    }, [globalSocket.current, handleHistoryUpdate]);

    useEffect(() => {
        if (!globalSocket.current) return;

        // Обработчики для событий notification_sent и inventory_notification
        globalSocket.current.on('notification_sent', handleNotificationSent);
        globalSocket.current.on('inventory_notification', handleInventoryNotification);
        
        // Добавляем обработчик для обновления уведомлений
        const handleNotificationUpdated = (data: any) => {
            console.log('=== 🔄 Получено обновление уведомления ===', data);
            
            if (data.action === 'deleted') {
                console.log('🗑️ Удаление уведомления:', data.id);
                // Удаляем уведомление из Redux
                dispatch(removeNotification(data.id));
                // Удаляем из списка обработанных
                processedNotifications.delete(data.id);
                // Очищаем localStorage
                clearOldNotifications();
            }
        };
        
        globalSocket.current.on('notification_updated', handleNotificationUpdated);
        
        // Загружаем уведомления для всех комнат, к которым присоединились
        if (joinedRooms.current.length > 0) {
            joinedRooms.current.forEach(roomId => {
                fetchPendingNotifications(roomId);
            });
        }
        
        // Если есть chatId в параметрах, также загружаем для него
        if (chatId && !joinedRooms.current.includes(chatId)) {
            fetchPendingNotifications(chatId);
        }
        
        return () => {
            globalSocket.current?.off('notification_sent', handleNotificationSent);
            globalSocket.current?.off('inventory_notification', handleInventoryNotification);
            globalSocket.current?.off('notification_updated', handleNotificationUpdated);
        };
    }, [globalSocket.current, dispatch, chatId, joinedRooms.current]);

    useEffect(() => {
        if (globalSocket.current) {
            // Подписываемся на обновления инвентаря
            globalSocket.current.on('inventory_update', handleInventoryUpdate);
            
            return () => {
                globalSocket.current?.off('inventory_update', handleInventoryUpdate);
            };
        }
    }, [handleInventoryUpdate]);

    // Очистка при размонтировании компонента
    useEffect(() => {
        return () => {
            // Отписываемся от всех обработчиков
            if (globalSocket.current) {
                // Отписываемся только от обработчиков, которые определены в этом компоненте
                globalSocket.current.off('history_update');
                globalSocket.current.off('joined');
                globalSocket.current.off('inventory_notification');
                globalSocket.current.off('notification_sent');
                globalSocket.current.off('admin_rights_update');
                globalSocket.current.off('ping');
                globalSocket.current.off('pong');
            }
            
            // Отписываемся от глобальных событий сокет-сервиса
            socketService.unsubscribe('connect');
            socketService.unsubscribe('disconnect');
            
            // Очищаем таймеры
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = undefined;
            }
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = undefined;
            }
            
            // Очищаем список активных комнат
            activeRooms.current.clear();
            joinRoomAttempts.current = {};
            joinTimestamps.current = {};
            
            console.log('🧹 useWebSocket: ресурсы очищены при размонтировании');
        };
    }, []);

    // Возвращаем объект с нужными свойствами и методами
    return {
        socket: globalSocket.current,
        isConnected: () => Boolean(globalSocket.current?.connected),
        joinRoom: joinRoomCallback,
        joinGlobalRoom: joinGlobalRoomCallback,
        leaveGlobalRoom: leaveGlobalRoomCallback,
        leaveRoom: leaveRoomCallback,
        handleSuggestionStatusUpdate,
        clearNotifications: clearNotificationsCallback
    };
}; 