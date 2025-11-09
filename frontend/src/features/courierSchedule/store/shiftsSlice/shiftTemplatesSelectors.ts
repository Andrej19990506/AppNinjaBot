import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@shared/store/store';
import { ShiftTemplate } from '@features/courierSchedule/types/courierScheduleTypes';

// Базовый селектор для состояния смен
const selectShiftState = (state: RootState) => state.shifts;

// Селекторы для шаблонов смен
export const selectShiftTemplates = createSelector(
    [selectShiftState],
    (shiftState) => shiftState.shiftTemplates
);

export const selectShiftTemplatesLoading = createSelector(
    [selectShiftState],
    (shiftState) => shiftState.templatesLoading
);

export const selectShiftTemplatesError = createSelector(
    [selectShiftState],
    (shiftState) => shiftState.templatesError
);

// Селектор для активных шаблонов смен
export const selectActiveShiftTemplates = createSelector(
    [selectShiftTemplates],
    (templates) => templates.filter(template => template.isActive)
);

// Селектор для шаблона по ID
export const selectShiftTemplateById = (templateId: string) => createSelector(
    [selectShiftTemplates],
    (templates) => templates.find(template => template.id === templateId)
);

// Селектор для шаблонов по времени
export const selectShiftTemplatesByTimeRange = (startTime: string, endTime: string) => createSelector(
    [selectShiftTemplates],
    (templates) => templates.filter(template => 
        template.startTime === startTime && template.endTime === endTime
    )
);

// Селектор для шаблонов с поддержкой старшего курьера
export const selectShiftTemplatesWithSeniorSlot = createSelector(
    [selectShiftTemplates],
    (templates) => templates.filter(template => template.hasSeniorSlot)
);

// Селектор для количества шаблонов
export const selectShiftTemplatesCount = createSelector(
    [selectShiftTemplates],
    (templates) => templates.length
);

// Селектор для активных шаблонов с количеством
export const selectActiveShiftTemplatesCount = createSelector(
    [selectActiveShiftTemplates],
    (templates) => templates.length
);

// Селектор для проверки существования шаблона с определенным именем
export const selectShiftTemplateExistsByName = (name: string) => createSelector(
    [selectShiftTemplates],
    (templates) => templates.some(template => template.name.toLowerCase() === name.toLowerCase())
);

// Селектор для получения шаблонов, отсортированных по времени начала
export const selectShiftTemplatesSortedByTime = createSelector(
    [selectShiftTemplates],
    (templates) => [...templates].sort((a, b) => {
        const timeA = a.startTime.split(':').map(Number);
        const timeB = b.startTime.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    })
);
