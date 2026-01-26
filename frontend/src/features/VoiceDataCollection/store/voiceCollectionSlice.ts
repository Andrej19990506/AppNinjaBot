/**
 * Redux slice для управления состоянием системы сбора данных
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RecordingState, RecordingCommand, UserProgress, LeaderboardEntry } from '../types';

interface VoiceCollectionState {
  // UI состояния
  isWelcomeModalOpen: boolean;
  isRecordingModalOpen: boolean;
  
  // Состояние записи
  recordingState: RecordingState;
  currentCommand: RecordingCommand | null;
  
  // Прогресс
  userProgress: UserProgress | null;
  leaderboard: LeaderboardEntry[];
  
  // Ошибки
  error: string | null;
  
  // Загрузка
  isUploading: boolean;
  uploadProgress: number;
}

const initialState: VoiceCollectionState = {
  isWelcomeModalOpen: false,
  isRecordingModalOpen: false,
  recordingState: 'idle',
  currentCommand: null,
  userProgress: null,
  leaderboard: [],
  error: null,
  isUploading: false,
  uploadProgress: 0,
};

const voiceCollectionSlice = createSlice({
  name: 'voiceCollection',
  initialState,
  reducers: {
    // Модалки
    openWelcomeModal: (state) => {
      state.isWelcomeModalOpen = true;
    },
    closeWelcomeModal: (state) => {
      state.isWelcomeModalOpen = false;
    },
    openRecordingModal: (state) => {
      state.isRecordingModalOpen = true;
    },
    closeRecordingModal: (state) => {
      state.isRecordingModalOpen = false;
      state.recordingState = 'idle';
      state.error = null;
    },
    
    // Состояние записи
    setRecordingState: (state, action: PayloadAction<RecordingState>) => {
      state.recordingState = action.payload;
    },
    setCurrentCommand: (state, action: PayloadAction<RecordingCommand>) => {
      state.currentCommand = action.payload;
    },
    
    // Прогресс
    setUserProgress: (state, action: PayloadAction<UserProgress>) => {
      state.userProgress = action.payload;
    },
    incrementProgress: (state, action: PayloadAction<'hotword' | 'commands' | 'negative'>) => {
      if (state.userProgress) {
        state.userProgress.categories[action.payload]++;
        state.userProgress.totalRecordings++;
        state.userProgress.lastActivity = new Date().toISOString();
      }
    },
    
    // Лидерборд
    setLeaderboard: (state, action: PayloadAction<LeaderboardEntry[]>) => {
      state.leaderboard = action.payload;
    },
    
    // Ошибки
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    
    // Загрузка
    startUpload: (state) => {
      state.isUploading = true;
      state.uploadProgress = 0;
    },
    updateUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    finishUpload: (state) => {
      state.isUploading = false;
      state.uploadProgress = 0;
    },
    
    // Сброс состояния
    resetState: (state) => {
      return initialState;
    },
  },
});

export const {
  openWelcomeModal,
  closeWelcomeModal,
  openRecordingModal,
  closeRecordingModal,
  setRecordingState,
  setCurrentCommand,
  setUserProgress,
  incrementProgress,
  setLeaderboard,
  setError,
  clearError,
  startUpload,
  updateUploadProgress,
  finishUpload,
  resetState,
} = voiceCollectionSlice.actions;

export default voiceCollectionSlice.reducer;



