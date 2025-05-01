import axios, { AxiosInstance } from 'axios'; // Импортируем isAxiosError напрямую из axios
import { axiosInstance } from './api'; // Импортируем настроенный инстанс Axios
import { logger } from '../utils/logger'; // Используем логгер
import { EventRead, EventCreate, NotificationCreate, EventNotification, NotificationUpdate } from '../types/event'; // Импортируем все нужные типы

/**
 * Получает список всех событий.
 * @returns {Promise<EventRead[]>} Массив событий.
 */
export const getEvents = async (): Promise<EventRead[]> => {
    const logPrefix = '[eventsApi:getEvents]';
    logger.log(`${logPrefix} 📡 Запрос списка событий...`);
    try {
        // Делаем GET-запрос на /api/v1/events/
        const response = await axiosInstance.get<EventRead[]>('/api/v1/events/');
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

/**
 * Создает новое событие.
 * @param {EventCreate} eventData - Данные для создания события.
 * @returns {Promise<EventRead>} Созданное событие.
 */
export const createEvent = async (eventData: EventCreate): Promise<EventRead> => {
    const logPrefix = '[eventsApi:createEvent]';
    logger.log(`${logPrefix} 📡 Создание события...`, eventData);
    try {
        const response = await axiosInstance.post<EventRead>('/api/v1/events/', eventData);
        logger.log(`${logPrefix} ✅ Событие создано:`, response.data);
        return response.data;
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при создании события:`, error);
        if (axios.isAxiosError(error)) {
            const detail = error.response?.data?.detail;
            throw new Error(detail || error.message || 'Ошибка при создании события.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Произошла неизвестная ошибка при создании события.');
    }
};

/**
 * Удаляет событие по ID.
 * @param {number} eventId - ID события для удаления.
 * @returns {Promise<EventRead>} Удаленное событие.
 */
export const deleteEvent = async (eventId: number): Promise<EventRead> => {
    const logPrefix = '[eventsApi:deleteEvent]';
    logger.log(`${logPrefix} 📡 Удаление события ID: ${eventId}...`);
    try {
        const response = await axiosInstance.delete<EventRead>(`/api/v1/events/${eventId}`);
        logger.log(`${logPrefix} ✅ Событие ID ${eventId} удалено:`, response.data);
        return response.data; // Возвращаем данные удаленного события
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при удалении события ID ${eventId}:`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error('Событие для удаления не найдено.');
            }
            throw new Error(detail || error.message || 'Ошибка при удалении события.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Произошла неизвестная ошибка при удалении события.');
    }
};

/**
 * Создает новое уведомление для события.
 * @param {number} eventId - ID события.
 * @param {NotificationCreate} notificationData - Данные для создания уведомления.
 * @returns {Promise<EventNotification>} Созданное уведомление.
 */
export const createNotification = async (
    eventId: number, 
    notificationData: NotificationCreate
): Promise<EventNotification> => {
    const logPrefix = '[eventsApi:createNotification]';
    logger.log(`${logPrefix} 📡 Создание уведомления для события ID ${eventId}...`, notificationData);
    try {
        const response = await axiosInstance.post<EventNotification>(
            `/api/v1/events/${eventId}/notifications`, 
            notificationData
        );
        logger.log(`${logPrefix} ✅ Уведомление создано:`, response.data);
        return response.data;
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при создании уведомления для события ID ${eventId}:`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error('Событие для добавления уведомления не найдено.');
            }
            // Можно добавить обработку других ошибок, например, 400 Bad Request
            throw new Error(detail || error.message || 'Ошибка при создании уведомления.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Произошла неизвестная ошибка при создании уведомления.');
    }
};

/**
 * Обновляет существующее уведомление для события.
 * @param {number} eventId - ID события.
 * @param {string} notificationId - ID уведомления (UUID).
 * @param {NotificationUpdate} notificationData - Данные для обновления.
 * @returns {Promise<EventNotification>} Обновленное уведомление.
 */
export const updateNotification = async (
    eventId: number,
    notificationId: string, 
    notificationData: NotificationUpdate // Используем новый тип
): Promise<EventNotification> => {
    const logPrefix = '[eventsApi:updateNotification]';
    logger.log(`${logPrefix} 📡 Обновление уведомления ID ${notificationId} для события ID ${eventId}...`, notificationData);
    try {
        const response = await axiosInstance.put<EventNotification>(
            `/api/v1/events/${eventId}/notifications/${notificationId}`, 
            notificationData
        );
        logger.log(`${logPrefix} ✅ Уведомление обновлено:`, response.data);
        return response.data;
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при обновлении уведомления ID ${notificationId} для события ID ${eventId}:`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error('Событие или уведомление не найдено для обновления.');
            }
            throw new Error(detail || error.message || 'Ошибка при обновлении уведомления.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Произошла неизвестная ошибка при обновлении уведомления.');
    }
};

// TODO: Добавить другие функции API для событий:
// export const getEventById = async (eventId: number): Promise<EventRead> => { ... };
// export const updateEvent = async (eventId: number, eventData: Partial<EventUpdate>): Promise<EventRead> => { ... }; 