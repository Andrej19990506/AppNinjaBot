// --- courierScheduleTypes.ts ---
// Все типы для фичи CourierSchedule: смены, резервы, параметры, состояния.

// --- Тип, приходит с API ---
export interface ApiShift {
    id: string;
    user_id?: string;
    photo_url: string | null;
    first_name: string;
    last_name: string;
    date: string;
    shift_type?: 'day' | 'night' | null; // Устаревшее поле, опционально
    slot_index: number;
    is_senior_courier?: boolean;
    template_id?: string | null; // ID шаблона смены
    member?: {
        id: string;
        user_id: string;
        first_name: string;
        last_name: string;
        photo_url: string | null;
        is_senior_courier?: boolean;
    };
    template?: {
        id: string;
        name: string;
        start_time: string; // HH:MM:SS format
        end_time: string;   // HH:MM:SS format
        max_slots: number;
        has_senior_slot: boolean;
    } | null;
}

export interface ApiReserve {
    id: string;
    date: string;
    created_at: string;
    group_id?: number;
    group?: any;
    member_id?: number;
    member?: {
        user_id: number;
        first_name: string;
        last_name: string;
        photo_url: string | null;
        is_senior_courier?: boolean;
    };
}


// --- Тип, записи в смены ---
export interface CourierShift {
    id: string;
    userId: string;
    photoUrl: string | null;
    firstName: string;
    lastName: string;
    date: string;
    shiftType?: 'day' | 'night' | null; // Устаревшее поле, опционально
    slotIndex: number;
    isSeniorCourier: boolean;
    template_id?: string | null;
    template?: {
        id: string;
        name: string;
        startTime: string; // HH:MM:SS format
        endTime: string;   // HH:MM:SS format
        maxSlots: number;
        hasSeniorSlot: boolean;
    } | null;
}

// --- Тип состояния курьера ---
export interface CourierState {
    isRegistered: boolean;
    currentShift: {
        startTime: string | null;
        endTime: string | null;
    } | null;
    loading: boolean;
    error: string | null;
    couriers: CourierInfo[];
    couriersLoading: boolean;
    couriersError: string | null;
    availableCouriers: CourierInfo[];
    availableCouriersLoading: boolean;
    availableCouriersError: string | null;
    lastFetchedChatId: string | null;
    assignedCouriersByDate: Record<string, Record<string, boolean>>;
}

// --- Тип записи в резерв ---
export interface ReserveEntry {
    id: string;
    userId: string;
    date: string;
    photoUrl: string | null;
    firstName: string;
    lastName: string;
    isSeniorCourier: boolean;
    createdAt: string;
    chatId: string;
}

// --- Тип состояния резервов ---
export interface ReservesState {
    reserves: ReserveEntry[];
    loading: boolean;
    error: string | null;
}

// --- Настройки доступа к сменам ---
export interface AccessSettings {
    chatId?: string;
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
    restrictedUsers?: (string | number)[];
    lastUpdated?: string;
    updatedBy?: string | number;
}

// --- Шаблон смены ---
export interface ShiftTemplate {
    id: string;
    name: string; // например "Дневные смены", "Вечерние смены"
    description?: string;
    startTime: string; // формат "HH:mm"
    endTime: string; // формат "HH:mm"
    maxSlots: number;
    hasSeniorSlot: boolean;
    isActive: boolean;
    daysOfWeek: number[]; // дни недели (0-6, где 0 = воскресенье)
    createdAt: string;
    updatedAt: string;
}

// --- Конфиг слотов на день (обновленный для работы с шаблонами) ---
export interface SlotConfigForDay {
    maxDaySlots: number;
    maxNightSlots: number;
    hasSeniorSlot?: boolean;
    // Время начала и конца дневной смены
    dayShiftStartTime?: string; // формат "HH:mm"
    dayShiftEndTime?: string; // формат "HH:mm"
    // Время начала и конца ночной смены
    nightShiftStartTime?: string; // формат "HH:mm"
    nightShiftEndTime?: string; // формат "HH:mm"
    // Шаблоны смен для дня
    shiftTemplates?: ShiftTemplate[];
}

// --- Конфиг слотов на неделю ---
export type WeeklySlotConfig = SlotConfigForDay[];

// --- Состояние смен ---
export interface ShiftState {
    shifts: CourierShift[];
    loading: boolean;
    error: string | null;
    accessSettings: AccessSettings | null;
    slotConfig: WeeklySlotConfig | null;
    isLoadingSettings: boolean;
    settingsError: string | null;
    isShiftDialogOpen: boolean;
    shiftDialogMode: 'shifts' | 'reserves';
    // Шаблоны смен
    shiftTemplates: ShiftTemplate[];
    templatesLoading: boolean;
    templatesError: string | null;
    // Локальные применения шаблонов (для отображения изменений в реальном времени)
    localAppliedTemplates: { [dayOfWeek: number]: string[] };
}



// --- Параметры для бронирования смены ---
export interface BookShiftParams {
    date: string;
    shiftType?: 'day' | 'night' | null; // Устаревшее поле, опционально
    slotIndex: number;
    userId: string;
}

// --- Параметры для добавления в резерв ---
export interface AddToReserveParams {
    date: string;
    userId: string;
}

// --- Параметры для удаления из резерва ---
export interface RemoveFromReserveParams {
    reserveId: string;
    userId: string;
}

// --- Тип слота смены ---
export interface ShiftSlot {
    id?: string;
    userId?: string;
    photoUrl?: string | null;
    firstName?: string;
    lastName?: string;
    slotIndex: number;
    isSeniorCourier?: boolean;
}

// --- Тип информации о курьере (CourierInfo) ---
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

// --- Payload для события shiftBookedWs (WebSocket) ---
export interface ShiftsUpdatedWsPayload {
    type: 'shifts_updated';
    chat_id: string;
    source: string;
    shift_data: CourierShift;
}

// --- Тип, приходит с API (резерв) ---
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

// --- Типы для slot config ---
export interface SlotConfigUpdatePayload {
    config: Record<string, SlotConfigForDay>;
}
export interface SlotConfigResponse {
    config: Record<string, SlotConfigForDay>;
}

// --- Типы для шаблонов смен ---
export interface ShiftTemplateCreatePayload {
    name: string;
    description?: string;
    startTime: string;
    endTime: string;
    maxSlots: number;
    hasSeniorSlot: boolean;
    daysOfWeek: number[];
}

export interface ShiftTemplateUpdatePayload {
    id: string;
    name?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    maxSlots?: number;
    hasSeniorSlot?: boolean;
    isActive?: boolean;
    daysOfWeek?: number[];
    applyToPeriod?: 'current' | 'next'; // Период применения изменений
}

export interface ShiftTemplateResponse {
    templates: ShiftTemplate[];
}

export interface ShiftTemplateApplyPayload {
    dayOfWeek: number; // 0-6 (воскресенье-суббота)
    templateIds: string[];
}

// --- Тип: статус курьера ---
export interface CourierStatusResponse {
    is_senior_courier: boolean;
}

// --- Тип: ответ на обновление статуса старшего ---
export interface UpdateSeniorityResponse {
    group_id: number;
    member_id: number;
    is_senior_courier: boolean | null;
    role: string;
}

// --- Тип: данные для обновления профиля курьера ---
export interface UpdateProfileData {
    firstName: string;
    lastName: string;
    isSeniorCourier?: boolean;
    seniorPassword?: string;
    chatId?: string;
}

// --- Тип: ключи для backendData (для updateCourierProfile) ---
export type BackendDataKeys = 'first_name' | 'last_name' | 'is_senior_courier' | 'senior_password' | 'chat_id';

// --- Тип: данные для добавления в резерв ---
export interface AddReserveApiData {
    user_telegram_id: number;
    group_telegram_id: number;
    reserve_date: string;
}

// --- Тип: данные для бронирования смены ---
export interface BookShiftApiData {
    date: string;
    user_telegram_id: number;
    shift_type?: 'day' | 'night'; // Устаревшее поле, опционально для обратной совместимости
    slot_index: number;
    group_telegram_id: number;
    template_id?: string | null; // ID шаблона смены (обязателен для новых смен)
}

// --- Тип: данные для назначения курьера на слот ---
export interface AssignCourierApiData {
    assigner_telegram_id: number | string;
    target_user_telegram_id: number | string;
    group_telegram_id: number | string;
    date: string;
    shift_type?: 'day' | 'night' | null; // Устаревшее поле, опционально (для обратной совместимости)
    template_id?: string | null; // ID шаблона смены (приоритетный параметр)
    slot_index: number;
}

// --- Тип: доступный период для табеля ---
export interface AvailablePeriodResponse {
    year: number;
    month: number;
} 

export interface AvailableCouriersState {
    couriers: CourierInfo[];
    isLoading: boolean;
    error: string | null;
    lastFetchedChatId: string | null;
    assignedCouriersByDate: Record<string, Record<string, boolean>>;
}