import React, { forwardRef, useRef, useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectUsersById } from '@shared/store/userSlice/userSelectors';
import CourierIcon from '@/features/courierSchedule/components/courier-profile/CourierIcon'; 
import { RootState } from '@shared/store/store'; 
import { format } from 'date-fns';
import { selectShiftsByDate } from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { CourierInfo } from '@features/courierSchedule/types/courierScheduleTypes';
import { fetchCouriers } from '@features/courierSchedule/store/courierSlice/courierThunks';


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
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    white-space: normal;
    text-align: center;
    padding: 0 1rem;
    pointer-events: none;
    z-index: 2;
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
    const currentUser = useSelector(selectUser);
    const usersById = useSelector(selectUsersById);

    // <<< REF для контейнера скролла >>>
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // --- Новый способ получения доступных курьеров ---
    const couriers = Object.values(usersById).map(user => ({
        id: user.id,
        user_id: user.id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        photo_url: user.photo_url || '',
        is_senior_courier: (user as any).is_senior_courier ?? null,
        role: (user as any).role ?? null,
        username: user.username || null,
    }));

    // --- Фильтрация: исключаем всех, кто уже в смене (день или ночь) на эту дату ---
    const dateString = date ? format(date, 'yyyy-MM-dd') : '';
    const shifts = useSelector((state: RootState) => selectShiftsByDate(state, dateString));
    const assignedUserIds = shifts.map(shift => String(shift.userId));
    const availableCouriers = couriers.filter(courier => !assignedUserIds.includes(String(courier.user_id)));
    const error = null;      // Ошибки тоже не будет

    // ---загрузки курьеров ---
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, [dateString]);

    // Обработчик клика по иконке курьера
    const handleCourierClick = (courier: CourierInfo) => {
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

                <CouriersScrollContainer ref={scrollContainerRef} style={{ position: 'relative' }}>
                    {availableCouriers.map((courier, idx) => {
                        const baseDelay = 0.08;
                        const delay = baseDelay * idx;
                        return (
                            <motion.div
                                layout
                                key={courier.user_id}
                                onClick={() => !isLoading && handleCourierClick(courier)}
                                initial={false}
                                animate={
                                    isLoading
                                        ? { opacity: 0, x: 0 }
                                        : { opacity: 1, x: 0 }
                                }
                                transition={
                                    isLoading
                                        ? { duration: 0 }
                                        : {
                                            delay,
                                            duration: 0.35 + 0.1 * (1 - idx / availableCouriers.length),
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 25
                                        }
                                }
                                style={{ pointerEvents: isLoading ? 'none' : 'auto' }}
                            >
                                <CourierIcon
                                    courier={courier}
                                    isAssigned={false}
                                />
                            </motion.div>
                        );
                    })}
                    {isLoading && (
                        <StatusMessage>
                            <LoadingSpinner /> Загрузка курьеров...
                        </StatusMessage>
                    )}
                </CouriersScrollContainer>
            </CouriersPanelContainerStyled>
        </React.Fragment>
    );
});

CouriersPanel.displayName = 'CouriersPanel'; 

export default CouriersPanel;