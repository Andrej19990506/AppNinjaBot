import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { WebApp } from '../../types/telegram';
import { User, UserState as BaseUserState, AdminRights } from '../../types/user';
import { Admin } from '../../types/inventoryTypes';
import { ChatContext } from './chatSlice';
import { api } from '../../services/api';
import { updateMemberSeniority, updateCourierProfile } from '../../services/courierApi';
import axios from 'axios';
import { RootState } from '../../store/store';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Group {
    chat_id: string;
    chat_title: string;
    group_type?: string;
    id?: number;
}

// Тестовые данные для режима разработки
const DEV_MODE_USER_DATA: Partial<User> = {
    id: 1682142222, // ID тестового пользователя (Андрей Николаевич)
    // Присваиваем пустые строки для теста окна обновления профиля
    first_name: "",
    last_name: "",
    username: "andrejnikolaevich1999",
    photo_url: "https://api.telegram.org/file/bot7878489788:AAHupjPYeWpzVwo77F_BCR6fIA1I_P8p_Uc/photos/file_0.jpg",
    isAdmin: false,
    adminRights: null,
    groups: [
        {
            chat_id: "-1004755640016",
            chat_title: "Повара Словцова",
            group_type: "chef"
        },
        {
            chat_id: "-1004611898635",
            chat_title: "Курьеры Высотная",
            group_type: "courier"
        },
        {
            chat_id: "-1004721237800",
            chat_title: "Курьеры Баумана",
            group_type: "courier"
        }
    ]
};

// <<< Определяем расширенный UserState >>>
interface UserState extends BaseUserState {
    usersById: { [key: number]: User }; 
    activeRole: string | null;
}

// <<< Используем РАСШИРЕННЫЙ UserState для initialState >>>
const initialState: UserState = {
    user: null,
    usersById: {}, // Теперь это поле есть в типе
    activeRole: null,
    isInitialized: false,
    error: null,
    loading: false
};

// Инициализация пользователя из Telegram WebApp
export const initializeFromTelegram = createAsyncThunk(
    'user/initializeFromTelegram',
    async (_, { rejectWithValue }) => {
        console.log('=== 👤 Инициализация пользователя из Telegram ===');
        const webApp = window.Telegram?.WebApp as WebApp | undefined;
        const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENV === 'development';
        
        console.log('📱 WebApp данные:', {
            available: !!webApp,
            hasUser: !!webApp?.initDataUnsafe?.user,
            initData: webApp?.initDataUnsafe,
            isDevelopmentMode
        });

        let userId: number | undefined;
        let userDataFromWebApp: WebApp['initDataUnsafe']['user'] | undefined;

        if (isDevelopmentMode && !webApp?.initDataUnsafe?.user?.id) {
            console.log('🔧 Режим разработки - используем тестовые данные пользователя');
            // Используем ID из DEV_MODE_USER_DATA или 0 как fallback
            userId = DEV_MODE_USER_DATA.id ?? 0; 
            // Проверяем наличие полей в DEV_MODE_USER_DATA или используем пустые строки/fallback ID
            userDataFromWebApp = {
                id: userId, // userId здесь уже точно number
                first_name: DEV_MODE_USER_DATA.first_name ?? '', // fallback на пустую строку
                last_name: DEV_MODE_USER_DATA.last_name ?? '', // fallback на пустую строку
                username: DEV_MODE_USER_DATA.username ?? '', // fallback на пустую строку
                photo_url: DEV_MODE_USER_DATA.photo_url, // photo_url может быть undefined по типу WebAppUser
            };
        } else if (webApp?.initDataUnsafe?.user?.id) {
            userId = webApp.initDataUnsafe.user.id;
            userDataFromWebApp = webApp.initDataUnsafe.user;
        } else {
            console.error('❌ Данные пользователя Telegram недоступны');
            return rejectWithValue('Telegram WebApp user data not available');
        }

        if (!userId || !userDataFromWebApp) {
            console.error('❌ Не удалось определить ID пользователя или данные WebApp');
            return rejectWithValue('Could not determine user ID or WebApp data');
        }

        // Создаем базовый объект пользователя из данных Telegram или тестовых данных
        let user: User = {
            id: userId,
            first_name: userDataFromWebApp.first_name || "",
            last_name: userDataFromWebApp.last_name || "",
            username: userDataFromWebApp.username?.trim() || "",
            photo_url: userDataFromWebApp.photo_url || "",
            language_code: userDataFromWebApp.language_code,
            isAdmin: false,
            adminRights: null,
            groups: [],
        };

        try {
            console.log(`🔄 Загрузка контекста (групп) для пользователя ${userId}...`);
            const groupsData = await api.user.getUserContext(userId);
            user.groups = groupsData;
            console.log('✅ Контекст (группы) пользователя загружен:', user.groups);

            try {
                console.log(`🔄 Загрузка профиля для пользователя ${userId}...`);
                const profileData = await api.user.getUserProfile(userId);
                
                if (profileData) {
                    console.log('✅ Профиль пользователя загружен:', profileData);
                    user = {
                        ...user, 
                        id: profileData.user_id || userId, 
                        first_name: profileData.first_name || user.first_name, 
                        last_name: profileData.last_name || user.last_name, 
                        username: profileData.username || user.username, 
                        photo_url: profileData.photo_url || user.photo_url, 
                    };
                     console.log('🔄 Пользователь обновлен данными из профиля:', JSON.stringify(user, null, 2)); 
                } else {
                    console.warn(`⚠️ Не удалось загрузить профиль для пользователя ${userId} (возможно, 404). Используются базовые данные.`);
                }

            } catch (profileError) {
                console.error('❌ Ошибка при загрузке профиля пользователя:', profileError);
            }

        } catch (contextError) {
            console.error('❌ Ошибка при загрузке контекста пользователя (групп):', contextError);
            let errorMessage = 'Неизвестная ошибка при загрузке контекста.';
            if (axios.isAxiosError(contextError)) {
                errorMessage = contextError.response?.data?.detail || contextError.message || errorMessage;
            } else if (contextError instanceof Error) {
                errorMessage = contextError.message;
            }
            console.warn(`⚠️ Инициализация пользователя продолжится без данных о группах. Ошибка: ${errorMessage}`);
        }

        // Расширяем лог
        console.log('✅ Итоговые данные пользователя для Redux:', JSON.stringify(user, null, 2));
        return user;
    }
);

// Проверка прав администратора для конкретного чата
export const checkAdminRights = createAsyncThunk<void, {
    userId: number;
    chatId: string;
    admins: Admin[];
    context?: ChatContext;
}>(
    'user/checkAdminRights',
    async ({ userId, chatId, admins, context = 'inventory' }, { dispatch }) => {
        try {
            console.log('👤 User ID:', userId);
            console.log('💬 Chat ID:', chatId);

            // Проверяем каждого админа
            for (const admin of admins) {
                console.log('🔄 Сравнение ID админа:', admin.user_id, 'тип:', typeof admin.user_id);
                console.log('🔄 С ID пользователя:', userId, 'тип:', typeof userId);
                
                if (admin.user_id === userId) {
                    console.log('✅ Пользователь является администратором');
                    // <<< ИСПРАВЛЕНИЕ: Устанавливаем права в true, если пользователь найден в списке админов >>>
                    const calculatedAdminRights: AdminRights = {
                        // Устанавливаем права в true, так как пользователь - админ чата
                        canManageInventory: true, 
                        canManageUsers: true // Или другая логика, если нужно
                    };
                    // Обновляем статус администратора, передавая AdminRights
                    dispatch(updateAdminStatus({ isAdmin: true, adminRights: calculatedAdminRights }));
                    return;
                }
            }

            throw new Error(`У вас нет прав для ${context === 'inventory' ? 'инвентаризации' : context === 'writeoff' ? 'списания' : 'просмотра событий'} в этом чате`);
        } catch (error) {
            throw error;
        }
    }
);

// --- THUNK ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ (ИМЯ/ФАМИЛИЯ) --- 
export const updateUserProfileThunk = createAsyncThunk<
    // Тип возвращаемого значения при успехе (обновленные данные пользователя из API)
    User, // Предполагаем, что API возвращает полный профиль
    // Тип аргументов
    { userId: number | string; data: { firstName: string; lastName: string } },
    { rejectValue: string }
>(
    'user/updateProfile', // Новое имя действия
    async ({ userId, data }, { rejectWithValue, getState }) => {
        console.log(`[userSlice] 🚀 Отправка запроса на обновление профиля (имя/фамилия) для ${userId}`);
        try {
            // Вызываем API функцию, которая теперь обновляет только имя/фамилию
            const updatedProfile = await updateCourierProfile(userId, data);
            console.log('[userSlice] ✅ Ответ API на обновление профиля:', updatedProfile);
            
            // Формируем обновленные данные для Redux, сохраняя существующие группы и т.д.
            const currentState = (getState() as any).user as UserState;
            if (!currentState.user) {
                 throw new Error('Current user state is missing');
            }
            
            const updatedUser: User = {
                ...currentState.user,
                first_name: updatedProfile.first_name || '',
                last_name: updatedProfile.last_name || ''
                // Остальные поля берем из текущего состояния
            };
            
            return updatedUser; // Возвращаем полный обновленный объект User
        } catch (error: any) {
            console.error('[userSlice] ❌ Ошибка при обновлении профиля:', error);
            const message = error.message || 'Не удалось обновить профиль.';
            return rejectWithValue(message);
        }
    }
);

// --- НОВЫЙ THUNK ДЛЯ ОБНОВЛЕНИЯ СТАТУСА СТАРШЕГО --- 
export const updateSeniorityStatus = createAsyncThunk<
    // Тип возвращаемого значения при успехе (данные из API ответа)
    { groupTelegramId: string; userTelegramId: string; isSenior: boolean | null }, 
    // Тип аргументов, которые передаем в thunk
    { groupTelegramId: string; userTelegramId: string; isSenior: boolean },
    // Типы для rejectWithValue
    { rejectValue: string }
>(
    'user/updateSeniorityStatus',
    async ({ groupTelegramId, userTelegramId, isSenior }, { rejectWithValue }) => {
        console.log(`[userSlice] 🚀 Отправка запроса на обновление статуса старшего: group=${groupTelegramId}, user=${userTelegramId}, status=${isSenior}`);
        try {
            const response = await updateMemberSeniority(groupTelegramId, userTelegramId, isSenior);
            console.log('[userSlice] ✅ Ответ API на обновление статуса старшего:', response);
            // Возвращаем данные, чтобы обновить состояние в fulfilled
            return { 
                groupTelegramId,
                userTelegramId,
                isSenior: response.is_senior_courier // Берем статус из ответа API
            };
        } catch (error: any) {
            console.error('[userSlice] ❌ Ошибка при обновлении статуса старшего:', error);
            const message = error.message || 'Не удалось обновить статус старшего курьера.';
            return rejectWithValue(message);
        }
    }
);

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        updateUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
        },
        clearUserData: (state) => {
            state.user = null;
            state.isInitialized = false;
            state.error = null;
        },
        updateAdminStatus: (state, action: PayloadAction<{ isAdmin: boolean; adminRights: AdminRights | null }>) => {
            if (state.user) {
                state.user.isAdmin = action.payload.isAdmin;
                state.user.adminRights = action.payload.adminRights;
            }
        },
        resetUserState: () => initialState,
        // Редьюсер для прямого обновления статуса в конкретной группе (если нужно)
        updateUserGroupSeniority: (state, action: PayloadAction<{ groupTelegramId: string; isSenior: boolean | null }>) => {
            if (state.user && state.user.groups) {
                const { groupTelegramId, isSenior } = action.payload;
                const groupIndex = state.user.groups.findIndex(g => String(g.chat_id) === groupTelegramId);
                if (groupIndex !== -1) {
                    state.user.groups[groupIndex].is_senior_courier = isSenior;
                     console.log(`[userSlice] Обновлен is_senior_courier для группы ${groupTelegramId} на ${isSenior}`);
                } else {
                    console.warn(`[userSlice] Группа ${groupTelegramId} не найдена для обновления is_senior_courier`);
                }
            }
        },
        // <<< НОВЫЙ РЕДЬЮСЕР ДЛЯ ПАКЕТНОГО ОБНОВЛЕНИЯ ПОЛЬЗОВАТЕЛЕЙ >>>
        usersReceived: (state, action: PayloadAction<{ [key: number]: User }>) => {
            const incomingUsers = action.payload;
            console.log('[userSlice] Received batch user update:', incomingUsers);
            for (const userId in incomingUsers) {
                const numericUserId = parseInt(userId, 10);
                const incomingUser = incomingUsers[userId];
                const existingUser = state.usersById[numericUserId];
                
                if (existingUser) {
                    // Обновляем существующего, сохраняя некоторые старые поля
                    state.usersById[numericUserId] = {
                        ...existingUser, 
                        ...incomingUser, // Перезаписываем поля из incomingUser
                        id: numericUserId // Убедимся, что ID правильный
                    };
                } else {
                    // Добавляем нового пользователя
                    state.usersById[numericUserId] = {
                        // Убираем значения по умолчанию, полагаемся на incomingUser
                        // isAdmin: false,
                        // adminRights: null,
                        // groups: [],
                        ...incomingUser,   // Добавляем поля из payload
                        id: numericUserId // Убедимся, что ID правильный
                    };
                }
            }
            console.log('[userSlice] usersById map after batch update:', state.usersById);
        },
        // <<< ИЗМЕНЕННЫЙ userProfileUpdatedWs >>>
        userProfileUpdatedWs: (state, action: PayloadAction<{ user_id: number; profile: Partial<User> }>) => { // <<< Принимаем Partial<User> >>>
            const { user_id, profile } = action.payload;
            console.log(`[userSlice/WS] Received profile update for user ${user_id}`, profile);
            
            // <<< ИСКЛЮЧАЕМ groups из объекта profile перед слиянием >>>
            const { groups, ...profileWithoutGroups } = profile;
            if (groups) {
                 console.warn("[userSlice/WS] Received 'groups' field in userProfileUpdatedWs payload. Ignoring it to prevent overwriting seniority status.");
            }

            const existingUserInMap = state.usersById[user_id];
            if (existingUserInMap) {
                 console.log(`[userSlice/WS] Updating user ${user_id} in usersById map.`);
                 state.usersById[user_id] = { 
                     ...existingUserInMap, 
                     ...profileWithoutGroups, // <<< Сливаем profile БЕЗ groups >>> 
                     id: user_id 
                 };
            } else {
                 console.log(`[userSlice/WS] Adding new user ${user_id} to usersById map from partial WS data.`);
                 state.usersById[user_id] = {
                     id: user_id,
                     first_name: profileWithoutGroups.first_name || "",
                     last_name: profileWithoutGroups.last_name || "",
                     username: profileWithoutGroups.username || "",
                     photo_url: profileWithoutGroups.photo_url || "",
                     language_code: 'language_code' in profileWithoutGroups ? profileWithoutGroups.language_code : undefined,
                     isAdmin: 'isAdmin' in profileWithoutGroups ? (profileWithoutGroups.isAdmin ?? false) : false,
                     adminRights: 'adminRights' in profileWithoutGroups ? (profileWithoutGroups.adminRights || null) : null,
                     groups: [], // Новый пользователь начинает с пустыми группами
                 };
            }

            // Обновляем данные ТЕКУЩЕГО пользователя (state.user)
            if (state.user && state.user.id === user_id) {
                console.log(`[userSlice/WS] Updating CURRENT user (state.user) data.`);
                 // <<< ИСПРАВЛЕНИЕ: Берем данные из usersById, которые уже обновлены БЕЗ groups >>>
                 //    НО! Нужно сохранить существующие группы текущего пользователя.
                 const updatedUserFromMap = state.usersById[user_id];
                 state.user = {
                    ...updatedUserFromMap, // Берем обновленные поля (имя, фото и т.д.)
                    groups: state.user.groups // <<< СОХРАНЯЕМ существующие группы state.user >>>
                 };
            }
        },
        // <<< НОВЫЙ РЕДЬЮСЕР ДЛЯ УСТАНОВКИ РОЛИ >>>
        setActiveRole: (state, action: PayloadAction<string | null>) => {
            console.log(`[userSlice] Установка activeRole: ${action.payload}`);
            state.activeRole = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            // Инициализация
            .addCase(initializeFromTelegram.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(initializeFromTelegram.fulfilled, (state, action: PayloadAction<User>) => {
                const user = action.payload;
                state.user = user;
                // Добавляем/обновляем в карту, сохраняя существующие данные, если были
                state.usersById[user.id] = { ...state.usersById[user.id], ...user };
                state.isInitialized = true;
                state.loading = false;
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.error = action.payload as string;
                state.isInitialized = true; 
                state.loading = false;
            })
            // Обновление профиля через API
            .addCase(updateUserProfileThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateUserProfileThunk.fulfilled, (state, action: PayloadAction<User>) => {
                 const updatedUser = action.payload;
                 state.user = updatedUser;
                 // Обновляем в карте, сохраняя существующие данные
                 state.usersById[updatedUser.id] = { ...state.usersById[updatedUser.id], ...updatedUser };
                 state.loading = false;
            })
            .addCase(updateUserProfileThunk.rejected, (state, action) => {
                 state.loading = false;
                 state.error = action.payload ?? 'Failed to update profile via API';
            })
             // Проверка прав админа (пример, предполагаем, что не меняет usersById)
            .addCase(checkAdminRights.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(checkAdminRights.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Ошибка проверки прав администратора';
            })
            // Обновление статуса старшего (пример, предполагаем, что не меняет usersById)
            .addCase(updateSeniorityStatus.pending, (state) => {
                state.loading = true; 
            })
            .addCase(updateSeniorityStatus.fulfilled, (state, action) => {
                state.loading = false;
                console.log('[userSlice] Seniority status update fulfilled (reducer needs implementation)', action.payload);
                // TODO: Реализовать обновление статуса старшего в state.user.groups И в state.usersById[userId].groups
            })
            .addCase(updateSeniorityStatus.rejected, (state, action) => {
                 state.loading = false;
                 state.error = action.payload ?? 'Failed to update seniority status via API';
            });
    },
});

// Экспортируем actions и reducer
export const { 
    updateUser, 
    clearUserData, 
    updateAdminStatus, 
    resetUserState,
    updateUserGroupSeniority,
    usersReceived,
    userProfileUpdatedWs,
    setActiveRole,
} = userSlice.actions;

export default userSlice.reducer;

// Экспортируем сам объект слайса для использования в listenerMiddleware
export { userSlice };

// <<< Используем UserState (расширенный) для типа state в селекторах >>>
export const selectUsersById = (state: RootState): { [key: number]: User } => state.user.usersById;
export const selectUser = (state: RootState): User | null => state.user.user;
export const selectIsUserInitialized = (state: RootState): boolean => state.user.isInitialized;
export const selectUserInitializationError = (state: RootState): string | null => state.user.error;
export const selectActiveRole = (state: RootState): string | null => state.user.activeRole;
// --- ----------------------------------------------- --- 
// --- ----------------------------------------------- --- 
