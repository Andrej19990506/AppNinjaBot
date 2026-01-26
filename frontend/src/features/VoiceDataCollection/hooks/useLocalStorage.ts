/**
 * Хук для работы с localStorage
 */

import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants';
import { UserProgress } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const useLocalStorage = () => {
  // Получить или создать userId
  const getUserId = (): string => {
    let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!userId) {
      userId = `user_${uuidv4()}`;
      localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    }
    return userId;
  };

  // Получить прогресс пользователя
  const getProgress = (): UserProgress => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_PROGRESS);
    if (stored) {
      return JSON.parse(stored);
    }

    // Создать новый прогресс
    const newProgress: UserProgress = {
      userId: getUserId(),
      username: 'Участник', // Можно будет изменить
      totalRecordings: 0,
      categories: {
        hotword: 0,
        commands: 0,
        negative: 0,
      },
      lastActivity: new Date().toISOString(),
      welcomeShown: false,
    };

    localStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(newProgress));
    return newProgress;
  };

  // Сохранить прогресс
  const saveProgress = (progress: UserProgress) => {
    localStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(progress));
  };

  // Обновить прогресс после записи
  const updateProgress = (category: 'hotword' | 'commands' | 'negative') => {
    const progress = getProgress();
    progress.categories[category]++;
    progress.totalRecordings++;
    progress.lastActivity = new Date().toISOString();
    saveProgress(progress);
    return progress;
  };

  // Проверить, показывалось ли приветствие
  const isWelcomeShown = (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.WELCOME_SHOWN) === 'true';
  };

  // Отметить приветствие как показанное
  const markWelcomeAsShown = () => {
    localStorage.setItem(STORAGE_KEYS.WELCOME_SHOWN, 'true');
    const progress = getProgress();
    progress.welcomeShown = true;
    saveProgress(progress);
  };

  // Сбросить прогресс (для тестирования)
  const resetProgress = () => {
    localStorage.removeItem(STORAGE_KEYS.USER_PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.WELCOME_SHOWN);
    localStorage.removeItem(STORAGE_KEYS.PENDING_UPLOADS);
  };

  return {
    getUserId,
    getProgress,
    saveProgress,
    updateProgress,
    isWelcomeShown,
    markWelcomeAsShown,
    resetProgress,
  };
};



