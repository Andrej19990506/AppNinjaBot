import React from 'react';
import styled, { keyframes } from 'styled-components';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import EventIcon from '@mui/icons-material/Event';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface FrozenShiftsBannerProps {
    nextOpeningDate?: string;
    reason?: string;
    onDismiss?: () => void;
}

const slideDown = keyframes`
    from {
        transform: translateY(-100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
`;

const BannerContainer = styled.div`
    background: linear-gradient(135deg, #FFC107 0%, #FFB300 100%);
    border-radius: 12px;
    padding: 16px 50px;
    margin-bottom: 16px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
    animation: ${slideDown} 0.4s ease-out;
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.5) 50%, 
            transparent 100%
        );
        animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }

    @media (max-width: 768px) {
        margin-top: 50px;
        padding: 12px 16px;
        gap: 12px;
        border-radius: 8px;
    }
`;

const IconWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    min-width: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(4px);

    svg {
        font-size: 28px;
        color: #000;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    @media (max-width: 768px) {
        width: 40px;
        height: 40px;
        min-width: 40px;

        svg {
            font-size: 24px;
        }
    }
`;

const Content = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Title = styled.div`
    font-size: 1.1rem;
    font-weight: 700;
    color: #000;
    display: flex;
    align-items: center;
    gap: 8px;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);

    svg {
        font-size: 20px;
    }

    @media (max-width: 768px) {
        font-size: 1rem;
    }
`;

const Description = styled.div`
    font-size: 0.95rem;
    color: rgba(0, 0, 0, 0.8);
    line-height: 1.5;
    font-weight: 500;

    @media (max-width: 768px) {
        font-size: 0.85rem;
    }
`;

const InfoRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    margin-top: 4px;
    backdrop-filter: blur(4px);

    svg {
        font-size: 18px;
        color: #000;
    }

    @media (max-width: 768px) {
        padding: 6px 10px;

        svg {
            font-size: 16px;
        }
    }
`;

const InfoText = styled.div`
    font-size: 0.9rem;
    font-weight: 600;
    color: #000;

    strong {
        font-weight: 700;
    }

    @media (max-width: 768px) {
        font-size: 0.85rem;
    }
`;

export const FrozenShiftsBanner: React.FC<FrozenShiftsBannerProps> = ({
    nextOpeningDate,
    reason
}) => {
    console.log('[FrozenShiftsBanner] Рендер баннера!', { nextOpeningDate, reason });
    
    let formattedDate = '';
    let formattedTime = '';
    
    if (nextOpeningDate) {
        try {
            // Извлекаем дату и время напрямую из строки без конвертации timezone
            // Пример: '2026-01-29T12:00:00+03:00'
            const match = nextOpeningDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            
            if (match) {
                const [, year, month, day, hour, minute] = match;
                
                // Форматируем дату
                const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                formattedDate = format(dateObj, "d MMMM yyyy", { locale: ru });
                
                // Время берем напрямую из строки (без конвертации!)
                formattedTime = `${hour}:${minute}`;
                
                console.log('[FrozenShiftsBanner] nextOpeningDate:', nextOpeningDate);
                console.log('[FrozenShiftsBanner] Извлеченное время:', formattedTime);
            }
        } catch (e) {
            console.error('Error parsing nextOpeningDate:', e);
        }
    }

    return (
        <BannerContainer>
            <IconWrapper>
                <WarningAmberIcon />
            </IconWrapper>
            <Content>
                <Title>
                    <LockIcon />
                    Смены заморожены
                </Title>
                <Description>
                    {reason || 'Правила записи изменены. Ваши смены, не попадающие в новый график, временно заморожены.'}
                </Description>
                {nextOpeningDate && formattedDate && (
                    <InfoRow>
                        <EventIcon />
                        <InfoText>
                            Открытие доступа: <strong>{formattedDate} в {formattedTime}</strong>
                        </InfoText>
                    </InfoRow>
                )}
            </Content>
        </BannerContainer>
    );
};

