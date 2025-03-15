import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { WebApp } from '../../types/telegram';
import { User } from '../../types/user';
import { Admin } from '../../types/inventory';
import { ChatContext } from './chatSlice';

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

            throw `У вас нет прав для ${context === 'inventory' ? 'инвентаризации' : context === 'writeoff' ? 'списания' : 'просмотра событий'} в этом чате`;
        } catch (error) {
            throw error;
        }
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
            .addCase(checkAdminRights.rejected, (state) => {
                state.isAdmin = false;
                state.adminRights = null;
            });
    }
});

export const { clearUserData, updateAdminStatus } = userSlice.actions;
export default userSlice.reducer; 