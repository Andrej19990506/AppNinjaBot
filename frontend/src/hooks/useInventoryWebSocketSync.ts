import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store/store';
import { socketService } from '../services/socket';
import { logger } from '../utils/logger';
import { InventoryMetadata, InventoryItem } from '../types/inventoryTypes';
import { 
    selectSelectedChatId, 
    fetchItemHistory, 
    fetchChatInventory,
    receiveItemUpdate
} from '../store/slices/inventorySlice';

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
            type: 'inventory_updated'; 
            chat_id: string;
            metadata: InventoryMetadata; 
            item_id?: string;
            category?: string;
            item?: InventoryItem; // Опциональный объект товара
        }

        const handleInventoryUpdated = (payload: InventoryUpdatedPayload) => {
            if (payload.type !== 'inventory_updated') {
                 logger.warn('[WS - Inventory Hook] Received event with wrong type:', payload.type);
                 return;
            }
            if (!payload.chat_id || !payload.metadata) {
                 logger.error('[WS - Inventory Hook] Received incomplete event (missing chat_id or metadata)!', payload);
                 return;
            }

            // Проверяем, является ли обновление для текущего чата
            if (selectedInventoryChatId && String(payload.chat_id) === selectedInventoryChatId) {
                logger.info(`[WS Sync] Событие inventory_updated для НАШЕГО чата ${selectedInventoryChatId}.`);

                // Обновляем метаданные в любом случае, если они пришли
                dispatch(receiveItemUpdate({
                    chatId: payload.chat_id,
                    metadata: payload.metadata
                    // Не передаем item данные здесь, т.к. обработаем ниже или перезапросим
                }));

                // Проверяем, есть ли данные конкретного товара
                if (payload.item_id && payload.category && payload.item) {
                    // --- Обновление КОНКРЕТНОГО товара --- 
                    logger.info(`[WS Sync] Обновляем конкретный товар: ${payload.category}/${payload.item_id}`);
                    dispatch(receiveItemUpdate({
                        chatId: payload.chat_id,
                        metadata: payload.metadata, // Повторно, но безопасно
                        item_id: payload.item_id,
                        category: payload.category,
                        item: payload.item
                    }));
                    
                    // Обновляем историю в фоне
                    logger.info(`[WS Sync] Обновляем историю для ${payload.category}/${payload.item_id} в фоне...`);
                    dispatch(fetchItemHistory({
                        chatId: selectedInventoryChatId,
                        itemId: payload.item_id, 
                        category: payload.category,
                        itemName: payload.item_id, 
                        background: true 
                    }));
                } else {
                    // --- Вероятно, УДАЛЕНИЕ товара или только обновление метаданных --- 
                    logger.info(`[WS Sync] Событие без деталей товара. Перезапрашиваем весь инвентарь для чата ${payload.chat_id}...`);
                    dispatch(fetchChatInventory(payload.chat_id));
                }

            } else {
                // --- Обновление для ДРУГОГО чата --- 
                 logger.log(`[WS Sync] Событие inventory_updated для ДРУГОГО (${payload.chat_id}) чата. Обновляем только метаданные.`);
                 // Обновляем только метаданные
                 dispatch(receiveItemUpdate({
                     chatId: payload.chat_id,
                     metadata: payload.metadata
                 }));
            }
        };

        logger.log(`[useInventoryWebSocketSync] Subscribing to 'inventory_updated' for chat ${selectedInventoryChatId}`);
        const unsubscribeInventoryUpdated = socketService.subscribe('inventory_updated', handleInventoryUpdated);

        return () => {
            logger.log(`[useInventoryWebSocketSync] Cleanup function CALLED for chat ${selectedInventoryChatId}. Unsubscribing from 'inventory_updated'.`);
            unsubscribeInventoryUpdated();
        };
    }, [dispatch, selectedInventoryChatId]);
}; 