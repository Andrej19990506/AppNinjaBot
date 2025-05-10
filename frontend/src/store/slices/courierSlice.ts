import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface CourierState {
    isRegistered: boolean;
    currentShift: {
        startTime: string | null;
        endTime: string | null;
    } | null;
    loading: boolean;
    error: string | null;
}

const initialState: CourierState = {
    isRegistered: false,
    currentShift: null,
    loading: false,
    error: null
};

// Асинхронный action для регистрации на смену
export const registerForShift = createAsyncThunk(
    'courier/registerForShift',
    async (_, { rejectWithValue }) => {
        try {
            // TODO: Добавить API запрос для регистрации на смену
            // const response = await courierApi.registerForShift();
            // return response.data;
            
            // Временная заглушка
            return {
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // +8 часов
            };
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Ошибка при регистрации на смену');
        }
    }
);

const courierSlice = createSlice({
    name: 'courier',
    initialState,
    reducers: {
        resetShiftRegistration: (state) => {
            state.isRegistered = false;
            state.currentShift = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(registerForShift.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(registerForShift.fulfilled, (state, action) => {
                state.loading = false;
                state.isRegistered = true;
                state.currentShift = action.payload;
            })
            .addCase(registerForShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    }
});

export const { resetShiftRegistration } = courierSlice.actions;

// Селекторы
export const selectCourierState = (state: RootState) => state.courier;
export const selectIsRegistered = (state: RootState) => state.courier.isRegistered;
export const selectCurrentShift = (state: RootState) => state.courier.currentShift;
export const selectIsLoading = (state: RootState) => state.courier.loading;
export const selectError = (state: RootState) => state.courier.error;

export default courierSlice.reducer; 