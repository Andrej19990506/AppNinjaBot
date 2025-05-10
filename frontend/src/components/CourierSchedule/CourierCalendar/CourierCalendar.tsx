import React, { useEffect, useCallback } from 'react';
import { CalendarProps } from './types';
import { socketService } from '../../../services/socket';
import { joinCourierRoom } from '../../../services/websocketHelper';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { addNotification, NotificationTypes } from '../../../store/slices/notificationSlice';
import { useAppDispatch } from '../../../store/hooks';

const CourierCalendar: React.FC<CalendarProps> = ({
    onShiftSelect,
    selectedDate,
    currentUserId,
    currentUserAvatar,
    currentUserName,
    onClose,
    chatId,
    accessSettings,
    refetchData
}) => {
    // Используем хук useWebSocket для WebSocket функционала
    const { socket } = useWebSocket();
    const dispatch = useAppDispatch();

    // Функция для подключения к комнате курьеров
    const connectToCourierRoom = useCallback(() => {
        if (!chatId || !currentUserId) {
            console.warn('⚠️ Отсутствует chatId или currentUserId для подключения к комнате курьеров');
            return;
        }

        console.log(`🚀 Присоединение к комнате курьеров для chatId=${chatId}`);
        try {
            joinCourierRoom(String(chatId), {
                id: currentUserId,
                first_name: currentUserName || 'Неизвестный курьер',
                last_name: '',
                socket_id: socket?.id || 'unknown',
                avatar: currentUserAvatar
            });
        } catch (error) {
            console.error('❌ Ошибка при присоединении к комнате курьеров:', error);
        }
    }, [chatId, currentUserId, currentUserName, currentUserAvatar, socket]);

    useEffect(() => {
        console.log('🔍 CourierCalendar инициализирован');
        console.log('🔍 ChatId:', chatId);
        console.log('🔍 SelectedDate:', selectedDate);
        console.log('🔍 CurrentUserId:', currentUserId);
        console.log('🔍 AccessSettings:', accessSettings);
        
        // Подключаемся к комнате курьеров
        if (socketService.isConnected()) {
            connectToCourierRoom();
        } else {
            console.log('⏳ WebSocket не подключен, ожидаем подключения...');
            socketService.connect().then(connected => {
                if (connected) {
                    console.log('✅ WebSocket подключен, присоединяемся к комнате курьеров');
                    connectToCourierRoom();
                } else {
                    console.error('❌ Не удалось подключиться к WebSocket');
                }
            });
        }

        // Обработчик уведомлений
        const handleNotification = (data: any) => {
            console.log('=== 📢 Получено уведомление в календаре ===');
            console.log('📊 Данные:', data);
            
            // Проверяем, что это действительно уведомление
            if (data.type === 'notification' && data.data?.message) {
                dispatch(addNotification({
                    id: `calendar-notification-${Date.now()}`,
                    type: NotificationTypes.INFO,
                    message: data.data.message.replace(/<\/?[^>]+(>|$)/g, ''), // Удаляем HTML-теги
                    autoHideDuration: 10000,
                    isToast: true
                }));
            }
        };

        // Обработчик обновлений календаря
        const handleCalendarUpdate = (data: any) => {
            console.log('=== 📅 Получено обновление календаря ===');
            console.log('📊 Данные:', data);
            
            // Проверяем, что это действительно обновление календаря
            if (data.type === 'calendar_update' && data.settings) {
                console.log('⚙️ Получены новые настройки доступности:', data.settings);
                // Обновляем данные календаря
                refetchData?.();
            }
        };

        if (socket) {
            // Подписываемся на уведомления
            socket.on('notification', handleNotification);
            socket.on('global_notification', handleNotification);
            
            // Подписываемся на обновления календаря
            socket.on('calendar_update', handleCalendarUpdate);
        }

        // Очистка при размонтировании
        return () => {
            if (socket) {
                socket.off('notification', handleNotification);
                socket.off('global_notification', handleNotification);
                socket.off('calendar_update', handleCalendarUpdate);
            }
        };
    }, [chatId, selectedDate, currentUserId, accessSettings, connectToCourierRoom, socket, refetchData, dispatch]);

    console.log('=== 📅 CourierCalendar: Инициализация компонента ===');
    console.log('🔑 ChatId:', chatId);
    console.log('👤 CurrentUserId:', currentUserId);
    console.log('🌐 SelectedDate:', selectedDate);
    console.log('⚙️ AccessSettings:', accessSettings);

    // Используем временный JSX для отладки
    return (
        <div className="courier-calendar">
            <div className="debug-info" style={{ display: "none" }}>
                <h3>Отладочная информация:</h3>
                <p>ChatId: {chatId}</p>
                <p>SelectedDate: {selectedDate?.toString()}</p>
                <p>CurrentUserId: {currentUserId}</p>
                <p>WebSocket подключен: {socketService.isConnected() ? 'Да' : 'Нет'}</p>
            </div>
            {/* Здесь должен быть оригинальный JSX компонента */}
        </div>
    );
}

export default CourierCalendar; 