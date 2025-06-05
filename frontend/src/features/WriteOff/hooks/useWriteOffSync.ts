// @ts-nocheck
import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppDispatch } from '@/shared/store/hooks';
import { useWebSocket } from '@/features/WriteOff/hooks/useWebSocket';
import { 
    fetchWriteOffs
} from '@/features/WriteOff/store/writeOffSlice';
import { WriteOffItem, WriteOffChat } from '@/types/writeOff';

// Интерфейс для локального флага обновления
interface LocalUpdateFlag {
    id: string;
    action: 'create' | 'update' | 'delete';
    timestamp: number;
}

export const useWriteOffSync = (
    selectedChat: WriteOffChat | null,
    selectedDate: Date,
    animateNewItem?: (element: HTMLElement) => void,
    animateItemUpdate?: (element: HTMLElement) => void,
    animateItemRemoval?: (element: HTMLElement) => void
) => {
    const dispatch = useAppDispatch();
    const { joinRoom } = useWebSocket();
    const localUpdateFlags = useRef<LocalUpdateFlag[]>([]);
    const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
    
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
            await dispatch(fetchWriteOffs({
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
        
        const user = {
            user_id: 'current_user_id', 
            first_name: 'User',  
        };
        
        joinRoom(selectedChat.chat_id, user);
    }, [selectedChat?.chat_id, joinRoom]);
    
    const handleWriteOffCreated = useCallback((data: any, setWriteOffItems: Function) => {
        console.log('📝 [WriteOff] Получено уведомление о создании списания', {
            id: data?.writeOffItem?.id || 'неизвестно', 
            chatId: data?.chatId
        });
        
        if (selectedChat && data.chatId === selectedChat.chat_id) {
 
            if (data.writeOffItem && hasLocalUpdateFlag(data.writeOffItem.id)) {
                return; 
            }
            
            setWriteOffItems((prevItems: WriteOffItem[]) => {
                if (data.writeOffItem && !prevItems.some(item => item.id === data.writeOffItem.id)) {
                    const newItems = [...prevItems, data.writeOffItem];
                
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
            if (data.writeOffItem && hasLocalUpdateFlag(data.writeOffItem.id)) {
                return; 
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
            
        
            if (hasLocalUpdateFlag(itemId)) {
                return; 
            }
            
            // Запускаем анимацию удаления перед обновлением состояния
            const element = document.querySelector(`[data-write-off-id="${itemId}"]`);
            if (element && animateItemRemoval) {
                animateItemRemoval(element as HTMLElement);
                
                setTimeout(() => {
                    setWriteOffItems((prevItems: WriteOffItem[]) => 
                        prevItems.filter(item => item.id !== itemId)
                    );
                }, 300); // Задержка для завершения анимац
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
            };
        }
    }, [selectedChat?.chat_id, selectedDate, forceSync, isAutoSyncEnabled]);

    // При изменении чата подключаемся к соответствующей WebSocket комнате
    useEffect(() => {
        if (selectedChat?.chat_id) {
            connectToRoom();
        }
    }, [selectedChat?.chat_id, connectToRoom]);

    return {
        forceSync,
        setLocalUpdateFlag,
        hasLocalUpdateFlag,
        clearLocalUpdateFlags,
        handleWriteOffCreated,
        handleWriteOffUpdated,
        handleWriteOffDeleted,
        connectToRoom,
        isAutoSyncEnabled,
        setIsAutoSyncEnabled
    };
}; 