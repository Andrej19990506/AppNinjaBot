/**
 * API сервис для голосового конкурса
 * Синхронизация прогресса с сервером
 */

import axios from 'axios';

// API_BASE_URL может уже содержать /api, поэтому добавляем только /v1/voice-contest
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const VOICE_CONTEST_API = `${API_BASE_URL}/v1/voice-contest`;

// ============================================================================
// ТИПЫ
// ============================================================================

export interface VoiceContestStats {
  total: number;
  hotword: number;
  command: number;
  negative: number;
  progress_percentage: number;
  daily_average: number;
  last_recording_at: string | null;
}

export interface VoiceContestParticipant {
  id: number;
  user_id: number;
  user_name: string;
  result_score: number;
  ranking_position: number | null;
  stats: VoiceContestStats;
  registered_at: string;
}

export interface LeaderboardEntry {
  position: number;
  user_id: number;
  user_name: string;
  total_recordings: number;
  hotword_count: number;
  command_count: number;
  negative_count: number;
  progress_percentage: number;
}

export interface VoiceContestLeaderboard {
  competition_id: number;
  total_participants: number;
  leaderboard: LeaderboardEntry[];
}

export interface GlobalStats {
  competition_id: number;
  total_participants: number;
  qualified_participants: number;
  target_per_participant: number;
  total_recordings: number;
  hotword_recordings: number;
  command_recordings: number;
  negative_recordings: number;
  distribution: {
    hotword_percentage: number;
    command_percentage: number;
    negative_percentage: number;
  };
}

export type RecordingType = 'hotword' | 'command' | 'negative';

// ============================================================================
// API ФУНКЦИИ
// ============================================================================

/**
 * Регистрация участника в конкурсе
 */
export const registerParticipant = async (
  userId: number,
  firstName: string,
  lastName: string
): Promise<VoiceContestParticipant> => {
  try {
    console.log(`📝 [VoiceContestAPI] Регистрация участника: ${firstName} ${lastName} (ID: ${userId})`);
    
    const response = await axios.post<VoiceContestParticipant>(
      `${VOICE_CONTEST_API}/register`,
      {
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
      }
    );
    
    console.log('✅ [VoiceContestAPI] Участник зарегистрирован:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ [VoiceContestAPI] Ошибка регистрации:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Получить прогресс участника
 */
export const getProgress = async (userId: number): Promise<VoiceContestParticipant> => {
  try {
    console.log(`📊 [VoiceContestAPI] Получение прогресса для user_id: ${userId}`);
    
    const response = await axios.get<VoiceContestParticipant>(
      `${VOICE_CONTEST_API}/progress/${userId}`
    );
    
    console.log('✅ [VoiceContestAPI] Прогресс получен:', response.data);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn('⚠️ [VoiceContestAPI] Участник не найден');
    } else {
      console.error('❌ [VoiceContestAPI] Ошибка получения прогресса:', error.response?.data || error.message);
    }
    throw error;
  }
};

/**
 * Обновить прогресс после записи аудио
 */
export const updateProgress = async (
  userId: number,
  recordingType: RecordingType,
  increment: number = 1
): Promise<VoiceContestParticipant> => {
  try {
    console.log(`⬆️ [VoiceContestAPI] Обновление прогресса: user_id=${userId}, type=${recordingType}, +${increment}`);
    
    const response = await axios.patch<VoiceContestParticipant>(
      `${VOICE_CONTEST_API}/progress/${userId}`,
      {
        recording_type: recordingType,
        increment: increment,
      }
    );
    
    console.log('✅ [VoiceContestAPI] Прогресс обновлен:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ [VoiceContestAPI] Ошибка обновления прогресса:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Получить лидерборд
 */
export const getLeaderboard = async (limit: number = 100): Promise<VoiceContestLeaderboard> => {
  try {
    console.log(`🏆 [VoiceContestAPI] Получение лидерборда (limit: ${limit})`);
    
    const response = await axios.get<VoiceContestLeaderboard>(
      `${VOICE_CONTEST_API}/leaderboard`,
      { params: { limit } }
    );
    
    console.log('✅ [VoiceContestAPI] Лидерборд получен:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ [VoiceContestAPI] Ошибка получения лидерборда:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Получить глобальную статистику конкурса
 */
export const getGlobalStats = async (): Promise<GlobalStats> => {
  try {
    console.log('📈 [VoiceContestAPI] Получение глобальной статистики');
    
    const response = await axios.get<GlobalStats>(
      `${VOICE_CONTEST_API}/stats/global`
    );
    
    console.log('✅ [VoiceContestAPI] Статистика получена:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ [VoiceContestAPI] Ошибка получения статистики:', error.response?.data || error.message);
    throw error;
  }
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Проверить, зарегистрирован ли участник
 */
export const isParticipantRegistered = async (userId: number): Promise<boolean> => {
  try {
    await getProgress(userId);
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * Получить или зарегистрировать участника
 */
export const getOrRegisterParticipant = async (
  userId: number,
  firstName: string,
  lastName: string
): Promise<VoiceContestParticipant> => {
  try {
    // Сначала пытаемся получить прогресс
    return await getProgress(userId);
  } catch (error: any) {
    if (error.response?.status === 404) {
      // Если не найден - регистрируем
      return await registerParticipant(userId, firstName, lastName);
    }
    throw error;
  }
};

/**
 * Получить позицию в рейтинге по числу записей
 */
export const getRankingPosition = async (userId: number): Promise<number | null> => {
  try {
    const participant = await getProgress(userId);
    return participant.ranking_position;
  } catch (error) {
    return null;
  }
};

/**
 * Проверить, выполнено ли условие участия (>= 2500 записей)
 */
export const isQualified = (stats: VoiceContestStats): boolean => {
  return stats.total >= 2500;
};

/**
 * Рассчитать процент выполнения по типам записей
 */
export const calculateTypeDistribution = (stats: VoiceContestStats) => {
  if (stats.total === 0) {
    return { hotword: 0, command: 0, negative: 0 };
  }

  return {
    hotword: Math.round((stats.hotword / stats.total) * 100),
    command: Math.round((stats.command / stats.total) * 100),
    negative: Math.round((stats.negative / stats.total) * 100),
  };
};

/**
 * Получить оставшееся количество записей до цели
 */
export const getRemainingRecordings = (stats: VoiceContestStats, target: number = 2500): number => {
  return Math.max(0, target - stats.total);
};

/**
 * Получить сообщение о прогрессе
 */
export const getProgressMessage = (stats: VoiceContestStats): string => {
  if (stats.total === 0) {
    return 'Начните записывать! 🎤';
  }

  if (stats.total < 2500) {
    const remaining = 2500 - stats.total;
    return `Осталось ${remaining} записей до участия в розыгрыше`;
  }

  return `Цель достигнута! ${stats.total} записей 🎉`;
};

export default {
  registerParticipant,
  getProgress,
  updateProgress,
  getLeaderboard,
  getGlobalStats,
  isParticipantRegistered,
  getOrRegisterParticipant,
  getRankingPosition,
  isQualified,
  calculateTypeDistribution,
  getRemainingRecordings,
  getProgressMessage,
};

