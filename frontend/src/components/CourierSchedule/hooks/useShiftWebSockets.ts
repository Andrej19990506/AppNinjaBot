import { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { format } from 'date-fns';
import { socketService } from '../../../services/socket';
import { shiftEvents } from '../../../store/slices/shiftsSlice';
import { fetchShifts } from '../../../store/slices/shiftsSlice';
import { AppDispatch } from '../../../store/store';

interface ShiftSlotLocal {
    id?: string;
    userId?: string;
    photo_url?: string | null;
    firstName?: string;
    lastName?: string;
    shiftType?: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

// Интерфейс для отслеживания операций перетаскивания
interface DragOperation {
    sourceType: 'day' | 'night';
    sourceIndex: number;
    targetType: 'day' | 'night';
    targetIndex: number;
    userId: string;
    timestamp: number;
}

interface UseShiftWebSocketsProps {
    date: Date;
    chatId?: string;
    forceUpdate: () => void;
    updateLocalShifts: (dayShifts: ShiftSlotLocal[], nightShifts: ShiftSlotLocal[]) => void;
    setLocalDayShifts: React.Dispatch<React.SetStateAction<ShiftSlotLocal[]>>;
    setLocalNightShifts: React.Dispatch<React.SetStateAction<ShiftSlotLocal[]>>;
    dayShifts: ShiftSlotLocal[];
    nightShifts: ShiftSlotLocal[];
    currentUserAvatar?: string;
    currentUserName?: string;
    isCurrentUserSenior: boolean;
    showSuccessMessage: (message: string) => void;
}

// Глобальный объект для отслеживания WebSocket-соединения
// Предотвращает создание нескольких соединений и их разрыв во время перетаскивания
const globalSocketTracker = {
    isDragging: false,
    pendingConnections: 0,
    reconnectTimer: null as NodeJS.Timeout | null,
    activeSlots: new Set<string>(), // Отслеживаем активные слоты для проверки API вызовов
    draggingInProgress: false, // Явный флаг для отслеживания процесса перетаскивания
    failedApiCalls: [] as Array<{timestamp: number, sourceType: string, sourceIndex: number, targetType: string, targetIndex: number, userId: string}>,
    lastApiCall: null as {timestamp: number, sourceType: string, sourceIndex: number, targetType: string, targetIndex: number, userId: string} | null,
    subscribers: new Set<() => void>(),
    notifySubscribers() {
        this.subscribers.forEach(callback => callback());
    },
    addFailedApiCall(sourceType: string, sourceIndex: number, targetType: string, targetIndex: number, userId: string) {
        this.failedApiCalls.push({
            timestamp: Date.now(),
            sourceType,
            sourceIndex,
            targetType,
            targetIndex,
            userId
        });
        console.log('[globalSocketTracker] Added failed API call:', this.failedApiCalls[this.failedApiCalls.length - 1]);
    },
    setLastApiCall(sourceType: string, sourceIndex: number, targetType: string, targetIndex: number, userId: string) {
        this.lastApiCall = {
            timestamp: Date.now(),
            sourceType,
            sourceIndex,
            targetType,
            targetIndex,
            userId
        };
        console.log('[globalSocketTracker] Set last API call:', this.lastApiCall);
    }
};

// Делаем трекер доступным глобально для отладки и межкомпонентного взаимодействия
if (typeof window !== 'undefined') {
    (window as any).globalSocketTracker = globalSocketTracker;
}

export const useShiftWebSockets = ({
    date,
    chatId,
    forceUpdate,
    updateLocalShifts,
    setLocalDayShifts,
    setLocalNightShifts,
    dayShifts,
    nightShifts,
    currentUserAvatar,
    currentUserName,
    isCurrentUserSenior,
    showSuccessMessage
}: UseShiftWebSocketsProps) => {
    const dispatch = useDispatch<AppDispatch>();
    
    // Добавляем состояние для отслеживания последних операций перетаскивания
    const [pendingDragOperations, setPendingDragOperations] = useState<DragOperation[]>([]);
    
    // Флаг для отслеживания последнего обновления состояния
    const lastUpdateRef = useRef<{
        sourceType?: 'day' | 'night';
        sourceIndex?: number;
        targetType?: 'day' | 'night';
        targetIndex?: number;
        timestamp: number;
    }>({ timestamp: 0 });

    // Обработчик событий начала операции перетаскивания
    const handleDragOperationStart = useCallback((event: CustomEvent) => {
        console.log('[useShiftWebSockets] Drag operation started:', event.detail);
        
        // Устанавливаем глобальный и локальный флаг перетаскивания
        globalSocketTracker.isDragging = true;
        globalSocketTracker.draggingInProgress = true;
        lastUpdateRef.current = {
            sourceType: event.detail.sourceType,
            sourceIndex: event.detail.sourceIndex,
            targetType: event.detail.targetType,
            targetIndex: event.detail.targetIndex,
            timestamp: Date.now()
        };
        
        if (event.detail && event.detail.item && event.detail.item.userId) {
            // Добавляем операцию в список ожидающих
            const newOperation: DragOperation = {
                sourceType: event.detail.sourceType,
                sourceIndex: event.detail.sourceIndex,
                targetType: event.detail.targetType,
                targetIndex: event.detail.targetIndex,
                userId: event.detail.item.userId,
                timestamp: Date.now()
            };
            
            setPendingDragOperations(prev => [...prev, newOperation]);
            
            // Обновляем локальное состояние сразу (оптимистично)
            // Находим и удаляем курьера из исходного слота
            if (event.detail.sourceType === 'day') {
                console.log('[useShiftWebSockets] Removing courier from day shift:', event.detail.sourceIndex);
                setLocalDayShifts(prev => 
                    prev.filter(shift => 
                        !(shift.userId === event.detail.item.userId && 
                          shift.slotIndex === event.detail.sourceIndex)
                    )
                );
                
                // Также запускаем действие Redux для синхронизации глобального состояния
                dispatch({
                    type: 'shifts/removeDayShift',
                    payload: {
                        userId: event.detail.item.userId,
                        slotIndex: event.detail.sourceIndex
                    }
                });
            } else {
                console.log('[useShiftWebSockets] Removing courier from night shift:', event.detail.sourceIndex);
                setLocalNightShifts(prev => 
                    prev.filter(shift => 
                        !(shift.userId === event.detail.item.userId && 
                          shift.slotIndex === event.detail.sourceIndex)
                    )
                );
                
                // Также запускаем действие Redux для синхронизации глобального состояния
                dispatch({
                    type: 'shifts/removeNightShift',
                    payload: {
                        userId: event.detail.item.userId,
                        slotIndex: event.detail.sourceIndex
                    }
                });
            }
        }
    }, [setLocalDayShifts, setLocalNightShifts, dispatch]);

    // Обработчик завершения операции перетаскивания
    const handleDragOperationComplete = useCallback((event: CustomEvent) => {
        console.log('[useShiftWebSockets] Drag operation completed:', event.detail);
        
        // Сбрасываем глобальный и локальный флаг перетаскивания 
        globalSocketTracker.isDragging = false;
        globalSocketTracker.draggingInProgress = false;
        lastUpdateRef.current = { timestamp: 0 };
        
        // Возможная отложенная обработка отложенных подключений
        if (globalSocketTracker.pendingConnections > 0) {
            console.log('[useShiftWebSockets] Processing pending connections after drag end');
            globalSocketTracker.notifySubscribers();
        }
        
        // Проверяем, был ли этот запрос уже анимирован в ShiftPanelContainer
        const wasAnimated = event.detail && event.detail.animated === true;
        
        if (event.detail && event.detail.item && event.detail.item.userId) {
            const userId = event.detail.item.userId;
            
            // Сохраняем информацию о последнем вызове API
            globalSocketTracker.setLastApiCall(
                event.detail.sourceType,
                event.detail.sourceIndex,
                event.detail.targetType,
                event.detail.targetIndex,
                String(userId)
            );
            
            // Контрольный вывод для проверки, был ли вызван API
            console.log('[useShiftWebSockets] API call should have happened for:', {
                userId,
                sourceType: event.detail.sourceType,
                sourceIndex: event.detail.sourceIndex,
                targetType: event.detail.targetType,
                targetIndex: event.detail.targetIndex
            });
            
            // Проверяем, есть ли текущие операции для этого пользователя
            const existingOperations = pendingDragOperations.filter(op => 
                op.userId === String(userId) || parseInt(op.userId) === userId
            );
            
            if (existingOperations.length > 0) {
                console.log('[useShiftWebSockets] Found pending operations to clean up:', existingOperations);
            
                // Удаляем все ожидающие операции для этого пользователя
                setPendingDragOperations(prev => 
                    prev.filter(op => !(op.userId === String(userId) || parseInt(op.userId) === userId))
                );
            }
            
            // Если анимация уже выполнена, сразу обновляем UI
            // Иначе добавляем небольшую задержку, чтобы дать время для анимации
            const updateUI = () => {
                // Выполняем окончательную очистку - проверяем, не остался ли аватар в исходном слоте
                // Очищаем все слоты с этим пользователем из обоих типов смен, кроме целевого слота
                if (event.detail.targetType === 'day') {
                    // Очищаем дневные смены, кроме целевого слота
                    console.log('[useShiftWebSockets] Final cleanup of day shifts except target:', event.detail.targetIndex);
                    setLocalDayShifts(prev => {
                        // Сначала отфильтровываем все аватары этого пользователя из других слотов
                        const filtered = prev.filter(shift => 
                            !(String(shift.userId) === String(userId) || parseInt(String(shift.userId)) === userId) || 
                            (shift.slotIndex === event.detail.targetIndex && shift.shiftType === 'day')
                        );
                        
                        // Проверяем, есть ли аватар в целевом слоте
                        const hasTargetAvatar = filtered.some(
                            shift => shift.slotIndex === event.detail.targetIndex && 
                                (String(shift.userId) === String(userId) || parseInt(String(shift.userId)) === userId)
                        );
                        
                        // Если нет, добавляем его
                        if (!hasTargetAvatar) {
                            console.log('[useShiftWebSockets] Target slot is empty, adding avatar');
                            const newShift: ShiftSlotLocal = {
                                id: event.detail.item.id,
                                userId: String(userId),
                                photo_url: event.detail.item.photo_url || null,
                                firstName: event.detail.item.firstName || '',
                                lastName: event.detail.item.lastName || '',
                                shiftType: 'day',
                                slotIndex: event.detail.targetIndex,
                                isSeniorCourier: Boolean(event.detail.item.isSeniorCourier)
                            };
                            return [...filtered, newShift];
                        }
                        
                        return filtered;
                    });
                    
                    // Очищаем все ночные смены с этим пользователем
                    console.log('[useShiftWebSockets] Cleaning up all night shifts for this user');
                    setLocalNightShifts(prev => 
                        prev.filter(shift => 
                            !(String(shift.userId) === String(userId) || parseInt(String(shift.userId)) === userId)
                        )
                    );
                } else if (event.detail.targetType === 'night') {
                    // Очищаем все дневные смены с этим пользователем
                    console.log('[useShiftWebSockets] Cleaning up all day shifts for this user');
                    setLocalDayShifts(prev => 
                        prev.filter(shift => 
                            !(String(shift.userId) === String(userId) || parseInt(String(shift.userId)) === userId)
                        )
                    );
                    
                    // Очищаем ночные смены, кроме целевого слота
                    console.log('[useShiftWebSockets] Final cleanup of night shifts except target:', event.detail.targetIndex);
                    setLocalNightShifts(prev => {
                        // Сначала отфильтровываем все аватары этого пользователя из других слотов
                        const filtered = prev.filter(shift => 
                            !(String(shift.userId) === String(userId) || parseInt(String(shift.userId)) === userId) || 
                            (shift.slotIndex === event.detail.targetIndex && shift.shiftType === 'night')
                        );
                        
                        // Проверяем, есть ли аватар в целевом слоте
                        const hasTargetAvatar = filtered.some(
                            shift => shift.slotIndex === event.detail.targetIndex && 
                                (String(shift.userId) === String(userId) || parseInt(String(shift.userId)) === userId)
                        );
                        
                        // Если нет, добавляем его
                        if (!hasTargetAvatar) {
                            console.log('[useShiftWebSockets] Target slot is empty, adding avatar');
                            const newShift: ShiftSlotLocal = {
                                id: event.detail.item.id,
                                userId: String(userId),
                                photo_url: event.detail.item.photo_url || null,
                                firstName: event.detail.item.firstName || '',
                                lastName: event.detail.item.lastName || '',
                                shiftType: 'night',
                                slotIndex: event.detail.targetIndex,
                                isSeniorCourier: Boolean(event.detail.item.isSeniorCourier)
                            };
                            return [...filtered, newShift];
                        }
                        
                        return filtered;
                    });
                }
                
                // Принудительно обновляем компонент после всех изменений
                forceUpdate();
            };
            
            // Если анимация уже выполнена, сразу обновляем UI
            // Иначе добавляем небольшую задержку для анимации
            if (wasAnimated) {
                updateUI();
            } else {
                // Добавляем задержку, чтобы анимация успела выполниться
                setTimeout(updateUI, 600);
            }
        }
    }, [setLocalDayShifts, setLocalNightShifts, pendingDragOperations, forceUpdate]);

    const handleShiftBooked = useCallback((data: any) => {
        console.log('[ShiftPanel] 📆 Received shift_booked event:', data);
        
        // Проверяем, что данные соответствуют текущей дате
        const shiftDate = data.date;
        const currentDateStr = format(date, 'yyyy-MM-dd');
        
        if (shiftDate === currentDateStr) {
            console.log('[ShiftPanel] 📆 Shift event matches current date, updating UI');
            
            try {
                // Создаем полный объект смены из данных события
                const shiftData: ShiftSlotLocal = {
                    id: data.id,
                    userId: String(data.user_id),
                    photo_url: data.photo_url || null,
                    firstName: data.first_name || '',
                    lastName: data.last_name || '',
                    shiftType: data.shift_type,
                    slotIndex: Number(data.slot_index),
                    isSeniorCourier: Boolean(data.is_senior_courier)
                };
                
                console.log('[ShiftPanel] 🔄 Created formatted shift data:', shiftData);
                
                // Проверяем, не является ли это ответом на операцию перетаскивания
                console.log('[ShiftPanel] 🔍 Checking if this is a drag-and-drop operation. pendingDragOperations:', pendingDragOperations);
                
                const matchedOperation = pendingDragOperations.find(op => 
                    op.userId === String(data.user_id) && 
                    op.targetType === data.shift_type && 
                    op.targetIndex === Number(data.slot_index) && 
                    (Date.now() - op.timestamp) < 10000 // Проверяем, что операция произошла не более 10 секунд назад
                );
                
                if (matchedOperation) {
                    console.log('[ShiftPanel] 🚫 This is a response to a drag operation, skipping duplicate update');
                    
                    // Удаляем операцию из списка ожидающих
                    setPendingDragOperations(prev => 
                        prev.filter(op => op !== matchedOperation)
                    );
                    
                    // ОЧИСТКА ВСЕГО: Убираем курьера из обоих типов смен для предотвращения дублирования
                    console.log('[ShiftPanel] 🧹 Aggressive cleanup: removing courier from both shift types');
                    
                    // Очищаем дневные смены
                    setLocalDayShifts(prev => {
                        const filtered = prev.filter(shift => 
                            String(shift.userId) !== String(data.user_id) || 
                            (shift.slotIndex === shiftData.slotIndex && shift.shiftType === 'day' && 
                             data.shift_type === 'day')
                        );
                        return filtered;
                    });
                    
                    // Очищаем ночные смены
                    setLocalNightShifts(prev => {
                        const filtered = prev.filter(shift => 
                            String(shift.userId) !== String(data.user_id) || 
                            (shift.slotIndex === shiftData.slotIndex && shift.shiftType === 'night' && 
                             data.shift_type === 'night')
                        );
                        return filtered;
                    });
                    
                    // Добавляем новую смену без дублирования
                    if (shiftData.shiftType === 'day') {
                        console.log('[ShiftPanel] 🔄 Updating day shifts array for drag operation');
                        setLocalDayShifts(prev => {
                            // Проверяем, нет ли уже такой смены в точно таком же слоте
                            const slotExists = prev.some(
                                shift => shift.slotIndex === shiftData.slotIndex && 
                                       String(shift.userId) === String(shiftData.userId)
                            );
                            
                            if (slotExists) {
                                console.log('[ShiftPanel] 🔄 Slot already exists, not adding duplicate');
                                return prev;
                            }
                            
                            return [...prev, shiftData];
                        });
                        
                        // Обновляем глобальное состояние Redux
                        dispatch({
                            type: 'shifts/addDayShift',
                            payload: shiftData
                        });
                    } else if (shiftData.shiftType === 'night') {
                        console.log('[ShiftPanel] 🔄 Updating night shifts array for drag operation');
                        setLocalNightShifts(prev => {
                            // Проверяем, нет ли уже такой смены в точно таком же слоте
                            const slotExists = prev.some(
                                shift => shift.slotIndex === shiftData.slotIndex && 
                                       String(shift.userId) === String(shiftData.userId)
                            );
                            
                            if (slotExists) {
                                console.log('[ShiftPanel] 🔄 Slot already exists, not adding duplicate');
                                return prev;
                            }
                            
                            return [...prev, shiftData];
                        });
                        
                        // Обновляем глобальное состояние Redux
                        dispatch({
                            type: 'shifts/addNightShift',
                            payload: shiftData
                        });
                    }
                } else {
                    // Проверяем, может быть это событие следует за предыдущей операцией перетаскивания
                    // при которой пользователь был перемещен из другого слота
                    // Ищем любую недавнюю операцию перетаскивания с тем же userId
                    console.log('[ShiftPanel] 🔍 Looking for any recent drag operation with userId:', data.user_id);
                    
                    const anyRecentDragWithSameUser = pendingDragOperations.find(op => 
                        (op.userId === String(data.user_id) || parseInt(op.userId) === data.user_id) && 
                        (Date.now() - op.timestamp) < 15000  // Увеличиваем время до 15 секунд для надежности
                    );
                    
                    // УСИЛЕННАЯ ПРОВЕРКА: Проверяем, не осталось ли старых операций перетаскивания в массиве
                    const allOldOperations = pendingDragOperations.filter(op => 
                        (Date.now() - op.timestamp) > 30000 // Старше 30 секунд
                    );
                    
                    // Удаляем старые операции, если они есть
                    if (allOldOperations.length > 0) {
                        console.log('[ShiftPanel] 🧹 Cleaning up old drag operations:', allOldOperations);
                        setPendingDragOperations(prev => 
                            prev.filter(op => !allOldOperations.includes(op))
                        );
                    }
                    
                    if (anyRecentDragWithSameUser) {
                        console.log('[ShiftPanel] 🔄 Found related drag operation for the same user:', anyRecentDragWithSameUser);
                        
                        // Удаляем операцию из списка ожидающих
                        setPendingDragOperations(prev => 
                            prev.filter(op => op !== anyRecentDragWithSameUser)
                        );
                        
                        // ОЧИСТКА ВСЕГО: Убираем курьера из обоих типов смен
                        console.log('[ShiftPanel] 🧹 Aggressive cleanup: removing courier from both shift types');
                        
                        // Очищаем дневные смены от всех упоминаний этого курьера
                        setLocalDayShifts(prev => 
                            prev.filter(shift => 
                                String(shift.userId) !== String(data.user_id)
                            )
                        );
                        
                        // Очищаем ночные смены от всех упоминаний этого курьера
                        setLocalNightShifts(prev => 
                            prev.filter(shift => 
                                String(shift.userId) !== String(data.user_id)
                            )
                        );
                        
                        // Обновляем состояние Redux для синхронизации
                        dispatch({
                            type: 'shifts/removeUserFromAllShifts',
                            payload: {
                                userId: String(data.user_id)
                            }
                        });
                        
                        // Добавляем курьера в новый слот
                        if (shiftData.shiftType === 'day') {
                            console.log('[ShiftPanel] 🔄 Adding courier to day shift slot');
                            setLocalDayShifts(prev => [...prev, shiftData]);
                            
                            // Обновляем Redux
                            dispatch({
                                type: 'shifts/addDayShift',
                                payload: shiftData
                            });
                        } else if (shiftData.shiftType === 'night') {
                            console.log('[ShiftPanel] 🔄 Adding courier to night shift slot');
                            setLocalNightShifts(prev => [...prev, shiftData]);
                            
                            // Обновляем Redux
                            dispatch({
                                type: 'shifts/addNightShift',
                                payload: shiftData
                            });
                        }
                    } else {
                        // Обычное обновление, не связанное с перетаскиванием
                        console.log('[ShiftPanel] 🔄 Regular shift update, not related to drag operation');
                    
                        // Очищаем ОБА типа смен от всех упоминаний этого курьера
                        // Это предотвратит возможные дублирования даже при обычных обновлениях
                        setLocalDayShifts(prev => 
                            prev.filter(shift => 
                                String(shift.userId) !== String(data.user_id)
                            )
                        );
                        
                        setLocalNightShifts(prev => 
                            prev.filter(shift => 
                                String(shift.userId) !== String(data.user_id)
                            )
                        );
                        
                        // Обновляем состояние Redux
                        dispatch({
                            type: 'shifts/removeUserFromAllShifts',
                            payload: {
                                userId: String(data.user_id)
                            }
                        });
                        
                        // Добавляем новую смену в нужный тип
                        if (shiftData.shiftType === 'day') {
                            setLocalDayShifts(prev => [...prev, shiftData]);
                            dispatch({
                                type: 'shifts/addDayShift',
                                payload: shiftData
                            });
                        } else if (shiftData.shiftType === 'night') {
                            setLocalNightShifts(prev => [...prev, shiftData]);
                            dispatch({
                                type: 'shifts/addNightShift',
                                payload: shiftData
                            });
                        }
                    }
                }
                
                // Принудительно обновляем компонент
                console.log('[ShiftPanel] 🔄 Forcing component update after shift_booked');
                forceUpdate();
                
            } catch (error) {
                console.error('[ShiftPanel] Error processing shift_booked event:', error);
            }
        }
    }, [date, forceUpdate, setLocalDayShifts, setLocalNightShifts, pendingDragOperations, dispatch]);

    const handleShiftUpdate = useCallback((data: any) => {
        console.log('[ShiftPanel] 🔄 Received shift_update event:', data);
        
        // Проверяем, что данные соответствуют текущей дате
        const shiftDate = data.date;
        const currentDateStr = format(date, 'yyyy-MM-dd');
        
        if (shiftDate === currentDateStr) {
            console.log('[ShiftPanel] 🔄 Shift update event matches current date, updating UI');
            
            try {
                // Создаем полный объект смены из данных события
                const shiftData: ShiftSlotLocal = {
                    id: data.id,
                    userId: String(data.user_id),
                    photo_url: data.photo_url || null,
                    firstName: data.first_name || '',
                    lastName: data.last_name || '',
                    shiftType: data.shift_type,
                    slotIndex: Number(data.slot_index),
                    isSeniorCourier: Boolean(data.is_senior_courier)
                };
                
                console.log('[ShiftPanel] 🔄 Created formatted shift data for update:', shiftData);
                
                // Очищаем ОБА типа смен от всех упоминаний этого курьера
                // для предотвращения дублирования
                setLocalDayShifts(prev => 
                    prev.filter(shift => 
                        String(shift.userId) !== String(data.user_id)
                    )
                );
                
                setLocalNightShifts(prev => 
                    prev.filter(shift => 
                        String(shift.userId) !== String(data.user_id)
                    )
                );
                
                // Обновляем состояние Redux для синхронизации
                dispatch({
                    type: 'shifts/removeUserFromAllShifts',
                    payload: {
                        userId: String(data.user_id)
                    }
                });
                
                // Добавляем обновленную смену в нужный тип
                if (shiftData.shiftType === 'day') {
                    console.log('[ShiftPanel] 🔄 Adding updated shift to day shifts');
                    setLocalDayShifts(prev => [...prev, shiftData]);
                    dispatch({
                        type: 'shifts/addDayShift',
                        payload: shiftData
                    });
                } else if (shiftData.shiftType === 'night') {
                    console.log('[ShiftPanel] 🔄 Adding updated shift to night shifts');
                    setLocalNightShifts(prev => [...prev, shiftData]);
                    dispatch({
                        type: 'shifts/addNightShift',
                        payload: shiftData
                    });
                }
                
                // Принудительно обновляем компонент
                console.log('[ShiftPanel] 🔄 Forcing component update after shift_update');
                forceUpdate();
                
            } catch (error) {
                console.error('[ShiftPanel] Error processing shift_update event:', error);
            }
        }
    }, [date, forceUpdate, setLocalDayShifts, setLocalNightShifts, dispatch]);

    // Обработчик события перехода из резерва в смену
    const handleUserMovedFromReserveToShift = useCallback((data: any) => {
        console.log('[ShiftPanel] 🔄 Direct event: userMovedFromReserveToShift received:', data);
        
        // Проверяем, что событие относится к этой же дате
        if (data.date === format(date, 'yyyy-MM-dd')) {
            console.log('[ShiftPanel] 🔄 Event is for the current date, forcing immediate update');
            
            // Принудительно запрашиваем актуальные данные
            dispatch(fetchShifts())
                .then(() => {
                    // После получения данных обновляем локальное состояние
                    console.log('[ShiftPanel] 🔄 Shifts data refreshed, updating local state');
                    updateLocalShifts(dayShifts, nightShifts);
                    forceUpdate();
                });
            
            // Добавляем оптимистичный UI апдейт, если знаем детали нового слота
            if (data.shiftType && typeof data.slotIndex === 'number' && data.userId) {
                console.log('[ShiftPanel] 🔄 Adding optimistic UI update for new shift');
                
                // Создаем оптимистичный объект смены
                const optimisticShift = {
                    id: `temp-${Date.now()}`,
                    userId: data.userId,
                    photo_url: currentUserAvatar,
                    firstName: currentUserName?.split(' ')[0] || '',
                    lastName: currentUserName?.split(' ')[1] || '',
                    shiftType: data.shiftType,
                    slotIndex: data.slotIndex,
                    isSeniorCourier: isCurrentUserSenior,
                    date: format(date, 'yyyy-MM-dd')
                };
                
                // Добавляем в соответствующий список смен
                if (data.shiftType === 'day') {
                    setLocalDayShifts(prev => [...prev, optimisticShift]);
                } else if (data.shiftType === 'night') {
                    setLocalNightShifts(prev => [...prev, optimisticShift]);
                }
                
                // Показываем сообщение об успешном переходе
                showSuccessMessage('Успешный переход из резерва в смену');
            }
        }
    }, [
        date, 
        dispatch, 
        forceUpdate, 
        updateLocalShifts, 
        dayShifts, 
        nightShifts, 
        setLocalDayShifts, 
        setLocalNightShifts, 
        currentUserAvatar, 
        currentUserName, 
        isCurrentUserSenior, 
        showSuccessMessage
    ]);

    useEffect(() => {
        // Подписываемся на событие начала перетаскивания
        document.addEventListener('dragOperationStart', handleDragOperationStart as EventListener);
        // Подписываемся на событие завершения перетаскивания
        document.addEventListener('dragOperationComplete', handleDragOperationComplete as EventListener);
        
        return () => {
            document.removeEventListener('dragOperationStart', handleDragOperationStart as EventListener);
            document.removeEventListener('dragOperationComplete', handleDragOperationComplete as EventListener);
        };
    }, [handleDragOperationStart, handleDragOperationComplete]);

    useEffect(() => {
        // Функция для установки слушателей
        const setupWebSocketListeners = () => {
            console.log('[ShiftPanel] Setting up WebSocket listeners for shifts');
            
            // Подписка на новые смены
            socketService.subscribe('shift_booked', handleShiftBooked);
            
            // Подписка на обновления смен
            socketService.subscribe('shift_update', handleShiftUpdate);
            
            // Подписка на обновления резервов
            socketService.subscribe('reserve_deleted', (data: any) => {
                console.log('[ShiftPanel] 🗑️ DIRECT reserve_deleted event received:', data);
                
                // Просто один раз обновляем локальное состояние без таймеров
                updateLocalShifts(dayShifts, nightShifts);
                forceUpdate();
            });
        };
        
        // Функция для очистки подписок
        const cleanupWebSocketListeners = () => {
            console.log('[ShiftPanel] Cleaning up WebSocket listeners for shifts');
            socketService.unsubscribe('shift_booked');
            socketService.unsubscribe('shift_update');
            socketService.unsubscribe('reserve_deleted');
            socketService.off('shift_booked');
        };
        
        // Устанавливаем слушатели
        setupWebSocketListeners();
        
        // Очистка при размонтировании компонента
        return () => {
            cleanupWebSocketListeners();
        };
    }, [
        dispatch, 
        chatId, 
        date, 
        forceUpdate, 
        dayShifts, 
        nightShifts, 
        handleShiftBooked, 
        handleShiftUpdate,
        updateLocalShifts
    ]);

    // Отдельный эффект для прямых событий системы синхронизации
    useEffect(() => {
        console.log('[ShiftPanel] Setting up direct sync event listeners');
        
        // Подписываемся на событие
        const unsubscribe = shiftEvents.on('userMovedFromReserveToShift', handleUserMovedFromReserveToShift);
        
        // Отписываемся при размонтировании
        return () => {
            unsubscribe();
        };
    }, [handleUserMovedFromReserveToShift]);

    // Отдельный хук для отслеживания и проверки API вызовов
    useEffect(() => {
        // Функция для проверки, был ли вызов API, каждые 3 секунды
        const checkApiCalls = () => {
            if (globalSocketTracker.lastApiCall) {
                const timeSinceLastCall = Date.now() - globalSocketTracker.lastApiCall.timestamp;
                
                // Если прошло более 3 секунд с последнего API вызова и нет ответа
                if (timeSinceLastCall > 3000) {
                    console.log('[useShiftWebSockets] No response for last API call after 3 seconds:', globalSocketTracker.lastApiCall);
                    
                    // Добавляем в список неудачных вызовов API
                    globalSocketTracker.addFailedApiCall(
                        globalSocketTracker.lastApiCall.sourceType,
                        globalSocketTracker.lastApiCall.sourceIndex,
                        globalSocketTracker.lastApiCall.targetType,
                        globalSocketTracker.lastApiCall.targetIndex,
                        globalSocketTracker.lastApiCall.userId
                    );
                    
                    // Сбрасываем последний вызов API
                    globalSocketTracker.lastApiCall = null;
                }
            }
        };
        
        // Запускаем проверку каждые 3 секунды
        const interval = setInterval(checkApiCalls, 3000);
        
        return () => {
            clearInterval(interval);
        };
    }, []);

    return {
        // Возвращаем необходимые функции и состояния
        handleShiftBooked,
        handleShiftUpdate,
        handleUserMovedFromReserveToShift
    };
};

export default useShiftWebSockets; 