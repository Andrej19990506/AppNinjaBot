import { createAsyncThunk } from '@reduxjs/toolkit';
import { WriteOffReason} from '@/types/writeOff';
import { RootState } from '@/shared/store/store';
import { WriteOffApi } from '@features/WriteOff/services/writeOffApi';
import { socketService } from '@/shared/services/socketService';
import { checkAdminRights } from '@/shared/store/adminSlice/adminThunks';

// Загрузка списка чатов для списания
export const fetchWriteOffChats = createAsyncThunk(
    'writeOff/fetchChats',
    async (_, { getState }) => {
        try {
            console.log('=== 🔄 Загрузка чатов для списания ===');
            const state = getState() as RootState;
            const userId = state.user.user?.id;
            const groupType = state.user.activeRole;
            if (!userId || !groupType) {
                throw new Error('Не определены userId или groupType');
            }
            const response = await WriteOffApi.getWriteOffChats(userId, groupType);
            console.log('✅ Получены данные:', response.data);

            if (!response.data || !Array.isArray(response.data)) {
                throw new Error('Некорректный формат данных от сервера');
            }

            // Возвращаем все чаты без фильтрации по админам
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
            }));

            if (writeOffChats.length === 0) {
                console.warn('⚠️ Нет доступных чатов для списания');
            }

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
    async ({ chatId, date }: { chatId: string; date?: string }, { rejectWithValue }) => {
        try {
            console.log('=== 🔄 Загрузка списаний для чата ===');
            console.log('🏠 Чат:', chatId);
            console.log('📅 Дата:', date || 'все даты');
            const response = await WriteOffApi.getWriteOffs(chatId, date);
            console.log('✅ Получены списания:', response.data);
            return {
                chatId,
                date,
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
    async ({ chatId, date }: { chatId: string; date?: string }, { getState, dispatch }) => {
        const state = getState() as RootState;
        const chat = state.writeOff.chats.find((c: any) => c.chat_id === chatId);
        const userId = state.user.user?.id;
        
        console.log('🔍 Debug selectWriteOffChat:', {
            chatId,
            chat: !!chat,
            userId,
            userState: state.user.user,
            allChats: state.writeOff.chats.map(c => c.chat_id)
        });
        
        if (!chat || !userId) {
            console.log('❌ Чат не найден или ID пользователя отсутствует', {
                chatFound: !!chat,
                userId,
                userObject: state.user.user
            });
            throw new Error('Чат не найден или нет доступа');
        }
        try {
            const formattedAdmins = chat.admins.map((admin: any) => ({
                user_id: admin.user_id,
                first_name: admin.first_name || ''
            }));
            await dispatch(checkAdminRights({
                userId: userId,
                chatId,
                admins: formattedAdmins,
                context: 'writeoff'
            })).unwrap();
            const writeOffsResult = await dispatch(fetchWriteOffs({ chatId, date })).unwrap();
            const writeOffs = Array.isArray(writeOffsResult)
                ? writeOffsResult
                : writeOffsResult.writeOffs ?? [];
            // Возвращаем чат с актуальными списаниями
            return { ...chat, writeOffs };
        } catch (error: any) {
            console.log('❌ Нет прав доступа или ошибка проверки прав:', error);
            throw new Error(error?.message || 'Нет прав доступа к чату');
        }
    }
);

// Создание списания
export const createWriteOffItem = createAsyncThunk(
    'writeOff/createWriteOffItem',
    async (
        { chatId, name, reason, quantity, description = '', unitType = 'шт', user_id, date, photos = [] }: {
            chatId: string,
            name: string,
            reason: string | WriteOffReason,
            quantity: number,
            description?: string,
            unitType?: 'шт' | 'гр',
            user_id: string | number,
            date?: string,  // Дата списания в формате YYYY-MM-DD
            photos?: File[]  // Фото списания
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
                unitType,
                user_id,
                photosCount: photos.length
            });
            
            // Проверяем что user_id определен
            if (!user_id) {
                console.error('❌ [createWriteOffItem] Отсутствует user_id:', { user_id });
                throw new Error('Не указан user_id');
            }
            
            const response = await WriteOffApi.createWriteOff(chatId, {
                name,
                reason: typeof reason === 'string' ? reason : reason.id,
                quantity,
                description,
                unitType,
                user_id,
                date,  // Передаем дату для списания
                photos  // Передаем фото
            });
            console.log('✅ Списание успешно создано:', response);
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
        { chatId, itemId }: { chatId: string, itemId: string },
        { getState, rejectWithValue }
    ) => {
        try {
            console.log('=== 🔄 Удаление списания ===');
            console.log('📤 Данные для удаления:', {
                chatId,
                itemId
            });
            const response = await WriteOffApi.deleteWriteOff(chatId, itemId);
            console.log('✅ Списание успешно удалено:', response);
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
        { chatId, itemId, name, reason, quantity, description = '', unitType = 'шт', date, photos = [] }: {
            chatId: string,
            itemId: string,
            name: string,
            reason: WriteOffReason,
            quantity: number,
            description?: string,
            unitType?: 'шт' | 'гр',
            date?: string,  // Дата списания в формате YYYY-MM-DD
            photos?: File[]  // Фото списания
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
                unitType,
                photosCount: photos.length
            });
            const response = await WriteOffApi.updateWriteOff(chatId, itemId, {
                name,
                reason,
                quantity,
                description,
                unitType,
                date,  // Передаем дату для обновления
                photos  // Передаем фото
            });
            console.log('✅ Списание успешно обновлено:', response);
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
    console.log('💡 Состояние WebSocket соединения:', socketService.isConnected() ? 'Подключено' : 'Отключено');
    console.log('🔌 Socket ID:', socketService['socket']?.id || 'Нет ID');
    socketService.subscribe('connect', (data: any) => {
        console.log('🔌 WebSocket подключен (writeOffSlice)');
    });
    socketService.subscribe('disconnect', (data: any) => {
        console.log('🔌 WebSocket отключен (writeOffSlice)');
    });
    socketService.subscribe('writeoff_created', (data) => {
        console.log('📡 Получено новое списание через WebSocket:', {
            chatId: data.chatId,
            writeOffId: data.writeOffId,
            writeOffItem: data.writeOffItem
        });
        if (!data.chatId || !data.writeOffItem) {
            console.error('❌ Получены неполные данные списания');
            return;
        }
        const state = store.getState().writeOff;
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
        if (state.chats.some((chat: any) => chat.chat_id === data.chatId)) {
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
    socketService.subscribe('writeoff_updated', (data) => {
        console.log('📡 Получено обновление списания через WebSocket:', {
            chatId: data.chatId,
            writeOffId: data.writeOffId,
            writeOffItem: data.writeOffItem
        });
        if (!data.chatId || !data.writeOffId || !data.writeOffItem) {
            console.error('❌ Получены неполные данные об обновлении списания');
            return;
        }
        const state = store.getState().writeOff;
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
        if (state.chats.some((chat: any) => chat.chat_id === data.chatId)) {
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
    socketService.subscribe('writeoff_deleted', (data) => {
        console.log('📡 Получено уведомление об удалении списания через WebSocket:', {
            chatId: data.chatId,
            writeOffId: data.writeOffId,
            data: data
        });
        if (!data.chatId || !data.writeOffId) {
            console.error('❌ Получены неполные данные об удалении списания');
            return;
        }
        const localUpdateFlag = `local_delete_${data.writeOffId}_${Date.now().toString().slice(0, -3)}`;
        const hasLocalFlag = Object.keys(sessionStorage).some(key => 
            key.startsWith(`local_delete_${data.writeOffId}_`) && 
            sessionStorage.getItem(key) === 'true'
        );
        if (hasLocalFlag) {
            console.log('🔄 Обнаружен флаг локального удаления, игнорируем событие от сервера');
            return;
        }
        const state = store.getState().writeOff;
        console.log('🔍 Redux состояние перед обновлением:', {
            selectedChatId: state.selectedChat?.chat_id,
            matchesCurrentChat: state.selectedChat?.chat_id === data.chatId,
            chatExists: state.chats.some((c: any) => c.chat_id === data.chatId),
            writeOffsCount: state.selectedChat?.writeOffs.length
        });
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
            setTimeout(() => {
                const newState = store.getState().writeOff;
                console.log('📋 Элементы после удаления:', newState.selectedChat?.writeOffs.map((wo: any) => wo.id));
                console.log('🔄 Диспатч выполнен, элементов в списке:', newState.selectedChat?.writeOffs.length);
            }, 0);
        }
        if (state.chats.some((chat: any) => chat.chat_id === data.chatId)) {
            console.log('✅ Удаление списания из общего списка чатов');
            store.dispatch({
                type: 'writeOff/updateChatWriteOffs',
                payload: {
                    chatId: data.chatId,
                    writeOffId: data.writeOffId,
                    action: 'delete'
                }
            });
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