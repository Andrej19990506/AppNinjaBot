import React from 'react';
import styled from 'styled-components';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import BlockIcon from '@mui/icons-material/Block';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AccessStatusIndicatorProps {
    status: 'active' | 'pending' | 'blocked';
    nextOpeningDate?: string;
}

const StatusContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    margin-bottom: 16px;
`;

const StatusIcon = styled.div<{ status: 'active' | 'pending' | 'blocked' }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${props => {
        switch (props.status) {
            case 'active': return 'rgba(76, 175, 80, 0.1)';
            case 'pending': return 'rgba(255, 193, 7, 0.1)';
            case 'blocked': return 'rgba(244, 67, 54, 0.1)';
            default: return 'transparent';
        }
    }};

    svg {
        font-size: 20px;
        color: ${props => {
            switch (props.status) {
                case 'active': return '#4CAF50';
                case 'pending': return '#FFC107';
                case 'blocked': return '#F44336';
                default: return 'inherit';
            }
        }};
    }
`;

const StatusContent = styled.div`
    flex: 1;
`;

const StatusTitle = styled.div`
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 4px;
`;

const StatusDescription = styled.div`
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    line-height: 1.4;
`;

const getStatusConfig = (status: 'active' | 'pending' | 'blocked', nextOpeningDate?: string) => {
    let formattedDate = '';
    if (nextOpeningDate) {
        try {
            const date = parseISO(nextOpeningDate);
            formattedDate = format(date, "d MMMM 'в' HH:mm", { locale: ru });
        } catch (e) {
            console.error('Error parsing nextOpeningDate:', e);
        }
    }

    switch (status) {
        case 'active':
            return {
                icon: <CheckCircleIcon />,
                title: '🟢 Активен',
                description: 'Доступ открыт. Курьеры могут записываться на смены.'
            };
        case 'pending':
            return {
                icon: <PendingIcon />,
                title: '🟡 Ожидание',
                description: nextOpeningDate 
                    ? `Доступ откроется: ${formattedDate}`
                    : 'Доступ закроется согласно расписанию.'
            };
        case 'blocked':
            return {
                icon: <BlockIcon />,
                title: '🔴 Заблокирован',
                description: nextOpeningDate
                    ? `Запись приостановлена до ${formattedDate}`
                    : 'Запись временно приостановлена администратором.'
            };
        default:
            return {
                icon: <PendingIcon />,
                title: 'Неизвестный статус',
                description: ''
            };
    }
};

export const AccessStatusIndicator: React.FC<AccessStatusIndicatorProps> = ({
    status,
    nextOpeningDate
}) => {
    const config = getStatusConfig(status, nextOpeningDate);

    return (
        <StatusContainer>
            <StatusIcon status={status}>
                {config.icon}
            </StatusIcon>
            <StatusContent>
                <StatusTitle>{config.title}</StatusTitle>
                <StatusDescription>{config.description}</StatusDescription>
            </StatusContent>
        </StatusContainer>
    );
};

