/**
 * Главный компонент системы сбора голосовых данных
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import WelcomeModal from './components/WelcomeModal';
import FloatingRecordButton from './components/FloatingRecordButton';
import RecordingModal from './components/RecordingModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVoiceContestSync } from './hooks/useVoiceContestSync';
import { getCurrentUserId } from './utils/getUserId';
import { getContestStatus } from './services/voiceContestApi';
import {
  openWelcomeModal,
  closeWelcomeModal,
  openRecordingModal,
  closeRecordingModal,
} from './store/voiceCollectionSlice';
import { RootState } from '../../store';

// Тестовые пользователи, для которых конкурс всегда видимый (независимо от статуса)
const TEST_USER_IDS = [1703407797, 6843570748];

const VoiceDataCollection: React.FC = () => {
  const dispatch = useDispatch();
  const { isWelcomeModalOpen, isRecordingModalOpen, recordingState } = useSelector(
    (state: RootState) => state.voiceCollection
  );

  const [isContestVisible, setIsContestVisible] = useState(false);
  const [isContestLoading, setIsContestLoading] = useState(true);

  const { isWelcomeShown, markWelcomeAsShown } = useLocalStorage();
  
  // Получаем user_id и синхронизируем прогресс с сервером
  const userId = getCurrentUserId();
  const { stats, refresh, fetchProgress } = useVoiceContestSync({
    userId,
    autoFetch: true,
    fetchInterval: 30000, // Обновлять каждые 30 секунд
  });

  // Проверяем статус конкурса при монтировании
  useEffect(() => {
    const checkContestStatus = async () => {
      try {
        setIsContestLoading(true);
        
        // Проверяем, является ли пользователь тестовым
        const isTestUser = TEST_USER_IDS.includes(userId);
        
        if (isTestUser) {
          console.log('🧪 [VoiceDataCollection] Тестовый пользователь, конкурс всегда видимый:', userId);
          setIsContestVisible(true);
          setIsContestLoading(false);
          return;
        }
        
        const contestStatus = await getContestStatus();
        console.log('📊 [VoiceDataCollection] Статус конкурса:', contestStatus);
        
        // Показываем конкурс только если статус не draft
        setIsContestVisible(contestStatus.is_visible);
      } catch (error) {
        console.error('❌ [VoiceDataCollection] Ошибка проверки статуса:', error);
        
        // Для тестовых пользователей показываем конкурс даже при ошибке
        const isTestUser = TEST_USER_IDS.includes(userId);
        if (isTestUser) {
          console.log('🧪 [VoiceDataCollection] Тестовый пользователь, показываем конкурс несмотря на ошибку');
          setIsContestVisible(true);
        } else {
          // В случае ошибки скрываем конкурс для безопасности
          setIsContestVisible(false);
        }
      } finally {
        setIsContestLoading(false);
      }
    };

    checkContestStatus();
  }, [userId]);

  // Проверить при монтировании, показывалось ли приветствие
  useEffect(() => {
    // Показываем приветствие только если конкурс видимый и не загружается
    if (!isContestLoading && isContestVisible && !isWelcomeShown()) {
      // Показать приветствие через 2 секунды после загрузки
      const timer = setTimeout(() => {
        dispatch(openWelcomeModal());
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isContestLoading, isContestVisible]);

  // Обновлять прогресс при закрытии модалки записи
  useEffect(() => {
    if (!isRecordingModalOpen) {
      refresh(); // Обновить прогресс с сервера
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecordingModalOpen]);

  const handleWelcomeStart = () => {
    markWelcomeAsShown();
    dispatch(closeWelcomeModal());
    dispatch(openRecordingModal());
  };

  const handleFloatingButtonClick = () => {
    dispatch(openRecordingModal());
  };

  const handleRecordingModalClose = () => {
    dispatch(closeRecordingModal());
    refresh(); // Обновить прогресс с сервера
  };

  // Не рендерим ничего если:
  // 1. Статус загружается
  // 2. Конкурс не видимый (status === 'draft')
  if (isContestLoading || !isContestVisible) {
    return null;
  }

  return (
    <>
      {/* Приветственное модальное окно */}
      <WelcomeModal
        open={isWelcomeModalOpen}
        onClose={() => dispatch(closeWelcomeModal())}
        onStart={handleWelcomeStart}
      />

      {/* Модальное окно записи */}
      <RecordingModal
        open={isRecordingModalOpen}
        onClose={handleRecordingModalClose}
      />

      {/* Плавающая кнопка */}
      <FloatingRecordButton
        onClick={handleFloatingButtonClick}
        recordingsCount={stats?.total || 0}
        isRecording={recordingState === 'recording'}
      />
    </>
  );
};

export default VoiceDataCollection;

