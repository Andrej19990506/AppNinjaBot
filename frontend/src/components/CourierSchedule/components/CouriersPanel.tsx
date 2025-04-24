import React, { forwardRef, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { logger } from '../../../utils/logger'; // Путь к логгеру может отличаться
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../../store/hooks';
import { selectUser } from '../../../store/slices/userSlice'; // Для получения ID текущего юзера
import {
    fetchAvailableCouriers,
    clearAvailableCouriers,
} from '../../../store/slices/availableCouriersSlice'; // Импорты из нового slice
import CourierIcon from './CourierIcon'; // Импортируем иконку
import { CourierInfo } from '../../../services/courierApi'; // Тип для onClick
import { RootState } from '../../../store/store'; // Импортируем RootState
import { format } from 'date-fns'; // <<< Добавляем импорт format
import { selectAllShifts } from '../../../store/slices/shiftsSlice';
import { CourierShift } from '../../../types/shifts'; // <<< Добавляем импорт типа


const CouriersPanelContainerStyled = styled(motion.div)`
    position: fixed;
    bottom: var(--navigation-height, 10px);
    left: 0.5rem;
    width: calc(100% - 1rem);
    height: 100px;
    background-color: var(--card-background);
    border-top: 2px solid var(--primary-color);
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: 0 -4px 12px -2px rgba(var(--primary-rgb), 0.3);
    z-index: 1100;
    padding: 1.5rem 1rem 0.5rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    will-change: transform;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    box-sizing: border-box;
`;

const CloseHandle = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    &:hover {
        background-color: rgba(var(--primary-rgb), 0.05);
    }
`;

const DownArrow = styled.div`
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid var(--primary-color);
    opacity: 0.7;
    transition: opacity var(--transition-fast);

    ${CloseHandle}:hover & {
        opacity: 1;
    }
`;

const CouriersScrollContainer = styled.div`
    flex-grow: 1;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    display: flex;
    gap: 0.8rem;
    touch-action: pan-x;
    margin-bottom: -0.5rem;

    &::-webkit-scrollbar {
        height: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background-color: var(--primary-transparent);
        border-radius: 3px;
    }
     &::-webkit-scrollbar-thumb:hover {
        background-color: var(--primary-light);
    }
`;

const StatusMessage = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    flex-grow: 1;
    color: var(--text-secondary);
    font-size: 0.9rem;
    white-space: normal;
    text-align: center;
    padding: 0 1rem;
`;

const LoadingSpinner = styled.div`
    width: 20px;
    height: 20px;
    border: 3px solid var(--primary-transparent);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;

    @keyframes spin { to { transform: rotate(360deg); } }
`;

// Интерфейс пропсов
export interface CouriersPanelProps {
    shiftType: 'day' | 'night';
    slotIndex: number;
    onClose: () => void;
    chatId?: string;
    onCourierSelect?: (courier: CourierInfo, shiftType: 'day' | 'night', slotIndex: number) => void;
    activeDragId?: string | null;
    date: Date | null; // <<< ДОБАВЬТЕ ЭТУ СТРОКУ
}

const CouriersPanel = forwardRef<HTMLDivElement, CouriersPanelProps>((
    { shiftType, slotIndex, onClose, chatId, onCourierSelect, activeDragId, date },
    ref
) => {
    logger.log(`[CouriersPanel] Rendering for ${shiftType} slot ${slotIndex}, chat ${chatId}, activeDragId: ${activeDragId}, date: ${date}`);
    const dispatch = useAppDispatch();
    const currentUser = useSelector(selectUser);

    // <<< REF для контейнера скролла >>>
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // <<< Селекторы для курьеров >>>
    const availableCouriersState = useSelector((state: RootState) => state.availableCouriers);
    const availableCouriers = availableCouriersState?.couriers ?? [];
    const isLoading = availableCouriersState?.isLoading ?? false;
    const error = availableCouriersState?.error ?? null;
    const lastFetchedChatId = availableCouriersState?.lastFetchedChatId ?? null;
    const allShifts: CourierShift[] = useSelector(selectAllShifts);

    // <<< Фильтрация доступных курьеров >>>
    const assignedUserIdsOnDate = React.useMemo(() => {
        if (!date) return new Set<string>();
        const dateString = format(date, 'yyyy-MM-dd');
        const assignedIds = new Set<string>();
        allShifts.forEach((shift: CourierShift) => {
            if (shift.date === dateString && shift.userId) {
                assignedIds.add(String(shift.userId));
            }
        });
        return assignedIds;
    }, [allShifts, date]);

    const filteredAvailableCouriers = React.useMemo(() => {
        const filtered = availableCouriers.filter(courier => !assignedUserIdsOnDate.has(String(courier.user_id)));
        logger.debug(`[CouriersPanel] Filtering: Total fetched=${availableCouriers.length}, Assigned on date=${assignedUserIdsOnDate.size}, Filtered available=${filtered.length}`);
        return filtered;
    }, [availableCouriers, assignedUserIdsOnDate]);

    // <<< Effect для загрузки курьеров >>>
    useEffect(() => {
        // Загружаем, только если есть chatId и requesterId
        if (chatId && currentUser?.id) {
            // Условие для старта загрузки:
            // - Не идет загрузка СЕЙЧАС (!isLoading)
            // - И (Это новый chatId ИЛИ была ошибка для текущего chatId)
            const shouldFetch = !isLoading && (lastFetchedChatId !== chatId || (error && lastFetchedChatId === chatId));

            if (shouldFetch) {
                logger.info(`[CouriersPanel Effect] Запуск fetchAvailableCouriers для chatId=${chatId}, requesterId=${currentUser.id}. Причина: ${lastFetchedChatId !== chatId ? 'Новый chatId/Первый запуск' : 'Повтор после ошибки'}`);
                dispatch(fetchAvailableCouriers({
                    groupTelegramId: chatId,
                    requesterId: String(currentUser.id)
                }));
            } else {
                 logger.debug(`[CouriersPanel Effect] Пропуск fetch. Условия: chatId=${chatId}, lastFetchedChatId=${lastFetchedChatId}, error=${error}, isLoading=${isLoading}`);
            }
        } else {
             logger.warn('[CouriersPanel Effect] Пропуск fetch из-за отсутствия chatId или currentUser.id');
        }

        // Функция очистки при размонтировании или изменении chatId/currentUser.id
        return () => {
            logger.debug('[CouriersPanel Effect Cleanup] Очистка состояния availableCouriers.');
            // Очищаем только если компонент действительно размонтируется (key изменился)
            // или если chatId/user изменились. Thunk сам обработает отмену, если нужно.
            // Простая очистка при unmount/dependency change:
             dispatch(clearAvailableCouriers());
        };
        // Зависим только от данных, определяющих контекст запроса
    }, [chatId, currentUser?.id, dispatch]); // Убрали isLoading, error, lastFetchedChatId из зависимостей!

    // Обработчик клика по иконке курьера
    const handleCourierClick = (courier: CourierInfo) => {
        logger.log(`[CouriersPanel] Выбран курьер: ${courier.first_name}, ID: ${courier.user_id}`);
        if (onCourierSelect) {
            onCourierSelect(courier, shiftType, slotIndex);
        }
    };

    return (
        <React.Fragment>
            <CouriersPanelContainerStyled
                ref={ref}
                key="couriers-panel-content"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                onDoubleClick={(e) => e.preventDefault()}
            >
                <CloseHandle onClick={onClose} title="Закрыть панель">
                    <DownArrow />
                </CloseHandle>

                <CouriersScrollContainer ref={scrollContainerRef}>
                    {isLoading && (
                        <StatusMessage>
                            <LoadingSpinner /> Загрузка курьеров...
                        </StatusMessage>
                    )}
                    {error && !isLoading && (
                        <StatusMessage>
                            Ошибка: {error}
                        </StatusMessage>
                    )}
                    {!isLoading && !error && availableCouriers.length === 0 && lastFetchedChatId === chatId && (
                         <StatusMessage>
                            Нет доступных курьеров для добавления в эту смену.
                         </StatusMessage>
                    )}
                    {!isLoading && !error && filteredAvailableCouriers.length > 0 && (
                        filteredAvailableCouriers.map(courier => (
                            <motion.div
                                layout
                                key={courier.user_id}
                                onClick={() => handleCourierClick(courier)}
                            >
                                <CourierIcon
                                    courier={courier}
                                    isAssigned={false}
                                />
                            </motion.div>
                        ))
                    )}
                </CouriersScrollContainer>
            </CouriersPanelContainerStyled>
        </React.Fragment>
    );
});

CouriersPanel.displayName = 'CouriersPanel'; // Добавляем displayName

export default CouriersPanel; // Экспортируем компонент 