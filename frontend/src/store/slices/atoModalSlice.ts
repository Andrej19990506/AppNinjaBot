import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

// Типы для комментариев АТО
export interface AtoComment {
  title: string;
  text: string;
  penaltyPoints?: number; // Добавляем штрафные баллы для комментария
}

// Тип для состояния модального окна
interface AtoModalState {
  isOpen: boolean;
  isCreateMode: boolean;
  comments: AtoComment[];
  selectedComments: string[];
  selectedCommentTexts: string[];
  penaltyPoints?: number;
  objectName?: string;
  scorePercentage?: number; // Добавляем поле для процента выполнения
  maxPoints?: number; // Максимально возможные баллы
  earnedPoints?: number; // Набранные баллы
}

// Начальное состояние
const initialState: AtoModalState = {
  isOpen: false,
  isCreateMode: false,
  comments: [],
  selectedComments: [],
  selectedCommentTexts: [],
  penaltyPoints: undefined,
  objectName: undefined,
  scorePercentage: undefined,
  maxPoints: undefined,
  earnedPoints: undefined
};

// Создаем slice
const atoModalSlice = createSlice({
  name: 'atoModal',
  initialState,
  reducers: {
    openAtoModal: (state, action: PayloadAction<{
      comments: AtoComment[];
      penaltyPoints?: number;
      objectName?: string;
      scorePercentage?: number; // Добавляем в параметры
      maxPoints?: number;
      earnedPoints?: number;
    }>) => {
      state.isOpen = true;
      state.isCreateMode = false;
      state.comments = action.payload.comments;
      state.penaltyPoints = action.payload.penaltyPoints;
      state.objectName = action.payload.objectName;
      state.scorePercentage = action.payload.scorePercentage; // Устанавливаем процент
      state.maxPoints = action.payload.maxPoints; // Устанавливаем макс. баллы
      state.earnedPoints = action.payload.earnedPoints; // Устанавливаем набранные баллы
    },
    closeAtoModal: (state) => {
      state.isOpen = false;
    },
    setAtoCreateMode: (state, action: PayloadAction<boolean>) => {
      state.isCreateMode = action.payload;
    },
    toggleCommentSelection: (state, action: PayloadAction<string>) => {
      const title = action.payload;
      if (state.selectedComments.includes(title)) {
        state.selectedComments = state.selectedComments.filter(item => item !== title);
      } else {
        state.selectedComments.push(title);
      }
    },
    toggleCommentTextSelection: (state, action: PayloadAction<string>) => {
      const text = action.payload;
      if (state.selectedCommentTexts.includes(text)) {
        state.selectedCommentTexts = state.selectedCommentTexts.filter(item => item !== text);
      } else {
        state.selectedCommentTexts.push(text);
      }
    },
    selectAllComments: (state) => {
      state.selectedComments = state.comments.map(comment => comment.title);
    },
    selectAllCommentTexts: (state, action: PayloadAction<string[]>) => {
      state.selectedCommentTexts = action.payload;
    },
    resetSelection: (state) => {
      state.selectedComments = [];
      state.selectedCommentTexts = [];
    },
    createNotificationFromAto: (state) => {
      // Этот экшен не меняет состояние, он будет использоваться как триггер 
      // для вызова функции handleCreateNotification из AtoCommentsModal
    }
  }
});

// Экспортируем действия
export const {
  openAtoModal,
  closeAtoModal,
  setAtoCreateMode,
  toggleCommentSelection,
  toggleCommentTextSelection,
  selectAllComments,
  selectAllCommentTexts,
  resetSelection,
  createNotificationFromAto
} = atoModalSlice.actions;

// Селекторы
export const selectAtoModalOpen = (state: RootState) => state.atoModal.isOpen;
export const selectAtoCreateMode = (state: RootState) => state.atoModal.isCreateMode;
export const selectAtoComments = (state: RootState) => state.atoModal.comments;
export const selectAtoPenaltyPoints = (state: RootState) => state.atoModal.penaltyPoints;
export const selectAtoObjectName = (state: RootState) => state.atoModal.objectName;
export const selectSelectedComments = (state: RootState) => state.atoModal.selectedComments;
export const selectSelectedCommentTexts = (state: RootState) => state.atoModal.selectedCommentTexts;
export const selectAtoScorePercentage = (state: RootState) => state.atoModal.scorePercentage;
export const selectAtoMaxPoints = (state: RootState) => state.atoModal.maxPoints;
export const selectAtoEarnedPoints = (state: RootState) => state.atoModal.earnedPoints;
export const selectIsAtoSelectionValid = (state: RootState) => 
  state.atoModal.selectedComments.length > 0 || state.atoModal.selectedCommentTexts.length > 0;

// Экспортируем редюсер
export default atoModalSlice.reducer; 