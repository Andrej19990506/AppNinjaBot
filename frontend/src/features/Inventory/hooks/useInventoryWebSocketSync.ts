import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import { socketService } from '@shared/services/socketService';
import { logger } from '@shared/utils/logger';
import { InventoryMetadata, InventoryItem } from '@/types/inventoryTypes';
import { 
    selectSelectedChatId, 
    fetchItemHistory, 
    fetchChatInventory,
    receiveItemUpdate
} from '@/store/slices/inventorySlice';
import { syncChatWithTemplate, markTemplateChangesViewed, getChatInventory } from '@features/Inventory/services/inventoryApi';
import { addNotification } from '@shared/store/notificationSlice/notificationSlice';
import { NotificationTypes } from '@shared/store/notificationSlice/notificationTypes';

// Интерфейс для данных об изменениях шаблона
interface TemplateChanges {
    new_items: string[];
    removed_items: string[];
    summary: {
        added_items: number;
        removed_items: number;
        preserved_items: number;
    };
}

/**
 * Хук для подписки на WebSocket событие inventory_updated
 * и перезагрузки данных инвентаря и истории.
 */
export const useInventoryWebSocketSync = () => {
    const dispatch = useDispatch<AppDispatch>();
    const selectedInventoryChatId = useSelector(selectSelectedChatId);
    
    // 🚨 ОТЛАДКА: логируем состояние хука
    console.log(`🔔 [useInventoryWebSocketSync] Хук инициализирован:`, {
        selectedInventoryChatId,
        timestamp: new Date().toISOString()
    });
    
    // 🚨 ГЛОБАЛЬНЫЙ ОТЛАДОЧНЫЙ ОБРАБОТЧИК для всех inventory_updated событий
    useEffect(() => {
        const globalHandler = (payload: any) => {
            console.log(`🔔 [GLOBAL DEBUG] Получено inventory_updated событие:`, {
                payload,
                selectedInventoryChatId,
                timestamp: new Date().toISOString()
            });
        };
        
        const unsubscribe = socketService.subscribe('inventory_updated', globalHandler);
        
        return () => {
            unsubscribe();
        };
    }, []); // Убираем зависимость от selectedInventoryChatId
    
    // Состояние для модального окна с изменениями
    const [templateChanges, setTemplateChanges] = useState<TemplateChanges | null>(null);
    const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
    
    // Функция для закрытия модального окна
    const closeChangesModal = useCallback(() => {
        setIsChangesModalOpen(false);
        setTemplateChanges(null);
    }, []);
    
    // Функция для отметки изменений как просмотренные
    const markChangesViewed = useCallback(async (chatId: string) => {
        try {
            await markTemplateChangesViewed(chatId);
            logger.info(`[useInventoryWebSocketSync] Template changes marked as viewed for chat ${chatId}`);
        } catch (error) {
            logger.error('[useInventoryWebSocketSync] Error marking template changes as viewed:', error);
        }
    }, []);
    
    // Функция для проверки и показа уведомлений о непросмотренных изменениях
    const checkForUnviewedTemplateChanges = useCallback(async (chatId: string, metadata?: InventoryMetadata) => {
        try {
            logger.info(`[checkForUnviewedTemplateChanges] Проверяем изменения для чата ${chatId}`, metadata);
            
            // Всегда загружаем свежие данные из API
            logger.info(`[checkForUnviewedTemplateChanges] Загружаем свежие данные из API для чата ${chatId}`);
            
            const freshData = await getChatInventory(chatId);
            const freshMetadata = freshData.metadata;
            
            logger.info(`[checkForUnviewedTemplateChanges] Получены свежие метаданные:`, freshMetadata);
            
            const lastTemplateUpdate = freshMetadata.lastTemplateUpdate;
            
            if (!lastTemplateUpdate) {
                logger.info(`[checkForUnviewedTemplateChanges] Нет lastTemplateUpdate в свежих метаданных`);
                return; // Нет изменений или они уже просмотрены
            }
            
            if (lastTemplateUpdate.viewed) {
                logger.info(`[checkForUnviewedTemplateChanges] Изменения уже просмотрены (viewed: true)`);
                return; // Нет изменений или они уже просмотрены
            }
            
            logger.info(`[checkForUnviewedTemplateChanges] Найдены непросмотренные изменения:`, lastTemplateUpdate);
            
            const { changes } = lastTemplateUpdate;
            
            // Показываем уведомление о непросмотренных изменениях
            const changesList = [];
            if (changes.added_count > 0) {
                changesList.push(`${changes.added_count} новых позиций`);
                logger.info(`[checkForUnviewedTemplateChanges] Добавлено в changesList: ${changes.added_count} новых позиций`);
            }
            if (changes.removed_count > 0) {
                changesList.push(`${changes.removed_count} удалённых позиций`);
                logger.info(`[checkForUnviewedTemplateChanges] Добавлено в changesList: ${changes.removed_count} удалённых позиций`);
            }
            
            logger.info(`[checkForUnviewedTemplateChanges] changesList:`, changesList);
            
            if (changesList.length > 0) {
                const changesText = changesList.join(', ');
                
                // Автоматически показываем модальное окно с изменениями
                const templateChanges: TemplateChanges = {
                    new_items: changes.added.map((item: string) => item.replace(/.*→\s*/, '')),
                    removed_items: changes.removed.map((item: string) => item.replace(/.*→\s*/, '').replace(/\s*\(.*\)$/, '')),
                    summary: {
                        added_items: changes.added_count,
                        removed_items: changes.removed_count,
                        preserved_items: 0
                    }
                };
                
                logger.info(`[checkForUnviewedTemplateChanges] Показываем модальное окно с изменениями:`, templateChanges);
                
                setTemplateChanges(templateChanges);
                setIsChangesModalOpen(true);
                
                // Отмечаем как просмотренные
                markChangesViewed(chatId);
                
                // Также показываем уведомление для информации
                dispatch(addNotification({
                    id: `unviewed-changes-${chatId}-${Date.now()}`,
                    title: '🆕 Обновления инвентаря',
                    message: `В инвентаре были изменения: ${changesText}`,
                    type: NotificationTypes.INFO,
                    duration: 5000
                }));
                
                logger.info(`[checkForUnviewedTemplateChanges] Уведомление отправлено и модальное окно показано для чата ${chatId}`);
            }
            
        } catch (error) {
            logger.error('[useInventoryWebSocketSync] Error checking for unviewed template changes:', error);
        }
    }, [dispatch, markChangesViewed, setTemplateChanges, setIsChangesModalOpen]);

    // --- useEffect для принудительной синхронизации при переподключении ---
    useEffect(() => {
        if (!selectedInventoryChatId) return;

        const handleSocketReconnect = () => {
            logger.info(`[WS Sync] Обнаружено переподключение WebSocket для чата ${selectedInventoryChatId}`);
            
            // Принудительно синхронизируем данные после переподключения
            setTimeout(() => {
                logger.info(`[WS Sync] Выполняем принудительную синхронизацию для чата ${selectedInventoryChatId}`);
                dispatch(fetchChatInventory(selectedInventoryChatId));
            }, 1000); // Задержка 1 секунда для стабилизации соединения
        };

        // Подписываемся на события переподключения
        const unsubscribeConnect = socketService.subscribe('connect', handleSocketReconnect);
        
        return () => {
            unsubscribeConnect();
        };
    }, [selectedInventoryChatId, dispatch]);

    useEffect(() => {
        logger.log(`[useInventoryWebSocketSync] Effect RUN. selectedInventoryChatId: ${selectedInventoryChatId}`);

        if (!selectedInventoryChatId) {
            logger.log('[useInventoryWebSocketSync] No selected inventory chat ID. Skipping subscription.');
            return () => {};
        }

        // Интерфейс для payload из WebSocket
        interface InventoryUpdatedPayload {
            type: 'inventory_updated' | 'inventory_reset' | string;
            chat_id: string;
            metadata: InventoryMetadata; 
            item_id?: string;
            category?: string;
            item?: InventoryItem; // Опциональный объект товара
        }

        // Интерфейс для payload события template_updated
        interface TemplateUpdatedPayload {
            type: 'template_updated';
            timestamp: string;
            summary: {
                total_items: number;
                new_items: number;
                removed_items: number;
                inventory_template_updated: boolean;
                excel_template_updated: boolean;
            };
            details: {
                new_items_list: string[];
                removed_items_list: string[];
            };
        }

        const handleInventoryUpdated = (payload: InventoryUpdatedPayload) => {
            // 🚨 ОТЛАДКА: логируем ВСЕ inventory события для поиска проблемы
            console.log(`🔔 [WS DEBUG] Получено inventory событие:`, {
                type: payload.type,
                chat_id: payload.chat_id,
                item_id: payload.item_id,
                category: payload.category,
                hasItem: !!payload.item,
                itemKeys: payload.item ? Object.keys(payload.item) : null,
                selectedChat: selectedInventoryChatId,
                timestamp: new Date().toISOString(),
                payloadTimestamp: payload.metadata?.lastUpdated
            });
            
            // 🚨 ДОПОЛНИТЕЛЬНАЯ ОТЛАДКА: проверяем, что функция действительно вызывается
            console.log(`🔔 [WS DEBUG] handleInventoryUpdated ВЫЗВАНА!`, {
                functionName: 'handleInventoryUpdated',
                payloadType: payload.type,
                timestamp: new Date().toISOString()
            });
            
            if (!payload.chat_id || !payload.metadata) {
                logger.error('[WS - Inventory Hook] Received incomplete event (missing chat_id or metadata)!', payload);
                return;
            }

            const isCurrentChat = selectedInventoryChatId && String(payload.chat_id) === selectedInventoryChatId;
            logger.info(`[WS Sync] Получено событие типа "${payload.type}" для чата ${payload.chat_id}. ${isCurrentChat ? 'Это ТЕКУЩИЙ чат.' : 'Это ДРУГОЙ чат.'}`);

            switch (payload.type) {
                case 'inventory_updated':
                    if (isCurrentChat) {
                        if (payload.item_id && payload.category && payload.item) {
                            // Декодируем для отображения в логах
                            const decodedForLog = `${decodeURIComponent(payload.category)}/${decodeURIComponent(payload.item_id)}`;
                            logger.info(`[WS Sync - inventory_updated] Обновляем конкретный товар: ${decodedForLog}`);
                            
                            // Добавляем дополнительную проверку timestamp перед диспатчем
                            const currentTime = new Date().getTime();
                            let payloadTime: number;
                            
                            // Проверяем формат timestamp
                            if (typeof payload.metadata.lastUpdated === 'string') {
                                // Парсим ISO 8601 строку (например: "2025-08-07T02:06:06.607Z")
                                const parsedDate = new Date(payload.metadata.lastUpdated);
                                if (isNaN(parsedDate.getTime())) {
                                    logger.warn(`[WS Sync] Не удалось распарсить timestamp: ${payload.metadata.lastUpdated}, пропускаем проверку`);
                                    payloadTime = currentTime; // Пропускаем проверку
                                } else {
                                    payloadTime = parsedDate.getTime();
                                }
                            } else if (typeof payload.metadata.lastUpdated === 'number') {
                                payloadTime = payload.metadata.lastUpdated;
                            } else {
                                logger.warn(`[WS Sync] Неизвестный формат timestamp: ${payload.metadata.lastUpdated}, пропускаем проверку`);
                                payloadTime = currentTime; // Пропускаем проверку
                            }
                            
                            // ИСПРАВЛЕНИЕ: Сравниваем абсолютные значения времени, а не разность
                            // Если payload время больше текущего времени, это означает, что событие из будущего (невозможно)
                            // Если разность больше 30 секунд в любую сторону, это подозрительно
                            const timeDiff = Math.abs(currentTime - payloadTime);
                            logger.info(`[WS Sync] Проверка timestamp: current=${new Date(currentTime).toISOString()}, payload=${new Date(payloadTime).toISOString()}, abs_diff=${timeDiff}ms`);
                            
                            // Увеличиваем допустимый интервал до 30 секунд (30000ms)
                            if (timeDiff > 30000) { // 30 секунд
                                logger.warn(`[WS Sync] Получено событие с подозрительным timestamp (разность ${timeDiff}ms), но все равно обрабатываем`);
                                // НЕ возвращаем return, а продолжаем обработку
                            }
                            
                            // Декодируем URL-кодированные параметры для корректного обновления UI
                            const decodedItemId = decodeURIComponent(payload.item_id);
                            const decodedCategory = decodeURIComponent(payload.category);
                            
                            logger.info(`[WS Sync - inventory_updated] Декодированные параметры: ${decodedCategory}/${decodedItemId} (было: ${payload.category}/${payload.item_id})`);
                            
                            dispatch(receiveItemUpdate({
                                chatId: payload.chat_id,
                                type: payload.type,
                                metadata: payload.metadata,
                                item_id: decodedItemId,
                                category: decodedCategory,
                                item: payload.item,
                                timestamp: payload.metadata.lastUpdated // Передаем timestamp для проверки race conditions
                            }));
                            
                            logger.info(`[WS Sync - inventory_updated] Обновляем историю для ${decodedCategory}/${decodedItemId} в фоне...`);
                            dispatch(fetchItemHistory({
                                chatId: selectedInventoryChatId,
                                itemId: decodedItemId, 
                                category: decodedCategory,
                                itemName: decodedItemId, 
                                background: true 
                            }));
                        } else {
                            logger.info(`[WS Sync - inventory_updated] Событие без деталей товара для ТЕКУЩЕГО чата. Перезапрашиваем весь инвентарь для ${payload.chat_id}...`);
                            console.log(`🔄 [WS Sync] Перезагружаем весь инвентарь для чата ${payload.chat_id} из-за отсутствия данных товара`);
                            dispatch(fetchChatInventory(payload.chat_id));
                        }
                        
                        // Убираем проверку непросмотренных изменений для онлайн пользователей
                        // Для онлайн пользователей изменения автоматически помечаются как просмотренные в handleTemplateUpdated
                        logger.info(`[WS Sync - inventory_updated] Онлайн пользователь - изменения будут помечены как просмотренные автоматически`);
                        
                        // checkForUnviewedTemplateChanges(payload.chat_id); // Убрано для онлайн пользователей
                    } else {
                        logger.log(`[WS Sync - inventory_updated] Обновляем только метаданные для ДРУГОГО (${payload.chat_id}) чата.`);
                        dispatch(receiveItemUpdate({
                            chatId: payload.chat_id,
                            type: payload.type,
                            metadata: payload.metadata,
                            timestamp: payload.metadata.lastUpdated // Передаем timestamp для проверки race conditions
                        }));
                    }
                    break;
                
                case 'inventory_reset':
                    logger.info(`[WS Sync - inventory_reset] Получен сигнал сброса для чата ${payload.chat_id}. Диспатчим receiveItemUpdate...`);
                    dispatch(receiveItemUpdate({
                        chatId: payload.chat_id,
                        type: payload.type,
                        metadata: payload.metadata,
                        timestamp: payload.metadata.lastUpdated // Передаем timestamp для проверки race conditions
                    }));
                    break;

                default:
                    logger.warn(`[WS Sync] Получен неизвестный тип события: "${payload.type}" для чата ${payload.chat_id}. Игнорируем.`);
                    break;
            }
        };

        // Обработчик события template_updated
        const handleTemplateUpdated = async (payload: TemplateUpdatedPayload) => {
            logger.info(`[WS Sync - template_updated] Получено глобальное событие обновления шаблона:`, payload);
            
            // Показываем краткое уведомление о начале синхронизации
            dispatch(addNotification({
                id: `template-sync-started-${Date.now()}`,
                title: '🔄 Синхронизация шаблона',
                message: 'Выполняется автоматическая синхронизация инвентаря...',
                type: NotificationTypes.INFO,
                duration: 3000
            }));

            // Если есть выбранный чат, автоматически синхронизируем его с новым шаблоном
            if (selectedInventoryChatId) {
                try {
                    logger.info(`[WS Sync - template_updated] Автоматическая синхронизация для чата ${selectedInventoryChatId}`);
                    
                    const syncResult = await syncChatWithTemplate(selectedInventoryChatId);
                    
                    logger.info(`[WS Sync - template_updated] Синхронизация завершена успешно:`, syncResult);
                    
                    // ВАЖНО: Вместо syncResult берем данные из свежих метаданных БД
                    logger.info(`[WS Sync - template_updated] Загружаем свежие метаданные для получения актуальных изменений`);
                    const freshData = await getChatInventory(selectedInventoryChatId);
                    const lastTemplateUpdate = freshData.metadata.lastTemplateUpdate;
                    
                    if (lastTemplateUpdate && lastTemplateUpdate.changes) {
                        logger.info(`[WS Sync - template_updated] Используем данные из свежих метаданных:`, lastTemplateUpdate.changes);
                        
                        // Подготавливаем данные для модального окна из СВЕЖИХ метаданных
                        const changes: TemplateChanges = {
                            new_items: lastTemplateUpdate.changes.added.map((item: string) => item.replace(/.*→\s*/, '')),
                            removed_items: lastTemplateUpdate.changes.removed.map((item: string) => item.replace(/.*→\s*/, '').replace(/\s*\(.*\)$/, '')),
                            summary: {
                                added_items: lastTemplateUpdate.changes.added_count,
                                removed_items: lastTemplateUpdate.changes.removed_count,
                                preserved_items: 0
                            }
                        };
                        
                        logger.info(`[WS Sync - template_updated] Подготовленные данные для модального окна:`, changes);
                        
                        // Показываем модальное окно с результатами
                        setTemplateChanges(changes);
                        setIsChangesModalOpen(true);
                        
                        // ВАЖНО: Автоматически помечаем изменения как просмотренные для онлайн пользователей
                        logger.info(`[WS Sync - template_updated] Помечаем изменения как просмотренные для онлайн пользователя в чате ${selectedInventoryChatId}`);
                        markChangesViewed(selectedInventoryChatId);
                        
                        // Перезагружаем данные инвентаря
                        dispatch(fetchChatInventory(selectedInventoryChatId));
                    } else {
                        logger.warn(`[WS Sync - template_updated] Нет lastTemplateUpdate в свежих метаданных - используем fallback данные из syncResult`);
                        
                        // Fallback: используем данные из syncResult если нет lastTemplateUpdate
                        const changes: TemplateChanges = {
                            new_items: syncResult.changes.added.map((item: string) => item.replace(/.*→\s*/, '')),
                            removed_items: syncResult.changes.removed.map((item: string) => item.replace(/.*→\s*/, '').replace(/\s*\(.*\)$/, '')),
                            summary: {
                                added_items: syncResult.summary.added_items,
                                removed_items: syncResult.summary.removed_items,
                                preserved_items: syncResult.summary.preserved_items
                            }
                        };
                        
                        // Показываем модальное окно с результатами
                        setTemplateChanges(changes);
                        setIsChangesModalOpen(true);
                        
                        // ВАЖНО: Автоматически помечаем изменения как просмотренные для онлайн пользователей
                        logger.info(`[WS Sync - template_updated] Помечаем изменения как просмотренные для онлайн пользователя в чате ${selectedInventoryChatId}`);
                        markChangesViewed(selectedInventoryChatId);
                        
                        // Перезагружаем данные инвентаря
                        dispatch(fetchChatInventory(selectedInventoryChatId));
                    }
                    
                } catch (error) {
                    logger.error(`[WS Sync - template_updated] Ошибка автоматической синхронизации:`, error);
                    
                    dispatch(addNotification({
                        id: `sync-error-${Date.now()}`,
                        title: '❌ Ошибка синхронизации',
                        message: `Не удалось синхронизировать инвентарь с новым шаблоном. Пожалуйста, перезагрузите страницу.`,
                        type: NotificationTypes.ERROR,
                        duration: 10000
                    }));
                }
            } else {
                // Если нет выбранного чата, показываем только уведомление
                const changesList = [];
                if (payload.summary.new_items > 0) {
                    changesList.push(`${payload.summary.new_items} новых позиций`);
                }
                if (payload.summary.removed_items > 0) {
                    changesList.push(`${payload.summary.removed_items} удалённых позиций`);
                }
                
                const changesText = changesList.length > 0 ? `: ${changesList.join(', ')}` : '';
                
                dispatch(addNotification({
                    id: `template-updated-${Date.now()}`,
                    title: '📝 Шаблон инвентаря обновлён',
                    message: `Шаблон инвентаря был обновлён${changesText}. Синхронизация будет выполнена при открытии инвентаря.`,
                    type: NotificationTypes.INFO,
                    duration: 8000
                }));
            }
        };

        logger.log(`[useInventoryWebSocketSync] Подписка на 'inventory_updated', 'inventory_reset' и 'template_updated' для selectedChatId: ${selectedInventoryChatId}`);
        
        // 🚨 ОТЛАДКА: логируем подписку на события
        console.log(`🔔 [useInventoryWebSocketSync] Подписываемся на WebSocket события:`, {
            selectedInventoryChatId,
            socketConnected: socketService.isConnected(),
            timestamp: new Date().toISOString()
        });
        
        // 🚨 ДОПОЛНИТЕЛЬНАЯ ОТЛАДКА: проверяем, что обработчики определены
        console.log(`🔔 [useInventoryWebSocketSync] Обработчики определены:`, {
            handleInventoryUpdated: typeof handleInventoryUpdated,
            handleTemplateUpdated: typeof handleTemplateUpdated,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🔔 [useInventoryWebSocketSync] Подписываемся на inventory_updated...`);
        const unsubscribeInventoryUpdate = socketService.subscribe('inventory_updated', handleInventoryUpdated);
        console.log(`🔔 [useInventoryWebSocketSync] Подписка на inventory_updated создана:`, typeof unsubscribeInventoryUpdate);
        
        console.log(`🔔 [useInventoryWebSocketSync] Подписываемся на template_updated...`);
        const unsubscribeTemplateUpdate = socketService.subscribe('template_updated', handleTemplateUpdated);
        console.log(`🔔 [useInventoryWebSocketSync] Подписка на template_updated создана:`, typeof unsubscribeTemplateUpdate);

        return () => {
            logger.log(`[useInventoryWebSocketSync] Cleanup. Отписка от всех событий для selectedChatId: ${selectedInventoryChatId}.`);
            unsubscribeInventoryUpdate();
            unsubscribeTemplateUpdate();
        };
    }, [dispatch, selectedInventoryChatId]);
    
    return {
        templateChanges,
        isChangesModalOpen,
        closeChangesModal,
        checkForUnviewedTemplateChanges // Экспортируем функцию для использования извне
    };
}; 