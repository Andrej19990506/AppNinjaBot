import React from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Competition } from '../types/competition';

const Card = styled.div`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 20px;
    cursor: pointer;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--primary-color);
    }
`;

const StatusBadge = styled.div<{ $status: string }>`
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 12px;
    
    ${props => {
        switch (props.$status) {
            case 'announcement':
                return `
                    background: var(--warning-transparent);
                    color: var(--warning-color);
                    border: 1px solid var(--warning-color);
                `;
            case 'active':
                return `
                    background: var(--success-transparent);
                    color: var(--success-color);
                    border: 1px solid var(--success-color);
                `;
            case 'completed':
                return `
                    background: var(--info-transparent);
                    color: var(--info-color);
                    border: 1px solid var(--info-color);
                `;
            default:
                return '';
        }
    }}
`;

const Title = styled.h3`
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 12px 0;
    line-height: 1.3;
`;

const Description = styled.div`
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 16px 0;
    line-height: 1.5;
    
    /* Стили для отформатированного текста */
    .bold {
        font-weight: bold;
    }
    
    .italic {
        font-style: italic;
    }
    
    .underline {
        text-decoration: underline;
    }
    
    .strikethrough {
        text-decoration: line-through;
    }
    
    .highlight {
        background: var(--warning-background);
        padding: 2px 4px;
        border-radius: 4px;
    }
    
    .accent {
        color: var(--primary-color);
        font-weight: 600;
    }
    
    .success {
        color: var(--success-color);
        font-weight: 600;
    }
    
    .warning {
        color: var(--warning-color);
        font-weight: 600;
    }
    
    .error {
        color: var(--error-color);
        font-weight: 600;
    }
    
    .large {
        font-size: 1.2em;
    }
    
    .small {
        font-size: 0.9em;
    }
    
    .emoji {
        font-size: 1.2em;
    }
`;

const InfoRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
`;

const InfoLabel = styled.span`
    color: var(--text-secondary);
`;

const InfoValue = styled.span`
    color: var(--text-color);
    font-weight: 500;
`;

const Prize = styled.div`
    background: var(--primary-transparent);
    border: 1px solid var(--primary-color);
    border-radius: var(--radius);
    padding: 8px 12px;
    text-align: center;
    margin: 12px 0;
`;

const PrizeLabel = styled.div`
    font-size: 11px;
    color: var(--primary-color);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 2px;
`;

const PrizeAmount = styled.div`
    font-size: 16px;
    color: var(--primary-color);
    font-weight: 700;
`;

const WinnerSection = styled.div`
    background: var(--success-transparent);
    border: 1px solid var(--success-color);
    border-radius: var(--radius);
    padding: 12px;
    margin-top: 12px;
`;

const WinnerTitle = styled.div`
    font-size: 12px;
    color: var(--success-color);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 8px;
`;

const WinnerInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const WinnerAvatar = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--success-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
`;

const WinnerDetails = styled.div`
    flex: 1;
`;

const WinnerName = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
`;

const WinnerPosition = styled.div`
    font-size: 12px;
    color: var(--text-secondary);
`;

const ParticipantsInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
`;

const ParticipantsCount = styled.div`
    font-size: 13px;
    color: var(--text-secondary);
`;

const ProgressBar = styled.div`
    flex: 1;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number }>`
    height: 100%;
    background: var(--primary-color);
    width: ${props => Math.min(props.$progress, 100)}%;
    transition: width 0.3s ease;
`;

interface CompetitionCardProps {
    competition: Competition;
    onClick: () => void;
}

const CompetitionCard: React.FC<CompetitionCardProps> = ({ competition, onClick }) => {
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return 'Черновик';
            case 'announcement': return 'Анонс';
            case 'active': return 'Идет';
            case 'completed': return 'Завершен';
            case 'cancelled': return 'Отменен';
            default: return status;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'announcement': return '📢';
            case 'active': return '🔥';
            case 'completed': return '🏆';
            default: return '📋';
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'dd MMM yyyy', { locale: ru });
        } catch {
            return dateString;
        }
    };

    const getProgressPercentage = () => {
        if (!competition.max_participants) return 0;
        return (competition.current_participants / competition.max_participants) * 100;
    };

    const getWinnerInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <Card onClick={onClick}>
            <StatusBadge $status={competition.status}>
                {getStatusIcon(competition.status)} {getStatusLabel(competition.status)}
            </StatusBadge>
            
            <Title>{competition.title}</Title>
            {competition.status === 'completed' && competition.winners && competition.winners.length > 0 && competition.victory_description ? (
                <Description dangerouslySetInnerHTML={{ __html: competition.victory_description.replace(/\n/g, '<br>') }} />
            ) : (
                <Description dangerouslySetInnerHTML={{ __html: (competition.description || '').replace(/\n/g, '<br>') }} />
            )}
            
            <InfoRow>
                <InfoLabel>Начало:</InfoLabel>
                <InfoValue>{formatDate(competition.start_date)}</InfoValue>
            </InfoRow>
            
            <InfoRow>
                <InfoLabel>Окончание:</InfoLabel>
                <InfoValue>{formatDate(competition.end_date)}</InfoValue>
            </InfoRow>
            
            {competition.status === 'completed' && competition.winners && competition.winners.length > 0 ? (
                <Prize style={{ background: 'var(--success-transparent)', borderColor: 'var(--success-color)' }}>
                    <PrizeLabel style={{ color: 'var(--success-color)' }}>🏆 Победитель получил</PrizeLabel>
                    <PrizeAmount style={{ color: 'var(--success-color)' }}>{competition.winners[0].prize || competition.prize}</PrizeAmount>
                </Prize>
            ) : (
                <Prize>
                    <PrizeLabel>Приз</PrizeLabel>
                    <PrizeAmount>{competition.prize}</PrizeAmount>
                </Prize>
            )}
            
            {competition.status === 'completed' && competition.winners && competition.winners.length > 0 && (
                <WinnerSection style={{ 
                    background: 'var(--success-transparent)', 
                    borderColor: 'var(--success-color)',
                    marginTop: '12px'
                }}>
                    <WinnerTitle style={{ color: 'var(--success-color)' }}>👑 Наш победитель</WinnerTitle>
                    <WinnerInfo>
                        <WinnerAvatar style={{ background: 'var(--success-color)' }}>
                            {competition.winners[0].winner_data?.photo_url ? (
                                <img 
                                    src={`http://localhost:8000/api/v1/users/${competition.winners[0].user_id}/photo`}
                                    alt={competition.winners[0].user_name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const nextSibling = e.currentTarget.nextSibling as HTMLElement;
                                        if (nextSibling) {
                                            nextSibling.style.display = 'flex';
                                        }
                                    }}
                                />
                            ) : null}
                            <div style={{ 
                                display: competition.winners[0].winner_data?.photo_url ? 'none' : 'flex',
                                alignItems: 'center', 
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: 'white'
                            }}>
                                {getWinnerInitials(competition.winners[0].user_name)}
                            </div>
                        </WinnerAvatar>
                        <WinnerDetails>
                            <WinnerName style={{ color: 'var(--success-color)' }}>{competition.winners[0].user_name}</WinnerName>
                            <WinnerPosition style={{ color: 'var(--text-secondary)' }}>{competition.winners[0].user_position}</WinnerPosition>
                        </WinnerDetails>
                    </WinnerInfo>
                </WinnerSection>
            )}
            
            {competition.status === 'active' && (
                <ParticipantsInfo>
                    <ParticipantsCount>
                        {competition.current_participants}/{competition.max_participants || '∞'} участников
                    </ParticipantsCount>
                    <ProgressBar>
                        <ProgressFill $progress={getProgressPercentage()} />
                    </ProgressBar>
                </ParticipantsInfo>
            )}
        </Card>
    );
};

export default CompetitionCard; 