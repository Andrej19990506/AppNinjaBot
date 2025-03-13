import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { WebApp } from '../../types/telegram';
import { User } from '../../types/user';
import { Admin } from '../../types/inventory';

interface UserState {
    id: number | null;
    isAdmin: boolean;
    adminRights: Admin | null;
    photo_url: string | null;
    first_name: string | null;
    branchName: string | null;
    isLoading: boolean;
    error: string | null;
}

const initialState: UserState = {
    id: null,
    isAdmin: false,
    adminRights: null,
    photo_url: null,
    first_name: null,
    branchName: null,
    isLoading: false,
    error: null
};

// Инициализация пользователя из Telegram WebApp
export const initializeFromTelegram = createAsyncThunk(
    'user/initializeFromTelegram',
    async () => {
        console.log('=== 👤 Инициализация пользователя из Telegram ===');
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        
        console.log('📱 WebApp данные:', {
            available: !!webApp,
            hasUser: !!webApp?.initDataUnsafe?.user,
            initData: webApp?.initDataUnsafe
        });

        if (!webApp?.initDataUnsafe?.user?.id) {
            console.error('❌ Данные пользователя Telegram недоступны');
            throw new Error('Telegram WebApp user data not available');
        }

        console.log('✅ Получены данные пользователя:', webApp.initDataUnsafe.user);
        return webApp.initDataUnsafe.user;
    }
);

// Проверка прав администратора для конкретного чата
export const checkAdminRights = createAsyncThunk(
    'user/checkAdminRights',
    async ({ userId, chatId, admins }: { userId: number; chatId: string; admins: Admin[] }) => {
        console.log('🔍 Проверка прав администратора');
        console.log('👤 User ID:', userId);
        console.log('💬 Chat ID:', chatId);
        
        const admin = admins.find(admin => {
            console.log('🔄 Сравнение ID админа:', admin.user_id, 'тип:', typeof admin.user_id);
            console.log('🔄 С ID пользователя:', userId, 'тип:', typeof userId);
            return Number(admin.user_id) === Number(userId);
        });

        if (admin) {
            console.log('✅ Пользователь является администратором');
        } else {
            console.log('❌ Пользователь не является администратором');
        }

        return admin || null;
    }
);

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        clearUserData: (state) => {
            state.id = null;
            state.isAdmin = false;
            state.adminRights = null;
            state.photo_url = null;
            state.first_name = null;
        },
        updateAdminStatus: (state, action) => {
            const { isAdmin, adminRights } = action.payload;
            state.isAdmin = isAdmin;
            state.adminRights = adminRights;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(initializeFromTelegram.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action) => {
                state.isLoading = false;
                state.id = action.payload.id;
                state.photo_url = action.payload.photo_url || null;
                state.first_name = action.payload.first_name;
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Failed to initialize user';
            })
            .addCase(checkAdminRights.fulfilled, (state, action) => {
                if (action.payload) {
                    state.isAdmin = true;
                    state.adminRights = action.payload;
                    state.photo_url = action.payload.photo_url || state.photo_url;
                    state.first_name = action.payload.first_name;
                } else {
                    state.isAdmin = false;
                    state.adminRights = null;
                }
            });
    }
});

export const { clearUserData, updateAdminStatus } = userSlice.actions;
export default userSlice.reducer; 