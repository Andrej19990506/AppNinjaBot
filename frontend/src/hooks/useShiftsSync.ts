// @ts-nocheck
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
import config from '../config';

/**
 * Хук для синхронизации данных о сменах через WebSocket
 * @param chatId ID чата для которого нужно получать обновления
 * @returns объект с состоянием синхронизации и методами управления
 */
export const useShiftsSync = (chatId: string) => {
    const dispatch = useDispatch<AppDispatch>();
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
        if (!chatId || !user) return;
        
        loadShifts();
        
        // Подписка на события смен
        const subscribeToEvents = () => {
            // Забронирована новая смена
            socketService.subscribe('shift_booked', (data) => {
                console.log('✅ Смена забронирована:', data);
                dispatch(shiftBooked(data));
                // Если смена взята, нужно удалить пользователя из резерва на этот день
                dispatch(reserveDeleted({ userId: data.user_id, date: data.date }));
            });
            
            // Смена обновлена
            socketService.subscribe('shift_updated', (data) => {
                console.log('🔄 Смена обновлена (например, перетаскивание):', data);
                // Просто перезагружаем смены, чтобы получить актуальное состояние
                loadShifts();
            });
            
            // Смена отменена
            socketService.subscribe('shift_cancelled', (data) => {
                console.log('❌ Смена отменена:', data);
                dispatch(shiftCanceled(data));
            });
        };
        
        const unsubscribeFromEvents = () => {
            socketService.unsubscribe('shift_booked');
            socketService.unsubscribe('shift_updated');
            socketService.unsubscribe('shift_cancelled');
        };
        
        // Просто подписываемся на события
        subscribeToEvents();
        
        return () => {
            unsubscribeFromEvents();
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
        fetch(`${config.API_URL}/couriers/shifts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: data.user_id,
                date: data.date,
                shift_type: data.shift_type,
                slot_index: data.slot_index,
                chat_id: chatId,
                photo_url: data.photo_url,
                first_name: data.first_name,
                last_name: data.last_name,
                is_senior_courier: isSeniorCourierStatus
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