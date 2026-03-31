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

// Хранилище токена (в памяти, можно перенести в localStorage/Redux)
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Функция для установки токена
export const setAuthToken = (token: string | null, refresh?: string | null) => {
    accessToken = token;
    if (refresh !== undefined) {
        refreshToken = refresh;
    }
    // Сохраняем в localStorage для персистентности
    if (token) {
        localStorage.setItem('access_token', token);
    } else {
        localStorage.removeItem('access_token');
    }
    if (refresh) {
        localStorage.setItem('refresh_token', refresh);
    } else if (refresh === null) {
        localStorage.removeItem('refresh_token');
    }
};

// Функция для получения токена
export const getAuthToken = (): string | null => {
    if (!accessToken) {
        // Пытаемся восстановить из localStorage
        accessToken = localStorage.getItem('access_token');
    }
    return accessToken;
};

// Функция для декодирования JWT токена (без проверки подписи)
// Используется только для извлечения user_id из токена
export const decodeJWT = (token: string): { sub?: string; [key: string]: any } | null => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        // Декодируем payload (вторая часть)
        const payload = parts[1];
        // Добавляем padding если нужно
        const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
        const decoded = JSON.parse(atob(paddedPayload));
        return decoded;
    } catch (error) {
        console.error('❌ [Auth] Ошибка декодирования JWT:', error);
        return null;
    }
};

// Функция для получения user_id из токена
export const getUserIdFromToken = (token: string | null): number | null => {
    if (!token) {
        return null;
    }
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.sub) {
        return null;
    }
    try {
        return parseInt(decoded.sub, 10);
    } catch (error) {
        console.error('❌ [Auth] Ошибка парсинга user_id из токена:', error);
        return null;
    }
};

// Функция для извлечения user_id из Telegram initData
export const getUserIdFromInitData = (initData: string): number | null => {
    try {
        // initData - это query string вида "user=%7B%22id%22%3A123456%2C...%7D&..."
        const params = new URLSearchParams(initData);
        const userParam = params.get('user');
        
        if (!userParam) {
            console.warn('⚠️ [Auth] Параметр user не найден в initData');
            return null;
        }
        
        // Декодируем URL-encoded JSON
        const userJson = decodeURIComponent(userParam);
        const user = JSON.parse(userJson);
        
        if (!user || !user.id) {
            console.warn('⚠️ [Auth] user.id не найден в initData');
            return null;
        }
        
        const userId = parseInt(user.id, 10);
        if (isNaN(userId)) {
            console.warn('⚠️ [Auth] user.id не является числом:', user.id);
            return null;
        }
        
        return userId;
    } catch (error) {
        console.error('❌ [Auth] Ошибка извлечения user_id из initData:', error);
        return null;
    }
};

// Функция для авторизации через токен от бота
export const authenticateWithBotToken = async (token: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: any;
    groups: any[];
}> => {
    console.log('🔐 [Auth] Начинаем авторизацию через токен бота');
    console.log('🔐 [Auth] Токен:', token.substring(0, 8) + '...');
    try {
        const response = await axiosInstance.post('/v1/auth/telegram/bot', {
            token: token
        });
        console.log('✅ [Auth] Авторизация через бота успешна');
        console.log('✅ [Auth] Ответ сервера:', {
            hasTokens: !!response.data.tokens,
            hasUser: !!response.data.user,
            hasGroups: !!response.data.groups,
            groupsCount: response.data.groups?.length || 0
        });
        
        // Бэкенд возвращает { tokens: { access_token, refresh_token }, user, groups }
        const { tokens, user, groups } = response.data;
        const access_token = tokens.access_token;
        const refresh_token = tokens.refresh_token;
        
        // Сохраняем токены
        setAuthToken(access_token, refresh_token);
        
        return { access_token, refresh_token, user, groups };
    } catch (error: any) {
        console.error('❌ [Auth] Ошибка авторизации через бота:', error);
        if (axios.isAxiosError(error)) {
            const detail = error.response?.data?.detail || error.message;
            throw new Error(detail || 'Ошибка авторизации через токен бота');
        }
        throw error;
    }
};

// Функция для авторизации через Telegram WebApp
export const authenticateWithTelegram = async (initData: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: any;
    groups: any[];
}> => {
    console.log('🔐 [Auth] Начинаем авторизацию через Telegram WebApp');
    console.log('🔐 [Auth] initData длина:', initData.length);
    console.log('🔐 [Auth] initData preview:', initData.substring(0, 100));
    console.log('🔐 [Auth] Отправляем запрос на:', `${axiosInstance.defaults.baseURL}/v1/auth/telegram/webapp`);
    try {
        const response = await axiosInstance.post('/v1/auth/telegram/webapp', {
            init_data: initData
        });
        console.log('✅ [Auth] Авторизация успешна');
        console.log('✅ [Auth] Ответ сервера:', {
            hasTokens: !!response.data.tokens,
            hasUser: !!response.data.user,
            hasGroups: !!response.data.groups,
            groupsCount: response.data.groups?.length || 0
        });
        
        // Бэкенд возвращает { tokens: { access_token, refresh_token }, user, groups }
        const { tokens, user, groups } = response.data;
        const access_token = tokens.access_token;
        const refresh_token = tokens.refresh_token;
        
        // Сохраняем токены
        setAuthToken(access_token, refresh_token);
        
        return { access_token, refresh_token, user, groups };
    } catch (error: any) {
        console.error('❌ [Auth] Ошибка авторизации:', error);
        if (axios.isAxiosError(error)) {
            const detail = error.response?.data?.detail || error.message;
            throw new Error(detail || 'Ошибка авторизации через Telegram');
        }
        throw error;
    }
};

// Локальная авторизация (без Telegram)
export const authenticateWithLocal = async (login: string, password: string): Promise<{
    access_token: string;
    refresh_token: string;
    user: any;
    groups: any[];
}> => {
    try {
        const response = await axiosInstance.post('/v1/auth/local/login', { login, password });
        const { tokens, user, groups } = response.data;
        const access_token = tokens.access_token;
        const refresh_token = tokens.refresh_token;
        setAuthToken(access_token, refresh_token);
        return { access_token, refresh_token, user, groups };
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const detail = error.response?.data?.detail || error.message;
            throw new Error(detail || 'Ошибка локальной авторизации');
        }
        throw error;
    }
};

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

// Интерцептор для логирования запросов и добавления токена (объединенный)
axiosInstance.interceptors.request.use(
    (config: any) => {
        // Добавляем токен если есть
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Логируем запрос
        console.log('🚀 API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            fullURL: `${config.baseURL}${config.url}`,
            hasToken: !!token,
            data: config.data
        });
        return config;
    },
    (error: any) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ошибок и refresh токена (объединенный)
axiosInstance.interceptors.response.use(
    (response: AxiosResponse<any>) => response,
    async (error: any) => {
        const originalRequest = error.config;
        
        // Логируем ошибку
        console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        
        // Если получили 401 и это не запрос на refresh
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/token/refresh')) {
            originalRequest._retry = true;
            
            // Пытаемся обновить токен
            const storedRefreshToken = localStorage.getItem('refresh_token');
            if (storedRefreshToken) {
                try {
                    console.log('🔄 [Auth] Пытаемся обновить токен');
                    const response = await axiosInstance.post('/v1/auth/token/refresh', {
                        refresh_token: storedRefreshToken
                    });
                    
                    // Бэкенд возвращает AuthTokenPair напрямую
                    const { access_token, refresh_token } = response.data;
                    setAuthToken(access_token, refresh_token);
                    
                    // Повторяем оригинальный запрос с новым токеном
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    console.error('❌ [Auth] Не удалось обновить токен, требуется повторная авторизация');
                    setAuthToken(null, null);
                    // Можно диспатчить событие для редиректа на авторизацию
                    window.dispatchEvent(new CustomEvent('auth:token_expired'));
                    return Promise.reject(refreshError);
                }
            }
        }
        
        // Обработка других ошибок
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw error;
    }
); 