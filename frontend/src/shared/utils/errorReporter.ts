/**
 * Утилита для сбора и форматирования детальной информации об ошибках
 */

export interface ErrorReport {
  timestamp: string;
  error: {
    message: string;
    stack?: string;
    name: string;
    cause?: any;
  };
  context: {
    url: string;
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
    platform: string;
    language: string;
    timezone: string;
  };
  app: {
    version: string;
    environment: string;
    buildTime: string;
  };
  user: {
    id?: number;
    groups?: any[];
    role?: string;
  };
  network: {
    online: boolean;
    connectionType?: string;
  };
  performance: {
    memoryUsage?: number;
    timing: {
      navigationStart: number;
      loadEventEnd: number;
      domContentLoaded: number;
    };
  };
  redux: {
    state: any;
    lastAction?: string;
  };
}

/**
 * Собирает детальную информацию об ошибке для отладки
 */
export const collectErrorReport = (
  error: Error | any,
  additionalContext: {
    user?: any;
    reduxState?: any;
    lastAction?: string;
  } = {}
): ErrorReport => {
  const now = new Date();
  
  // Собираем информацию о браузере и устройстве
  const context = {
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  // Собираем информацию о приложении
  const app = {
    version: import.meta.env.VITE_APP_VERSION || 'unknown',
    environment: import.meta.env.VITE_ENV || 'unknown',
    buildTime: import.meta.env.VITE_BUILD_TIME || 'unknown',
  };

  // Собираем информацию о пользователе
  const user = {
    id: additionalContext.user?.id,
    groups: additionalContext.user?.groups?.map((group: any) => ({
      id: group.id,
      name: group.name,
      type: group.group_type,
    })),
    role: additionalContext.user?.activeRole,
  };

  // Собираем информацию о сети
  const network = {
    online: navigator.onLine,
    connectionType: (navigator as any).connection?.effectiveType,
  };

  // Собираем информацию о производительности
  const performanceInfo = {
    memoryUsage: typeof performance !== 'undefined' && (performance as any).memory?.usedJSHeapSize,
    timing: typeof performance !== 'undefined' && performance.timing ? {
      navigationStart: performance.timing.navigationStart,
      loadEventEnd: performance.timing.loadEventEnd,
      domContentLoaded: performance.timing.domContentLoadedEventEnd,
    } : {
      navigationStart: 0,
      loadEventEnd: 0,
      domContentLoaded: 0,
    },
  };

  // Собираем информацию о Redux состоянии
  const redux = {
    state: additionalContext.reduxState ? {
      user: {
        isInitialized: additionalContext.reduxState.user?.isInitialized,
        loading: additionalContext.reduxState.user?.loading,
        error: additionalContext.reduxState.user?.error,
      },
      notification: {
        itemsCount: additionalContext.reduxState.notification?.items?.length || 0,
      },
    } : null,
    lastAction: additionalContext.lastAction,
  };

  return {
    timestamp: now.toISOString(),
    error: {
      message: error?.message || String(error),
      stack: error?.stack,
      name: error?.name || 'UnknownError',
      cause: error?.cause,
    },
    context,
    app,
    user,
    network,
    performance: performanceInfo,
    redux,
  };
};

/**
 * Форматирует отчет об ошибке в читаемый текст для отправки в поддержку
 */
export const formatErrorReport = (report: ErrorReport): string => {
  const lines = [
    '🐛 ОТЧЕТ ОБ ОШИБКЕ',
    '='.repeat(50),
    '',
    `📅 Время: ${report.timestamp}`,
    `🌐 URL: ${report.context.url}`,
    `📱 Устройство: ${report.context.platform}`,
    `🌍 Язык: ${report.context.language}`,
    `⏰ Часовой пояс: ${report.context.timezone}`,
    '',
    '❌ ОШИБКА:',
    `   Тип: ${report.error.name}`,
    `   Сообщение: ${report.error.message}`,
    '',
    '🔧 КОНТЕКСТ ПРИЛОЖЕНИЯ:',
    `   Версия: ${report.app.version}`,
    `   Окружение: ${report.app.environment}`,
    `   Время сборки: ${report.app.buildTime}`,
    '',
    '👤 ПОЛЬЗОВАТЕЛЬ:',
    `   ID: ${report.user.id || 'Не определен'}`,
    `   Роль: ${report.user.role || 'Не определена'}`,
    `   Группы: ${report.user.groups?.length || 0}`,
    '',
    '🌐 СЕТЬ:',
    `   Онлайн: ${report.network.online ? 'Да' : 'Нет'}`,
    `   Тип соединения: ${report.network.connectionType || 'Не определен'}`,
    '',
    '📊 ПРОИЗВОДИТЕЛЬНОСТЬ:',
    `   Использование памяти: ${report.performance.memoryUsage ? Math.round(report.performance.memoryUsage / 1024 / 1024) + ' MB' : 'Не доступно'}`,
    `   Время загрузки: ${report.performance.timing.loadEventEnd - report.performance.timing.navigationStart}ms`,
    '',
    '🔄 REDUX СОСТОЯНИЕ:',
    report.redux.state ? 
      `   Пользователь инициализирован: ${report.redux.state.user?.isInitialized ? 'Да' : 'Нет'}` +
      `\n   Загрузка: ${report.redux.state.user?.loading ? 'Да' : 'Нет'}` +
      `\n   Ошибка: ${report.redux.state.user?.error || 'Нет'}` +
      `\n   Уведомления: ${report.redux.state.notification?.itemsCount || 0}` +
      `\n   Последнее действие: ${report.redux.lastAction || 'Не определено'}`
      : 'Не доступно',
    '',
    '📋 СТЕК ОШИБКИ:',
    report.error.stack ? 
      report.error.stack.split('\n').map(line => `   ${line}`).join('\n')
      : 'Стек не доступен',
    '',
    '='.repeat(50),
    '💡 Для быстрого решения проблемы отправьте этот отчет в техническую поддержку.',
  ];

  return lines.join('\n');
};

/**
 * Копирует отчет об ошибке в буфер обмена
 */
export const copyErrorReportToClipboard = async (report: ErrorReport): Promise<boolean> => {
  try {
    const formattedReport = formatErrorReport(report);
    await navigator.clipboard.writeText(formattedReport);
    return true;
  } catch (error) {
    console.error('Ошибка при копировании отчета:', error);
    return false;
  }
};

/**
 * Сохраняет отчет об ошибке в localStorage для отладки
 */
export const saveErrorReportToStorage = (report: ErrorReport): void => {
  try {
    const key = `error_report_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(report));
    console.log(`📝 Отчет об ошибке сохранен в localStorage с ключом: ${key}`);
  } catch (error) {
    console.error('Ошибка при сохранении отчета:', error);
  }
};
