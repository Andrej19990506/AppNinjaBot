import { createAsyncThunk } from '@reduxjs/toolkit';
import { WebApp } from '../../../types/telegram';
import { User, AdminRights } from '../../../types/user';
import { Admin } from '../../../types/inventoryTypes';
import { ChatContext } from '@shared/store/chatSlice/chatTypes';
import { api, authenticateWithTelegram, authenticateWithBotToken, axiosInstance } from '@shared/api/api';
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
            console.error('💀 [checkServerHealthThunk] Критическая ошибка проверки сервера:', {
                error: error.message || error,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
            return rejectWithValue('Критическая ошибка проверки сервера');
        }
    }
);

// --- Thunk: инициализация пользователя из Telegram WebApp ---
export const initializeFromTelegram = createAsyncThunk(
    'user/initializeFromTelegram',
    async (_, { rejectWithValue }) => {
        try {
            // Сначала проверяем наличие auth_token в URL (авторизация через бота)
            const urlParams = new URLSearchParams(window.location.search);
            const authToken = urlParams.get('auth_token');
            
            if (authToken) {
                console.log('🔐 [Auth] Обнаружен auth_token в URL, авторизуемся через бота');
                try {
                    // Удаляем токен из URL для безопасности
                    urlParams.delete('auth_token');
                    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
                    window.history.replaceState({}, '', newUrl);
                    
                    const authResult = await authenticateWithBotToken(authToken);
                    
                    console.log('✅ [initializeFromTelegram] Авторизация через бота успешна, формируем объект пользователя');
                    
                    // Формируем объект пользователя из результата авторизации
                    // Маппим группы из формата AuthenticatedGroup в формат, ожидаемый фронтендом
                    const mappedGroups = (authResult.groups || []).map((group: any) => ({
                        id: undefined,
                        group_id: group.group_id,
                        chat_id: group.group_id,
                        title: group.title || '',
                        chat_title: group.title || '',
                        group_type: group.group_type || '',
                        username: undefined,
                        description: undefined,
                        members_count: undefined,
                        json_metadata: undefined,
                        supplies_config: undefined,
                        created_at: undefined,
                        role: group.role || 'member',
                        is_senior_courier: group.is_senior_courier || false,
                    }));
                    
                    const user: User = {
                        id: authResult.user.user_id,
                        first_name: authResult.user.first_name || '',
                        last_name: authResult.user.last_name || '',
                        username: authResult.user.username || '',
                        photo_url: authResult.user.photo_url || '',
                        groups: mappedGroups,
                        isAdmin: false, // Определяется на основе групп
                        adminRights: {} as AdminRights
                    };
                    
                    return user;
                } catch (error: any) {
                    console.error('❌ [Auth] Ошибка авторизации через токен бота:', error);
                    return rejectWithValue(error.message || 'Ошибка авторизации через токен бота');
                }
            }
            
            // Проверяем, есть ли уже сохраненные токены (ПЕРЕД проверкой initData)
            // Это позволяет восстановить сессию после перезагрузки страницы
            const { getAuthToken, getUserIdFromToken, getUserIdFromInitData, setAuthToken } = await import('@shared/api/api');
            let existingToken = getAuthToken();
            
            // Получаем webApp один раз для использования во всей функции
            const webApp = window.Telegram?.WebApp as WebApp | undefined;
            
            // Проверяем, соответствует ли сохраненный токен текущему пользователю Telegram
            if (existingToken && webApp?.initData && webApp.initData.length > 0) {
                const tokenUserId = getUserIdFromToken(existingToken);
                const telegramUserId = getUserIdFromInitData(webApp.initData);
                
                if (tokenUserId && telegramUserId && tokenUserId !== telegramUserId) {
                    console.warn('⚠️ [Auth] Сохраненный токен принадлежит другому пользователю!');
                    console.warn(`⚠️ [Auth] User ID из токена: ${tokenUserId}, User ID из Telegram: ${telegramUserId}`);
                    console.log('🔄 [Auth] Очищаем токен и авторизуемся заново');
                    setAuthToken(null, null);
                    existingToken = null; // Обновляем переменную после очистки
                    // Продолжаем выполнение, чтобы авторизоваться через initData
                } else if (tokenUserId && telegramUserId && tokenUserId === telegramUserId) {
                    console.log('✅ [Auth] Сохраненный токен соответствует текущему пользователю Telegram');
                }
            }
            
            if (existingToken) {
                console.log('🔐 [Auth] Обнаружен сохраненный токен, проверяем валидность...');
                try {
                    // Получаем user_id из токена
                    const userId = getUserIdFromToken(existingToken);
                    if (!userId) {
                        throw new Error('Не удалось извлечь user_id из токена');
                    }
                    console.log(`🔐 [Auth] User ID из токена: ${userId}`);
                    
                    // Получаем данные пользователя через API используя сохраненный токен
                    const userProfile = await api.user.getUserProfile(userId);
                    const userContext = await api.user.getUserContext(userId);
                    
                    console.log('✅ [initializeFromTelegram] Данные пользователя получены через сохраненный токен');
                    
                    // Формируем объект пользователя из ответа API
                    const mappedGroups = (userContext || []).map((group: any) => ({
                        id: group.id,
                        group_id: group.group_id || group.chat_id,
                        chat_id: group.chat_id || group.group_id,
                        title: group.title || group.chat_title || '',
                        chat_title: group.chat_title || group.title || '',
                        group_type: group.group_type || '',
                        username: group.username,
                        description: group.description,
                        members_count: group.members_count,
                        json_metadata: group.json_metadata,
                        supplies_config: group.supplies_config,
                        created_at: group.created_at,
                        role: group.role || 'member',
                        is_senior_courier: group.is_senior_courier || false,
                    }));
                    
                    const user: User = {
                        id: userProfile.id || userProfile.user_id,
                        first_name: userProfile.first_name || '',
                        last_name: userProfile.last_name || '',
                        username: userProfile.username || '',
                        photo_url: userProfile.photo_url || '',
                        groups: mappedGroups,
                        isAdmin: false,
                        adminRights: {} as AdminRights
                    };
                    
                    return user;
                } catch (error: any) {
                    console.error('❌ [Auth] Ошибка получения данных пользователя через сохраненный токен:', error);
                    
                    // Если ошибка 401 (Unauthorized), пытаемся обновить токен через refresh token
                    if (error.response?.status === 401 || error.response?.status === 403) {
                        const refreshToken = localStorage.getItem('refresh_token');
                        if (refreshToken) {
                            try {
                                console.log('🔄 [Auth] Токен истек, пытаемся обновить через refresh token');
                                const refreshResponse = await axiosInstance.post('/v1/auth/token/refresh', {
                                    refresh_token: refreshToken
                                });
                                
                                const { access_token, refresh_token } = refreshResponse.data;
                                const { setAuthToken } = await import('@shared/api/api');
                                setAuthToken(access_token, refresh_token);
                                
                                console.log('✅ [Auth] Токен успешно обновлен, повторяем запрос данных пользователя');
                                
                                // Повторяем запрос данных пользователя с новым токеном
                                const userId = getUserIdFromToken(access_token);
                                if (!userId) {
                                    throw new Error('Не удалось извлечь user_id из обновленного токена');
                                }
                                
                                const userProfile = await api.user.getUserProfile(userId);
                                const userContext = await api.user.getUserContext(userId);
                                
                                console.log('✅ [initializeFromTelegram] Данные пользователя получены через обновленный токен');
                                
                                // Формируем объект пользователя из ответа API
                                const mappedGroups = (userContext || []).map((group: any) => ({
                                    id: group.id,
                                    group_id: group.group_id || group.chat_id,
                                    chat_id: group.chat_id || group.group_id,
                                    title: group.title || group.chat_title || '',
                                    chat_title: group.chat_title || group.title || '',
                                    group_type: group.group_type || '',
                                    username: group.username,
                                    description: group.description,
                                    members_count: group.members_count,
                                    json_metadata: group.json_metadata,
                                    supplies_config: group.supplies_config,
                                    created_at: group.created_at,
                                    role: group.role || 'member',
                                    is_senior_courier: group.is_senior_courier || false,
                                }));
                                
                                const user: User = {
                                    id: userProfile.id || userProfile.user_id,
                                    first_name: userProfile.first_name || '',
                                    last_name: userProfile.last_name || '',
                                    username: userProfile.username || '',
                                    photo_url: userProfile.photo_url || '',
                                    groups: mappedGroups,
                                    isAdmin: false,
                                    adminRights: {} as AdminRights
                                };
                                
                                return user;
                            } catch (refreshError: any) {
                                console.error('❌ [Auth] Не удалось обновить токен:', refreshError);
                                // Если refresh token тоже невалидный, очищаем все токены
                                const { setAuthToken } = await import('@shared/api/api');
                                setAuthToken(null, null);
                                console.log('🔄 [Auth] Refresh token невалиден, переходим к проверке initData или авторизации через бота');
                            }
                        } else {
                            // Нет refresh token, очищаем access token
                            const { setAuthToken } = await import('@shared/api/api');
                            setAuthToken(null, null);
                            console.log('🔄 [Auth] Нет refresh token, переходим к проверке initData или авторизации через бота');
                        }
                    } else {
                        // Другая ошибка, очищаем токены
                        const { setAuthToken } = await import('@shared/api/api');
                        setAuthToken(null, null);
                        console.log('🔄 [Auth] Ошибка получения данных пользователя, переходим к проверке initData или авторизации через бота');
                    }
                }
            }
            
            const isDevelopmentMode = import.meta.env.VITE_ENV === 'development';
            
            // Детальное логирование для отладки
            console.log('🔍 [Auth] Проверка Telegram WebApp:', {
                hasTelegram: !!window.Telegram,
                hasWebApp: !!webApp,
                hasInitData: !!webApp?.initData,
                hasInitDataUnsafe: !!webApp?.initDataUnsafe,
                initDataLength: webApp?.initData?.length || 0,
                initDataPreview: webApp?.initData?.substring(0, 50) || 'N/A',
                isDevelopmentMode
            });
            
            // Получаем initData из Telegram WebApp
            let initData: string | undefined;
            
            // Проверяем, есть ли валидный initData (не пустая строка)
            if (webApp?.initData && webApp.initData.length > 0) {
                initData = webApp.initData;
                console.log('✅ [Auth] Найден валидный initData, используем его для авторизации');
            } else {
                // Если initData недоступен или пустой, требуется авторизация через Telegram бота
                console.warn('⚠️ [Auth] initData недоступен или пустой, требуется авторизация через Telegram бота');
                return rejectWithValue('AUTH_REQUIRED'); // Специальный код для показа UI авторизации
            }
            
            if (!initData) {
                return rejectWithValue('Не удалось получить initData от Telegram WebApp');
            }
            
            console.log('🔐 [initializeFromTelegram] Начинаем авторизацию через Telegram');
            
            // Вызываем новый эндпоинт авторизации
            const authResult = await authenticateWithTelegram(initData);
            
            console.log('✅ [initializeFromTelegram] Авторизация успешна, формируем объект пользователя');
            
            // Формируем объект User из ответа авторизации
            // Маппим группы из формата AuthenticatedGroup в формат, ожидаемый фронтендом
            const mappedGroups = (authResult.groups || []).map((group: any) => ({
                id: undefined, // Внутренний ID группы (может быть не нужен)
                group_id: group.group_id,
                chat_id: group.group_id, // Для совместимости
                title: group.title || '',
                chat_title: group.title || '', // Для совместимости
                group_type: group.group_type || '',
                username: undefined,
                description: undefined,
                members_count: undefined,
                json_metadata: undefined,
                supplies_config: undefined,
                created_at: undefined,
                role: group.role || 'member',
                is_senior_courier: group.is_senior_courier || false,
            }));
            
            const user: User = {
                id: authResult.user.user_id,
                first_name: authResult.user.first_name || '',
                last_name: authResult.user.last_name || '',
                username: authResult.user.username || '',
                photo_url: authResult.user.photo_url || '',
                language_code: undefined, // Можно добавить в ответ бэкенда
                isAdmin: false,
                adminRights: null,
                groups: mappedGroups,
            };
            
            console.log('✅ [initializeFromTelegram] Пользователь инициализирован:', {
                id: user.id,
                first_name: user.first_name,
                groups_count: user.groups?.length || 0
            });
            
            return user;
        } catch (error: any) {
            console.error('[initializeFromTelegram] Общая ошибка:', {
                error: error.message || error,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
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