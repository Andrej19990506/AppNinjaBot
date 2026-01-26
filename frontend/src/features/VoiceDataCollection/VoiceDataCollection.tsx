/**
 * Главный компонент системы сбора голосовых данных
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import WelcomeModal from './components/WelcomeModal';
import FloatingRecordButton from './components/FloatingRecordButton';
import RecordingModal from './components/RecordingModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVoiceContestSync } from './hooks/useVoiceContestSync';
import { getCurrentUserId } from './utils/getUserId';
import {
  openWelcomeModal,
  closeWelcomeModal,
  openRecordingModal,
  closeRecordingModal,
} from './store/voiceCollectionSlice';
import { RootState } from '../../store';

const VoiceDataCollection: React.FC = () => {
  const dispatch = useDispatch();
  const { isWelcomeModalOpen, isRecordingModalOpen, recordingState } = useSelector(
    (state: RootState) => state.voiceCollection
  );

  const { isWelcomeShown, markWelcomeAsShown } = useLocalStorage();
  
  // Получаем user_id и синхронизируем прогресс с сервером
  const userId = getCurrentUserId();
  const { stats, refresh, fetchProgress } = useVoiceContestSync({
    userId,
    autoFetch: true,
    fetchInterval: 30000, // Обновлять каждые 30 секунд
  });

  // Проверить при монтировании, показывалось ли приветствие
  useEffect(() => {
    if (!isWelcomeShown()) {
      // Показать приветствие через 2 секунды после загрузки
      const timer = setTimeout(() => {
        dispatch(openWelcomeModal());
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

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

