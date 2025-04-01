import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Chat } from '../../types';
import config from '../../config';

// Типы контекстов для работы с чатами
export type ChatContext = 'inventory' | 'writeoff' | 'events';

// Интерфейсы для контекстно-зависимых данных
interface InventoryContextData {
    inventory_progress?: number;
    last_inventory_date?: string;
}

interface WriteoffContextData {
    pending_writeoffs?: number;
    last_writeoff_date?: string;
}

interface EventsContextData {
    last_event_date?: string;
    events_count?: number;
}

// Тип для контекстных данных
type ContextData = InventoryContextData | WriteoffContextData | EventsContextData;

// Интерфейс для метаданных чата
interface ChatMetadata {
    lastViewed?: string;
    currentContext?: ChatContext;
    contextData?: ContextData;
}

// Интерфейс для чата с контекстными данными
interface ChatWithContext extends Chat {
    contextData?: ContextData;
}

// Базовый интерфейс для состояния чатов
export interface ChatState {
    items: ChatWithContext[];
    isLoading: boolean;
    error: string | null;
    selectedChatId: string | null;
    currentContext: ChatContext | null;
    metadata: {
        [chatId: string]: ChatMetadata;
    };
}

// Начальное состояние
const initialState: ChatState = {
    items: [],
    isLoading: false,
    error: null,
    selectedChatId: null,
    currentContext: null,
    metadata: {}
};

// Получение списка чатов с опциональным контекстом
export const fetchChats = createAsyncThunk(
    'chats/fetchChats',
    async (context?: ChatContext) => {
        console.log(`🔄 Начало загрузки списка чатов${context ? ` для контекста ${context}` : ''}`);
        
        // Базовый URL для получения чатов
        let url = `${config.API_URL}/chats`;
        
        // Если указан контекст, добавляем его в запрос
        if (context) {
            url += `?context=${context}`;
        }

        const response = await axios.get<ChatWithContext[]>(url);
        console.log('✅ Получены данные:', response.data);
        
        return {
            chats: response.data,
            context
        };
    }
);

export const updateChatInventory = createAsyncThunk(
    'chats/updateInventory',
    async ({ chatId, inventory }: { chatId: string; inventory: any }) => {
        const response = await axios.put(`${config.API_URL}/inventory/${chatId}`, inventory);
        return { chatId, inventory: response.data };
    }
);

// Создаем слайс
const chatSlice = createSlice({
    name: 'chats',
    initialState,
    reducers: {
        // Выбор чата
        setSelectedChat: (state, action: PayloadAction<string | null>) => {
            state.selectedChatId = action.payload;
            if (action.payload) {
                state.metadata[action.payload] = {
                    ...state.metadata[action.payload],
                    lastViewed: new Date().toISOString()
                };
            }
        },
        
        // Установка текущего контекста
        setContext: (state, action: PayloadAction<ChatContext | null>) => {
            const prevContext = state.currentContext;
            state.currentContext = action.payload;
            
            // Если контекст изменился, очищаем contextData в чатах
            if (prevContext !== action.payload) {
                state.items = state.items.map(chat => ({
                    ...chat,
                    contextData: undefined
                }));
            }
        },
        
        // Обновление контекстных данных для чата
        updateContextData: (state, action: PayloadAction<{ 
            chatId: string; 
            contextData: ContextData;
        }>) => {
            const { chatId, contextData } = action.payload;
            const chat = state.items.find(c => c.chat_id === chatId);
            if (chat) {
                chat.contextData = contextData;
                state.metadata[chatId] = {
                    ...state.metadata[chatId],
                    contextData
                };
            }
        },
        
        // Очистка выбранного чата
        clearSelectedChat: (state) => {
            state.selectedChatId = null;
        },
        
        // Обработка ошибок
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
                
                // Если был передан контекст, обновляем его
                if (action.payload.context) {
                    state.currentContext = action.payload.context;
                    
                    // Сохраняем контекстные данные в метаданных
                    action.payload.chats.forEach(chat => {
                        if (chat.contextData) {
                            state.metadata[chat.chat_id] = {
                                ...state.metadata[chat.chat_id],
                                currentContext: action.payload.context,
                                contextData: chat.contextData
                            };
                        }
                    });
                }
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

// Экспортируем actions
export const { 
    setSelectedChat,
    setContext,
    updateContextData,
    clearSelectedChat,
    setError
} = chatSlice.actions;

// Экспортируем reducer
export default chatSlice.reducer; 