import React, { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { WEEK_DAYS } from '@features/courierSchedule/constants';
import { CourierShift } from '@features/courierSchedule/types/courierScheduleTypes';
import DayCell from '@features/courierSchedule/components/courier-calendar/components/layout/mobile-layout/courier-calendar/day-cell';
import { isToday, isSelected, getDaysInMonth } from '@/features/courierSchedule/components/courier-calendar/utils/dateUtils';
import {
    MonthSectionContainer,
    MonthTitle,
    WeekDaysGrid,
    WeekDay,
    DaysGrid,
    DateCellStatusIconContainer
} from './styles';
import { AccessSettings, WeeklySlotConfig} from '@features/courierSchedule/types/courierScheduleTypes';
import { User } from '@/types/user';
import { logger } from '@shared/utils/logger';
import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import CloseIcon from '@mui/icons-material/Close';
import Tooltip from '@mui/material/Tooltip';
import { defaultSingleDaySlotConfig } from '@/features/courierSchedule/store/shiftsSlice/shiftsSlice';

interface MonthSectionProps {
    month: Date;
    selectedDate: Date | null;
    onDayClick: (date: Date) => void;
    getShiftsForDate: (date: Date) => CourierShift[];
    hasUserShift: (date: Date) => boolean;
    userIsInReserve: (date: Date) => boolean;
    currentUserAvatar?: string;
    currentUserId: string;
    accessSettings: AccessSettings | null;
    slotConfig: WeeklySlotConfig | null;
    isDateAvailable: (date: Date) => boolean;
    usersById: { [key: string]: User };
    isCurrentUserSenior: boolean;
    isDateFrozen?: (date: Date) => boolean;
}

const MonthSection: React.FC<MonthSectionProps> = ({
    month,
    selectedDate,
    onDayClick,
    getShiftsForDate,
    hasUserShift,
    userIsInReserve,
    currentUserId,
    slotConfig,
    isDateAvailable,
    usersById,
    isCurrentUserSenior,
    isDateFrozen
}) => {
    const [openTooltip, setOpenTooltip] = useState<{ date: string | null, message: string }>({ date: null, message: '' });
    const days = getDaysInMonth(month);

    // <<< Функция, которая реально закрывает тултип >>>
    const doCloseTooltip = () => {
        setOpenTooltip({ date: null, message: '' });
    };

    // <<< Обертка для onClose, фильтрующая touchend >>>
    const handleCloseWrapper = (event?: React.SyntheticEvent | Event) => {
        if (event) {
            // <<< Если событие - touchend, ничего не делаем >>>
            if (event.type === 'touchend') {
                return; 
            }
        }
        // <<< Вызываем реальное закрытие только для других событий >>>
        doCloseTooltip(); 
    };

    // <<< Функция открытия тултипа >>>
    const handleIconClick = (dateStr: string, message: string, event: React.MouseEvent) => {
        event.nativeEvent.stopImmediatePropagation(); 
        setTimeout(() => {
            setOpenTooltip({ date: dateStr, message });
        }, 0);
    };

    const handleIconTouchEnd = (event: React.TouchEvent) => {
        event.nativeEvent.stopImmediatePropagation();
    };

    return (
        <MonthSectionContainer>
            <MonthTitle>
                {format(month, 'LLLL yyyy', { locale: ru })}
            </MonthTitle>

            <WeekDaysGrid>
                {WEEK_DAYS.map(day => (
                    <WeekDay key={day}>{day}</WeekDay>
                ))}
            </WeekDaysGrid>

            <DaysGrid>
                {days.map((date, index) => {
                    if (date === null) {
                        return <div key={`empty-${index}`} />;
                    }

                    let statusIconElement: React.ReactElement | null = null;
                    let tooltipMessage = '';
                    const isAvailable = isDateAvailable(date);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    
                    const isSenior = isCurrentUserSenior;

                    if (isAvailable && isSenior && slotConfig) {
                        const dayIndex = date.getDay();
                        const dayConfig = slotConfig[dayIndex] || defaultSingleDaySlotConfig;
                        
                        if (dayConfig) {
                            // Используем новую логику с шаблонами
                            const templates = dayConfig.shiftTemplates || [];
                            
                            // Считаем общее количество слотов из всех шаблонов
                            const totalSlots = templates.reduce((sum, template) => {
                                return sum + (template.maxSlots || 0);
                            }, 0);
                            
                            // Если нет шаблонов, используем старую логику для обратной совместимости
                            const fallbackTotalSlots = (dayConfig.maxDaySlots || 0) + (dayConfig.maxNightSlots || 0);
                            const effectiveTotalSlots = totalSlots > 0 ? totalSlots : fallbackTotalSlots;
                            
                            if (effectiveTotalSlots > 0) {
                                // Считаем только обычные слоты (slotIndex !== -1), исключая слот старшего курьера
                                const allShifts = getShiftsForDate(date).filter(s => s.slotIndex !== -1);
                                const filledSlots = allShifts.length;
                                const completionPercentage = effectiveTotalSlots > 0 ? (filledSlots / effectiveTotalSlots) * 100 : 0;

                                const iconStyle = { fontSize: 'inherit', color: 'white' };

                                if (completionPercentage === 100) {
                                    tooltipMessage = 'Смена полностью укомплектована';
                                    statusIconElement = (
                                        <Tooltip
                                            title={tooltipMessage}
                                            open={openTooltip.date === dateStr}
                                            onClose={handleCloseWrapper}
                                            arrow
                                            placement="top"
                                            onClick={(e) => handleIconClick(dateStr, tooltipMessage, e)}
                                            onTouchEnd={handleIconTouchEnd}
                                            componentsProps={{
                                                tooltip: {
                                                    sx: {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.8) !important',
                                                        color: 'var(--text-color-on-primary, #ffffff) !important',
                                                        borderRadius: 'var(--radius-sm, 8px)',
                                                        boxShadow: 'var(--shadow, 0 1px 3px 0 rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%))',
                                                        fontSize: '0.8rem',
                                                        padding: '4px 8px',
                                                    }
                                                },
                                                arrow: {
                                                    sx: {
                                                        color: 'rgba(0, 0, 0, 0.8) !important',
                                                    }
                                                }
                                            }}
                                        >
                                            <DateCellStatusIconContainer style={{ backgroundColor: 'var(--success-color, #198754)' }}>
                                                <CheckIcon sx={iconStyle} />
                                            </DateCellStatusIconContainer>
                                        </Tooltip>
                                    );
                                } else if (completionPercentage > 50) {
                                    tooltipMessage = 'Смена укомплектована более чем на 50%';
                                    statusIconElement = (
                                        <Tooltip
                                            title={tooltipMessage}
                                            open={openTooltip.date === dateStr}
                                            onClose={handleCloseWrapper}
                                            arrow
                                            placement="top"
                                            onClick={(e) => handleIconClick(dateStr, tooltipMessage, e)}
                                            onTouchEnd={handleIconTouchEnd}
                                            componentsProps={{
                                                tooltip: {
                                                    sx: {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.8) !important',
                                                        color: 'var(--text-color-on-primary, #ffffff) !important',
                                                        borderRadius: 'var(--radius-sm, 8px)',
                                                        boxShadow: 'var(--shadow, 0 1px 3px 0 rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%))',
                                                        fontSize: '0.8rem',
                                                        padding: '4px 8px',
                                                    }
                                                },
                                                arrow: {
                                                    sx: {
                                                        color: 'rgba(0, 0, 0, 0.8) !important',
                                                    }
                                                }
                                            }}
                                        >
                                            <DateCellStatusIconContainer style={{ backgroundColor: 'var(--warning-color, #ffc107)' }}>
                                                <PriorityHighIcon sx={iconStyle} />
                                            </DateCellStatusIconContainer>
                                        </Tooltip>
                                    );
                                } else {
                                    tooltipMessage = 'Смена укомплектована на 50% или менее';
                                    statusIconElement = (
                                        <Tooltip
                                            title={tooltipMessage}
                                            open={openTooltip.date === dateStr}
                                            onClose={handleCloseWrapper}
                                            arrow
                                            placement="top"
                                            onClick={(e) => handleIconClick(dateStr, tooltipMessage, e)}
                                            onTouchEnd={handleIconTouchEnd}
                                            componentsProps={{
                                                tooltip: {
                                                    sx: {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.8) !important',
                                                        color: 'var(--text-color-on-primary, #ffffff) !important',
                                                        borderRadius: 'var(--radius-sm, 8px)',
                                                        boxShadow: 'var(--shadow, 0 1px 3px 0 rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%))',
                                                        fontSize: '0.8rem',
                                                        padding: '4px 8px',
                                                    }
                                                },
                                                arrow: {
                                                    sx: {
                                                        color: 'rgba(0, 0, 0, 0.8) !important',
                                                    }
                                                }
                                            }}
                                        >
                                            <DateCellStatusIconContainer style={{ backgroundColor: 'var(--danger-color, #dc3545)' }}>
                                                <CloseIcon sx={iconStyle} />
                                            </DateCellStatusIconContainer>
                                        </Tooltip>
                                    );
                                }
                            } else {
                                logger.debug(`[MonthSection] Date: ${dateStr}, totalSlots is 0, no status icon.`);
                            }
                        }
                    }

                    return (
                        <DayCell
                            key={date.toISOString()}
                            date={date}
                            isToday={isToday(date)}
                            isSelected={isSelected(date, selectedDate)}
                            hasShifts={getShiftsForDate(date).length > 0}
                            isAvailable={isAvailable}
                            onClick={() => onDayClick(date)}
                            currentUserId={currentUserId}
                            getShiftsForDate={getShiftsForDate}
                            hasUserShift={hasUserShift}
                            userIsInReserve={userIsInReserve}
                            slotConfig={slotConfig}
                            usersById={usersById}
                            statusIcon={statusIconElement}
                            openTooltip={openTooltip}
                            handleTooltipClose={doCloseTooltip}
                            isFrozen={isDateFrozen ? isDateFrozen(date) : false}
                        />
                    );
                })}
            </DaysGrid>
        </MonthSectionContainer>
    );
};

export default React.memo(MonthSection); 