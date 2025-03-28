import React, { memo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { ActionButton } from './buttons';
import { useAppSelector } from '../../../../../store/hooks';
import { selectAccessSettings } from '../../../../../store/slices/shiftsSlice';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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

// Обновленный контейнер для результатов настроек
const ResultsContainer = styled(motion.div)`
    background-color: var(--background-light);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    width: 100%;
    max-width: 320px;
    border-left: 3px solid var(--success-color);
`;

// Обновленный заголовок для результатов
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

// Обновленный список результатов
const ResultsList = styled.ul`
    margin: 0;
    padding: 0 0 0 20px;
    list-style-type: none;
`;

// Обновленный элемент результата
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
`;

// Варианты анимации для контейнера
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

// Варианты анимации для иконки
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

// Анимация для контейнера результатов
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

// Анимация галочки внутри иконки
const checkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
        pathLength: 1, 
        opacity: 1,
        transition: { 
            duration: 0.6,
            ease: "easeInOut"
        }
    }
};

// Компонент иконки успеха
const SuccessIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

// Функция для получения названия дня недели
const getDayName = (day: number): string => {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[day];
};

// Функция для форматирования времени
const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

// Функция для склонения числительных
const pluralize = (count: number, one: string, few: string, many: string): string => {
    if (count % 10 === 1 && count % 100 !== 11) {
        return one;
    } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
        return few;
    } else {
        return many;
    }
};

const SuccessNotification = memo(({ message, onConfirm }: SuccessNotificationProps) => {
    // Получаем данные о настройках из Redux
    const settings = useAppSelector(selectAccessSettings);
    
    // Форматируем день и время открытия регистрации
    const dayName = getDayName(settings.registrationStartDay ?? 1);
    const timeString = formatTime(settings.registrationStartHour ?? 9, settings.registrationStartMinute ?? 0);
    
    // Формируем строку периода регистрации
    let periodString = '';
    if (settings.offsetType === 'days') {
        const days = settings.offsetAmount ?? 1;
        periodString = `За ${days} ${pluralize(days, 'день', 'дня', 'дней')} вперёд`;
    } else if (settings.offsetType === 'weeks') {
        const weeks = settings.offsetAmount ?? 1;
        periodString = `На ${weeks} ${pluralize(weeks, 'неделю', 'недели', 'недель')} вперёд`;
    } else {
        periodString = 'На текущий период';
    }
    
    // Получаем статус автоматизации
    const automationStatus = settings.isAlwaysActive ? 'Активен' : 'Отключен';
    
    // Форматируем дату последнего обновления
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
                <ActionButton onClick={onConfirm}>
                    OK
                </ActionButton>
            </ButtonContainer>
        </Container>
    );
});

SuccessNotification.displayName = 'SuccessNotification';

export default SuccessNotification; 