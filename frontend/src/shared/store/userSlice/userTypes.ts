import { User } from '../../../types/user';

export interface UserState {
    user: User | null;
    usersById: { [key: number]: User };
    activeRole: string | null;
    isInitialized: boolean;
    error: string | null;
    loading: boolean;
} 