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
    getAppliedShiftTemplates
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
export const createShiftTemplateThunk = createAsyncThunk(
    'shifts/createShiftTemplate',
    async ({ chatId, templateData }: { chatId: number; templateData: ShiftTemplateCreatePayload }, { rejectWithValue }) => {
        try {
            const template = await createShiftTemplate(chatId, templateData);
            return template;
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
    async (chatId: number, { rejectWithValue }) => {
        try {
            // Загружаем общий список шаблонов
            const allTemplates = await fetchShiftTemplates(chatId);
            
            // Загружаем примененные шаблоны для дней
            const templatesByDay = await getAppliedShiftTemplates(chatId);
            
            return {
                allTemplates,
                templatesByDay
            };
        } catch (error: any) {
            return rejectWithValue(error.message || 'Не удалось загрузить шаблоны смен');
        }
    }
);
