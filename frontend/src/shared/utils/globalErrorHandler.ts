/**
 * Глобальный обработчик ошибок для автоматического сбора отчетов
 */

import React from 'react';
import { collectErrorReport, saveErrorReportToStorage } from './errorReporter';

// Хранилище для последних ошибок
const errorHistory: Array<{ timestamp: number; error: any; context: any }> = [];
const MAX_ERROR_HISTORY = 10;

/**
 * Добавляет ошибку в историю
 */
const addToErrorHistory = (error: any, context: any) => {
  errorHistory.push({
    timestamp: Date.now(),
    error,
    context,
  });

  // Ограничиваем размер истории
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory.shift();
  }
};

/**
 * Получает последние ошибки
 */
export const getRecentErrors = () => {
  return errorHistory.slice(-5); // Последние 5 ошибок
};

/**
 * Обработчик для необработанных ошибок JavaScript
 */
const handleUnhandledError = (event: ErrorEvent) => {
  console.error('🚨 [GlobalErrorHandler] Необработанная ошибка:', event.error);
  
  const context = {
    type: 'unhandled_error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    message: event.message,
  };

  addToErrorHistory(event.error, context);

  // Собираем детальный отчет
  const report = collectErrorReport(event.error, {
    user: null, // Будет заполнено если доступно
    reduxState: null, // Будет заполнено если доступно
  });

  // Сохраняем в localStorage для отладки
  saveErrorReportToStorage(report);
};

/**
 * Обработчик для необработанных отклоненных промисов
 */
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('🚨 [GlobalErrorHandler] Необработанное отклонение промиса:', event.reason);
  
  const context = {
    type: 'unhandled_rejection',
    reason: event.reason,
  };

  addToErrorHistory(event.reason, context);

  // Собираем детальный отчет
  const report = collectErrorReport(event.reason, {
    user: null,
    reduxState: null,
  });

  // Сохраняем в localStorage для отладки
  saveErrorReportToStorage(report);
};

/**
 * Обработчик для ошибок React
 */
const handleReactError = (error: Error, errorInfo: any) => {
  console.error('🚨 [GlobalErrorHandler] Ошибка React:', error, errorInfo);
  
  const context = {
    type: 'react_error',
    componentStack: errorInfo.componentStack,
    errorBoundary: errorInfo.errorBoundary,
  };

  addToErrorHistory(error, context);

  // Собираем детальный отчет
  const report = collectErrorReport(error, {
    user: null,
    reduxState: null,
  });

  // Сохраняем в localStorage для отладки
  saveErrorReportToStorage(report);
};

/**
 * Инициализирует глобальные обработчики ошибок
 */
export const initializeGlobalErrorHandlers = () => {
  console.log('🔧 [GlobalErrorHandler] Инициализация глобальных обработчиков ошибок');

  // Обработчик для необработанных ошибок JavaScript
  window.addEventListener('error', handleUnhandledError);

  // Обработчик для необработанных отклоненных промисов
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Обработчик для ошибок React (если используется ErrorBoundary)
  if (typeof window !== 'undefined') {
    (window as any).__REACT_ERROR_HANDLER__ = handleReactError;
  }

  console.log('✅ [GlobalErrorHandler] Глобальные обработчики ошибок инициализированы');
};

/**
 * Очищает глобальные обработчики ошибок
 */
export const cleanupGlobalErrorHandlers = () => {
  console.log('🧹 [GlobalErrorHandler] Очистка глобальных обработчиков ошибок');

  window.removeEventListener('error', handleUnhandledError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  if (typeof window !== 'undefined') {
    delete (window as any).__REACT_ERROR_HANDLER__;
  }

  console.log('✅ [GlobalErrorHandler] Глобальные обработчики ошибок очищены');
};

/**
 * Создает ErrorBoundary для React компонентов
 * Этот класс должен быть в отдельном .tsx файле
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; errorInfo: any }>;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

/**
 * Функция для создания ErrorBoundary компонента
 * Используйте эту функцию в .tsx файлах
 */
export const createErrorBoundary = () => {
  return class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
      console.error('🚨 [ErrorBoundary] Ошибка в React компоненте:', error, errorInfo);
      
      this.setState({ error, errorInfo });
      
      // Обрабатываем ошибку через глобальный обработчик
      handleReactError(error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        const FallbackComponent = this.props.fallback;
        
        if (FallbackComponent) {
          return React.createElement(FallbackComponent, { 
            error: this.state.error!, 
            errorInfo: this.state.errorInfo 
          });
        }

        return React.createElement('div', {
          style: { 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--error-color)',
            background: 'var(--error-bg)',
            borderRadius: 'var(--radius-lg)',
            margin: '20px'
          }
        }, [
          React.createElement('h2', { key: 'title' }, '🚨 Произошла ошибка'),
          React.createElement('p', { key: 'message' }, 'Что-то пошло не так. Пожалуйста, обновите страницу.'),
          React.createElement('details', {
            key: 'details',
            style: { marginTop: '10px', textAlign: 'left' }
          }, [
            React.createElement('summary', { key: 'summary' }, 'Технические детали'),
            React.createElement('pre', {
              key: 'pre',
              style: { 
                fontSize: '12px', 
                overflow: 'auto', 
                maxHeight: '200px',
                background: 'var(--gray-100)',
                padding: '10px',
                borderRadius: 'var(--radius)',
                marginTop: '10px'
              }
            }, this.state.error?.stack || 'Стек не доступен')
          ])
        ]);
      }

      return this.props.children;
    }
  };
};
