import React, { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { WEEK_DAYS } from '../../constants';
import { CourierShift } from '../../../../../types/shifts';
import DayCell from '../DayCell';
import { isToday, isSelected, getDaysInMonth } from '../../utils/dateUtils';
import {
    MonthSectionContainer,
    MonthTitle,
    WeekDaysGrid,
    WeekDay,
    DaysGrid,
    DateCellStatusIconContainer
} from './styles';
import { AccessSettings, WeeklySlotConfig, defaultSingleDaySlotConfig } from '../../../../../store/slices/shiftsSlice';
import { User } from '../../../../../types/user';
import { logger } from '../../../../../utils/logger';
import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import CloseIcon from '@mui/icons-material/Close';
import Tooltip from '@mui/material/Tooltip';

interface MonthSectionProps {
    month: Date;
    selectedDate: Date | null;
    onDayClick: (date: Date) => void;
    getDayShifts: (date: Date) => CourierShift[];
    getNightShifts: (date: Date) => CourierShift[];
    hasUserShift: (date: Date) => boolean;
    userIsInReserve: (date: Date) => boolean;
    currentUserAvatar?: string;
    currentUserId: string;
    accessSettings: AccessSettings | null;
    slotConfig: WeeklySlotConfig | null;
    isDateAvailable: (date: Date) => boolean;
    usersById: { [key: string]: User };
}

const MonthSection: React.FC<MonthSectionProps> = ({
    month,
    selectedDate,
    onDayClick,
    getDayShifts,
    getNightShifts,
    hasUserShift,
    userIsInReserve,
    currentUserAvatar,
    currentUserId,
    accessSettings,
    slotConfig,
    isDateAvailable,
    usersById
}) => {
    const [openTooltip, setOpenTooltip] = useState<{ date: string | null, message: string }>({ date: null, message: '' });
    const days = getDaysInMonth(month);

    // <<< Функция, которая реально закрывает тултип >>>
    const doCloseTooltip = () => {
        logger.debug(`[MonthSection] doCloseTooltip executing.`);
        setOpenTooltip({ date: null, message: '' });
    };

    // <<< Обертка для onClose, фильтрующая touchend >>>
    const handleCloseWrapper = (event?: React.SyntheticEvent | Event) => {
        logger.debug(`[MonthSection] handleCloseWrapper called. Current state:`, openTooltip);
        if (event) {
            logger.debug(`[MonthSection] handleCloseWrapper event:`, {
                type: event.type,
                target: event.target,
                currentTarget: event.currentTarget,
            });
            // <<< Если событие - touchend, ничего не делаем >>>
            if (event.type === 'touchend') {
                logger.debug(`[MonthSection] Ignoring touchend event in handleCloseWrapper.`);
                return; 
            }
        }
        // <<< Вызываем реальное закрытие только для других событий >>>
        doCloseTooltip(); 
    };

    // <<< Функция открытия тултипа >>>
    const handleIconClick = (dateStr: string, message: string, event: React.MouseEvent) => {
        logger.debug(`[MonthSection] handleIconClick START for date: ${dateStr}`); 
        event.nativeEvent.stopImmediatePropagation(); 
        setTimeout(() => {
            logger.debug(`[MonthSection] handleIconClick setTimeout: setting state for ${dateStr}`); 
            setOpenTooltip({ date: dateStr, message });
        }, 0);
    };

    const handleIconTouchEnd = (event: React.TouchEvent) => {
        logger.debug(`[MonthSection] handleIconTouchEnd called for target:`, event.target);
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
                    
                    const currentUserData = usersById[currentUserId];
                    const isSenior = currentUserData?.isSeniorCourier;
                    
                    if (isAvailable && isSenior && slotConfig) {
                        const dayIndex = date.getDay();
                        const dayConfig = slotConfig[dayIndex] || defaultSingleDaySlotConfig;
                        
                        if (dayConfig) {
                            const daySlots = dayConfig.maxDaySlots || 0;
                            const nightSlots = dayConfig.maxNightSlots || 0;
                            const totalSlots = daySlots + nightSlots;
                            
                            if (totalSlots > 0) {
                                const dayShiftsCount = getDayShifts(date).length;
                                const nightShiftsCount = getNightShifts(date).length;
                                const filledSlots = dayShiftsCount + nightShiftsCount;
                                const completionPercentage = (filledSlots / totalSlots) * 100;

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
                                    logger.debug(`[MonthSection] Date: ${dateStr} -> Status: Green (CheckIcon)`);
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
                                    logger.debug(`[MonthSection] Date: ${dateStr} -> Status: Orange (PriorityHighIcon)`);
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
                                    logger.debug(`[MonthSection] Date: ${dateStr} -> Status: Red (CloseIcon)`);
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
                            hasShifts={getDayShifts(date).length > 0 || getNightShifts(date).length > 0}
                            isAvailable={isAvailable}
                            onClick={() => onDayClick(date)}
                            currentUserId={currentUserId}
                            getDayShifts={getDayShifts}
                            getNightShifts={getNightShifts}
                            hasUserShift={hasUserShift}
                            userIsInReserve={userIsInReserve}
                            slotConfig={slotConfig}
                            usersById={usersById}
                            statusIcon={statusIconElement}
                            openTooltip={openTooltip}
                            handleTooltipClose={doCloseTooltip}
                        />
                    );
                })}
            </DaysGrid>
        </MonthSectionContainer>
    );
};

export default React.memo(MonthSection); 