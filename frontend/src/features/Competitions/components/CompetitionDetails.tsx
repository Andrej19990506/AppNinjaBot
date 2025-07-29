import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { Competition } from '../types/competition';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { useDispatch, useSelector } from 'react-redux';
import { updateCompetition, addWinner, fetchCompetitionById, fetchCompetitions, addParticipant, publishCompetition } from '@/store/slices/competitionsSlice';
import { AppDispatch, RootState } from '@/store';
import store from '@/shared/store/store';
import { addNotification } from '@/shared/store/notificationSlice/notificationSlice';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
import WinnerSelectionModal from './WinnerSelectionModal';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VictoryDescriptionModal from './VictoryDescriptionModal';
import ParticipantsRankingModal from './ParticipantsRankingModal';
import { axiosInstance } from '@/shared/api/api';
import VideoRecorderModal from './VideoRecorderModal';

const DetailsContainer = styled.div`
    height: 100dvh;
    min-height: 100dvh;
    overflow-y: auto;
    background: var(--card-background);
    display: flex;
    flex-direction: column;
`;

const PrettyHeader = styled.div`
    height: 100dvh;
    min-height: 100dvh;
    width: 100%;
    max-width: 100vw;
    background: var(--gradient-primary);
    color: white;
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
    position: relative;
    text-align: center;
    overflow: hidden;
    margin: 0 auto;
    box-shadow: var(--shadow-lg);
    padding-top: 80px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
`;


const PrettyMainTitle = styled.h1`
    font-size: clamp(1.2rem, 6vw, 2.2rem);
    margin-bottom: clamp(10px, 2vw, 18px);
    font-weight: 700;
    color: white;
    line-height: 1.2;
    word-break: break-word;
`;

const PrettySubtitle = styled.div`
    font-size: 1.1rem;
    opacity: 0.92;
    color: white;
    margin-bottom: 0;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
    padding-top: calc(80px + 20px);
    border-bottom: 1px solid var(--border-color);
    background: var(--card-background);
    position: sticky;
    top: 0;
    z-index: 1;
`;

const BackButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    color: var(--text-color);
    cursor: pointer;
    transition: all var(--transition-normal);
    
    &:hover {
        border-color: var(--primary-color);
        transform: scale(1.05);
    }
`;

const Title = styled.h2`
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
    flex: 1;
`;

const Content = styled.div`
    padding: 24px;
    flex: 1;
    background: var(--card-background);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    box-shadow: var(--shadow-lg);
`;

const StatusBadge = styled.div<{ $status: string }>`
    font-size: clamp(1rem, 3vw, 1.1rem);
    padding: clamp(7px, 2vw, 12px) clamp(16px, 5vw, 22px);
    border-radius: 24px;
    margin: 0 0 clamp(10px, 2vw, 16px) 0;
    display: inline-flex;
    align-items: center;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    ${props => {
        switch (props.$status) {
            case 'announcement':
                return `background: var(--warning-transparent); color: var(--warning-color); border: 1px solid var(--warning-color);`;
            case 'active':
                return `background: var(--success-transparent); color: var(--success-color); border: 1px solid var(--success-color);`;
            case 'completed':
                return `background: var(--info-transparent); color: var(--info-color); border: 1px solid var(--info-color);`;
            default:
                return '';
        }
    }}
`;

const Section = styled.div`
    margin-bottom: 24px;
    
    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionTitle = styled.h3`
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
`;

const SectionTitleText = styled.span`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const EditButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--primary-transparent);
    border: 1px solid var(--primary-color);
    border-radius: var(--radius-sm);
    color: var(--primary-color);
    cursor: pointer;
    transition: all var(--transition-fast);
    
    &:hover {
        background: var(--primary-color);
        color: var(--text-color-on-primary);
    }
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 8px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
    padding: 10px 20px;
    border-radius: var(--radius);
    border: 1px solid ${props => props.variant === 'primary' ? 'var(--primary-color)' : 'var(--border-color)'};
    background: ${props => props.variant === 'primary' ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.variant === 'primary' ? 'var(--text-color-on-primary)' : 'var(--text-color)'};
    cursor: pointer;
    font-weight: 500;
    transition: all var(--transition-fast);
    
    &:hover {
        background: ${props => props.variant === 'primary' ? 'var(--primary-hover)' : 'var(--background-light)'};
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const Description = styled.div`
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
    
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

const InfoGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    
    @media (max-width: 480px) {
        grid-template-columns: 1fr;
    }
`;

const InfoItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const InfoLabel = styled.span`
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
`;

const InfoValue = styled.span`
    font-size: 14px;
    color: var(--text-color);
    font-weight: 500;
`;

const PrizeSection = styled.div`
    background: var(--primary-transparent);
    border: 1px solid var(--primary-color);
    border-radius: var(--radius);
    padding: 16px;
    text-align: center;
    margin-bottom: 16px;
`;

const PrizeLabel = styled.div`
    font-size: 12px;
    color: var(--primary-color);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 4px;
`;

const PrizeAmount = styled.div`
    font-size: 20px;
    color: var(--primary-color);
    font-weight: 700;
`;

const RulesList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
`;

const RuleItem = styled.li`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 0;
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
    
    &:before {
        content: '•';
        color: var(--primary-color);
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 2px;
    }
`;

const WinnerSection = styled.div`
    background: var(--card-background);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 32px 0 rgb(0 0 0 / 18%), 0 2px 8px rgb(0 0 0 / 10%);
    padding: clamp(18px, 4vw, 32px) clamp(16px, 6vw, 32px);
    margin: 0 0 clamp(18px, 3vw, 28px) 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 220px;
    max-width: 100%;
    transition: box-shadow 0.2s;
`;

const WinnerInfo = styled.div`
    display: flex;
    align-items: center;
    gap: clamp(16px, 4vw, 32px);
`;

const WinnerAvatar = styled.div`
    width: clamp(64px, 18vw, 96px);
    height: clamp(64px, 18vw, 96px);
    border-radius: 50%;
    background: var(--card-background);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-color);
    font-weight: 700;
    font-size: clamp(1.5rem, 5vw, 2.2rem);
    box-shadow: var(--shadow-md);
    overflow: hidden;
    margin-right: clamp(12px, 2vw, 20px);
    border: 2px solid var(--primary-color);
`;

const WinnerDetails = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
`;

const WinnerName = styled.div`
    font-size: clamp(1.1rem, 4vw, 1.4rem);
    font-weight: 800;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
`;

const WinnerPosition = styled.div`
    font-size: clamp(0.95rem, 2.5vw, 1.08rem);
    color: var(--text-secondary);
    margin-bottom: 4px;
`;

const WinnerPrize = styled.div`
    font-size: clamp(1.05rem, 3vw, 1.18rem);
    color: var(--primary-color);
    font-weight: 700;
    margin-top: 8px;
    background: var(--primary-transparent);
    border-radius: var(--radius);
    padding: 4px 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
`;

const ParticipantsSection = styled.div`
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 16px;
`;

const ParticipantsHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
`;

const ParticipantsCount = styled.div`
    font-size: 14px;
    color: var(--text-color);
    font-weight: 500;
`;

const ProgressBar = styled.div`
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ $progress: number }>`
    height: 100%;
    background: var(--primary-color);
    width: ${props => Math.min(props.$progress, 100)}%;
    transition: width 0.3s ease;
`;

const ProgressText = styled.div`
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
`;

const WinnerBlock = styled.div`
    margin: 0 0 clamp(12px, 2vw, 18px) 0;
    padding: clamp(8px, 2vw, 14px) clamp(12px, 4vw, 18px);
    background: rgba(0,0,0,0.10);
    border-radius: var(--radius);
    color: #fffbe7;
    font-size: clamp(0.95rem, 2.5vw, 1.1rem);
    font-weight: 500;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
`;

const HeaderContent = styled.div`
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 0 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
`;

const StatusDates = styled.div`
    width: 100%;
    position: absolute;
    left: 0;
    bottom: 64px; // было 24px, теперь выше кнопки скролла
    text-align: center;
    font-size: 1rem;
`;

const ScrollDownBtn = styled.button`
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.15);
    border: none;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    cursor: pointer;
    z-index: 2;
    transition: background 0.2s;
    &:hover { background: rgba(255,255,255,0.25); }
`;

interface CompetitionDetailsProps {
    competition: Competition;
    onClose: () => void;
}

const CompetitionDetails: React.FC<CompetitionDetailsProps> = ({ competition, onClose }) => {
    const dispatch = useDispatch<AppDispatch>();
    
    // Получаем обновленные данные о конкурсе из Redux store
    const updatedCompetition = useSelector((state: RootState) => 
        state.competitions.selectedCompetition
    );
    
    // Используем обновленные данные, если они есть, иначе используем переданные
    const currentCompetition = updatedCompetition || competition;
    
    const [isEditing, setIsEditing] = useState(false);
    const [editedDescription, setEditedDescription] = useState(currentCompetition.full_description);
    const [isEditingVictory, setIsEditingVictory] = useState(false);
    const [editedVictoryDescription, setEditedVictoryDescription] = useState(currentCompetition.victory_description);
    const [isSaving, setIsSaving] = useState(false);
    const [showWinnerModal, setShowWinnerModal] = useState(false);
    const [showVictoryModal, setShowVictoryModal] = useState(false);
    const [victoryModalInitial, setVictoryModalInitial] = useState('');
    const [showRankingModal, setShowRankingModal] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [showVideoRecorder, setShowVideoRecorder] = useState(false);

    // Загружаем детальную информацию о конкурсе при открытии
    useEffect(() => {
        dispatch(fetchCompetitionById(currentCompetition.id));
    }, [dispatch, currentCompetition.id]);

    useEffect(() => {
        const setVh = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        setVh();
        window.addEventListener('resize', setVh);
        return () => window.removeEventListener('resize', setVh);
    }, []);

    useEffect(() => {
        axiosInstance.get(`/v1/competitions/${currentCompetition.id}/participants`)
            .then((res: any) => {
                console.log('Participants response:', res.data);
                setParticipants(res.data.participants || []);
            })
            .catch((error: any) => {
                console.error('Error fetching participants:', error);
                setParticipants([]);
            });
    }, [currentCompetition.id, currentCompetition.current_participants]);
    
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
            return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: ru });
        } catch {
            return dateString;
        }
    };

    const getProgressPercentage = () => {
        if (!currentCompetition.max_participants) return 0;
        return (currentCompetition.current_participants / currentCompetition.max_participants) * 100;
    };

    const getWinnerInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await dispatch(updateCompetition({
                id: currentCompetition.id,
                data: {
                    full_description: editedDescription
                }
            })).unwrap();
            
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Описание конкурса успешно обновлено!'
            }));
            
            setIsEditing(false);
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Не удалось сохранить описание. Попробуйте еще раз.'
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditedDescription(currentCompetition.full_description);
        setIsEditing(false);
    };

    const handleEditVictory = () => {
        setIsEditingVictory(true);
    };

    const handleSaveVictory = async () => {
        try {
            setIsSaving(true);
            await dispatch(updateCompetition({
                id: currentCompetition.id,
                data: {
                    victory_description: editedVictoryDescription
                }
            })).unwrap();

            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Описание победы успешно обновлено!'
            }));

            setIsEditingVictory(false);
        } catch (error) {
            console.error('Ошибка при сохранении описания победы:', error);

            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Не удалось сохранить описание победы. Попробуйте еще раз.'
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelVictory = () => {
        setEditedVictoryDescription(currentCompetition.victory_description);
        setIsEditingVictory(false);
    };

    const handleWinnerSelected = async (winner: any) => {
        try {
            const winnerData = {
                user_id: winner.type === 'member' ? winner.data.user_id : null,
                group_id: winner.type === 'group' ? winner.data.id : null,
                place: 1,
                prize: currentCompetition.prize,
                user_name: winner.type === 'member' ? winner.data.user_name : winner.data.title,
                user_position: winner.type === 'member' ? winner.data.user_position : 'Филиал',
                user_department: winner.type === 'member' ? winner.data.user_department : winner.data.branch_name || 'Филиал',
                winner_data: winner.data,
                long_term_status: false,
                status_expires_at: null
            };

            await dispatch(addWinner({
                competitionId: currentCompetition.id,
                winnerData
            })).unwrap();
            dispatch(fetchCompetitions());
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Победитель успешно выбран! Теперь введите описание победы.'
            }));

            // Открываем VictoryDescriptionModal с шаблоном
            setVictoryModalInitial(
              `<div style=\"margin-bottom: 16px; padding: 16px; background: var(--success-transparent); border-radius: var(--radius); border-left: 4px solid var(--success-color);\">\n` +
              `  <div style=\"font-size: 18px; font-weight: 600; color: var(--success-color); margin-bottom: 12px;\">🏆 Поздравляем победителя конкурса от NinjaBot! 🎉</div>\n` +
              `  <div style=\"margin-bottom: 12px; line-height: 1.6;\">Друзья, наш конкурс завершён, и у нас есть победитель! 🎈<br><strong style=\"color: var(--success-color);\">${winnerData.user_name}</strong> из ${winnerData.user_department} стал первым, кто нашёл опечатку! 🕵️‍♂️📋</div>\n` +
              `  <div style=\"color: var(--text-secondary); font-size: 14px; line-height: 1.5;\">${winnerData.user_name}, ты настоящий детектив! 🔎 ${winnerData.prize} уже летит к тебе! 💰🚀</div>\n` +
              `</div>`
            );
            setShowVictoryModal(true);
        } catch (error) {
            console.error('Ошибка при выборе победителя:', error);
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Не удалось выбрать победителя. Попробуйте еще раз.'
            }));
        }
    };

    const handleVictorySave = async (desc: string) => {
        try {
            await dispatch(updateCompetition({
                id: currentCompetition.id,
                data: { victory_description: desc }
            })).unwrap();
            setShowVictoryModal(false);
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Описание победы успешно сохранено!'
            }));
            // Сначала обновляем выбранный конкурс (winners подтянутся)
            await dispatch(fetchCompetitionById(currentCompetition.id));
            // Затем обновляем список конкурсов
            dispatch(fetchCompetitions());
        } catch (error) {
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Не удалось сохранить описание победы.'
            }));
        }
    };

    const isBoxRace = currentCompetition.competition_data?.type === 'pizza_box_race';
    const user = useSelector((state: RootState) => state.user.user);
    const isUserInitialized = useSelector((state: RootState) => state.user.isInitialized);
    const userId = user?.id;
    const userIsRegistered = participants.some((p) => p.user_id === userId);
    const userProfile = participants.find((p) => p.user_id === userId);
    
    // Отладочная информация
    console.log('CompetitionDetails - User state:', { 
        user, 
        userId, 
        isUserInitialized, 
        participants,
        userIsRegistered,
        currentCompetition: {
            id: currentCompetition.id,
            status: currentCompetition.status,
            current_participants: currentCompetition.current_participants
        }
    });

    const handleRegister = async () => {
        if (!userId) {
            console.error('CompetitionDetails - No userId found:', { user, userId });
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Ошибка: пользователь не найден. Попробуйте обновить страницу.'
            }));
            return;
        }
        
        try {
            console.log('CompetitionDetails - Registering with:', { competitionId: currentCompetition.id, userId });
            await dispatch(addParticipant({ competitionId: currentCompetition.id, userId })).unwrap();
            
            // Обновляем данные конкурса (это должно обновить current_participants и перезагрузить участников)
            await dispatch(fetchCompetitionById(currentCompetition.id)).unwrap();
            
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Вы успешно зарегистрированы в конкурсе!'
            }));
        } catch (error) {
            console.error('CompetitionDetails - Registration error:', error);
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Ошибка регистрации. Попробуйте ещё раз.'
            }));
        }
    };

    const handlePublishCompetition = async () => {
        try {
            const state = store.getState();
            const userId = state.user?.user?.id;
            
            if (!userId) {
                throw new Error('User not authenticated');
            }
            
            await axiosInstance.post(`/v1/competitions/${currentCompetition.id}/publish`, {}, {
                headers: {
                    'X-User-ID': userId.toString()
                }
            });
            dispatch(fetchCompetitionById(currentCompetition.id));
            dispatch(addNotification({
                type: NotificationTypes.SUCCESS,
                message: 'Конкурс успешно опубликован!'
            }));
        } catch (error) {
            console.error('CompetitionDetails - Publish error:', error);
            dispatch(addNotification({
                type: NotificationTypes.ERROR,
                message: 'Ошибка публикации конкурса. Попробуйте ещё раз.'
            }));
        }
    };

    const contentRef = React.useRef<HTMLDivElement>(null);

    const handleScrollToContent = () => {
        if (contentRef.current) {
            contentRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleOpenRanking = () => {
        setShowRankingModal(true);
    };

    return (
        <>
            <DetailsContainer>
                <PrettyHeader>
                    <BackButton onClick={onClose} aria-label="Назад к списку конкурсов" style={{ position: 'absolute', left: 24, top: 24, background: 'rgba(255,255,255,0.10)', color: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
                        <ArrowBackIcon />
                    </BackButton>
                    <HeaderContent>
                        <PrettyMainTitle>{currentCompetition.title}</PrettyMainTitle>
                        <StatusBadge $status={currentCompetition.status}>
                            {getStatusIcon(currentCompetition.status)} {getStatusLabel(currentCompetition.status)}
                        </StatusBadge>
                        {isBoxRace ? (
                            !isUserInitialized ? (
                                <div style={{ margin: '18px 0', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                                    Загрузка пользователя...
                                </div>
                            ) : currentCompetition.status === 'draft' ? (
                                <Button
                                    variant="primary"
                                    onClick={handlePublishCompetition}
                                    style={{ margin: '18px 0', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                >
                                    Опубликовать конкурс
                                </Button>
                            ) : !userIsRegistered ? (
                                <Button
                                    variant="primary"
                                    onClick={handleRegister}
                                    style={{ margin: '18px 0', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                >
                                    Зарегистрироваться в конкурсе
                                </Button>
                            ) : (
                                <div style={{
                                    margin: '18px 0',
                                    padding: '28px 20px 22px 20px',
                                    background: 'var(--card-background)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '2px solid var(--primary-color)',
                                    boxShadow: '0 4px 24px 0 rgba(0,0,0,0.12)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    minWidth: 0,
                                    maxWidth: 380,
                                    width: '100%',
                                    gap: 0
                                }}>
                                    {/* Верхняя строка: статус */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, width: '100%', justifyContent: 'center' }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="11" stroke="var(--success-color)" strokeWidth="2.5" fill="#fff"/><polyline points="7 13 11 17 17 9" /></svg>
                                        <span style={{ color: 'var(--success-color)', fontWeight: 700, fontSize: '1.15rem', letterSpacing: 0.2 }}>
                                            Вы зарегистрированы!
                                        </span>
                                    </div>
                                    {/* Аватар */}
                                    <div style={{
                                        width: 70,
                                        height: 70,
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '2.5px solid var(--primary-color)',
                                        background: 'var(--background-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 18
                                    }}>
                                        <img
                                            src={`${window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL}/v1/users/${userId}/photo`}
                                            alt={user?.first_name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                                            onError={e => {
                                                e.currentTarget.style.display = 'none';
                                                const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                                if (next) next.style.display = 'flex';
                                            }}
                                        />
                                        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary-color)', display: 'none', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                            {user?.first_name?.[0] || ''}{user?.last_name?.[0] || ''}
                                        </span>
                                    </div>
                                    {/* Имя */}
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.13rem', marginBottom: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user?.first_name} {user?.last_name}
                                    </div>
                                    {/* Группа */}
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.99rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, textAlign: 'center' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 2}}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/></svg>
                                        {userProfile?.user_department || 'Группа не указана'}
                                    </div>
                                    {/* Позиция в рейтинге */}
                                    {userProfile?.ranking_position && (
                                        <div style={{
                                            background: 'var(--primary-color)',
                                            color: 'white',
                                            padding: '7px 18px',
                                            borderRadius: 16,
                                            fontWeight: 700,
                                            fontSize: '1.01rem',
                                            display: 'inline-block',
                                            margin: '14px 0 0 0',
                                            letterSpacing: 0.2
                                        }}>
                                            #{userProfile.ranking_position} место
                                        </div>
                                    )}
                                    {/* Кнопка рейтинга */}
                                    <Button
                                        variant="secondary"
                                        onClick={handleOpenRanking}
                                        style={{
                                            width: '100%',
                                            fontSize: '1rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8,
                                            marginTop: 22,
                                            background: 'var(--background-color)',
                                            border: '1.5px solid var(--primary-color)',
                                            color: 'var(--primary-color)',
                                            boxShadow: 'none',
                                            fontWeight: 600
                                        }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="10" width="4" height="11" rx="1.5"/><rect x="10" y="3" width="4" height="18" rx="1.5"/><rect x="17" y="7" width="4" height="14" rx="1.5"/></svg>
                                        Посмотреть рейтинг участников
                                    </Button>
                                </div>
                            )
                        ) : (
                            currentCompetition.winners && currentCompetition.winners.length > 0 ? (
                                <WinnerSection>
                                    <WinnerInfo>
                                        <WinnerAvatar>
                                            {currentCompetition.winners[0].winner_data?.photo_url ? (
                                                <img 
                                                    src={`${window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL}/v1/users/${currentCompetition.winners[0].user_id}/photo`}
                                                    alt={currentCompetition.winners[0].user_name}
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
                                                display: currentCompetition.winners[0].winner_data?.photo_url ? 'none' : 'flex',
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                width: '100%',
                                                height: '100%',
                                                fontSize: '18px',
                                                fontWeight: 'bold',
                                                color: 'var(--text-primary)'
                                            }}>
                                                {getWinnerInitials(currentCompetition.winners[0].user_name)}
                                            </div>
                                        </WinnerAvatar>
                                        <WinnerDetails>
                                            <WinnerName><span role="img" aria-label="Кубок">🏆</span> {currentCompetition.winners[0].user_name}</WinnerName>
                                            <WinnerPosition>{currentCompetition.winners[0].user_position}</WinnerPosition>
                                            {currentCompetition.winners[0].prize && (
                                                <WinnerPrize><span role="img" aria-label="Кубок">🏆</span> {currentCompetition.winners[0].prize}</WinnerPrize>
                                            )}
                                        </WinnerDetails>
                                    </WinnerInfo>
                                </WinnerSection>
                            ) : (
                                <Button
                                    variant="primary"
                                    onClick={() => setShowWinnerModal(true)}
                                    style={{ margin: '18px 0', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                >
                                    <EmojiEventsIcon fontSize="small" />
                                    Выбрать победителя
                                </Button>
                            )
                        )}
                        {isBoxRace && currentCompetition.status === 'active' && userIsRegistered && (
                            <Button
                                variant="primary"
                                onClick={() => setShowVideoRecorder(true)}
                                style={{ margin: '18px 0', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            >
                                Приступить
                            </Button>
                        )}
                    </HeaderContent>
                    <StatusDates>
                        <span>{formatDate(currentCompetition.start_date)} — {formatDate(currentCompetition.end_date)}</span>
                    </StatusDates>
                    <ScrollDownBtn onClick={handleScrollToContent} aria-label="Скроллить вниз">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </ScrollDownBtn>
                </PrettyHeader>
                <Content ref={contentRef}>
                    <StatusBadge $status={currentCompetition.status}>
                        {getStatusIcon(currentCompetition.status)} {getStatusLabel(currentCompetition.status)}
                    </StatusBadge>
                
                <Section>
                    <SectionHeader>
                        <SectionTitleText>📝 Описание</SectionTitleText>
                        {!isEditing ? (
                            <EditButton onClick={handleEdit} title="Редактировать">
                                <EditIcon fontSize="small" />
                            </EditButton>
                        ) : (
                            <ActionButtons>
                                <EditButton 
                                    onClick={handleSave} 
                                    title="Сохранить" 
                                    disabled={isSaving}
                                    style={{ 
                                        background: 'var(--success-background)', 
                                        borderColor: 'var(--success-color)', 
                                        color: 'var(--success-color)',
                                        opacity: isSaving ? 0.6 : 1
                                    }}
                                >
                                    <SaveIcon fontSize="small" />
                                </EditButton>
                                <EditButton 
                                    onClick={handleCancel} 
                                    title="Отменить" 
                                    disabled={isSaving}
                                    style={{ 
                                        background: 'var(--error-background)', 
                                        borderColor: 'var(--error-color)', 
                                        color: 'var(--error-color)',
                                        opacity: isSaving ? 0.6 : 1
                                    }}
                                >
                                    <CancelIcon fontSize="small" />
                                </EditButton>
                            </ActionButtons>
                        )}
                    </SectionHeader>
                    
                    {isEditing ? (
                        <RichTextEditor
                            value={editedDescription}
                            onChange={setEditedDescription}
                            placeholder="Введите описание конкурса..."
                            readOnly={isSaving}
                        />
                    ) : (
                        <Description dangerouslySetInnerHTML={{ __html: (currentCompetition.full_description || currentCompetition.description || '').replace(/\n/g, '<br>') }} />
                    )}
                </Section>
                
                <Section>
                    <SectionTitle>📅 Даты проведения</SectionTitle>
                    <InfoGrid>
                        <InfoItem>
                            <InfoLabel>Начало</InfoLabel>
                            <InfoValue>{formatDate(currentCompetition.start_date)}</InfoValue>
                        </InfoItem>
                        <InfoItem>
                            <InfoLabel>Окончание</InfoLabel>
                            <InfoValue>{formatDate(currentCompetition.end_date)}</InfoValue>
                        </InfoItem>
                    </InfoGrid>
                </Section>
                
                <Section>
                    <SectionTitle>📋 Правила участия</SectionTitle>
                    <RulesList>
                        {currentCompetition.rules.map((rule, index) => (
                            <RuleItem key={index}>{rule}</RuleItem>
                        ))}
                    </RulesList>
                </Section>
                <Section>
                    <SectionTitle>💰 Призовой фонд</SectionTitle>
                    {currentCompetition.status === 'completed' && currentCompetition.winners && currentCompetition.winners.length > 0 ? (
                        <PrizeSection style={{ 
                            background: 'var(--success-transparent)', 
                            borderColor: 'var(--success-color)',
                            padding: '20px'
                        }}>
                            <PrizeLabel style={{ color: 'var(--success-color)', fontSize: '16px' }}>🏆 Победитель получил</PrizeLabel>
                            <PrizeAmount style={{ color: 'var(--success-color)', fontSize: '24px' }}>{currentCompetition.winners[0].prize || currentCompetition.prize}</PrizeAmount>
                            <div style={{ 
                                marginTop: '12px', 
                                padding: '8px 12px', 
                                background: 'var(--success-color)', 
                                color: 'white', 
                                borderRadius: 'var(--radius)',
                                fontSize: '12px',
                                fontWeight: '600',
                                textAlign: 'center'
                            }}>
                                🎉 Приз вручен! 🎉
                            </div>
                        </PrizeSection>
                    ) : (
                        <PrizeSection>
                            <PrizeLabel>Главный приз</PrizeLabel>
                            <PrizeAmount>{currentCompetition.prize}</PrizeAmount>
                        </PrizeSection>
                    )}
                </Section>
                
                {currentCompetition.status === 'active' && (
                    <Section>
                        <SectionTitle>👥 Участники</SectionTitle>
                        <ParticipantsSection>
                            <ParticipantsHeader>
                                <ParticipantsCount>
                                    {currentCompetition.current_participants} из {currentCompetition.max_participants || '∞'} участников
                                </ParticipantsCount>
                            </ParticipantsHeader>
                            <ProgressBar>
                                <ProgressFill $progress={getProgressPercentage()} />
                            </ProgressBar>
                            <ProgressText>
                                {Math.round(getProgressPercentage())}% заполнено
                            </ProgressText>
                        </ParticipantsSection>
                    </Section>
                )}
                
                </Content>
            </DetailsContainer>

            <WinnerSelectionModal
                isOpen={showWinnerModal}
                onClose={() => setShowWinnerModal(false)}
                competitionId={currentCompetition.id}
                onWinnerSelected={handleWinnerSelected}
            />
            <VictoryDescriptionModal
                open={showVictoryModal}
                initialValue={victoryModalInitial}
                onSave={handleVictorySave}
                onCancel={() => setShowVictoryModal(false)}
            />
            <ParticipantsRankingModal
                isOpen={showRankingModal}
                onClose={() => setShowRankingModal(false)}
                competitionId={currentCompetition.id}
                competitionTitle={currentCompetition.title}
                createdBy={currentCompetition.created_by}
                currentUserId={userId || 0}
            />
            {showVideoRecorder && userId && (
                <VideoRecorderModal
                    onClose={() => setShowVideoRecorder(false)}
                    userId={userId}
                    firstName={user?.first_name || ''}
                    lastName={user?.last_name || ''}
                    competitionId={currentCompetition.id}
                />
            )}
        </>
    );
};

export default CompetitionDetails; 