import axios from 'axios';
import config from '../config';

const instance = axios.create({
    baseURL: config.API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const api = {
    // История инвентаря
    getItemHistory: async (chatId: string, itemId: string, category: string, itemName: string) => {
        console.log('=== 📡 Запрос истории ===');
        console.log('🏠 Чат:', chatId);
        console.log('📦 Товар:', itemName);
        console.log('📑 Категория:', category);
        console.log('🆔 ID товара:', itemId);
        
        const url = `/item_history/${chatId}/${encodeURIComponent(category)}/${encodeURIComponent(itemName)}`;
        console.log('🔗 URL запроса:', url);
        console.log('🔗 Полный URL:', `${config.API_URL}${url}`);
        
        return instance.get(url);
    },

    // Добавление записи в историю
    addHistoryRecord: async (chatId: string, itemId: string, data: {
        action: string;
        type: 'raw' | 'semifinished';
        quantity: number;
        oldQuantity: number;
        newQuantity: number;
    }) => {
        return instance.post(`/item_history/${chatId}`, data);
    },

    // Получение истории за период
    getHistoryByDateRange: async (chatId: string, itemId: string, startDate: string, endDate: string) => {
        return instance.get(`/item_history/${chatId}/range`, {
            params: { startDate, endDate }
        });
    }
};

// Интерцептор для обработки ошибок
instance.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw error;
    }
); 