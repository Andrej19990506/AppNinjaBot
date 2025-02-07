import axios from 'axios';
import config from '../config';

// Добавляем подробное логирование
console.log('Environment:', process.env.NODE_ENV);
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('Config API_URL:', config.API_URL);

const api = axios.create({
    baseURL: config.API_URL.replace(/\/+$/, ''), // Убираем trailing slash если есть
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Добавляем поддержку credentials
});

// Добавим логирование запросов
api.interceptors.request.use(request => {
    console.log('Full request details:', {
        baseURL: request.baseURL,
        url: request.url,
        fullURL: request.baseURL + request.url,
        method: request.method.toUpperCase(),
        headers: request.headers
    });
    return request;
});

// Добавляем интерцептор для обработки ошибок
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        return Promise.reject(error);
    }
);

// Получение списка чатов с инвентаризацией
export const getChats = async () => {
    try {
        console.log('=== Начало загрузки чатов ===');
        
        // Получаем список чатов
        const chatsResponse = await api.get('/chats');
        console.log('Ответ от /chats:', chatsResponse);
        const chats = chatsResponse.data;
        console.log('Получены чаты:', chats);

        // Для каждого чата получаем его инвентаризацию
        console.log('Начинаем загрузку инвентаризации для каждого чата...');
        const chatsWithInventory = await Promise.all(
            chats.map(async (chat) => {
                console.log(`Загрузка инвентаризации для чата ${chat.chat_id} (${chat.chat_title})`);
                try {
                    const inventoryResponse = await api.get(`/inventory/${chat.chat_id}`);
                    console.log(`Получен ответ для чата ${chat.chat_id}:`, inventoryResponse);
                    console.log(`Данные инвентаризации для чата ${chat.chat_id}:`, inventoryResponse.data);
                    
                    const chatWithInventory = {
                        ...chat,
                        inventory: inventoryResponse.data
                    };
                    console.log(`Итоговые данные для чата ${chat.chat_id}:`, chatWithInventory);
                    return chatWithInventory;
                } catch (error) {
                    console.error(`Ошибка при загрузке инвентаризации для чата ${chat.chat_id}:`, error);
                    console.error('Полная информация об ошибке:', {
                        response: error.response,
                        request: error.request,
                        message: error.message
                    });
                    
                    // Возвращаем чат с пустой инвентаризацией
                    const chatWithEmptyInventory = {
                        ...chat,
                        inventory: {
                            lastUpdated: null,
                            progress: 0
                        }
                    };
                    console.log(`Возвращаем чат с пустой инвентаризацией:`, chatWithEmptyInventory);
                    return chatWithEmptyInventory;
                }
            })
        );

        console.log('=== Итоговый результат загрузки ===');
        console.log('Все чаты с инвентаризацией:', chatsWithInventory);
        return chatsWithInventory;
    } catch (error) {
        console.error('=== Критическая ошибка при загрузке чатов ===');
        console.error('Ошибка:', error);
        console.error('Полная информация об ошибке:', {
            response: error.response,
            request: error.request,
            message: error.message
        });
        throw error;
    }
};

// ... rest of the code ... 