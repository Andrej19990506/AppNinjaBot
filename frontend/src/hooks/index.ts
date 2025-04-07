// Экспортируем все хуки
// TODO: Временно используем useWebSocketConnection вместо useWebSocket
// export * from './useWebSocket';
export * from './useWriteOffSync';
export { default as useDeviceDetect } from './useDeviceDetect';
export { default as useDragAndDrop } from './useDragAndDrop';
export { useWebSocketConnection } from './useWebSocketConnection';

// Примечание: useWebSocket и useWebSocketConnection предоставляют схожую функциональность
// В будущем они будут объединены в один хук

// Добавляйте другие хуки по мере необходимости 