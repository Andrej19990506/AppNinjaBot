import React, { memo } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector } from '@shared/store/hooks';
import { Button } from '@shared/components/Buttons/Button';
import { selectAccessSettings } from '@/features/courierSchedule/store/shiftsSlice/shiftsSelectors';

const getDayName = (dayOfWeek: number): string => {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[dayOfWeek % 7];
};

const formatTime = (hour: number, minute: number): string => {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}`;
};

// <<< Локальное определение pluralize >>>
const pluralize = (count: number, one: string, few: string, many: string): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return one;
    } else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) {
        return few;
    } else {
        return many;
    }
};

interface SuccessNotificationProps {
    message: string;
    onConfirm: () => void;
}

const Container = styled(motion.div)`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    width: 100%;
    position: relative;
    z-index: 1002;
    pointer-events: auto;
    background: var(--card-background);
    border-radius: var(--radius);
`;

const IconWrapper = styled(motion.div)`
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: var(--success-background);
    color: var(--success-color);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
`;

const CheckIcon = styled.div`
    position: relative;
    width: 32px;
    height: 32px;
    
    &::before {
        content: "";
        position: absolute;
        width: 20px;
        height: 10px;
        border-left: 4px solid var(--success-color);
        border-bottom: 4px solid var(--success-color);
        transform: rotate(-45deg);
        left: 6px;
        top: 8px;
    }
`;

const Message = styled.h3`
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 8px 0;
`;

const Description = styled.p`
    font-size: 16px;
    color: var(--text-secondary);
    margin: 0 0 28px 0;
    max-width: 320px;
`;

const ResultsContainer = styled(motion.div)`
    background-color: var(--background-light);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    width: 100%;
    max-width: 320px;
    border-left: 3px solid var(--success-color);
`;

const ResultsTitle = styled.h5`
    font-size: 15px;
    color: var(--text-color);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    
    svg {
        margin-right: 8px;
        color: var(--success-color);
    }
`;

const ResultsList = styled.ul`
    margin: 0;
    padding: 0 0 0 20px;
    list-style-type: none;
`;

const ResultItem = styled.li`
    position: relative;
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    
    &:before {
        content: "✓";
        position: absolute;
        left: -20px;
        color: var(--success-color);
    }
    
    &:last-child {
        margin-bottom: 0;
    }
`;

const ButtonContainer = styled.div`
    margin-top: 20px;
    position: relative;
    z-index: 1003;
    pointer-events: auto;
`;

const containerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
        opacity: 1, 
        scale: 1,
        transition: {
            duration: 0.4,
            delayChildren: 0.2,
            staggerChildren: 0.1
        }
    }
};

const iconVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
        scale: 1, 
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 20
        }
    }
};

const resultsContainerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 25,
            stiffness: 300,
            delay: 0.3
        }
    }
};

const SuccessIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const SuccessNotification = memo(({ message, onConfirm }: SuccessNotificationProps) => {
    const settings = useAppSelector(selectAccessSettings);
    
    if (!settings) {
        return null;
    }

    const dayName = getDayName(settings.registrationStartDay ?? 0);
    const timeString = formatTime(settings.registrationStartHour ?? 9, settings.registrationStartMinute ?? 0);
    
    let periodString = '';
    const offsetAmount = settings.offsetAmount ?? 0;

    if (settings.offsetType === 'days') {
        periodString = `за ${offsetAmount} ${pluralize(offsetAmount, 'день', 'дня', 'дней')} до смены`;
    } else if (settings.offsetType === 'weeks') {
        periodString = `за ${offsetAmount} ${pluralize(offsetAmount, 'неделю', 'недели', 'недель')} до смены`;
    } else {
        periodString = 'в день смены';
    }
    
    const automationStatus = settings.isAlwaysActive ? 'Активен' : 'Отключен';
    
    const lastUpdated = settings.lastUpdated 
        ? format(new Date(settings.lastUpdated), 'dd MMMM yyyy, HH:mm', { locale: ru }) 
        : 'Только что';
    
    return (
        <Container
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <IconWrapper
                variants={iconVariants}
            >
                <CheckIcon />
            </IconWrapper>
            <Message>Успешно сохранено!</Message>
            <Description>{message}</Description>
            
            <ResultsContainer
                variants={resultsContainerVariants}
            >
                <ResultsTitle>
                    <SuccessIcon />
                    Сводка настроек
                </ResultsTitle>
                <ResultsList>
                    <ResultItem>
                        <strong>День открытия регистрации:</strong> {dayName}, {timeString}
                    </ResultItem>
                    <ResultItem>
                        <strong>Период регистрации:</strong> {periodString}
                    </ResultItem>
                    <ResultItem>
                        <strong>Статус автоматизации:</strong> {automationStatus}
                    </ResultItem>
                    <ResultItem>
                        <strong>Последнее обновление:</strong> {lastUpdated}
                    </ResultItem>
                </ResultsList>
            </ResultsContainer>
            
            <ButtonContainer>
                <Button 
                    variant="primary" 
                    size="medium" 
                    onClick={onConfirm}
                >
                    OK
                </Button>
            </ButtonContainer>
        </Container>
    );
});

SuccessNotification.displayName = 'SuccessNotification';

export default SuccessNotification; 