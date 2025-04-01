// @ts-nocheck
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { socketService, getReservesRoomName, getShiftsRoomName, getServerRoomName } from '../services/socket';
import { 
    reserveAdded, 
    reserveDeleted,
    forceFetchReserves 
} from '../store/slices/reservesSlice';
import { User } from '../types/user';
import { ReserveShift } from '../types/shifts';
import { logger } from '../utils/logger';

/**
 * Хук для синхронизации данных о резервах через WebSocket
 * @param chatId ID чата для которого нужно получать обновления
 * @returns объект с состоянием синхронизации и методами управления
 */
export const useReservesSync = (chatId: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const isConnectedRef = useRef(false);
    const isLoadingRef = useRef(false);
    const user = useSelector((state: RootState) => state.user.user);
    
    // Загрузка данных
    const loadReserves = () => {
        if (isLoadingRef.current) return;
        
        isLoadingRef.current = true;
        dispatch(forceFetchReserves())
            .finally(() => {
                isLoadingRef.current = false;
            });
    };
    
    useEffect(() => {
        // Проверка необходимых условий
        if (!chatId || !user) return;
        
        // Загружаем начальные данные
        loadReserves();
        
        // Проверяем, нужно ли подключаться, если мы уже подключены
        if (isConnectedRef.current) return;
        
        // Подписка на события резервов
        const subscribeToEvents = () => {
            // Новый резерв добавлен
            socketService.subscribe('reserve_added', (data) => {
                console.log('📋 Новый резерв добавлен через WebSocket:', data);
                console.log('🔍 Детали события reserve_added:', {
                    data_type: typeof data,
                    keys: Object.keys(data),
                    id: data.id,
                    user_id: data.user_id,
                    userId: data.userId,
                    date: data.date,
                    full_data: data
                });
                
                // Убедимся, что данные имеют правильный формат перед отправкой в Redux
                const processedData = {
                    id: data.id || String(Date.now()),
                    userId: data.userId || data.user_id || '',
                    date: data.date,
                    photo_url: data.photo_url,
                    firstName: data.firstName || data.first_name || '',
                    lastName: data.lastName || data.last_name || '',
                    created_at: data.created_at || new Date().toISOString(),
                    isSeniorCourier: data.isSeniorCourier === true || data.is_senior_courier === true
                };
                
                console.log('📊 Обработанные данные для Redux:', processedData);
                dispatch(reserveAdded(processedData));
            });
            
            // Резерв обновлен
            socketService.subscribe('reserve_updated', (data) => {
                console.log('🔄 Резерв обновлен через WebSocket:', data);
                console.log('🔍 Детали события reserve_updated:', {
                    data_type: typeof data,
                    keys: Object.keys(data)
                });
                loadReserves();
            });
            
            // Резерв удален
            socketService.subscribe('reserve_deleted', (data) => {
                console.log('❌ Резерв удален через WebSocket:', data);
                console.log('🔍 Детали события reserve_deleted:', {
                    data_type: typeof data,
                    keys: Object.keys(data),
                    id: data.id,
                    userId: data.userId,
                    user_id: data.user_id,
                    date: data.date
                });
                
                // Форматируем данные для удаления из Redux
                if (data.id) {
                    dispatch(reserveDeleted({ id: data.id }));
                } else if (data.userId || data.user_id) {
                    dispatch(reserveDeleted({ 
                        userId: data.userId || data.user_id, 
                        date: data.date 
                    }));
                } else {
                    console.warn('⚠️ Неполные данные для удаления резерва:', data);
                    // В крайнем случае загружаем все резервы заново
                    loadReserves();
                }
            });
            
            // Также подписываемся на общее событие reserve_update
            socketService.subscribe('reserve_update', (data) => {
                console.log('📣 Общее событие reserve_update:', data);
                console.log('🔍 Детали события reserve_update:', {
                    action: data.action,
                    type: data.type,
                    keys: Object.keys(data),
                    data_keys: data.data ? Object.keys(data.data) : [],
                    full_data: data
                });
                
                // Обрабатываем данные по типу действия
                if (data.action === 'add') {
                    const reserveData = data.data;
                    const processedData = {
                        id: reserveData.id || String(Date.now()),
                        userId: reserveData.userId || reserveData.user_id || '',
                        date: reserveData.date,
                        photo_url: reserveData.photo_url,
                        firstName: reserveData.firstName || reserveData.first_name || '',
                        lastName: reserveData.lastName || reserveData.last_name || '',
                        created_at: reserveData.created_at || new Date().toISOString(),
                        isSeniorCourier: reserveData.isSeniorCourier === true || reserveData.is_senior_courier === true
                    };
                    
                    console.log('📊 Обработанные данные для добавления из reserve_update:', processedData);
                    dispatch(reserveAdded(processedData));
                } else if (data.action === 'remove') {
                    const reserveData = data.data;
                    if (reserveData.id) {
                        dispatch(reserveDeleted({ id: reserveData.id }));
                    } else if (reserveData.userId || reserveData.user_id) {
                        dispatch(reserveDeleted({ 
                            userId: reserveData.userId || reserveData.user_id, 
                            date: reserveData.date 
                        }));
                    } else {
                        loadReserves();
                    }
                } else {
                    loadReserves();
                }
            });
            
            // Подписываемся на новое broadcast-событие reserve_update_all
            socketService.subscribe('reserve_update_all', (data) => {
                console.log('📢 Broadcast-событие reserve_update_all:', data);
                console.log('🔍 Детали события reserve_update_all:', {
                    action: data.action,
                    type: data.type,
                    keys: Object.keys(data),
                    data_keys: data.data ? Object.keys(data.data) : [],
                    full_data: data
                });
                
                // Обрабатываем так же, как и reserve_update
                if (data.action === 'add') {
                    const reserveData = data.data;
                    const processedData = {
                        id: reserveData.id || String(Date.now()),
                        userId: reserveData.userId || reserveData.user_id || '',
                        date: reserveData.date,
                        photo_url: reserveData.photo_url,
                        firstName: reserveData.firstName || reserveData.first_name || '',
                        lastName: reserveData.lastName || reserveData.last_name || '',
                        created_at: reserveData.created_at || new Date().toISOString(),
                        isSeniorCourier: reserveData.isSeniorCourier === true || reserveData.is_senior_courier === true
                    };
                    
                    console.log('📊 Обработанные данные для добавления из broadcast:', processedData);
                    dispatch(reserveAdded(processedData));
                } else if (data.action === 'remove') {
                    const reserveData = data.data;
                    if (reserveData.id) {
                        dispatch(reserveDeleted({ id: reserveData.id }));
                    } else if (reserveData.userId || reserveData.user_id) {
                        dispatch(reserveDeleted({ 
                            userId: reserveData.userId || reserveData.user_id, 
                            date: reserveData.date 
                        }));
                    } else {
                        loadReserves();
                    }
                } else {
                    // В случае неизвестного действия обновляем все резервы
                    setTimeout(() => loadReserves(), 500);
                }
            });
            
            // Подписываемся на все echo/pong ответы для отладки
            socketService.subscribe('echo_response', (data) => {
                console.log('🔊 Echo-ответ получен:', data);
            });
            
            socketService.subscribe('pong_reserves_room', (data) => {
                console.log('🔔 Pong от комнаты резервов:', data);
            });
            
            socketService.subscribe('pong_reserves_room_private', (data) => {
                console.log('🔔 Приватный pong от комнаты резервов:', data);
            });
            
            // Подписываемся на события присоединения к комнате
            socketService.subscribe('joined_reserves_room', (data) => {
                console.log('🏠 Присоединение к комнате резервов:', data);
            });
            
            socketService.subscribe('joined_shifts_room', (data) => {
                console.log('🏠 Присоединение к комнате смен:', data);
            });
            
            socketService.subscribe('joined', (data) => {
                console.log('🏠 Присоединение к комнате:', data);
            });
        };
        
        // Отписка от событий
        const unsubscribeFromEvents = () => {
            socketService.unsubscribe('reserve_added');
            socketService.unsubscribe('reserve_updated');
            socketService.unsubscribe('reserve_deleted');
            socketService.unsubscribe('reserve_update');
            socketService.unsubscribe('reserve_update_all');
            socketService.unsubscribe('echo_response');
            socketService.unsubscribe('pong_reserves_room');
            socketService.unsubscribe('pong_reserves_room_private');
            socketService.unsubscribe('joined_reserves_room');
            socketService.unsubscribe('joined_shifts_room');
            socketService.unsubscribe('joined');
        };
        
        // Инициализация подключения и подписок
        socketService.connect().then(() => {
            // Проверяем состояние подключения
            const isSocketReady = socketService.isConnected();
            console.log(`🌐 WebSocket статус подключения: ${isSocketReady ? 'Подключен' : 'Не подключен'}`);
            
            // Получаем правильные имена комнат с префиксом inventory_
            const shiftsRoom = getShiftsRoomName(chatId);
            const reservesRoom = getReservesRoomName(chatId);
            const mainRoom = getServerRoomName(chatId);
            
            console.log(`🏠 Присоединяемся к комнатам с правильными префиксами:`);
            console.log(`- Основная комната: ${mainRoom}`);
            console.log(`- Комната смен: ${shiftsRoom}`);
            console.log(`- Комната резервов: ${reservesRoom}`);
            
            // Подключаемся как к комнате смен, так и к отдельной комнате резервов
            // ВАЖНО: теперь используем правильный формат имен комнат
            socketService.emit('join_room', { chatId });  // Общая комната
            socketService.emit('join_shifts_room', { chatId });  // Комната смен
            socketService.emit('join_reserves_room', { chatId });  // Комната резервов
            
            // Явно присоединяемся к комнатам
            socketService.joinRoom(chatId);
            
            // Добавим попытку переподключения через таймаут для гарантии
            setTimeout(() => {
                console.log(`🔄 Повторное соединение с комнатами через таймаут (чат: ${chatId})`);
                socketService.emit('join_room', { chatId });
                socketService.emit('join_shifts_room', { chatId });
                socketService.emit('join_reserves_room', { chatId });
                
                // Отправим тестовое сообщение для проверки соединения
                socketService.emit('ping_reserves_room', { 
                    chatId, 
                    message: 'Проверка соединения с комнатой резервов', 
                    timestamp: new Date().toISOString() 
                });
            }, 1000);
            
            isConnectedRef.current = true;
            subscribeToEvents();
            
            // Для проверки шлем тестовое Echo сообщение
            socketService.emit('echo', { 
                message: 'test-reserve-connection',
                chat_id: chatId,
                timestamp: new Date().toISOString()
            });
        }).catch(err => {
            console.error(`❌ Ошибка подключения WebSocket: ${err.message}`);
        });
        
        // Очистка при размонтировании
        return () => {
            unsubscribeFromEvents();
            if (isConnectedRef.current) {
                socketService.emit('leave_shifts_room', { chatId });
                socketService.emit('leave_reserves_room', { chatId });
                socketService.emit('leave_room', { chatId });
                
                // Обновленная версия с покиданием комнат
                socketService.leaveRoom(chatId);
                
                isConnectedRef.current = false;
            }
        };
    }, [dispatch, chatId, user]);
    
    // API для добавления в резерв
    const addToReserve = (
        date: string,
        user: User | undefined,
        chatId: string | number
    ): Promise<ReserveShift> => {
        return new Promise((resolve, reject) => {
            if (!user) {
                logger.error(`❌ Cannot add to reserve: user is undefined`);
                reject(new Error("User is undefined"));
                return;
            }

            // Логируем подробную информацию о пользователе для диагностики
            logger.info(`📊 Adding user to reserve: ${user.first_name} ${user.last_name} (${user.id})`);
            logger.info(`⭐ User details:`, {
                id: user.id,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                isSeniorCourier: user.is_senior_courier,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                type: typeof user.is_senior_courier,
                isAdmin: user.isAdmin,
                photoUrl: !!user.photo_url
            });

            const reserveData = {
                user_id: user.id,
                date,
                photo_url: user.photo_url,
                first_name: user.first_name,
                last_name: user.last_name,
                chat_id: chatId,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                is_senior_courier: user.is_senior_courier === true
            };

            logger.info(`📊 Sending reserve data to server:`, {
                ...reserveData,
                is_senior_courier_type: typeof reserveData.is_senior_courier,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                user_isSeniorCourier_original: user.is_senior_courier,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                user_isSeniorCourier_type: typeof user.is_senior_courier
            });

            socketService.emit("add_to_reserve", reserveData);
            
            // Принудительно обновляем состояние через некоторое время
            setTimeout(() => {
                dispatch(forceFetchReserves());
            }, 1000);
            
            // Поскольку мы не используем emitWithAck, возвращаем временный объект
            setTimeout(() => {
                resolve({
                    id: 'temp-id',
                    userId: String(user.id),
                    date,
                    photo_url: user.photo_url,
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    created_at: new Date().toISOString(),
                    isSeniorCourier: reserveData.is_senior_courier
                });
            }, 500);
        });
    };
    
    // API для удаления из резерва
    const removeFromReserve = (reserveId: string) => {
        if (!chatId) {
            console.error('Нет ID чата для удаления из резерва');
            return;
        }
        
        logger.info(`🗑️ Removing reserve with ID ${reserveId} from chat ${chatId}`);
        
        // Используем remove_from_reserve для совместимости с бэкендом
        socketService.emit('remove_from_reserve', {
            chat_id: chatId,
            id: reserveId
        });
    };
    
    // API для удаления из резерва по пользователю и дате
    const removeUserFromReserve = (userId: string, date: string) => {
        if (!chatId) {
            console.error('Нет ID чата для удаления из резерва');
            return;
        }
        
        logger.info(`🗑️ Removing reserve for user ${userId} on date ${date} from chat ${chatId}`);
        
        // Используем remove_from_reserve для совместимости с бэкендом
        socketService.emit('remove_from_reserve', {
            chat_id: chatId,
            user_id: userId,
            date: date
        });
    };
    
    return {
        loadReserves,
        addToReserve,
        removeFromReserve,
        removeUserFromReserve,
        isLoading: isLoadingRef.current
    };
}; 