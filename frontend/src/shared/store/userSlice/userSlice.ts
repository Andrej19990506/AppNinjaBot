// --- userSlice.ts ---
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@shared/store/store';
import { AdminRights, User } from '@/types/user';
import { initializeFromTelegram } from './userThunks';
import { updateUserProfileThunk } from './userThunks';
import { updateSeniorityStatus } from './userThunks';

interface Group {
    chat_id: string;
    chat_title: string;
    group_type?: string;
    id?: number;
}

interface UserState {
    user: User | null;
    usersById: { [key: number]: User };
    activeRole: string | null;
    isInitialized: boolean;
    error: string | null;
    loading: boolean;
}

const initialState: UserState = {
    user: null,
    usersById: {},
    activeRole: null,
    isInitialized: false,
    error: null,
    loading: false
};

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
        updateUserGroupSeniority: (state, action: PayloadAction<{ groupTelegramId: string; isSenior: boolean | null }>) => {
            if (state.user && state.user.groups) {
                const { groupTelegramId, isSenior } = action.payload;
                const groupIndex = state.user.groups.findIndex(g => String(g.chat_id) === groupTelegramId);
                if (groupIndex !== -1) {
                    state.user.groups[groupIndex].is_senior_courier = isSenior;
                }
            }
        },
        usersReceived: (state, action: PayloadAction<{ [key: number]: User }>) => {
            const incomingUsers = action.payload;
            for (const userId in incomingUsers) {
                const numericUserId = parseInt(userId, 10);
                const incomingUser = incomingUsers[userId];
                const existingUser = state.usersById[numericUserId];
                if (existingUser) {
                    state.usersById[numericUserId] = {
                        ...existingUser, 
                        ...incomingUser,
                        id: numericUserId
                    };
                } else {
                    state.usersById[numericUserId] = {
                        ...incomingUser,
                        id: numericUserId
                    };
                }
            }
        },
        userProfileUpdatedWs: (state, action: PayloadAction<{ user_id: number; profile: Partial<User> }>) => {
            const { user_id, profile } = action.payload;
            const { groups, ...profileWithoutGroups } = profile;
            const existingUserInMap = state.usersById[user_id];
            if (existingUserInMap) {
                 state.usersById[user_id] = { 
                     ...existingUserInMap, 
                     ...profileWithoutGroups,
                     id: user_id 
                 };
            } else {
                 state.usersById[user_id] = {
                     id: user_id,
                     first_name: profileWithoutGroups.first_name || "",
                     last_name: profileWithoutGroups.last_name || "",
                     username: profileWithoutGroups.username || "",
                     photo_url: profileWithoutGroups.photo_url || "",
                     language_code: 'language_code' in profileWithoutGroups ? profileWithoutGroups.language_code : undefined,
                     isAdmin: 'isAdmin' in profileWithoutGroups ? (profileWithoutGroups.isAdmin ?? false) : false,
                     adminRights: 'adminRights' in profileWithoutGroups ? (profileWithoutGroups.adminRights || null) : null,
                     groups: [],
                 };
            }
            if (state.user && state.user.id === user_id) {
                 const updatedUserFromMap = state.usersById[user_id];
                 state.user = {
                    ...updatedUserFromMap,
                    groups: state.user.groups
                 };
            }
        },
        setActiveRole: (state, action: PayloadAction<string | null>) => {
            state.activeRole = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(initializeFromTelegram.fulfilled, (state, action) => {
                state.user = action.payload;
                state.isInitialized = true;
                state.error = null;
                state.loading = false;
            })
            .addCase(initializeFromTelegram.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(initializeFromTelegram.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Ошибка инициализации пользователя';
                state.isInitialized = false;
                state.loading = false;
            })
            .addCase(updateUserProfileThunk.fulfilled, (state, action) => {
                const updatedUser = action.payload;
                state.user = updatedUser;
                state.usersById[updatedUser.id] = { ...state.usersById[updatedUser.id], ...updatedUser };
                state.loading = false;
                state.error = null;
            })
            .addCase(updateSeniorityStatus.fulfilled, (state, action) => {
                const { groupTelegramId, isSenior } = action.payload;
                if (state.user && state.user.groups) {
                    const group = state.user.groups.find(g => String(g.chat_id) === String(groupTelegramId));
                    if (group) {
                        group.is_senior_courier = isSenior;
                    }
                }
            });
    }
});

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
export { userSlice }; 