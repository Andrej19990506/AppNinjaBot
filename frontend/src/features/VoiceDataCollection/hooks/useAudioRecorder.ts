/**
 * Хук для работы с MediaRecorder API
 */

import { useState, useRef, useCallback } from 'react';
import { AUDIO_CONFIG } from '../constants';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);

  // Проверка разрешений микрофона
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (result.state === 'denied') {
        setError('Доступ к микрофону запрещен');
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Не удалось проверить разрешения, попробуем запросить напрямую');
      return true; // Попробуем запросить напрямую
    }
  }, []);

  // Визуализация уровня звука
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Вычисляем средний уровень
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 255) * 100));

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // Начать запись
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Проверяем разрешения
      const hasPermission = await checkPermissions();
      if (!hasPermission) return false;

      // Запрашиваем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channels,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Создаем MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Настраиваем анализатор звука
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Обработчики событий
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Ошибка записи аудио');
        stopRecording();
      };

      // Начинаем запись
      mediaRecorder.start(100); // Собираем данные каждые 100ms
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);

      // Таймер записи
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
      }, 1000);

      // Визуализация звука
      updateAudioLevel();

      // Автоматическая остановка через maxDuration
      autoStopTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, AUDIO_CONFIG.maxDuration);

      return true;
    } catch (err: any) {
      console.error('Ошибка при начале записи:', err);
      setError(err.name === 'NotAllowedError' 
        ? 'Доступ к микрофону запрещен' 
        : 'Не удалось начать запись'
      );
      return false;
    }
  }, [checkPermissions, updateAudioLevel]);

  // Остановить запись
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Сохраняем blob в ref для доступа извне
        lastAudioBlobRef.current = audioBlob;
        
        // Очистка
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        setIsRecording(false);
        setAudioLevel(0);
        
        resolve(audioBlob);
      };

      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }
    });
  }, []);

  // Отменить запись
  const cancelRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    setAudioLevel(0);
  }, []);

  // Получить последний записанный blob
  const getLastAudioBlob = useCallback(() => {
    return lastAudioBlobRef.current;
  }, []);

  return {
    isRecording,
    recordingTime,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    checkPermissions,
    getLastAudioBlob,
  };
};


