import { RootState } from '@/shared/store/store';

export const selectWriteOffChats = (state: RootState) => state.writeOff.chats;
export const selectSelectedWriteOffChat = (state: RootState) => state.writeOff.selectedChat;
export const selectWriteOffIsLoading = (state: RootState) => state.writeOff.isLoading;
export const selectWriteOffError = (state: RootState) => state.writeOff.error;
export const selectWriteOffModal = (state: RootState) => state.writeOff.modal;
export const selectWriteOffModalName = (state: RootState) => state.writeOff.modal.name;
export const selectWriteOffModalReason = (state: RootState) => state.writeOff.modal.reason;
export const selectWriteOffModalQuantity = (state: RootState) => state.writeOff.modal.quantity;
export const selectWriteOffModalDescription = (state: RootState) => state.writeOff.modal.description;
export const selectWriteOffModalUnitType = (state: RootState) => state.writeOff.modal.unitType;
export const selectWriteOffModalIsSubmitting = (state: RootState) => state.writeOff.modal.isSubmitting;
export const selectWriteOffModalIsSuccess = (state: RootState) => state.writeOff.modal.isSuccess;
