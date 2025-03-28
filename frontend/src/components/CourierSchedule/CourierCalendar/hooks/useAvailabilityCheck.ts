import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useWebSocketConnection } from '../../../../hooks/useWebSocketConnection';
import { socketService } from '../../../../services/socket';
import { fetchAccessSettings, fetchShifts } from '../../../../store/slices/shiftsSlice';

interface AvailabilityUpdate {
    timestamp: string;
    message: string;
    chat_id: string;
    refresh_required?: boolean;
    stats?: {
        total_groups: number;
        successful_sends: number;
        failed_groups: string[];
    };
}

export const useAvailabilityCheck = (chatId?: string, refreshCalendar?: () => void) => {
    const dispatch = useDispatch();
    const { isConnected } = useWebSocketConnection(chatId);

    // Функция для обновления данных календаря
    const handleRefreshCalendar = useCallback(() => {
        console.log('🔄 Обновление данных календаря после получения уведомления WebSocket');
        
        if (!chatId) {
            console.warn('⚠️ Невозможно обновить календарь - chatId не определен');
            return;
        }
        
        try {
            // Обновляем настройки доступа из API
            dispatch(fetchAccessSettings({ chatId }) as any);
            console.log('✅ Запрос на обновление настроек доступа отправлен');
            
            // Обновляем смены из API
            dispatch(fetchShifts({ chatId }) as any);
            console.log('✅ Запрос на обновление смен отправлен');
            
            // Если передана функция обновления календаря, вызываем её
            if (refreshCalendar && typeof refreshCalendar === 'function') {
                refreshCalendar();
                console.log('✅ Вызвана функция принудительного обновления UI календаря');
            }
        } catch (error) {
            console.error('❌ Ошибка при обновлении данных календаря:', error);
        }
    }, [chatId, dispatch, refreshCalendar]);

    useEffect(() => {
        // Если chatId отсутствует, прекращаем выполнение хука
        if (!chatId) {
            console.log('useAvailabilityCheck: chatId is undefined, skipping availability check');
            return;
        }
        
        if (!socketService['socket'] || !isConnected) {
            console.warn(`WebSocket не подключен к комнате курьеров с chatId: ${chatId}`);
            return;
        }

        console.log(`✅ useAvailabilityCheck: соединение установлено, chatId=${chatId}`);
        console.log('🔌 Состояние соединения:', {
            isConnected,
            socketId: socketService['socket']?.id,
            chatId
        });

        // Пробуем вручную подключиться к комнате курьеров после проверки доступности
        try {
            console.log('🔄 useAvailabilityCheck: Попытка подключения к комнате курьеров');
            socketService.joinCourierRoom(chatId, {
                id: null,
                first_name: 'Availability Check',
                last_name: ''
            });
        } catch (error) {
            console.error('❌ Ошибка при подключении к комнате курьеров:', error);
        }

        const handleAvailabilityUpdate = (data: AvailabilityUpdate) => {
            try {
                console.log('📣 Получено обновление доступности дат:', data);
                
                // Проверяем, что обновление относится к нашему чату
                if (data.chat_id && data.chat_id !== chatId) {
                    console.log(`⏩ Пропуск обновления для другого чата (${data.chat_id}), наш чат: ${chatId}`);
                    return;
                }
                
                // Проверяем наличие необходимых данных
                if (!data.timestamp || !data.message) {
                    console.error('📛 Получены некорректные данные:', data);
                    return;
                }

                // Показываем уведомление пользователю (если возможно)
                try {
                    // Проверка поддержки уведомлений в браузере
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('Обновление расписания', {
                            body: data.message,
                            icon: '/logo192.png'
                        });
                    }
                } catch (notificationError) {
                    console.warn('⚠️ Ошибка при отправке уведомления:', notificationError);
                }

                // Обновляем данные календаря
                handleRefreshCalendar();

                // Логируем статистику, если она есть
                if (data.stats) {
                    console.log('📊 Статистика отправки уведомлений:', {
                        total: data.stats.total_groups,
                        successful: data.stats.successful_sends,
                        failed: data.stats.failed_groups.length
                    });
                }
            } catch (error) {
                console.error('❌ Ошибка при обработке обновления:', error);
            }
        };

        const handleRefreshCommand = (data: any) => {
            try {
                console.log('🔄 Получена команда на обновление календаря:', data);
                
                // Проверяем, что команда относится к нашему чату
                if (data.chat_id && data.chat_id !== chatId) {
                    console.log(`⏩ Пропуск команды для другого чата (${data.chat_id}), наш чат: ${chatId}`);
                    return;
                }
                
                // Обновляем данные календаря
                handleRefreshCalendar();
                
            } catch (error) {
                console.error('❌ Ошибка при обработке команды обновления:', error);
            }
        };

        const handleGlobalRefresh = (data: any) => {
            try {
                console.log('🌐 Получена глобальная команда обновления:', data);
                
                // Обновляем данные календаря
                handleRefreshCalendar();
                
            } catch (error) {
                console.error('❌ Ошибка при обработке глобальной команды обновления:', error);
            }
        };

        const handleError = (error: Error) => {
            console.error('❌ Ошибка WebSocket:', error);
        };

        // Подписываемся на события
        socketService['socket'].on('availability_update', handleAvailabilityUpdate);
        socketService['socket'].on('refresh_calendar', handleRefreshCommand);
        socketService['socket'].on('global_refresh', handleGlobalRefresh);
        socketService['socket'].on('error', handleError);

        console.log('✅ Подписка на WebSocket события активна');

        // Очистка при размонтировании
        return () => {
            try {
                socketService['socket']?.off('availability_update', handleAvailabilityUpdate);
                socketService['socket']?.off('refresh_calendar', handleRefreshCommand);
                socketService['socket']?.off('global_refresh', handleGlobalRefresh);
                socketService['socket']?.off('error', handleError);
                console.log('🧹 Отписка от WebSocket событий выполнена');
            } catch (cleanupError) {
                console.error('❌ Ошибка при отписке от WebSocket событий:', cleanupError);
            }
        };
    }, [chatId, isConnected, handleRefreshCalendar]);
    
    return { refreshCalendar: handleRefreshCalendar };
}; 