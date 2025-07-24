import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CompetitionCard, CompetitionDetails } from './components';
import SlidingDrawer from '@/shared/components/SlidingDrawer/SlidingDrawer';
import { Competition } from './types/competition';
import { fetchCompetitions, setSelectedCompetition } from '@/store/slices/competitionsSlice';
import { RootState, AppDispatch } from '@/store';

// Стили для контейнера страницы
const PageContainer = styled.div`
    height: 100vh;
    background: var(--background-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const ContentContainer = styled.div`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    padding-bottom: calc(env(safe-area-inset-bottom) + 20px);
    
    /* Стили для скроллбара */
    &::-webkit-scrollbar {
        width: 8px;
    }
    
    &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: var(--primary-color);
        border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
        background: var(--primary-dark);
    }
    
    /* Для Firefox */
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color) rgba(255, 255, 255, 0.1);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 24px;
    gap: 16px;
    padding-top: 80px;
    padding-left: 20px;
    padding-right: 20px;
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

const PageTitle = styled.h1`
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
`;

const TabsContainer = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 4px;
    margin-left: 20px;
    margin-right: 20px;
`;

const TabButton = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 12px 16px;
    background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.$active ? 'white' : 'var(--text-color)'};
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    
    &:hover {
        background: ${props => props.$active ? 'var(--primary-color)' : 'var(--primary-transparent)'};
    }
`;

const CompetitionsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
`;

const EmptyStateIcon = styled.div`
    font-size: 48px;
    margin-bottom: 16px;
`;

const EmptyStateText = styled.p`
    font-size: 16px;
    margin: 0;
`;

type TabType = 'all' | 'announcements' | 'active' | 'completed';

const Competitions: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { competitions, loading, error, selectedCompetition } = useSelector((state: RootState) => state.competitions);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Загружаем конкурсы при монтировании компонента
    useEffect(() => {
        dispatch(fetchCompetitions());
    }, [dispatch]);

    const handleBackClick = () => {
        navigate(-1);
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
    };

    const handleCardClick = (competition: Competition) => {
        dispatch(setSelectedCompetition(competition));
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        dispatch(setSelectedCompetition(null));
    };

    const filteredCompetitions = competitions.filter(competition => {
        if (activeTab === 'all') return true;
        if (activeTab === 'announcements') return competition.status === 'announcement';
        return competition.status === activeTab;
    });

    const getTabLabel = (tab: TabType) => {
        switch (tab) {
            case 'all': return 'Все';
            case 'announcements': return 'Анонсы';
            case 'active': return 'Идут';
            case 'completed': return 'Завершены';
            default: return '';
        }
    };

    return (
        <PageContainer>
            <Header>
                <BackButton onClick={handleBackClick}>
                    <ArrowBackIcon />
                </BackButton>
                <PageTitle>Конкурсы</PageTitle>
            </Header>

            <TabsContainer>
                <TabButton 
                    $active={activeTab === 'all'} 
                    onClick={() => handleTabChange('all')}
                >
                    {getTabLabel('all')}
                </TabButton>
                <TabButton 
                    $active={activeTab === 'announcements'} 
                    onClick={() => handleTabChange('announcements')}
                >
                    {getTabLabel('announcements')}
                </TabButton>
                <TabButton 
                    $active={activeTab === 'active'} 
                    onClick={() => handleTabChange('active')}
                >
                    {getTabLabel('active')}
                </TabButton>
                <TabButton 
                    $active={activeTab === 'completed'} 
                    onClick={() => handleTabChange('completed')}
                >
                    {getTabLabel('completed')}
                </TabButton>
            </TabsContainer>

            <ContentContainer>
                {loading ? (
                    <EmptyState>
                        <EmptyStateIcon>⏳</EmptyStateIcon>
                        <EmptyStateText>Загружаем конкурсы...</EmptyStateText>
                    </EmptyState>
                ) : error ? (
                    <EmptyState>
                        <EmptyStateIcon>❌</EmptyStateIcon>
                        <EmptyStateText>Ошибка загрузки: {error}</EmptyStateText>
                    </EmptyState>
                ) : filteredCompetitions.length > 0 ? (
                    <CompetitionsGrid>
                        {filteredCompetitions.map(competition => (
                            <CompetitionCard
                                key={competition.id}
                                competition={competition}
                                onClick={() => handleCardClick(competition)}
                            />
                        ))}
                    </CompetitionsGrid>
                ) : (
                    <EmptyState>
                        <EmptyStateIcon>🏆</EmptyStateIcon>
                        <EmptyStateText>
                            {activeTab === 'all' 
                                ? 'Пока нет конкурсов' 
                                : `Нет ${getTabLabel(activeTab).toLowerCase()}`
                            }
                        </EmptyStateText>
                    </EmptyState>
                )}
            </ContentContainer>

            {selectedCompetition && (
                <SlidingDrawer onClose={handleCloseModal}>
                    <CompetitionDetails 
                        competition={selectedCompetition} 
                        onClose={handleCloseModal}
                    />
                </SlidingDrawer>
            )}
        </PageContainer>
    );
};

export default Competitions; 