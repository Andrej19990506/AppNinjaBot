import { AccessSettings } from '../../../../store/slices/shiftsSlice';

export interface CourierShift {
    id?: string;
    userId: string;
    photo_url?: string;
    firstName: string;
    lastName: string;
    date: string;
    shiftType: 'day' | 'night';
    slotIndex: number;
    isSeniorCourier?: boolean;
}

export interface ReserveShift {
    id: string;
    userId: string;
    date: string;
    chatId: string;
    photo_url?: string;
    firstName?: string;
    lastName?: string;
    created_at?: string;
}

export interface SlotsInfo {
    dayTotal: number;
    nightTotal: number;
    dayOccupied: number;
    nightOccupied: number;
    dayAvailable: boolean;
    nightAvailable: boolean;
    hasAvailableSlots: boolean;
}

export interface TooltipPosition {
    top: number;
    left: number;
    position?: 'top' | 'bottom' | 'left' | 'right';
    arrowOffset?: string;
}

export interface CalendarProps {
    onShiftSelect: (date: Date, shiftType: 'day' | 'night', slotIndex: number) => void;
    selectedDate?: Date;
    currentUserId: string;
    currentUserAvatar?: string;
    currentUserName?: string;
    onClose: () => void;
    chatId?: string;
    accessSettings?: AccessSettings;
    refetchData?: () => void;
}

export interface DayCellProps {
    date: Date | null;
    isToday: boolean;
    isSelected: boolean;
    hasShifts: boolean;
    isAvailable: boolean;
    onClick: () => void;
    currentUserId: string;
    currentUserAvatar?: string;
    getDayShifts: (date: Date) => CourierShift[];
    getNightShifts: (date: Date) => CourierShift[];
    hasUserShift: (date: Date) => boolean;
    userIsInReserve: (date: Date) => boolean;
}

export interface MonthSectionProps {
    month: Date;
    selectedDate: Date | null;
    onDayClick: (date: Date) => void;
    getDayShifts: (date: Date) => CourierShift[];
    getNightShifts: (date: Date) => CourierShift[];
    hasUserShift: (date: Date) => boolean;
    userIsInReserve: (date: Date) => boolean;
    currentUserAvatar?: string;
    currentUserId: string;
    accessSettings?: AccessSettings;
}

export interface CalendarHeaderProps {
    onClose: () => void;
} 