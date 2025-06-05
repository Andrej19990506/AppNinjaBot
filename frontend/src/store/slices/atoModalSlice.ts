import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../shared/store/store';

// Типы для комментариев АТО
export interface AtoComment {
  title: string;
  text: string;
  penaltyPoints?: number; // Добавляем штрафные баллы для комментария
  photos?: string[];
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
  allPhotos?: string[]; // Добавляем поле для хранения всех фотографий события
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
  earnedPoints: undefined,
  allPhotos: [], // Инициализируем пустым массивом
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
      allPhotos?: string[]; // Добавляем в параметры action
    }>) => {
      state.isOpen = true;
      state.isCreateMode = false;
      state.comments = action.payload.comments;
      state.penaltyPoints = action.payload.penaltyPoints;
      state.objectName = action.payload.objectName;
      state.scorePercentage = action.payload.scorePercentage; // Устанавливаем процент
      state.maxPoints = action.payload.maxPoints; // Устанавливаем макс. баллы
      state.earnedPoints = action.payload.earnedPoints; // Устанавливаем набранные баллы
      state.allPhotos = action.payload.allPhotos || []; // Сохраняем в state
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
export const selectAtoModalOpen = (state: RootState): boolean => state.atoModal.isOpen;
export const selectAtoCreateMode = (state: RootState): boolean => state.atoModal.isCreateMode;
export const selectAtoComments = (state: RootState): AtoComment[] => state.atoModal.comments;
export const selectAtoPenaltyPoints = (state: RootState): number | undefined => state.atoModal.penaltyPoints;
export const selectAtoObjectName = (state: RootState): string | undefined => state.atoModal.objectName;
export const selectSelectedComments = (state: RootState) => state.atoModal.selectedComments;
export const selectSelectedCommentTexts = (state: RootState) => state.atoModal.selectedCommentTexts;
export const selectAtoScorePercentage = (state: RootState): number | undefined => state.atoModal.scorePercentage;
export const selectAtoMaxPoints = (state: RootState): number | undefined => state.atoModal.maxPoints;
export const selectAtoEarnedPoints = (state: RootState): number | undefined => state.atoModal.earnedPoints;
export const selectAtoAllPhotos = (state: RootState): string[] | undefined => state.atoModal.allPhotos;
export const selectIsAtoSelectionValid = (state: RootState) => 
  state.atoModal.selectedComments.length > 0 || state.atoModal.selectedCommentTexts.length > 0;

// Экспортируем редюсер
export default atoModalSlice.reducer; 