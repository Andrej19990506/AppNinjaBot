/**
 * Сервис для работы с Яндекс.Диском
 * Загрузка аудиозаписей в структуру: category/userId/filename.wav
 * WebM конвертируется в WAV перед загрузкой
 */

import axios from 'axios';
import { RecordingType } from './voiceContestApi';

const YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk';

// OAuth токен для Яндекс.Диска (должен быть в .env)
const YANDEX_DISK_TOKEN = (import.meta.env.VITE_YANDEX_DISK_TOKEN || '').trim();

// Отладка: выводим детальную информацию о токене
console.log('🔍 [YandexDisk] Все env переменные:', import.meta.env);
console.log('🔍 [YandexDisk] Токен:', YANDEX_DISK_TOKEN ? `${YANDEX_DISK_TOKEN.substring(0, 20)}... (длина: ${YANDEX_DISK_TOKEN.length})` : 'ПУСТО');
console.log('🔍 [YandexDisk] Токен полностью:', YANDEX_DISK_TOKEN);

// Базовая папка для всех записей
const BASE_FOLDER = 'VoiceRecordings';

// ============================================================================
// ТИПЫ
// ============================================================================

interface UploadUrlResponse {
  href: string;
  method: string;
  templated: boolean;
}

interface FolderCheckResponse {
  type: 'dir' | 'file';
  path: string;
  created: string;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Конвертировать WebM аудио в WAV формат
 * @param webmBlob - Blob с WebM аудио
 * @returns Promise с Blob в формате WAV
 */
const convertWebMToWAV = async (webmBlob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 [YandexDisk] Начало конвертации WebM → WAV');
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          
          // Декодируем аудио
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Параметры WAV
          const sampleRate = audioBuffer.sampleRate;
          const numberOfChannels = audioBuffer.numberOfChannels;
          const length = audioBuffer.length;
          
          // Создаем WAV файл
          const wavBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
          const view = new DataView(wavBuffer);
          
          // WAV заголовок
          const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          };
          
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + length * numberOfChannels * 2, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true); // fmt chunk size
          view.setUint16(20, 1, true); // audio format (1 = PCM)
          view.setUint16(22, numberOfChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * numberOfChannels * 2, true); // byte rate
          view.setUint16(32, numberOfChannels * 2, true); // block align
          view.setUint16(34, 16, true); // bits per sample
          writeString(36, 'data');
          view.setUint32(40, length * numberOfChannels * 2, true);
          
          // Конвертируем аудио данные в 16-bit PCM
          let offset = 44;
          for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
              const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
              view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
              offset += 2;
            }
          }
          
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          console.log(`✅ [YandexDisk] Конвертация завершена: ${webmBlob.size} bytes → ${wavBlob.size} bytes`);
          
          resolve(wavBlob);
        } catch (error: any) {
          console.error('❌ [YandexDisk] Ошибка конвертации:', error);
          reject(new Error('Ошибка конвертации WebM в WAV: ' + error.message));
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Ошибка чтения файла'));
      };
      
      fileReader.readAsArrayBuffer(webmBlob);
    } catch (error: any) {
      console.error('❌ [YandexDisk] Ошибка инициализации конвертации:', error);
      reject(new Error('Ошибка инициализации конвертации: ' + error.message));
    }
  });
};

/**
 * Получить заголовки для API Яндекс.Диска
 */
const getHeaders = () => ({
  'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`,
  'Content-Type': 'application/json',
});

/**
 * Проверить, существует ли папка (использует GET - требует права на чтение)
 */
const folderExists = async (path: string): Promise<boolean> => {
  try {
    const response = await axios.get<FolderCheckResponse>(
      `${YANDEX_DISK_API}/resources`,
      {
        headers: getHeaders(),
        params: { path },
      }
    );
    return response.data.type === 'dir';
  } catch (error: any) {
    if (error.response?.status === 404) {
      return false;
    }
    // Детальное логирование ошибки
    console.error('❌ [YandexDisk] Ошибка folderExists:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      path: path,
    });
    throw error;
  }
};

/**
 * Создать папку на Яндекс.Диске
 */
const createFolder = async (path: string): Promise<void> => {
  try {
    console.log(`📁 [YandexDisk] Создание папки: ${path}`);
    await axios.put(
      `${YANDEX_DISK_API}/resources`,
      undefined, // Не передаем body
      {
        headers: {
          'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`,
          // НЕ добавляем Content-Type для PUT без body
        },
        params: { path },
      }
    );
    console.log(`✅ [YandexDisk] Папка создана: ${path}`);
  } catch (error: any) {
    // 409 - папка уже существует, это нормально
    if (error.response?.status === 409) {
      console.log(`ℹ️ [YandexDisk] Папка уже существует: ${path}`);
      return;
    }
    console.error(`❌ [YandexDisk] Ошибка создания папки:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Получить URL для загрузки файла
 */
const getUploadUrl = async (path: string, overwrite: boolean = false): Promise<string> => {
  try {
    console.log(`🔗 [YandexDisk] Получение URL для загрузки: ${path}`);
    const response = await axios.get<UploadUrlResponse>(
      `${YANDEX_DISK_API}/resources/upload`,
      {
        headers: getHeaders(),
        params: { path, overwrite },
      }
    );
    console.log(`✅ [YandexDisk] URL получен`);
    return response.data.href;
  } catch (error: any) {
    console.error(`❌ [YandexDisk] Ошибка получения URL:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Загрузить файл по URL с отслеживанием прогресса
 */
const uploadFile = async (
  uploadUrl: string, 
  blob: Blob, 
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`⬆️ [YandexDisk] Загрузка файла (${blob.size} bytes)`);
      
      const xhr = new XMLHttpRequest();
      
      // Отслеживание прогресса
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          console.log(`📊 [YandexDisk] Прогресс загрузки файла: ${progress.toFixed(1)}% (${e.loaded}/${e.total} bytes)`);
          onProgress(progress);
        }
      });
      
      // Успешная загрузка
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`✅ [YandexDisk] Файл загружен успешно`);
          // Убеждаемся, что прогресс 100%
          if (onProgress) {
            onProgress(100);
            console.log(`📊 [YandexDisk] Прогресс загрузки файла: 100% (завершено)`);
          }
          resolve();
        } else {
          reject(new Error(`Ошибка загрузки: ${xhr.status} ${xhr.statusText}`));
        }
      });
      
      // Ошибка
      xhr.addEventListener('error', () => {
        reject(new Error('Ошибка сети при загрузке файла'));
      });
      
      // Отмена
      xhr.addEventListener('abort', () => {
        reject(new Error('Загрузка отменена'));
      });
      
      // Начинаем загрузку
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'audio/wav');
      xhr.send(blob);
      
    } catch (error: any) {
      console.error(`❌ [YandexDisk] Ошибка загрузки файла:`, error.message);
      reject(error);
    }
  });
};

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Инициализировать структуру папок для пользователя
 * Структура: VoiceRecordings/hotword/userId/
 *            VoiceRecordings/command/userId/
 *            VoiceRecordings/negative/userId/
 */
export const initializeFolderStructure = async (userId: number): Promise<void> => {
  try {
    console.log(`🚀 [YandexDisk] Инициализация структуры папок для user_id: ${userId}`);

    // Сначала проверим что токен вообще работает
    console.log('🔍 [YandexDisk] Проверка токена перед созданием папок...');
    const isConnected = await checkYandexDiskConnection();
    if (!isConnected) {
      throw new Error('Токен Яндекс.Диска не работает. Проверьте права доступа в настройках приложения на oauth.yandex.ru');
    }

    // Создаем базовую папку
    if (!(await folderExists(BASE_FOLDER))) {
      await createFolder(BASE_FOLDER);
    }

    // Создаем папки для каждой категории
    const categories: RecordingType[] = ['hotword', 'command', 'negative'];
    
    for (const category of categories) {
      const categoryPath = `${BASE_FOLDER}/${category}`;
      const userPath = `${categoryPath}/${userId}`;

      // Создаем папку категории
      if (!(await folderExists(categoryPath))) {
        await createFolder(categoryPath);
      }

      // Создаем папку пользователя
      if (!(await folderExists(userPath))) {
        await createFolder(userPath);
      }
    }

    console.log(`✅ [YandexDisk] Структура папок инициализирована для user_id: ${userId}`);
  } catch (error: any) {
    console.error(`❌ [YandexDisk] Ошибка инициализации структуры:`, error);
    throw new Error('Не удалось инициализировать структуру папок на Яндекс.Диске');
  }
};

/**
 * Загрузить аудиофайл на Яндекс.Диск
 * @param blob - Blob аудиофайла
 * @param userId - ID пользователя
 * @param category - Тип записи (hotword/command/negative)
 * @param commandText - Текст команды (для имени файла)
 * @param onProgress - Callback для отслеживания прогресса (0-100)
 */
export const uploadAudioToYandexDisk = async (
  blob: Blob,
  userId: number,
  category: RecordingType,
  commandText: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  try {
    console.log(`📤 [YandexDisk] Начало загрузки аудио: user_id=${userId}, category=${category}`);

    // Проверяем токен
    if (!YANDEX_DISK_TOKEN) {
      throw new Error('Яндекс.Диск токен не настроен. Добавьте VITE_YANDEX_DISK_TOKEN в .env');
    }

    // Инициализируем структуру папок (если еще не создана) - 0-5%
    if (onProgress) onProgress(5);
    await initializeFolderStructure(userId);

    // Конвертируем WebM в WAV - 5-15%
    if (onProgress) onProgress(10);
    console.log('🔄 [YandexDisk] Конвертация WebM → WAV...');
    const wavBlob = await convertWebMToWAV(blob);
    if (onProgress) onProgress(15);

    // Генерируем имя файла (теперь .wav вместо .webm)
    const timestamp = Date.now();
    const sanitizedCommand = commandText
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]/gi, '_')
      .substring(0, 30);
    const fileName = `${sanitizedCommand}_${timestamp}.wav`;

    // Полный путь к файлу
    const filePath = `${BASE_FOLDER}/${category}/${userId}/${fileName}`;

    console.log(`📝 [YandexDisk] Путь файла: ${filePath}`);

    // Получаем URL для загрузки - 15-20%
    if (onProgress) onProgress(20);
    const uploadUrl = await getUploadUrl(filePath, false);

    // Загружаем файл с отслеживанием прогресса - 20-100%
    await uploadFile(uploadUrl, wavBlob, (fileProgress) => {
      if (onProgress) {
        // Масштабируем прогресс файла (0-100%) в диапазон 20-100%
        const scaledProgress = 20 + (fileProgress * 0.8);
        console.log(`📊 [YandexDisk] Общий прогресс: ${scaledProgress.toFixed(1)}% (файл: ${fileProgress.toFixed(1)}%)`);
        onProgress(scaledProgress);
      }
    });

    console.log(`🎉 [YandexDisk] Аудио успешно загружено: ${filePath}`);
  } catch (error: any) {
    console.error(`❌ [YandexDisk] Ошибка загрузки аудио:`, error);
    
    // Более понятные сообщения об ошибках
    if (error.response?.status === 401) {
      throw new Error('Неверный токен Яндекс.Диска. Проверьте VITE_YANDEX_DISK_TOKEN');
    } else if (error.response?.status === 507) {
      throw new Error('Недостаточно места на Яндекс.Диске');
    } else if (error.message.includes('токен')) {
      throw error;
    } else {
      throw new Error('Ошибка загрузки на Яндекс.Диск. Попробуйте позже');
    }
  }
};

/**
 * Получить статистику загруженных файлов пользователя
 */
export const getUserUploadStats = async (userId: number): Promise<{
  hotword: number;
  command: number;
  negative: number;
  total: number;
}> => {
  try {
    const categories: RecordingType[] = ['hotword', 'command', 'negative'];
    const stats = { hotword: 0, command: 0, negative: 0, total: 0 };

    for (const category of categories) {
      const userPath = `${BASE_FOLDER}/${category}/${userId}`;
      
      try {
        const response = await axios.get(
          `${YANDEX_DISK_API}/resources`,
          {
            headers: getHeaders(),
            params: { path: userPath, limit: 1000 },
          }
        );

        const fileCount = response.data._embedded?.items?.length || 0;
        stats[category] = fileCount;
        stats.total += fileCount;
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Папка не существует - значит нет файлов
          stats[category] = 0;
        } else {
          throw error;
        }
      }
    }

    return stats;
  } catch (error: any) {
    console.error(`❌ [YandexDisk] Ошибка получения статистики:`, error);
    throw error;
  }
};

/**
 * Проверить доступность Яндекс.Диска и валидность токена
 * Проверяем права на чтение (GET) и запись (PUT)
 */
export const checkYandexDiskConnection = async (): Promise<boolean> => {
  try {
    if (!YANDEX_DISK_TOKEN) {
      console.warn('⚠️ [YandexDisk] Токен не настроен');
      return false;
    }

    console.log('🔍 [YandexDisk] Проверка токена (чтение и запись):', {
      tokenLength: YANDEX_DISK_TOKEN.length,
      tokenStart: YANDEX_DISK_TOKEN.substring(0, 15),
    });

    // Проверка 1: Права на чтение (GET запрос к корню диска)
    try {
      await axios.get(`${YANDEX_DISK_API}/`, {
        headers: getHeaders(),
      });
      console.log('✅ [YandexDisk] Права на чтение: OK');
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error('❌ [YandexDisk] Нет прав на чтение:', {
          status: error.response?.status,
          data: error.response?.data,
        });
        return false;
      }
      throw error;
    }

    // Проверка 2: Права на запись (PUT запрос - создание тестовой папки)
    const testPath = `${BASE_FOLDER}/.test_write_access_${Date.now()}`;
    try {
      await axios.put(
        `${YANDEX_DISK_API}/resources`,
        undefined,
        {
          headers: {
            'Authorization': `OAuth ${YANDEX_DISK_TOKEN}`,
          },
          params: { path: testPath },
        }
      );
      
      // Если создалась - удаляем её
      try {
        await axios.delete(
          `${YANDEX_DISK_API}/resources`,
          {
            headers: getHeaders(),
            params: { path: testPath },
          }
        );
      } catch (e) {
        // Игнорируем ошибку удаления
      }
      
      console.log('✅ [YandexDisk] Права на запись: OK');
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error('❌ [YandexDisk] Нет прав на запись:', {
          status: error.response?.status,
          data: error.response?.data,
        });
        return false;
      }
      // 409 - папка уже существует, это тоже ок (значит права есть)
      if (error.response?.status === 409) {
        console.log('✅ [YandexDisk] Права на запись: OK (папка уже существует)');
      } else {
        throw error;
      }
    }

    console.log('✅ [YandexDisk] Токен валиден, все права работают!');
    return true;
  } catch (error: any) {
    console.error('❌ [YandexDisk] Ошибка проверки токена:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    
    return false;
  }
};

export default {
  uploadAudioToYandexDisk,
  initializeFolderStructure,
  getUserUploadStats,
  checkYandexDiskConnection,
};

