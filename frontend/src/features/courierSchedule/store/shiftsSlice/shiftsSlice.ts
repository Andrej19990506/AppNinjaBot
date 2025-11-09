// --- shiftsSlice.ts ---
// Только slice и редьюсеры для смен. Thunks и селекторы вынесены в отдельные файлы.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CourierShift, AccessSettings, WeeklySlotConfig, SlotConfigForDay, ShiftsUpdatedWsPayload, ShiftState, ShiftTemplate } from '@features/courierSchedule/types/courierScheduleTypes';
import { bookShift, cancelShift, fetchAccessSettings, updateAccessSettings, fetchSlotConfig, assignCourierToShiftThunk, fetchShifts } from './shiftsThunks';
import { 
    fetchShiftTemplatesThunk, 
    createShiftTemplateThunk, 
    updateShiftTemplateThunk, 
    deleteShiftTemplateThunk, 
    applyShiftTemplatesThunk,
    fetchAllShiftTemplatesThunk
} from './shiftTemplatesThunks';




// --- Дефолтные значения для слотов ---
export const defaultSingleDaySlotConfig: SlotConfigForDay = {
    maxDaySlots: 4,
    maxNightSlots: 2,
    hasSeniorSlot: false,
    dayShiftStartTime: "10:00",
    dayShiftEndTime: "18:00",
    nightShiftStartTime: "18:00",
    nightShiftEndTime: "02:00",
};

export const defaultWeeklySlotConfig: WeeklySlotConfig = [
    { ...defaultSingleDaySlotConfig }, // Воскресенье
    { ...defaultSingleDaySlotConfig }, // Понедельник
    { ...defaultSingleDaySlotConfig }, // Вторник
    { ...defaultSingleDaySlotConfig }, // Среда
    { ...defaultSingleDaySlotConfig }, // Четверг
    { ...defaultSingleDaySlotConfig }, // Пятница
    { ...defaultSingleDaySlotConfig }, // Суббота
];

const initialState: ShiftState = {
    shifts: [],
    loading: false,
    error: null,
    accessSettings: null,
    slotConfig: defaultWeeklySlotConfig,
    isLoadingSettings: false,
    settingsError: null,
    isShiftDialogOpen: false,
    shiftDialogMode: 'shifts',

    shiftTemplates: [],
    templatesLoading: false,
    templatesError: null,
    localAppliedTemplates: {},
};

const shiftsSlice = createSlice({
    name: 'shifts',
    initialState,
    reducers: {
        // --- WebSocket: бронирование смены --- 
        shiftBookedWs: (state, action: PayloadAction<ShiftsUpdatedWsPayload>) => {
            const shift = action.payload.shift_data;
            const index = state.shifts.findIndex(s => s.id === shift.id);
            if (index !== -1) {
                state.shifts[index] = shift;
            } else {
                state.shifts.push(shift);
            }
        },
        // --- WebSocket: отмена смены --- 
        shiftCancelledWs: (state, action: PayloadAction<{ shift_id: string }>) => {
            state.shifts = state.shifts.filter(shift => shift.id !== action.payload.shift_id);
        },
        updateAccessRulesState: (state, action: PayloadAction<Partial<AccessSettings>>) => {},
        updateSlotConfigLocal: (state, action: PayloadAction<{ dayIndex: number; maxDaySlots: number; maxNightSlots: number; hasSeniorSlot?: boolean; dayShiftStartTime?: string; dayShiftEndTime?: string; nightShiftStartTime?: string; nightShiftEndTime?: string }>) => {
            const { dayIndex, maxDaySlots, maxNightSlots, hasSeniorSlot = false, dayShiftStartTime, dayShiftEndTime, nightShiftStartTime, nightShiftEndTime } = action.payload;
            if (state.slotConfig && dayIndex >= 0 && dayIndex <= 6) {
                state.slotConfig[dayIndex] = { 
                    maxDaySlots, 
                    maxNightSlots, 
                    hasSeniorSlot,
                    dayShiftStartTime: dayShiftStartTime || state.slotConfig[dayIndex].dayShiftStartTime || "10:00",
                    dayShiftEndTime: dayShiftEndTime || state.slotConfig[dayIndex].dayShiftEndTime || "18:00",
                    nightShiftStartTime: nightShiftStartTime || state.slotConfig[dayIndex].nightShiftStartTime || "18:00",
                    nightShiftEndTime: nightShiftEndTime || state.slotConfig[dayIndex].nightShiftEndTime || "02:00",
                };
            }
        },
        clearShifts: (state) => {},
        shiftAddedOrUpdated: (state, action: PayloadAction<CourierShift>) => {},
        shiftRemoved: (state, action: PayloadAction<string>) => {},
        removeShiftLocally: (state, action: PayloadAction<string>) => {},

        // --- Шаблоны смен ---
        setShiftTemplates: (state, action: PayloadAction<ShiftTemplate[]>) => {
            state.shiftTemplates = action.payload;
            state.templatesError = null;
        },
        addShiftTemplate: (state, action: PayloadAction<ShiftTemplate>) => {
            state.shiftTemplates.push(action.payload);
        },
        updateShiftTemplate: (state, action: PayloadAction<ShiftTemplate>) => {
            const index = state.shiftTemplates.findIndex(t => t.id === action.payload.id);
            if (index !== -1) {
                state.shiftTemplates[index] = action.payload;
            }
        },
        removeShiftTemplate: (state, action: PayloadAction<string>) => {
            state.shiftTemplates = state.shiftTemplates.filter(t => t.id !== action.payload);
        },
        setTemplatesLoading: (state, action: PayloadAction<boolean>) => {
            state.templatesLoading = action.payload;
        },
        setTemplatesError: (state, action: PayloadAction<string | null>) => {
            state.templatesError = action.payload;
        },
        setLocalAppliedTemplates: (state, action: PayloadAction<{ dayOfWeek: number; templateIds: string[] }>) => {
            const { dayOfWeek, templateIds } = action.payload;
            state.localAppliedTemplates[dayOfWeek] = templateIds;
        },
        setShiftDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.isShiftDialogOpen = action.payload;
        },
        setShiftDialogMode: (state, action: PayloadAction<'shifts' | 'reserves'>) => {
            state.shiftDialogMode = action.payload;
        },
        toggleShiftDialogMode: (state) => {
            state.shiftDialogMode = state.shiftDialogMode === 'shifts' ? 'reserves' : 'shifts';
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchShifts.fulfilled, (state, action) => {
                state.shifts = action.payload;
            })
            .addCase(bookShift.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(bookShift.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null; // Очищаем ошибку при успешном выполнении
                const shift = action.payload;
                const index = state.shifts.findIndex(s => s.id === shift.id);
                if (index !== -1) {
                    state.shifts[index] = shift;
                } else {
                    state.shifts.push(shift);
                }
            })
            .addCase(bookShift.rejected, (state, action) => {
                state.loading = false;
                // Не показываем ошибку в общем error для ошибок настроек группы
                if (action.payload && action.payload.includes('Настройки группы не настроены')) {
                    state.error = null; // Не показываем красный фон
                } else {
                    state.error = action.payload || 'Не удалось забронировать смену';
                }
            })
            .addCase(cancelShift.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(cancelShift.fulfilled, (state, action) => {
                state.loading = false;
                state.shifts = state.shifts.filter(shift => shift.id !== action.payload);
            })
            .addCase(cancelShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось отменить смену';
            })
            .addCase(fetchAccessSettings.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(fetchAccessSettings.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                state.accessSettings = action.payload;
            })
            .addCase(fetchAccessSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось загрузить настройки доступа';
            })
            .addCase(updateAccessSettings.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(updateAccessSettings.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                state.accessSettings = action.payload;
            })
            .addCase(updateAccessSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось обновить настройки доступа';
            })

            .addCase(fetchSlotConfig.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(fetchSlotConfig.fulfilled, (state, action) => {
                state.isLoadingSettings = false;
                state.slotConfig = action.payload.config || defaultWeeklySlotConfig;
            })
            .addCase(fetchSlotConfig.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось загрузить конфиг слотов';
            })
            // --- assignCourierToShiftThunk ---
            .addCase(assignCourierToShiftThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(assignCourierToShiftThunk.fulfilled, (state, action) => {
                state.loading = false;
                const shift = action.payload;
                const index = state.shifts.findIndex(s => s.id === shift.id);
                if (index !== -1) {
                    state.shifts[index] = shift;
                } else {
                    state.shifts.push(shift);
                }
            })
            .addCase(assignCourierToShiftThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось назначить курьера';
            })

            // --- Шаблоны смен thunks ---
            .addCase(fetchShiftTemplatesThunk.pending, (state) => {
                state.templatesLoading = true;
                state.templatesError = null;
            })
            .addCase(fetchShiftTemplatesThunk.fulfilled, (state, action) => {
                state.templatesLoading = false;
                state.shiftTemplates = action.payload;
            })
            .addCase(fetchShiftTemplatesThunk.rejected, (state, action) => {
                state.templatesLoading = false;
                state.templatesError = typeof action.payload === 'string' ? action.payload : 'Не удалось загрузить шаблоны смен';
            })

            .addCase(createShiftTemplateThunk.pending, (state) => {
                state.templatesLoading = true;
                state.templatesError = null;
            })
            .addCase(createShiftTemplateThunk.fulfilled, (state, action) => {
                state.templatesLoading = false;
                state.shiftTemplates.push(action.payload);
            })
            .addCase(createShiftTemplateThunk.rejected, (state, action) => {
                state.templatesLoading = false;
                state.templatesError = typeof action.payload === 'string' ? action.payload : 'Не удалось создать шаблон смены';
            })

            .addCase(updateShiftTemplateThunk.pending, (state) => {
                state.templatesLoading = true;
                state.templatesError = null;
            })
            .addCase(updateShiftTemplateThunk.fulfilled, (state, action) => {
                state.templatesLoading = false;
                const index = state.shiftTemplates.findIndex(t => t.id === action.payload.id);
                if (index !== -1) {
                    state.shiftTemplates[index] = action.payload;
                }
            })
            .addCase(updateShiftTemplateThunk.rejected, (state, action) => {
                state.templatesLoading = false;
                state.templatesError = typeof action.payload === 'string' ? action.payload : 'Не удалось обновить шаблон смены';
            })

            .addCase(deleteShiftTemplateThunk.pending, (state) => {
                state.templatesLoading = true;
                state.templatesError = null;
            })
            .addCase(deleteShiftTemplateThunk.fulfilled, (state, action) => {
                state.templatesLoading = false;
                state.shiftTemplates = state.shiftTemplates.filter(t => t.id !== action.payload);
            })
            .addCase(deleteShiftTemplateThunk.rejected, (state, action) => {
                state.templatesLoading = false;
                state.templatesError = typeof action.payload === 'string' ? action.payload : 'Не удалось удалить шаблон смены';
            })

            .addCase(applyShiftTemplatesThunk.pending, (state) => {
                state.templatesLoading = true;
                state.templatesError = null;
            })
            .addCase(applyShiftTemplatesThunk.fulfilled, (state, action) => {
                state.templatesLoading = false;
                // TODO: Обновить конфиг слотов на основе примененных шаблонов
            })
            .addCase(applyShiftTemplatesThunk.rejected, (state, action) => {
                state.templatesLoading = false;
                state.templatesError = typeof action.payload === 'string' ? action.payload : 'Не удалось применить шаблоны смен';
            })
            
            // Обработчики для загрузки всех шаблонов смен
            .addCase(fetchAllShiftTemplatesThunk.pending, (state) => {
                state.templatesLoading = true;
                state.templatesError = null;
            })
            .addCase(fetchAllShiftTemplatesThunk.fulfilled, (state, action) => {
                state.templatesLoading = false;
                
                // Обновляем общий список шаблонов
                const { allTemplates, templatesByDay } = action.payload;
                state.shiftTemplates = allTemplates;
                
                // Обновляем конфиг слотов с шаблонами смен для каждого дня
                if (state.slotConfig) {
                    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
                        if (state.slotConfig[dayOfWeek]) {
                            state.slotConfig[dayOfWeek].shiftTemplates = templatesByDay[dayOfWeek] || [];
                        }
                    }
                }
                
                // Инициализируем локальные применения на основе данных из БД
                for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
                    const templates = templatesByDay[dayOfWeek] || [];
                    const templateIds = templates.map(template => template.id);
                    state.localAppliedTemplates[dayOfWeek] = templateIds;
                }
            })
            .addCase(fetchAllShiftTemplatesThunk.rejected, (state, action) => {
                state.templatesLoading = false;
                state.templatesError = typeof action.payload === 'string' ? action.payload : 'Ошибка при загрузке шаблонов смен';
            });
    }
});

export const {
    shiftBookedWs,
    shiftCancelledWs,
    updateAccessRulesState, 
    updateSlotConfigLocal, 
    clearShifts,
    shiftAddedOrUpdated,
    shiftRemoved,
    removeShiftLocally,
    setShiftDialogOpen,
    setShiftDialogMode,
    toggleShiftDialogMode,
    // Шаблоны смен
    setShiftTemplates,
    addShiftTemplate,
    updateShiftTemplate,
    removeShiftTemplate,
    setTemplatesLoading,
    setTemplatesError,
    setLocalAppliedTemplates,
} = shiftsSlice.actions;
export default shiftsSlice.reducer;
 