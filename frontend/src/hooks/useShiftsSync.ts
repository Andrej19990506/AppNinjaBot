import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { socketService } from '../services/socket';
import { 
    shiftBooked, 
    shiftCanceled, 
    fetchShifts 
} from '../store/slices/shiftsSlice';
import { reserveDeleted, forceFetchReserves } from '../store/slices/reservesSlice';

/**
 * Хук для синхронизации данных о сменах через WebSocket
 * @param chatId ID чата для которого нужно получать обновления
 * @returns объект с состоянием синхронизации и методами управления
 */
export const useShiftsSync = (chatId: string) => {
    const dispatch = useDispatch<AppDispatch>();
    const isConnectedRef = useRef(false);
    const isLoadingRef = useRef(false);
    const user = useSelector((state: RootState) => state.user.user);
    
    // Загрузка данных
    const loadShifts = () => {
        if (isLoadingRef.current) return;
        
        isLoadingRef.current = true;
        dispatch(fetchShifts())
            .finally(() => {
                isLoadingRef.current = false;
            });
    };
    
    useEffect(() => {
        // Проверка необходимых условий
        if (!chatId || !user) return;
        
        // Загружаем начальные данные
        loadShifts();
        
        // Подключаемся к комнате смен чата
        const connectToShiftsRoom = () => {
            console.log(`🔄 Подключение к комнате смен чата ${chatId}`);
            socketService.emit('join_shifts_room', { chatId });
            isConnectedRef.current = true;
        };
        
        // Отключаемся от комнаты при размонтировании компонента
        const disconnectFromShiftsRoom = () => {
            if (isConnectedRef.current) {
                console.log(`🔄 Отключение от комнаты смен чата ${chatId}`);
                socketService.emit('leave_shifts_room', { chatId });
                isConnectedRef.current = false;
            }
        };
        
        // Подписка на события смен
        const subscribeToEvents = () => {
            // Успешное подключение к комнате смен
            socketService.subscribe('joined_shifts_room', (data) => {
                console.log('✅ Подключено к комнате смен:', data);
            });
            
            // Забронирована новая смена
            socketService.subscribe('shift_booked', (data) => {
                console.log('📆 Новая смена забронирована:', data);
                // Оптимистичное обновление интерфейса
                dispatch(shiftBooked(data));
            });
            
            // Смена обновлена
            socketService.subscribe('shift_updated', (data) => {
                console.log('🔄 Смена обновлена:', data);
                // Оптимистичное обновление вместо загрузки всех смен
                dispatch(shiftBooked(data));
            });
            
            // Смена отменена
            socketService.subscribe('shift_cancelled', (data) => {
                console.log('❌ Смена отменена:', data);
                // Проверяем формат данных и адаптируем для корректного вызова
                const cancellationData = typeof data === 'object' ? 
                    { shift_id: data.id || data.shiftId || data.shift_id } : 
                    { shift_id: data };
                
                dispatch(shiftCanceled(cancellationData));
            });
            
            // Пользователь удален из резерва (происходит, когда берут смену)
            socketService.subscribe('reserve_deleted', (data) => {
                console.log('🗑️ Пользователь удален из резерва:', data);
                dispatch(reserveDeleted(data));
                // Обновляем списки резервов после удаления
                dispatch(forceFetchReserves());
            });
        };
        
        // Отписка от событий
        const unsubscribeFromEvents = () => {
            socketService.unsubscribe('joined_shifts_room');
            socketService.unsubscribe('shift_booked');
            socketService.unsubscribe('shift_updated');
            socketService.unsubscribe('shift_cancelled');
            socketService.unsubscribe('reserve_deleted');
        };
        
        // Инициализация подключения и подписок
        socketService.connect().then(() => {
            connectToShiftsRoom();
            subscribeToEvents();
        });
        
        // Очистка при размонтировании
        return () => {
            unsubscribeFromEvents();
            disconnectFromShiftsRoom();
        };
    }, [dispatch, chatId, user]);
    
    // API для обновления смен
    const updateShift = (data: any) => {
        if (!chatId) {
            console.error('Нет ID чата для обновления смены');
            return;
        }
        
        // Отладочная информация о статусе старшего курьера
        console.info('🔍 Данные смены при обновлении:', {
            inputData: data,
            userIsSeniorCourier: user?.isSeniorCourier,
            isSeniorCourierFromData: data.is_senior_courier
        });
        
        // Проверяем статус старшего курьера
        const isSeniorCourierStatus = data.is_senior_courier !== undefined 
            ? data.is_senior_courier 
            : (user?.isSeniorCourier || false);
            
        console.info('⭐ Установленный статус старшего курьера:', isSeniorCourierStatus);
        
        // Оптимистично обновляем состояние перед отправкой на сервер
        const optimisticShiftData = {
            id: Date.now().toString(), // Временный ID, который будет заменен реальным ID от сервера
            user_id: data.user_id,
            date: data.date,
            shift_type: data.shift_type,
            slot_index: data.slot_index,
            chat_id: chatId,
            photo_url: data.photo_url,
            first_name: data.first_name,
            last_name: data.last_name,
            is_senior_courier: isSeniorCourierStatus
        };
        
        // Еще отладочная информация
        console.info('🔄 Оптимистичные данные смены:', optimisticShiftData);
        
        // Оптимистичное обновление UI перед отправкой на сервер
        dispatch(shiftBooked(optimisticShiftData));
        
        // Логируем для отладки статуса старшего курьера
        console.info('📡 Отправка данных на сервер при обновлении смены:', {
            chatId,
            data,
            optimisticShiftData,
            isSeniorCourier: optimisticShiftData.is_senior_courier
        });
        
        // Отправляем HTTP-запрос на обновление смены
        fetch(`${process.env.REACT_APP_API_URL || ''}/api/shifts/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...data,
                chat_id: chatId,
                is_senior_courier: isSeniorCourierStatus // Явно передаем статус старшего курьера
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            console.info('✅ Успешно обновлено на сервере:', result);
            // Обновляем UI с реальными данными с сервера
            dispatch(shiftBooked(result));
        })
        .catch(error => {
            console.error('❌ Ошибка при обновлении смены:', error);
        });
        
        // Также отправляем через WebSocket
        socketService.emit('shift_update', {
            action: 'book',
            chatId,
            shiftData: {
                ...data,
                is_senior_courier: isSeniorCourierStatus
            }
        });
        
        // Дополнительно отправляем напрямую book_shift для обеспечения совместимости
        // т.к. handle_book_shift может быть запрограммирован на прямое чтение поля is_senior_courier
        socketService.emit('book_shift', {
            ...data,
            chat_id: chatId,
            is_senior_courier: isSeniorCourierStatus
        });
    };
    
    // API для отмены смены
    const cancelShift = (shiftId: string) => {
        if (!chatId) {
            console.error('Нет ID чата для отмены смены');
            return;
        }
        
        // Оптимистично удаляем смену перед отправкой на сервер
        dispatch(shiftCanceled({ shift_id: shiftId }));
        
        // Затем отправляем запрос на сервер
        socketService.emit('shift_update', {
            action: 'cancel',
            chatId,
            shiftId
        });
    };
    
    return {
        loadShifts,
        updateShift,
        cancelShift,
        isLoading: isLoadingRef.current
    };
}; 