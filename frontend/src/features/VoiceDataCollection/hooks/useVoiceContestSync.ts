/**
 * React Hook для синхронизации прогресса голосового конкурса с сервером
 * ВАЖНО: Прогресс хранится только на сервере, НЕ в localStorage!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VoiceContestParticipant,
  VoiceContestStats,
  RecordingType,
  getProgress,
  updateProgress,
  registerParticipant,
  getLeaderboard,
  VoiceContestLeaderboard,
} from '../services/voiceContestApi';

interface UseVoiceContestSyncOptions {
  userId: number;
  autoFetch?: boolean; // Автоматически загружать прогресс при монтировании
  fetchInterval?: number; // Интервал автообновления (в мс), undefined = отключено
}

interface UseVoiceContestSyncResult {
  // Состояние
  stats: VoiceContestStats | null;
  participant: VoiceContestParticipant | null;
  isLoading: boolean;
  error: string | null;
  isRegistered: boolean;
  
  // Действия
  fetchProgress: () => Promise<void>;
  register: (firstName: string, lastName: string) => Promise<void>;
  recordAudio: (type: RecordingType) => Promise<void>;
  refresh: () => Promise<void>;
  
  // Дополнительная информация
  rankingPosition: number | null;
  isQualified: boolean;
  progressPercentage: number;
}

export const useVoiceContestSync = (
  options: UseVoiceContestSyncOptions
): UseVoiceContestSyncResult => {
  const { userId, autoFetch = true, fetchInterval = undefined } = options;

  // Состояние
  const [participant, setParticipant] = useState<VoiceContestParticipant | null>(null);
  const [stats, setStats] = useState<VoiceContestStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);

  // Ref для предотвращения повторных запросов
  const isFetchingRef = useRef<boolean>(false);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Получить прогресс с сервера
   */
  const fetchProgress = useCallback(async () => {
    if (isFetchingRef.current) {
      console.log('🔄 [useVoiceContestSync] Запрос уже выполняется, пропускаем');
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      console.log(`📊 [useVoiceContestSync] Загрузка прогресса для user ${userId}`);

      const data = await getProgress(userId);

      setParticipant(data);
      setStats(data.stats);
      setIsRegistered(true);

      console.log('✅ [useVoiceContestSync] Прогресс загружен:', data.stats);
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.log('⚠️ [useVoiceContestSync] Участник не зарегистрирован');
        setIsRegistered(false);
        setStats(null);
        setParticipant(null);
      } else {
        console.error('❌ [useVoiceContestSync] Ошибка загрузки прогресса:', err);
        setError(err.response?.data?.detail || 'Ошибка загрузки прогресса');
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId]);

  /**
   * Зарегистрировать участника
   */
  const register = useCallback(
    async (firstName: string, lastName: string) => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`📝 [useVoiceContestSync] Регистрация: ${firstName} ${lastName}`);

        const data = await registerParticipant(userId, firstName, lastName);

        setParticipant(data);
        setStats(data.stats);
        setIsRegistered(true);

        console.log('✅ [useVoiceContestSync] Участник зарегистрирован');
      } catch (err: any) {
        console.error('❌ [useVoiceContestSync] Ошибка регистрации:', err);
        setError(err.response?.data?.detail || 'Ошибка регистрации');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  /**
   * Записать аудио и обновить прогресс
   */
  const recordAudio = useCallback(
    async (type: RecordingType) => {
      if (!isRegistered) {
        console.error('❌ [useVoiceContestSync] Участник не зарегистрирован');
        setError('Сначала зарегистрируйтесь');
        return;
      }

      try {
        console.log(`⬆️ [useVoiceContestSync] Обновление прогресса: ${type} +1`);

        const data = await updateProgress(userId, type, 1);

        setParticipant(data);
        setStats(data.stats);

        console.log('✅ [useVoiceContestSync] Прогресс обновлен:', data.stats);
      } catch (err: any) {
        console.error('❌ [useVoiceContestSync] Ошибка обновления прогресса:', err);
        setError(err.response?.data?.detail || 'Ошибка обновления прогресса');
        throw err;
      }
    },
    [userId, isRegistered]
  );

  /**
   * Обновить данные
   */
  const refresh = useCallback(async () => {
    await fetchProgress();
  }, [fetchProgress]);

  /**
   * Автоматическая загрузка при монтировании
   */
  useEffect(() => {
    if (autoFetch && userId) {
      fetchProgress();
    }
  }, [autoFetch, userId, fetchProgress]);

  /**
   * Автоматическое обновление по интервалу
   */
  useEffect(() => {
    if (fetchInterval && fetchInterval > 0 && isRegistered) {
      console.log(`⏰ [useVoiceContestSync] Установлен интервал обновления: ${fetchInterval}ms`);

      intervalIdRef.current = setInterval(() => {
        console.log('🔄 [useVoiceContestSync] Автообновление прогресса');
        fetchProgress();
      }, fetchInterval);

      return () => {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
          console.log('⏹️ [useVoiceContestSync] Интервал обновления остановлен');
        }
      };
    }
  }, [fetchInterval, isRegistered, fetchProgress]);

  /**
   * Вычисляемые значения
   */
  const rankingPosition = participant?.ranking_position || null;
  const isQualified = (stats?.total || 0) >= 2500;
  const progressPercentage = stats?.progress_percentage || 0;

  return {
    // Состояние
    stats,
    participant,
    isLoading,
    error,
    isRegistered,

    // Действия
    fetchProgress,
    register,
    recordAudio,
    refresh,

    // Дополнительная информация
    rankingPosition,
    isQualified,
    progressPercentage,
  };
};

export default useVoiceContestSync;

