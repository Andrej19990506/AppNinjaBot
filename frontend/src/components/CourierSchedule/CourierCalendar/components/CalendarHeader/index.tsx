import React, { useRef, useEffect, useState } from 'react';
import { WEEK_DAYS, SLOTS_CONFIG } from '../../constants';
import {
    HeaderContainer,
    HeaderTop,
    Title,
    CloseButton,
    SlotsContainer,
    SlotsInfo,
    DaySlots,
    DayName,
    SlotCount,
    SlotBadge,
    SlotDivider
} from './styles';

interface CalendarHeaderProps {
    onClose: () => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ onClose }) => {
    const slotsContainerRef = useRef<HTMLDivElement>(null);
    const [hasShownScrollHint, setHasShownScrollHint] = useState(false);

    // Функция для анимации скролла
    const showScrollHint = () => {
        if (!slotsContainerRef.current || hasShownScrollHint) return;

        const container = slotsContainerRef.current;
        const scrollWidth = container.scrollWidth - container.clientWidth;

        setTimeout(() => {
            container.scrollTo({ 
                left: scrollWidth, 
                behavior: 'smooth' 
            });
            
            setTimeout(() => {
                container.scrollTo({ 
                    left: 0, 
                    behavior: 'smooth' 
                });
                setHasShownScrollHint(true);
            }, 2000);
        }, 1000);
    };

    useEffect(() => {
        showScrollHint();
    }, []);

    return (
        <HeaderContainer>
            <HeaderTop>
                <CloseButton onClick={onClose}>&larr;</CloseButton>
                <Title>Выберите дату смены</Title>
                <div style={{ width: '40px' }} />
            </HeaderTop>
            
            <SlotsContainer ref={slotsContainerRef}>
                <SlotsInfo>
                    {WEEK_DAYS.map((day) => (
                        <DaySlots key={day}>
                            <DayName>{day}</DayName>
                            <SlotCount>
                                <SlotBadge>{SLOTS_CONFIG.DAY.MAX_SLOTS}</SlotBadge>
                                <SlotDivider>/</SlotDivider>
                                <SlotBadge>{SLOTS_CONFIG.NIGHT.MAX_SLOTS}</SlotBadge>
                            </SlotCount>
                        </DaySlots>
                    ))}
                </SlotsInfo>
            </SlotsContainer>
        </HeaderContainer>
    );
};

export default React.memo(CalendarHeader); 