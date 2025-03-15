import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

// Интерфейсы для прав администратора
interface AdminRights {
    status: string;
    can_manage_chat?: boolean;
}

interface AdminUser {
    id: number | null;
    isAdmin: boolean;
    adminRights: AdminRights | null;
    photo_url: string | null;
    first_name: string | null;
}

interface AdminState {
    currentUser: AdminUser;
    adminPhotos: Record<number, string>;
    error: string | null;
}

const initialState: AdminState = {
    currentUser: {
        id: null,
        isAdmin: false,
        adminRights: null,
        photo_url: null,
        first_name: null
    },
    adminPhotos: {},
    error: null
};

// Централизованная проверка прав администратора
export const checkAdminRights = createAsyncThunk(
    'admin/checkAdminRights',
    async ({ 
        userId, 
        chatId, 
        admins, 
        members,
        context = 'inventory' 
    }: {
        userId: number;
        chatId: string;
        admins: Array<{
            user_id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            status?: string;
        }>;
        members?: Array<{
            user_id: number;
            first_name: string;
            photo_url?: string;
        }>;
        context?: 'inventory' | 'writeoff' | 'events';
    }, { rejectWithValue }) => {
        try {
            console.log('🔍 Проверка прав администратора:', {
                userId,
                chatId,
                context,
                adminsCount: admins.length,
                membersCount: members?.length
            });

            // Находим данные администратора
            const adminData = admins.find(
                admin => Number(admin.user_id) === Number(userId)
            );

            if (adminData) {
                console.log('✅ Пользователь является администратором:', {
                    userId,
                    chatId,
                    adminStatus: adminData.status
                });
                
                // Убедимся, что status всегда определен
                const status = adminData.status || 'member';
                
                return {
                    isAdmin: true,
                    adminRights: {
                        status,
                        can_manage_chat: status === 'creator' || status === 'administrator'
                    },
                    photo_url: adminData.photo_url || null,
                    first_name: adminData.first_name
                };
            }

            // Если пользователь не админ, проверяем есть ли он в списке участников
            if (members) {
                const memberData = members.find(
                    member => Number(member.user_id) === Number(userId)
                );

                if (memberData) {
                    console.log('👤 Пользователь является участником чата:', {
                        userId,
                        chatId
                    });
                    
                    return {
                        isAdmin: false,
                        adminRights: null,
                        photo_url: memberData.photo_url || null,
                        first_name: memberData.first_name
                    };
                }
            }

            return rejectWithValue('Пользователь не найден в чате');
        } catch (error) {
            console.error('❌ Ошибка при проверке прав администратора:', error);
            return rejectWithValue('Ошибка при проверке прав администратора');
        }
    }
);

const adminSlice = createSlice({
    name: 'admin',
    initialState,
    reducers: {
        setAdminPhoto: (state, action: PayloadAction<{ userId: number; photoData: string }>) => {
            const { userId, photoData } = action.payload;
            state.adminPhotos[userId] = photoData;
        },
        clearAdminRights: (state) => {
            state.currentUser = initialState.currentUser;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
        // Добавляем action для установки ID пользователя
        setUserId: (state, action: PayloadAction<number>) => {
            state.currentUser.id = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(checkAdminRights.fulfilled, (state, action) => {
                state.currentUser = {
                    ...state.currentUser,
                    ...action.payload
                };
                state.error = null;
            })
            .addCase(checkAdminRights.rejected, (state, action) => {
                state.currentUser = {
                    ...initialState.currentUser,
                    id: state.currentUser.id // Сохраняем ID пользователя
                };
                state.error = action.payload as string;
            });
    }
});

export const { 
    setAdminPhoto, 
    clearAdminRights, 
    setError, 
    clearError,
    setUserId
} = adminSlice.actions;

export default adminSlice.reducer; 