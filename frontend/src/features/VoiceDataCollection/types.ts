/**
 * TypeScript типы для системы сбора голосовых данных
 */

// Категории команд
export type CommandCategory = 'hotword' | 'commands' | 'negative';

// Состояния записи
export type RecordingState = 'idle' | 'countdown' | 'recording' | 'review' | 'uploading' | 'success' | 'error';

// Аудиофайл
export interface AudioFile {
  id: string;
  filename: string;
  category: CommandCategory;
  blob: Blob;
  timestamp: number;
  uploaded: boolean;
}

// Команда для записи
export interface RecordingCommand {
  id: string;
  text: string;
  category: CommandCategory;
  instruction?: string | string[]; // Инструкция для озвучивания (показывается перед записью). Может быть строкой или массивом вариантов
}

// Получить случайную инструкцию из команды (30% каждый вариант, 10% без инструкции)
export const getRandomInstruction = (command: RecordingCommand): string | undefined => {
  if (!command.instruction) {
    return undefined;
  }
  
  // Если это массив вариантов
  if (Array.isArray(command.instruction)) {
    const random = Math.random();
    if (random < 0.3) {
      return command.instruction[0];
    } else if (random < 0.6) {
      return command.instruction[1];
    } else if (random < 0.9) {
      return command.instruction[2];
    } else {
      // 10% - без инструкции
      return undefined;
    }
  }
  
  // Если это строка, применяем ту же логику
  const random = Math.random();
  if (random < 0.9) {
    return command.instruction;
  } else {
    // 10% - без инструкции
    return undefined;
  }
};

// Прогресс пользователя
export interface UserProgress {
  userId: string;
  username: string;
  totalRecordings: number;
  categories: {
    hotword: number;
    commands: number;
    negative: number;
  };
  lastActivity: string;
  welcomeShown: boolean;
}

// Участник лидерборда
export interface LeaderboardEntry {
  userId: string;
  username: string;
  recordingsCount: number;
  rank: number;
  isCurrentUser: boolean;
}

// Конфигурация аудио
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  mimeType: string;
  maxDuration: number; // в миллисекундах
}

