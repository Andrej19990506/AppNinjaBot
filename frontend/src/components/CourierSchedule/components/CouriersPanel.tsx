import React, { forwardRef, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { logger } from '../../../utils/logger'; // Путь к логгеру может отличаться
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../../store/hooks';
import { selectUser } from '../../../store/slices/userSlice'; // Для получения ID текущего юзера
import {
    fetchAvailableCouriers,
    selectAvailableCouriers,
    selectAvailableCouriersLoading,
    selectAvailableCouriersError,
    clearAvailableCouriers,
    selectLastFetchedChatIdForCouriers
} from '../../../store/slices/availableCouriersSlice'; // Импорты из нового slice
import CourierIcon from './CourierIcon'; // Импортируем иконку
import { CourierInfo } from '../../../services/courierApi'; // Тип для onClick
import { RootState } from '../../../store/store'; // Импортируем RootState
import { format } from 'date-fns'; // <<< Добавляем импорт format
import { selectAllShifts } from '../../../store/slices/shiftsSlice';
import { CourierShift } from '../../../types/shifts'; // <<< Добавляем импорт типа

// Анимация (если нужна)
// const slideUp = keyframes` ... `;

// Стили
// const CouriersPanelOverlay = styled(motion.div)`
//     position: fixed;
//     top: 0;
//     left: 0;
//     right: 0;
//     bottom: 0;
//     background: rgba(0, 0, 0, 0.5);
//     z-index: 1090; // Ниже панели, выше остального
// `;

const CouriersPanelContainerStyled = styled(motion.div)`
    position: fixed;
    bottom: var(--navigation-height, 10px);
    left: 0.5rem;
    width: calc(100% - 1rem);
    height: 90px;
    background-color: var(--card-background);
    border-top: 2px solid var(--primary-color);
    border-radius: var(--radius);
    box-shadow: 0 -4px 12px -2px rgba(var(--primary-rgb), 0.3);
    z-index: 1100;
    padding: 0.5rem 1rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    will-change: transform;
    /* <<< Стили для отключения зума/выделения >>> */
    user-select: none;
    -webkit-user-select: none; /* Safari */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* IE10+ */
    -webkit-touch-callout: none; /* iOS Safari */
`;

// <<< Контейнер для прокручиваемых иконок >>>
const CouriersScrollContainer = styled.div`
    width: calc(100% - 36px - 1rem);
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    padding: 0.5rem 0;
    display: flex;
    gap: 0.8rem;

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

const CloseButtonStyled = styled.button`
    background: var(--primary-transparent);
    color: var(--primary-color);
    border: 1px solid var(--primary-transparent);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-left: 1rem;
    flex-shrink: 0;
    transition: all var(--transition-fast);
    font-size: 1.4rem;
    line-height: 1;

    &:hover {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
        transform: scale(1.1) rotate(90deg);
    }

     &:active {
        transform: scale(0.95) rotate(45deg);
    }
`;

// --- Новые стили для состояния загрузки/ошибки ---
const StatusMessage = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%; // Занимает всю высоту контейнера скролла
    flex-grow: 1;
    color: var(--text-secondary);
    font-size: 0.9rem;
    white-space: normal;
    text-align: center;
    padding: 0 1rem;
`;

const LoadingSpinner = styled.div` // Простой спиннер
    width: 20px;
    height: 20px;
    border: 3px solid var(--primary-transparent);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;

    @keyframes spin { to { transform: rotate(360deg); } }
`;
// --- Конец новых стилей ---

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
        onClose(); // Закрываем панель после выбора
    };

    return (
        <React.Fragment>
            {/* Оверлей удален */}
            {/* Сам контейнер панели */}
            <CouriersPanelContainerStyled
                ref={ref}
                key="couriers-panel-content"
                initial={{ x: "-100%", opacity: 0 }} // <<< Анимация слева
                animate={{ x: 0, opacity: 1 }}      // <<< Анимация слева
                exit={{ x: "-100%", opacity: 0 }}      // <<< Анимация слева
                transition={{ type: "spring", stiffness: 350, damping: 30 }} // <<< Пружинная анимация
                onDoubleClick={(e) => e.preventDefault()} // <<< Предотвращаем зум по двойному клику
            >
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
                    {/* <<< Используем отфильтрованный список >>> */}
                    {!isLoading && !error && filteredAvailableCouriers.length > 0 && (
                        filteredAvailableCouriers.map(courier => (
                            <motion.div
                                layout
                                key={courier.user_id}
                            >
                                <CourierIcon
                                    courier={courier}
                                    isAssigned={false}
                                />
                            </motion.div>
                        ))
                    )}
                </CouriersScrollContainer>

                <CloseButtonStyled onClick={onClose} title="Закрыть">
                    ×
                </CloseButtonStyled>
            </CouriersPanelContainerStyled>
        </React.Fragment>
    );
});

CouriersPanel.displayName = 'CouriersPanel'; // Добавляем displayName

export default CouriersPanel; // Экспортируем компонент 