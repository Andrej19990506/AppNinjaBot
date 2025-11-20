import React, { useMemo } from 'react';
import styled from 'styled-components';
import ShiftPanelContainer from '@/features/courierSchedule/components/shift-panel/ShiftPanelContainer';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion'; 
import { CourierShift } from '@features/courierSchedule/types/courierScheduleTypes'; // ОСТАВЛЯЕМ
import { format } from 'date-fns';
import CouriersPanel from '@/features/courierSchedule/components/CouriersPanel';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import { fetchCouriersIfAllowed } from '@features/courierSchedule/store/courierSlice/courierThunks';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import { selectSlotConfigForDay, selectLocalAppliedTemplatesForDay } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { selectShiftTemplates } from '@features/courierSchedule/store/shiftsSlice/shiftTemplatesSelectors';

type ShiftType = CourierShift['shiftType'];
const COURIERS_PANEL_HEIGHT = 110; // px

const ShiftSection = styled(motion.div)`
    margin-bottom: 37px;
    &:last-child {
        margin-bottom: 0;
    }
`;

const ShiftTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    color: var(--text-color);
    font-size: 1.2rem;
    font-weight: 500;
`;

const ShiftIcon = styled.span`
    font-size: 1.4rem;
`;

const SeniorHint = styled.div`
    margin-top: 16px;
    padding: 12px 16px;
    background-color: rgba(255, 213, 0, 0.1);
    border-left: 3px solid #FFD700;
    border-radius: 4px;
    color: #705E00;
    font-size: 0.9rem;
    line-height: 1.5;
`;

const NoSlotsMessage = styled.div`
    margin-top: 16px;
    padding: 16px;
    background-color: rgba(255, 152, 0, 0.1);
    border-left: 3px solid #FF9800;
    border-radius: 4px;
    color: #A66200;
    font-size: 0.95rem;
    text-align: center;
    line-height: 1.5;
`;

const ReserveLinkButton = styled.button`
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color);
    font-weight: bold;
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    font-family: inherit;
    &:hover {
        text-decoration: none;
    }
`;

const NoTemplatesMessage = styled.div`
    margin-top: 16px;
    padding: 20px;
    background-color: rgba(255, 152, 0, 0.1);
    border-left: 3px solid #FF9800;
    border-radius: 4px;
    color: #A66200;
    font-size: 0.95rem;
    text-align: center;
    line-height: 1.5;
`;

const SetupTemplatesButton = styled.button`
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 16px;
    transition: all 0.2s ease;
    
    &:hover {
        background-color: var(--primary-color-dark);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const ShiftContentWrapper = styled(motion.div)`
  transition: padding-bottom 0.3s ease-out;
`;

// Анимации для слотов и секций
const fadeInVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
        opacity: 1,
        y: 0,
        transition: { 
            delay: custom * 0.03,
            duration: 0.2,
            ease: "easeOut"
        }
    }),
    exit: { opacity: 0, y: 20, transition: { duration: 0.15 } }
};

interface ShiftPanelProps {
    date: Date | null;
    shifts: CourierShift[]; // Все смены для даты - группируем по шаблонам внутри
    currentUserId: string;
    currentUserName?: string;
    onSlotSelect: (templateId: string, slotIndex: number, existingShiftId?: string, isDragAction?: boolean) => void;
    onSwitchToReserve: () => void;
    showSuccessMessage: (message: string) => void;
    showErrorMessage?: (message: string) => void;
    isLoading: boolean;
    loadingSlot: number | null;
    loadingTemplateId?: string | null; // ID шаблона, для которого идет загрузка
    chatId?: string;
    isSenior?: boolean;
    draggingTemplateId?: string | null; // ID шаблона, который перетаскивается
    isDraggingGlobal?: boolean;
    processingShiftId?: string | null;
    isProcessingMove?: boolean;
    onOpenProfile?: (courier: CourierShift) => void;
    onLongPressEmptySlot: (templateId: string, slotIndex: number) => void;
    isCouriersPanelOpen: boolean;
    panelTargetTemplateId: string | null; // ID шаблона для панели курьеров
    panelTargetSlotIndex: number | null;
    onCloseCouriersPanel: () => void;
    activeDragId?: string | null;
    onOpenShiftTemplateSettings?: () => void;
}


const ShiftPanel: React.FC<ShiftPanelProps> = React.memo(({ 
    date, 
    shifts, // Все смены для даты
    currentUserId, 
    currentUserName, 
    onSlotSelect, 
    onSwitchToReserve, 
    showSuccessMessage, 
    showErrorMessage, 
    isLoading = false,
    loadingSlot = null,
    loadingTemplateId = null,
    chatId,
    isSenior,
    draggingTemplateId,
    isDraggingGlobal,
    onOpenProfile,
    onLongPressEmptySlot,
    isCouriersPanelOpen,
    panelTargetTemplateId,
    panelTargetSlotIndex,
    onCloseCouriersPanel,
    onOpenShiftTemplateSettings
}) => {
    console.log('[ShiftPanel] Component rendered with props:', {
        date: date?.toISOString(),
        chatId,
        shiftsCount: shifts.length
    });
    
    // Проверяем, есть ли у пользователя смена
    const userHasShift = useMemo(() => 
        shifts.some(shift => shift.userId === currentUserId), 
        [shifts, currentUserId]
    );
    
    // Проверяем, есть ли шаблоны для текущего дня (учитываем локальные изменения)
    const dayOfWeek = date ? date.getDay() : 0; // 0 = воскресенье, 1 = понедельник, и т.д.
    const dayConfig = useAppSelector(selectSlotConfigForDay(dayOfWeek));
    const localAppliedTemplatesForDay = useAppSelector(selectLocalAppliedTemplatesForDay(dayOfWeek));
    const allShiftTemplates = useAppSelector(selectShiftTemplates);
    
    // Используем локальные примененные шаблоны из Redux
    const effectiveAppliedTemplates = localAppliedTemplatesForDay;
    const hasShiftTemplates = effectiveAppliedTemplates.length > 0;
    
    // ВАЖНО: Используем шаблоны из dayConfig.shiftTemplates, которые уже содержат правильные версии
    // для текущего периода, а не из allShiftTemplates (которые содержат только базовые значения)
    const templatesFromDayConfig = dayConfig.shiftTemplates || [];
    const displayTemplates = templatesFromDayConfig.filter(template => 
        effectiveAppliedTemplates.includes(template.id)
    );
    
    // Если в dayConfig нет шаблонов, fallback на allShiftTemplates (для обратной совместимости)
    const fallbackTemplates = displayTemplates.length === 0 && templatesFromDayConfig.length === 0
        ? allShiftTemplates.filter(template => effectiveAppliedTemplates.includes(template.id))
        : [];
    
    const finalDisplayTemplates = displayTemplates.length > 0 ? displayTemplates : fallbackTemplates;
    
    // Группируем смены по template_id
    const shiftsByTemplate = useMemo(() => {
        const grouped: Record<string, CourierShift[]> = {};
        shifts.forEach(shift => {
            if (shift.template_id) {
                if (!grouped[shift.template_id]) {
                    grouped[shift.template_id] = [];
                }
                grouped[shift.template_id].push(shift);
            }
        });
        return grouped;
    }, [shifts]);
    
    // Проверяем, все ли слоты заняты
    const isFullyBooked = useMemo(() => {
        if (!hasShiftTemplates) return false;
        return finalDisplayTemplates.every(template => {
            const templateShifts = shiftsByTemplate[template.id] || [];
            const occupiedSlots = templateShifts.filter(s => s.slotIndex !== -1).length;
            return occupiedSlots >= template.maxSlots;
        });
    }, [finalDisplayTemplates, shiftsByTemplate, hasShiftTemplates]);
    
    // Отладочные логи
    console.log('[ShiftPanel] Debug info:', {
        date: date?.toISOString(),
        dayOfWeek,
        shiftsCount: shifts.length,
        shiftsByTemplate,
        displayTemplates: finalDisplayTemplates.map(t => ({ 
            id: t.id, 
            name: t.name, 
            maxSlots: t.maxSlots,
            source: templatesFromDayConfig.includes(t) ? 'dayConfig' : 'allTemplates'
        })),
        templatesFromDayConfig: templatesFromDayConfig.map(t => ({ id: t.id, name: t.name, maxSlots: t.maxSlots })),
        isFullyBooked
    });
    
    const bottomPadding = isCouriersPanelOpen ? `${COURIERS_PANEL_HEIGHT}px` : '0px';
    
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectUser);

    React.useEffect(() => {
        const isSeniorOrAdmin = Array.isArray(user?.groups) && user.groups.some(
            g => String(g.chat_id) === String(chatId) && (g.is_senior_courier || g.role === 'creator')
        );
        if (isCouriersPanelOpen && chatId && user?.id && isSeniorOrAdmin) {
            dispatch(fetchCouriersIfAllowed({
                chatId,
                userId: user.id,
                isSeniorOrAdmin: !!isSeniorOrAdmin,
            }));
        }
    }, [isCouriersPanelOpen, chatId, user]);

    return (
        <>
            <ShiftContentWrapper 
                animate={{ paddingBottom: bottomPadding }}
                transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            >
                {hasShiftTemplates ? (
                    <>
                        {finalDisplayTemplates.map((template, templateIndex) => {
                            // Получаем смены для этого шаблона
                            const templateShifts = shiftsByTemplate[template.id] || [];
                            
                            return (
                            <ShiftSection 
                                key={`template-${template.id}-section`}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={fadeInVariants}
                                custom={templateIndex}
                            >
                                <ShiftTitle>
                                    <ShiftIcon>📋</ShiftIcon> {template.name}
                                </ShiftTitle>
                                <LayoutGroup>
                                    <ShiftPanelContainer
                                        shiftType={'day'} // Deprecated - оставлено для совместимости
                                        templateId={template.id} // ID шаблона смены
                                        shifts={templateShifts}
                                        maxSlots={template.maxSlots}
                                        currentUserId={currentUserId}
                                        currentUserName={currentUserName}
                                        onSlotSelect={(shiftType, slotIndex, existingShiftId, isDragAction) => {
                                            // Передаем только template_id и slotIndex
                                            console.log(`[ShiftPanel] Slot clicked: template=${template.id}, slot=${slotIndex}`);
                                            onSlotSelect(template.id, slotIndex, existingShiftId, isDragAction);
                                        }}
                                        isLoading={isLoading && loadingTemplateId === template.id}
                                        loadingSlot={loadingTemplateId === template.id ? loadingSlot : null}
                                        userHasShift={templateShifts.some(s => s.userId === currentUserId)}
                                        chatId={chatId}
                                        isSenior={isSenior}
                                        showSuccessMessage={showSuccessMessage}
                                        showErrorMessage={showErrorMessage}
                                        draggingShiftType={draggingTemplateId === template.id ? 'day' : null} // Для совместимости с ShiftPanelContainer
                                        isDraggingGlobal={isDraggingGlobal}
                                        onOpenProfile={onOpenProfile ? (shiftSlot) => {
                                            console.log('[ShiftPanel] Opening template profile with data:', shiftSlot);
                                            onOpenProfile({
                                                ...shiftSlot,
                                                date: format(date || new Date(), 'yyyy-MM-dd'),
                                                template_id: template.id
                                            } as CourierShift)
                                        } : undefined}
                                        onLongPressEmptySlot={(shiftType, slotIndex) => {
                                            // shiftType игнорируется, используем template.id
                                            onLongPressEmptySlot(template.id, slotIndex);
                                        }}
                                        hasSeniorSlot={template.hasSeniorSlot}
                                    />
                                </LayoutGroup>
                            </ShiftSection>
                            );
                        })}

                        {isFullyBooked && !userHasShift && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: 0.05, duration: 0.2 }}
                            >
                                <NoSlotsMessage key="no-slots-message">
                                    Все смены уже заняты.<br/>
                                    Вы можете <ReserveLinkButton onClick={onSwitchToReserve}>записаться в резерв</ReserveLinkButton>.
                                </NoSlotsMessage>
                            </motion.div>
                        )}
                    </>
                ) : (
                    <ShiftSection 
                        key="no-templates-section"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={fadeInVariants}
                        custom={0}
                    >
                        <NoTemplatesMessage>
                            <div>Настройки смен еще не созданы</div>
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.8 }}>
                                Создайте шаблоны смен для настройки расписания
                            </div>
                            {onOpenShiftTemplateSettings && isSenior && (
                                <SetupTemplatesButton onClick={onOpenShiftTemplateSettings}>
                                    Перейти к настройке шаблонов
                                </SetupTemplatesButton>
                            )}
                        </NoTemplatesMessage>
                    </ShiftSection>
                )}
                
            </ShiftContentWrapper> 
   
            <AnimatePresence> 
                {isCouriersPanelOpen && panelTargetTemplateId && panelTargetSlotIndex !== null && (
                     <CouriersPanel
                         key="couriers-panel"
                         shiftType={'day'} // Deprecated - оставлено для совместимости
                         slotIndex={panelTargetSlotIndex!}
                         onClose={onCloseCouriersPanel}
                         chatId={chatId}
                         date={date}
                         templateId={panelTargetTemplateId} // Передаем templateId
                     />
                )}
            </AnimatePresence>
        </>
    );
});

export default ShiftPanel;