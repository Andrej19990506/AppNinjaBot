import React from 'react';
import styled from 'styled-components';
import LockIcon from '@mui/icons-material/Lock';
import EventIcon from '@mui/icons-material/Event';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AccessBlockedScreenProps {
    nextOpeningDate?: string;
}

const BlockedContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 40px 20px;
    text-align: center;
`;

const LockIconWrapper = styled.div`
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(244, 67, 54, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;

    svg {
        font-size: 40px;
        color: #F44336;
    }
`;

const Title = styled.h2`
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 12px 0;
`;

const Description = styled.p`
    font-size: 1rem;
    color: var(--text-color-secondary);
    max-width: 400px;
    line-height: 1.6;
    margin: 0 0 24px 0;
`;

const InfoCard = styled.div`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    max-width: 400px;
    width: 100%;
    margin-top: 8px;
`;

const InfoRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const InfoIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: rgba(254, 95, 0, 0.1);

    svg {
        font-size: 24px;
        color: var(--orange-primary);
    }
`;

const InfoContent = styled.div`
    flex: 1;
    text-align: left;
`;

const InfoLabel = styled.div`
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    margin-bottom: 2px;
`;

const InfoValue = styled.div`
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
`;

const Note = styled.div`
    margin-top: 24px;
    padding: 16px;
    background: rgba(76, 175, 80, 0.1);
    border-radius: 8px;
    color: var(--text-color-secondary);
    font-size: 0.9rem;
    max-width: 400px;
`;

export const AccessBlockedScreen: React.FC<AccessBlockedScreenProps> = ({
    nextOpeningDate
}) => {
    let formattedDate = '';
    let formattedTime = '';
    
    if (nextOpeningDate) {
        try {
            const date = parseISO(nextOpeningDate);
            formattedDate = format(date, "d MMMM yyyy", { locale: ru });
            formattedTime = format(date, "HH:mm", { locale: ru });
        } catch (e) {
            console.error('Error parsing nextOpeningDate:', e);
        }
    }

    return (
        <BlockedContainer>
            <LockIconWrapper>
                <LockIcon />
            </LockIconWrapper>

            <Title>🔒 Запись временно приостановлена</Title>
            
            <Description>
                Администратор обновляет расписание. 
                Запись на смены временно недоступна.
            </Description>

            {nextOpeningDate && formattedDate && (
                <InfoCard>
                    <InfoRow>
                        <InfoIcon>
                            <EventIcon />
                        </InfoIcon>
                        <InfoContent>
                            <InfoLabel>Доступ откроется:</InfoLabel>
                            <InfoValue>{formattedDate} в {formattedTime}</InfoValue>
                        </InfoContent>
                    </InfoRow>
                </InfoCard>
            )}

            <Note>
                ✅ Твои текущие записи сохранены и останутся в системе
            </Note>
        </BlockedContainer>
    );
};

