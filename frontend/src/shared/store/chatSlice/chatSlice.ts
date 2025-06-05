// --- chatSlice.ts ---
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, ChatContext, ContextData } from './chatTypes';
import { fetchChats } from './chatThunks';

const initialState: ChatState = {
    items: [],
    isLoading: false,
    error: null,
    selectedChatId: null,
    currentContext: null,
    metadata: {}
};

const chatSlice = createSlice({
    name: 'chats',
    initialState,
    reducers: {
        setSelectedChat: (state, action: PayloadAction<string | null>) => {
            state.selectedChatId = action.payload;
            if (action.payload) {
                state.metadata[action.payload] = {
                    ...state.metadata[action.payload],
                    lastViewed: new Date().toISOString()
                };
            }
        },
        setContext: (state, action: PayloadAction<ChatContext | null>) => {
            const prevContext = state.currentContext;
            state.currentContext = action.payload;
            if (prevContext !== action.payload) {
                state.items = state.items.map(chat => ({
                    ...chat,
                    contextData: undefined
                }));
            }
        },
        updateContextData: (state, action: PayloadAction<{ chatId: string; contextData: ContextData }>) => {
            const { chatId, contextData } = action.payload;
            const chat = state.items.find(c => c.id === chatId);
            if (chat) {
                chat.contextData = contextData;
                state.metadata[chatId] = {
                    ...state.metadata[chatId],
                    contextData
                };
            }
        },
        clearSelectedChat: (state) => {
            state.selectedChatId = null;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchChats.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchChats.fulfilled, (state, action) => {
                state.isLoading = false;
                state.items = action.payload.chats;
                state.currentContext = action.payload.context ?? null;
            })
            .addCase(fetchChats.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Ошибка загрузки чатов';
            });
    }
});

export const { 
    setSelectedChat,
    setContext,
    updateContextData,
    clearSelectedChat,
    setError
} = chatSlice.actions;

export default chatSlice.reducer;
