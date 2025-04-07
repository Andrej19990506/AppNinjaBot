import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { WebApp } from '../../types/telegram';
import { User, UserState } from '../../types/user';
import { Admin } from '../../types/inventory';
import { ChatContext } from './chatSlice';
import { userApi } from '../../services/api';
import axios from 'axios';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Group {
    chat_id: string;
    chat_title: string;
    group_type?: string;
    id?: number;
}

// Тестовые данные для режима разработки
const DEV_MODE_USER_DATA: User = {
    id: 1682142222, // ID тестового пользователя (Андрей Николаевич)
    // Присваиваем пустые строки для теста окна обновления профиля
    first_name: "",
    last_name: "",
    username: "andrejnikolaevich1999",
    photo_url: "https://api.telegram.org/file/bot7878489788:AAHupjPYeWpzVwo77F_BCR6fIA1I_P8p_Uc/photos/file_0.jpg",
    isAdmin: false,
    adminRights: null,
    is_senior_courier: true,
    groups: [
        {
            chat_id: "-1004755640016",
            chat_title: "Повара Словцова",
            group_type: "chef"
        },
        {
            chat_id: "-1004611898635",
            chat_title: "Курьеры Высотная",
            group_type: "courier"
        },
        {
            chat_id: "-1004721237800",
            chat_title: "Курьеры Баумана",
            group_type: "courier"
        }
    ]
};

const initialState: UserState = {
    user: null,
    isInitialized: false,
    error: null,
    loading: false
};

// Инициализация пользователя из Telegram WebApp
export const initializeFromTelegram = createAsyncThunk(
    'user/initializeFromTelegram',
    async (_, { rejectWithValue }) => {
        console.log('=== 👤 Инициализация пользователя из Telegram ===');
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENV === 'development';
        
        console.log('📱 WebApp данные:', {
            available: !!webApp,
            hasUser: !!webApp?.initDataUnsafe?.user,
            initData: webApp?.initDataUnsafe,
            isDevelopmentMode
        });

        let userId: number | undefined;
        let userDataFromWebApp: WebApp['initDataUnsafe']['user'] | undefined;

        if (isDevelopmentMode && !webApp?.initDataUnsafe?.user?.id) {
            console.log('🔧 Режим разработки - используем тестовые данные пользователя');
            userId = DEV_MODE_USER_DATA.id;
            userDataFromWebApp = {
                id: userId,
                first_name: DEV_MODE_USER_DATA.first_name,
                last_name: DEV_MODE_USER_DATA.last_name,
                username: DEV_MODE_USER_DATA.username,
                photo_url: DEV_MODE_USER_DATA.photo_url,
            };
        } else if (webApp?.initDataUnsafe?.user?.id) {
            userId = webApp.initDataUnsafe.user.id;
            userDataFromWebApp = webApp.initDataUnsafe.user;
        } else {
            console.error('❌ Данные пользователя Telegram недоступны');
            return rejectWithValue('Telegram WebApp user data not available');
        }

        if (!userId || !userDataFromWebApp) {
            console.error('❌ Не удалось определить ID пользователя или данные WebApp');
            return rejectWithValue('Could not determine user ID or WebApp data');
        }

        // Создаем базовый объект пользователя из данных Telegram или тестовых данных
        let user: User = {
            id: userId,
            first_name: userDataFromWebApp.first_name || "",
            last_name: userDataFromWebApp.last_name || "",
            username: userDataFromWebApp.username?.trim() || "",
            photo_url: userDataFromWebApp.photo_url || "",
            language_code: userDataFromWebApp.language_code,
            isAdmin: false,
            adminRights: null,
            is_senior_courier: false,
            groups: [],
        };

        try {
            console.log(`🔄 Загрузка контекста (групп) для пользователя ${userId}...`);
            const groupsData = await userApi.getUserContext(userId);
            user.groups = groupsData;
            console.log('✅ Контекст (группы) пользователя загружен:', user.groups);

            try {
                console.log(`🔄 Загрузка профиля для пользователя ${userId}...`);
                const profileData = await userApi.getUserProfile(userId);
                
                if (profileData) {
                    console.log('✅ Профиль пользователя загружен:', profileData);
                    // Обновляем пользователя данными из профиля
                    // Приоритет данных: Профиль > Telegram (для полей, которые есть и там и там)
                    user = {
                        ...user, // Сохраняем уже полученные группы и базовые данные
                        // Убеждаемся, что id остается Telegram ID
                        id: profileData.user_id || userId, 
                        // Убираем user_id, так как его нет в типе User
                        // user_id: profileData.user_id || userId, 
                        first_name: profileData.first_name || user.first_name, // Используем из профиля, если есть
                        last_name: profileData.last_name || user.last_name, // Используем из профиля, если есть
                        username: profileData.username || user.username, // Используем из профиля, если есть
                        photo_url: profileData.photo_url || user.photo_url, // Используем из профиля, если есть
                        is_senior_courier: profileData.is_senior_courier || false, // !!! Получаем актуальный статус
                        // Обновите другие поля, если они есть в UserProfileResponse и User
                        // isAdmin: profileData.is_admin || false,
                    };
                     // Расширяем лог, чтобы видеть все поля, включая groups
                     console.log('🔄 Пользователь обновлен данными из профиля:', JSON.stringify(user, null, 2)); 
                } else {
                    console.warn(`⚠️ Не удалось загрузить профиль для пользователя ${userId} (возможно, 404). Используются базовые данные.`);
                }

            } catch (profileError) {
                console.error('❌ Ошибка при загрузке профиля пользователя:', profileError);
            }

        } catch (contextError) {
            console.error('❌ Ошибка при загрузке контекста пользователя (групп):', contextError);
            let errorMessage = 'Неизвестная ошибка при загрузке контекста.';
            if (axios.isAxiosError(contextError)) {
                errorMessage = contextError.response?.data?.detail || contextError.message || errorMessage;
            } else if (contextError instanceof Error) {
                errorMessage = contextError.message;
            }
            console.warn(`⚠️ Инициализация пользователя продолжится без данных о группах. Ошибка: ${errorMessage}`);
        }

        // Расширяем лог
        console.log('✅ Итоговые данные пользователя для Redux:', JSON.stringify(user, null, 2));
        return user;
    }
);

// Проверка прав администратора для конкретного чата
export const checkAdminRights = createAsyncThunk<void, {
    userId: number;
    chatId: string;
    admins: Admin[];
    context?: ChatContext;
}>(
    'user/checkAdminRights',
    async ({ userId, chatId, admins, context = 'inventory' }, { dispatch }) => {
        try {
            console.log('👤 User ID:', userId);
            console.log('💬 Chat ID:', chatId);

            // Проверяем каждого админа
            for (const admin of admins) {
                console.log('🔄 Сравнение ID админа:', admin.user_id, 'тип:', typeof admin.user_id);
                console.log('🔄 С ID пользователя:', userId, 'тип:', typeof userId);
                
                if (admin.user_id === userId) {
                    console.log('✅ Пользователь является администратором');
                    // Обновляем статус администратора
                    dispatch(updateAdminStatus({ isAdmin: true, adminRights: admin }));
                    return;
                }
            }

            throw new Error(`У вас нет прав для ${context === 'inventory' ? 'инвентаризации' : context === 'writeoff' ? 'списания' : 'просмотра событий'} в этом чате`);
        } catch (error) {
            throw error;
        }
    }
);

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        updateUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
        },
        clearUserData: (state) => {
            state.user = null;
            state.isInitialized = false;
            state.error = null;
        },
        updateAdminStatus: (state, action) => {
            const { isAdmin, adminRights } = action.payload;
            if (state.user) {
                state.user.isAdmin = isAdmin;
                state.user.adminRights = adminRights;
            }
        },
        updateSeniorCourierStatus: (state, action: PayloadAction<boolean>) => {
            if (state.user) {
                state.user.is_senior_courier = action.payload;
                console.log('🌟 Обновлен статус старшего курьера в хранилище:', action.payload);
            }
        },
        setUserSeniorStatus: (state, action: PayloadAction<boolean>) => {
            if (state.user) {
                state.user.is_senior_courier = action.payload;
            }
        },
        resetUserState: () => initialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(initializeFromTelegram.pending, (state) => {
                state.isInitialized = false;
                state.error = null;
                console.log("⏳ userSlice: initializeFromTelegram.pending");
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action: PayloadAction<User>) => {
                state.user = action.payload;
                state.isInitialized = true;
                state.error = null;
                // Расширяем лог
                console.log("✅ userSlice: initializeFromTelegram.fulfilled", JSON.stringify(action.payload, null, 2));
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.isInitialized = false;
                state.error = action.payload as string || action.error.message || 'Failed to initialize user';
                state.user = null;
                console.error("❌ userSlice: initializeFromTelegram.rejected", action.payload || action.error);
            })
            .addCase(checkAdminRights.rejected, (state) => {
                if (state.user) {
                    // Устанавливаем isAdmin в false при ошибке проверки прав
                    state.user.isAdmin = false;
                    state.user.adminRights = null;
                }
            });
    }
});

// Экспортируем actions и reducer
export const { 
    updateUser, 
    clearUserData, 
    updateAdminStatus, 
    updateSeniorCourierStatus, 
    setUserSeniorStatus,
    resetUserState 
} = userSlice.actions;

export default userSlice.reducer;

// Экспортируем сам объект слайса для использования в listenerMiddleware
export { userSlice };

// --- Добавляем экспорт селекторов --- 
export const selectUser = (state: { user: UserState }) => state.user.user;
export const selectIsUserInitialized = (state: { user: UserState }) => state.user.isInitialized;
export const selectUserInitializationError = (state: { user: UserState }) => state.user.error;
// --- ---------------------------- --- 