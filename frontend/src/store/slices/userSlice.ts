import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { WebApp } from '../../types/telegram';
import { User, UserState } from '../../types/user';
import { Admin } from '../../types/inventory';
import { ChatContext } from './chatSlice';
import config from '../../config';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Group {
    chat_id: string;
    chat_title: string;
    group_type?: string;
}

// Тестовые данные для режима разработки
const DEV_MODE_USER_DATA: User = {
    id: 1682142222, // ID тестового пользователя (Андрей Николаевич)
    first_name: "Андрей",
    last_name: "Николаевич",
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
    error: null
};

// Инициализация пользователя из Telegram WebApp
export const initializeFromTelegram = createAsyncThunk(
    'user/initializeFromTelegram',
    async () => {
        console.log('=== 👤 Инициализация пользователя из Telegram ===');
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENV === 'development';
        
        console.log('📱 WebApp данные:', {
            available: !!webApp,
            hasUser: !!webApp?.initDataUnsafe?.user,
            initData: webApp?.initDataUnsafe,
            isDevelopmentMode
        });

        // Если мы в режиме разработки и нет данных WebApp, используем тестовые данные
        if (isDevelopmentMode && !webApp?.initDataUnsafe?.user?.id) {
            console.log('🔧 Режим разработки - используем тестовые данные пользователя');
            return DEV_MODE_USER_DATA;
        }

        if (!webApp?.initDataUnsafe?.user?.id) {
            console.error('❌ Данные пользователя Telegram недоступны');
            throw new Error('Telegram WebApp user data not available');
        }

        const userId = webApp.initDataUnsafe.user.id;

        // Создаем базовый объект пользователя
        const user: User = {
            id: userId,
            first_name: "",
            last_name: "",
            username: webApp.initDataUnsafe.user.username?.trim() || "",
            photo_url: "",
            isAdmin: false,
            adminRights: null,
            is_senior_courier: false,
            groups: []
        };

        try {
            // Запрашиваем группы пользователя с сервера
            console.log('🔄 Загрузка групп пользователя...');
            const baseUrl = config.API_URL?.replace(/\/+$/, '');
            console.log('🌐 Базовый URL:', baseUrl);
            const response = await fetch(`${baseUrl}/couriers/${userId}/groups`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                // Логируем тело ответа для отладки
                const errorText = await response.text();
                console.error('❌ Ошибка при загрузке групп:', response.status, errorText);
                throw new Error(`Ошибка при загрузке групп: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                user.groups = data.groups;
                // Используем данные пользователя из файла группы
                if (data.user_data) {
                    user.first_name = data.user_data.first_name || "";
                    user.last_name = data.user_data.last_name || "";
                    user.photo_url = data.user_data.photo_url || "";
                    user.is_senior_courier = data.user_data.is_senior_courier || false;
                }
                console.log('✅ Данные пользователя загружены с информацией о статусе старшего курьера:', {
                    groups: data.groups,
                    user_data: data.user_data,
                    isSeniorCourier: user.is_senior_courier
                });
            } else {
                console.error('❌ Ошибка при загрузке данных:', data.error);
            }
        } catch (error) {
            console.error('❌ Ошибка при загрузке данных:', error);
            // Продолжаем работу без групп и данных пользователя
        }

        console.log('✅ Получены данные пользователя:', user);
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
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(initializeFromTelegram.pending, (state) => {
                state.isInitialized = false;
                state.error = null;
                console.log('🔄 Инициализация пользователя в процессе...');
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action) => {
                console.log('✅ Инициализация пользователя успешна:', {
                    payload: action.payload,
                    first_name: action.payload.first_name,
                    last_name: action.payload.last_name,
                    first_name_empty: !action.payload.first_name?.trim(),
                    last_name_empty: !action.payload.last_name?.trim()
                });
                state.user = action.payload;
                state.isInitialized = true;
                state.error = null;
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                console.error('❌ Ошибка инициализации пользователя:', action.error);
                state.isInitialized = true;
                state.error = action.error.message || 'Ошибка инициализации';
            })
            .addCase(checkAdminRights.rejected, (state) => {
                if (state.user) {
                    state.user.isAdmin = false;
                    state.user.adminRights = null;
                }
            });
    }
});

export const { updateUser, clearUserData, updateAdminStatus, updateSeniorCourierStatus } = userSlice.actions;
export default userSlice.reducer; 