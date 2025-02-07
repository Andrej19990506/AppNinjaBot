import axios from 'axios';
import config from '../config';

const api = axios.create({
    baseURL: config.API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Перехватчик ответов
api.interceptors.response.use(
    response => response,
    error => {
        if (!navigator.onLine) {
            return Promise.reject({
                offline: true,
                message: 'Нет подключения к интернету'
            });
        }
        
        const message = error.response?.data?.error || 'Произошла ошибка';
        console.error('API Error:', error);
        return Promise.reject({ message });
    }
);

export const getChats = async () => {
    try {
        console.log('=== Запрос списка чатов ===');
        const response = await api.get('/chats');
        const data = response.data;
        console.log('Полученные данные:', data);
        
        // Преобразуем объект чатов в массив
        const chats = Object.entries(data).map(([chatId, chatData]) => ({
            chat_id: chatId,
            ...chatData
        }));
        
        console.log('Преобразованные данные:', chats);
        return chats;
    } catch (error) {
        console.error('Ошибка при получении списка чатов:', error);
        throw error;
    }
};

export const getInventory = async (chatId) => {
    console.log('=== Запрос инвентаря ===');
    console.log('ID чата:', chatId);
    
    try {
        const response = await api.get(`/inventory/${chatId}`);
        console.log('Ответ API:', response.data);
        return response.data;
    } catch (error) {
        console.error('Ошибка при загрузке инвентаря:', error.response?.data || error.message);
        console.error('Полная ошибка:', error);
        throw error.response?.data || error;
    }
};

export const saveInventory = async (chatId, inventory) => {
    console.log('=== Сохранение инвентаря ===');
    console.log('ID чата:', chatId);
    console.log('Данные для сохранения:', inventory);
    
    try {
        const response = await api.post(`/inventory/${chatId}`, inventory);
        console.log('Ответ API после сохранения:', response.data);
        return response.data;
    } catch (error) {
        console.error('Ошибка при сохранении инвентаря:', error.response?.data || error.message);
        console.error('Полная ошибка:', error);
        throw error;
    }
};

export const getInventoryTemplate = async () => {
    try {
        const response = await api.get('/inventory/template');
        return response.data;
    } catch (error) {
        console.error('Ошибка при загрузке шаблона:', error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export default api; 