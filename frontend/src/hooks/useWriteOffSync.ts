import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppDispatch } from '../store/hooks';
import { useWebSocket } from './useWebSocket';
import { 
    fetchWriteOffs, 
    fetchWriteOffsByDate 
} from '../store/slices/writeOffSlice';
import { WriteOffItem, WriteOffChat } from '../types/writeOff';

// Интерфейс для локального флага обновления
interface LocalUpdateFlag {
    id: string;
    action: 'create' | 'update' | 'delete';
    timestamp: number;
}

/**
 * Хук для работы с синхронизацией данных списания через WebSocket и REST API
 */
export const useWriteOffSync = (
    selectedChat: WriteOffChat | null,
    selectedDate: Date,
    animateNewItem?: (element: HTMLElement) => void,
    animateItemUpdate?: (element: HTMLElement) => void,
    animateItemRemoval?: (element: HTMLElement) => void
) => {
    const dispatch = useAppDispatch();
    const { joinRoom, leaveRoom } = useWebSocket();
    const localUpdateFlags = useRef<LocalUpdateFlag[]>([]);
    const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
    
    // Форматирование даты для API
    const formatDate = useCallback((date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }, []);

    // Функция для установки флага локального обновления
    const setLocalUpdateFlag = useCallback((writeOffId: string, action: 'create' | 'update' | 'delete'): void => {
        const flagKey = `local_update_${writeOffId}_${action}_${Date.now()}`;
        console.log('🚩 [WriteOffSync] Установка флага локального обновления:', {
            id: writeOffId,
            action,
            flagKey
        });
        
        // Сохраняем в sessionStorage
        sessionStorage.setItem(flagKey, 'true');
        
        // Добавляем в локальный массив
        localUpdateFlags.current.push({
            id: writeOffId,
            action,
            timestamp: Date.now()
        });
        
        // Автоматически очищаем флаг через 5 секунд
        setTimeout(() => {
            console.log('🧹 [WriteOffSync] Автоматическая очистка флага:', flagKey);
            sessionStorage.removeItem(flagKey);
            
            // Очищаем и из локального массива
            localUpdateFlags.current = localUpdateFlags.current.filter(
                flag => !(flag.id === writeOffId && flag.action === action)
            );
        }, 5000);
    }, []);
    
    // Функция для проверки наличия флага локального обновления
    const hasLocalUpdateFlag = useCallback((writeOffId: string): boolean => {
        const hasFlag = Object.keys(sessionStorage).some(key => 
            key.startsWith(`local_update_${writeOffId}_`) && 
            sessionStorage.getItem(key) === 'true'
        );
        
        if (hasFlag) {
            console.log('🚩 [WriteOffSync] Обнаружен активный флаг локального обновления:', writeOffId);
        }
        
        return hasFlag;
    }, []);
    
    // Функция для очистки всех флагов для конкретного списания
    const clearLocalUpdateFlags = useCallback((writeOffId: string): void => {
        console.log('🧹 [WriteOffSync] Очистка всех флагов для списания:', writeOffId);
        
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(`local_update_${writeOffId}_`)) {
                console.log('🧹 [WriteOffSync] Удаление флага:', key);
                sessionStorage.removeItem(key);
            }
        });
        
        // Очищаем и из локального массива
        localUpdateFlags.current = localUpdateFlags.current.filter(
            flag => flag.id !== writeOffId
        );
    }, []);

    // Функция принудительной синхронизации с сервером
    const forceSync = useCallback(async () => {
        if (!selectedChat?.chat_id) return;
        
        const dateStr = formatDate(selectedDate);
        console.log(`🔄 [WriteOffSync] Принудительная синхронизация с сервером для даты ${dateStr}...`);
        
        try {
            await dispatch(fetchWriteOffsByDate({
                chatId: selectedChat.chat_id,
                date: selectedDate 
            }));
            console.log('✅ [WriteOffSync] Данные успешно синхронизированы с сервером');
            return true;
        } catch (error) {
            console.error('❌ [WriteOffSync] Ошибка при синхронизации данных:', error);
            return false;
        }
    }, [selectedChat?.chat_id, selectedDate, dispatch, formatDate]);
    
    // Подключение к WebSocket комнате для выбранного чата
    const connectToRoom = useCallback(() => {
        if (!selectedChat?.chat_id) return;
        
        console.log('🔌 [WriteOffSync] Подключение к комнате списаний:', selectedChat.chat_id);
        
        // Используем user из Redux store
        const user = {
            user_id: 'current_user_id', // Замените на получение ID из store
            first_name: 'User',    // Замените на получение имени из store
        };
        
        joinRoom(selectedChat.chat_id, user);
    }, [selectedChat?.chat_id, joinRoom]);
    
    // Отключение от WebSocket комнаты
    const disconnectFromRoom = useCallback(() => {
        if (!selectedChat?.chat_id) return;
        
        console.log('👋 [WriteOffSync] Отключение от комнаты списаний:', selectedChat.chat_id);
        
        const user = {
            user_id: 'current_user_id', // Замените на получение ID из store
            first_name: 'User',    // Замените на получение имени из store
        };
        
        leaveRoom(selectedChat.chat_id, user);
    }, [selectedChat?.chat_id, leaveRoom]);
    
    // Обработчик события создания списания
    const handleWriteOffCreated = useCallback((data: any, setWriteOffItems: Function) => {
        console.log('📝 [WriteOff] Получено уведомление о создании списания', {
            id: data?.writeOffItem?.id || 'неизвестно', 
            chatId: data?.chatId
        });
        
        if (selectedChat && data.chatId === selectedChat.chat_id) {
            // Проверяем наличие флага локального обновления
            if (data.writeOffItem && hasLocalUpdateFlag(data.writeOffItem.id)) {
                return; // Игнорируем локальные обновления
            }
            
            setWriteOffItems((prevItems: WriteOffItem[]) => {
                if (data.writeOffItem && !prevItems.some(item => item.id === data.writeOffItem.id)) {
                    const newItems = [...prevItems, data.writeOffItem];
                    
                    // После обновления состояния, пытаемся найти элемент в DOM для анимации
                    setTimeout(() => {
                        const newElement = document.querySelector(`[data-write-off-id="${data.writeOffItem.id}"]`);
                        if (newElement && animateNewItem) {
                            animateNewItem(newElement as HTMLElement);
                        }
                    }, 50);
                    
                    return newItems;
                }
                return prevItems;
            });
        }
    }, [selectedChat?.chat_id, animateNewItem, hasLocalUpdateFlag]);
    
    // Обработчик события обновления списания
    const handleWriteOffUpdated = useCallback((data: any, setWriteOffItems: Function) => {
        console.log('🔄 [WriteOff] Получено уведомление об обновлении списания', {
            id: data?.writeOffItem?.id || 'неизвестно', 
            chatId: data?.chatId
        });
        
        if (selectedChat && data.chatId === selectedChat.chat_id) {
            // Проверяем наличие флага локального обновления
            if (data.writeOffItem && hasLocalUpdateFlag(data.writeOffItem.id)) {
                return; // Игнорируем локальные обновления
            }
            
            setWriteOffItems((prevItems: WriteOffItem[]) => {
                const updatedItems = prevItems.map(item => {
                    if (item.id === data.writeOffItem.id) {
                        return data.writeOffItem;
                    }
                    return item;
                });
                
                return updatedItems;
            });
        }
    }, [selectedChat?.chat_id, hasLocalUpdateFlag]);
    
    // Обработчик события удаления списания
    const handleWriteOffDeleted = useCallback((data: any, setWriteOffItems: Function) => {
        console.log('🗑️ [WriteOff] Получено уведомление об удалении списания', {
            id: data?.writeOffId || data?.id || 'неизвестно', 
            chatId: data?.chatId
        });
        
        if (selectedChat && data.chatId === selectedChat.chat_id) {
            const itemId = data.writeOffId || data.id;
            
            if (!itemId) {
                console.error('❌ [WriteOff] Отсутствует ID элемента для удаления');
                return;
            }
            
            // Проверяем наличие флага локального обновления
            if (hasLocalUpdateFlag(itemId)) {
                return; // Игнорируем локальные обновления
            }
            
            // Запускаем анимацию удаления перед обновлением состояния
            const element = document.querySelector(`[data-write-off-id="${itemId}"]`);
            if (element && animateItemRemoval) {
                animateItemRemoval(element as HTMLElement);
                
                // Добавляем небольшую задержку перед обновлением состояния
                setTimeout(() => {
                    setWriteOffItems((prevItems: WriteOffItem[]) => 
                        prevItems.filter(item => item.id !== itemId)
                    );
                }, 300); // Задержка для завершения анимации
            } else {
                // Если нет анимации, просто обновляем состояние
                setWriteOffItems((prevItems: WriteOffItem[]) => 
                    prevItems.filter(item => item.id !== itemId)
                );
            }
            
            // Обновляем Redux
            dispatch({
                type: 'writeOff/updateChatWriteOffs',
                payload: {
                    chatId: data.chatId,
                    writeOffId: itemId,
                    action: 'delete'
                }
            });
        }
    }, [selectedChat?.chat_id, animateItemRemoval, hasLocalUpdateFlag, dispatch]);

    // Настройка периодической синхронизации данных
    useEffect(() => {
        if (selectedChat?.chat_id && isAutoSyncEnabled) {
            console.log('🔄 [WriteOffSync] Выполнение начальной синхронизации для чата:', selectedChat.chat_id);
            
            // Выполняем первичную синхронизацию
            forceSync();
            
            return () => {
                // Не требуется очистка, так как интервал не используется
            };
        }
    }, [selectedChat?.chat_id, selectedDate, forceSync, isAutoSyncEnabled]);

    // При изменении чата подключаемся к соответствующей WebSocket комнате
    useEffect(() => {
        if (selectedChat?.chat_id) {
            connectToRoom();
            
            return () => {
                disconnectFromRoom();
            };
        }
    }, [selectedChat?.chat_id, connectToRoom, disconnectFromRoom]);

    return {
        forceSync,
        setLocalUpdateFlag,
        hasLocalUpdateFlag,
        clearLocalUpdateFlags,
        handleWriteOffCreated,
        handleWriteOffUpdated,
        handleWriteOffDeleted,
        connectToRoom,
        disconnectFromRoom,
        isAutoSyncEnabled,
        setIsAutoSyncEnabled
    };
}; 