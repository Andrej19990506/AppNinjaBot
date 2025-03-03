import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AdminState {
    adminPhotos: Record<number, string>;
    error: string | null;
}

const initialState: AdminState = {
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
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        }
    }
});

export const { setAdminPhoto, setError, clearError } = adminSlice.actions;
export default adminSlice.reducer; 