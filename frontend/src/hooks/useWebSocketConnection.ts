import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useWebSocket } from './useWebSocket';
import { RootState } from '../store/store';
import { socketService } from '../services/socket';

export const useWebSocketConnection = (chatId?: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const { joinRoom, joinGlobalRoom, joinShiftsRoom, joinReservesRoom, joinCourierRoom } = useWebSocket(chatId);
    const user = useSelector((state: RootState) => state.user.user);
    const didConnect = useRef(false);
    const didJoinRooms = useRef(false);

    // Подключение к WebSocket
    useEffect(() => {
        console.log('🔄 useWebSocketConnection: Проверка подключения');

        if (!socketService.isConnected()) {
            console.log('🔌 useWebSocketConnection: Инициируем подключение WebSocket');
            socketService.connect();
        } else {
            console.log('✅ useWebSocketConnection: WebSocket уже подключен');
            setIsConnected(true);
        }

        // Обработчик подключения
        const handleConnect = () => {
            console.log('✅ useWebSocketConnection: WebSocket успешно подключен');
            setIsConnected(true);
            didConnect.current = true;
        };

        // Обработчик отключения
        const handleDisconnect = () => {
            console.log('⚠️ useWebSocketConnection: WebSocket отключен');
            setIsConnected(false);
        };

        // Подписываемся на события
        socketService.on('connect', handleConnect);
        socketService.on('disconnect', handleDisconnect);

        return () => {
            // Отписываемся от событий
            socketService.off('connect', handleConnect);
            socketService.off('disconnect', handleDisconnect);
        };
    }, []);

    // Присоединение к комнатам при наличии chatId и user
    useEffect(() => {
        if (isConnected && chatId && user && !didJoinRooms.current) {
            console.log('🔄 useWebSocketConnection: Присоединение к комнатам');
            console.log(`📊 Chat ID: ${chatId}`);
            console.log(`👤 User: ${user.first_name} ${user.last_name} (${user.id})`);
            
            const userInfo = {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username,
                photo_url: user.photo_url
            };
            
            console.log('🌐 useWebSocketConnection: Присоединение к глобальной комнате');
            joinGlobalRoom(userInfo);
            
            console.log('🏠 useWebSocketConnection: Присоединение к комнате чата');
            joinRoom(chatId, userInfo);
            
            console.log('📝 useWebSocketConnection: Присоединение к комнате смен');
            joinShiftsRoom(chatId);
            
            console.log('📋 useWebSocketConnection: Присоединение к комнате резервов');
            joinReservesRoom(chatId);
            
            console.log(`👥 useWebSocketConnection: Присоединение к общей комнате курьеров для чата ${chatId}`);
            console.log('📣 Вызываем функцию joinCourierRoom с параметром:', chatId);
            console.log('👤 Пользователь:', userInfo);
            joinCourierRoom(chatId, userInfo);
            
            // Логируем все активные подключения
            console.log('🔌 socketService подключен:', socketService.isConnected());
            console.log('🆔 socketService ID:', socketService['socket']?.id);
            
            didJoinRooms.current = true;
            console.log('✅ useWebSocketConnection: Успешно присоединились ко всем комнатам');
        } else {
            if (!isConnected) {
                console.log('⚠️ useWebSocketConnection: Невозможно присоединиться к комнатам - WebSocket не подключен');
            }
            if (!chatId) {
                console.log('⚠️ useWebSocketConnection: Невозможно присоединиться к комнатам - chatId не указан');
            }
            if (!user) {
                console.log('⚠️ useWebSocketConnection: Невозможно присоединиться к комнатам - данные пользователя отсутствуют');
            }
            if (didJoinRooms.current) {
                console.log('ℹ️ useWebSocketConnection: Уже присоединились ко всем комнатам');
            }
        }
    }, [isConnected, chatId, user, joinRoom, joinGlobalRoom, joinShiftsRoom, joinReservesRoom, joinCourierRoom]);

    // Проверка работы WebSocket после подключения
    useEffect(() => {
        if (isConnected && socketService['socket']) {
            console.log('🧪 Отправка тестового события WebSocket');
            console.log('🔗 Состояние подключения:', {
                isConnected,
                socketExists: Boolean(socketService['socket']),
                socketId: socketService['socket']?.id,
                chatId
            });
            
            // Подписываемся на ответ
            socketService['socket'].once('test_response', (response: any) => {
                console.log('✅ Получен ответ на тестовое событие:', response);
                
                // Запускаем попытку присоединения сразу после получения ответа
                console.log('🔄 Запуск попытки присоединения к комнате курьеров после получения test_response');
                setTimeout(() => {
                    sendJoinCourierRoomEvent();
                }, 500);
            });
            
            // Отправляем тестовое событие
            try {
                socketService['socket'].emit('test_event', {
                    test_id: Date.now(),
                    message: 'Тестовое сообщение для проверки WebSocket'
                });
                console.log('📤 Тестовое событие отправлено');
            } catch (error) {
                console.error('❌ Ошибка при отправке тестового события:', error);
            }
            
            // Определяем функцию для отправки события join_courier_room
            const sendJoinCourierRoomEvent = () => {
                console.log('🔄 Попытка отправки события join_courier_room напрямую');
                console.log('🔄 chatId:', chatId);
                
                if (!chatId) {
                    console.error('❌ chatId не определен, нельзя присоединиться к комнате курьеров');
                    return;
                }
                
                try {
                    // Явно преобразуем chatId к строке, чтобы избежать проблем с типами
                    const chat_id_value = String(chatId);
                    
                    // Создаем объект с данными и логируем его перед отправкой
                    const requestData = {
                        chatId: chat_id_value,
                        chat_id: chat_id_value,
                        user_info: {
                            id: user?.id || 'anonymous',
                            first_name: user?.first_name || 'Гость',
                            last_name: user?.last_name || '',
                            socket_id: socketService['socket']?.id || 'unknown'
                        },
                        test: true
                    };
                    
                    console.log('📤 Данные для отправки:', requestData);
                    
                    // Проверяем, что socket существует
                    if (!socketService['socket']) {
                        console.error('❌ Socket объект не инициализирован');
                        return;
                    }
                    
                    socketService['socket'].emit('join_courier_room', requestData);
                    console.log('📤 Событие join_courier_room отправлено напрямую');
                } catch (error) {
                    console.error('❌ Ошибка при отправке события join_courier_room:', error);
                }
            };
            
            // Через 2 секунды пробуем отправить событие для комнаты курьеров
            setTimeout(() => {
                console.log('⏱️ Сработал setTimeout для отправки события');
                sendJoinCourierRoomEvent();
            }, 2000);
            
            // Дополнительная попытка через 5 секунд
            setTimeout(() => {
                console.log('⏱️ Дополнительная попытка через 5 секунд');
                sendJoinCourierRoomEvent();
            }, 5000);
        }
    }, [isConnected, chatId, user]);

    return { isConnected };
}; 