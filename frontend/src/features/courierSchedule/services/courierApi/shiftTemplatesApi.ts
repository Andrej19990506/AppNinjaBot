import { axiosInstance } from '@shared/api/api';
import { 
    ShiftTemplate, 
    ShiftTemplateCreatePayload, 
    ShiftTemplateUpdatePayload, 
    ShiftTemplateResponse,
    ShiftTemplateApplyPayload 
} from '@features/courierSchedule/types/courierScheduleTypes';

// Функция для преобразования snake_case в camelCase
const transformServerTemplate = (serverTemplate: any): ShiftTemplate => ({
    id: serverTemplate.id,
    name: serverTemplate.name,
    description: serverTemplate.description,
    startTime: serverTemplate.start_time,
    endTime: serverTemplate.end_time,
    maxSlots: serverTemplate.max_slots,
    hasSeniorSlot: serverTemplate.has_senior_slot,
    isActive: serverTemplate.is_active || true,
    daysOfWeek: serverTemplate.days_of_week || [],
    createdAt: serverTemplate.created_at,
    updatedAt: serverTemplate.updated_at,
    futureVersion: serverTemplate.future_version ? {
        id: serverTemplate.future_version.id,
        validFromDate: serverTemplate.future_version.valid_from_date,
        maxSlots: serverTemplate.future_version.max_slots,
        startTime: serverTemplate.future_version.start_time,
        endTime: serverTemplate.future_version.end_time,
        hasSeniorSlot: serverTemplate.future_version.has_senior_slot
    } : undefined
});

// Получить все шаблоны смен
export const fetchShiftTemplates = async (chatId: number): Promise<ShiftTemplate[]> => {
    try {
        const response = await axiosInstance.get<any>(`/v1/shift-templates?chat_id=${chatId}`);
        const serverTemplates = response.data.templates || [];
        return serverTemplates.map(transformServerTemplate);
    } catch (error) {
        console.error('Error fetching shift templates:', error);
        throw new Error('Не удалось загрузить шаблоны смен');
    }
};

// Создать новый шаблон смены
export const createShiftTemplate = async (
    chatId: number, 
    templateData: ShiftTemplateCreatePayload
): Promise<ShiftTemplate[]> => {
    try {
        // Преобразуем camelCase в snake_case для сервера
        const serverData = {
            name: templateData.name,
            description: templateData.description || null,
            start_time: templateData.startTime,
            end_time: templateData.endTime,
            max_slots: templateData.maxSlots,
            has_senior_slot: templateData.hasSeniorSlot,
            days_of_week: templateData.daysOfWeek,
            template_metadata: null
        };
        
        const response = await axiosInstance.post<any[]>(`/v1/shift-templates?chat_id=${chatId}`, serverData);
        // Сервер теперь возвращает массив шаблонов (по одному на каждый день недели)
        if (Array.isArray(response.data)) {
            return response.data.map(template => transformServerTemplate(template));
        } else {
            // Обратная совместимость: если сервер вернул один объект
            return [transformServerTemplate(response.data)];
        }
    } catch (error) {
        console.error('Error creating shift template:', error);
        throw new Error('Не удалось создать шаблон смены');
    }
};

// Обновить шаблон смены
export const updateShiftTemplate = async (
    templateId: string, 
    templateData: ShiftTemplateUpdatePayload
): Promise<ShiftTemplate> => {
    try {
        // Преобразуем camelCase в snake_case для сервера
        const serverData: any = {};
        if (templateData.name !== undefined) serverData.name = templateData.name;
        if (templateData.description !== undefined) serverData.description = templateData.description;
        if (templateData.startTime !== undefined) serverData.start_time = templateData.startTime;
        if (templateData.endTime !== undefined) serverData.end_time = templateData.endTime;
        if (templateData.maxSlots !== undefined) serverData.max_slots = templateData.maxSlots;
        if (templateData.hasSeniorSlot !== undefined) serverData.has_senior_slot = templateData.hasSeniorSlot;
        if (templateData.isActive !== undefined) serverData.is_active = templateData.isActive;
        if (templateData.daysOfWeek !== undefined) serverData.days_of_week = templateData.daysOfWeek;
        // ВАЖНО: Передаем период применения изменений
        if (templateData.applyToPeriod !== undefined) serverData.apply_to_period = templateData.applyToPeriod;
        
        console.log('[updateShiftTemplate] Sending data:', { templateId, serverData, originalData: templateData });
        
        const response = await axiosInstance.put<any>(`/v1/shift-templates/${templateId}`, serverData);
        return transformServerTemplate(response.data);
    } catch (error) {
        console.error('Error updating shift template:', error);
        throw new Error('Не удалось обновить шаблон смены');
    }
};

// Удалить шаблон смены
export const deleteShiftTemplate = async (templateId: string): Promise<{
    deleted: boolean;
    has_future_shifts: boolean;
    shifts_count?: number;
    message: string;
}> => {
    try {
        const response = await axiosInstance.delete(`/v1/shift-templates/${templateId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting shift template:', error);
        throw new Error('Не удалось удалить шаблон смены');
    }
};

// Применить шаблоны к дням недели
export const applyShiftTemplates = async (
    chatId: number, 
    applyData: ShiftTemplateApplyPayload
): Promise<void> => {
    try {
        // Преобразуем camelCase в snake_case для сервера
        const serverData = {
            template_ids: applyData.templateIds,
            days_of_week: [applyData.dayOfWeek]  // Преобразуем в массив, как ожидает сервер
        };
        
        await axiosInstance.post(`/v1/shift-templates/apply?chat_id=${chatId}`, serverData);
    } catch (error) {
        console.error('Error applying shift templates:', error);
        throw new Error('Не удалось применить шаблоны смен');
    }
};

// Получить шаблоны для конкретного дня недели
export const getShiftTemplatesForDay = async (
    chatId: number, 
    dayIndex: number
): Promise<ShiftTemplate[]> => {
    try {
        const response = await axiosInstance.get<any>(`/v1/shift-templates/day/${dayIndex}?chat_id=${chatId}`);
        const serverTemplates = response.data.templates || [];
        return serverTemplates.map(transformServerTemplate);
    } catch (error) {
        console.error('Error fetching shift templates for day:', error);
        throw new Error('Не удалось загрузить шаблоны смен для дня');
    }
};

// Получить примененные шаблоны смен для всех дней недели
export const getAppliedShiftTemplates = async (
    chatId: number, 
    forDate?: string // Дата для определения версии шаблона (YYYY-MM-DD)
): Promise<{ [key: number]: ShiftTemplate[] }> => {
    try {
        let url = `/v1/shift-templates/applied?chat_id=${chatId}`;
        if (forDate) {
            url += `&for_date=${forDate}`;
        }
        console.log('[getAppliedShiftTemplates] Requesting templates with forDate:', forDate);
        const response = await axiosInstance.get(url);
        const serverData = response.data;
        
        console.log('[getAppliedShiftTemplates] Raw server response:', serverData);
        
        // Преобразуем данные с сервера в формат фронтенда
        const templatesByDay: { [key: number]: ShiftTemplate[] } = {};
        
        for (const [dayOfWeekStr, templates] of Object.entries(serverData)) {
            const dayOfWeek = parseInt(dayOfWeekStr);
            const transformedTemplates = (templates as any[]).map(transformServerTemplate);
            templatesByDay[dayOfWeek] = transformedTemplates;
            
            const templatesInfo = transformedTemplates.map(t => ({ id: t.id, name: t.name, maxSlots: t.maxSlots }));
            console.log(`[getAppliedShiftTemplates] Day ${dayOfWeek} templates:`, templatesInfo);
            
            // Особое внимание к субботе (day 6) - проверяем версию
            if (dayOfWeek === 6) {
                console.log(`[getAppliedShiftTemplates] 🔍 SATURDAY (day 6) - Raw server data:`, templates);
                console.log(`[getAppliedShiftTemplates] 🔍 SATURDAY (day 6) - Transformed:`, JSON.stringify(templatesInfo, null, 2));
            }
        }
        
        return templatesByDay;
    } catch (error) {
        console.error('Error fetching applied shift templates:', error);
        throw new Error('Не удалось загрузить примененные шаблоны смен');
    }
};

// Отменить применение шаблонов к дням недели (деактивировать)
export const removeShiftTemplatesFromDays = async (
    chatId: number,
    templateIds: string[],
    daysOfWeek: number[]
): Promise<{ 
    message: string; 
    warning?: string; 
    has_future_shifts?: boolean; 
    templates_with_shifts?: any[];
    templates_deactivated_for_next_period?: any[];
    deactivated_count?: number;
    skipped_count?: number;
}> => {
    try {
        const serverData = {
            template_ids: templateIds,
            days_of_week: daysOfWeek
        };
        
        const response = await axiosInstance.post(`/v1/shift-templates/remove-from-days?chat_id=${chatId}`, serverData);
        
        return response.data;
    } catch (error: any) {
        console.error('Error removing shift templates from days:', error);
        throw new Error(error.response?.data?.detail || 'Не удалось отменить применение шаблонов смен');
    }
};

// Удалить версию шаблона
export const deleteTemplateVersion = async (versionId: string): Promise<void> => {
    try {
        await axiosInstance.delete(`/v1/shift-templates/versions/${versionId}`);
    } catch (error: any) {
        console.error('Error deleting template version:', error);
        throw new Error(error.response?.data?.detail || 'Не удалось удалить версию шаблона');
    }
};

// Обновить версию шаблона
export const updateTemplateVersion = async (
    versionId: string,
    updateData: {
        maxSlots?: number;
        startTime?: string;
        endTime?: string;
        hasSeniorSlot?: boolean;
        validFromDate?: string;
    }
): Promise<any> => {
    try {
        const serverData: any = {};
        if (updateData.maxSlots !== undefined) serverData.max_slots = updateData.maxSlots;
        if (updateData.startTime !== undefined) serverData.start_time = updateData.startTime;
        if (updateData.endTime !== undefined) serverData.end_time = updateData.endTime;
        if (updateData.hasSeniorSlot !== undefined) serverData.has_senior_slot = updateData.hasSeniorSlot;
        if (updateData.validFromDate !== undefined) serverData.valid_from_date = updateData.validFromDate;
        
        const response = await axiosInstance.put(`/v1/shift-templates/versions/${versionId}`, serverData);
        return response.data;
    } catch (error: any) {
        console.error('Error updating template version:', error);
        throw new Error(error.response?.data?.detail || 'Не удалось обновить версию шаблона');
    }
};
