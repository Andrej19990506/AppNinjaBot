// @ts-nocheck
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { socketService } from '../../services/socket';
import config from '../../config';
import { bookShift as bookShiftApi, deleteShiftAsSenior as cancelShiftApi, getShiftAccessSettings as getShiftAccessSettingsApi, updateShiftAccessSettings as updateShiftAccessSettingsApi, getShifts, ApiShift, getSlotConfig as getSlotConfigApi, SlotConfigResponse, assignCourierToShift, CourierInfo } from '../../services/courierApi';
import { CourierShift, User } from '../../types';
import { removeReserveByIdThunk } from './reservesSlice';
import { logger } from '../../utils/logger';
import { usersReceived } from './userSlice';
import { createSelector } from 'reselect';

const API_BASE_URL = config.API_URL;

// --- Старый интерфейс SlotConfig (переименовываем) ---
export interface SlotConfigForDay {
    maxDaySlots: number;
    maxNightSlots: number;
    hasSeniorSlot?: boolean; // Добавляем флаг для слота старшего курьера
}
// --- ---------------------------------------------- ---

// --- Новый интерфейс для хранения настроек по дням недели --- 
export interface WeeklySlotConfig {
    [dayIndex: number]: SlotConfigForDay; // Ключи 0 (Вс) - 6 (Сб)
}
// --- ------------------------------------------------------ --- 

// Интерфейс для настроек доступа (БЕЗ слотов)
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
    daysAhead?: number;               
    enabledDates?: string[];          
    // <<< maxDaySlots и maxNightSlots УБРАНЫ отсюда >>>
    restrictedUsers?: (string | number)[]; 
    lastUpdated?: string;            
    updatedBy?: string | number;     
}

// Обновленный интерфейс состояния
interface ShiftState {
    shifts: CourierShift[];
    loading: boolean;
    error: string | null;
    accessSettings: AccessSettings | null;
    // --- Изменяем тип slotConfig --- 
    slotConfig: WeeklySlotConfig | null; 
    // --- ------------------------ --- 
    isLoadingSettings: boolean;
    settingsError: string | null;
    // <<< НОВЫЕ ПОЛЯ СОСТОЯНИЯ ДЛЯ ДИАЛОГА >>>
    isShiftDialogOpen: boolean;
    shiftDialogMode: 'shifts' | 'reserves';
}

// Интерфейс параметров для Thunk bookShift
interface BookShiftThunkParams {
    date: string;
    userId: string; // Оставляем userId (string) как основной идентификатор во фронте
    shiftType: 'day' | 'night';
    slotIndex: number;
    chatId: string; // Оставляем chatId (string) как основной идентификатор группы во фронте
    // existingShiftId убран, так как bookShift теперь только создает
    // existingShiftId?: string; 
}

// --- Значения по умолчанию для слотов (теперь недельные) --- 
export const defaultSingleDaySlotConfig: SlotConfigForDay = {
    maxDaySlots: 4,
    maxNightSlots: 2,
    hasSeniorSlot: false, // По умолчанию слот отключен
};

export const defaultWeeklySlotConfig: WeeklySlotConfig = {
    0: { ...defaultSingleDaySlotConfig }, // Воскресенье
    1: { ...defaultSingleDaySlotConfig }, // Понедельник
    2: { ...defaultSingleDaySlotConfig }, // Вторник
    3: { ...defaultSingleDaySlotConfig }, // Среда
    4: { ...defaultSingleDaySlotConfig }, // Четверг
    5: { ...defaultSingleDaySlotConfig }, // Пятница
    6: { ...defaultSingleDaySlotConfig }, // Суббота
};
// --- -------------------------------------------------- --- 

// Обновленное начальное состояние
const initialState: ShiftState = {
    shifts: [],
    loading: false,
    error: null,
    accessSettings: null, 
    // --- Используем недельные дефолтные слоты --- 
    slotConfig: defaultWeeklySlotConfig, 
    // --- -------------------------------------- --- 
    isLoadingSettings: false,
    settingsError: null,
    // <<< ИНИЦИАЛИЗАЦИЯ НОВЫХ ПОЛЕЙ >>>
    isShiftDialogOpen: false,
    shiftDialogMode: 'shifts',
};

// Глобальный EventEmitter для синхронизации компонентов
export const shiftEvents = {
  listeners: new Map<string, Set<Function>>(),
  
  emit(event: string, data: any) {
    console.log(`[shiftEvents] 📣 Emitting event ${event}:`, data);
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[shiftEvents] Error in listener for ${event}:`, error);
        }
      });
    }
  },
  
  on(event: string, callback: Function) {
    console.log(`[shiftEvents] 👂 Adding listener for ${event}`);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Возвращаем функцию отписки
    return () => {
      console.log(`[shiftEvents] 🚫 Removing listener for ${event}`);
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
};

// Асинхронные thunks
export const fetchShifts = createAsyncThunk(
    'shifts/fetchShifts',
    async (_, { getState, rejectWithValue, dispatch }) => {
        const state = getState() as RootState;
        const chatId = state.user.user?.groups?.find(g => g.group_type === 'courier')?.chat_id;

        if (!chatId) {
            logger.warn('[shiftsSlice] No chat_id available, cannot fetch shifts');
            return rejectWithValue('Chat ID not found');
        }

        try {
            logger.info('[shiftsSlice] Fetching shifts for chat_id:', chatId);
            const shiftsData: ApiShift[] = await getShifts(chatId);
            logger.info('[shiftsSlice] Fetched shifts via getShifts:', shiftsData);

            // <<< НАЧАЛО: Сбор и диспатч данных пользователей >>>
            const usersMap: { [key: number]: User } = {};
            for (const apiShift of shiftsData) {
                const memberData = apiShift.member;
                const userId = memberData?.user_id ?? apiShift.user_id;

                if (userId && !usersMap[userId]) { // Собираем только уникальных пользователей
                    // Создаем объект User, добавляя поля по умолчанию
                    usersMap[userId] = {
                        id: userId,
                        first_name: memberData?.first_name ?? apiShift.first_name ?? '',
                        last_name: memberData?.last_name ?? apiShift.last_name ?? '',
                        username: memberData?.username,
                        photo_url: memberData?.photo_url ?? apiShift.photo_url,
                        // Добавляем поля по умолчанию, которых нет в ApiShift/Member
                        isAdmin: false, 
                        adminRights: null,
                        groups: [], 
                        // Добавляем isSeniorCourier из member, если есть
                        isSeniorCourier: memberData?.is_senior_courier ?? false,
                    };
                }
            }
            
            if (Object.keys(usersMap).length > 0) {
                logger.info('[shiftsSlice] Dispatching usersReceived with users from fetched shifts:', usersMap);
                dispatch(usersReceived(usersMap));
            }
            // <<< КОНЕЦ: Сбор и диспатч данных пользователей >>>

            return shiftsData; // Возвращаем исходные данные смен для редьюсера fetchShifts.fulfilled
        } catch (error: any) {
            logger.error('Error fetching shifts:', error.message || error);
            return rejectWithValue(error.message || 'Failed to fetch shifts');
        }
    }
);

// Функция маппинга ApiShift -> CourierShift (унифицированный тип)
const mapApiShiftToCourierShift = (apiShift: ApiShift): CourierShift => {
    // logger.debug('[shiftsSlice] Маппинг ApiShift в CourierShift:', apiShift);
    const memberData = apiShift.member; // Данные из вложенного объекта member

    // Определяем источник для каждого поля, отдавая приоритет memberData, если он есть
    // Убедимся, что используем правильные имена полей из ApiShift и memberData
    const userId = memberData?.user_id ? String(memberData.user_id) : String(apiShift.user_id || 'unknown');
    const photoUrl = memberData?.photo_url || apiShift.photo_url || null;
    const firstName = memberData?.first_name || apiShift.first_name || '';
    const lastName = memberData?.last_name || apiShift.last_name || '';
    // Для isSeniorCourier проверяем оба возможных источника
    const isSeniorCourier = memberData ? (memberData.is_senior_courier || false) : (apiShift.is_senior_courier || false);

    const shift: CourierShift = {
        id: apiShift.id,
        userId: userId,
        photoUrl: photoUrl,
        firstName: firstName,
        lastName: lastName,
        date: apiShift.date, // Эти поля берем из корня объекта смены
        shiftType: apiShift.shift_type,
        slotIndex: apiShift.slot_index,
        isSeniorCourier: isSeniorCourier, // Используем вычисленное значение
    };
    // logger.debug('[shiftsSlice] Результат маппинга в CourierShift:', shift);
    return shift;
};

// Экспортируем интерфейс для payload события shifts_updated от WebSocket
export interface ShiftsUpdatedWsPayload {
    type: 'shifts_updated';
    chat_id: string;
    source: string;
    shift_data: ApiShift; // Полные данные смены здесь
}

// --- THUNK для бронирования смены (СОЗДАНИЕ) ---
export const bookShift = createAsyncThunk<
    CourierShift, // Возвращаем созданную/обновленную смену (унифицированный тип)
    BookShiftThunkParams,
    { rejectValue: string; state: RootState } 
>(
    'shifts/bookShift',
    async ({ date, userId, shiftType, slotIndex, chatId }, { rejectWithValue, getState, dispatch }) => {
        logger.info('[shiftsSlice] Запуск bookShift thunk (создание):', { date, userId, shiftType, slotIndex, chatId });
        try {
            // Преобразуем ID в числа и используем правильные имена для API
            const apiData = {
                date: date,
                user_telegram_id: parseInt(userId, 10), // Преобразуем ID пользователя
                group_telegram_id: parseInt(chatId, 10), // <-- Убираем .replace('-', '')
                shift_type: shiftType,
                slot_index: slotIndex,
            };
            logger.debug('[shiftsSlice] Данные для bookShiftApi:', apiData);
            
            // Проверяем на NaN после parseInt
            if (isNaN(apiData.user_telegram_id) || isNaN(apiData.group_telegram_id)) {
                logger.error('[shiftsSlice] ❌ Ошибка преобразования ID в числа:', { userId, chatId });
                return rejectWithValue('Неверный формат ID пользователя или группы.');
            }

            // Вызываем API
            const bookedApiShift = await bookShiftApi(apiData);
            logger.info('[shiftsSlice] Смена успешно забронирована через API:', bookedApiShift);

            // Маппим ответ API в наш внутренний тип
            const bookedShiftEntry = mapApiShiftToCourierShift(bookedApiShift);

            // --- Логика удаления из резерва --- 
            const state = getState();
            const reserveEntry = state.reserves.reserves.find(r => r.userId === userId && r.date === date);
            
            if (reserveEntry) {
                logger.info(`[shiftsSlice] Пользователь ${userId} найден в резерве на ${date}. Запуск удаления из резерва...`);
                try {
                    await dispatch(removeReserveByIdThunk({ 
                        reserveId: reserveEntry.id, 
                        requesterTelegramId: parseInt(userId, 10) // Используем userId текущего пользователя
                    })).unwrap();
                    logger.info(`[shiftsSlice] Thunk removeReserveByIdThunk успешно запущен для резерва ID: ${reserveEntry.id}`);
                } catch (removeError) {
                    logger.error(`[shiftsSlice] Ошибка при попытке удаления из резерва после бронирования смены:`, removeError);
                    // Не прерываем выполнение, просто логируем
                }
            }
            // --- Конец логики удаления из резерва --- 

            return bookedShiftEntry; // Возвращаем смапленную запись

        } catch (error) {
            let errorMessage = 'Неизвестная ошибка при бронировании смены';
            if (error instanceof Error) {
                errorMessage = error.message; 
            }
            logger.error('[shiftsSlice] ❌ Ошибка при бронировании смены через API:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// --- THUNK для отмены смены ---
export const cancelShift = createAsyncThunk<
    { success: boolean; shiftId: string; userId: string; date: string; }, 
    { shiftId: string; chatId: string; userId: string; date: string; }, 
    { rejectValue: string; state: RootState } 
>(
    'shifts/cancelShift',
    async ({ shiftId, chatId, userId, date }, { rejectWithValue, getState }) => {
        logger.info(`[shiftsSlice] Запуск cancelShift thunk: shiftId=${shiftId}, userId=${userId}`);
        try {
            // Вызываем deleteShiftAsSenior, передавая shiftId и userId (как requesterId)
            await cancelShiftApi(shiftId, String(userId ?? ''));
            logger.info(`[shiftsSlice] ✅ Смена ID: ${shiftId} успешно отменена через API (deleteShiftAsSenior).`);
            
            // Возвращаем ID и доп. данные для редьюсера
            return { success: true, shiftId, userId, date }; 
            
        } catch (error) {
             let errorMessage = 'Неизвестная ошибка при отмене смены';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            logger.error(`[shiftsSlice] ❌ Ошибка при отмене смены ID ${shiftId} через API:`, errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// Функция для подтверждения смены
export const confirmShift = createAsyncThunk(
    'shifts/confirmShift',
    async (data: { shiftId: string; chatId?: string }, { rejectWithValue }) => {
        try {
            const { shiftId, chatId } = data;
            
            console.log('[shiftsSlice] Confirming shift:', { 
                shiftId, 
                chatId: chatId || 'not provided' 
            });
            
            // Отправляем событие через WebSocket с chatId, если он доступен
            socketService.emit('confirm_shift', { 
                shift_id: shiftId,
                chat_id: chatId
            });
            
            // По аналогии с cancel можно добавить HTTP запрос
            const response = await fetch(`${API_BASE_URL}/shifts/${shiftId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: chatId ? JSON.stringify({ chat_id: chatId }) : undefined
            });

            if (!response.ok) {
                throw new Error('Failed to confirm shift');
            }

            return shiftId;
        } catch (error) {
            console.error('Error confirming shift:', error);
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to confirm shift');
        }
    }
);

// <<< Thunk для загрузки КОНФИГУРАЦИИ СЛОТОВ >>>
export const fetchSlotConfig = createAsyncThunk<
    SlotConfigResponse, // Возвращаемый тип при успехе
    { chatId: number }, // Тип аргумента (принимаем число)
    { rejectValue: string } // Тип возвращаемого значения при ошибке
>(
    'shifts/fetchSlotConfig', // Уникальное имя действия
    async ({ chatId }, { rejectWithValue }) => {
        try {
            logger.log(`[shiftsSlice] ⚙️ Запрос конфигурации слотов для чата ${chatId}`);
            // Вызываем API функцию
            const response = await getSlotConfigApi(chatId);
            logger.log('[shiftsSlice] ✅ Получена конфигурация слотов от API:', response);
            return response; // Возвращаем объект { config: { ... } }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch slot configuration';
            logger.error('[shiftsSlice] ❌ Ошибка при получении конфигурации слотов:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// Thunk для загрузки НАСТРОЕК ДОСТУПА (БЕЗ слотов)
export const fetchAccessSettings = createAsyncThunk<
    AccessSettings, // Теперь ожидаем только AccessSettings
    { chatId: string }, 
    { rejectValue: string } 
>(
    'shifts/fetchAccessSettings',
    async ({ chatId }, { rejectWithValue }) => {
        try {
            logger.log(`[shiftsSlice] 🔍 Запрос ТОЛЬКО настроек доступа для чата ${chatId}`);
            const settings = await getShiftAccessSettingsApi(chatId); 
            logger.log('[shiftsSlice] ✅ Получены настройки доступа от API:', settings);
            // Убираем поля слотов, если они вдруг пришли от старого API
            const { maxDaySlots, maxNightSlots, ...accessSettingsOnly } = settings as any;
            return accessSettingsOnly as AccessSettings; // Возвращаем только настройки доступа
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch access settings';
            logger.error('[shiftsSlice] ❌ Ошибка при получении настроек доступа:', errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

// <<< Интерфейс для параметров Thunk обновления слотов >>>
interface UpdateSlotsThunkParams {
    chat_id: string;
    maxDaySlots: number;
    maxNightSlots: number;
}

// Thunk для обновления ТОЛЬКО слотов (но API может вернуть все настройки)
export const updateSlotSettings = createAsyncThunk<
    FullSettingsApiResponse, // API все еще может вернуть полный объект
    UpdateSlotsThunkParams, 
    { rejectValue: string }
>(
    'shifts/updateSlotSettings', // <<< Новое имя Thunk
    async (slotData, { rejectWithValue }) => {
        const { chat_id, maxDaySlots, maxNightSlots } = slotData;
        try {
            logger.log(`[shiftsSlice] 📊 Отправка ТОЛЬКО настроек слотов для чата ${chat_id}:`, { maxDaySlots, maxNightSlots });
            // Передаем на API только нужные поля
            const updatedSettings = await updateShiftAccessSettingsApi(chat_id, { maxDaySlots, maxNightSlots });
            logger.log('[shiftsSlice] ✅ ПОЛНЫЕ настройки доступа получены после обновления слотов:', updatedSettings);
            return updatedSettings; // Возвращаем весь объект из API
        } catch (error: any) {
             // ... обработка ошибки ...
            return rejectWithValue(errorMessage);
        }
    }
);

// <<< НОВЫЙ Thunk для обновления ТОЛЬКО правил доступа >>>
export const updateAccessRules = createAsyncThunk<
    AccessSettings, // API может вернуть обновленные правила доступа
    Partial<AccessSettings> & { chat_id: string }, // Ожидаем частичные правила + обязательный chat_id
    { rejectValue: string }
>(
    'shifts/updateAccessRules', // Новое имя
    async (accessRulesData, { rejectValue }) => {
        const { chat_id, ...rulesToUpdate } = accessRulesData;
        // Убедимся, что не передаем поля слотов, если они случайно попали
        delete (rulesToUpdate as any).maxDaySlots;
        delete (rulesToUpdate as any).maxNightSlots;
        
        try {
            logger.log(`[shiftsSlice] 🛡️ Отправка ТОЛЬКО правил доступа для чата ${chat_id}:`, rulesToUpdate);
            // Вызываем тот же API, но передаем только правила
            const updatedSettings = await updateShiftAccessSettingsApi(chat_id, rulesToUpdate);
            logger.log('[shiftsSlice] ✅ Правила доступа обновлены через API (полный ответ):', updatedSettings);
            // Возвращаем только часть ответа, относящуюся к AccessSettings
             const { maxDaySlots, maxNightSlots, ...updatedAccessRules } = updatedSettings;
            return updatedAccessRules as AccessSettings;
        } catch (error: any) {
             const errorMessage = error.message || 'Failed to update access rules';
             logger.error('[shiftsSlice] ❌ Ошибка при обновлении правил доступа:', errorMessage);
             return rejectWithValue(errorMessage);
        }
    }
);

// <<< НОВЫЙ THUNK ДЛЯ НАЗНАЧЕНИЯ КУРЬЕРА >>>
export const assignCourierToShiftThunk = createAsyncThunk<
    ApiShift, // <<< Указываем ApiShift
    { // Аргументы thunk
        assignerId: string; // ID того, кто назначает (старший)
        courier: CourierInfo; // Данные назначаемого курьера
        groupTelegramId: string; // ID группы
        date: string; // Дата YYYY-MM-DD
        shiftType: 'day' | 'night';
        slotIndex: number;
    },
    { rejectValue: string } // Тип ошибки
>(
    'shifts/assignCourier',
    async (data, { rejectWithValue }) => {
        const { assignerId, courier, groupTelegramId, date, shiftType, slotIndex } = data;
        logger.info(`[Thunk assignCourier] Попытка назначения курьера ${courier.user_id} на слот ${shiftType}-${slotIndex} от ${assignerId}`);
        try {
            const assignedShift = await assignCourierToShift({
                assigner_telegram_id: assignerId,
                target_user_telegram_id: courier.user_id, // Берем ID из объекта courier
                group_telegram_id: groupTelegramId,
                date: date,
                shift_type: shiftType,
                slot_index: slotIndex
            });
            logger.info(`[Thunk assignCourier] Курьер успешно назначен.`, assignedShift);
            return assignedShift; // Возвращаем данные смены из API (или заглушки)
        } catch (error: any) {
            logger.error(`[Thunk assignCourier] Ошибка назначения курьера:`, error);
            return rejectWithValue(error.message || 'Не удалось назначить курьера.');
        }
    }
);

const shiftsSlice = createSlice({
    name: 'shifts',
    initialState,
    reducers: {
        // --- Адаптированный редьюсер для WebSocket --- 
        shiftBookedWs: (state, action: PayloadAction<ShiftsUpdatedWsPayload>) => {
            // !!! НОВЫЙ ЛОГ: Проверяем вход в редьюсер и payload !!!
            logger.log(`[shiftBookedWs] ENTERED. Payload received:`, action.payload);

            // ===> ИСПРАВЛЕНИЕ: Извлекаем данные из shift_data <===
            const newShiftData = action.payload.shift_data;
            
            // Проверяем, что данные есть
            if (!newShiftData) {
                logger.error('[shiftBookedWs] Ошибка: shift_data отсутствует в payload события WebSocket!', action.payload);
                return; 
            }

            logger.info('[shiftsSlice] Обработка WebSocket события shiftBookedWs (из shift_data):', newShiftData);

            // Маппинг WS данных в CourierShift
            // Убедимся, что newShiftData соответствует ApiShift
            const normalizedShift = mapApiShiftToCourierShift(newShiftData);
            const allowMultiple = state.accessSettings?.allowMultipleShifts;
            const shiftDate = normalizedShift.date; // Дата новой/обновленной смены
            const shiftUserId = normalizedShift.userId; // ID пользователя
            
            // Добавим проверку, что маппинг сработал
            if (shiftUserId === 'unknown' || !shiftDate || !normalizedShift.id) {
                logger.error('[shiftBookedWs] Ошибка: Не удалось корректно смапить данные из shift_data!', { newShiftData, normalizedShift });
                return; 
            }

            // --- Проверяем, является ли это перемещением между типами смен ---
            const isSlotUpdate = action.payload.source === 'shift_slot_update';
            if (isSlotUpdate) {
                logger.info(`[shiftsSlice] Обработка перемещения смены между типами (shift_slot_update) для ID: ${normalizedShift.id}`);
                
                // Сначала найдем и удалим смену с тем же ID (но другим типом или слотом)
                const existingShiftIndex = state.shifts.findIndex(shift => shift.id === normalizedShift.id);
                
                if (existingShiftIndex !== -1) {
                    const existingShift = state.shifts[existingShiftIndex];
                    logger.info(`[shiftsSlice] Найдена существующая смена ID ${normalizedShift.id} с типом=${existingShift.shiftType}, слотом=${existingShift.slotIndex}. Удаляем её перед обновлением.`);
                    
                    // Удаляем существующую смену
                    state.shifts.splice(existingShiftIndex, 1);
                }
                
                // Удаляем любую другую смену, которая может быть в целевом слоте
                const sameSlotIndex = state.shifts.findIndex(shift => 
                    shift.date === shiftDate && 
                    shift.shiftType === normalizedShift.shiftType && 
                    shift.slotIndex === normalizedShift.slotIndex
                );
                
                if (sameSlotIndex !== -1) {
                    logger.info(`[shiftsSlice] Найдена смена в целевом слоте [${normalizedShift.shiftType}, ${normalizedShift.slotIndex}]. Удаляем её.`);
                    state.shifts.splice(sameSlotIndex, 1);
                }
                
                // Добавляем обновленную смену
                state.shifts.push(normalizedShift);
                logger.info(`[shiftsSlice] Добавлена обновленная смена ID ${normalizedShift.id} с типом=${normalizedShift.shiftType}, слотом=${normalizedShift.slotIndex}`);
                
                return; // Выходим из редюсера, т.к. уже обработали перемещение
            }

            // --- Логика обновления стейта для обычного создания/обновления смены --- 
             if (!allowMultiple) {
                // Удаляем ВСЕ смены ЭТОГО пользователя на ЭТУ дату
                state.shifts = state.shifts.filter(shift => 
                    !(shift.userId === shiftUserId && shift.date === shiftDate)
                );
                logger.info(`[shiftsSlice] WS: Multiple НЕ разрешены. Удалены старые смены для User ID ${shiftUserId} на дату ${shiftDate}`);
            } else {
                 // Удаляем только смену в этом же слоте, если она была
                 state.shifts = state.shifts.filter(shift =>
                     !(shift.date === shiftDate &&
                       shift.shiftType === normalizedShift.shiftType &&
                       shift.slotIndex === normalizedShift.slotIndex)
                 );
                  logger.info(`[shiftsSlice] WS: Multiple разрешены. Удалена существующая смена в слоте [${shiftDate}, ${normalizedShift.shiftType}, ${normalizedShift.slotIndex}], если была.`);
            }
            
            // Ищем существующую смену по ID
            const existingShiftIndex = state.shifts.findIndex(s => s.id === normalizedShift.id);

            if (existingShiftIndex !== -1) {
                // Если нашли - ОБНОВЛЯЕМ её
                state.shifts[existingShiftIndex] = normalizedShift;
                logger.info(`[shiftsSlice] WS: Обновлена существующая смена ID ${normalizedShift.id}`);
            } else {
                // Если не нашли - ДОБАВЛЯЕМ новую
                state.shifts.push(normalizedShift);
                logger.info(`[shiftsSlice] WS: Добавлена новая смена ID ${normalizedShift.id}`);
            }
            // --- КОНЕЦ ИСПРАВЛЕННОЙ Логики --- 
        },
        // --- Адаптированный редьюсер для WebSocket --- 
        shiftCancelledWs: (state, action: PayloadAction<{ shift_id: string }>) => {
             const { shift_id } = action.payload;
             logger.info(`[shiftsSlice] Обработка WebSocket события shiftCancelledWs: shift_id=${shift_id}`);
             state.shifts = state.shifts.filter(shift => shift.id !== shift_id);
        },
        // Редьюсер для обновления ТОЛЬКО правил доступа (если нужно)
        updateAccessRulesState: (state, action: PayloadAction<Partial<AccessSettings>>) => {
             if (state.accessSettings) {
                 state.accessSettings = { ...state.accessSettings, ...action.payload };
             } else {
                 // Не можем обновить, если базовых настроек нет
                 logger.warn('[shiftsSlice] Cannot update access rules state: accessSettings is null');
             }
        },
        // Редьюсер для обновления ТОЛЬКО конфига слотов (если нужно)
        updateSlotConfigLocal: (state, action: PayloadAction<{ dayIndex: number; maxDaySlots: number; maxNightSlots: number; hasSeniorSlot?: boolean }>) => {
            const { dayIndex, maxDaySlots, maxNightSlots, hasSeniorSlot = false } = action.payload;
            // Проверяем валидность dayIndex
            if (dayIndex >= 0 && dayIndex <= 6) {
                logger.info(`[shiftsSlice] Обновление локального slotConfig для дня ${dayIndex}:`, { maxDaySlots, maxNightSlots, hasSeniorSlot });
                if (!state.slotConfig) { // Если slotConfig был null, инициализируем его
                    state.slotConfig = { ...defaultWeeklySlotConfig };
                }
                // Обновляем только нужный день
                state.slotConfig[dayIndex] = { maxDaySlots, maxNightSlots, hasSeniorSlot };
            } else {
                 logger.warn(`[shiftsSlice] Попытка обновить slotConfig с неверным dayIndex: ${dayIndex}`);
            }
        },
         clearShifts: (state) => {
            state.shifts = [];
            state.loading = false;
            state.error = null;
            state.accessSettings = null;
            state.slotConfig = defaultWeeklySlotConfig;
            // <<< СБРОС СОСТОЯНИЯ ДИАЛОГА ПРИ ОЧИСТКЕ >>>
            state.isShiftDialogOpen = false;
            state.shiftDialogMode = 'shifts';
        },
        // --- Добавляем новый синхронный редюсер --- 
        shiftAddedOrUpdated: (state, action: PayloadAction<CourierShift>) => {
            // ... существующий код редюсера shiftAddedOrUpdated ...
        },
        shiftRemoved: (state, action: PayloadAction<string>) => {
            // ... существующий код редюсера shiftRemoved ...
        },
        // ADDED Reducer for optimistic UI update
        removeShiftLocally: (state, action: PayloadAction<string>) => {
            const shiftIdToRemove = action.payload;
            logger.info(`[shiftsSlice] Removing shift locally: ${shiftIdToRemove}`);
            state.shifts = state.shifts.filter(shift => shift.id !== shiftIdToRemove);
            // Note: We might also need to update reserves if the deleted shift was a reserve placement?
            // For now, just removing from the main shifts array.
        },
        // <<< НОВЫЕ РЕДЬЮСЕРЫ ДЛЯ УПРАВЛЕНИЯ ДИАЛОГОМ >>>
        setShiftDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.isShiftDialogOpen = action.payload;
            // Сбрасываем режим на 'shifts' при открытии, если диалог был закрыт
            if (action.payload && !state.isShiftDialogOpen) {
                state.shiftDialogMode = 'shifts';
            }
             logger.debug(`[shiftsSlice] setShiftDialogOpen: ${action.payload}`);
        },
        setShiftDialogMode: (state, action: PayloadAction<'shifts' | 'reserves'>) => {
            state.shiftDialogMode = action.payload;
             logger.debug(`[shiftsSlice] setShiftDialogMode: ${action.payload}`);
        },
        toggleShiftDialogMode: (state) => {
            state.shiftDialogMode = state.shiftDialogMode === 'shifts' ? 'reserves' : 'shifts';
             logger.debug(`[shiftsSlice] toggleShiftDialogMode: new mode is ${state.shiftDialogMode}`);
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch shifts
            .addCase(fetchShifts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchShifts.fulfilled, (state, action) => {
                state.loading = false;
                // Используем маппинг при получении
                state.shifts = action.payload.map(mapApiShiftToCourierShift);
            })
            .addCase(fetchShifts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch shifts';
            })
            // --- Обработка bookShift --- 
            .addCase(bookShift.pending, (state) => {
                state.loading = true; // Показываем общую загрузку или можно добавить специфичный флаг
                state.error = null;
            })
            .addCase(bookShift.fulfilled, (state, action: PayloadAction<CourierShift>) => {
                state.loading = false;
                const bookedShift = action.payload; // Уже смапленный CourierShift
                const allowMultiple = state.accessSettings?.allowMultipleShifts;
                logger.info(`[shiftsSlice] bookShift.fulfilled: User ID ${bookedShift.userId}, Multiple Allowed: ${allowMultiple}`);

                // Логика обновления стейта (перенесена сюда из старого shiftBooked)
                if (!allowMultiple) {
                    state.shifts = state.shifts.filter(shift => 
                        !(shift.userId === bookedShift.userId && shift.date === bookedShift.date)
                    );
                    logger.info(`[shiftsSlice] Fulfilled: Multiple НЕ разрешены. Удалены старые смены для User ID ${bookedShift.userId} на дату ${bookedShift.date}`);
                } else {
                     state.shifts = state.shifts.filter(shift =>
                         !(shift.date === bookedShift.date &&
                           shift.shiftType === bookedShift.shiftType &&
                           shift.slotIndex === bookedShift.slotIndex)
                     );
                     logger.info(`[shiftsSlice] Fulfilled: Multiple разрешены. Удалена существующая смена в слоте [${bookedShift.date}, ${bookedShift.shiftType}, ${bookedShift.slotIndex}], если была.`);
                }

                // Добавляем новую/обновленную смену (проверяем дубликат на всякий случай)
                if (!state.shifts.some(s => s.id === bookedShift.id)) {
                    state.shifts.push(bookedShift);
                     logger.info(`[shiftsSlice] Fulfilled: Добавлена/обновлена смена ID ${bookedShift.id}`);
                } else {
                     // Если ID уже есть, можно обновить существующую запись
                     const index = state.shifts.findIndex(s => s.id === bookedShift.id);
                     if (index !== -1) {
                         state.shifts[index] = bookedShift;
                         logger.info(`[shiftsSlice] Fulfilled: Обновлена существующая смена ID ${bookedShift.id}`);
                     }
                }
            })
            .addCase(bookShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось забронировать смену';
                // Здесь можно реализовать откат оптимистичного обновления, если оно было
            })
             // --- Обработка cancelShift --- 
             .addCase(cancelShift.pending, (state) => {
                state.loading = true;
                state.error = null;
                 // Можно добавить оптимистичное удаление
                 // const { shiftId } = action.meta.arg;
                 // state.shifts = state.shifts.filter(s => s.id !== shiftId);
            })
            .addCase(cancelShift.fulfilled, (state, action: PayloadAction<{ success: boolean; shiftId: string; userId: string; date: string; }>) => {
                state.loading = false;
                // Удаляем смену из стейта
                state.shifts = state.shifts.filter(shift => shift.id !== action.payload.shiftId);
                 logger.info(`[shiftsSlice] Fulfilled: Смена ID ${action.payload.shiftId} удалена из стейта.`);
                 // TODO: Опционально - здесь можно диспатчить addToReserve, если нужно вернуть пользователя в резерв при отмене
                 // const { userId, date, shiftId } = action.payload;
                 // const chatId = state.accessSettings.chat_id; // Получить chatId
                 // if (chatId) {
                 //    dispatch(addToReserve({ userId, date, chatId })); 
                 // }
            })
            .addCase(cancelShift.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Не удалось отменить смену';
                 // Откат оптимистичного удаления, если было
                 // Нужно будет вернуть удаленную смену
            })
            // Fetch access settings
            .addCase(fetchAccessSettings.pending, (state) => {
                logger.debug('[shiftsSlice] fetchAccessSettings pending...');
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(fetchAccessSettings.fulfilled, (state, action: PayloadAction<AccessSettings>) => {
                logger.debug('[shiftsSlice] fetchAccessSettings fulfilled.');
                state.isLoadingSettings = false;
                state.accessSettings = action.payload;
                // НЕ ТРОГАЕМ slotConfig здесь
            })
            .addCase(fetchAccessSettings.rejected, (state, action) => {
                 logger.error('[shiftsSlice] fetchAccessSettings rejected:', action.payload);
                 state.isLoadingSettings = false;
                 state.settingsError = action.payload as string;
                 state.accessSettings = null; // Сбрасываем настройки доступа при ошибке
                 // НЕ ТРОГАЕМ slotConfig здесь
            })
            // Обработка updateSlotSettings (заменили updateAccessSettings)
            .addCase(updateSlotSettings.pending, (state) => {
                state.isLoadingSettings = true; // Можно использовать тот же флаг загрузки
                state.settingsError = null;
            })
            .addCase(updateSlotSettings.fulfilled, (state, action: PayloadAction<FullSettingsApiResponse>) => {
                state.isLoadingSettings = false;
                state.settingsError = null;
                logger.log('[shiftsSlice] Received full settings payload after slot update:', action.payload);
                
                // Обновляем ТОЛЬКО конфиг слотов и lastUpdated
                const { maxDaySlots, maxNightSlots, lastUpdated } = action.payload;
                
                // ИСПРАВЛЕНИЕ: Нужен индекс дня для обновления конфигурации
                // Предположим, что обновляется день 0 (воскресенье) по умолчанию
                // или сохраняем в отдельном поле текущий день
                const defaultDayIndex = 0;
                
                if (state.slotConfig) { // Обновляем, если конфиг уже есть
                    // Используем правильный индекс дня, а не значение maxDaySlots
                    state.slotConfig[defaultDayIndex] = { maxDaySlots, maxNightSlots };
                } else { // Иначе создаем
                    state.slotConfig = {
                        [defaultDayIndex]: { maxDaySlots, maxNightSlots }
                    };
                }
                
                // Обновляем lastUpdated в accessSettings, если они есть
                if (state.accessSettings && lastUpdated) {
                    state.accessSettings.lastUpdated = lastUpdated;
                }
                
                logger.log('[shiftsSlice] updateSlotSettings fulfilled. State updated:', { access: state.accessSettings, slots: state.slotConfig });
            })
            .addCase(updateSlotSettings.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Failed to update slot settings';
            })
            // <<< Добавляем обработку для updateAccessRules >>>
            .addCase(updateAccessRules.pending, (state) => {
                state.isLoadingSettings = true;
                state.settingsError = null;
            })
            .addCase(updateAccessRules.fulfilled, (state, action: PayloadAction<AccessSettings>) => {
                state.isLoadingSettings = false;
                state.accessSettings = action.payload;
                 // НЕ СБРАСЫВАЕМ slotConfig здесь
            })
            .addCase(updateAccessRules.rejected, (state, action) => {
                state.isLoadingSettings = false;
                state.settingsError = action.payload as string;
            })
            // <<< Обработка fetchSlotConfig >>>
            .addCase(fetchSlotConfig.pending, (state) => {
                logger.debug('[shiftsSlice] fetchSlotConfig pending...');
                state.isLoadingSettings = true; // Используем общий флаг? Или нужен отдельный?
                state.settingsError = null; // Используем общую ошибку?
            })
            .addCase(fetchSlotConfig.fulfilled, (state, action: PayloadAction<SlotConfigResponse>) => {
                logger.debug('[shiftsSlice] fetchSlotConfig fulfilled.');
                state.isLoadingSettings = false;
                // Обновляем поле slotConfig данными из action.payload.config
                state.slotConfig = action.payload.config || defaultWeeklySlotConfig; // Используем дефолт, если API вернул null/undefined
            })
            .addCase(fetchSlotConfig.rejected, (state, action) => {
                logger.error('[shiftsSlice] fetchSlotConfig rejected:', action.payload);
                state.isLoadingSettings = false;
                state.settingsError = action.payload || 'Не удалось загрузить конфигурацию слотов';
                // Не сбрасываем slotConfig, оставляем предыдущее или дефолтное значение
            })
            // <<< ОБРАБОТЧИКИ ДЛЯ assignCourierToShiftThunk >>>
            .addCase(assignCourierToShiftThunk.pending, (state, action) => {
                // Можно добавить индикатор загрузки для конкретного слота, если нужно
                state.isLoading = true; // Общий флаг загрузки
                state.error = null;
                 logger.debug('[shiftsSlice] Назначение курьера в процессе...');
            })
            .addCase(assignCourierToShiftThunk.fulfilled, (state, action: PayloadAction<ApiShift>) => {
                state.isLoading = false;
                // <<< ИСПРАВЛЕНО: Маппим ApiShift в CourierShift перед добавлением в стейт >>>
                const newShift = mapApiShiftToCourierShift(action.payload);
                
                // Добавляем или обновляем смену в стейте, используя смапленный newShift
                const index = state.shifts.findIndex(shift => 
                    shift.id === newShift.id || 
                    (shift.date === newShift.date && 
                     shift.shiftType === newShift.shiftType && 
                     shift.slotIndex === newShift.slotIndex)
                );
                if (index !== -1) {
                    // Обновляем существующую
                    state.shifts[index] = newShift; 
                } else {
                    // Добавляем новую
                    state.shifts.push(newShift);
                }
                logger.debug('[shiftsSlice] Курьер успешно назначен, смена добавлена/обновлена (тип CourierShift).');
            })
            .addCase(assignCourierToShiftThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload ?? 'Неизвестная ошибка назначения курьера.';
                 logger.error(`[shiftsSlice] Ошибка назначения курьера: ${state.error}`);
            });
    }
});

// Экспорт actions и reducer
export const {
    shiftBookedWs,
    shiftCancelledWs,
    updateAccessRulesState, 
    updateSlotConfigLocal, 
    clearShifts,
    shiftAddedOrUpdated,
    shiftRemoved,
    removeShiftLocally,
    // <<< ЭКСПОРТ НОВЫХ ACTIONS >>>
    setShiftDialogOpen,
    setShiftDialogMode,
    toggleShiftDialogMode,
} = shiftsSlice.actions;

// Селекторы
export const selectAllShifts = (state: RootState): CourierShift[] => state.shifts.shifts;
export const selectShiftsByDate = (state: RootState, date: string): CourierShift[] =>
    state.shifts.shifts.filter(shift => shift.date === date);
export const selectIsLoading = (state: RootState) => state.shifts.loading;
export const selectError = (state: RootState) => state.shifts.error;
export const selectAccessSettings = (state: RootState) => state.shifts.accessSettings; // Теперь без слотов
export const selectSlotConfig = (state: RootState): WeeklySlotConfig | null => state.shifts.slotConfig;
export const selectIsLoadingSettings = (state: RootState) => state.shifts.isLoadingSettings;
export const selectSettingsError = (state: RootState) => state.shifts.settingsError;

// --- Добавляем селектор для получения конфига конкретного дня --- 
export const selectSlotConfigForDay = (dayIndex: number) => (state: RootState): SlotConfigForDay | undefined => {
    if (dayIndex < 0 || dayIndex > 6) return undefined;
    // Возвращаем конфиг дня или дефолтный, если основной конфиг или конфиг дня отсутствует
    const dayConfig = state.shifts.slotConfig ? state.shifts.slotConfig[dayIndex] : undefined;
    return dayConfig ?? defaultWeeklySlotConfig[dayIndex]; // <<< Возвращаем дефолт если undefined
};
// --- ------------------------------------------------------ --- 

// Селектор для проверки, назначен ли *конкретный* курьер на дату
export const selectIsCourierAssignedOnDate = (userId: string | null, date: string | null) => 
    createSelector(
        (state: RootState) => state.shifts.shifts,
        (shifts) => {
            if (!userId || !date) return false;
            return shifts.some(shift => shift.user_id === parseInt(userId, 10) && shift.date === date);
        }
    );

// <<< Новый селектор: возвращает карту назначенных курьеров на дату >>>
export const selectAssignedCouriersMapOnDate = (date: string | null) =>
    createSelector(
        (state: RootState) => state.shifts.shifts,
        (shifts) => {
            const assignedMap: { [userId: string]: true } = {};
            if (!date) return assignedMap; // Возвращаем пустой объект, если нет даты

            shifts.forEach(shift => {
                if (shift.date === date && shift.user_id !== null) { // Убедимся, что user_id не null
                    assignedMap[String(shift.user_id)] = true;
                }
            });
            return assignedMap;
        }
    );

// <<< НОВЫЕ СЕЛЕКТОРЫ ДЛЯ ДИАЛОГА >>>
export const selectIsShiftDialogOpen = (state: RootState): boolean => state.shifts.isShiftDialogOpen;
export const selectShiftDialogMode = (state: RootState): 'shifts' | 'reserves' => state.shifts.shiftDialogMode;

export default shiftsSlice.reducer; 