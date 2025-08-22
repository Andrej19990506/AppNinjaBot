/**
 * Утилита для проверки доступности сервера
 */

// Проверяем доступность основного API, а не health endpoint
const SERVER_HEALTH_ENDPOINT = '/api/v1/users/1/context'; // Эндпоинт для проверки основного API
const TIMEOUT_MS = 5000; // 5 секунд таймаут

export interface ServerHealthStatus {
  isAvailable: boolean;
  responseTime?: number;
  error?: string;
}

/**
 * Проверяет доступность сервера
 */
export const checkServerHealth = async (): Promise<ServerHealthStatus> => {
  const startTime = Date.now();
  
  try {
    // Создаем AbortController для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(SERVER_HEALTH_ENDPOINT, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const responseTime = Date.now() - startTime;
      return {
        isAvailable: true,
        responseTime,
      };
    } else {
      return {
        isAvailable: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      return {
        isAvailable: false,
        error: 'Timeout: сервер не отвечает',
        responseTime,
      };
    }
    
    if (error.message?.includes('fetch')) {
      return {
        isAvailable: false,
        error: 'Network Error: сервер недоступен',
        responseTime,
      };
    }
    
    if (error.message?.includes('Failed to fetch')) {
      return {
        isAvailable: false,
        error: 'Failed to fetch: сервер недоступен',
        responseTime,
      };
    }
    
    return {
      isAvailable: false,
      error: error.message || 'Неизвестная ошибка подключения',
      responseTime,
    };
  }
};

/**
 * Проверяет доступность сервера с повторными попытками
 */
export const checkServerHealthWithRetry = async (
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<ServerHealthStatus> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔍 [ServerHealth] Попытка ${attempt}/${maxRetries} проверки сервера`);
    
    const status = await checkServerHealth();
    
    if (status.isAvailable) {
      console.log(`✅ [ServerHealth] Сервер доступен, время ответа: ${status.responseTime}ms`);
      return status;
    }
    
    console.log(`❌ [ServerHealth] Попытка ${attempt} неудачна:`, status.error);
    
    // Если это не последняя попытка, ждем перед следующей
    if (attempt < maxRetries) {
      console.log(`⏳ [ServerHealth] Ожидание ${delayMs}ms перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.log(`💀 [ServerHealth] Все попытки исчерпаны, сервер недоступен`);
  return {
    isAvailable: false,
    error: 'Сервер недоступен после всех попыток подключения',
  };
};
