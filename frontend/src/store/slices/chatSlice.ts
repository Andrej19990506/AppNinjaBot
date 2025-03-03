import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Chat } from '../../types';

interface ChatState {
    items: Chat[];
    isLoading: boolean;
    error: string | null;
    selectedChatId: string | null;
}

const initialState: ChatState = {
    items: [],
    isLoading: false,
    error: null,
    selectedChatId: null
};

export const fetchChats = createAsyncThunk(
    'chats/fetchChats',
    async () => {
        const response = await axios.get<Chat[]>('http://localhost:5000/api/chats');
        return response.data;
    }
);

export const updateChatInventory = createAsyncThunk(
    'chats/updateInventory',
    async ({ chatId, inventory }: { chatId: string; inventory: any }) => {
        const response = await axios.put(`http://localhost:5000/api/inventory/${chatId}`, inventory);
        return { chatId, inventory: response.data };
    }
);

const chatSlice = createSlice({
    name: 'chats',
    initialState,
    reducers: {
        setSelectedChat: (state, action: PayloadAction<string | null>) => {
            state.selectedChatId = action.payload;
        },
        updateChatProgress: (state, action: PayloadAction<{ chatId: string; progress: number }>) => {
            const { chatId, progress } = action.payload;
            const chat = state.items.find(c => c.chat_id === chatId);
            if (chat) {
                if (!chat.inventory) chat.inventory = {};
                if (!chat.inventory.metadata) chat.inventory.metadata = {};
                chat.inventory.metadata.progress = progress;
                chat.inventory.metadata.lastUpdated = new Date().toISOString();
            }
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
                state.items = action.payload;
            })
            .addCase(fetchChats.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Failed to fetch chats';
            })
            .addCase(updateChatInventory.fulfilled, (state, action) => {
                const { chatId, inventory } = action.payload;
                const chat = state.items.find(c => c.chat_id === chatId);
                if (chat) {
                    chat.inventory = inventory;
                }
            });
    }
});

export const { setSelectedChat, updateChatProgress } = chatSlice.actions;
export default chatSlice.reducer; 