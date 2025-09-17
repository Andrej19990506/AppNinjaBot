import React, { useEffect, useState, useCallback, useRef } from 'react';
import styled, { keyframes, createGlobalStyle, css } from 'styled-components';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import { fetchSupplies, selectRequests, setParams, reset } from './store/requestsSlice';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import ChatSelector, { ChatItem } from '@shared/components/ChatSelector/ChatSelector';
import { generateRange } from '@/types/supplies';
import { getKrasnoyarskDate } from '@shared/utils/dateUtils';
import Filters from './components/Filters';
import ItemsTable from './components/ItemsTable';
import DeliveryHistory from './components/DeliveryHistory';
import ConfigMissing from './components/ConfigMissing';
import PermissionDenied from './components/PermissionDenied';
import Footer from '@/features/Inventory/Footer';



// Глобальный стиль для принудительного включения скролла
const GlobalScrollFix = createGlobalStyle`
  html, body {
    overflow: auto !important;
    height: auto !important;
    max-height: none !important;
  }
  
  #root {
    height: auto !important;
    min-height: 100vh !important;
    max-height: none !important;
    overflow: visible !important;
  }
`;

// Брендовые анимации
const pulseAnimation = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4);
  }
  70% { 
    box-shadow: 0 0 0 6px rgba(var(--primary-rgb), 0);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0);
  }
`;

const shineAnimation = keyframes`
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Стилизованные компоненты в брендовом стиле
const PageContainer = styled(motion.div)`
  width: 100%;
  background: linear-gradient(135deg, var(--background-color) 0%, var(--gray-50) 100%);
  padding: 24px;
  padding-bottom: 100px; /* Отступ для футера */
  position: relative;
  
  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 80%, rgba(var(--primary-rgb), 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(var(--primary-rgb), 0.05) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }
  
  @media (max-width: 768px) {
    padding: 5px;
    padding-bottom: 80px; /* Меньший отступ для мобильных */
  }
`;

const ContentWrapper = styled(motion.div)`
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
  width: 100%;
`;

const Header = styled(motion.div)`
  margin-top: 55px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card-background);
  padding: 24px 32px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(var(--primary-rgb), 0.05),
      transparent
    );
    animation: ${css`${shineAnimation} 3s infinite`};
  }
  
  @media (max-width: 768px) {
    margin-bottom: 24px;
    padding: 20px 24px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
`;

const Title = styled.h1`
  color: var(--text-color);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  
  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const TitleIcon = styled(motion.span)`
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(var(--primary-rgb), 0.3));
`;

const Subtitle = styled.p`
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin: 0;
  font-weight: 500;
  position: relative;
  z-index: 1;
  
  @media (max-width: 768px) {
    font-size: 0.875rem;
  }
`;

const BranchInfo = styled(motion.div)`
  margin-top: 12px;
  padding: 8px 16px;
  background: rgba(var(--primary-rgb), 0.1);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(2px);
  
  @media (max-width: 768px) {
    padding: 6px 12px;
    margin-top: 8px;
  }
`;

const BranchLabel = styled.span`
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
`;

const BranchName = styled.span`
  color: var(--primary-color);
  font-size: 0.9rem;
  font-weight: 600;
`;

const LoadingContainer = styled(motion.div)`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 40px;
  background: linear-gradient(135deg, var(--card-background), rgba(var(--primary-rgb), 0.05));
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(var(--primary-rgb), 0.15), var(--shadow-lg);
  margin: 24px 0;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  flex-direction: column;
  gap: 24px;
  min-height: 220px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(var(--primary-rgb), 0.1), transparent);
    animation: ${shineAnimation} 3s infinite;
  }
  
  @media (max-width: 768px) {
    padding: 40px 24px;
    min-height: 180px;
    gap: 20px;
  }
`;

const LoadingSpinner = styled(motion.div)`
  width: 56px;
  height: 56px;
  border: 3px solid rgba(var(--primary-rgb), 0.2);
  border-top: 3px solid var(--primary-color);
  border-right: 3px solid var(--primary-light);
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.4), inset 0 0 20px rgba(var(--primary-rgb), 0.1);
  position: relative;
  z-index: 1;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    background: var(--primary-color);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.6);
  }
`;

const LoadingText = styled(motion.span)`
  color: var(--text-color);
  font-size: 1.2rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.5;
  max-width: 350px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.3);
  letter-spacing: 0.5px;
  
  @media (max-width: 768px) {
    font-size: 1.1rem;
    max-width: 300px;
    letter-spacing: 0.3px;
  }
`;

const LoadingEmoji = styled(motion.span)`
  font-size: 2rem;
  margin-bottom: 8px;
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
`;

const ErrorContainer = styled(motion.div)`
  background: var(--error-background);
  border: 1px solid var(--error-color);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  margin: 24px 0;
  display: flex;
  align-items: center;
  box-shadow: var(--shadow-md);
`;

const ErrorIcon = styled(motion.div)`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--error-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  font-weight: bold;
  font-size: 16px;
  box-shadow: 0 2px 4px rgba(231, 76, 60, 0.3);
`;

const ErrorText = styled.span`
  color: var(--error-color);
  font-weight: 600;
  font-size: 1rem;
`;

// Специальный контейнер для ChatSelector чтобы избежать конфликтов стилей
const ChatSelectorContainer = styled(motion.div)`
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: var(--background-color);
  z-index: 100;
  overflow: hidden;
  
  /* Переопределяем стили ChatSelector для корректного отображения */
  .container {
    width: 100%;
    height: 100%;
    position: relative !important;
    display: flex;
    flex-direction: column;
    padding: 24px;
    box-sizing: border-box;
  }
  
  .contentWrapper {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    width: 100% !important;
    height: 100% !important;
  }
  
  .skeletonWrapper {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    width: 100% !important;
    height: 100% !important;
  }
`;

const DataContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  /* Убираем flex: 1 и min-width для полного скролла страницы */
`;

// Новые стили для табов
const TabsContainer = styled.div`
  background: var(--card-background);
  border-radius: var(--radius-lg);
  padding: 8px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  display: flex;
  gap: 4px;
`;

const Tab = styled(motion.button)<{ $active?: boolean }>`
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius);
  background: ${props => props.$active ? 'var(--gradient-primary)' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'var(--text-secondary)'};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.$active ? 'var(--gradient-primary)' : 'var(--gray-100)'};
    color: ${props => props.$active ? 'white' : 'var(--text-color)'};
  }
  
  .icon {
    font-size: 1.1rem;
  }
  
  @media (max-width: 768px) {
    padding: 10px 16px;
    font-size: 0.85rem;
    
    .icon {
      font-size: 1rem;
    }
  }
`;

// Компонент для рандомных сообщений загрузки
const LoadingMessages: React.FC = () => {
  const [currentMessage, setCurrentMessage] = useState(() => 
    Math.floor(Math.random() * 14) // Случайное число от 0 до 13
  );
  
  const loadingMessages = [
    { text: "📞 Обзваниваем поставщиков", emoji: "📞" },
    { text: "🔍 Подождите чуть-чуть, проверяем ничего не забыли добавить", emoji: "🔍" },
    { text: "📦 Считаем товары на складе", emoji: "📦" },
    { text: "✨ Проверяем качество поставки", emoji: "✨" },
    { text: "📋 Сверяем накладные с реальностью", emoji: "📋" },
    { text: "☕ Кофе заваривается, данные загружаются", emoji: "☕" },
    { text: "🥬 Проверяем все ли товары свежие", emoji: "🥬" },
    { text: "💰 Считаем деньги и товары", emoji: "💰" },
    { text: "🍕 Проверяем не съели ли мы что-то по дороге", emoji: "🍕" },
    { text: "🔑 Считаем сколько раз мы забыли ключи от склада", emoji: "🔑" },
    { text: "🗺️ Проверяем не перепутали ли мы адреса доставки", emoji: "🗺️" },
    { text: "☕ Считаем сколько кофе выпили за день", emoji: "☕" },
    { text: "🍽️ Проверяем не забыли ли мы про обед", emoji: "🍽️" },
    { text: "🔄 Считаем сколько раз нажали F5", emoji: "🔄" }
  ];

  useEffect(() => {
  // Инициализация LoadingMessages
    
    const interval = setInterval(() => {
      setCurrentMessage(prev => {
        const next = (prev + 1) % loadingMessages.length;
        return next;
      });
    }, 2000); // Меняем сообщение каждые 2 секунды

    return () => clearInterval(interval);
  }, []);

  const current = loadingMessages[currentMessage];
  console.log('🔄 [LOADING] Рендер LoadingMessages');

  return (
    <LoadingText
      key={currentMessage}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {current.text}
    </LoadingText>
  );
};

const Requests: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const { params, data, loading, error } = useAppSelector(selectRequests);
  const user = useAppSelector(selectUser);
  const [date, setDate] = useState<string>(getKrasnoyarskDate);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState<boolean>(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // Состояние модалки приемки
  const [modalProgress, setModalProgress] = useState(0);
  const [isModalComplete, setIsModalComplete] = useState(false);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const closeModalRef = useRef<(() => void) | null>(null); // Ref для функции закрытия модалки
  const acceptDeliveryRef = useRef<(() => void) | null>(null); // Ref для функции принятия поставки
  const mode: 'table' = 'table';
  
  // Активная вкладка: 'delivery' (приемка) или 'history' (история)
  const activeTab = tab === 'history' ? 'history' : 'delivery';
  
  // 🏢 Получаем поварские группы пользователя
  const chefGroups: ChatItem[] = React.useMemo(() => {
    if (!user?.groups) return [];
    
    const chefGroups = user.groups
      .filter(group => group.group_type === 'chef')
      .map(group => ({
        chat_id: String(group.chat_id), // Принудительно преобразуем в строку
        chat_title: group.chat_title || group.title || `Филиал ${group.chat_id}`,
        group_type: group.group_type,
        supplies_config: group.supplies_config,
        admins: [], // Для поставок права админа не нужны
        metadata: {
          chat_id: String(group.chat_id) // И здесь тоже
        }
      }));
    
    return chefGroups;
  }, [user?.groups]);

  // 🔗 Получение конфигурации поставок из группы
  const getChatDataConfig = (chatId: string, selectedDate: string) => {
    
    // Ищем чат по chat_id, учитывая возможные различия в типах (string vs number)
    const selectedChat = chefGroups.find(chat => 
      String(chat.chat_id) === String(chatId)
    );
    
    // Используем supplies_config из группы, если доступен
    if (selectedChat?.supplies_config) {
      const config = selectedChat.supplies_config;
      
      const result = {
        spreadsheet_id: config.spreadsheet_id,
        range: generateRange(config, selectedDate),
        branchName: config.branch_name
      };
      return result;
    }
    
    // Конфигурация не найдена - возвращаем null
    return null;
  };

  // 📅 Обработчик изменения даты
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    
    // Сбрасываем состояние при смене даты
    dispatch(reset());
    
    // Дополнительно сбрасываем флаги ошибок
    setIsConfigMissing(false);
    setIsPermissionDenied(false);
  };

  // 📋 Обработчик выбора чата
  const handleChatSelect = (chatIds: string[]) => {
    if (chatIds.length > 0) {
      const selectedId = chatIds[0];
      setSelectedChatId(String(selectedId)); // Принудительно преобразуем в строку
      
      // Сбрасываем состояние при смене чата
      dispatch(reset());
      
      // Дополнительно сбрасываем флаги ошибок
      setIsConfigMissing(false);
      setIsPermissionDenied(false);
    }
  };

  useEffect(() => {
    if (selectedChatId && date) {
      const config = getChatDataConfig(selectedChatId, date);
      
      // Проверяем наличие конфигурации
      if (!config) {
        setIsConfigMissing(true);
        return;
      }
      
      // Конфигурация найдена - сбрасываем флаги и устанавливаем параметры
      setIsConfigMissing(false);
      setIsPermissionDenied(false);
      if (!params.spreadsheet_id || params.spreadsheet_id !== config.spreadsheet_id || params.range !== config.range) {
        dispatch(setParams({ 
          spreadsheet_id: config.spreadsheet_id, 
          range: config.range 
        }));
      }
    }
  }, [dispatch, selectedChatId, date, params.spreadsheet_id, params.range]);

  useEffect(() => {
    if (selectedChatId && !isConfigMissing && params.spreadsheet_id && params.range) {
      dispatch(fetchSupplies({
        spreadsheet_id: params.spreadsheet_id,
        range: params.range,
        date,
        mode,
        subtract_withdrawn: false,
        exclude_zero: true,
      }) as any);
    }
  }, [dispatch, selectedChatId, isConfigMissing, params.spreadsheet_id, params.range, date, mode]);

  // 🚨 Обработка ошибок: определение типа ошибки
  useEffect(() => {
    if (error) {
      // Проверяем, является ли это ошибкой прав доступа (403 Forbidden)
      const isPermissionError = error.includes('403') || 
                                error.includes('PERMISSION_DENIED') || 
                                error.includes('The caller does not have permission') ||
                                error.includes('Forbidden') ||
                                error.includes('У бота нет прав доступа') ||
                                error.includes('прав доступа к Google Sheets');
      
      setIsPermissionDenied(isPermissionError);
    } else {
      // Если ошибки нет, сбрасываем флаг
      setIsPermissionDenied(false);
    }
  }, [error]);

  // Анимации для framer-motion
  const pageVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, delay: 0.2 }
    }
  };

  const handleTabChange = (newTab: 'delivery' | 'history') => {
    // Сбрасываем состояние при смене вкладки
    dispatch(reset());
    
    // Дополнительно сбрасываем флаги ошибок
    setIsConfigMissing(false);
    setIsPermissionDenied(false);
    
    if (newTab === 'delivery') {
      navigate('/chef/requests');
    } else {
      navigate('/chef/requests/history');
    }
  };

  // 🏠 Функция для перехода на главную страницу с полным сбросом состояния
  const handleGoHome = useCallback(() => {
    // Сбрасываем все локальные состояния
    setSelectedChatId(null);
    setIsConfigMissing(false);
    setIsPermissionDenied(false);
    setIsModalOpen(false);
    closeModalRef.current = null;
    
    // Сбрасываем состояние в Redux store
    dispatch(reset());
    
    // Переходим на главную страницу
    navigate('/chef');
  }, [navigate, dispatch]);

  // ⬅️ Определяем когда показывать кнопку "Назад"
  const shouldShowBackButton = activeTab === 'history' || isModalOpen;
  
  // ⬅️ Обработчик кнопки "Назад"
  const handleBackButton = useCallback(() => {
    if (isModalOpen && closeModalRef.current) {
      // Если открыта модалка - закрываем её через ref
      closeModalRef.current();
      return;
    }
    
    if (activeTab === 'history') {
      // Если в истории - переходим к приемке поставок
      navigate('/chef/requests');
      return;
    }
  }, [isModalOpen, activeTab, navigate]);

  // 🧹 Сброс состояния при размонтировании компонента
  useEffect(() => {
    return () => {
      // Сбрасываем состояния при уходе с страницы
      setSelectedChatId(null);
      setIsConfigMissing(false);
      setIsPermissionDenied(false);
      setIsModalOpen(false);
      closeModalRef.current = null;
    };
  }, []);

  // 🏠 Ранний возврат: Если нет выбранного чата - показываем ChatSelector
  if (!selectedChatId) {
    return (
      <>
        <GlobalScrollFix />
        <ChatSelectorContainer
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <ChatSelector
            chats={chefGroups}
            mode="supplies"
            title="Выберите филиал для работы с поставками"
            onChatSelect={handleChatSelect}
          />
        </ChatSelectorContainer>
      </>
    );
  }

  return (
    <>
      <GlobalScrollFix />
      <PageContainer
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
      <ContentWrapper>
        <Header variants={headerVariants}>
          <TitleSection>
            <TitleIcon
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3
              }}
            >
              {activeTab === 'history' ? '📋' : '📦'}
            </TitleIcon>
            <div>
              <Title>{activeTab === 'history' ? 'История поставок' : 'Поставки'}</Title>
              <Subtitle>{activeTab === 'history' ? 'Просмотр принятых поставок' : 'Управление приемкой товаров'}</Subtitle>
              {selectedChatId && (
                <BranchInfo
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <span>🏢</span>
                  <BranchLabel>Филиал:</BranchLabel>
                  <BranchName>
                    {chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title || 
                     chefGroups.find(chat => chat.chat_id === selectedChatId)?.supplies_config?.branch_name ||
                     'Неизвестный филиал'}
                  </BranchName>
                </BranchInfo>
              )}
            </div>
          </TitleSection>
        </Header>

        {/* Табы навигации - скрываем если конфигурация не настроена или нет прав доступа */}
        {!isConfigMissing && !isPermissionDenied && (
          <motion.div variants={contentVariants}>
            <TabsContainer>
              <Tab
                $active={activeTab === 'delivery'}
                onClick={() => handleTabChange('delivery')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="icon">📦</span>
                Приемка поставок
              </Tab>
              <Tab
                $active={activeTab === 'history'}
                onClick={() => handleTabChange('history')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="icon">📋</span>
                История поставок
              </Tab>
            </TabsContainer>
          </motion.div>
        )}

        {/* Сообщение о ненастроенной конфигурации */}
        {isConfigMissing && (
          <ConfigMissing 
            branchName={chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title || 'Неизвестный филиал'}
          />
        )}

        {/* Сообщение об ошибке прав доступа */}
        {isPermissionDenied && !isConfigMissing && (
          <PermissionDenied 
            branchName={chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title || 'Неизвестный филиал'}
            errorMessage={error || undefined}
          />
        )}

        {/* Контент приемки поставок */}
        {!isConfigMissing && !isPermissionDenied && activeTab === 'delivery' && (
          <>
            <motion.div variants={contentVariants}>
      <Filters
        date={date}
        onDateChange={handleDateChange}
              />
            </motion.div>

            {loading && (
              <LoadingContainer
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <LoadingSpinner
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <LoadingMessages />
              </LoadingContainer>
            )}

            {error && !isPermissionDenied && !loading && (
              <ErrorContainer
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ErrorIcon
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, -5, 5, 0]
                  }}
                  transition={{ 
                    duration: 0.5,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                >
                  !
                </ErrorIcon>
                <ErrorText>{error}</ErrorText>
              </ErrorContainer>
            )}

      {data && !loading && (
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <DataContainer>
                  <ItemsTable 
                    items={data.items} 
                    selectedDate={date}
                    selectedChatId={selectedChatId}
                    chatTitle={chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title}
                    onModalStateChange={setIsModalOpen}
                    closeModalRef={closeModalRef}
                    acceptDeliveryRef={acceptDeliveryRef}
                    onProgressChange={(progress, isComplete) => {
                      setModalProgress(progress);
                      setIsModalComplete(isComplete);
                    }}
                    onSubmittingChange={setIsModalSubmitting}
                  />
                </DataContainer>
              </motion.div>
            )}
        </>
      )}

        {/* Контент истории поставок */}
        {!isConfigMissing && !isPermissionDenied && activeTab === 'history' && (
          <motion.div
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <DeliveryHistory 
              selectedChatId={selectedChatId}
              chatTitle={chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title}
            />
          </motion.div>
        )}
      </ContentWrapper>

      {/* Футер с кнопками */}
      <Footer 
        selectedCategory={isModalOpen ? 'modal' : (shouldShowBackButton ? 'requests' : undefined)}
        onBack={handleBackButton}
        onHome={handleGoHome}
        showModalAcceptanceButtons={isModalOpen}
        onModalAccept={() => {
          // Вызываем реальную логику принятия поставки
          if (acceptDeliveryRef.current) {
            acceptDeliveryRef.current();
          }
        }}
        onModalCancelAcceptance={() => {
          // Здесь будет логика отмены
          if (closeModalRef.current) {
            closeModalRef.current();
          }
        }}
        isModalAcceptDisabled={!isModalComplete}
        isModalSubmitting={isModalSubmitting}
      />
      </PageContainer>
    </>
  );
};

export default Requests;


