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
    updatedAt: serverTemplate.updated_at
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
): Promise<ShiftTemplate> => {
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
        
        const response = await axiosInstance.post<any>(`/v1/shift-templates?chat_id=${chatId}`, serverData);
        return transformServerTemplate(response.data);
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
        
        const response = await axiosInstance.put<any>(`/v1/shift-templates/${templateId}`, serverData);
        return transformServerTemplate(response.data);
    } catch (error) {
        console.error('Error updating shift template:', error);
        throw new Error('Не удалось обновить шаблон смены');
    }
};

// Удалить шаблон смены
export const deleteShiftTemplate = async (templateId: string): Promise<void> => {
    try {
        await axiosInstance.delete(`/v1/shift-templates/${templateId}`);
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
export const getAppliedShiftTemplates = async (chatId: number): Promise<{ [key: number]: ShiftTemplate[] }> => {
    try {
        const response = await axiosInstance.get(`/v1/shift-templates/applied?chat_id=${chatId}`);
        const serverData = response.data;
        
        // Преобразуем данные с сервера в формат фронтенда
        const templatesByDay: { [key: number]: ShiftTemplate[] } = {};
        
        for (const [dayOfWeekStr, templates] of Object.entries(serverData)) {
            const dayOfWeek = parseInt(dayOfWeekStr);
            templatesByDay[dayOfWeek] = (templates as any[]).map(transformServerTemplate);
        }
        
        return templatesByDay;
    } catch (error) {
        console.error('Error fetching applied shift templates:', error);
        throw new Error('Не удалось загрузить примененные шаблоны смен');
    }
};
