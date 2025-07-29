import axios, { type AxiosResponse } from 'axios';
import { socketService } from '@shared/services/socketService';
import { 
    getInventoryTemplate, 
    getChatInventory, 
    updateChatInventory, 
    getItemHistory as inventoryGetItemHistory 
} from '@features/Inventory/services/inventoryApi';

const runtimeApiUrl = window.APP_CONFIG?.API_URL;
const buildtimeApiUrl = import.meta.env.VITE_API_URL;

const baseURL = runtimeApiUrl || buildtimeApiUrl;

// Логирование для отладки
if (window.APP_CONFIG?.DEBUG === 'true') {
    console.log('🔧 [API] Configuration:', {
        runtime: runtimeApiUrl,
        buildtime: buildtimeApiUrl,
        selected: baseURL,
        fullConfig: window.APP_CONFIG
    });
}

if (runtimeApiUrl) {
    console.log('✅ [API] Using runtime config URL:', runtimeApiUrl);
} else if (buildtimeApiUrl) {
    console.log('⚠️ [API] Using buildtime config URL:', buildtimeApiUrl);
} else {
    console.error('❌ [API] No API URL found in runtime or buildtime config!');
}

// Создаем инстанс axios с базовыми настройками
const axiosInstance = axios.create({
    baseURL: baseURL,
    timeout: 300000, // 5 минут таймаут для больших файлов
    headers: {
        'Content-Type': 'application/json',
        // Добавляем заголовки для предотвращения кэширования
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
});

export { axiosInstance };

const emitSocketEvent = (event: string, data: any): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!socketService.isConnected()) {
            console.warn('⚠️ Socket not connected for event:', event);
            resolve(false);
            return;
        }
        
        socketService.emitWithAck(event, data, (response: any) => {
            if (response && response.error) {
                console.error('❌ Socket event error:', response.error);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

// Переносим объявление userApi ПЕРЕД его использованием в export const api
const userApi = { 
    getCurrentUser: () => {
        console.log('=== 📡 Запрос данных пользователя ===');
        console.log('🔗 URL:', `${baseURL}/users/me`);
        return axiosInstance.get('/users/me');
    },

    // Новая функция для получения контекста пользователя (групп)
    getUserContext: async (userId: string | number): Promise<any[]> => {
        console.log(`=== 📡 Запрос контекста пользователя ID: ${userId} ===`);
        const url = `/v1/users/${userId}/context`; // Используем новый путь V1
        console.log('🔗 URL запроса:', url);
        console.log('🔗 Полный URL:', `${axiosInstance.defaults.baseURL}${url}`);
        try {
            // Ожидаем массив объектов GroupRead из Pydantic схемы
            const response = await axiosInstance.get<any[]>(url);
            console.log(`✅ Контекст для пользователя ${userId} получен:`, response.data);
            return response.data || []; // Возвращаем данные или пустой массив
        } catch (error: any) {
            console.error(`❌ Ошибка при запросе контекста для пользователя ${userId}`, error);
            if (axios.isAxiosError(error)) {
                const detail = error.response?.data?.detail || error.message;
                if (error.response?.status === 404) {
                    console.log(`ℹ️ Пользователь ${userId} не найден или у него нет контекста (404).`);
                    return []; // Возвращаем пустой массив
                }
                throw new Error(detail || 'Ошибка при получении контекста пользователя.');
            } else if (error instanceof Error) {
                throw error;
            }
            throw new Error('Неизвестная ошибка при получении контекста пользователя.');
        }
    },

    // --- НОВАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПРОФИЛЯ --- 
    getUserProfile: async (userId: string | number): Promise<any> => {
        console.log(`=== 👤 Запрос профиля пользователя ID: ${userId} ===`);
        const url = `/v1/users/${userId}/profile`; // Новый эндпоинт
        console.log('🔗 URL запроса профиля:', url);
        console.log('🔗 Полный URL профиля:', `${axiosInstance.defaults.baseURL}${url}`);
        try {
            // Ожидаем объект UserProfileResponse
            const response = await axiosInstance.get<any>(url);
            console.log(`✅ Профиль для пользователя ${userId} получен:`, response.data);
            return response.data; // Возвращаем данные профиля
        } catch (error: any) {
            console.error(`❌ Ошибка при запросе профиля для пользователя ${userId}`, error);
            // Можно добавить более детальную обработку ошибок Axios, как в getUserContext
            if (axios.isAxiosError(error)) {
                const detail = error.response?.data?.detail || error.message;
                // Если профиль не найден (404), возможно, стоит вернуть null или спец. объект
                if (error.response?.status === 404) {
                    console.warn(`⚠️ Профиль для пользователя ${userId} не найден (404).`);
                    // Решите, что возвращать: null, пустой объект, или пробрасывать ошибку
                    return null; // Пример: возвращаем null
                }
                throw new Error(detail || 'Ошибка при получении профиля пользователя.');
            } else if (error instanceof Error) {
                throw error;
            }
            throw new Error('Неизвестная ошибка при получении профиля пользователя.');
        }
    }
};

// Группируем все API под одним объектом api
export const api = {
    inventory: {
        getTemplate: getInventoryTemplate,
        getChatInventory: getChatInventory,
        updateChatInventory: updateChatInventory
    },
    history: {
        getItemHistory: inventoryGetItemHistory
    },
    user: userApi // Теперь userApi объявлен выше
};

// Интерцептор для логирования запросов
axiosInstance.interceptors.request.use(
    (config: any) => {
        console.log('🚀 API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            fullURL: `${config.baseURL}${config.url}`,
            data: config.data
        });
        return config;
    },
    (error: any) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ошибок
axiosInstance.interceptors.response.use(
    (response: AxiosResponse<any>) => response,
    (error: any) => {
        console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw error;
    }
); 