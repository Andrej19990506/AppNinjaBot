import axios, { AxiosError } from 'axios'; // Импортируем axios для isAxiosError
import { axiosInstance } from './api'; // <<< УБРАЛ ИМПОРТ extractErrorDetails
import { logger } from '../utils/logger'; // <<< ДОБАВЛЕН ИМПОРТ ЛОГГЕРА
// import config from '../config'; // Убрал, т.к. baseURL используется

// Интерфейс для ответа от API статуса
interface CourierStatusResponse {
    is_senior_courier: boolean;
    // Другие поля, если API их возвращает
}

/**
 * Получает статус курьера (является ли он старшим).
 * @param userId ID пользователя (курьера)
 * @param chatId ID чата, в котором проверяется статус
 */
export const getCourierStatus = async (userId: number | string, chatId: string): Promise<CourierStatusResponse> => {
    console.log(`[courierApi] 📡 Запрос статуса курьера ID: ${userId} в чате: ${chatId}`);
    try {
        const response = await axiosInstance.get<CourierStatusResponse>(`/couriers/${userId}/status`, {
            params: { chat_id: chatId } // Передаем chat_id как параметр запроса
        });
        console.log('[courierApi] ✅ Статус курьера получен:', response.data);
        return response.data;
    } catch (error) {
        console.error(`[courierApi] ❌ Ошибка при запросе статуса курьера ID: ${userId}`, error);
        // Перебрасываем ошибку для обработки выше
        if (axios.isAxiosError(error)) {
            // Попытка извлечь сообщение об ошибке из ответа API
            const detail = error.response?.data?.detail || error.message;
            throw new Error(detail || 'Ошибка при получении статуса курьера.');
        } else if (error instanceof Error) {
            throw error; // Перебрасываем как есть, если это стандартная ошибка
        }
        throw new Error('Неизвестная ошибка при получении статуса курьера.');
    }
};

// Интерфейс для данных обновления профиля
export interface UpdateProfileData {
    firstName: string;
    lastName: string;
    isSeniorCourier?: boolean;
    seniorPassword?: string;
    chatId?: string;
}

// Определяем тип для ключей backendData
type BackendDataKeys = 'first_name' | 'last_name' | 'is_senior_courier' | 'senior_password' | 'chat_id';

/**
 * Обновляет профиль курьера.
 * @param userId ID пользователя (курьера)
 * @param data Данные для обновления
 */
export const updateCourierProfile = async (userId: number | string, data: UpdateProfileData): Promise<any> => {
    console.log(`[courierApi] 📡 Обновление профиля курьера ID: ${userId}`, data);
    try {
        // Преобразуем данные в snake_case для бэкенда
        const backendData: Partial<Record<BackendDataKeys, any>> = {
            first_name: data.firstName,
            last_name: data.lastName,
            is_senior_courier: data.isSeniorCourier,
            senior_password: data.seniorPassword,
            chat_id: data.chatId
        };

        // Удаляем ключи с undefined значениями, чтобы не отправлять их
        (Object.keys(backendData) as BackendDataKeys[]).forEach(key => {
            if (backendData[key] === undefined) {
                delete backendData[key];
            }
        });

        // ИСПРАВЛЯЕМ URL НА НОВЫЙ ЭНДПОИНТ
        const response = await axiosInstance.put(`/api/v1/users/${userId}/profile`, backendData);
        console.log(`[courierApi] ✅ Профиль курьера ID: ${userId} обновлен:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`[courierApi] ❌ Ошибка при обновлении профиля курьера ID: ${userId}`, error);
        
        // Обработка ошибок Axios
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<any>; // Уточняем тип
            const status = axiosError.response?.status;
            const responseData = axiosError.response?.data;
            const detail = responseData?.detail; // Сообщение об ошибке от FastAPI

            if (axiosError.code === 'ERR_NETWORK') {
                throw new Error('Ошибка сети. Пожалуйста, проверьте подключение к интернету.');
            }
            if (status === 403) {
                throw new Error(detail || 'Доступ запрещен. У вас нет прав.');
            }
            if (status === 404) {
                 throw new Error(detail || 'Пользователь не найден.');
            }
            if (status === 401) { 
                throw new Error(detail || 'Неверный пароль старшего курьера или ошибка авторизации.');
            }
             if (status === 400) { 
                 throw new Error(detail || 'Неверные данные запроса.');
            }
            throw new Error(detail || axiosError.message || 'Ошибка при обновлении профиля.');
        } else if (error instanceof Error) {
             throw error; // Перебрасываем другие ошибки
        }
        // Для совсем неизвестных ошибок
        throw new Error('Произошла неизвестная ошибка при обновлении профиля.');
    }
};

// Интерфейс для объекта смены, возвращаемого API (snake_case)
interface ApiShift {
    id: string;
    user_id: string; // Обрати внимание: в старом коде было userId, но API вероятно возвращает user_id
    photo_url: string | null;
    first_name: string;
    last_name: string;
    date: string; // YYYY-MM-DD
    shift_type: 'day' | 'night';
    slot_index: number;
    is_senior_courier?: boolean;
}

/**
 * Получает список всех смен для указанного чата.
 * @param chatId ID чата
 */
export const getShifts = async (chatId: number | string): Promise<ApiShift[]> => {
    const groupId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
    if (isNaN(groupId)) {
        logger.error('[courierApi] ❌ Invalid groupId provided for getShifts', { chatId });
        throw new Error('Invalid Group ID');
    }
    
    logger.info(`[courierApi] 📡 Запрос смен для группы ID: ${groupId}`);
    try {
        // Добавляем слеш в конце URL и используем ПРАВИЛЬНОЕ ИМЯ параметра
        const response = await axiosInstance.get<ApiShift[]>('/api/v1/shifts/', { 
            params: { group_telegram_id: groupId } // <<< ИСПРАВЛЕНО ИМЯ ПАРАМЕТРА
        });
        console.log(`[courierApi] ✅ Смены для группы ${groupId} получены:`, response.data);
        // Возвращаем данные как есть, маппинг будет в thunk
        return response.data || []; // Возвращаем пустой массив, если данных нет
    } catch (error) {
        console.error(`[courierApi] ❌ Ошибка при запросе смен для группы ${groupId}`, error);
        if (axios.isAxiosError(error)) {
            // Если бэкенд вернет 404, когда смен нет, можно обработать это
            if (error.response?.status === 404) {
                console.log(`[courierApi] ℹ️ Смены для группы ${groupId} не найдены (404). Возвращаем пустой массив.`);
                return []; // Возвращаем пустой массив при 404
            }
            const detail = error.response?.data?.detail || error.message;
            throw new Error(detail || 'Ошибка при получении смен.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при получении смен.');
    }
};

// Интерфейс для данных бронирования смены (на вход API)
interface BookShiftApiData {
    date: string; // YYYY-MM-DD
    user_id: string;
    shift_type: 'day' | 'night';
    slot_index: number;
    chat_id?: string;
    existing_shift_id?: string;
}

/**
 * Бронирует или изменяет смену курьера.
 * @param data Данные для бронирования/изменения смены.
 */
export const bookShift = async (data: BookShiftApiData): Promise<ApiShift> => {
    console.log('[courierApi] 📡 Бронирование/изменение смены:', data);
    try {
        const response = await axiosInstance.post<ApiShift>('/couriers/shifts', data);
        console.log('[courierApi] ✅ Смена забронирована/изменена:', response.data);
        return response.data;
    } catch (error) {
        console.error('[courierApi] ❌ Ошибка при бронировании/изменении смены:', error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const responseData = error.response?.data;
            const detail = responseData?.detail;
            
            // Обрабатываем специфичные ошибки, которые были в shiftsSlice
            if (status === 409) { // Конфликт (ShiftConflictError)
                 throw new Error(detail || 'Слот уже занят другим курьером.');
            }
             if (status === 400 && responseData?.error === 'ShiftLimitError') { // Превышен лимит смен
                 throw new Error(detail || 'Вы уже записаны на максимальное количество смен.');
            }
             if (status === 400) { // Другие ошибки Bad Request
                 throw new Error(detail || 'Ошибка данных запроса для бронирования смены.');
            }
             if (status === 403) { // Forbidden (например, запись вне разрешенного окна)
                 throw new Error(detail || 'Запись на эту смену сейчас недоступна.');
            }
            
            throw new Error(detail || error.message || 'Ошибка при бронировании смены.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при бронировании смены.');
    }
};

/**
 * Отменяет смену курьера.
 * @param shiftId ID смены для отмены
 * @param chatId ID чата, в котором находится смена
 */
export const cancelShift = async (shiftId: string, chatId: string): Promise<{ success: boolean }> => {
    console.log(`[courierApi] 📡 Отмена смены ID: ${shiftId} в чате: ${chatId}`);
    try {
        // В DELETE запросах параметры обычно передаются в URL или как query params
        const response = await axiosInstance.delete(`/couriers/shifts/${shiftId}`, {
            params: { chat_id: chatId }
        });
        // Обычно DELETE возвращает 200 OK или 204 No Content при успехе
        console.log(`[courierApi] ✅ Смена ID: ${shiftId} отменена. Статус: ${response.status}`);
        return { success: true };
    } catch (error) {
        console.error(`[courierApi] ❌ Ошибка при отмене смены ID: ${shiftId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Смена не найдена.');
            }
            if (status === 403) {
                throw new Error(detail || 'У вас нет прав на отмену этой смены.');
            }
            throw new Error(detail || error.message || 'Ошибка при отмене смены.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при отмене смены.');
    }
};

// Интерфейс для настроек доступа к сменам (из shiftsSlice)
export interface AccessSettings {
    chat_id?: string;
    allowMultipleShifts?: boolean;
    autoApprove?: boolean;
    allowSameDay?: boolean;
    registrationStartDay?: number;
    registrationStartHour?: number;
    registrationStartMinute?: number;
    offsetType?: 'days' | 'weeks' | 'none';
    offsetAmount?: number;
    periodLength?: number;
    isAlwaysActive?: boolean;
    activeStartDate?: string;
    activeEndDate?: string;
    daysAhead?: number; // Устаревшее
    enabledDates?: string[];
    restrictedUsers?: (string | number)[];
    lastUpdated?: string;
    updatedBy?: string | number;
}

/**
 * Получает настройки доступа к записи на смены для чата.
 * @param chatId ID чата
 */
export const getShiftAccessSettings = async (chatId: string | number): Promise<AccessSettings> => {
    // Убираем некорректную замену '-100', parseInt сам справится с отрицательными числами
    const groupId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
    console.log(`[courierApi] 📡 Запрос настроек доступа для группы ID: ${groupId}`);
    try {
        // ИСПОЛЬЗУЕМ НОВЫЙ URL
        const response = await axiosInstance.get<AccessSettings>(`/api/v1/groups/${groupId}/settings`);
        console.log(`[courierApi] ✅ Настройки доступа для группы ${groupId} получены:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`[courierApi] ❌ Ошибка при запросе настроек доступа для группы ${groupId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            
            if (status === 404) {
                 throw new Error(detail || 'Группа не найдена или настройки для нее не установлены.');
            }
             if (status === 403) {
                 throw new Error(detail || 'У вас нет прав для просмотра настроек.');
            }
            
            throw new Error(detail || error.message || 'Ошибка при получении настроек доступа.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при получении настроек доступа.');
    }
};

/**
 * Обновляет настройки доступа к записи на смены для чата.
 * @param chatId ID чата
 * @param settings Новые настройки (или их часть)
 */
export const updateShiftAccessSettings = async (
    chatId: string | number, 
    settings: Partial<AccessSettings> // Позволяем обновлять часть настроек
): Promise<AccessSettings> => {
    // Убираем некорректную замену '-100', parseInt сам справится с отрицательными числами
    const groupId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
    console.log(`[courierApi] 📡 Обновление настроек доступа для группы ID: ${groupId}`, settings);
    try {
        // ИСПОЛЬЗУЕМ НОВЫЙ URL и метод PUT
        const response = await axiosInstance.put<AccessSettings>(`/api/v1/groups/${groupId}/settings`, settings);
        console.log(`[courierApi] ✅ Настройки доступа для группы ${groupId} обновлены:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`[courierApi] ❌ Ошибка при обновлении настроек доступа для группы ${groupId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            
             if (status === 400) {
                 throw new Error(detail || 'Неверный формат данных для обновления.');
            }
             if (status === 404) {
                 throw new Error(detail || 'Группа не найдена.');
            }
             if (status === 403) {
                 throw new Error(detail || 'У вас нет прав на изменение настроек.');
            }
             
            throw new Error(detail || error.message || 'Ошибка при обновлении настроек доступа.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при обновлении настроек доступа.');
    }
};

/**
 * Создает смену для пользователя по Telegram ID.
 */
export const createOrUpdateShift = async (shiftData: {
    date: string; // ISO string YYYY-MM-DD
    shift_type: 'day' | 'night';
    slot_index: number;
    user_telegram_id: number; // <<< ИЗМЕНЕНО: Telegram ID пользователя
    group_telegram_id: number; // <<< ИЗМЕНЕНО: Telegram ID группы
}) => {
    const { date, shift_type, slot_index, user_telegram_id, group_telegram_id } = shiftData;
    logger.info(`[courierApi] 📡 Создание смены для user ${user_telegram_id} in group ${group_telegram_id} on ${date}`,
        { date, shift_type, slot_index }
    );

    try {
        // Формируем тело запроса для схемы ShiftCreateTelegram
        const payload = {
            date,
            shift_type,
            slot_index,
            user_telegram_id, // <<< ИЗМЕНЕНО
            group_telegram_id // <<< ИЗМЕНЕНО
        };
        const response = await axiosInstance.post('/api/v1/shifts', payload);
        logger.info(`[courierApi] ✅ Смена успешно создана`, response.data);
        return response.data;
    } catch (error: any) {
        // const errorDetails = extractErrorDetails(error); 
        logger.error(`[courierApi] ❌ Ошибка при создании смены`, error);
        throw new Error(error?.message || 'Failed to create shift');
    }
};

// TODO: Добавить остальные функции API для курьеров
// - updateShiftAccessSettings

// TODO: Добавить остальные функции API для курьеров
// - getShifts
// - bookShift
// - cancelShift
// - getShiftAccessSettings
// - updateShiftAccessSettings
// - updateCourierProfile (перенести из api.ts)

// Интерфейс для объекта резерва, возвращаемого API (соответствует ReserveRead)
interface ApiReserve {
    id: string; // UUID
    user_id: string; // UUID пользователя из БД
    group_telegram_id: number;
    date: string; // YYYY-MM-DD
    created_at: string; // ISO timestamp
    user: {
        id: string; // UUID пользователя из БД
        telegram_id: number;
        first_name: string | null;
        last_name: string | null;
        photo_url: string | null;
        is_senior_courier: boolean | null;
    };
}

// Функция для загрузки резервов
export const getReserves = async (groupTelegramId: number, reserveDate?: string): Promise<any[]> => {
    try {
        // Проверка входных параметров
        if (!groupTelegramId) {
            console.error('[courierApi] ❌ Ошибка: не указан groupTelegramId для получения резервов');
            return [];
        }
        
        // Явно указываем параметры запроса
        const params: Record<string, any> = {
            group_telegram_id: groupTelegramId
        };
        
        // Если дата указана, добавляем её в параметры
        if (reserveDate) {
            params.reserve_date = reserveDate;
            console.log(`[courierApi] 📡 Запрос резервов для группы ${groupTelegramId} на дату ${reserveDate}`);
        } else {
            console.log(`[courierApi] 📡 Запрос ВСЕХ резервов для группы ${groupTelegramId}`);
        }
        
        console.log(`[courierApi] 🔍 Параметры запроса:`, params);
        console.log(`[courierApi] 🌐 URL: /api/v1/reserves, Params:`, params);
        
        // Создаем URL с параметрами для отладки
        let fullUrl = `/api/v1/reserves?group_telegram_id=${groupTelegramId}`;
        if (reserveDate) {
            fullUrl += `&reserve_date=${reserveDate}`;
        }
        console.log(`[courierApi] 🔍 Полный URL с параметрами: ${fullUrl}`);
        
        console.log(`[courierApi] 🚀 Отправка GET запроса...`);
        
        // Отправляем запрос с явно указанными параметрами
        const response = await axiosInstance.get('/api/v1/reserves', { params });
        
        // Логируем ответ для отладки
        console.log(`[courierApi] ✅ Получен ответ. Статус: ${response.status}`);
        console.log(`[courierApi] 📄 Заголовки ответа:`, response.headers);
        console.log(`[courierApi] 📦 Данные ответа:`, response.data);
        
        // Проверяем, что ответ - массив
        const reserves = Array.isArray(response.data) ? response.data : [];
        console.log(`[courierApi] 🔢 Количество полученных резервов: ${reserves.length}`);
        
        return reserves;
    } catch (error) {
        // Расширенная обработка ошибок
        if (axios.isAxiosError(error)) {
            console.error(`[courierApi] ❌ Ошибка Axios при получении резервов:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            // Если ошибка 404, возвращаем пустой массив
            if (error.response?.status === 404) {
                console.log(`[courierApi] ℹ️ Резервы не найдены (404), возвращаем пустой массив`);
                return [];
            }
        } else {
            console.error(`[courierApi] ❌ Неизвестная ошибка при получении резервов:`, error);
        }
        return [];
    }
};

/**
 * Удаляет резерв по ID.
 * @param reserveId ID резерва для удаления
 */
export const deleteReserve = async (reserveId: string): Promise<ApiReserve> => {
    logger.info(`[courierApi] 📡 Запрос на удаление резерва ID: ${reserveId}`);
    try {
        // Убедимся, что используем правильный URL
        const response = await axiosInstance.delete<ApiReserve>(`/api/v1/reserves/${reserveId}`); 
        logger.info(`[courierApi] ✅ Резерв ID: ${reserveId} удален`, response.data);
        return response.data; // Возвращаем удаленный объект резерва
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при удалении резерва ID: ${reserveId}`, error);
        // Можно добавить более детальную обработку ошибок 404, 403 и т.д.
        throw error;
    }
};

// Интерфейс для данных добавления в резерв
interface AddToReserveData {
    userTelegramId: number;
    groupTelegramId: number;
    date: string; // YYYY-MM-DD
}

/**
 * Добавляет пользователя в резерв на указанную дату.
 * @param data Данные для добавления в резерв
 */
export const addToReserve = async (data: AddToReserveData): Promise<ApiReserve> => {
    logger.info(`[courierApi] 📡 Запрос на добавление в резерв user ${data.userTelegramId} в группу ${data.groupTelegramId} на ${data.date}`);
    try {
        // Преобразуем ключи в snake_case для бэкенда
        const payload = {
            user_telegram_id: data.userTelegramId,
            group_telegram_id: data.groupTelegramId,
            reserve_date: data.date  // Изменяем поле date на reserve_date, как требует сервер
        };
        const response = await axiosInstance.post<ApiReserve>('/api/v1/reserves', payload);
        logger.info(`[courierApi] ✅ Пользователь ${data.userTelegramId} добавлен в резерв на ${data.date}`, response.data);
        return response.data;
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при добавлении в резерв user ${data.userTelegramId} на ${data.date}`, error);
        // Можно добавить обработку конфликтов (409 - уже в резерве?), 404 (пользователь/группа не найдены)
         if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
             if (status === 404) {
                 throw new Error(detail || 'Пользователь или группа не найдены.');
            }
             if (status === 409) { 
                 // Пользователь уже в резерве на эту дату
                 logger.warn(`[courierApi] ⚠️ Пользователь ${data.userTelegramId} уже находится в резерве на ${data.date}`);
                 throw new Error(detail || 'Вы уже находитесь в резерве на эту дату.');
            }
            throw new Error(detail || error.message || 'Ошибка при добавлении в резерв.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при добавлении в резерв.');
    }
};

// TODO: Добавить функцию для POST /reserves (addToReserve) 