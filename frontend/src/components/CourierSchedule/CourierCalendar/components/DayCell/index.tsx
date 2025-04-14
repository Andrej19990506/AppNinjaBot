import React, { useCallback, useRef } from 'react';
import { format } from 'date-fns';
import defaultAvatar from '../../../../../assets/images/Ninja.jpg';
import { CourierShift } from '../../types';
import { WeeklySlotConfig } from '../../../../../store/slices/shiftsSlice';
import { SLOTS_CONFIG } from '../../constants';
import {
    DayCellContainer,
    CourierAvatar,
    DayNumber,
    EmptySlotIndicator,
    OccupiedSlotIndicator,
    ReserveSlotIndicator,
    ReserveIcon,
    LockIcon
} from './styles';

interface DayCellProps {
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
    slotConfig: WeeklySlotConfig | null;
}

const DayCell: React.FC<DayCellProps> = ({
    date,
    isToday,
    isSelected,
    hasShifts,
    isAvailable,
    onClick,
    currentUserId,
    currentUserAvatar,
    getDayShifts,
    getNightShifts,
    hasUserShift,
    userIsInReserve,
    slotConfig
}) => {
    // Для предотвращения двойного тапа
    const lastTapRef = useRef<number>(0);
    const touchStartPosRef = useRef<{x: number, y: number} | null>(null);

    // Улучшенные обработчики тач-событий для iOS
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!date) return;
        
        // Запоминаем позицию первого касания
        if (e.touches.length === 1) {
            touchStartPosRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
        
        // Отменяем действия по умолчанию для предотвращения зума
        e.stopPropagation();
    }, [date]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!date) return;
        
        // Отменяем действия, если это не скролл
        if (touchStartPosRef.current) {
            const diffX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
            const diffY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
            
            // Если это похоже на жест масштабирования, блокируем
            if (diffX > 10 || diffY > 10) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }, [date]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!date) return;
        
        // Обработка двойного тапа
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300; // ms
        
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Это двойной тап, блокируем
            e.preventDefault();
            e.stopPropagation();
            lastTapRef.current = 0; // Сбрасываем счетчик
        } else {
            // Одинарный тап
            lastTapRef.current = now;
            
            // Вызываем клик с небольшой задержкой, чтобы предотвратить двойной тап
            setTimeout(() => {
                if (lastTapRef.current !== 0) { // Если не был сброшен при двойном тапе
                    onClick();
                    lastTapRef.current = 0;
                }
            }, DOUBLE_TAP_DELAY);
        }
        
        // Сбрасываем позицию касания
        touchStartPosRef.current = null;
    }, [date, onClick]);

    if (!date) {
        return <DayCellContainer as="div" />;
    }

    const renderContent = () => {
        const dayIndex = date.getDay();
        const dayConfig = slotConfig ? slotConfig[dayIndex] : undefined;
        const currentMaxDay = dayConfig?.maxDaySlots ?? SLOTS_CONFIG.DAY.MAX_SLOTS;
        const currentMaxNight = dayConfig?.maxNightSlots ?? SLOTS_CONFIG.NIGHT.MAX_SLOTS;
        
        const dayShifts = getDayShifts(date);
        const nightShifts = getNightShifts(date);
        const userHasShift = hasUserShift(date);
        const inReserve = userIsInReserve(date);

        if (userHasShift) {
            const userShift = [...dayShifts, ...nightShifts].find(shift => 
                String(shift.userId) === String(currentUserId)
            );
            return (
                <CourierAvatar 
                    src={userShift?.photo_url || currentUserAvatar || defaultAvatar}
                    alt={userShift?.firstName || 'Пользователь'}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const img = e.currentTarget;
                        img.src = defaultAvatar;
                    }}
                />
            );
        }

        if (inReserve) {
            return (
                <ReserveSlotIndicator>
                    <DayNumber $isAvailable={true} style={{
                        color: '#FF9500',
                        fontWeight: '600',
                        textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
                    }}>
                        {format(date, 'd')}
                    </DayNumber>
                    <ReserveIcon title="Вы в резерве на эту дату" />
                </ReserveSlotIndicator>
            );
        }

        if (isAvailable) {
            const allDaySlotsOccupied = dayShifts.length >= currentMaxDay;
            const allNightSlotsOccupied = nightShifts.length >= currentMaxNight;

            if (allDaySlotsOccupied && allNightSlotsOccupied) {
                return (
                    <OccupiedSlotIndicator title="Все смены заняты">
                        <DayNumber 
                            $isAvailable={false} 
                            style={{ 
                                color: '#FF3B30', 
                                opacity: 0.9,
                                fontSize: '0.85rem',
                                position: 'absolute',
                                top: '24%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontWeight: '600',
                                textShadow: '0 0 3px rgba(255, 255, 255, 0.9)'
                            }}
                        >
                            {format(date, 'd')}
                        </DayNumber>
                        <LockIcon />
                    </OccupiedSlotIndicator>
                );
            }
            return (
                <EmptySlotIndicator>
                    <DayNumber $isAvailable={true}>{format(date, 'd')}</DayNumber>
                </EmptySlotIndicator>
            );
        }

        return <DayNumber $isAvailable={false}>{format(date, 'd')}</DayNumber>;
    };

    return (
        <DayCellContainer
            onClick={onClick}
            $isToday={isToday}
            $isSelected={isSelected}
            $hasShifts={hasShifts}
            $isAvailable={isAvailable}
            aria-label={`День ${format(date, 'd')}`}
            role="button"
        >
            {renderContent()}
        </DayCellContainer>
    );
};

export type { DayCellProps };
export default React.memo(DayCell); 