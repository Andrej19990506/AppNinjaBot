/**
 * Модальное окно для записи аудио (Drawer снизу)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Drawer,
  Button,
  Typography,
  Box,
  LinearProgress,
  IconButton,
  Alert,
  CircularProgress,
  useTheme as useMuiTheme,
} from '@mui/material';
import { Close, Mic, Stop, CheckCircle, Error as ErrorIcon, ArrowForward } from '@mui/icons-material';
import Confetti from 'react-confetti';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useVoiceContestSync } from '../hooks/useVoiceContestSync';
import { getBalancedRandomCommand } from '../constants';
import { RecordingCommand, RecordingState, getRandomInstruction } from '../types';
import { getCurrentUserId } from '../utils/getUserId';
import { RecordingType } from '../services/voiceContestApi';
import { useTheme } from '../../../contexts/ThemeContext';
import { uploadAudioToYandexDisk, checkYandexDiskConnection } from '../services/yandexDiskService';

interface RecordingModalProps {
  open: boolean;
  onClose: () => void;
}

const RecordingModal: React.FC<RecordingModalProps> = ({ open, onClose }) => {

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [currentCommand, setCurrentCommand] = useState<RecordingCommand | null>(null);
  const [currentInstruction, setCurrentInstruction] = useState<string | undefined>(undefined);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Защита от повторных вызовов
  const isUploadingRef = useRef(false);
  
  // Отслеживание использованных команд для гарантии, что все команды будут озвучены
  const [usedCommandIds, setUsedCommandIds] = useState<Set<string>>(new Set());
  
  // Загрузить использованные команды из localStorage
  useEffect(() => {
    const stored = localStorage.getItem('voice_contest_used_commands');
    if (stored) {
      try {
        const ids = JSON.parse(stored) as string[];
        setUsedCommandIds(new Set(ids));
      } catch (e) {
        console.warn('Не удалось загрузить использованные команды из localStorage');
      }
    }
  }, []);
  
  // Сохранить использованные команды в localStorage
  const saveUsedCommands = useCallback((ids: Set<string>) => {
    localStorage.setItem('voice_contest_used_commands', JSON.stringify(Array.from(ids)));
  }, []);

  // Размер окна для конфетти
  const [windowSize, setWindowSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 0, 
    height: typeof window !== 'undefined' ? window.innerHeight : 0 
  });

  // Отслеживание размера окна для конфетти
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Получаем user_id
  const userId = getCurrentUserId();
  
  // Получаем тему
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Цвета для темной/светлой темы
  const colors = {
    background: isDark ? '#1E1E1E' : '#ffffff',
    cardBg: isDark ? '#2A2A2A' : '#f8fafc',
    textPrimary: isDark ? '#E0E0E0' : '#1e293b',
    textSecondary: isDark ? '#A0A0A0' : '#64748b',
    border: isDark ? '#404040' : '#e2e8f0',
    swipeIndicator: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    commandBg: isDark ? '#1E1E1E' : '#ffffff',
    commandBorder: isDark ? '#333333' : '#e2e8f0',
    recordingBg: isDark ? '#2A1515' : '#fef2f2',
    recordingBorder: isDark ? '#7f1d1d' : '#ef4444',
    closeBg: isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9',
    closeHover: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0',
    closeColor: isDark ? '#A0A0A0' : '#64748b',
  };

  // Используем серверную синхронизацию вместо localStorage
  const { 
    stats, 
    recordAudio, 
    isRegistered,
    isLoading: isSyncLoading,
    error: syncError,
    refresh: refreshStats,
    fetchProgress
  } = useVoiceContestSync({
    userId,
    autoFetch: true,
    fetchInterval: undefined, // Не нужно автообновление в модалке записи
  });

  const {
    isRecording,
    recordingTime,
    audioLevel,
    error: recorderError,
    startRecording,
    stopRecording,
    cancelRecording,
    checkPermissions,
    getLastAudioBlob,
  } = useAudioRecorder();
  
  // Перезаписать аудио
  const handleRetry = useCallback(() => {
    // Останавливаем воспроизведение если играет
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    
    // Освобождаем URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    // Сбрасываем состояние
    setRecordedBlob(null);
    setAudioUrl(null);
    setAudioElement(null);
    setIsPlaying(false);
    setError(null);
    setRecordingState('idle');
  }, [audioElement, audioUrl]);

  const handleStopRecording = useCallback(async () => {
    // Если запись еще идет, останавливаем вручную
    let audioBlob: Blob | null = null;
    if (isRecording) {
      console.log('🔵 [RecordingModal] Ручная остановка записи');
      audioBlob = await stopRecording();
    } else {
      // Запись уже остановлена автоматически, получаем последний blob
      console.log('🟢 [RecordingModal] Обработка автоматически остановленной записи');
      audioBlob = getLastAudioBlob();
    }

    if (audioBlob && currentCommand) {
      // Сохраняем blob для дальнейшей отправки
      setRecordedBlob(audioBlob);
      
      // Создаём URL для прослушивания
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Переходим в режим прослушивания
      setRecordingState('review');
      
      // Автоматически воспроизводим записанное аудио
      const audio = new Audio(url);
      setAudioElement(audio);
      audio.play();
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
      };
    } else {
      setError('Не удалось получить аудио');
      setRecordingState('error');
    }
  }, [isRecording, stopRecording, getLastAudioBlob, currentCommand]);

  // Отслеживаем автоматическую остановку записи
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && recordingState === 'recording') {
      console.log('🔴 [RecordingModal] Обнаружена автоматическая остановка записи');
      // Запись остановлена автоматически, обрабатываем
      handleStopRecording();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, recordingState, handleStopRecording]);

  // Генерировать новую команду при открытии
  useEffect(() => {
    if (open && !currentCommand) {
      // Если stats еще не загружен, используем дефолтные значения
      const progress = stats ? {
        hotword: stats.hotword,
        commands: stats.command,
        negative: stats.negative,
      } : {
        hotword: 0,
        commands: 0,
        negative: 0,
      };
      const newCommand = getBalancedRandomCommand(progress, usedCommandIds);
      setCurrentCommand(newCommand);
      setCurrentInstruction(getRandomInstruction(newCommand));
      setRecordingState('idle');
      setError(null);
    }
  }, [open, stats]); // Убрали currentCommand и usedCommandIds из зависимостей

  // Обновить команду после успешной загрузки
  const successProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    if (recordingState === 'success' && stats && currentCommand) {
      // Проверяем, обработали ли мы уже эту команду
      if (successProcessedRef.current !== currentCommand.id) {
        successProcessedRef.current = currentCommand.id;
        
        // Добавляем текущую команду в список использованных
        setUsedCommandIds(prev => {
          const newUsedIds = new Set(prev);
          newUsedIds.add(currentCommand.id);
          saveUsedCommands(newUsedIds);
          
          const timer = setTimeout(() => {
            const progress = {
              hotword: stats.hotword,
              commands: stats.command,
              negative: stats.negative,
            };
            const newCommand = getBalancedRandomCommand(progress, newUsedIds);
            setCurrentCommand(newCommand);
            setCurrentInstruction(getRandomInstruction(newCommand));
            setRecordingState('idle');
          }, 1500);

          return newUsedIds;
        });
      }
    } else if (recordingState !== 'success') {
      // Сбрасываем флаг когда состояние меняется
      successProcessedRef.current = null;
    }
  }, [recordingState, stats, currentCommand, saveUsedCommands]);

  // Проверить разрешения при открытии
  useEffect(() => {
    if (open) {
      checkPermissions().then((hasPermission) => {
        if (!hasPermission) {
          setError('Необходимо разрешить доступ к микрофону');
        }
      });

      // Проверить токен Яндекс.Диска
      checkYandexDiskConnection().then((isConnected) => {
        if (!isConnected) {
          console.warn('⚠️ [RecordingModal] Яндекс.Диск недоступен - проверьте токен');
        }
      });
    }
  }, [open, checkPermissions]);

  // Обработка ошибок рекордера
  useEffect(() => {
    if (recorderError) {
      setError(recorderError);
      setRecordingState('error');
    }
  }, [recorderError]);

  // Начать фактическую запись
  const handleStartRecording = useCallback(async () => {
    const success = await startRecording();
    if (success) {
      setRecordingState('recording');
    } else {
      setRecordingState('error');
    }
  }, [startRecording]);

  // Отсчет перед записью
  useEffect(() => {
    if (recordingState === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (recordingState === 'countdown' && countdown === 0) {
      handleStartRecording();
    }
  }, [recordingState, countdown, handleStartRecording]);

  // Начать процесс записи (с отсчетом)
  const handleReadyClick = async () => {
    setRecordingState('countdown');
    setCountdown(3);
    setError(null);
  };

  // Завершить запись (дубликат - удаляем)
  const handleStopRecordingOld = async () => {
    // Если запись еще идет, останавливаем вручную
    let audioBlob: Blob | null = null;
    if (isRecording) {
      console.log('🔵 [RecordingModal] Ручная остановка записи');
      audioBlob = await stopRecording();
    } else {
      // Запись уже остановлена автоматически, получаем последний blob
      console.log('🟢 [RecordingModal] Обработка автоматически остановленной записи');
      audioBlob = getLastAudioBlob();
    }

    if (audioBlob && currentCommand) {
      // Сохраняем blob для дальнейшей отправки
      setRecordedBlob(audioBlob);
      
      // Создаём URL для прослушивания
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Переходим в режим прослушивания
      setRecordingState('review');
      
      // Автоматически воспроизводим записанное аудио
      const audio = new Audio(url);
      setAudioElement(audio);
      audio.play();
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
      };
    } else {
      setError('Не удалось получить аудио');
      setRecordingState('error');
    }
  };
  
  // Воспроизвести/остановить аудио
  const handleTogglePlayback = () => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.currentTime = 0;
      audioElement.play();
      setIsPlaying(true);
    }
  };
  
  // Подтвердить и отправить
  const handleConfirmAndSend = async () => {
    if (!recordedBlob || !currentCommand) return;
    
    // Защита от повторных вызовов
    if (isUploadingRef.current) {
      console.warn('⚠️ [RecordingModal] Загрузка уже выполняется, пропускаем');
      return;
    }
    
    isUploadingRef.current = true;
    setRecordingState('uploading');
    setUploadProgress(0);
    
    try {
      // Загрузка на Яндекс.Диск и обновление прогресса - параллельно для скорости
      const categoryType: RecordingType = 
        currentCommand.category === 'commands' ? 'command' : currentCommand.category as RecordingType;
      
      // Загружаем на Яндекс.Диск с отслеживанием прогресса (0-85%)
      const uploadPromise = uploadAudioToYandexDisk(
        recordedBlob,
        userId,
        categoryType,
        currentCommand.text,
        (progress) => {
          // Прогресс загрузки на Яндекс.Диск (0-85%)
          // progress уже от 0 до 100, масштабируем до 0-85
          const scaledProgress = Math.min(85, (progress / 100) * 85);
          console.log(`📊 [Progress] Yandex Disk: ${progress}% -> ${scaledProgress}%`);
          // Используем requestAnimationFrame для плавного обновления UI
          requestAnimationFrame(() => {
            setUploadProgress(scaledProgress);
          });
        }
      );

      // Обновляем прогресс на сервере параллельно (85-100%)
      const serverUpdatePromise = recordAudio(categoryType).then(() => {
        // После обновления на сервере - завершаем прогресс
        // recordAudio уже обновил stats в хуке через setStats
        console.log('✅ [RecordingModal] recordAudio завершен, stats обновлен в хуке');
        setUploadProgress(100);
      }).catch((error) => {
        console.error('❌ [RecordingModal] Ошибка recordAudio:', error);
        throw error;
      });
      
      // Ждем оба процесса
      await Promise.all([uploadPromise, serverUpdatePromise]);

      // recordAudio уже обновил stats в хуке, не нужно вызывать fetchProgress()
      // так как это может перезаписать обновленные данные старыми из БД
      // (если сервер еще не успел обновить БД)
      console.log('✅ [RecordingModal] Загрузка завершена, статистика обновлена через recordAudio');

      setRecordingState('success');

      // Очистка
      if (audioElement) {
        audioElement.pause();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setRecordedBlob(null);
      setAudioUrl(null);
      setAudioElement(null);
      setIsPlaying(false);

      // Команда обновится автоматически через useEffect при изменении stats
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки на Яндекс.Диск');
      setRecordingState('error');
    } finally {
      isUploadingRef.current = false;
    }
  };

  // Пропустить команду
  const handleSkip = () => {
    cancelRecording();
    if (stats) {
      const progress = {
        hotword: stats.hotword,
        commands: stats.command,
        negative: stats.negative,
      };
      const newCommand = getBalancedRandomCommand(progress, usedCommandIds);
      setCurrentCommand(newCommand);
      setCurrentInstruction(getRandomInstruction(newCommand));
    }
    setRecordingState('idle');
    setError(null);
  };

  // Закрыть модалку
  const handleClose = () => {
    if (isRecording) {
      cancelRecording();
    }
    
    // Очистка аудио
    if (audioElement) {
      audioElement.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    setCurrentCommand(null);
    setCurrentInstruction(undefined);
    setRecordingState('idle');
    setError(null);
    setRecordedBlob(null);
    setAudioUrl(null);
    setAudioElement(null);
    setIsPlaying(false);
    onClose();
  };
  
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioUrl, audioElement]);

  // Прогресс пользователя с сервера
  const totalRecordings = stats?.total || 0;
  const percentage = Math.min(100, (totalRecordings / 2500) * 100);
  
  // Проверка регистрации
  useEffect(() => {
    if (!isRegistered && !isSyncLoading) {
      setError('Вы не зарегистрированы в конкурсе. Пожалуйста, закройте и откройте модалку заново.');
    }
  }, [isRegistered, isSyncLoading]);

  return (
    <>
      {/* Фейерверки при достижении цели - рендерится на весь экран */}
      {open && percentage >= 100 && (
        <>
          {/* Основной слой конфетти - много частиц */}
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            numberOfPieces={800}
            recycle={false}
            gravity={0.4}
            initialVelocityY={20}
            initialVelocityX={15}
            tweenDuration={8000}
            colors={['#FF5F1F', '#E64500', '#fbbf24', '#f59e0b', '#FF8B59', '#d97706', '#facc15', '#eab308', '#fde047']}
            confettiSource={{
              x: windowSize.width / 2,
              y: windowSize.height / 2,
              w: 0,
              h: 0,
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          />
          {/* Дополнительный слой - взрыв сверху */}
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            numberOfPieces={300}
            recycle={false}
            gravity={0.5}
            initialVelocityY={25}
            initialVelocityX={20}
            tweenDuration={7000}
            colors={['#FF5F1F', '#E64500', '#fbbf24', '#f59e0b', '#FF8B59', '#d97706', '#facc15']}
            confettiSource={{
              x: windowSize.width / 2,
              y: 100,
              w: windowSize.width,
              h: 0,
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          />
          {/* Третий слой - снизу вверх */}
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            numberOfPieces={200}
            recycle={false}
            gravity={-0.2}
            initialVelocityY={-15}
            initialVelocityX={10}
            tweenDuration={6000}
            colors={['#fbbf24', '#f59e0b', '#facc15', '#eab308', '#fde047']}
            confettiSource={{
              x: windowSize.width / 2,
              y: windowSize.height - 100,
              w: 0,
              h: 0,
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <Drawer
        anchor="bottom"
        open={open}
        onClose={handleClose}
        sx={{
          zIndex: 1400, // Выше чем Dialog
        }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: colors.background,
          color: colors.textPrimary,
          maxHeight: '90vh',
          pb: 2,
          boxShadow: isDark ? '0 -10px 40px rgba(0, 0, 0, 0.5)' : '0 -10px 40px rgba(0, 0, 0, 0.1)',
        },
      }}
      ModalProps={{
        keepMounted: false,
      }}
    >
      <Box sx={{ position: 'relative', p: 3 }}>
        {/* Индикатор свайпа */}
        <Box
          sx={{
            width: 40,
            height: 4,
            bgcolor: colors.swipeIndicator,
            borderRadius: 2,
            mx: 'auto',
            mb: 3,
          }}
        />

        {/* Заголовок */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: colors.textPrimary }}>
                Запись аудио
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                Запишите команду или фразу
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={handleClose}
            disabled={isRecording}
            sx={{ 
              color: colors.closeColor,
              bgcolor: colors.closeBg,
              '&:hover': {
                bgcolor: colors.closeHover,
                color: colors.textPrimary,
              },
              '&.Mui-disabled': {
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                color: isDark ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1',
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Прогресс - упрощенный */}
        <Box sx={{ 
          bgcolor: colors.cardBg, 
          borderRadius: 3, 
          p: 2.5, 
          mb: 3,
          border: `1px solid ${colors.border}`,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 500 }}>
              Ваш прогресс {isSyncLoading && '(загрузка...)'}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#FF5F1F' }}>
              {totalRecordings} / 2500
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: isDark ? '#333333' : '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                background: percentage >= 100 
                  ? 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)' // Золотой градиент для завершения
                  : 'linear-gradient(90deg, #FF5F1F 0%, #E64500 100%)',
                borderRadius: 5,
                boxShadow: percentage >= 100 
                  ? '0 2px 8px rgba(251, 191, 36, 0.5)' 
                  : 'none',
              },
            }}
          />
          {percentage >= 100 && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
              border: '2px solid',
              borderColor: '#fbbf24',
              textAlign: 'center',
            }}>
              <Typography variant="body1" sx={{ 
                color: '#f59e0b', 
                fontWeight: 800,
                fontSize: '1rem',
                mb: 0.5,
              }}>
                🎉🎊🎈 УРА! ЦЕЛЬ ДОСТИГНУТА! 🎈🎊🎉
              </Typography>
              <Typography variant="body2" sx={{ 
                color: '#d97706', 
                fontWeight: 600,
                fontSize: '0.9rem',
              }}>
                🏆 Вы участвуете в розыгрыше призов! 🏆
              </Typography>
            </Box>
          )}
        </Box>

        {/* Текущая команда - показываем только если НЕ в режиме прослушивания */}
        {currentCommand && recordingState !== 'review' && (
          <Box
            sx={{
              bgcolor: recordingState === 'recording' ? colors.recordingBg : colors.cardBg,
              borderRadius: 3,
              p: 3,
              textAlign: 'center',
              border: recordingState === 'recording' 
                ? `2px solid ${colors.recordingBorder}` 
                : `2px solid ${colors.border}`,
              transition: 'all 0.3s ease',
              boxShadow: recordingState === 'recording' 
                ? (isDark ? '0 8px 24px rgba(255, 95, 31, 0.4)' : '0 8px 24px rgba(255, 95, 31, 0.3)')
                : (isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.05)'),
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Фон при записи */}
            {recordingState === 'recording' && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: isDark 
                    ? 'linear-gradient(135deg, rgba(255, 95, 31, 0.08) 0%, rgba(230, 69, 0, 0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(255, 95, 31, 0.05) 0%, rgba(230, 69, 0, 0.05) 100%)',
                  zIndex: 0,
                }}
              />
            )}
            
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="caption" sx={{ 
                display: 'block',
                textTransform: 'uppercase', 
                fontWeight: 800,
                letterSpacing: 1,
                fontSize: '0.75rem',
                color: colors.textPrimary,
                mb: 2,
                opacity: 0.7,
              }}>
                {currentCommand.category === 'hotword' && 'Хотворд'}
                {currentCommand.category === 'commands' && 'Команда'}
                {currentCommand.category === 'negative' && 'Негативный пример'}
              </Typography>
              
              {/* Инструкция по озвучиванию */}
              {currentInstruction && (recordingState === 'idle' || recordingState === 'countdown') && (
                <Box sx={{
                  mb: 2,
                  p: 2,
                  bgcolor: isDark ? 'rgba(255, 95, 31, 0.1)' : 'rgba(255, 95, 31, 0.08)',
                  borderRadius: 2,
                  border: `1px solid ${isDark ? 'rgba(255, 95, 31, 0.2)' : 'rgba(255, 95, 31, 0.15)'}`,
                }}>
                  <Typography variant="body2" sx={{
                    color: colors.textPrimary,
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    opacity: 0.9,
                  }}>
                    💡 {currentInstruction}
                  </Typography>
                </Box>
              )}
              
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: colors.textPrimary,
                  mb: recordingState === 'recording' ? 2 : 0,
                  lineHeight: 1.3,
                  fontSize: '1.75rem',
                }}
              >
                "{currentCommand.text}"
              </Typography>
            </Box>

            {/* Визуализация звука */}
            {recordingState === 'recording' && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'flex-end', 
                gap: 0.6, 
                height: 56, 
                mb: 2,
                mt: 2.5,
                overflow: 'hidden',
              }}>
                {[...Array(25)].map((_, i) => {
                  const progress = i / 25;
                  const wavePattern = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
                  const baseHeight = 8 + wavePattern * 8;
                  const peakHeight = 16 + wavePattern * 40;
                  const currentHeight = Math.max(baseHeight, Math.min(peakHeight, audioLevel * (0.5 + Math.random() * 0.5)));
                  
                  return (
                    <Box
                      key={i}
                      sx={{
                        flex: 1,
                        minWidth: 3,
                        maxWidth: 6,
                        height: `${currentHeight}px`,
                        background: 'linear-gradient(180deg, #FF8B59 0%, #FF5F1F 50%, #E64500 100%)',
                        borderRadius: '3px',
                        transition: 'height 0.15s ease',
                        boxShadow: '0 2px 8px rgba(255, 95, 31, 0.3)',
                        animation: `pulse ${0.8 + (progress * 0.4)}s ease-in-out infinite alternate`,
                        '@keyframes pulse': {
                          '0%': { opacity: 0.7 },
                          '100%': { opacity: 1 },
                        },
                      }}
                    />
                  );
                })}
              </Box>
            )}

            {/* Таймер записи */}
            {recordingState === 'recording' && (
              <Box sx={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                px: 2,
                py: 0.75,
                borderRadius: 2,
                border: `2px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca'}`,
              }}>
                <Box sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#ef4444',
                  animation: 'blink 1s ease-in-out infinite',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)',
                  '@keyframes blink': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                  },
                }} />
                <Typography variant="body1" sx={{ 
                  color: '#ef4444', 
                  fontWeight: 700, 
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '1rem',
                }}>
                  {recordingTime}s / 5s
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Состояние отсчета */}
        {recordingState === 'countdown' && (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4, 
            mb: 3,
            bgcolor: colors.cardBg,
            borderRadius: 3,
            border: `2px solid ${colors.border}`,
            boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Фоновый эффект */}
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(255, 95, 31, ${countdown === 1 ? 0.15 : countdown === 2 ? 0.1 : 0.05}), transparent)`,
              transition: 'all 0.3s ease',
              zIndex: 0,
            }} />
            
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography 
                variant="h1" 
                sx={{ 
                  fontWeight: 800, 
                  background: 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '4.5rem',
                  lineHeight: 1,
                  mb: 1.5,
                  animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '@keyframes scaleIn': {
                    '0%': { transform: 'scale(0.5)', opacity: 0 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }}
              >
                {countdown}
              </Typography>
              <Typography variant="body1" sx={{ 
                color: colors.textSecondary, 
                fontWeight: 600,
                fontSize: '0.95rem',
                letterSpacing: 0.5,
              }}>
                Приготовьтесь...
              </Typography>
            </Box>
          </Box>
        )}

        {recordingState === 'uploading' && (
          <Box sx={{ 
            py: 3, 
            mb: 3,
            bgcolor: colors.cardBg,
            borderRadius: 3,
            border: `2px solid ${colors.border}`,
            boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
            px: 3,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              {/* Лоадер слева */}
              <CircularProgress 
                size={32} 
                thickness={4}
                sx={{ 
                  color: '#FF5F1F',
                  flexShrink: 0,
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }} 
              />
              
              {/* Текст и прогресс */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ 
                  color: colors.textPrimary, 
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  mb: 1,
                }}>
                  Загрузка аудио на Яндекс.Диск...
                </Typography>
                
                {/* Прогресс-бар */}
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: isDark ? '#333333' : '#e2e8f0',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #FF5F1F 0%, #E64500 100%)',
                      borderRadius: 4,
                      transition: 'transform 0.3s ease',
                    },
                  }}
                />
                
                {/* Процент */}
                <Typography variant="caption" sx={{ 
                  color: colors.textSecondary,
                  fontSize: '0.75rem',
                  mt: 0.5,
                  display: 'block',
                  textAlign: 'right',
                  fontWeight: 600,
                }}>
                  {Math.round(uploadProgress)}%
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {recordingState === 'success' && (
          <Alert
            icon={<CheckCircle fontSize="medium" />}
            severity="success"
            sx={{
              fontSize: '0.95rem',
              py: 2,
              mb: 3,
              bgcolor: isDark ? 'rgba(255, 95, 31, 0.12)' : 'rgba(255, 95, 31, 0.08)',
              color: isDark ? '#FF8B59' : '#E64500',
              border: isDark ? '2px solid rgba(255, 95, 31, 0.3)' : '2px solid rgba(255, 95, 31, 0.2)',
              borderRadius: 2,
              '& .MuiAlert-icon': {
                color: '#FF5F1F',
              },
            }}
          >
            <strong>Отлично!</strong> Аудио успешно загружено
          </Alert>
        )}

        {recordingState === 'error' && error && (
          <Alert
            icon={<ErrorIcon fontSize="large" />}
            severity="error"
            sx={{
              fontSize: '1rem',
              mb: 3,
              bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
              color: isDark ? '#fca5a5' : '#dc2626',
              border: isDark ? '2px solid rgba(239, 68, 68, 0.3)' : '2px solid #fecaca',
              borderRadius: 3,
              '& .MuiAlert-icon': {
                color: '#ef4444',
              },
            }}
          >
            <strong>Ошибка:</strong> {error}
          </Alert>
        )}

        {/* Плеер для прослушивания (состояние review) - профессиональный дизайн */}
        {recordingState === 'review' && currentCommand && (
          <Box sx={{ mb: 3 }}>
            {/* Карточка плеера */}
            <Box sx={{ 
              bgcolor: isDark ? '#2A2A2A' : '#F8FAFC',
              borderRadius: '24px',
              p: 3,
              border: `2px solid ${isDark ? '#3A3A3A' : '#E2E8F0'}`,
              boxShadow: isDark 
                ? '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)' 
                : '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
              position: 'relative',
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: isDark ? '#4A4A4A' : '#CBD5E1',
                boxShadow: isDark 
                  ? '0 12px 32px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)' 
                  : '0 12px 32px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.06)',
              },
            }}>
              {/* Лейбл с командой - компактный */}
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2.5,
                pb: 2,
                borderBottom: `1px solid ${isDark ? '#3A3A3A' : '#E2E8F0'}`,
              }}>
                <Typography variant="caption" sx={{ 
                  color: colors.textPrimary,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  opacity: 0.7,
                }}>
                  {currentCommand.category === 'hotword' && 'Хотворд'}
                  {currentCommand.category === 'commands' && 'Команда'}
                  {currentCommand.category === 'negative' && 'Негативный пример'}
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: colors.textPrimary,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  "{currentCommand.text}"
                </Typography>
              </Box>

              {/* Основной плеер */}
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                bgcolor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.9)',
                borderRadius: '20px',
                p: 2,
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                boxShadow: isDark 
                  ? 'inset 0 2px 8px rgba(0, 0, 0, 0.3)' 
                  : 'inset 0 2px 8px rgba(0, 0, 0, 0.03)',
                overflow: 'hidden',
              }}>
                {/* Кнопка play/pause */}
                <IconButton
                  onClick={handleTogglePlayback}
                  sx={{
                    width: 52,
                    height: 52,
                    background: 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                    },
                    '&:hover': {
                      background: 'linear-gradient(135deg, #E64500 0%, #CC3D00 100%)',
                      transform: 'scale(1.08)',
                      boxShadow: isDark 
                        ? '0 6px 20px rgba(255, 95, 31, 0.7)' 
                        : '0 6px 20px rgba(255, 95, 31, 0.5)',
                    },
                    '&:hover::before': {
                      opacity: 1,
                    },
                    '&:active': {
                      transform: 'scale(1.02)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isDark 
                      ? '0 4px 16px rgba(255, 95, 31, 0.6)' 
                      : '0 4px 16px rgba(255, 95, 31, 0.4)',
                  }}
                >
                  {isPlaying ? (
                    <Stop sx={{ fontSize: 28, color: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
                  ) : (
                    <Mic sx={{ fontSize: 28, color: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
                  )}
                </IconButton>

                {/* Волновая визуализация */}
                <Box sx={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.6, 
                  height: 48,
                  position: 'relative',
                  px: 0.5,
                }}>
                  {[...Array(35)].map((_, i) => {
                    // Создаем органичную волновую форму
                    const progress = i / 35;
                    const wavePattern = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
                    const baseHeight = 8 + wavePattern * 12;
                    const peakHeight = 16 + wavePattern * 32;
                    
                    return (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          minWidth: 2,
                          height: isPlaying ? `${peakHeight}px` : `${baseHeight}px`,
                          background: isPlaying 
                            ? 'linear-gradient(180deg, #FF8B59 0%, #FF5F1F 50%, #E64500 100%)'
                            : 'linear-gradient(180deg, #FF5F1F 0%, #E64500 100%)',
                          borderRadius: '4px',
                          transition: isPlaying ? 'none' : 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          opacity: isPlaying ? 1 : 0.6,
                          boxShadow: isPlaying 
                            ? `0 0 8px rgba(255, 95, 31, ${0.3 + wavePattern * 0.4})`
                            : 'none',
                          animation: isPlaying 
                            ? `smoothWave ${1.2 + (progress * 0.8)}s ease-in-out infinite alternate ${progress * 0.2}s`
                            : 'none',
                          '@keyframes smoothWave': {
                            '0%': { 
                              height: `${baseHeight}px`,
                              opacity: 0.7,
                            },
                            '50%': { 
                              height: `${peakHeight}px`,
                              opacity: 1,
                            },
                            '100%': { 
                              height: `${baseHeight + (peakHeight - baseHeight) * 0.7}px`,
                              opacity: 0.85,
                            },
                          },
                        }}
                      />
                    );
                  })}
                </Box>

                {/* Время */}
                <Box sx={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                }}>
                  <Typography sx={{ 
                    color: colors.textPrimary,
                    fontSize: '1rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 40,
                    textAlign: 'center',
                    lineHeight: 1,
                  }}>
                    0:05
                  </Typography>
                  <Box sx={{ 
                    width: 32,
                    height: 2,
                    bgcolor: isPlaying ? '#FF5F1F' : colors.border,
                    borderRadius: 1,
                    transition: 'all 0.3s ease',
                  }} />
                </Box>
              </Box>

              {/* Статус воспроизведения */}
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                mt: 2.5,
                pt: 2,
                borderTop: `1px solid ${isDark ? '#3A3A3A' : '#E2E8F0'}`,
              }}>
                <Box sx={{ 
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: isPlaying ? '#FF5F1F' : colors.textSecondary,
                  animation: isPlaying ? 'blink 1.5s ease-in-out infinite' : 'none',
                  boxShadow: isPlaying ? '0 0 12px rgba(255, 95, 31, 0.6)' : 'none',
                  transition: 'all 0.3s ease',
                  '@keyframes blink': {
                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.4, transform: 'scale(0.9)' },
                  },
                }} />
                <Typography variant="caption" sx={{ 
                  color: isPlaying ? '#FF5F1F' : colors.textSecondary,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  transition: 'color 0.3s ease',
                }}>
                  {isPlaying ? 'Воспроизведение...' : 'Нажмите для прослушивания'}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Кнопки управления */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, position: 'relative', width: '100%' }}>
          {recordingState === 'idle' && (
            <>
              {/* Круглая кнопка "Готов" с пульсацией - строго по центру */}
              <Button
                className="readyBtn"
                variant="contained"
                onClick={handleReadyClick}
                sx={{
                  width: 64,
                  height: 64,
                  minWidth: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'visible',
                  boxShadow: isDark 
                    ? '0 4px 12px rgba(255, 95, 31, 0.4)' 
                    : '0 4px 12px rgba(255, 95, 31, 0.3)',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': {
                      boxShadow: isDark 
                        ? '0 4px 12px rgba(255, 95, 31, 0.4), 0 0 0 0 rgba(255, 95, 31, 0.4)' 
                        : '0 4px 12px rgba(255, 95, 31, 0.3), 0 0 0 0 rgba(255, 95, 31, 0.3)',
                    },
                    '50%': {
                      boxShadow: isDark 
                        ? '0 4px 12px rgba(255, 95, 31, 0.4), 0 0 0 8px rgba(255, 95, 31, 0)' 
                        : '0 4px 12px rgba(255, 95, 31, 0.3), 0 0 0 8px rgba(255, 95, 31, 0)',
                    },
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    borderRadius: '50%',
                  },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #E64500 0%, #CC3D00 100%)',
                    boxShadow: isDark 
                      ? '0 6px 16px rgba(255, 95, 31, 0.5)' 
                      : '0 6px 16px rgba(255, 95, 31, 0.4)',
                    transform: 'translateY(-1px) scale(1.05)',
                    animation: 'none', // Отключаем пульсацию при hover
                  },
                  '&:hover::before': {
                    opacity: 1,
                  },
                  '&:active': {
                    transform: 'translateY(0px) scale(1)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <Mic sx={{ fontSize: 28, color: 'white' }} />
              </Button>

              {/* Иконка "Пропустить" справа от кнопки "Готов" - абсолютное позиционирование */}
              <IconButton
                onClick={handleSkip}
                sx={{
                  width: 48,
                  height: 48,
                  color: colors.textSecondary,
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                  border: `2px solid ${colors.border}`,
                  borderRadius: '50%',
                  position: 'absolute',
                  left: 'calc(50% + 48px)', // 50% (центр) + половина ширины кнопки "Готов" (32px) + отступ (16px)
                  transform: 'translateX(0)',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                    borderColor: isDark ? '#595959' : '#94a3b8',
                    color: colors.textPrimary,
                    transform: 'translateX(0) scale(1.1)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <ArrowForward sx={{ fontSize: 24 }} />
              </IconButton>
            </>
          )}

          {recordingState === 'recording' && (
            <Button
              variant="contained"
              onClick={handleStopRecording}
              fullWidth
              startIcon={<Stop sx={{ fontSize: 20 }} />}
              sx={{
                py: 1.5,
                fontSize: '0.95rem',
                fontWeight: 600,
                bgcolor: '#ef4444',
                color: 'white',
                borderRadius: 2,
                textTransform: 'none',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(239, 68, 68, 0.4)' 
                  : '0 4px 12px rgba(239, 68, 68, 0.3)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                  opacity: 0,
                  transition: 'opacity 0.3s ease',
                },
                '&:hover': {
                  bgcolor: '#dc2626',
                  boxShadow: isDark 
                    ? '0 6px 16px rgba(239, 68, 68, 0.5)' 
                    : '0 6px 16px rgba(239, 68, 68, 0.4)',
                  transform: 'translateY(-1px)',
                },
                '&:hover::before': {
                  opacity: 1,
                },
                '&:active': {
                  transform: 'translateY(0px)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Остановить
            </Button>
          )}

          {recordingState === 'review' && (
            <>
              <Button
                variant="outlined"
                onClick={handleRetry}
                fullWidth
                sx={{
                  py: 1.25,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: colors.textSecondary,
                  borderColor: colors.border,
                  borderWidth: 2,
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: isDark ? '#595959' : '#94a3b8',
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                    borderWidth: 2,
                    color: colors.textPrimary,
                  },
                }}
              >
                Перезаписать
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmAndSend}
                fullWidth
                sx={{
                  py: 1.25,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
                  color: 'white',
                  borderRadius: 2,
                  textTransform: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isDark 
                    ? '0 4px 12px rgba(255, 95, 31, 0.4)' 
                    : '0 4px 12px rgba(255, 95, 31, 0.3)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                  },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #E64500 0%, #CC3D00 100%)',
                    boxShadow: isDark 
                      ? '0 6px 16px rgba(255, 95, 31, 0.5)' 
                      : '0 6px 16px rgba(255, 95, 31, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  '&:hover::before': {
                    opacity: 1,
                  },
                  '&:active': {
                    transform: 'translateY(0px)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Далее
              </Button>
            </>
          )}

          {recordingState === 'error' && (
            <Button
              variant="contained"
              onClick={handleSkip}
              fullWidth
              sx={{
                py: 1.25,
                fontSize: '0.95rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #FF5F1F 0%, #E64500 100%)',
                color: 'white',
                borderRadius: 2,
                textTransform: 'none',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(255, 95, 31, 0.4)' 
                  : '0 4px 12px rgba(255, 95, 31, 0.3)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                  opacity: 0,
                  transition: 'opacity 0.3s ease',
                },
                '&:hover': {
                  background: 'linear-gradient(135deg, #E64500 0%, #CC3D00 100%)',
                  boxShadow: isDark 
                    ? '0 6px 16px rgba(255, 95, 31, 0.5)' 
                    : '0 6px 16px rgba(255, 95, 31, 0.4)',
                  transform: 'translateY(-1px)',
                },
                '&:hover::before': {
                  opacity: 1,
                },
                '&:active': {
                  transform: 'translateY(0px)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Попробовать снова
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
    </>
  );
};

export default RecordingModal;

