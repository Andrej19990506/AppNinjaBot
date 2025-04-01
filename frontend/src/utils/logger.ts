/**
 * Простой логгер для приложения
 */
export const logger = {
    log: (message: string, ...args: any[]) => {
        console.log(message, ...args);
    },
    info: (message: string, ...args: any[]) => {
        console.info(message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(message, ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(message, ...args);
    },
    debug: (message: string, ...args: any[]) => {
        console.debug(message, ...args);
    }
}; 