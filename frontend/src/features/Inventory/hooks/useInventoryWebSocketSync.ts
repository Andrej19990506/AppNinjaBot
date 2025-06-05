import { useEffect } from 'react';
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

/**
 * Хук для подписки на WebSocket событие inventory_updated
 * и перезагрузки данных инвентаря и истории.
 */
export const useInventoryWebSocketSync = () => {
    const dispatch = useDispatch<AppDispatch>();
    const selectedInventoryChatId = useSelector(selectSelectedChatId);

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

        logger.log(`[useInventoryWebSocketSync] Подписка на 'inventory_updated' и 'inventory_reset' для selectedChatId: ${selectedInventoryChatId}`);
        
        const unsubscribeInventoryUpdate = socketService.subscribe('inventory_updated', handleInventoryUpdated);

        return () => {
            logger.log(`[useInventoryWebSocketSync] Cleanup. Отписка от 'inventory_updated' для selectedChatId: ${selectedInventoryChatId}.`);
            unsubscribeInventoryUpdate();
        };
    }, [dispatch, selectedInventoryChatId]);
}; 