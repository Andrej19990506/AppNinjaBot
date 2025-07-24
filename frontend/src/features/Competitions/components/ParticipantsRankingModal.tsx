import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface Participant {
    id: number;
    user_id: number;
    user_name: string;
    user_position: string;
    user_department: string;
    ranking_position: number | null;
    result_score: number | null;
    result_time: number | null;
    registered_at: string;
    status: string;
    video_url?: string; // Added video_url to the interface
}

interface ParticipantsRankingModalProps {
    isOpen: boolean;
    onClose: () => void;
    competitionId: number;
    competitionTitle: string;
    createdBy: number;
    currentUserId: number;
}

const ModalOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card-background);
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    z-index: 1000;
`;

const ModalContent = styled(motion.div)`
    background: var(--card-background);
    border-radius: 0;
    box-shadow: none;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
`;

const ModalHeader = styled.div`
    background: linear-gradient(135deg, var(--primary-color) 0%, #ff6b35 100%);
    color: white;
    padding: 20px 24px;
    padding-top: calc(80px + 20px);
    position: relative;
    flex-shrink: 0;
`;

const CloseButton = styled.button`
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }
`;

const HeaderStats = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-bottom: 16px;
`;

const StatItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.15);
    padding: 8px 16px;
    border-radius: 24px;
    font-size: 0.9rem;
    font-weight: 600;
    backdrop-filter: blur(10px);
`;

const StatIcon = styled.div`
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const TitleSection = styled.div`
    text-align: center;
    position: relative;
`;

const ModalTitle = styled.h2`
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`;

const ModalSubtitle = styled.p`
    margin: 0;
    opacity: 0.9;
    font-size: 0.95rem;
    margin-top: 6px;
`;

const CloseButtonContainer = styled.div`
    position: absolute;
    top: 0;
    right: 0;
`;

const ModalFooter = styled.div`
    background: var(--card-background);
    border-top: 1px solid var(--border-color);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const BackButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    padding: 12px 24px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: var(--primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
`;

const ModalBody = styled.div`
    padding: 20px;
    flex: 1;
    overflow-y: auto;
`;



const ParticipantsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const ParticipantCard = styled(motion.div)`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    transition: all 0.2s ease;
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        border-color: var(--primary-color);
    }
    position: relative;
`;

const PositionBadge = styled.div<{ position: number }>`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.1rem;
    color: white;
    background: ${props => {
        if (props.position === 1) return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
        if (props.position === 2) return 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)';
        if (props.position === 3) return 'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)';
        return 'var(--primary-color)';
    }};
    flex-shrink: 0;
`;

const Avatar = styled.div`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--primary-color);
    background: var(--background-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const ParticipantInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const ParticipantName = styled.div`
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ParticipantPosition = styled.div`
    font-size: 0.9rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ParticipantScore = styled.div`
    text-align: right;
    flex-shrink: 0;
`;

const ScoreValue = styled.div`
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 2px;
`;

const ScoreLabel = styled.div`
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
`;

const EmptyIcon = styled.div`
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
`;

const LoadingState = styled.div`
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
`;

// Добавляем модалку для видео
const VideoModal: React.FC<{ open: boolean, onClose: () => void, videoUrl: string }> = ({ open, onClose, videoUrl }) => {
    if (!open) return null;
    const isGoogleDrive = videoUrl.includes('drive.google.com') && videoUrl.includes('/file/d/');
    const embedUrl = isGoogleDrive
        ? videoUrl.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview')
        : videoUrl;
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: 700, height: '60vw', maxHeight: 420, background: 'black', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: 20, width: 36, height: 36, fontSize: 22, cursor: 'pointer', zIndex: 2 }}>×</button>
                {isGoogleDrive ? (
                    <iframe
                        src={embedUrl}
                        width="100%"
                        height="100%"
                        allow="autoplay"
                        frameBorder="0"
                        allowFullScreen
                        title="Видео участника"
                        style={{ borderRadius: 8, width: '100%', height: '100%' }}
                    ></iframe>
                ) : (
                    <video src={embedUrl} controls style={{ width: '100%', height: '100%', borderRadius: 8, background: 'black' }} />
                )}
            </div>
        </div>
    );
};

// SVG иконка Play
const PlayIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="var(--primary-color)"/>
        <polygon points="13,10 24,16 13,22" fill="white" />
    </svg>
);

const ParticipantsRankingModal: React.FC<ParticipantsRankingModalProps> = ({
    isOpen,
    onClose,
    competitionId,
    competitionTitle,
    createdBy,
    currentUserId
}) => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isCreator = currentUserId === createdBy;
    const [editResultId, setEditResultId] = useState<number | null>(null);
    const [editResultValue, setEditResultValue] = useState<string>('');
    const [editResultVideoUrl, setEditResultVideoUrl] = useState<string>('');
    const [savingResult, setSavingResult] = useState(false);
    const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchParticipants();
        }
    }, [isOpen, competitionId]);

    const fetchParticipants = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`http://localhost:8000/api/v1/competitions/${competitionId}/participants`);
            console.log('Participants response:', response.data);
            console.log('Response type:', typeof response.data);
            console.log('Is array:', Array.isArray(response.data));
            
            // Проверяем структуру ответа
            let participantsData = response.data;
            if (response.data && typeof response.data === 'object' && 'participants' in response.data) {
                participantsData = response.data.participants;
            } else if (Array.isArray(response.data)) {
                participantsData = response.data;
            } else {
                participantsData = [];
            }
            
            console.log('Processed participants data:', participantsData);
            setParticipants(participantsData);
        } catch (err) {
            console.error('Error fetching participants:', err);
            setError('Не удалось загрузить рейтинг участников');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    const formatScore = (score: number | null | undefined) => {
        if (score === null || score === undefined) return '—';
        return score.toString();
    };

    const formatTime = (time: number | null | undefined) => {
        if (time === null || time === undefined) return '—';
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const sortedParticipants = [...(Array.isArray(participants) ? participants : [])].sort((a, b) => {
        // Сначала по позиции в рейтинге
        if (a.ranking_position && b.ranking_position) {
            return a.ranking_position - b.ranking_position;
        }
        if (a.ranking_position) return -1;
        if (b.ranking_position) return 1;
        
        // Затем по результату
        if (a.result_score !== null && a.result_score !== undefined && 
            b.result_score !== null && b.result_score !== undefined) {
            return b.result_score - a.result_score; // Больше = лучше
        }
        if (a.result_score !== null && a.result_score !== undefined) return -1;
        if (b.result_score !== null && b.result_score !== undefined) return 1;
        
        // По времени регистрации
        return new Date(a.registered_at || 0).getTime() - new Date(b.registered_at || 0).getTime();
    });

    const handleOpenEditResult = (participant: Participant) => {
        setEditResultId(participant.id);
        setEditResultValue(participant.result_score?.toString() || '');
        setEditResultVideoUrl(participant.video_url || '');
    };
    const handleCloseEditResult = () => {
        setEditResultId(null);
        setEditResultValue('');
        setEditResultVideoUrl('');
    };
    const handleSaveResult = async () => {
        if (!editResultId) return;
        setSavingResult(true);
        try {
            await axios.patch(`http://localhost:8000/api/v1/competitions/${competitionId}/participants/${editResultId}/result`, {
                result_score: Number(editResultValue),
                user_id: currentUserId,
                video_url: editResultVideoUrl
            });
            await fetchParticipants();
            setEditResultId(null);
            setEditResultValue('');
            setEditResultVideoUrl('');
        } catch (err) {
            alert('Ошибка при сохранении результата');
        } finally {
            setSavingResult(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalOverlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <ModalContent
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ModalHeader>
                            <HeaderStats>
                                <StatItem>
                                    <StatIcon>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                    </StatIcon>
                                    {Array.isArray(participants) ? participants.length : 0}
                                </StatItem>
                                <StatItem>
                                    <StatIcon>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20,6 9,17 4,12"></polyline>
                                        </svg>
                                    </StatIcon>
                                    {Array.isArray(participants) ? participants.filter(p => p.result_score !== null && p.result_score !== undefined).length : 0}
                                </StatItem>
                            </HeaderStats>
                            <TitleSection>
                                <ModalTitle>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                                        <path d="M6 2v3"></path>
                                        <path d="M10 2h4a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
                                        <path d="M14 9h1.5a2.5 2.5 0 0 1 0 5H14"></path>
                                        <path d="M14 16v3"></path>
                                    </svg>
                                    Рейтинг участников
                                </ModalTitle>
                                <ModalSubtitle>{competitionTitle}</ModalSubtitle>
                            </TitleSection>
                        </ModalHeader>

                        <ModalBody>
                            {loading ? (
                                <LoadingState>
                                    <div>Загрузка рейтинга...</div>
                                </LoadingState>
                            ) : error ? (
                                <EmptyState>
                                    <EmptyIcon>⚠️</EmptyIcon>
                                    <div>{error}</div>
                                </EmptyState>
                            ) : (Array.isArray(participants) && participants.length === 0) ? (
                                <EmptyState>
                                    <EmptyIcon>👥</EmptyIcon>
                                    <div>Пока нет участников</div>
                                    <div style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                                        Будьте первым!
                                    </div>
                                </EmptyState>
                            ) : (
                                <ParticipantsList>
                                        {sortedParticipants.map((participant, index) => (
                                            <ParticipantCard
                                                key={participant.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                            >
                                                <PositionBadge position={participant.ranking_position || index + 1}>
                                                    {participant.ranking_position || index + 1}
                                                </PositionBadge>

                                                <Avatar>
                                                    <img
                                                        src={`http://localhost:8000/api/v1/users/${participant.user_id}/photo`}
                                                        alt={participant.user_name || 'Участник'}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const next = e.currentTarget.nextElementSibling as HTMLElement;
                                                            if (next) next.style.display = 'flex';
                                                        }}
                                                    />
                                                    <span style={{
                                                        display: 'none',
                                                        fontSize: '18px',
                                                        fontWeight: 'bold',
                                                        color: 'var(--primary-color)'
                                                    }}>
                                                        {getInitials(participant.user_name)}
                                                    </span>
                                                </Avatar>

                                                <ParticipantInfo>
                                                    <ParticipantName>
                                                        {participant.user_name || `Участник #${participant.user_id}`}
                                                    </ParticipantName>
                                                    <ParticipantPosition>
                                                        {participant.user_department || 'Участник'}
                                                    </ParticipantPosition>
                                                </ParticipantInfo>

                                                {participant.video_url && (
                                                    <button
                                                        onClick={() => setVideoModalUrl(participant.video_url || null)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: -10,
                                                            right: 24,
                                                            background: 'var(--primary-color)',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: 26,
                                                            height: 26,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                                                            cursor: 'pointer',
                                                            transition: 'box-shadow 0.2s',
                                                            outline: 'none',
                                                            zIndex: 2,
                                                        }}
                                                        aria-label="Смотреть видео"
                                                    >
                                                        <PlayIcon />
                                                    </button>
                                                )}
                                                <ParticipantScore style={{ marginTop: 10, marginBottom: 0 }}>
                                                    {participant.result_score !== null && participant.result_score !== undefined ? (
                                                        <>
                                                            <ScoreValue>{formatScore(participant.result_score)}</ScoreValue>
                                                            <ScoreLabel>коробок</ScoreLabel>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ScoreValue>—</ScoreValue>
                                                            <ScoreLabel>ожидает</ScoreLabel>
                                                        </>
                                                    )}
                                                </ParticipantScore>
                                                {isCreator && (
                                                    <div style={{ width: '100%', marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <button style={{
                                                            background: 'var(--primary-color)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            padding: '10px 0',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            fontSize: '1rem',
                                                            width: '100%',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                                                        }} onClick={() => handleOpenEditResult(participant)}>
                                                            Обновить результат
                                                        </button>
                                                        {editResultId === participant.id && (
                                                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', width: '100%' }}>
                                                                <input
                                                                    type="number"
                                                                    value={editResultValue}
                                                                    onChange={e => setEditResultValue(e.target.value)}
                                                                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', width: 80, marginBottom: 6 }}
                                                                    min={0}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ссылка на видео (https://...)"
                                                                    value={editResultVideoUrl || ''}
                                                                    onChange={e => setEditResultVideoUrl(e.target.value)}
                                                                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', width: '100%' }}
                                                                />
                                                                <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
                                                                    <button
                                                                        onClick={handleSaveResult}
                                                                        style={{ background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 6, padding: '7px 18px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
                                                                        disabled={savingResult}
                                                                    >
                                                                        {savingResult ? 'Сохраняю...' : 'Сохранить'}
                                                                    </button>
                                                                    <button
                                                                        onClick={handleCloseEditResult}
                                                                        style={{ background: 'var(--border-color)', color: 'var(--text-primary)', border: 'none', borderRadius: 6, padding: '7px 18px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
                                                                        disabled={savingResult}
                                                                    >
                                                                        Отмена
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </ParticipantCard>
                                        ))}
                                    </ParticipantsList>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <BackButton onClick={onClose}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15,18 9,12 15,6"></polyline>
                                </svg>
                                Назад к конкурсу
                            </BackButton>
                        </ModalFooter>
                    </ModalContent>
                </ModalOverlay>
            )}
            {/* Модалка для видео */}
            <VideoModal open={!!videoModalUrl} onClose={() => setVideoModalUrl(null)} videoUrl={videoModalUrl || ''} />
        </AnimatePresence>
    );
};

export default ParticipantsRankingModal; 