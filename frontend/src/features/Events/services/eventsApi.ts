import axios, { AxiosInstance } from 'axios'; 
import { axiosInstance } from '@shared/api/api'; 
import { logger } from '@shared/utils/logger'; 
import { EventRead, EventCreate, NotificationCreate, EventNotification, NotificationUpdate } from '../../../types/event'; // Импортируем все нужные типы

/**
 * Получает список всех событий.
 * @returns {Promise<EventRead[]>} Массив событий.
 */
export const getEvents = async (groupType?: string): Promise<EventRead[]> => {
    const logPrefix = '[eventsApi:getEvents]';
    logger.log(`${logPrefix} 📡 Запрос списка событий...`);
    try {
        const params: any = {};
        if (groupType) params.group_type = groupType;
        const response = await axiosInstance.get<EventRead[]>('/v1/events/', { params });
        logger.log(`${logPrefix} ✅ Список событий получен: ${response.data?.length ?? 0} шт.`);
        
        // Добавляем логирование для отслеживания структуры данных
        if (response.data && Array.isArray(response.data)) {
            response.data.forEach((event, index) => {
                if (event.event_type === 'АТО' && event.retailiqa_detailed_violations) {
                    console.log(`[eventsApi:debug] Событие АТО #${event.id}: получено ${event.retailiqa_detailed_violations.length} нарушений`);
                    
                
                    let violationsWithPhotos = 0;
                    let totalPhotos = 0;
                    
                    event.retailiqa_detailed_violations.forEach((violation, vIndex) => {
                        console.log(`[eventsApi:debug] Violation object #${vIndex + 1} KEYS:`, Object.keys(violation));
                        console.log(`[eventsApi:debug] Violation object #${vIndex + 1} FULL:`, JSON.stringify(violation));
                        if (violation.photos && Array.isArray(violation.photos) && violation.photos.length > 0) {
                            violationsWithPhotos++;
                            totalPhotos += violation.photos.length;
                            console.log(`[eventsApi:debug] -- Нарушение #${vIndex+1}: ${violation.photos.length} фото`);
                        }
                    });
                    
                    console.log(`[eventsApi:debug] -- ИТОГО в событии #${event.id}: ${violationsWithPhotos} нарушений с фотографиями, всего ${totalPhotos} фотографий`);
                }
            });
        }
        
        // Возвращаем массив событий или пустой массив, если данных нет
        return response.data || [];
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при запросе списка событий:`, error);
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
export const createEvent = async (
    eventData: EventCreate & { event_type?: string, chat_ids?: number[], group_telegram_id?: number, date_from?: string, date_to?: string, max_pages?: number }, // Расширяем тип для АТО-специфичных полей
): Promise<EventRead | EventRead[]> => { // Возвращаемый тип может быть EventRead или EventRead[]
    const logPrefix = '[eventsApi:createEvent]';
    
    // Отладка: выводим полученные данные для принятия решения, какой эндпоинт вызывать
    console.log(`${logPrefix} Данные события:`, JSON.stringify(eventData));
    console.log(`${logPrefix} Тип события:`, eventData.event_type);
    console.log(`${logPrefix} group_telegram_id:`, eventData.group_telegram_id);
    

    if (eventData.event_type === 'ato' && eventData.group_telegram_id) {
        logger.log(`${logPrefix} 📡 Создание АТО события через RetailiQA для группы ${eventData.group_telegram_id}...`, eventData);
        try {
            // Используем существующую функцию, передавая нужные параметры
            // Если date_from, date_to, max_pages не переданы в eventData, они будут undefined,
            // и processRetailiQAReportsForGroup обработает это (они опциональны)
            const atoResponse = await processRetailiQAReportsForGroup(
                eventData.group_telegram_id,
                eventData.date_from,
                eventData.date_to,
                eventData.max_pages
            );
            return atoResponse; // Возвращает Promise<EventRead[]>
        } catch (error: any) {
            throw error;
        }
    } else {
        // Стандартная логика для создания обычного события
        logger.log(`${logPrefix} 📡 Создание обычного события...`, eventData);
        try {
            const response = await axiosInstance.post<EventRead>('/v1/events/', eventData);
            logger.log(`${logPrefix} ✅ Обычное событие создано:`, response.data);
            return response.data; // Возвращает Promise<EventRead>
        } catch (error: any) {
            logger.error(`${logPrefix} ❌ Ошибка при создании обычного события:`, error);
            if (axios.isAxiosError(error)) {
                const detail = error.response?.data?.detail;
                throw new Error(detail || error.message || 'Ошибка при создании обычного события.');
            } else if (error instanceof Error) {
                throw error;
            }
            throw new Error('Произошла неизвестная ошибка при создании обычного события.');
        }
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
        const response = await axiosInstance.delete<EventRead>(`/v1/events/${eventId}`);
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
    
    // Отладка параметров send_now, time и timeMode
    console.log(`${logPrefix} ОТЛАДКА: send_now=${notificationData.send_now}, time=${notificationData.time}`);
    
    try {
        const response = await axiosInstance.post<EventNotification>(
            `/v1/events/${eventId}/notifications`, 
            notificationData
        );
        logger.log(`${logPrefix} ✅ Уведомление создано:`, response.data);
        
        // Отладка ответа от сервера
        console.log(`${logPrefix} ОТВЕТ API: status=${response.status}, `, response.data);
        
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
            `/v1/events/${eventId}/notifications/${notificationId}`, 
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

/**
 * Запускает обработку отчетов RetailiQA для указанной группы и диапазона дат.
 * @param {number} groupTelegramId - Telegram ID группы.
 * @param {string} [dateFrom] - Начальная дата в формате YYYY-MM-DD (опционально).
 * @param {string} [dateTo] - Конечная дата в формате YYYY-MM-DD (опционально).
 * @param {number} [maxPages] - Максимальное количество страниц для запроса (опционально).
 * @returns {Promise<EventRead[]>} Массив созданных/обновленных событий.
 */
export const processRetailiQAReportsForGroup = async (
    groupTelegramId: number,
    dateFrom?: string,
    dateTo?: string,
    maxPages?: number
): Promise<EventRead[]> => {
    const logPrefix = '[eventsApi:processRetailiQAReportsForGroup]';
    logger.log(`${logPrefix} 📡 Запуск обработки отчетов RetailiQA для группы ${groupTelegramId}, даты: ${dateFrom || 'N/A'} - ${dateTo || 'N/A'}, страницы: ${maxPages || 'N/A'}...`);

    // Собираем параметры запроса, которые могут быть undefined
    const params: { [key: string]: any } = {};
    if (dateFrom) {
        params.date_from = dateFrom;
    }
    if (dateTo) {
        params.date_to = dateTo;
    }
    if (maxPages !== undefined) {
        params.max_pages = maxPages;
    }

    try {
        const response = await axiosInstance.post<EventRead[]>(
            `/v1/events/groups/${groupTelegramId}/process-retailiqa-reports`,
            null, 
            { params }
        );
        logger.log(`${logPrefix} ✅ Обработка отчетов RetailiQA для группы ${groupTelegramId} завершена, получено событий: ${response.data?.length ?? 0} шт.`);
        return response.data || [];
    } catch (error: any) {
        logger.error(`${logPrefix} ❌ Ошибка при обработке отчетов RetailiQA для группы ${groupTelegramId}:`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Группа не найдена или объект RetailiQA не настроен.');
            }
            throw new Error(detail || error.message || 'Ошибка при обработке отчетов RetailiQA.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Произошла неизвестная ошибка при обработке отчетов RetailiQA.');
    }
};
