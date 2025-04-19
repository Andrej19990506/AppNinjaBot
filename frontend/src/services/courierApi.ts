import axios, { AxiosError } from 'axios'; // Импортируем axios для isAxiosError
import { axiosInstance } from './api'; // <<< УБРАЛ ИМПОРТ extractErrorDetails
import { logger } from '../utils/logger'; // <<< ДОБАВЛЕН ИМПОРТ ЛОГГЕРА
import { axiosInstance as apiClient } from './api'; // <<< Используем axiosInstance из ./api и переименовываем в apiClient
import type { CourierShift } from '../types/shifts'; // <<< УДАЛЯЕМ ReserveEntry
// import { CourierProfile, CourierStatus } from '../types/courierTypes'; // <<< УБИРАЕМ ИМПОРТ ИЗ НЕСУЩЕСТВУЮЩЕГО ФАЙЛА

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
export interface ApiShift {
    id: string;
    user_id?: string; // Обрати внимание: в старом коде было userId, но API вероятно возвращает user_id
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
        // Убираем слеш в конце URL для предотвращения редиректа HTTP->HTTPS
        const response = await axiosInstance.get<ApiShift[]>('/api/v1/shifts', { 
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
// Обновляем поля в соответствии с ShiftCreateTelegram на бэкенде
interface BookShiftApiData {
    date: string; // YYYY-MM-DD
    // user_id: string; // <-- Старое поле
    user_telegram_id: number; // <-- Новое поле, тип number
    shift_type: 'day' | 'night';
    slot_index: number;
    // chat_id?: string; // <-- Старое поле
    group_telegram_id: number; // <-- Новое поле, тип number
    // Убираем existing_shift_id, т.к. этот эндпоинт только для создания
    // existing_shift_id?: string;
}

/**
 * Бронирует смену курьера (создание).
 * @param data Данные для бронирования смены.
 */
export const bookShift = async (data: BookShiftApiData): Promise<ApiShift> => {
    // Используем правильные поля user_telegram_id и group_telegram_id из data
    console.log('[courierApi] 📡 Бронирование смены:', data);
    try {
        // URL уже исправлен на /api/v1/shifts
        const response = await axiosInstance.post<ApiShift>('/api/v1/shifts', data);
        console.log('[courierApi] ✅ Смена забронирована:', response.data);
        return response.data;
    } catch (error) {
        console.error('[courierApi] ❌ Ошибка при бронировании смены:', error);
        // ... обработка ошибок ...
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
             if (status === 422) { // Ошибка валидации Pydantic
                 // Попробуем извлечь детали ошибки валидации
                 let validationErrors = 'Неверные данные';
                 if (responseData && Array.isArray(responseData.detail)) {
                     validationErrors = responseData.detail.map((err: any) => `${err.loc[err.loc.length-1]}: ${err.msg}`).join(', ');
                 }
                 throw new Error(validationErrors);
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
 * Отменяет (удаляет) смену старшим курьером.
 * 
 * @param shiftId - UUID смены для удаления.
 * @param requesterTelegramId - Telegram ID старшего курьера, выполняющего удаление.
 * @returns Promise<void>
 */
export const deleteShiftAsSenior = async (shiftId: string, requesterTelegramId: string): Promise<void> => {
    logger.log(`[courierApi] deleteShiftAsSenior: Attempting to delete shift ${shiftId} by senior ${requesterTelegramId}`);
    try {
        // <<< ИЗМЕНЕНИЕ: Используем правильный query параметр requester_telegram_id >>>
        const response = await axiosInstance.delete(`/api/v1/shifts/${shiftId}`, {
            params: { requester_telegram_id: requesterTelegramId } 
        });
        logger.log(`[courierApi] deleteShiftAsSenior: Shift ${shiftId} deleted successfully`, response.status);
        // 204 No Content не имеет тела ответа
    } catch (error: any) {
        const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
        logger.error(`[courierApi] ❌ Error deleting shift ${shiftId} as senior ${requesterTelegramId}:`, errorMessage, error.response?.status, error.response?.data);
        // Перебрасываем ошибку с более понятным сообщением, если возможно
        throw new Error(`Ошибка удаления смены старшим курьером: ${errorMessage}`);
    }
};

// --- СТАРЫЙ ВАРИАНТ (ОСТАВИМ НА ВСЯКИЙ СЛУЧАЙ, НО НЕ ИСПОЛЬЗУЕМ) ---
// export const cancelShift = async (shiftId: string, chatId: string): Promise<void> => {
//     logger.log(`[courierApi] Отмена смены ID: ${shiftId} для чата ${chatId}`);
//     try {
//         const response = await apiClient.delete(`/api/v1/shifts/${shiftId}?chat_id=${chatId}`);
//         logger.log('[courierApi] Смена успешно отменена', response.data);
//     } catch (error: any) {
//         logger.error(`[courierApi] ❌ Ошибка при отмене смены ID: ${shiftId}`, error);
//         throw new Error(error.response?.data?.detail || error.message || 'Не удалось отменить смену');
//     }
// };

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
        // Убираем слэш в конце URL
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

// ЭКСПОРТИРУЕМ ИНТЕРФЕЙС
export interface ApiReserve {
    id: string; // UUID записи резерва
    date: string; // YYYY-MM-DD
    created_at: string; // ISO timestamp
    member_id: number; // Внутренний ID участника (из БД)
    group_id: number;  // Внутренний ID группы (из БД)

    // Вложенный объект member (ОБЯЗАТЕЛЬНЫЙ, т.к. бэк его отдает через selectinload)
    member: { 
        id: number; // Внутренний ID участника (из БД)
        user_id: number; // <<< Telegram ID пользователя (судя по схеме ReserveMember)
        first_name: string | null;
        last_name: string | null;
        photo_url: string | null;
        is_senior_courier: boolean | null;
        username?: string | null; // Добавляем опциональные поля из схемы
        status?: string | null;
        is_bot?: boolean;
    };
    
    // Вложенный объект group (тоже ОБЯЗАТЕЛЬНЫЙ)
    group: {
        id: number; // Внутренний ID группы
        group_id: number; // <<< Telegram ID группы (из схемы ReserveGroup)
        title: string;
        group_type: string;
    };

    // Убираем поля, которых нет на верхнем уровне ответа GET /reserves
    // user_id?: string; 
    // group_telegram_id?: number;
}

// Функция для загрузки резервов
export const getReserves = async (groupTelegramId: string | number, reserveDate?: string): Promise<ApiReserve[]> => {
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
 * Удаляет резерв по ID от имени указанного пользователя (старшего курьера).
 * @param reserveId ID резерва для удаления
 * @param requesterTelegramId Telegram ID пользователя, выполняющего удаление
 */
export const deleteReserve = async (
    reserveId: string, 
    requesterTelegramId: number | string
): Promise<ApiReserve> => {
    logger.info(`[courierApi] 📡 Запрос на удаление резерва ID: ${reserveId} от имени ${requesterTelegramId}`);
    try {
        const response = await axiosInstance.delete<ApiReserve>(
            `/api/v1/reserves/${reserveId}`, 
            { 
                params: { requester_telegram_id: requesterTelegramId } // <<< Передаем ID запрашивающего
            }
        );
        logger.info(`[courierApi] ✅ Резерв ID: ${reserveId} удален пользователем ${requesterTelegramId}`, response.data);
        return response.data; // Возвращаем удаленный объект резерва
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при удалении резерва ID: ${reserveId} пользователем ${requesterTelegramId}`, error);
        // Добавляем более детальную обработку ошибок, как в бэкенде
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Запись резерва не найдена.');
            }
            if (status === 403) {
                throw new Error(detail || 'У вас нет прав старшего курьера для удаления этого резерва.');
            }
            throw new Error(detail || error.message || 'Ошибка при удалении резерва.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при удалении резерва.');
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

// --- Интерфейсы для Slot Config ---

// Конфигурация слотов для одного дня
export interface DaySlotConfig {
    maxDaySlots: number;
    maxNightSlots: number;
}

// Структура данных для обновления конфигурации (тело PUT запроса)
export interface SlotConfigUpdatePayload {
    config: Record<string, DaySlotConfig>; // Ключи '0'-'6'
}

// Структура данных ответа API (GET и PUT)
export interface SlotConfigResponse {
    config: Record<string, DaySlotConfig>; // Ключи '0'-'6'
}

// --- Функции API для Slot Config ---

/**
 * Получает конфигурацию слотов для указанной группы.
 * @param groupTelegramId Telegram ID группы
 */
export const getSlotConfig = async (groupTelegramId: number): Promise<SlotConfigResponse> => {
    logger.info(`[courierApi] 📡 Запрос конфигурации слотов для группы ID: ${groupTelegramId}`);
    try {
        const response = await axiosInstance.get<SlotConfigResponse>(`/api/v1/groups/${groupTelegramId}/slot_config`);
        logger.info(`[courierApi] ✅ Конфигурация слотов для группы ${groupTelegramId} получена:`, response.data);
        // Бэкенд возвращает {} если конфига нет, что соответствует SlotConfigResponse
        return response.data;
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при запросе конфигурации слотов для группы ${groupTelegramId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                // Можно вернуть пустой конфиг или пробросить ошибку
                logger.warn(`[courierApi] ⚠️ Группа ${groupTelegramId} не найдена или конфигурация отсутствует (404). Возвращаем пустой конфиг.`);
                return { config: {} }; // Возвращаем пустой конфиг, как и бэк при отсутствии
            }
            throw new Error(detail || error.message || 'Ошибка при получении конфигурации слотов.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при получении конфигурации слотов.');
    }
};

/**
 * Обновляет конфигурацию слотов для указанной группы.
 * @param groupTelegramId Telegram ID группы
 * @param slotConfigData Данные конфигурации для обновления
 */
export const updateSlotConfig = async (
    groupTelegramId: number,
    slotConfigData: SlotConfigUpdatePayload // Используем интерфейс для тела запроса
): Promise<SlotConfigResponse> => {
    logger.info(`[courierApi] 📡 Обновление конфигурации слотов для группы ID: ${groupTelegramId}`, slotConfigData);
    try {
        const response = await axiosInstance.put<SlotConfigResponse>(
            `/api/v1/groups/${groupTelegramId}/slot_config`,
            slotConfigData // Передаем данные в теле запроса
        );
        logger.info(`[courierApi] ✅ Конфигурация слотов для группы ${groupTelegramId} обновлена:`, response.data);
        return response.data;
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при обновлении конфигурации слотов для группы ${groupTelegramId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 400) {
                throw new Error(detail || 'Неверный формат данных для конфигурации слотов.');
            }
            if (status === 404) {
                throw new Error(detail || 'Группа не найдена.');
            }
            if (status === 403) {
                throw new Error(detail || 'У вас нет прав на изменение конфигурации слотов.');
            }
            throw new Error(detail || error.message || 'Ошибка при обновлении конфигурации слотов.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при обновлении конфигурации слотов.');
    }
};

// TODO: Добавить функцию для POST /reserves (addToReserve) 

// Интерфейс для данных обновления статуса старшего
interface UpdateSeniorityData {
    is_senior_courier: boolean;
}

// Интерфейс для ответа на обновление статуса старшего
interface UpdateSeniorityResponse {
    group_id: number;
    member_id: number;
    is_senior_courier: boolean | null;
    role: string;
}

/**
 * Обновляет статус старшего курьера для участника в группе.
 * @param groupTelegramId Telegram ID группы
 * @param userTelegramId Telegram ID пользователя
 * @param isSeniorCourier Новый статус старшего
 */
export const updateMemberSeniority = async (
    groupTelegramId: number | string, 
    userTelegramId: number | string, 
    isSeniorCourier: boolean
): Promise<UpdateSeniorityResponse> => {
    logger.info(`[courierApi] 📡 Обновление статуса старшего для user ${userTelegramId} в группе ${groupTelegramId} на ${isSeniorCourier}`);
    try {
        const data: UpdateSeniorityData = { is_senior_courier: isSeniorCourier };
        // Используем новый эндпоинт
        const response = await axiosInstance.put<UpdateSeniorityResponse>(
            `/api/v1/groups/${groupTelegramId}/members/${userTelegramId}/seniority`,
            data
        );
        logger.info('[courierApi] ✅ Статус старшего курьера обновлен:', response.data);
        return response.data;
    } catch (error) {
        logger.error('[courierApi] ❌ Ошибка при обновлении статуса старшего курьера:', error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Группа или участник не найдены.');
            }
             if (status === 403) {
                 throw new Error(detail || 'Доступ запрещен (возможно, нет прав администратора).');
            }
             if (status === 400) {
                 throw new Error(detail || 'Неверные данные запроса для обновления статуса.');
            }
            throw new Error(detail || error.message || 'Ошибка при обновлении статуса старшего курьера.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при обновлении статуса старшего курьера.');
    }
};

// Интерфейс для данных ответа резерва (если API возвращает созданный резерв)
export interface ApiReserve {
    id: string;
    user_id: string; 
    date: string; // YYYY-MM-DD
    chat_id: string;
    created_at: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    is_senior_courier?: boolean;
}

// Интерфейс для данных, отправляемых при создании резерва
interface AddReserveApiData {
    user_telegram_id: number;
    group_telegram_id: number;
    reserve_date: string; // YYYY-MM-DD
    // Можно добавить сюда доп.поля, если API их ожидает при создании
    // first_name?: string;
    // last_name?: string;
    // photo_url?: string;
    // is_senior_courier?: boolean;
}

/**
 * Создает новую запись в резерве.
 * @param data Данные для создания резерва.
 */
export const addReserve = async (data: AddReserveApiData): Promise<ApiReserve> => {
    logger.info('[courierApi] 📡 Создание записи в резерве:', data);
    try {
        const response = await axiosInstance.post<ApiReserve>('/api/v1/reserves', data);
        logger.info('[courierApi] ✅ Запись в резерв создана:', response.data);
        return response.data;
    } catch (error) {
        logger.error('[courierApi] ❌ Ошибка при создании записи в резерве:', error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const responseData = error.response?.data;
            const detail = responseData?.detail;

            if (status === 409) { // Конфликт (уже в резерве?)
                throw new Error(detail || 'Пользователь уже находится в резерве на эту дату.');
            }
            if (status === 400) { // Неверные данные
                throw new Error(detail || 'Ошибка данных запроса для добавления в резерв.');
            }
            if (status === 403) { // Запрещено (например, лимит резервов?)
                throw new Error(detail || 'Добавление в резерв сейчас недоступно.');
            }
            throw new Error(detail || error.message || 'Ошибка при добавлении в резерв.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при добавлении в резерв.');
    }
};

// Интерфейс для данных курьера, возвращаемых API
export interface CourierInfo {
    id: number;
    user_id: number;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    is_senior_courier: boolean | null;
    role: string | null;
    username: string | null;
}

/**
 * Получает список всех курьеров для группы (кроме запрашивающего пользователя).
 * @param groupTelegramId Telegram ID группы
 * @param requesterId Telegram ID запрашивающего пользователя (должен быть старшим курьером или создателем)
 * @returns Массив объектов CourierInfo с данными курьеров
 */
export const getGroupCouriers = async (
    groupTelegramId: number | string,
    requesterId: number | string
): Promise<CourierInfo[]> => {
    logger.info(`[courierApi] 📡 Запрос списка курьеров для группы ID: ${groupTelegramId}, запрашивает: ${requesterId}`);
    try {
        // Формируем URL без слеша на конце
        const response = await axiosInstance.get<CourierInfo[]>(`/api/v1/groups/${groupTelegramId}/couriers`, {
            params: { requester_id: requesterId }
        });
        logger.info(`[courierApi] ✅ Список курьеров для группы ${groupTelegramId} получен: ${response.data.length} курьеров`);
        return response.data;
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при запросе списка курьеров для группы ${groupTelegramId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            
            if (status === 404) {
                throw new Error(detail || 'Группа или пользователь не найдены.');
            }
            if (status === 403) {
                throw new Error(detail || 'Только старшие курьеры и создатели группы имеют доступ к списку курьеров.');
            }
            
            throw new Error(detail || error.message || 'Ошибка при получении списка курьеров.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при получении списка курьеров.');
    }
};

// ===> НОВАЯ ФУНКЦИЯ ДЛЯ ПЕРЕМЕЩЕНИЯ СМЕНЫ В РЕЗЕРВ <===

/**
 * Перемещает курьера из смены в резерв от имени старшего курьера.
 * @param shiftId ID смены для перемещения
 * @param requesterId Telegram ID пользователя (старшего курьера), выполняющего действие
 * @returns Данные созданной записи резерва (ApiReserve)
 */
export const moveShiftToReserve = async (
    shiftId: string, 
    requesterId: string | number
): Promise<ApiReserve> => {
    logger.info(`[courierApi] 📡 Запрос на перемещение смены ID: ${shiftId} в резерв от имени старшего курьера ID: ${requesterId}`);
    try {
        // Отправляем POST запрос на новый эндпоинт с ID старшего курьера в query параметрах
        const response = await axiosInstance.post<ApiReserve>(
            `/api/v1/shifts/${shiftId}/move_to_reserve`,
            null, // Тело запроса POST пустое
            { 
                params: { requester_telegram_id: requesterId } 
            }
        );
        logger.info(`[courierApi] ✅ Смена ID: ${shiftId} перемещена в резерв старшим курьером ${requesterId}. Создан резерв:`, response.data);
        return response.data; // Возвращаем данные созданного резерва
    } catch (error) {
        logger.error(`[courierApi] ❌ Ошибка при перемещении смены ID: ${shiftId} в резерв старшим курьером ${requesterId}`, error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            if (status === 404) {
                throw new Error(detail || 'Смена не найдена или связанные данные отсутствуют.');
            }
            if (status === 403) {
                // Эта ошибка означает, что requesterId не является старшим курьером ИЛИ пользователь/группа в ID запроса не найдены
                throw new Error(detail || 'Действие требует прав старшего курьера или указанный ID не найден.');
            }
            if (status === 409) {
                // Конфликт - курьер уже в резерве на эту дату
                throw new Error(detail || 'Курьер уже находится в резерве на эту дату.');
            }
            // Можно добавить обработку 500 ошибки, если бэкенд не смог создать резерв после удаления смены
             if (status === 500) {
                 throw new Error(detail || 'Внутренняя ошибка сервера при перемещении в резерв.');
            }
            throw new Error(detail || error.message || 'Ошибка при перемещении смены в резерв.');
        } else if (error instanceof Error) {
            throw error;
        }
        throw new Error('Неизвестная ошибка при перемещении смены в резерв.');
    }
};

// --- КОНЕЦ НОВОЙ ФУНКЦИИ ---

/**
 * Обновляет тип и/или слот существующей смены.
 * Требует прав старшего курьера.
 * @param shiftId ID смены для обновления (UUID)
 * @param requesterId Telegram ID пользователя, выполняющего действие
 * @param targetShiftType Новый тип смены ('day' или 'night')
 * @param targetSlotIndex Новый индекс слота (число)
 * @returns Обновленные данные смены (CourierShift)
 */
export const updateShiftSlot = async (
    shiftId: string,
    requesterId: string, 
    targetShiftType: 'day' | 'night',
    targetSlotIndex: number
): Promise<CourierShift> => {
    try {
        logger.info(`[API updateShiftSlot] Attempting to update shift ${shiftId} by ${requesterId} to ${targetShiftType} slot ${targetSlotIndex}`);
        
        const response = await apiClient.patch<CourierShift>(
            `/api/v1/shifts/${shiftId}/move?requester_telegram_id=${requesterId}`,
            { target_shift_type: targetShiftType, target_slot_index: targetSlotIndex } 
        );
        
        logger.info("[API updateShiftSlot] Shift updated successfully:", response.data);
        return response.data;
        
    } catch (error: any) { 
        logger.error(`[API updateShiftSlot] Error updating shift ${shiftId}:`, error?.response?.data || error.message);
        throw error;
    }
};