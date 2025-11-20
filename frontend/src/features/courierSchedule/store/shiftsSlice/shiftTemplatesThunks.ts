import { createAsyncThunk } from '@reduxjs/toolkit';
import { 
    ShiftTemplate, 
    ShiftTemplateCreatePayload, 
    ShiftTemplateUpdatePayload,
    ShiftTemplateApplyPayload 
} from '@features/courierSchedule/types/courierScheduleTypes';
import {
    fetchShiftTemplates,
    createShiftTemplate,
    updateShiftTemplate,
    deleteShiftTemplate,
    applyShiftTemplates,
    getShiftTemplatesForDay,
    getAppliedShiftTemplates,
    removeShiftTemplatesFromDays
} from '@features/courierSchedule/services/courierApi/shiftTemplatesApi';

// Получить все шаблоны смен
export const fetchShiftTemplatesThunk = createAsyncThunk(
    'shifts/fetchShiftTemplates',
    async (chatId: number, { rejectWithValue }) => {
        try {
            const templates = await fetchShiftTemplates(chatId);
            return templates;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось загрузить шаблоны смен');
        }
    }
);

// Создать шаблон смены
// Теперь возвращает массив шаблонов (по одному на каждый выбранный день недели)
export const createShiftTemplateThunk = createAsyncThunk(
    'shifts/createShiftTemplate',
    async ({ chatId, templateData }: { chatId: number; templateData: ShiftTemplateCreatePayload }, { rejectWithValue }) => {
        try {
            const templates = await createShiftTemplate(chatId, templateData);
            return templates; // Возвращаем массив шаблонов
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось создать шаблон смены');
        }
    }
);

// Обновить шаблон смены
export const updateShiftTemplateThunk = createAsyncThunk(
    'shifts/updateShiftTemplate',
    async ({ templateId, templateData }: { templateId: string; templateData: ShiftTemplateUpdatePayload }, { rejectWithValue }) => {
        try {
            const template = await updateShiftTemplate(templateId, templateData);
            return template;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось обновить шаблон смены');
        }
    }
);

// Удалить шаблон смены
export const deleteShiftTemplateThunk = createAsyncThunk(
    'shifts/deleteShiftTemplate',
    async (templateId: string, { rejectWithValue }) => {
        try {
            await deleteShiftTemplate(templateId);
            return templateId;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось удалить шаблон смены');
        }
    }
);

// Применить шаблоны к дням недели
export const applyShiftTemplatesThunk = createAsyncThunk(
    'shifts/applyShiftTemplates',
    async ({ chatId, applyData }: { chatId: number; applyData: ShiftTemplateApplyPayload }, { rejectWithValue }) => {
        try {
            await applyShiftTemplates(chatId, applyData);
            return applyData;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось применить шаблоны смен');
        }
    }
);

// Загрузить все шаблоны смен для всех дней недели
export const fetchAllShiftTemplatesThunk = createAsyncThunk(
    'shifts/fetchAllShiftTemplates',
    async (params: number | { chatId: number; forDate?: string }, { rejectWithValue, getState }) => {
        try {
            // Поддерживаем старый формат (только chatId) и новый (объект с chatId и forDate)
            const chatId = typeof params === 'number' ? params : params.chatId;
            const providedForDate = typeof params === 'object' ? params.forDate : undefined;
            
            // Загружаем общий список шаблонов
            const allTemplates = await fetchShiftTemplates(chatId);
            
            // Определяем дату для версии шаблона
            let forDate: string | undefined = providedForDate;
            
            // Если forDate не передан, вычисляем его на основе периода
            if (!forDate) {
                // Получаем accessSettings из состояния для определения даты начала периода
                const state = getState() as any;
                const accessSettings = state.shifts?.accessSettings;
                
                if (accessSettings) {
                    // Импортируем функции для расчета периодов
                    const { getCurrentBookingPeriod, getNextBookingPeriod, calculateAvailableDates } = await import('@features/courierSchedule/components/courier-calendar/utils/dateUtils');
                    const currentPeriod = getCurrentBookingPeriod(accessSettings);
                    const nextPeriod = getNextBookingPeriod(accessSettings);
                    const availableDates = calculateAvailableDates(accessSettings);
                    
                    const now = new Date();
                    const todayStr = now.toISOString().split('T')[0];
                    
                    // Определяем, какой период активен (открыт для записи)
                    // Используем дату начала текущего периода, если она есть в доступных датах
                    // Иначе используем дату начала следующего периода
                    if (currentPeriod) {
                        const currentPeriodStartStr = currentPeriod.startDate.toISOString().split('T')[0];
                        // Проверяем, есть ли дата начала текущего периода в доступных датах
                        if (availableDates.includes(currentPeriodStartStr)) {
                            // Текущий период открыт для записи, используем его дату начала
                            forDate = currentPeriodStartStr;
                            console.log(`[fetchAllShiftTemplatesThunk] Using current period start date for version: ${forDate} (period: ${currentPeriod.startDateStr} - ${currentPeriod.endDateStr}, available)`);
                        } else if (nextPeriod) {
                            // Текущий период еще не открыт, используем дату начала следующего периода
                            forDate = nextPeriod.startDate.toISOString().split('T')[0];
                            console.log(`[fetchAllShiftTemplatesThunk] Current period not available, using next period start date for version: ${forDate} (period: ${nextPeriod.startDateStr} - ${nextPeriod.endDateStr})`);
                        } else {
                            // Используем дату начала текущего периода в любом случае
                            forDate = currentPeriodStartStr;
                            console.log(`[fetchAllShiftTemplatesThunk] Using current period start date for version: ${forDate} (period: ${currentPeriod.startDateStr} - ${currentPeriod.endDateStr}, no next period)`);
                        }
                    } else if (nextPeriod) {
                        // Используем дату начала следующего периода
                        forDate = nextPeriod.startDate.toISOString().split('T')[0];
                        console.log(`[fetchAllShiftTemplatesThunk] Using next period start date for version: ${forDate} (period: ${nextPeriod.startDateStr} - ${nextPeriod.endDateStr})`);
                    } else {
                        // Если периодов нет, используем текущую дату
                        forDate = todayStr;
                        console.log(`[fetchAllShiftTemplatesThunk] No periods found, using today for version: ${forDate}`);
                    }
                } else {
                    // Если accessSettings нет, используем текущую дату
                    const now = new Date();
                    forDate = now.toISOString().split('T')[0];
                    console.log(`[fetchAllShiftTemplatesThunk] No accessSettings, using today for version: ${forDate}`);
                }
            } else {
                console.log(`[fetchAllShiftTemplatesThunk] Using provided forDate: ${forDate}`);
            }
            
            // Загружаем примененные шаблоны для дней с указанием даты для версии
            const templatesByDay = await getAppliedShiftTemplates(chatId, forDate);
            
            console.log('[fetchAllShiftTemplatesThunk] Templates loaded:', {
                forDate,
                allTemplatesCount: allTemplates.length,
                templatesByDay: Object.keys(templatesByDay).map(day => ({
                    day: Number(day),
                    templatesCount: templatesByDay[Number(day)]?.length || 0,
                    templates: templatesByDay[Number(day)]?.map(t => ({
                        id: t.id,
                        name: t.name,
                        maxSlots: t.maxSlots,
                        startTime: t.startTime,
                        endTime: t.endTime
                    })) || []
                }))
            });
            
            return {
                allTemplates,
                templatesByDay
            };
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось загрузить шаблоны смен');
        }
    }
);

// Отменить применение шаблонов к дням недели (деактивировать)
export const removeShiftTemplatesFromDaysThunk = createAsyncThunk(
    'shifts/removeShiftTemplatesFromDays',
    async (
        { chatId, templateIds, daysOfWeek }: { chatId: number; templateIds: string[]; daysOfWeek: number[] },
        { rejectWithValue }
    ) => {
        try {
            const result = await removeShiftTemplatesFromDays(chatId, templateIds, daysOfWeek);
            return result;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось отменить применение шаблонов смен');
        }
    }
);
