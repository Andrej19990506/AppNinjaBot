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
        const response = await api.get('/chats');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getInventory = async (chatId) => {
    try {
        const response = await axios.get(`${config.API_URL}/inventory/${chatId}`);
        return response.data;
    } catch (error) {
        console.error('Ошибка при загрузке инвентаря:', error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

export const saveInventory = async (chatId, inventory) => {
    try {
        const response = await api.post(`/inventory/${chatId}`, { inventory });
        return response.data;
    } catch (error) {
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