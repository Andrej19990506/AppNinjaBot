import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@shared/store/store';
import { getSupplies, type SuppliesQuery } from '../services/requestsApi';

export type RequestsState = {
  params: SuppliesQuery;
  loading: boolean;
  error: string | null;
  data: any | null;
};

const initialState: RequestsState = {
  params: {
    spreadsheet_id: '',
    range: '',
    mode: 'table',
    exclude_zero: true,
    subtract_withdrawn: false,
  },
  loading: false,
  error: null,
  data: null,
};

export const fetchSupplies = createAsyncThunk(
  'requests/fetchSupplies',
  async (params: SuppliesQuery, { rejectWithValue }) => {
    try {
      return await getSupplies(params);
    } catch (e: any) {
      return rejectWithValue(e?.message || 'Ошибка загрузки заявок');
    }
  }
);

const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setParams(state, action: PayloadAction<Partial<SuppliesQuery>>) {
      state.params = { ...state.params, ...action.payload } as SuppliesQuery;
    },
    reset(state) {
      state.loading = false;
      state.error = null;
      state.data = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSupplies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSupplies.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSupplies.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Ошибка загрузки заявок';
      });
  }
});

export const { setParams, reset } = requestsSlice.actions;
export const selectRequests = (state: RootState) => state.requests as RequestsState;
export default requestsSlice.reducer;


