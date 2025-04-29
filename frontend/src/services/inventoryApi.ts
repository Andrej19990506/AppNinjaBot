import { axiosInstance } from './api'; // Предполагаем, что axiosInstance настроен здесь
import { logger } from '../utils/logger';
import { isAxiosError } from 'axios'; // <--- Импортируем isAxiosError напрямую
import {
    InventoryData, 
    InventoryUpdatePayload, 
    ChatItem, 
    InventoryHistoryItem 
} from '../types/inventoryTypes';

/**
 * Fetches the inventory template structure.
 * @returns {Promise<Record<string, any>>} The inventory template data.
 */
export const getInventoryTemplate = async (): Promise<Record<string, any>> => {
    const logPrefix = '[inventoryApi:getInventoryTemplate]';
    try {
        logger.log(`${logPrefix} Fetching inventory template...`);
        const response = await axiosInstance.get<Record<string, any>>('/api/v1/inventory/template');
        logger.log(`${logPrefix} Template fetched successfully.`);
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error fetching inventory template:`, error);
        throw error; // Передаем ошибку дальше для обработки
    }
};

/**
 * Fetches inventory data for a specific chat.
 * @param chatId - The Telegram ID of the chat.
 * @returns {Promise<InventoryData>} Inventory data including items, metadata, and admins.
 */
export const getChatInventory = async (chatId: string): Promise<InventoryData> => {
    const logPrefix = `[inventoryApi:getChatInventory chatId=${chatId}]`;
    if (!chatId) {
        const errorMsg = `${logPrefix} chatId is required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        logger.log(`${logPrefix} Fetching inventory...`);
        const response = await axiosInstance.get<InventoryData>(`/api/v1/inventory/${chatId}`);
        logger.log(`${logPrefix} Inventory fetched successfully.`);
        // Убедимся, что поле inventory существует, даже если оно пустое
        if (!response.data.inventory) {
            response.data.inventory = {};
        }
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error fetching inventory:`, error);
        throw error;
    }
};

/**
 * Updates inventory data for a specific chat.
 * @param chatId - The Telegram ID of the chat.
 * @param payload - The inventory update payload.
 * @returns {Promise<InventoryData>} The updated inventory data.
 */
export const updateChatInventory = async (chatId: string, payload: InventoryUpdatePayload): Promise<InventoryData> => {
    const logPrefix = `[inventoryApi:updateChatInventory chatId=${chatId}]`;
    if (!chatId) {
        const errorMsg = `${logPrefix} chatId is required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        logger.log(`${logPrefix} Updating inventory...`, { payload });
        const response = await axiosInstance.post<InventoryData>(`/api/v1/inventory/${chatId}`, payload);
        logger.log(`${logPrefix} Inventory updated successfully.`);
        // Убедимся, что поле inventory существует, даже если оно пустое
        if (!response.data.inventory) {
            response.data.inventory = {};
        }
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error updating inventory:`, error);
        throw error;
    }
};

/**
 * Fetches the history for a specific inventory item.
 * @param chatId - The Telegram ID of the chat.
 * @param category - The item category.
 * @param itemName - The item name.
 * @returns {Promise<InventoryHistoryItem[]>} A list of history records for the item.
 */
export const getItemHistory = async (chatId: string, category: string, itemName: string): Promise<InventoryHistoryItem[]> => {
    const logPrefix = `[inventoryApi:getItemHistory chatId=${chatId}, category=${category}, item=${itemName}]`;
    if (!chatId || !category || !itemName) {
        const errorMsg = `${logPrefix} chatId, category, and itemName are required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    // Кодируем части URL, особенно itemName, который может содержать '/'
    const encodedCategory = encodeURIComponent(category);
    const encodedItemName = encodeURIComponent(itemName);
    const url = `/api/v1/inventory/history/${chatId}/${encodedCategory}/${encodedItemName}`;
    try {
        logger.log(`${logPrefix} Fetching item history from ${url}...`);
        const response = await axiosInstance.get<InventoryHistoryItem[]>(url);
        logger.log(`${logPrefix} Item history fetched successfully (${response.data.length} records).`);
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error fetching item history:`, error);
        throw error;
    }
};

/**
 * Fetches the list of 'chef' chats for a given user.
 * Moved here for centralization as it's primarily used for inventory.
 * @param userId - The Telegram ID of the user.
 * @returns {Promise<ChatItem[]>} A list of chef chats.
 */
export const getChefChats = async (userId: number | string): Promise<ChatItem[]> => {
    const logPrefix = `[inventoryApi:getChefChats userId=${userId}]`;
    if (!userId) {
        const errorMsg = `${logPrefix} userId is required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        logger.log(`${logPrefix} Fetching chef chats...`);
        // Используем старый эндпоинт, но указываем group_type=chef
        const response = await axiosInstance.get<ChatItem[]>('/groups/chats', {
            params: { user_id: userId, group_type: 'chef' }
        });
        logger.log(`${logPrefix} Chef chats fetched successfully (${response.data.length} chats).`);
        // Дополнительная валидация или преобразование данных, если нужно
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error fetching chef chats:`, error);
        throw error;
    }
};

/**
 * Adds a custom inventory item definition to a group's additions.
 * @param chatId - The Telegram ID of the chat.
 * @param category - The category for the new item.
 * @param itemName - The name of the new item.
 * @param hasSemifinshed - Whether the item has a semifinished component.
 * @returns {Promise<any>} The response from the server (e.g., a success message).
 */
export const addCustomInventoryItem = async (
    chatId: string, 
    category: string, 
    itemName: string, 
    hasSemifinshed: boolean
): Promise<any> => {
    const logPrefix = `[inventoryApi:addCustomInventoryItem chatId=${chatId}]`;
    if (!chatId || !category || !itemName) {
        const errorMsg = `${logPrefix} chatId, category, and itemName are required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    const url = `/api/v1/inventory/${chatId}/items`;
    const payload = { category, item_name: itemName, has_semifinished: hasSemifinshed };
    try {
        logger.log(`${logPrefix} Adding custom item definition at ${url}...`, payload);
        const response = await axiosInstance.post<any>(url, payload);
        logger.log(`${logPrefix} Custom item definition added successfully.`);
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error adding custom item definition:`, error);
        throw error;
    }
};

/**
 * Deletes an inventory item (both data and definition) for a group.
 * @param chatId - The Telegram ID of the chat.
 * @param category - The category of the item.
 * @param itemName - The name of the item to delete.
 * @returns {Promise<any>} The response from the server (e.g., a success message).
 */
export const deleteInventoryItem = async (chatId: string, category: string, itemName: string): Promise<any> => {
    const logPrefix = `[inventoryApi:deleteInventoryItem chatId=${chatId}, item=${category}/${itemName}]`;
    if (!chatId || !category || !itemName) {
        const errorMsg = `${logPrefix} chatId, category, and itemName are required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    // Encode category and item name for the URL path
    const encodedCategory = encodeURIComponent(category);
    const encodedItemName = encodeURIComponent(itemName);
    const url = `/api/v1/inventory/${chatId}/items/${encodedCategory}/${encodedItemName}`;
    try {
        logger.log(`${logPrefix} Deleting item at ${url}...`);
        const response = await axiosInstance.delete<any>(url);
        logger.log(`${logPrefix} Item deleted successfully.`);
        return response.data;
    } catch (error) {
        logger.error(`${logPrefix} Error deleting item:`, error);
        throw error;
    }
};

// ---> ДОБАВЛЕНИЕ: Функция для запроса генерации и отправки Excel отчета <---
/**
 * Triggers the generation and sending of the inventory Excel report via the bot.
 * @param chatId - The Telegram ID of the chat.
 * @returns {Promise<{status: string, message: string, chat_id: string, file_path?: string}>} Response indicating the request status.
 */
export const triggerExcelReportGeneration = async (chatId: string): Promise<{status: string, message: string, chat_id: string, file_path?: string}> => {
    const logPrefix = `[inventoryApi:triggerExcelReportGeneration chatId=${chatId}]`;
    if (!chatId) {
        const errorMsg = `${logPrefix} chatId is required.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    const url = `/api/v1/inventory/${chatId}/excel`;
    try {
        logger.log(`${logPrefix} Triggering Excel report generation at ${url}...`);
        // Используем axiosInstance для POST запроса без тела
        const response = await axiosInstance.post<any>(url);
        logger.log(`${logPrefix} Excel report generation triggered successfully.`);
        return response.data; // Возвращаем ответ от сервера {status: 'success', ...}
    } catch (error: unknown) { // <--- Явно указываем тип unknown
        logger.error(`${logPrefix} Error triggering Excel report generation:`, error);
        // Попытка извлечь сообщение об ошибке из ответа сервера, если оно есть
        if (isAxiosError(error) && error.response?.data?.detail) { // <--- Используем импортированный isAxiosError
             throw new Error(error.response.data.detail);
        }
        // Если это не Axios ошибка или нет деталей, выбрасываем как есть или обернем в Error
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error('An unknown error occurred during report generation trigger.');
        }
    }
};
