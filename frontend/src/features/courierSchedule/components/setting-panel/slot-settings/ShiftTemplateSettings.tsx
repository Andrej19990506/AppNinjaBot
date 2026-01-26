import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import { 
    SlotSettingsContainer, 
    SlotSettingsHeader, 
    SlotSettingsTitle, 
    SlotSettingsContent
} from '@/features/courierSchedule/components/courier-calendar/styles';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import {
    setLocalAppliedTemplates
} from '@features/courierSchedule/store/shiftsSlice/shiftsSlice';
import {
    updateSlotConfig} from '@features/courierSchedule/services/courierApi';
import { addNotification} from '@shared/store/notificationSlice/notificationSlice';
import { selectSlotConfig, selectSlotConfigForDay } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { 
    SlotConfigUpdatePayload, 
    ShiftTemplate, 
    ShiftTemplateCreatePayload,
    ShiftTemplateUpdatePayload,
    ShiftTemplateApplyPayload,
    FutureVersionInfo
} from '@features/courierSchedule/types/courierScheduleTypes';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
import { SlotConfigForDay } from '@features/courierSchedule/types/courierScheduleTypes';
import ShiftTemplateSelector from './components/ShiftTemplateSelector';
import ShiftTemplateForm from './components/ShiftTemplateForm';
import { PeriodSelector } from './components/PeriodSelector';
import { getCurrentBookingPeriod, getNextBookingPeriod } from '@features/courierSchedule/components/courier-calendar/utils/dateUtils';
import { getAppliedShiftTemplates, updateTemplateVersion } from '@features/courierSchedule/services/courierApi/shiftTemplatesApi';
import { selectAccessSettings } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { selectAllShifts } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { 
    selectShiftTemplates, 
    selectShiftTemplatesLoading, 
    selectShiftTemplatesError 
} from '@features/courierSchedule/store/shiftsSlice/shiftTemplatesSelectors';
import {
    fetchShiftTemplatesThunk,
    fetchAllShiftTemplatesThunk,
    createShiftTemplateThunk,
    updateShiftTemplateThunk,
    deleteShiftTemplateThunk,
    applyShiftTemplatesThunk,
    removeShiftTemplatesFromDaysThunk
} from '@features/courierSchedule/store/shiftsSlice/shiftTemplatesThunks';


const FullHeightContent = styled(SlotSettingsContent)`
    height: 100%;
    display: flex;
    flex-direction: column;
`;


const pulse = keyframes`
    0% { 
        opacity: 1; 
        transform: scale(1); 
    }
    50% { 
        opacity: 0.5; 
        transform: scale(1.3); 
    }
    100% { 
        opacity: 1; 
        transform: scale(1); 
    }
`;

const AnimatedDot = styled.div`
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background-color: #FF6B35;
    border-radius: 50%;
    border: 1px solid var(--card-background);
    animation: ${pulse} 1.2s ease-in-out infinite;
    transform-origin: center;
    z-index: 10;
`;

const DayIndicator = styled.div<{ 
    $isActive: boolean; 
    $isModified: boolean; 
    $clickable?: boolean;
}>`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    cursor: ${props => props.$clickable ? 'pointer' : 'default'};
    transition: all 0.2s ease;
    position: relative;
    
    ${props => {
        if (props.$isActive && props.$isModified) {
            return `
                background-color: #FF6B35;
                color: white;
                box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.3);
            `;
        } else if (props.$isActive) {
            return `
                background-color: var(--primary-color);
                color: white;
                box-shadow: 0 0 0 2px var(--primary-transparent);
            `;
        } else if (props.$isModified) {
            return `
                background-color: #FF6B35;
                color: white;
                border: 2px solid #FF6B35;
            `;
        } else {
            return `
                background-color: var(--card-background);
                color: var(--text-secondary);
                border: 1px solid var(--border-color);
            `;
        }
    }}

    &:hover {
        ${props => props.$clickable && `
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        `}
    }
`;

const WeekIndicatorTitle = styled.div`
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: 8px;
    font-weight: 500;
`;

const DaysSelectorContainer = styled.div`
    display: flex;
    gap: 8px;
    justify-content: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--card-background);
    flex-shrink: 0;
`;

const DaySelectorTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
    text-align: center;
`;

const InlineSpinner = styled.div`
    border: 2px solid rgba(var(--primary-rgb), 0.3);
    border-top: 2px solid var(--primary-color);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 8px;

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const stroke = keyframes`
  100% {
    stroke-dashoffset: 0;
  }
`;

const scale = keyframes`
  0%, 100% {
    transform: none;
  }
  50% {
    transform: scale3d(1.05, 1.05, 1);
  }
`;

const fillCircle = keyframes`
  100% {
    fill: var(--success-color);
  }
`;

const fadeInScaleUp = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const AnimatedCheckmarkWrapper = styled.div`
  width: 60px;
  height: 60px;
  margin-bottom: 20px;

  .checkmark__circle {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    stroke-width: 2;
    stroke-miterlimit: 10;
    stroke: var(--success-color); 
    fill: none;
    animation: 
      ${stroke} 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards, 
      ${fillCircle} 0.4s ease-in-out 0.4s forwards, 
      ${scale} 0.3s ease-in-out 0.9s both;
  }

  .checkmark {
    width: 100%;
    height: 100%;
    display: block; 
  }

  .checkmark__check {
    transform-origin: 50% 50%;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    stroke-width: 3;
    stroke: #fff;
    fill: none;
    animation: ${stroke} 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
  }
`;

const AnimatedCheckmark = () => (
    <AnimatedCheckmarkWrapper>
        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
    </AnimatedCheckmarkWrapper>
);

const SuccessMessageContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    min-height: 250px;
    animation: ${fadeInScaleUp} 0.5s ease-out forwards;
`;

const SuccessText = styled.p`
    font-size: 1.1rem;
    color: var(--text-color);
    margin-bottom: 24px;
`;

const OkButton = styled.button`
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px 20px;
    font-weight: 500;
    cursor: pointer;
    min-width: 100px;
    transition: background-color 0.2s;

    &:hover {
        background-color: var(--primary-dark);
    }
`;

// Кастомная модалка в стиле панели настроек
const ConfirmModalContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    animation: fadeIn 0.3s ease-out;
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;

const ModalHeader = styled.div`
    padding: 20px 24px;
    border-bottom: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 14px;
    background: linear-gradient(135deg, var(--card-background) 0%, rgba(255, 95, 31, 0.02) 100%);
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
`;

const ModalIcon = styled.div`
    font-size: 36px;
    line-height: 1;
    filter: drop-shadow(0 3px 6px rgba(255, 95, 31, 0.4));
    animation: iconPulse 2s ease-in-out infinite;
    
    @keyframes iconPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
`;

const ModalTitle = styled.h2`
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-color);
    flex: 1;
    letter-spacing: -0.01em;
`;

const ModalBody = styled.div`
    padding: 28px 28px 80px 28px;
    overflow-y: auto;
    flex: 1;
    background: var(--card-background);
`;

const AlertBox = styled.div<{ $variant: 'warning' | 'success' | 'info' }>`
    background: ${props => {
        if (props.$variant === 'success') {
            return 'linear-gradient(135deg, rgba(76, 175, 80, 0.12) 0%, rgba(76, 175, 80, 0.05) 100%)';
        }
        if (props.$variant === 'warning') {
            return 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)';
        }
        return 'linear-gradient(135deg, rgba(255, 95, 31, 0.12) 0%, rgba(255, 95, 31, 0.05) 100%)';
    }};
    border: 2px solid ${props => {
        if (props.$variant === 'success') return 'rgba(76, 175, 80, 0.25)';
        if (props.$variant === 'warning') return 'rgba(245, 158, 11, 0.25)';
        return 'rgba(255, 95, 31, 0.25)';
    }};
    border-left-width: 5px;
    padding: 24px;
    border-radius: var(--radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

const AlertTitle = styled.div<{ $variant: 'warning' | 'success' | 'info' }>`
    font-weight: 700;
    font-size: 1.15rem;
    margin-bottom: 14px;
    color: ${props => {
        if (props.$variant === 'success') return '#2e7d32';
        if (props.$variant === 'warning') return '#e65100';
        return 'var(--primary-color)';
    }};
    display: flex;
    align-items: center;
    gap: 12px;
    
    &::before {
        content: '${props => {
            if (props.$variant === 'success') return '✓';
            if (props.$variant === 'warning') return '⚡';
            return 'ℹ';
        }}';
        font-size: 1.5rem;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
    }
`;

const AlertText = styled.div`
    color: var(--text-color);
    line-height: 1.7;
    font-size: 0.98rem;
    font-weight: 400;
`;

const CheckboxContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
`;

const Checkbox = styled.input`
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: var(--primary-color);
    flex-shrink: 0;
`;

const CheckboxLabel = styled.label`
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    color: var(--text-color);
    flex: 1;
    line-height: 1.5;
`;

const PeriodSelectorContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
`;

const PeriodCard = styled.div<{ $isSelected: boolean; $isCurrent: boolean }>`
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    border: 2px solid ${props => props.$isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
    background: ${props => props.$isSelected ? 'rgba(255, 95, 31, 0.08)' : 'transparent'};
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    &:hover {
        border-color: ${props => props.$isSelected ? 'var(--primary-color)' : 'rgba(255, 95, 31, 0.4)'};
        background: ${props => props.$isSelected ? 'rgba(255, 95, 31, 0.12)' : 'rgba(255, 95, 31, 0.04)'};
    }
    
    ${props => props.$isCurrent && `
        &::before {
            content: 'Текущий';
            position: absolute;
            top: -8px;
            right: 12px;
            background: var(--primary-color);
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
        }
    `}
`;

const PeriodHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
`;

const PeriodLabel = styled.span`
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-color);
`;

const PeriodDates = styled.div`
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
`;

const PeriodRegistration = styled.div`
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-style: italic;
`;

export interface ShiftTemplateSettingsRef {
    triggerSave: () => Promise<void>;
    triggerReset: () => void;
    isDirty: boolean;
    isValid: () => boolean;
}

interface IShiftTemplateSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: number;
    dayIndex: number;
    onDayChangeRequest: (newDayIndex: number) => void;
    onDirtyChange: (isDirty: boolean) => void;
    onConfirmModalStateChange?: (isOpen: boolean, onConfirm: (() => void) | null, onCancel: (() => void) | null) => void;
}

const ShiftTemplateSettingsComponent: React.ForwardRefRenderFunction<ShiftTemplateSettingsRef, IShiftTemplateSettingsProps> = ({ 
    isOpen, 
    onClose, 
    chatId, 
    dayIndex,
    onDayChangeRequest,
    onDirtyChange,
    onConfirmModalStateChange
}, ref) => {
    const dispatch = useDispatch<AppDispatch>();

    const fullSlotConfig = useSelector(selectSlotConfig);
    
    // Получаем конфигурацию для текущего дня
    const dayConfig = useSelector(selectSlotConfigForDay(dayIndex));

    // Redux селекторы для шаблонов смен
    const templates = useSelector(selectShiftTemplates);
    const templatesLoading = useSelector(selectShiftTemplatesLoading);
    const templatesError = useSelector(selectShiftTemplatesError);
    const localAppliedTemplates = useSelector((state: any) => state.shifts.localAppliedTemplates);
    const accessSettings = useSelector(selectAccessSettings);
    const allShifts = useSelector(selectAllShifts);

    // Локальное состояние
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
    const [editingVersion, setEditingVersion] = useState<FutureVersionInfo | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'next'>('next');
    
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    
    // Состояние для диалога подтверждения отмены шаблона для следующего периода
    const [showUnapplyConfirmDialog, setShowUnapplyConfirmDialog] = useState(false);
    const [pendingUnapplyTemplateId, setPendingUnapplyTemplateId] = useState<string | null>(null);
    const [isCheckingNextPeriod, setIsCheckingNextPeriod] = useState(false);
    const [unapplyWarningMessage, setUnapplyWarningMessage] = useState<string | null>(null);
    
    // Состояние для подтверждения периода при редактировании
    const [showPeriodConfirmDialog, setShowPeriodConfirmDialog] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
    const [confirmDialogSeniorSlot, setConfirmDialogSeniorSlot] = useState(false);
    
    // Проверяем наличие записанных курьеров в текущем периоде
    const currentPeriodInfo = useMemo(() => {
        if (!accessSettings || !editingTemplate) return null;
        
        const currentPeriod = getCurrentBookingPeriod(accessSettings);
        if (!currentPeriod) return null;
        
        // Подсчитываем смены с записанными курьерами в текущем периоде для этого шаблона
        const periodShifts = allShifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            return shift.template_id === editingTemplate.id &&
                   shiftDate >= currentPeriod.startDate &&
                   shiftDate <= currentPeriod.endDate &&
                   shift.userId; // Только смены с записанными курьерами
        });
        
        return {
            hasShifts: periodShifts.length > 0,
            shiftsCount: periodShifts.length
        };
    }, [accessSettings, editingTemplate, allShifts]);

    const dayOfWeekNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const dayShortNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    // Загрузка шаблонов с сервера
    useEffect(() => {
        if (isOpen && chatId) {
            dispatch(fetchShiftTemplatesThunk(chatId));
        }
    }, [isOpen, chatId, dispatch]);

    // Проверка изменений
    const isDirty = useMemo(() => {
        // Если открыта форма шаблона - всегда считаем что есть изменения (чтобы галочка была активной)
        if (showTemplateForm) {
            return true;
        }
        
        const originalAppliedIds = dayConfig.shiftTemplates?.map(template => template.id) || [];
        const currentAppliedIds = localAppliedTemplates[dayIndex] || [];
        const hasChanges = JSON.stringify([...originalAppliedIds].sort()) !== JSON.stringify([...currentAppliedIds].sort());
        return hasChanges;
    }, [showTemplateForm, localAppliedTemplates, dayIndex, dayConfig.shiftTemplates]);

    const prevIsDirtyRef = useRef<boolean>();
    useEffect(() => {
        if (prevIsDirtyRef.current !== isDirty) {
            onDirtyChange(isDirty);
            prevIsDirtyRef.current = isDirty;
        }
    }, [isDirty, onDirtyChange]);

    const handleDayIndicatorClick = (newDayIndex: number) => {
        if (newDayIndex !== dayIndex) {
            onDayChangeRequest(newDayIndex);
        }
    };

    const handleTemplateCreate = useCallback(() => {
        setEditingTemplate(null);
        setShowTemplateForm(true);
    }, []);

    const handleTemplateEdit = useCallback((template: ShiftTemplate, version?: FutureVersionInfo) => {
        console.log('[handleTemplateEdit] Opening edit form:', {
            templateId: template.id,
            versionId: version?.id,
            hasVersion: !!version
        });
        setEditingTemplate(template);
        setEditingVersion(version || null);
        setShowTemplateForm(true);
        // Если редактируем версию, автоматически выбираем период "next"
        if (version) {
            setSelectedPeriod('next');
        }
    }, []);

    const handleTemplateDelete = useCallback(async (templateId: string) => {
        if (!chatId) return;
        
        try {
            await dispatch(deleteShiftTemplateThunk(templateId)).unwrap();
            
            // Обновляем список шаблонов после удаления
            await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка удаления шаблона: ${error.message || error}`,
                duration: 5000
            }));
        }
    }, [dispatch, chatId]);

    const handleTemplateUnapply = useCallback(async (templateId: string) => {
        if (!chatId) return;
        
        const currentApplied = localAppliedTemplates[dayIndex] || [];
        const isCurrentlyApplied = currentApplied.includes(templateId);
        
        if (isCurrentlyApplied) {
            // Проверяем, есть ли записанные курьеры в текущем периоде для этого шаблона
            setIsCheckingNextPeriod(true);
            try {
                const currentPeriod = getCurrentBookingPeriod(accessSettings);
                console.log('[handleTemplateUnapply] Checking shifts:', {
                    templateId,
                    dayIndex,
                    currentPeriod,
                    allShiftsCount: allShifts.length,
                    allShifts: allShifts.map(s => ({ 
                        id: s.id, 
                        date: s.date, 
                        template_id: (s as any).template_id, 
                        templateId: (s as any).templateId,
                        userId: s.userId 
                    }))
                });
                
                if (currentPeriod) {
                    // Подсчитываем смены с записанными курьерами в текущем периоде для этого шаблона
                    const periodShifts = allShifts.filter(shift => {
                        const shiftDate = new Date(shift.date);
                        const inPeriod = shiftDate >= currentPeriod.startDate &&
                                        shiftDate <= currentPeriod.endDate;
                        // Используем template_id (snake_case), так как это поле в CourierShift
                        const shiftTemplateId = (shift as any).template_id || (shift as any).templateId;
                        const matchesTemplate = shiftTemplateId === templateId;
                        const hasCourier = !!shift.userId;
                        
                        console.log('[handleTemplateUnapply] Shift check:', {
                            shiftId: shift.id,
                            date: shift.date,
                            shiftDate,
                            shiftTemplateId,
                            expectedTemplateId: templateId,
                            matchesTemplate,
                            inPeriod,
                            hasCourier,
                            startDate: currentPeriod.startDate,
                            endDate: currentPeriod.endDate
                        });
                        
                        return matchesTemplate && inPeriod && hasCourier;
                    });
                    
                    console.log('[handleTemplateUnapply] Period shifts found:', periodShifts.length, periodShifts);
                    
                    if (periodShifts.length > 0) {
                        // В текущем периоде есть записанные курьеры - показываем диалог подтверждения
                        // Шаблон останется активным в текущем периоде, но будет деактивирован для следующего
                        console.log('[handleTemplateUnapply] Showing confirmation dialog');
                        setPendingUnapplyTemplateId(templateId);
                        setUnapplyWarningMessage(
                            `На этот шаблон уже записаны курьеры в текущем периоде (${currentPeriod.startDateStr} - ${currentPeriod.endDateStr}). ` +
                            `Шаблон будет деактивирован только для следующего периода записи.`
                        );
                        setShowUnapplyConfirmDialog(true);
                        setIsCheckingNextPeriod(false);
                        return;
                    }
                }
            } catch (error) {
                console.error('Error checking current period shifts:', error);
            } finally {
                setIsCheckingNextPeriod(false);
            }
            
            // Если в текущем периоде нет записанных курьеров, выполняем отмену сразу
            console.log('[handleTemplateUnapply] No shifts in current period, performing unapply immediately');
            await performTemplateUnapply(templateId);
        } else {
            // Применяем шаблон - отправляем запрос на сервер
            try {
                await dispatch(applyShiftTemplatesThunk({
                    chatId,
                    applyData: {
                        dayOfWeek: dayIndex,
                        templateIds: [...currentApplied, templateId]
                    }
                })).unwrap();
                
                // Обновляем локальное состояние
                dispatch(setLocalAppliedTemplates({ 
                    dayOfWeek: dayIndex, 
                    templateIds: [...currentApplied, templateId]
                }));
                
                dispatch(addNotification({
                    type: NotificationTypes.SUCCESS,
                    message: "Шаблон применен",
                    duration: 3000
                }));
                
                // Обновляем список примененных шаблонов
                await dispatch(fetchAllShiftTemplatesThunk(chatId));
            } catch (error: any) {
                dispatch(addNotification({
                    type: NotificationTypes.ERROR,
                    message: `Ошибка применения шаблона: ${error.message || error}`,
                    duration: 5000
                }));
            }
        }
    }, [dispatch, dayIndex, localAppliedTemplates, chatId, accessSettings, allShifts]);
    
    // Функция для выполнения отмены применения шаблона
    const performTemplateUnapply = useCallback(async (templateId: string) => {
        if (!chatId) return;
        
        const currentApplied = localAppliedTemplates[dayIndex] || [];
        
        try {
            const result = await dispatch(removeShiftTemplatesFromDaysThunk({
                chatId,
                templateIds: [templateId],
                daysOfWeek: [dayIndex]
            })).unwrap();
            
            // Проверяем, будет ли шаблон деактивирован для следующего периода
            if (result.templates_deactivated_for_next_period && result.templates_deactivated_for_next_period.length > 0) {
                // Шаблон будет деактивирован для следующего периода
                // Не обновляем локальное состояние, так как шаблон остается активным в текущем периоде
                dispatch(addNotification({
                    type: NotificationTypes.SUCCESS,
                    message: "Шаблон будет отменен в следующем периоде",
                    duration: 5000
                }));
            } else {
                // Шаблон деактивирован сразу
                const newAppliedTemplates = currentApplied.filter((id: string) => id !== templateId);
                dispatch(setLocalAppliedTemplates({ 
                    dayOfWeek: dayIndex, 
                    templateIds: newAppliedTemplates 
                }));
                
                // Показываем предупреждение, если есть смены с курьерами
                if (result.has_future_shifts) {
                    dispatch(addNotification({
                        type: NotificationTypes.WARNING,
                        message: result.warning || "На этот шаблон уже записаны курьеры на будущие даты. Отмена будет применена при следующем открытии смен.",
                        duration: 8000
                    }));
                } else {
                    dispatch(addNotification({
                        type: NotificationTypes.SUCCESS,
                        message: "Применение шаблона отменено",
                        duration: 3000
                    }));
                }
            }
            
            // Обновляем список шаблонов
            await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка отмены применения шаблона: ${error.message || error}`,
                duration: 5000
            }));
        }
    }, [dispatch, dayIndex, localAppliedTemplates, chatId]);
    
    // Обработчики для диалога подтверждения
    const handleConfirmUnapply = useCallback(async () => {
        if (pendingUnapplyTemplateId) {
            setShowUnapplyConfirmDialog(false);
            const templateIdToUnapply = pendingUnapplyTemplateId;
            setPendingUnapplyTemplateId(null);
            setUnapplyWarningMessage(null);
            await performTemplateUnapply(templateIdToUnapply);
        }
    }, [pendingUnapplyTemplateId, performTemplateUnapply]);
    
    const handleCancelUnapply = useCallback(() => {
        setShowUnapplyConfirmDialog(false);
        setPendingUnapplyTemplateId(null);
        setUnapplyWarningMessage(null);
    }, []);

    const handleTemplateSubmit = useCallback(async (data: ShiftTemplateCreatePayload | ShiftTemplateUpdatePayload | ShiftTemplateCreatePayload[] | ShiftTemplateUpdatePayload[], skipConfirmation: boolean = false) => {
        if (!chatId) return;
        
        // Проверяем нужно ли показать подтверждение периода
        const isUpdate = Array.isArray(data) ? (data.length > 0 && 'id' in data[0]) : ('id' in data);
        const isEditingNonVersion = editingTemplate && !editingVersion;
        
        console.log('[handleTemplateSubmit] Debug info:', {
            isUpdate,
            isEditingNonVersion,
            skipConfirmation,
            editingTemplate: editingTemplate?.id,
            editingVersion: editingVersion?.id,
            dataIsArray: Array.isArray(data),
            dataHasId: Array.isArray(data) ? (data.length > 0 && 'id' in data[0]) : ('id' in data),
            data: Array.isArray(data) ? data : { id: (data as any).id }
        });
        
        if (isUpdate && isEditingNonVersion && !skipConfirmation) {
            // Получаем текущее значение hasSeniorSlot из данных
            const currentSeniorSlot = Array.isArray(data) 
                ? (data[0] as any).hasSeniorSlot 
                : (data as any).hasSeniorSlot;
            
            // Показываем диалог подтверждения
            setPendingSubmitData(data);
            setConfirmDialogSeniorSlot(currentSeniorSlot ?? false);
            setShowPeriodConfirmDialog(true);
            return;
        }

        try {
            // Если это массив (weekly режим)
            if (Array.isArray(data)) {
                // Проверяем тип первого элемента - CREATE или UPDATE
                const isUpdate = data.length > 0 && 'id' in data[0];
                
                if (isUpdate) {
                    // Обновляем все шаблоны по очереди
                    for (const templateData of data as ShiftTemplateUpdatePayload[]) {
                        const updateData: ShiftTemplateUpdatePayload = {
                            ...templateData,
                            applyToPeriod: selectedPeriod
                        };
                        await dispatch(updateShiftTemplateThunk({ 
                            templateId: templateData.id, 
                            templateData: updateData 
                        })).unwrap();
                    }
                    
                    dispatch(addNotification({
                        type: NotificationTypes.SUCCESS,
                        message: `Обновлено шаблонов: ${data.length}`,
                        duration: 3000
                    }));
                } else {
                    // Создаем все шаблоны по очереди
                    for (const templateData of data as ShiftTemplateCreatePayload[]) {
                        await dispatch(createShiftTemplateThunk({ chatId, templateData })).unwrap();
                    }
                    
                    dispatch(addNotification({
                        type: NotificationTypes.SUCCESS,
                        message: `Создано шаблонов: ${data.length}`,
                        duration: 3000
                    }));
                }
                
                // Обновляем список шаблонов
                await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
                
                setShowTemplateForm(false);
                setEditingTemplate(null);
                setEditingVersion(null);
                setSelectedPeriod('next');
                
                return;
            }
            
            // Если редактируем версию, обновляем версию напрямую
            if (editingVersion) {
                const versionUpdateData = {
                    maxSlots: data.maxSlots,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    hasSeniorSlot: data.hasSeniorSlot,
                    validFromDate: editingVersion.validFromDate
                };
                await updateTemplateVersion(editingVersion.id, versionUpdateData);
                // Обновляем список шаблонов после обновления версии
                await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
                setShowTemplateForm(false);
                setEditingTemplate(null);
                setEditingVersion(null);
                setSelectedPeriod('next');
                dispatch(addNotification({
                    type: NotificationTypes.SUCCESS,
                    message: "Версия шаблона успешно обновлена",
                    duration: 3000
                }));
                return;
            }

            // Если это обновление шаблона, добавляем информацию о периоде
            if ('id' in data) {
                // Обновление существующего шаблона с учетом выбранного периода
                const updateData: ShiftTemplateUpdatePayload = {
                    ...data,
                    applyToPeriod: selectedPeriod // 'current' или 'next'
                };
                console.log('[handleTemplateSubmit] Updating template with period:', { 
                    templateId: data.id, 
                    selectedPeriod, 
                    updateData 
                });
                await dispatch(updateShiftTemplateThunk({ templateId: data.id, templateData: updateData })).unwrap();
            } else {
                // Создание нового шаблона (всегда применяется к следующему периоду)
                await dispatch(createShiftTemplateThunk({ chatId, templateData: data })).unwrap();
            }
            
            // Обновляем список шаблонов после создания/обновления
            await dispatch(fetchAllShiftTemplatesThunk(chatId)).unwrap();
            
            setShowTemplateForm(false);
            setEditingTemplate(null);
            setEditingVersion(null);
            setSelectedPeriod('next'); // Сбрасываем выбор периода
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка сохранения шаблона: ${error.message || error}`,
                duration: 5000
            }));
        }
    }, [chatId, dispatch, selectedPeriod, editingVersion, editingTemplate]);
    
    // Обработчики для диалога подтверждения периода
    const handleConfirmPeriodSave = useCallback(() => {
        if (pendingSubmitData) {
            // Применяем значение чекбокса старшего курьера к данным
            let dataToSubmit = pendingSubmitData;
            if (Array.isArray(dataToSubmit)) {
                dataToSubmit = dataToSubmit.map(item => ({
                    ...item,
                    hasSeniorSlot: confirmDialogSeniorSlot
                }));
            } else {
                dataToSubmit = {
                    ...dataToSubmit,
                    hasSeniorSlot: confirmDialogSeniorSlot
                };
            }
            
            // Сбрасываем состояния
            setShowPeriodConfirmDialog(false);
            setPendingSubmitData(null);
            
            // Вызываем handleTemplateSubmit с флагом пропуска подтверждения
            handleTemplateSubmit(dataToSubmit, true);
        }
    }, [pendingSubmitData, confirmDialogSeniorSlot, handleTemplateSubmit]);
    
    const handleCancelPeriodSave = useCallback(() => {
        setShowPeriodConfirmDialog(false);
        setPendingSubmitData(null);
    }, []);

    // Эффект для передачи состояния модалок в Footer
    useEffect(() => {
        if (!onConfirmModalStateChange) return;

        if (showUnapplyConfirmDialog) {
            // Модалка отмены шаблона
            onConfirmModalStateChange(true, handleConfirmUnapply, handleCancelUnapply);
        } else if (showPeriodConfirmDialog) {
            // Модалка подтверждения периода
            onConfirmModalStateChange(true, handleConfirmPeriodSave, handleCancelPeriodSave);
        } else {
            // Модалки закрыты
            onConfirmModalStateChange(false, null, null);
        }
    }, [showUnapplyConfirmDialog, showPeriodConfirmDialog, onConfirmModalStateChange, handleConfirmUnapply, handleCancelUnapply, handleConfirmPeriodSave, handleCancelPeriodSave]);

    const handleTemplateFormCancel = useCallback(() => {
        setShowTemplateForm(false);
        setEditingTemplate(null);
        setEditingVersion(null);
    }, []);

    const handleSave = useCallback(async (): Promise<void> => {
        // Если открыта форма создания/редактирования шаблона, submit её
        if (showTemplateForm) {
            const form = document.getElementById('shift-template-form') as HTMLFormElement;
            if (form) {
                form.requestSubmit();
            }
            return;
        }
        
        // Иначе обычное сохранение применения шаблонов к дню
        if (!isDirty || !chatId) {
            return;
        }

        setIsLoading(true);
        setShowSuccess(false);
        
        try {
            // Применяем локально измененные шаблоны к текущему дню
            await dispatch(applyShiftTemplatesThunk({
                chatId,
                applyData: {
                    dayOfWeek: dayIndex,
                    templateIds: localAppliedTemplates[dayIndex] || []
                }
            })).unwrap();
            
            // Обновляем список примененных шаблонов после успешного применения
            await dispatch(fetchAllShiftTemplatesThunk(chatId));
            
            setShowSuccess(true);
            setIsLoading(false); 
            
        } catch (error: any) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: `Ошибка сохранения шаблонов смен: ${error.message || error}`,
                duration: 5000
            }));
            setIsLoading(false);
        }
    }, [showTemplateForm, isDirty, chatId, dayIndex, selectedTemplateIds, dispatch]);
    
    const handleReset = useCallback(() => {
        setSelectedTemplateIds([]);
        setIsLoading(false);
        setShowSuccess(false);
    }, []);

    useImperativeHandle(ref, () => ({
        triggerSave: handleSave,
        triggerReset: handleReset,
        isDirty,
        isValid: () => true
    }), [handleSave, handleReset, isDirty]);

    if (showSuccess) {
        return (
            <SlotSettingsContainer $isOpen={isOpen}>
                <SlotSettingsHeader>
                    <SlotSettingsTitle>Шаблоны смен</SlotSettingsTitle>
                </SlotSettingsHeader>
                <SlotSettingsContent>
                    <SuccessMessageContainer>
                        <AnimatedCheckmark />
                        <SuccessText>Шаблоны смен сохранены!</SuccessText>
                        <OkButton onClick={() => {
                            setShowSuccess(false);
                            onClose();
                        }}>
                            ОК
                        </OkButton>
                    </SuccessMessageContainer>
                </SlotSettingsContent>
            </SlotSettingsContainer>
        );
    }

    return (
        <SlotSettingsContainer $isOpen={isOpen}>
            {/* Условный рендеринг: показываем либо модалку, либо основной контент */}
            {showUnapplyConfirmDialog ? (
                // Модалка подтверждения отмены шаблона
                <ConfirmModalContainer>
                    <ModalHeader>
                        <ModalIcon>⚠️</ModalIcon>
                        <ModalTitle>Подтверждение отмены шаблона</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <AlertBox $variant="warning">
                            <AlertText>
                                {unapplyWarningMessage || "Вы уверены, что хотите отменить применение этого шаблона?"}
                            </AlertText>
                        </AlertBox>
                    </ModalBody>
                </ConfirmModalContainer>
            ) : showPeriodConfirmDialog ? (
                // Модалка подтверждения периода при редактировании
                <ConfirmModalContainer>
                    <ModalHeader>
                        <ModalIcon>⚠️</ModalIcon>
                        <ModalTitle>Подтверждение изменений</ModalTitle>
                    </ModalHeader>
                    <ModalBody>
                        <AlertBox $variant={selectedPeriod === 'current' ? 'warning' : 'success'}>
                            <AlertTitle $variant={selectedPeriod === 'current' ? 'warning' : 'success'}>
                                {selectedPeriod === 'current' 
                                    ? 'Изменения будут применены к ТЕКУЩЕМУ периоду' 
                                    : 'Изменения будут применены к СЛЕДУЮЩЕМУ периоду'}
                            </AlertTitle>
                            <AlertText>
                                {selectedPeriod === 'current' 
                                    ? 'Это повлияет на уже открытые смены и записанных курьеров. Будьте внимательны при внесении изменений!'
                                    : 'Текущие смены не будут затронуты. Изменения вступят в силу при следующем открытии смен.'}
                            </AlertText>
                            
                            <CheckboxContainer onClick={() => setConfirmDialogSeniorSlot(!confirmDialogSeniorSlot)}>
                                <Checkbox
                                    type="checkbox"
                                    id="senior-slot-checkbox"
                                    checked={confirmDialogSeniorSlot}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        setConfirmDialogSeniorSlot(e.target.checked);
                                    }}
                                />
                                <CheckboxLabel htmlFor="senior-slot-checkbox">
                                    Включить слот для старшего курьера
                                </CheckboxLabel>
                            </CheckboxContainer>
                            
                            <PeriodSelectorContainer>
                                {(() => {
                                    const currentPeriod = getCurrentBookingPeriod(accessSettings);
                                    const nextPeriod = getNextBookingPeriod(accessSettings);
                                    
                                    if (!currentPeriod || !nextPeriod) return null;
                                    
                                    // Показываем только альтернативный период
                                    if (selectedPeriod === 'current') {
                                        // Если выбран текущий - показываем следующий
                                        return (
                                            <PeriodCard
                                                $isSelected={false}
                                                $isCurrent={false}
                                                onClick={() => setSelectedPeriod('next')}
                                            >
                                                <PeriodHeader>
                                                    <PeriodLabel>Переключить на следующий период</PeriodLabel>
                                                </PeriodHeader>
                                                <PeriodDates>
                                                    {nextPeriod.startDateStr} - {nextPeriod.endDateStr}
                                                </PeriodDates>
                                                <PeriodRegistration>
                                                    Регистрация откроется: {nextPeriod.registrationDateStr}
                                                </PeriodRegistration>
                                            </PeriodCard>
                                        );
                                    } else {
                                        // Если выбран следующий - показываем текущий
                                        return (
                                            <PeriodCard
                                                $isSelected={false}
                                                $isCurrent={true}
                                                onClick={() => setSelectedPeriod('current')}
                                            >
                                                <PeriodHeader>
                                                    <PeriodLabel>Переключить на текущий период</PeriodLabel>
                                                </PeriodHeader>
                                                <PeriodDates>
                                                    {currentPeriod.startDateStr} - {currentPeriod.endDateStr}
                                                </PeriodDates>
                                                <PeriodRegistration>
                                                    Регистрация: {currentPeriod.registrationDateStr}
                                                </PeriodRegistration>
                                            </PeriodCard>
                                        );
                                    }
                                })()}
                            </PeriodSelectorContainer>
                        </AlertBox>
                    </ModalBody>
                </ConfirmModalContainer>
            ) : (
                // Основной контент
                <FullHeightContent>
                    {/* Селектор дня недели - показываем только когда НЕ открыта форма */}
                    {!showTemplateForm && (
                        <DaysSelectorContainer>
                            <div style={{ width: '100%' }}>
                                <DaySelectorTitle>Шаблоны на: {dayOfWeekNames[dayIndex]}</DaySelectorTitle>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    {dayShortNames.map((dayName, index) => (
                                        <DayIndicator
                                            key={index}
                                            $isActive={index === dayIndex}
                                            $isModified={false}
                                            $clickable={true}
                                            onClick={() => handleDayIndicatorClick(index)}
                                            title={dayOfWeekNames[index]}
                                        >
                                            {dayName}
                                        </DayIndicator>
                                    ))}
                                </div>
                            </div>
                        </DaysSelectorContainer>
                    )}

                    {showTemplateForm ? (
                        <>
                            {/* Показываем выбор периода только при редактировании существующего шаблона БЕЗ версии */}
                            {editingTemplate && !editingVersion && accessSettings && (
                                <PeriodSelector
                                    accessSettings={accessSettings}
                                    selectedPeriod={selectedPeriod}
                                    onPeriodChange={setSelectedPeriod}
                                    hasShiftsInCurrentPeriod={currentPeriodInfo?.hasShifts || false}
                                    shiftsCount={currentPeriodInfo?.shiftsCount || 0}
                                />
                            )}
                            <ShiftTemplateForm
                                template={editingTemplate}
                                version={editingVersion}
                                onSubmit={handleTemplateSubmit}
                                onCancel={handleTemplateFormCancel}
                                isLoading={isLoading || templatesLoading}
                                currentDayIndex={dayIndex}
                                formId="shift-template-form"
                                existingTemplates={templates}
                            />
                        </>
                    ) : (
                        <ShiftTemplateSelector
                                templates={templates.filter(template => {
                                    // Показываем шаблоны только если:
                                    // 1. У шаблона есть дни недели И текущий день входит в список
                                    // 2. Если у шаблона нет дней недели (пустой массив), не показываем его
                                    const hasDaysOfWeek = template.daysOfWeek && template.daysOfWeek.length > 0;
                                    const shouldShow = hasDaysOfWeek && template.daysOfWeek.includes(dayIndex);
                                    return shouldShow;
                                })}
                            selectedTemplateIds={selectedTemplateIds}
                            onTemplateSelect={setSelectedTemplateIds}
                            onTemplateEdit={handleTemplateEdit}
                            onTemplateDelete={handleTemplateDelete}
                            onTemplateCreate={handleTemplateCreate}
                            onTemplateUnapply={handleTemplateUnapply}
                            onTemplatesRefresh={async () => {
                                if (chatId) {
                                    await dispatch(fetchAllShiftTemplatesThunk(chatId));
                                }
                            }}
                            isLoading={isLoading || templatesLoading}
                            appliedTemplates={(() => {
                                // Создаем локальный массив примененных шаблонов на основе Redux состояния
                                const currentAppliedIds = localAppliedTemplates[dayIndex] || [];
                                return templates.filter(template => 
                                    currentAppliedIds.includes(template.id) && 
                                    template.daysOfWeek && 
                                    template.daysOfWeek.includes(dayIndex)
                                );
                            })()}
                        />
                    )}

                    {(isLoading || templatesLoading) && (
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <InlineSpinner /> {templatesLoading ? 'Загрузка...' : 'Сохранение...'}
                        </div>
                    )}
                    
                    {templatesError && (
                        <div style={{ 
                            textAlign: 'center', 
                            marginTop: '10px', 
                            color: 'var(--danger-color)',
                            padding: '10px',
                            backgroundColor: 'var(--danger-transparent)',
                            borderRadius: 'var(--radius-sm)'
                        }}>
                            Ошибка: {templatesError}
                        </div>
                    )}
                </FullHeightContent>
            )}
        </SlotSettingsContainer>
    );
};

const ShiftTemplateSettings = forwardRef(ShiftTemplateSettingsComponent);

ShiftTemplateSettings.displayName = 'ShiftTemplateSettings';

export default ShiftTemplateSettings;
