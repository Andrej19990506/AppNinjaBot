import { RootState } from '../store';

export const selectAdminCurrentUser = (state: RootState) => state.admin.currentUser;
export const selectAdminPhotos = (state: RootState) => state.admin.adminPhotos;
export const selectAdminError = (state: RootState) => state.admin.error; 