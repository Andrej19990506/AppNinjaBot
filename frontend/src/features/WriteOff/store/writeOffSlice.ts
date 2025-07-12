import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WriteOffState, WriteOffReason, WriteOffItem } from '@/types/writeOff';
import { fetchWriteOffChats, fetchWriteOffs, selectWriteOffChat, createWriteOffItem, deleteWriteOffItem, updateWriteOffItem } from '@/features/WriteOff/store/writeOffThunks';
import { getTodayLocalString } from '@/shared/utils/dateUtils';

const initialState: WriteOffState = {
    chats: [],
    selectedChatId: null,
    selectedChat: null,
    selectedDate: getTodayLocalString(), // Текущая дата в локальном часовом поясе в формате YYYY-MM-DD
    isLoading: false,
    error: null,
    modal: {
        name: '',
        reason: null,
        quantity: 0,
        description: '',
        isSubmitting: false,
        isSuccess: false,
        unitType: 'шт'
    }
};

const writeOffSlice = createSlice({
    name: 'writeOff',
    initialState,
    reducers: {
        clearSelectedChat: (state) => {
            state.selectedChat = null;
            state.selectedChatId = null;
        },
        setSelectedDate: (state, action: PayloadAction<string>) => {
            state.selectedDate = action.payload;
            // Очищаем списания при смене даты
            if (state.selectedChat) {
                state.selectedChat.writeOffs = [];
            }
        },
        setModalName: (state, action: PayloadAction<string>) => {
            state.modal.name = action.payload;
        },
        setModalReason: (state, action: PayloadAction<WriteOffReason | null>) => {
            state.modal.reason = action.payload;
        },
        setModalQuantity: (state, action: PayloadAction<number>) => {
            state.modal.quantity = action.payload;
        },
        setModalDescription: (state, action: PayloadAction<string>) => {
            state.modal.description = action.payload;
        },
        setModalUnitType: (state, action: PayloadAction<'шт' | 'гр'>) => {
            state.modal.unitType = action.payload;
        },
        setModalSubmitting: (state, action: PayloadAction<boolean>) => {
            state.modal.isSubmitting = action.payload;
        },
        resetModal: (state) => {
            state.modal = initialState.modal;
        },
        receiveWriteOffItem: (state, action: PayloadAction<{chatId: string, writeOffItem: WriteOffItem}>) => {
            if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                if (!state.selectedChat.writeOffs.some(item => item.id === action.payload.writeOffItem.id)) {
                    state.selectedChat.writeOffs.push(action.payload.writeOffItem);
                }
            }
        },
        receiveWriteOffUpdate: (state, action: PayloadAction<{chatId: string, writeOffId: string, writeOffItem: WriteOffItem}>) => {
            if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                const index = state.selectedChat.writeOffs.findIndex(item => item.id === action.payload.writeOffId);
                if (index !== -1) {
                    state.selectedChat.writeOffs[index] = action.payload.writeOffItem;
                }
            }
        },
        receiveWriteOffDeletion: (state, action: PayloadAction<{chatId: string, writeOffId: string}>) => {
            if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                state.selectedChat.writeOffs = state.selectedChat.writeOffs.filter(
                    item => item.id !== action.payload.writeOffId
                );
            }
        },
        updateChatWriteOffs: (state, action: PayloadAction<{
            chatId: string, 
            writeOffItem?: WriteOffItem, 
            writeOffId?: string, 
            action: 'add' | 'update' | 'delete'
        }>) => {
            const { chatId, writeOffItem, writeOffId, action: actionType } = action.payload;
            const chatIndex = state.chats.findIndex(chat => chat.chat_id === chatId);
            if (chatIndex === -1) return;
            const chat = state.chats[chatIndex];
            switch (actionType) {
                case 'add':
                    if (writeOffItem && !chat.writeOffs.some(item => item.id === writeOffItem.id)) {
                        chat.writeOffs.push(writeOffItem);
                        chat.metadata.totalWriteOffs += 1;
                        chat.metadata.lastUpdated = new Date().toISOString();
                    }
                    break;
                case 'update':
                    if (writeOffItem) {
                        const itemIndex = chat.writeOffs.findIndex(item => item.id === writeOffItem.id);
                        if (itemIndex !== -1) {
                            chat.writeOffs[itemIndex] = writeOffItem;
                            chat.metadata.lastUpdated = new Date().toISOString();
                        }
                    }
                    break;
                case 'delete':
                    if (writeOffId) {
                        chat.writeOffs = chat.writeOffs.filter(item => item.id !== writeOffId);
                        chat.metadata.totalWriteOffs = Math.max(0, chat.metadata.totalWriteOffs - 1);
                        chat.metadata.lastUpdated = new Date().toISOString();
                    }
                    break;
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchWriteOffChats.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchWriteOffChats.fulfilled, (state, action) => {
                state.isLoading = false;
                state.chats = action.payload;
            })
            .addCase(fetchWriteOffChats.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Ошибка загрузки чатов';
            })
            .addCase(selectWriteOffChat.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(selectWriteOffChat.fulfilled, (state, action) => {
                state.isLoading = false;
                if (action.payload) {
                    state.selectedChat = action.payload;
                    state.selectedChatId = action.payload.chat_id;
                } else {
                    state.selectedChat = null;
                    state.selectedChatId = null;
                }
            })
            .addCase(selectWriteOffChat.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Ошибка при выборе чата';
                state.selectedChat = null;
                state.selectedChatId = null;
            })
            .addCase(createWriteOffItem.pending, (state) => {
                state.modal.isSubmitting = true;
                state.modal.isSuccess = false;
                state.error = null;
            })
            .addCase(createWriteOffItem.fulfilled, (state, action) => {
                state.modal.isSubmitting = false;
                state.modal.isSuccess = true;
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chat_id) {
                    state.selectedChat.writeOffs.push(action.payload);
                }
                const chatIndex = state.chats.findIndex(chat => chat.chat_id === action.payload.chat_id);
                if (chatIndex >= 0) {
                    const chat = state.chats[chatIndex];
                    chat.writeOffs.push(action.payload);
                    chat.metadata.totalWriteOffs += 1;
                    chat.metadata.lastUpdated = new Date().toISOString();
                }
            })
            .addCase(createWriteOffItem.rejected, (state, action) => {
                state.modal.isSubmitting = false;
                state.modal.isSuccess = false;
                state.error = action.error.message || 'Ошибка при создании списания';
            })
            .addCase(deleteWriteOffItem.pending, (state) => {
                state.error = null;
            })
            .addCase(deleteWriteOffItem.fulfilled, (state, action) => {
                state.isLoading = false;
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                    state.selectedChat.writeOffs = state.selectedChat.writeOffs.filter(
                        item => item.id !== action.payload.itemId
                    );
                }
                const chatIndex = state.chats.findIndex(chat => chat.chat_id === action.payload.chatId);
                if (chatIndex >= 0) {
                    const chat = state.chats[chatIndex];
                    chat.writeOffs = chat.writeOffs.filter(item => item.id !== action.payload.itemId);
                    chat.metadata.totalWriteOffs -= 1;
                    chat.metadata.lastUpdated = new Date().toISOString();
                }
            })
            .addCase(deleteWriteOffItem.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Ошибка при удалении списания';
            })
            .addCase(fetchWriteOffs.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchWriteOffs.fulfilled, (state, action) => {
                state.isLoading = false;
                // Теперь fetchWriteOffs принимает объект { chatId, date }
                const chatId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.chatId;
                const writeOffs = Array.isArray(action.payload) ? action.payload : action.payload.writeOffs ? action.payload.writeOffs : [];
                if (state.selectedChat && state.selectedChat.chat_id === chatId) {
                    state.selectedChat.writeOffs = writeOffs;
                    if (state.selectedChat.metadata) {
                        state.selectedChat.metadata.totalWriteOffs = writeOffs.length;
                        state.selectedChat.metadata.lastUpdated = new Date().toISOString();
                    }
                }
                const chatIndex = state.chats.findIndex(chat => chat.chat_id === chatId);
                if (chatIndex >= 0) {
                    const chat = state.chats[chatIndex];
                    chat.writeOffs = writeOffs;
                    if (chat.metadata) {
                        chat.metadata.totalWriteOffs = writeOffs.length;
                        chat.metadata.lastUpdated = new Date().toISOString();
                    }
                }
            })
            .addCase(fetchWriteOffs.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Ошибка при загрузке списаний';
            })
            .addCase(updateWriteOffItem.pending, (state) => {
                state.modal.isSubmitting = true;
                state.modal.isSuccess = false;
                state.error = null;
            })
            .addCase(updateWriteOffItem.fulfilled, (state, action) => {
                state.modal.isSubmitting = false;
                state.modal.isSuccess = true;
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                    state.selectedChat.writeOffs = state.selectedChat.writeOffs.map(item =>
                        item.id === action.payload.id ? action.payload : item
                    );
                }
                const chatIndex = state.chats.findIndex(chat => chat.chat_id === action.payload.chatId);
                if (chatIndex >= 0) {
                    const chat = state.chats[chatIndex];
                    chat.writeOffs = chat.writeOffs.map(item =>
                        item.id === action.payload.id ? action.payload : item
                    );
                    chat.metadata.lastUpdated = new Date().toISOString();
                }
            })
            .addCase(updateWriteOffItem.rejected, (state, action) => {
                state.modal.isSubmitting = false;
                state.modal.isSuccess = false;
                state.error = action.error.message || 'Ошибка при обновлении списания';
            });
    }
});

export const { clearSelectedChat, setSelectedDate, setModalName, setModalReason, setModalQuantity, setModalDescription, setModalUnitType, setModalSubmitting, resetModal, receiveWriteOffItem, receiveWriteOffUpdate, receiveWriteOffDeletion, updateChatWriteOffs } = writeOffSlice.actions;
export default writeOffSlice.reducer; 