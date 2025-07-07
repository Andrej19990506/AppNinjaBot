// --- inventoryApi.ts ---
// API-слой для работы с инвентарём через backend (axiosInstance).
// Здесь все функции для загрузки, обновления, удаления, истории, генерации отчётов и сброса инвентаря.

import { axiosInstance } from '@/shared/api/api'; // Предполагаем, что axiosInstance настроен здесь
import { isAxiosError } from 'axios'; // <--- Импортируем isAxiosError напрямую
import {
    InventoryData, 
    InventoryUpdatePayload, 
    ChatItem, 
    InventoryHistoryItem 
} from '@/types/inventoryTypes';

/**
 * Получить шаблон структуры инвентаря (например, для создания новых чатов)
 * @returns {Promise<Record<string, any>>} The inventory template data.
 */
export const getInventoryTemplate = async (): Promise<Record<string, any>> => {
    try {
        const response = await axiosInstance.get<Record<string, any>>('/v1/inventory/template');
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Получить инвентарь для конкретного чата
 * @param chatId 
 * @returns {Promise<InventoryData>} 
 */
export const getChatInventory = async (chatId: string): Promise<InventoryData> => {
    if (!chatId) {
        throw new Error('chatId обязателен для получения инвентаря.');
    }
    try {
        const response = await axiosInstance.get<InventoryData>(`/v1/inventory/${chatId}`);
        if (!response.data.inventory) {
            response.data.inventory = {};
        }
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Обновить инвентарь для чата (POST)
 * @param chatId 
 * @param payload 
 * @returns {Promise<InventoryData>}
 */
export const updateChatInventory = async (chatId: string, payload: InventoryUpdatePayload): Promise<InventoryData> => {
    if (!chatId) {
        throw new Error('chatId обязателен для обновления инвентаря.');
    }
    try {
        const response = await axiosInstance.post<InventoryData>(`/v1/inventory/${chatId}`, payload);
        if (!response.data.inventory) {
            response.data.inventory = {};
        }
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Получить историю изменений по конкретному товару
 * @param chatId 
 * @param category 
 * @param itemName 
 * @returns {Promise<InventoryHistoryItem[]>}
 */
export const getItemHistory = async (chatId: string, category: string, itemName: string): Promise<InventoryHistoryItem[]> => {
    if (!chatId || !category || !itemName) {
        throw new Error('chatId, категория и название товара обязательны для получения истории.');
    }
    const encodedCategory = encodeURIComponent(category);
    const encodedItemName = encodeURIComponent(itemName);
    const url = `/v1/inventory/history/${chatId}/${encodedCategory}/${encodedItemName}`;
    try {
        const response = await axiosInstance.get<InventoryHistoryItem[]>(url);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Получить список "поварских" чатов пользователя
 * @param userId 
 * @returns {Promise<ChatItem[]>}
 */
export const getChefChats = async (userId: number | string): Promise<ChatItem[]> => {
    if (!userId) {
        throw new Error('userId обязателен для получения списка чатов.');
    }
    try {
        const response = await axiosInstance.get<ChatItem[]>('/groups/chats', {
            params: { user_id: userId, group_type: 'chef' }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Добавить новый товар в инвентарь (custom item)
 * @param chatId 
 * @param category 
 * @param itemName 
 * @param hasSemifinshed 
 * @returns {Promise<any>}
 */
export const addCustomInventoryItem = async (
    chatId: string, 
    category: string, 
    itemName: string, 
    hasSemifinshed: boolean
): Promise<any> => {
    if (!chatId || !category || !itemName) {
        throw new Error('chatId, категория и название товара обязательны для добавления товара.');
    }
    const url = `/v1/inventory/${chatId}/items`;
    const payload = { category, item_name: itemName, has_semifinished: hasSemifinshed };
    try {
        const response = await axiosInstance.post<any>(url, payload);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Отправить запрос на добавление товара через бота в группу инвентаризации
 * @param chatId 
 * @param category 
 * @param itemName 
 * @param hasSemifinshed 
 * @returns {Promise<any>}
 */
export const requestAddItemThroughBot = async (
    chatId: string, 
    category: string, 
    itemName: string, 
    hasSemifinshed: boolean
): Promise<any> => {
    if (!chatId || !category || !itemName) {
        throw new Error('chatId, категория и название товара обязательны для запроса добавления товара.');
    }
    const url = `/v1/inventory/${chatId}/request-item`;
    const payload = { 
        category, 
        item_name: itemName, 
        has_semifinished: hasSemifinshed 
    };
    try {
        const response = await axiosInstance.post<any>(url, payload);
        return response.data;
    } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.data?.detail) { 
             throw new Error(error.response.data.detail);
        }
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error('Неизвестная ошибка при запросе добавления товара.');
        }
    }
};

/**
 * Удалить товар из инвентаря
 * @param chatId 
 * @param category 
 * @param itemName 
 * @returns {Promise<any>}
 */
export const deleteInventoryItem = async (chatId: string, category: string, itemName: string): Promise<any> => {
    if (!chatId || !category || !itemName) {
        throw new Error('chatId, категория и название товара обязательны для удаления товара.');
    }
    const encodedCategory = encodeURIComponent(category);
    const encodedItemName = encodeURIComponent(itemName);
    const url = `/v1/inventory/${chatId}/items/${encodedCategory}/${encodedItemName}`;
    try {
        const response = await axiosInstance.delete<any>(url);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Триггер генерации Excel-отчёта по инвентарю (файл появится в чате)
 * @param chatId 
 * @returns {Promise<{status: string, message: string, chat_id: string, file_path?: string}>}
 */
export const triggerExcelReportGeneration = async (chatId: string): Promise<{status: string, message: string, chat_id: string, file_path?: string}> => {
    if (!chatId) {
        throw new Error('chatId обязателен для генерации Excel-отчёта.');
    }
    const url = `/v1/inventory/${chatId}/excel`;
    try {
        const response = await axiosInstance.post<any>(url);
        return response.data;
    } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.data?.detail) { 
             throw new Error(error.response.data.detail);
        }
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error('Неизвестная ошибка при генерации отчёта.');
        }
    }
};

/**
 * Сбросить инвентарь чата (очистить всё)
 * @param chatId 
 * @returns {Promise<{message: string}>}
 */
export const resetChatInventory = async (chatId: string): Promise<{message: string}> => {
    if (!chatId) {
        throw new Error('chatId обязателен для сброса инвентаря.');
    }
    const url = `/v1/inventory/${chatId}/reset`;
    try {
        const response = await axiosInstance.post<{message: string}>(url);
        return response.data;
    } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.data?.detail) {
             throw new Error(error.response.data.detail);
        }
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error('Неизвестная ошибка при сбросе инвентаря.');
        }
    }
};

/**
 * Синхронизировать инвентарь чата с актуальным шаблоном
 * @param chatId 
 * @returns {Promise<any>} Отчет об изменениях
 */
export const syncChatWithTemplate = async (chatId: string): Promise<any> => {
    if (!chatId) {
        throw new Error('chatId обязателен для синхронизации с шаблоном.');
    }
    const url = `/v1/inventory/${chatId}/sync-template`;
    try {
        const response = await axiosInstance.post<any>(url);
        return response.data;
    } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.data?.detail) { 
             throw new Error(error.response.data.detail);
        }
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error('Неизвестная ошибка при синхронизации с шаблоном.');
        }
    }
};

/**
 * Отметить изменения шаблона как просмотренные
 * @param chatId 
 * @returns {Promise<any>}
 */
export const markTemplateChangesViewed = async (chatId: string): Promise<any> => {
    if (!chatId) {
        throw new Error('chatId обязателен для отметки изменений как просмотренные.');
    }
    const url = `/v1/inventory/${chatId}/mark-template-changes-viewed`;
    try {
        const response = await axiosInstance.post<any>(url);
        return response.data;
    } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.data?.detail) { 
             throw new Error(error.response.data.detail);
        }
        if (error instanceof Error) {
             throw error;
        } else {
             throw new Error('Неизвестная ошибка при отметке изменений как просмотренные.');
        }
    }
};
