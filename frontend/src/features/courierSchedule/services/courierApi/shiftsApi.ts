// --- shiftsApi.ts ---
// API-функции для работы со сменами (shifts)

import { axiosInstance } from '@shared/api/api';
import { logger } from '@shared/utils/logger';
import {
  ApiShift,
  AccessSettings,
  SlotConfigResponse,
  SlotConfigUpdatePayload,
  CourierShift,
  BookShiftApiData,
  AssignCourierApiData,
  AvailablePeriodResponse,
  ApiReserve
} from '@features/courierSchedule/types/courierScheduleTypes';
import { TimesheetResponse } from '@features/courierSchedule/types/timesheet';

// Получить список смен
export const getShifts = async (chatId: number | string): Promise<ApiShift[]> => {
  const groupId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
  if (isNaN(groupId)) {
    logger.error('[shiftsApi] ❌ Invalid groupId provided for getShifts', { chatId });
    throw new Error('Invalid Group ID');
  }
  logger.info(`[shiftsApi] 📡 Запрос смен для группы ID: ${groupId}`);
  try {
    const response = await axiosInstance.get<ApiShift[]>('/v1/shifts', {
      params: { group_telegram_id: groupId }
    });
    return response.data || [];
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      if (axiosError.response?.status === 404) {
        return [];
      }
      const detail = axiosError.response?.data?.detail || axiosError.message;
      throw new Error(detail || 'Ошибка при получении смен.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при получении смен.');
  }
};

// Бронирование смены
export const bookShift = async (data: BookShiftApiData): Promise<ApiShift> => {
  try {
    const response = await axiosInstance.post<ApiShift>('/v1/shifts', data);
    return response.data;
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;
      const detail = responseData?.detail;
      if (status === 409) {
        throw new Error(detail || 'Слот уже занят другим курьером.');
      }
      if (status === 400 && responseData?.error === 'ShiftLimitError') {
        throw new Error(detail || 'Вы уже записаны на максимальное количество смен.');
      }
      if (status === 422) {
        let validationErrors = 'Неверные данные';
        if (responseData && Array.isArray(responseData.detail)) {
          validationErrors = responseData.detail.map((err: any) => `${err.loc[err.loc.length-1]}: ${err.msg}`).join(', ');
        }
        throw new Error(validationErrors);
      }
      if (status === 400) {
        // Специальная обработка для ошибки настроек группы
        if (detail && detail.includes('Настройки группы не настроены')) {
          throw new Error(detail); // Передаем оригинальное сообщение об ошибке
        }
        throw new Error(detail || 'Ошибка данных запроса для бронирования смены.');
      }
      if (status === 403) {
        throw new Error(detail || 'Запись на эту смену сейчас недоступна.');
      }
      throw new Error(detail || axiosError.message || 'Ошибка при бронировании смены.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при бронировании смены.');
  }
};

// Удаление смены старшим курьером
export const deleteShiftAsSenior = async (shiftId: string, requesterTelegramId: string): Promise<void> => {
  logger.log(`[shiftsApi] deleteShiftAsSenior: Attempting to delete shift ${shiftId} by senior ${requesterTelegramId}`);
  try {
    await axiosInstance.delete(`/v1/shifts/${shiftId}`, {
      params: { requester_telegram_id: requesterTelegramId }
    });
    logger.log(`[shiftsApi] deleteShiftAsSenior: Shift ${shiftId} deleted successfully`);
    return;
  } catch (error: any) {
    const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
    logger.error(`[shiftsApi] ❌ Error deleting shift ${shiftId} as senior ${requesterTelegramId}:`, errorMessage, error.response?.status, error.response?.data);
    throw new Error(`Ошибка удаления смены старшим курьером: ${errorMessage}`);
  }
};

// Получить настройки доступа к сменам
export const getShiftAccessSettings = async (chatId: string | number): Promise<AccessSettings> => {
  const groupId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
  logger.info(`[shiftsApi] 📡 Запрос настроек доступа для группы ID: ${groupId}`);
  try {
    const response = await axiosInstance.get<AccessSettings>(`/v1/groups/${groupId}/settings`);
    return response.data;
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 404) {
        throw new Error('SETTINGS_NOT_CONFIGURED: ' + (detail || 'Группа не найдена или настройки для нее не установлены.'));
      }
      if (status === 403) {
        throw new Error(detail || 'У вас нет прав для просмотра настроек.');
      }
      throw new Error(detail || axiosError.message || 'Ошибка при получении настроек доступа.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при получении настроек доступа.');
  }
};

// Обновить настройки доступа к сменам
export const updateShiftAccessSettings = async (
  chatId: string | number,
  settings: Partial<AccessSettings>
): Promise<AccessSettings> => {
  const groupId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
  logger.info(`[shiftsApi] 📡 Обновление настроек доступа для группы ID: ${groupId}`);
  try {
    const response = await axiosInstance.put<AccessSettings>(`/v1/groups/${groupId}/settings`, settings);
    return response.data;
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 400) {
        throw new Error(detail || 'Неверный формат данных для обновления.');
      }
      if (status === 404) {
        throw new Error(detail || 'Группа не найдена.');
      }
      if (status === 403) {
        throw new Error(detail || 'У вас нет прав на изменение настроек.');
      }
      throw new Error(detail || axiosError.message || 'Ошибка при обновлении настроек доступа.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при обновлении настроек доступа.');
  }
};

// Создать или обновить смену
export const createOrUpdateShift = async (shiftData: {
  date: string;
  shift_type: 'day' | 'night';
  slot_index: number;
  user_telegram_id: number;
  group_telegram_id: number;
}) => {
  const { date, shift_type, slot_index, user_telegram_id, group_telegram_id } = shiftData;
  logger.info(`[shiftsApi] 📡 Создание смены для user ${user_telegram_id} in group ${group_telegram_id} on ${date}`);
  try {
    const payload = {
      date,
      shift_type,
      slot_index,
      user_telegram_id,
      group_telegram_id
    };
    const response = await axiosInstance.post('/v1/shifts', payload);
    logger.info(`[shiftsApi] ✅ Смена успешно создана`, response.data);
    return response.data;
  } catch (error: any) {
    logger.error(`[shiftsApi] ❌ Ошибка при создании смены`, error);
    throw new Error(error?.message || 'Failed to create shift');
  }
};

// Получить конфиг слотов
export const getSlotConfig = async (groupTelegramId: number): Promise<SlotConfigResponse> => {
  logger.info(`[shiftsApi] 📡 Запрос конфигурации слотов для группы ID: ${groupTelegramId}`);
  try {
    const response = await axiosInstance.get<SlotConfigResponse>(`/v1/groups/${groupTelegramId}/slot_config`);
    return response.data;
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 404) {
        return { config: {} };
      }
      throw new Error(detail || axiosError.message || 'Ошибка при получении конфигурации слотов.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при получении конфигурации слотов.');
  }
};

// Обновить конфиг слотов
export const updateSlotConfig = async (
  groupTelegramId: number,
  slotConfigData: SlotConfigUpdatePayload
): Promise<SlotConfigResponse> => {
  logger.info(`[shiftsApi] 📡 Обновление конфигурации слотов для группы ID: ${groupTelegramId}`);
  try {
    const response = await axiosInstance.put<SlotConfigResponse>(
      `/v1/groups/${groupTelegramId}/slot_config`,
      slotConfigData
    );
    return response.data;
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 400) {
        throw new Error(detail || 'Неверный формат данных для конфигурации слотов.');
      }
      if (status === 404) {
        throw new Error(detail || 'Группа не найдена.');
      }
      if (status === 403) {
        throw new Error(detail || 'У вас нет прав на изменение конфигурации слотов.');
      }
      throw new Error(detail || axiosError.message || 'Ошибка при обновлении конфигурации слотов.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при обновлении конфигурации слотов.');
  }
};

// Обновить слот смены (переместить)
export const updateShiftSlot = async (
  shiftId: string,
  requesterId: string,
  targetShiftType: 'day' | 'night',
  targetSlotIndex: number
): Promise<CourierShift> => {
  try {
    const response = await axiosInstance.patch<CourierShift>(
      `/v1/shifts/${shiftId}/move?requester_telegram_id=${requesterId}`,
      { target_shift_type: targetShiftType, target_slot_index: targetSlotIndex }
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

// Назначить курьера на слот
export const assignCourierToShift = async (data: AssignCourierApiData): Promise<ApiShift> => {
  logger.info(`[shiftsApi] 📡 Назначение курьера ${data.target_user_telegram_id} на слот ${data.shift_type}-${data.slot_index} от ${data.assigner_telegram_id}`);
  try {
    const response = await axiosInstance.post<ApiShift>('/v1/shifts/assign', data);
    logger.info(`[shiftsApi] ✅ Курьер успешно назначен через API:`, response.data);
    return response.data;
  } catch (error) {
    logger.error(`[shiftsApi] ❌ Ошибка при назначении курьера через API:`, error);
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 404) {
        throw new Error(detail || 'Группа или один из пользователей не найдены.');
      }
      if (status === 403) {
        throw new Error(detail || 'Действие требует прав старшего курьера.');
      }
      if (status === 409) {
        throw new Error(detail || 'Целевой слот уже занят.');
      }
      if (status === 422) {
        throw new Error(detail || 'Ошибка валидации данных.');
      }
      throw new Error(detail || axiosError.message || 'Ошибка при назначении курьера.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при назначении курьера.');
  }
};

// Получить данные табеля
export const getTimesheetData = async (
  groupTelegramId: number | string,
  options?: { params?: Record<string, any> }
): Promise<TimesheetResponse> => {
  logger.info(`[shiftsApi] 📡 Запрос данных табеля для группы ${groupTelegramId}`);
  try {
    const response = await axiosInstance.get<TimesheetResponse>('/v1/shifts/timesheets', {
      params: {
        group_telegram_id: groupTelegramId,
        ...(options?.params || {})
      }
    });
    return response.data || { columns: [], rows: [] };
  } catch (error) {
    logger.error(`[shiftsApi] ❌ Ошибка при запросе табеля для группы ${groupTelegramId}`, error);
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      if (axiosError.response?.status === 404) {
        return { columns: [], rows: [] };
      }
      const detail = axiosError.response?.data?.detail || axiosError.message;
      throw new Error(detail || 'Ошибка при получении данных табеля.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при получении данных табеля.');
  }
};

// Получить доступные периоды табеля
export const getAvailableTimesheetPeriods = async (
  groupTelegramId: number | string
): Promise<AvailablePeriodResponse[]> => {
  logger.info(`[shiftsApi] 📡 Запрос доступных периодов для табеля группы ${groupTelegramId}`);
  try {
    const response = await axiosInstance.get<AvailablePeriodResponse[]>(
      `/v1/shifts/available-periods`,
      { params: { group_telegram_id: groupTelegramId } }
    );
    return (response.data || []).map(period => ({
      ...period,
      month: period.month - 1
    }));
  } catch (error) {
    logger.error(`[shiftsApi] ❌ Ошибка при запросе доступных периодов для группы ${groupTelegramId}`, error);
    return [];
  }
};

// Запросить отправку табеля через бота
export const requestTimesheetViaBot = async ({
  groupTelegramId,
  userId,
  destination,
  year,
  month,
  is_weekly
}: {
  groupTelegramId: number | string;
  userId: number | string;
  destination: 'user' | 'group';
  year?: number;
  month?: number;
  is_weekly?: boolean;
}): Promise<{ status: string; message: string }> => {
  logger.info(`[shiftsApi] 📡 Запрос на отправку табеля через бота для группы ID: ${groupTelegramId} от пользователя ID: ${userId}, назначение: ${destination}`);
  const params = new URLSearchParams({
    requester_telegram_id: String(userId),
    destination: destination,
  });
  if (year !== undefined) params.set('year', String(year));
  if (month !== undefined) params.set('month', String(month));
  if (is_weekly !== undefined) params.set('is_weekly', String(is_weekly).toLowerCase());
  const endpoint = `/v1/shifts/groups/${groupTelegramId}/timesheet/send-to-bot?${params.toString()}`;
  try {
    const response = await axiosInstance.post(endpoint);
    if (response.status === 202 && response.data) {
      return response.data;
    } else {
      throw new Error(`Неожиданный ответ от сервера: ${response.status}`);
    }
  } catch (error) {
    if ((error as any).isAxiosError) {
      const axiosError = error as any;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 404) {
        throw new Error(detail || 'Группа не найдена.');
      }
      if (status === 403) {
        throw new Error(detail || 'Доступ запрещен. У вас нет прав?');
      }
      if (status === 400) {
        throw new Error(detail || 'Ошибка данных запроса. Возможно, не найден ID пользователя Telegram или неверное назначение.');
      }
      throw new Error(detail || axiosError.message || 'Ошибка при запросе отправки табеля.');
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при запросе отправки табеля.');
  }
};

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
    try {
        const response = await axiosInstance.post<ApiReserve>(
            `/v1/shifts/${shiftId}/move_to_reserve`,
            null,
            { params: { requester_telegram_id: requesterId } }
        );
        return response.data;
    } catch (error: any) {
        throw error;
    }
}; 