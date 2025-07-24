import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { axiosInstance } from '@/shared/api/api';
import { Competition, CompetitionStatus } from '@/features/Competitions/types/competition';
import store from '@/shared/store/store';

// Функция для получения заголовков с user_id
const getAuthHeaders = () => {
    const state = store.getState();
    const userId = state.user?.user?.id;
    
    if (!userId) {
        throw new Error('User not authenticated');
    }
    
    return {
        'X-User-ID': userId.toString()
    };
};

interface CompetitionsState {
  competitions: Competition[];
  selectedCompetition: Competition | null;
  loading: boolean;
  error: string | null;
  filters: {
    status: CompetitionStatus | 'all';
    search: string;
  };
}

const initialState: CompetitionsState = {
  competitions: [],
  selectedCompetition: null,
  loading: false,
  error: null,
  filters: {
    status: 'all',
    search: '',
  },
};

// Async thunks
export const fetchCompetitions = createAsyncThunk(
  'competitions/fetchCompetitions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/v1/competitions');
      console.log('API Response:', response.data); // Отладочная информация
      console.log('Raw response:', JSON.stringify(response.data, null, 2)); // Полный ответ
      
      // Обрабатываем данные конкурсов
      const competitions = response.data.competitions || response.data || [];
      
      // Добавляем пустой массив winners если его нет
      const processedCompetitions = competitions.map((competition: any) => ({
        ...competition,
        winners: competition.winners || [],
        // Обрабатываем переносы строк в описаниях
        description: competition.description?.replace(/\r\n/g, '\n') || '',
        full_description: competition.full_description?.replace(/\r\n/g, '\n') || '',
        victory_description: competition.victory_description?.replace(/\r\n/g, '\n') || ''
      }));
      
      return processedCompetitions;
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось загрузить конкурсы';
      return rejectWithValue(message);
    }
  }
);

export const fetchCompetitionById = createAsyncThunk(
  'competitions/fetchCompetitionById',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/v1/competitions/${id}`);
      const competition = response.data;
      
      // Обрабатываем переносы строк в описаниях
      return {
        ...competition,
        description: competition.description?.replace(/\r\n/g, '\n') || '',
        full_description: competition.full_description?.replace(/\r\n/g, '\n') || '',
        victory_description: competition.victory_description?.replace(/\r\n/g, '\n') || ''
      };
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось загрузить конкурс';
      return rejectWithValue(message);
    }
  }
);

export const updateCompetition = createAsyncThunk(
  'competitions/updateCompetition',
  async ({ id, data }: { id: number; data: any }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/v1/competitions/${id}`, data, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось обновить конкурс';
      return rejectWithValue(message);
    }
  }
);

export const publishCompetition = createAsyncThunk(
  'competitions/publishCompetition',
  async (competitionId: number, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/v1/competitions/${competitionId}/publish`, {}, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось опубликовать конкурс';
      return rejectWithValue(message);
    }
  }
);

export const startCompetition = createAsyncThunk(
  'competitions/startCompetition',
  async (competitionId: number, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/v1/competitions/${competitionId}/start`, {}, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось запустить конкурс';
      return rejectWithValue(message);
    }
  }
);

export const addWinner = createAsyncThunk(
  'competitions/addWinner',
  async ({ competitionId, winnerData }: { competitionId: number; winnerData: any }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/v1/competitions/${competitionId}/winners`, winnerData, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось добавить победителя';
      return rejectWithValue(message);
    }
  }
);

export const addParticipant = createAsyncThunk(
  'competitions/addParticipant',
  async ({ competitionId, userId }: { competitionId: number, userId: number }, { rejectWithValue }) => {
    try {
      console.log('addParticipant - Sending request:', { competitionId, userId, body: { user_id: userId } });
      const response = await axiosInstance.post(`/v1/competitions/${competitionId}/participants`, { user_id: userId });
      console.log('addParticipant - Success response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('addParticipant - Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      const message = error.response?.data?.detail || error.message || 'Не удалось зарегистрироваться в конкурсе';
      return rejectWithValue(message);
    }
  }
);

const competitionsSlice = createSlice({
  name: 'competitions',
  initialState,
  reducers: {
    setSelectedCompetition: (state, action: PayloadAction<Competition | null>) => {
      state.selectedCompetition = action.payload;
    },
    setStatusFilter: (state, action: PayloadAction<CompetitionStatus | 'all'>) => {
      state.filters.status = action.payload;
    },
    setSearchFilter: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {
        status: 'all',
        search: '',
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompetitions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompetitions.fulfilled, (state, action) => {
        state.loading = false;
        state.competitions = action.payload;
      })
      .addCase(fetchCompetitions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch competitions';
      })
      .addCase(fetchCompetitionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompetitionById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCompetition = action.payload;
      })
      .addCase(fetchCompetitionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch competition';
      })
      .addCase(updateCompetition.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCompetition.fulfilled, (state, action) => {
        state.loading = false;
        const updatedCompetition = {
          ...action.payload,
          description: action.payload.description?.replace(/\r\n/g, '\n') || '',
          full_description: action.payload.full_description?.replace(/\r\n/g, '\n') || '',
          victory_description: action.payload.victory_description?.replace(/\r\n/g, '\n') || ''
        };
        
        // Обновляем конкурс в списке
        const index = state.competitions.findIndex(c => c.id === updatedCompetition.id);
        if (index !== -1) {
          state.competitions[index] = updatedCompetition;
        }
        // Обновляем выбранный конкурс если он тот же
        if (state.selectedCompetition?.id === updatedCompetition.id) {
          state.selectedCompetition = updatedCompetition;
        }
      })
      .addCase(updateCompetition.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update competition';
      })
      .addCase(publishCompetition.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(publishCompetition.fulfilled, (state, action) => {
        state.loading = false;
        const updatedCompetition = {
          ...action.payload,
          description: action.payload.description?.replace(/\r\n/g, '\n') || '',
          full_description: action.payload.full_description?.replace(/\r\n/g, '\n') || '',
          victory_description: action.payload.victory_description?.replace(/\r\n/g, '\n') || ''
        };
        
        // Обновляем конкурс в списке
        const index = state.competitions.findIndex(c => c.id === updatedCompetition.id);
        if (index !== -1) {
          state.competitions[index] = updatedCompetition;
        }
        // Обновляем выбранный конкурс если он тот же
        if (state.selectedCompetition?.id === updatedCompetition.id) {
          state.selectedCompetition = updatedCompetition;
        }
      })
      .addCase(publishCompetition.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to publish competition';
      })
      .addCase(startCompetition.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startCompetition.fulfilled, (state, action) => {
        state.loading = false;
        const updatedCompetition = {
          ...action.payload,
          description: action.payload.description?.replace(/\r\n/g, '\n') || '',
          full_description: action.payload.full_description?.replace(/\r\n/g, '\n') || '',
          victory_description: action.payload.victory_description?.replace(/\r\n/g, '\n') || ''
        };
        
        // Обновляем конкурс в списке
        const index = state.competitions.findIndex(c => c.id === updatedCompetition.id);
        if (index !== -1) {
          state.competitions[index] = updatedCompetition;
        }
        // Обновляем выбранный конкурс если он тот же
        if (state.selectedCompetition?.id === updatedCompetition.id) {
          state.selectedCompetition = updatedCompetition;
        }
      })
      .addCase(startCompetition.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to start competition';
      })
      .addCase(addWinner.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addWinner.fulfilled, (state, action) => {
        state.loading = false;
        // При добавлении победителя API возвращает только winner объект
        // Нам нужно обновить конкурс в списке, добавив winner к существующему конкурсу
        const competitionId = action.payload.competition_id;
        const winner = action.payload;
        
        // Обновляем конкурс в списке
        const index = state.competitions.findIndex(c => c.id === competitionId);
        if (index !== -1) {
          const competition = state.competitions[index];
          if (!competition.winners) {
            competition.winners = [];
          }
          // Проверяем, нет ли уже такого победителя
          const existingWinnerIndex = competition.winners.findIndex(w => w.user_id === winner.user_id);
          if (existingWinnerIndex === -1) {
            competition.winners.push(winner);
          } else {
            competition.winners[existingWinnerIndex] = winner;
          }
        }
        
        // Обновляем выбранный конкурс если он тот же
        if (state.selectedCompetition && state.selectedCompetition.id === competitionId) {
          if (!state.selectedCompetition.winners) {
            state.selectedCompetition.winners = [];
          }
          const existingWinnerIndex = state.selectedCompetition.winners.findIndex(w => w.user_id === winner.user_id);
          if (existingWinnerIndex === -1) {
            state.selectedCompetition.winners.push(winner);
          } else {
            state.selectedCompetition.winners[existingWinnerIndex] = winner;
          }
        }
      })
      .addCase(addWinner.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add winner';
      });
  },
});

export const { 
  setSelectedCompetition, 
  setStatusFilter, 
  setSearchFilter, 
  clearFilters 
} = competitionsSlice.actions;

export default competitionsSlice.reducer; 