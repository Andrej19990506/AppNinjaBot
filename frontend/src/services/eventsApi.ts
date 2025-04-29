import axios, { AxiosInstance } from 'axios'; // Импортируем isAxiosError напрямую из axios
import { axiosInstance } from './api'; // Импортируем настроенный инстанс Axios
import { logger } from '../utils/logger'; // Используем логгер
import { EventRead } from '../types/event'; // Импортируем тип для ответа

/**
 * Получает список всех событий.
 * @returns {Promise<EventRead[]>} Массив событий.
 */
export const getEvents = async (): Promise<EventRead[]> => {
    const logPrefix = '[eventsApi:getEvents]';
    logger.log(`${logPrefix} 📡 Запрос списка событий...`);
    try {
        // Делаем GET-запрос на /api/v1/events
        const response = await axiosInstance.get<EventRead[]>('/api/v1/events');
        logger.log(`${logPrefix} ✅ Список событий получен: ${response.data?.length ?? 0} шт.`);
        // Возвращаем массив событий или пустой массив, если данных нет
        return response.data || [];
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при запросе списка событий:`, error);
        // Обработка ошибок Axios
        // Используем axios.isAxiosError
        if (axios.isAxiosError(error)) {
             const status = error.response?.status;
             const detail = error.response?.data?.detail;
             // Можно добавить обработку 404, если бэк возвращает ее при пустом списке
             // if (status === 404) {
             //     logger.warn(`${logPrefix} ℹ️ События не найдены (404). Возвращаем пустой массив.`);
             //     return [];
             // }
             throw new Error(detail || error.message || 'Ошибка при получении списка событий.');
         } else if (error instanceof Error) {
             throw error; // Перебрасываем другие ошибки
         }
        // Для совсем неизвестных ошибок
        throw new Error('Произошла неизвестная ошибка при получении списка событий.');
    }
};

// TODO: Добавить другие функции API для событий:
// export const createEvent = async (eventData: EventCreate): Promise<EventRead> => { ... };
// export const getEventById = async (eventId: number): Promise<EventRead> => { ... };
// export const updateEvent = async (eventId: number, eventData: Partial<EventUpdate>): Promise<EventRead> => { ... };
// export const deleteEvent = async (eventId: number): Promise<void> => { ... }; 