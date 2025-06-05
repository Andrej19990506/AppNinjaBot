// --- chatSelectors.ts ---
import { ChatState, ChatWithContext, ChatMetadata } from './chatTypes';

export const selectChatState = (state: { chat: ChatState }) => state.chat;
export const selectChats = (state: { chat: ChatState }): ChatWithContext[] => state.chat.items;
export const selectIsLoading = (state: { chat: ChatState }) => state.chat.isLoading;
export const selectError = (state: { chat: ChatState }) => state.chat.error;
export const selectSelectedChatId = (state: { chat: ChatState }) => state.chat.selectedChatId;
export const selectCurrentContext = (state: { chat: ChatState }) => state.chat.currentContext;
export const selectChatMetadata = (state: { chat: ChatState }, chatId: string): ChatMetadata | undefined => state.chat.metadata[chatId];
export const selectChatById = (state: { chat: ChatState }, chatId: string): ChatWithContext | undefined => state.chat.items.find(c => c.id === chatId);
