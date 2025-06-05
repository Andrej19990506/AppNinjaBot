import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { checkAdminRights } from '@shared/store/adminSlice/adminThunks';

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