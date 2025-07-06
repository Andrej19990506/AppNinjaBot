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
import { syncChatWithTemplate } from '@features/Inventory/services/inventoryApi';
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
    
    // Состояние для модального окна с изменениями
    const [templateChanges, setTemplateChanges] = useState<TemplateChanges | null>(null);
    const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
    
    // Функция для закрытия модального окна
    const closeChangesModal = useCallback(() => {
        setIsChangesModalOpen(false);
        setTemplateChanges(null);
    }, []);

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
                            logger.info(`[WS Sync - inventory_updated] Обновляем конкретный товар: ${payload.category}/${payload.item_id}`);
                            dispatch(receiveItemUpdate({
                                chatId: payload.chat_id,
                                type: payload.type,
                                metadata: payload.metadata,
                                item_id: payload.item_id,
                                category: payload.category,
                                item: payload.item
                            }));
                            
                            logger.info(`[WS Sync - inventory_updated] Обновляем историю для ${payload.category}/${payload.item_id} в фоне...`);
                            dispatch(fetchItemHistory({
                                chatId: selectedInventoryChatId,
                                itemId: payload.item_id, 
                                category: payload.category,
                                itemName: payload.item_id, 
                                background: true 
                            }));
                        } else {
                            logger.info(`[WS Sync - inventory_updated] Событие без деталей товара для ТЕКУЩЕГО чата. Перезапрашиваем весь инвентарь для ${payload.chat_id}...`);
                            dispatch(fetchChatInventory(payload.chat_id));
                        }
                    } else {
                        logger.log(`[WS Sync - inventory_updated] Обновляем только метаданные для ДРУГОГО (${payload.chat_id}) чата.`);
                        dispatch(receiveItemUpdate({
                            chatId: payload.chat_id,
                            type: payload.type,
                            metadata: payload.metadata
                        }));
                    }
                    break;
                
                case 'inventory_reset':
                    logger.info(`[WS Sync - inventory_reset] Получен сигнал сброса для чата ${payload.chat_id}. Диспатчим receiveItemUpdate...`);
                    dispatch(receiveItemUpdate({
                        chatId: payload.chat_id,
                        type: payload.type,
                        metadata: payload.metadata
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
                    
                    // Подготавливаем данные для модального окна
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
                    
                    // Перезагружаем данные инвентаря
                    dispatch(fetchChatInventory(selectedInventoryChatId));
                    
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
        
        const unsubscribeInventoryUpdate = socketService.subscribe('inventory_updated', handleInventoryUpdated);
        const unsubscribeTemplateUpdate = socketService.subscribe('template_updated', handleTemplateUpdated);

        return () => {
            logger.log(`[useInventoryWebSocketSync] Cleanup. Отписка от всех событий для selectedChatId: ${selectedInventoryChatId}.`);
            unsubscribeInventoryUpdate();
            unsubscribeTemplateUpdate();
        };
    }, [dispatch, selectedInventoryChatId]);
    
    return {
        templateChanges,
        isChangesModalOpen,
        closeChangesModal
    };
}; 