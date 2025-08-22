import { createAsyncThunk } from '@reduxjs/toolkit';
import { WebApp } from '../../../types/telegram';
import { User, AdminRights } from '../../../types/user';
import { Admin } from '../../../types/inventoryTypes';
import { ChatContext } from '@shared/store/chatSlice/chatTypes';
import { api } from '@shared/api/api';
import { updateMemberSeniority, updateCourierProfile } from '@features/courierSchedule/services/courierApi';
import { checkServerHealthWithRetry } from '@shared/utils/serverHealthCheck';

// --- Thunk: проверка доступности сервера ---
export const checkServerHealthThunk = createAsyncThunk(
    'user/checkServerHealth',
    async (_, { rejectWithValue }) => {
        try {
            console.log('🔍 [checkServerHealthThunk] Начинаем проверку доступности сервера...');
            const serverStatus = await checkServerHealthWithRetry(3, 1000);
            
            if (!serverStatus.isAvailable) {
                console.error('❌ [checkServerHealthThunk] Сервер недоступен:', serverStatus.error);
                return rejectWithValue(`Сервер недоступен: ${serverStatus.error}`);
            }
            
            console.log('✅ [checkServerHealthThunk] Сервер доступен, время ответа:', serverStatus.responseTime, 'ms');
            return serverStatus;
        } catch (error: any) {
            console.error('💀 [checkServerHealthThunk] Критическая ошибка проверки сервера:', error);
            return rejectWithValue('Критическая ошибка проверки сервера');
        }
    }
);

// --- Thunk: инициализация пользователя из Telegram WebApp ---
export const initializeFromTelegram = createAsyncThunk(
    'user/initializeFromTelegram',
    async (_, { rejectWithValue }) => {
        try {
            const webApp = window.Telegram?.WebApp as WebApp | undefined;
            const isDevelopmentMode = import.meta.env.VITE_ENV === 'development';
            let userId: number | undefined;
            let userDataFromWebApp: WebApp['initDataUnsafe']['user'] | undefined;
            if (isDevelopmentMode && !webApp?.initDataUnsafe?.user?.id) {
                userId = 1682142222;
                userDataFromWebApp = {
                    id: userId,
                    first_name: '',
                    last_name: '',
                    username: 'andrejnikolaevich1999',
                    photo_url: 'https://api.telegram.org/file/bot7878489788:AAHupjPYeWpzVwo77F_BCR6fIA1I_P8p_Uc/photos/file_0.jpg',
                };
            } else if (webApp?.initDataUnsafe?.user?.id) {
                userId = webApp.initDataUnsafe.user.id;
                userDataFromWebApp = webApp.initDataUnsafe.user;
            } else {
                return rejectWithValue('Данные пользователя Telegram недоступны');
            }
            if (!userId || !userDataFromWebApp) {
                return rejectWithValue('Не удалось определить ID пользователя или данные WebApp');
            }
            // 📸 [PHOTO DEBUG] Логируем photo_url из WebApp
            console.log(`📸 [PHOTO DEBUG] WebApp photo_url:`, userDataFromWebApp.photo_url);
            
            let user: User = {
                id: userId,
                first_name: userDataFromWebApp.first_name || '',
                last_name: userDataFromWebApp.last_name || '',
                username: userDataFromWebApp.username?.trim() || '',
                photo_url: userDataFromWebApp.photo_url || '',
                language_code: userDataFromWebApp.language_code,
                isAdmin: false,
                adminRights: null,
                groups: [],
            };
            
            try {
                const groupsData = await api.user.getUserContext(userId);
                user.groups = groupsData;
                try {
                    const profileData = await api.user.getUserProfile(userId);
                    if (profileData) {
                        // 📸 [PHOTO DEBUG] Логируем photo_url из API
                        console.log(`📸 [PHOTO DEBUG] API profile photo_url:`, profileData.photo_url);
                        
                        user = {
                            ...user,
                            id: profileData.user_id || userId,
                            first_name: profileData.first_name || user.first_name,
                            last_name: profileData.last_name || user.last_name,
                            username: profileData.username || user.username,
                            photo_url: profileData.photo_url || user.photo_url,
                        };
                        
                        // 📸 [PHOTO DEBUG] Финальный photo_url пользователя
                        console.log(`📸 [PHOTO DEBUG] Final user photo_url:`, user.photo_url);
                    }
                } catch (profileError) {
                    console.error('[initializeFromTelegram] Ошибка получения профиля пользователя:', profileError);
                    // Проверяем, не является ли это ошибкой сервера
                    if (profileError instanceof Error) {
                        if (profileError.message.includes('Network Error') || 
                            profileError.message.includes('ERR_CONNECTION_REFUSED')) {
                            throw profileError; // Пробрасываем ошибку сервера
                        }
                        console.warn('[initializeFromTelegram] Профиль недоступен, используем базовые данные');
                    }
                }
                
                // 📸 [PHOTO DEBUG] Итоговые данные пользователя
                console.log(`📸 [PHOTO DEBUG] User object:`, { 
                    id: user.id, 
                    first_name: user.first_name, 
                    photo_url: user.photo_url 
                });
            } catch (contextError) {
                console.error('[initializeFromTelegram] Ошибка получения контекста пользователя:', contextError);
                // Проверяем, не является ли это ошибкой сервера
                if (contextError instanceof Error) {
                    if (contextError.message.includes('Network Error') || 
                        contextError.message.includes('ERR_CONNECTION_REFUSED')) {
                            throw contextError; // Пробрасываем ошибку сервера
                        }
                    // 404 и другие 4xx ошибки - это не ошибки сервера
                    if (contextError.message.includes('404')) {
                        console.warn('[initializeFromTelegram] Пользователь не найден (404), используем базовые данные');
                    } else {
                        console.warn('[initializeFromTelegram] Контекст недоступен, используем базовые данные');
                    }
                }
            }
            
            return user;
        } catch (error: any) {
            console.error('[initializeFromTelegram] Общая ошибка:', error);
            // Теперь мы знаем, что сервер доступен, поэтому это ошибка данных
            return rejectWithValue(error.message || 'Неизвестная ошибка инициализации');
        }
    }
);

// --- Thunk: проверка прав администратора ---
export const checkAdminRights = createAsyncThunk<void, {
    userId: number;
    chatId: string;
    admins: Admin[];
    context?: ChatContext;
}>(
    'user/checkAdminRights',
    async ({ userId, chatId, admins, context = 'inventory' }, { dispatch }) => {
        for (const admin of admins) {
            if (admin.user_id === userId) {
                const calculatedAdminRights: AdminRights = {
                    canManageInventory: true,
                    canManageUsers: true
                };
                dispatch({ type: 'user/updateAdminStatus', payload: { isAdmin: true, adminRights: calculatedAdminRights } });
                return;
            }
        }
        throw new Error(`У вас нет прав для ${context === 'inventory' ? 'инвентаризации' : context === 'writeoff' ? 'списания' : 'просмотра событий'} в этом чате`);
    }
);

// --- Thunk: обновление профиля пользователя (имя/фамилия) ---
export const updateUserProfileThunk = createAsyncThunk<
    User,
    { userId: number | string; data: { firstName: string; lastName: string } },
    { rejectValue: string }
>(
    'user/updateProfile',
    async ({ userId, data }, { rejectWithValue, getState }) => {
        try {
            console.log('[updateUserProfileThunk] Отправляем на сервер:', { userId, data });
            const updateResult = await updateCourierProfile(userId, data);
            console.log('[updateUserProfileThunk] Ответ updateCourierProfile:', updateResult);
            const fullProfile = await api.user.getUserProfile(userId);
            console.log('[updateUserProfileThunk] Ответ getUserProfile:', fullProfile);
            const currentState = (getState() as any).user;
            if (!currentState.user) {
                 throw new Error('Текущее состояние пользователя отсутствует');
            }
            const result = {
                ...currentState.user,
                ...fullProfile
            };
            console.log('[updateUserProfileThunk] Итоговый объект для редакса:', result);
            return result;
        } catch (error: any) {
            const message = error.message || 'Не удалось обновить профиль.';
            console.error('[updateUserProfileThunk] Ошибка:', message, error);
            return rejectWithValue(message);
        }
    }
);

// --- Thunk: обновление статуса старшего курьера ---
export const updateSeniorityStatus = createAsyncThunk<
    { groupTelegramId: string; userTelegramId: string; isSenior: boolean | null },
    { groupTelegramId: string; userTelegramId: string; isSenior: boolean },
    { rejectValue: string }
>(
    'user/updateSeniorityStatus',
    async ({ groupTelegramId, userTelegramId, isSenior }, { rejectWithValue }) => {
        try {
            const response = await updateMemberSeniority(groupTelegramId, userTelegramId, isSenior);
            return {
                groupTelegramId,
                userTelegramId,
                isSenior: response.is_senior_courier
            };
        } catch (error: any) {
            const message = error.message || 'Не удалось обновить статус старшего курьера.';
            return rejectWithValue(message);
        }
    }
); 