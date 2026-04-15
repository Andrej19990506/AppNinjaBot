/**
 * Проверка доступности API — тот же базовый URL, что и у axios (не относительный /health).
 */

const TIMEOUT_MS = 8000;

export interface ServerHealthStatus {
  isAvailable: boolean;
  responseTime?: number;
  error?: string;
}

/** Совпадает с логикой baseURL в shared/api/api.ts */
function getApiBaseUrl(): string {
  const runtime =
    typeof window !== 'undefined' ? window.APP_CONFIG?.API_URL : undefined;
  const buildtime = import.meta.env.VITE_API_URL as string | undefined;
  const base = (runtime || buildtime || '').trim();
  return base.replace(/\/$/, '');
}


function getHealthCheckUrl(): string | null {
  const base = getApiBaseUrl();
  if (base) {
    return `${base}/v1/health`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1/health`;
  }
  return null;
}

function parseHealthJson(text: string): boolean {
  try {
    const data = JSON.parse(text) as { status?: string };
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Проверяет доступность API (только успешный JSON { "status": "ok" } считается OK).
 */
export const checkServerHealth = async (): Promise<ServerHealthStatus> => {
  const startTime = Date.now();
  const url = getHealthCheckUrl();

  if (!url) {
    return {
      isAvailable: false,
      error: 'Не задан URL API (APP_CONFIG.API_URL / VITE_API_URL)',
      responseTime: Date.now() - startTime,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        isAvailable: false,
        error: `HTTP ${response.status}: ${response.statusText || 'ошибка'}`,
        responseTime: Date.now() - startTime,
      };
    }

    if (!parseHealthJson(text)) {
      return {
        isAvailable: false,
        error:
          'Ответ не похож на health API (ожидался JSON {"status":"ok"}); возможно отдана HTML-страница',
        responseTime: Date.now() - startTime,
      };
    }

    return {
      isAvailable: true,
      responseTime: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        isAvailable: false,
        error: 'Timeout: сервер не отвечает',
        responseTime,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.toLowerCase().includes('network')
    ) {
      return {
        isAvailable: false,
        error: 'Network Error: сервер недоступен',
        responseTime,
      };
    }
    return {
      isAvailable: false,
      error: message || 'Неизвестная ошибка подключения',
      responseTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

