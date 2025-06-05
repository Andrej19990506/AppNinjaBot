import { RootState } from '@/shared/store/store';
import { User } from '../../../types/user';

export const selectUsersById = (state: RootState): { [key: number]: User } => state.user.usersById;
export const selectUser = (state: RootState): User | null => state.user.user;
export const selectIsUserInitialized = (state: RootState): boolean => state.user.isInitialized;
export const selectUserInitializationError = (state: RootState): string | null => state.user.error;
export const selectActiveRole = (state: RootState): string | null => state.user.activeRole; 