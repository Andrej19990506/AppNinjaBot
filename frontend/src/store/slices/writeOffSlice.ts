import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { WriteOffState, WriteOffChat, WriteOffReason, CreateWriteOffData, WriteOffItem } from '../../types/writeOff';
import { RootState } from '../index';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { PayloadAction } from '@reduxjs/toolkit';

const initialState: WriteOffState = {
    chats: [],
    selectedChatId: null,
    selectedChat: null,
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

// Загрузка списка чатов для списания
export const fetchWriteOffChats = createAsyncThunk(
    'writeOff/fetchChats',
    async () => {
        try {
            console.log('=== 🔄 Загрузка чатов для списания ===');
            const response = await api.writeOff.getWriteOffChats();
            console.log('✅ Получены данные:', response.data);

            // Преобразуем данные в формат для списания
            const writeOffChats = response.data.map((chat: any) => ({
                ...chat,
                writeOffs: [],
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    progress: 0,
                    chat_id: chat.chat_id,
                    totalWriteOffs: 0,
                    pendingWriteOffs: 0
                }
            })) as WriteOffChat[];

            console.log('✅ Данные преобразованы:', writeOffChats);
            return writeOffChats;
        } catch (error: any) {
            console.error('❌ Ошибка при загрузке чатов:', error);
            throw new Error(error.message || 'Ошибка при загрузке чатов для списания');
        }
    }
);

// Загрузка списаний для конкретного чата
export const fetchWriteOffs = createAsyncThunk(
    'writeOff/fetchWriteOffs',
    async (chatId: string, { rejectWithValue }) => {
        try {
            console.log('=== 🔄 Загрузка списаний для чата ===');
            console.log('🏠 Чат:', chatId);
            
            const response = await api.writeOff.getWriteOffs(chatId);
            console.log('✅ Получены списания:', response.data);
            
            return {
                chatId,
                writeOffs: response.data
            };
        } catch (error: any) {
            console.error('❌ Ошибка при загрузке списаний:', error);
            return rejectWithValue(error.message || 'Ошибка при загрузке списаний');
        }
    }
);

// Выбор чата для списания
export const selectWriteOffChat = createAsyncThunk(
    'writeOff/selectChat',
    async (chatId: string, { getState, dispatch }) => {
        console.log('=== 🔄 Выбор чата ===');
        console.log('🏠 Выбранный chat_id:', chatId);
        
        const state = getState() as RootState;
        const user = state.user;
        const chat = state.writeOff.chats.find(c => c.chat_id === chatId);
        
        if (!chat) {
            console.log('❌ Чат не найден');
            return null;
        }
        
        // Проверяем, что пользователь имеет права на работу с этим чатом
        const hasAccess = user.isAdmin || chat.admins?.some(admin => {
            const isMatch = Number(admin.user_id) === Number(user.id) && 
                          (admin.status === 'creator' || admin.status === 'administrator');
            console.log('🔄 Проверка админа:', {
                adminId: admin.user_id,
                adminStatus: admin.status,
                userId: user.id,
                match: isMatch
            });
            return isMatch;
        });

        console.log('🔑 Результат проверки доступа:', {
            hasAccess,
            isGlobalAdmin: user.isAdmin,
            isChatAdmin: chat.admins?.some(admin => 
                Number(admin.user_id) === Number(user.id) && 
                (admin.status === 'creator' || admin.status === 'administrator')
            )
        });

        if (!hasAccess) {
            console.log('❌ Нет прав доступа');
            return null;
        }

        console.log('✅ Доступ разрешен');
        
        // Проверяем, нужно ли загружать списания для этого чата
        const currentChat = state.writeOff.selectedChat;
        const needToRefetch = !currentChat || 
                              currentChat.chat_id !== chatId || 
                              !currentChat.writeOffs || 
                              currentChat.writeOffs.length === 0;
        
        // Загружаем списания для выбранного чата только если их нет или при первом выборе чата
        if (needToRefetch) {
            try {
                console.log('🔄 Загрузка списаний для выбранного чата');
                await dispatch(fetchWriteOffs(chatId)).unwrap();
            } catch (error) {
                console.error('❌ Ошибка при загрузке списаний для чата:', error);
                // Продолжаем даже если не удалось загрузить списания,
                // но залогируем ошибку
            }
        } else {
            console.log('ℹ️ Списания уже загружены, пропускаем загрузку');
        }
        
        return chat;
    }
);

// Создание списания
export const createWriteOffItem = createAsyncThunk(
    'writeOff/createWriteOffItem',
    async (
        {
            chatId,
            name,
            reason,
            quantity,
            description = '',
            unitType = 'шт'
        }: {
            chatId: string,
            name: string,
            reason: WriteOffReason,
            quantity: number,
            description?: string,
            unitType?: 'шт' | 'гр'
        },
        { getState, rejectWithValue }
    ) => {
        try {
            console.log('=== 🔄 Создание нового списания ===');
            console.log('📤 Отправка данных на сервер:', {
                chatId,
                name,
                reason,
                quantity,
                description,
                unitType
            });
            
            const response = await api.writeOff.createWriteOff(chatId, {
                name,
                reason,
                quantity,
                description,
                unitType
            });
            console.log('✅ Списание успешно создано:', response);
            
            // Возвращаем созданное списание для обновления UI инициатора
            return response;
        } catch (error: any) {
            console.error('❌ Ошибка при создании списания:', error);
            
            return rejectWithValue({
                message: error.response?.data?.error || error.message || 'Ошибка при создании списания',
                status: error.response?.status
            });
        }
    }
);

// Удаление списания
export const deleteWriteOffItem = createAsyncThunk(
    'writeOff/deleteWriteOffItem',
    async (
        {
            chatId,
            itemId
        }: {
            chatId: string,
            itemId: string
        },
        { getState, rejectWithValue }
    ) => {
        try {
            console.log('=== 🔄 Удаление списания ===');
            console.log('📤 Данные для удаления:', {
                chatId,
                itemId
            });
            
            const response = await api.writeOff.deleteWriteOff(chatId, itemId);
            console.log('✅ Списание успешно удалено:', response);
            
            // Возвращаем информацию о удаленном элементе
            return {
                chatId,
                itemId,
                success: true
            };
        } catch (error: any) {
            console.error('❌ Ошибка при удалении списания:', error);
            
            return rejectWithValue({
                message: error.response?.data?.error || error.message || 'Ошибка при удалении списания',
                status: error.response?.status
            });
        }
    }
);

// Обновление списания
export const updateWriteOffItem = createAsyncThunk(
    'writeOff/updateWriteOffItem',
    async (
        {
            chatId,
            itemId,
            name,
            reason,
            quantity,
            description = '',
            unitType = 'шт'
        }: {
            chatId: string,
            itemId: string,
            name: string,
            reason: WriteOffReason,
            quantity: number,
            description?: string,
            unitType?: 'шт' | 'гр'
        },
        { getState, rejectWithValue }
    ) => {
        try {
            console.log('=== 🔄 Обновление списания ===');
            console.log('📤 Отправка данных на сервер:', {
                chatId,
                itemId,
                name,
                reason,
                quantity,
                description,
                unitType
            });
            
            const response = await api.writeOff.updateWriteOff(chatId, itemId, {
                name,
                reason,
                quantity,
                description,
                unitType
            });
            console.log('✅ Списание успешно обновлено:', response);
            
            // Возвращаем обновленное списание для обновления UI инициатора
            return response;
        } catch (error: any) {
            console.error('❌ Ошибка при обновлении списания:', error);
            
            return rejectWithValue({
                message: error.response?.data?.error || error.message || 'Ошибка при обновлении списания',
                status: error.response?.status
            });
        }
    }
);

// Настройка WebSocket для списаний
export const setupWriteOffWebSocket = (store: any) => {
    console.log('🔄 Настройка WebSocket для списаний...');
    
    // Отладочная информация
    console.log('💡 Состояние WebSocket соединения:', socketService.isConnected() ? 'Подключено' : 'Отключено');
    console.log('🔌 Socket ID:', socketService['socket']?.id || 'Нет ID');
    
    // Регистрируем обработчики глобальных событий (для отладки)
    socketService.subscribe('connect', (data: any) => {
        console.log('🔌 WebSocket подключен (writeOffSlice)');
    });
    
    socketService.subscribe('disconnect', (data: any) => {
        console.log('🔌 WebSocket отключен (writeOffSlice)');
    });
    
    // Обработчик создания нового списания
    socketService.subscribe('writeoff_created', (data) => {
        console.log('📡 Получено новое списание через WebSocket:', {
            chatId: data.chatId,
            writeOffId: data.writeOffId,
            writeOffItem: data.writeOffItem
        });
        
        // Проверка на пустые данные
        if (!data.chatId || !data.writeOffItem) {
            console.error('❌ Получены неполные данные списания');
            return;
        }

        // Обновляем Redux-состояние
        const state = store.getState().writeOff;
        
        // Проверяем, относится ли обновление к текущему выбранному чату
        if (state.selectedChat && state.selectedChat.chat_id === data.chatId) {
            console.log('✅ Добавление нового списания в текущий чат');
            store.dispatch({
                type: 'writeOff/receiveWriteOffItem',
                payload: {
                    chatId: data.chatId,
                    writeOffItem: data.writeOffItem
                }
            });
        }
        
        // Обновляем данные в списке чатов, даже если это не текущий выбранный чат
        if (state.chats.some((chat: WriteOffChat) => chat.chat_id === data.chatId)) {
            console.log('✅ Обновление списка списаний для чата в общем списке');
            store.dispatch({
                type: 'writeOff/updateChatWriteOffs',
                payload: {
                    chatId: data.chatId,
                    writeOffItem: data.writeOffItem,
                    action: 'add'
                }
            });
        }
    });
    
    // Обработчик обновления списания
    socketService.subscribe('writeoff_updated', (data) => {
        console.log('📡 Получено обновление списания через WebSocket:', {
            chatId: data.chatId,
            writeOffId: data.writeOffId,
            writeOffItem: data.writeOffItem
        });
        
        // Проверка на пустые данные
        if (!data.chatId || !data.writeOffId || !data.writeOffItem) {
            console.error('❌ Получены неполные данные об обновлении списания');
            return;
        }

        // Обновляем Redux-состояние
        const state = store.getState().writeOff;
        
        // Проверяем, относится ли обновление к текущему выбранному чату
        if (state.selectedChat && state.selectedChat.chat_id === data.chatId) {
            console.log('✅ Обновление списания в текущем чате');
            store.dispatch({
                type: 'writeOff/receiveWriteOffUpdate',
                payload: {
                    chatId: data.chatId,
                    writeOffId: data.writeOffId,
                    writeOffItem: data.writeOffItem
                }
            });
        }
        
        // Обновляем данные в списке чатов, даже если это не текущий выбранный чат
        if (state.chats.some((chat: WriteOffChat) => chat.chat_id === data.chatId)) {
            console.log('✅ Обновление списания в общем списке чатов');
            store.dispatch({
                type: 'writeOff/updateChatWriteOffs',
                payload: {
                    chatId: data.chatId,
                    writeOffItem: data.writeOffItem,
                    action: 'update'
                }
            });
        }
    });
    
    // Обработчик удаления списания
    socketService.subscribe('writeoff_deleted', (data) => {
        console.log('📡 Получено уведомление об удалении списания через WebSocket:', {
            chatId: data.chatId,
            writeOffId: data.writeOffId,
            data: data // Для отладки выведем все данные
        });
        
        // Проверка на пустые данные
        if (!data.chatId || !data.writeOffId) {
            console.error('❌ Получены неполные данные об удалении списания');
            return;
        }

        // Проверяем, есть ли флаг локального удаления для этого элемента
        // Если флаг существует, значит удаление инициировано этим клиентом
        // и мы должны игнорировать удаленное событие от сервера
        const localUpdateFlag = `local_delete_${data.writeOffId}_${Date.now().toString().slice(0, -3)}`;
        const hasLocalFlag = Object.keys(sessionStorage).some(key => 
            key.startsWith(`local_delete_${data.writeOffId}_`) && 
            sessionStorage.getItem(key) === 'true'
        );
        
        if (hasLocalFlag) {
            console.log('🔄 Обнаружен флаг локального удаления, игнорируем событие от сервера');
            return;
        }

        // Отладочная информация - выведем текущее состояние Redux
        const state = store.getState().writeOff;
        console.log('🔍 Redux состояние перед обновлением:', {
            selectedChatId: state.selectedChat?.chat_id,
            matchesCurrentChat: state.selectedChat?.chat_id === data.chatId,
            chatExists: state.chats.some((c: any) => c.chat_id === data.chatId),
            writeOffsCount: state.selectedChat?.writeOffs.length
        });
        
        // Проверяем, относится ли обновление к текущему выбранному чату
        if (state.selectedChat && state.selectedChat.chat_id === data.chatId) {
            console.log('✅ Удаление списания из текущего чата');
            console.log('🔎 Ищем элемент для удаления:', data.writeOffId);
            console.log('📋 Текущие элементы:', state.selectedChat.writeOffs.map((wo: any) => wo.id));
            
            store.dispatch({
                type: 'writeOff/receiveWriteOffDeletion',
                payload: {
                    chatId: data.chatId,
                    writeOffId: data.writeOffId
                }
            });
            
            // Проверяем результат диспатча
            setTimeout(() => {
                const newState = store.getState().writeOff;
                console.log('📋 Элементы после удаления:', newState.selectedChat?.writeOffs.map((wo: any) => wo.id));
                console.log('🔄 Диспатч выполнен, элементов в списке:', newState.selectedChat?.writeOffs.length);
            }, 0);
        }
        
        // Обновляем данные в списке чатов, даже если это не текущий выбранный чат
        if (state.chats.some((chat: WriteOffChat) => chat.chat_id === data.chatId)) {
            console.log('✅ Удаление списания из общего списка чатов');
            store.dispatch({
                type: 'writeOff/updateChatWriteOffs',
                payload: {
                    chatId: data.chatId,
                    writeOffId: data.writeOffId,
                    action: 'delete'
                }
            });
            
            // Проверяем результат диспатча
            setTimeout(() => {
                const newState = store.getState().writeOff;
                const chat = newState.chats.find((c: any) => c.chat_id === data.chatId);
                console.log('📋 Общий список после удаления:', {
                    chatId: data.chatId,
                    writeOffsCount: chat?.writeOffs.length,
                    writeOffs: chat?.writeOffs.map((wo: any) => wo.id)
                });
            }, 0);
        }
    });
};

const writeOffSlice = createSlice({
    name: 'writeOff',
    initialState,
    reducers: {
        clearSelectedChat: (state) => {
            state.selectedChat = null;
            state.selectedChatId = null;
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
            // Обработка загрузки чатов
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
            // Обработка выбора чата
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
            // Обработка создания списания
            .addCase(createWriteOffItem.pending, (state) => {
                state.modal.isSubmitting = true;
                state.modal.isSuccess = false;
                state.error = null;
            })
            .addCase(createWriteOffItem.fulfilled, (state, action) => {
                state.modal.isSubmitting = false;
                state.modal.isSuccess = true;
                
                // Добавляем новый элемент в массив списаний выбранного чата
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chat_id) {
                    state.selectedChat.writeOffs.push(action.payload);
                }
                
                // Обновляем метаданные чата
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
            // Обработка удаления списания
            .addCase(deleteWriteOffItem.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(deleteWriteOffItem.fulfilled, (state, action) => {
                state.isLoading = false;
                // Обновляем состояние выбранного чата, если открыт чат с удаляемым элементом
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                    state.selectedChat.writeOffs = state.selectedChat.writeOffs.filter(
                        item => item.id !== action.payload.itemId
                    );
                }
                
                // Обновляем состояние чата в общем списке
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
            // Обработка загрузки списаний для чата
            .addCase(fetchWriteOffs.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchWriteOffs.fulfilled, (state, action) => {
                state.isLoading = false;
                
                // Обновляем списания в выбранном чате
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                    state.selectedChat.writeOffs = action.payload.writeOffs;
                }
                
                // Обновляем списания в списке чатов
                const chatIndex = state.chats.findIndex(chat => chat.chat_id === action.payload.chatId);
                if (chatIndex >= 0) {
                    const chat = state.chats[chatIndex];
                    chat.writeOffs = action.payload.writeOffs;
                    chat.metadata.totalWriteOffs = action.payload.writeOffs.length;
                    chat.metadata.lastUpdated = new Date().toISOString();
                }
            })
            .addCase(fetchWriteOffs.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || 'Ошибка при загрузке списаний';
            })
            // Обработка обновления списания
            .addCase(updateWriteOffItem.pending, (state) => {
                state.modal.isSubmitting = true;
                state.modal.isSuccess = false;
                state.error = null;
            })
            .addCase(updateWriteOffItem.fulfilled, (state, action) => {
                state.modal.isSubmitting = false;
                state.modal.isSuccess = true;
                
                // Обновляем элемент в выбранном чате
                if (state.selectedChat && state.selectedChat.chat_id === action.payload.chatId) {
                    state.selectedChat.writeOffs = state.selectedChat.writeOffs.map(item =>
                        item.id === action.payload.id ? action.payload : item
                    );
                }
                
                // Обновляем элемент в списке чатов
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

export const { clearSelectedChat, setModalName, setModalReason, setModalQuantity, setModalDescription, setModalUnitType, setModalSubmitting, resetModal } = writeOffSlice.actions;
export default writeOffSlice.reducer; 