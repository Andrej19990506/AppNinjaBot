import React, { useEffect, useState, useCallback, useRef } from 'react';
import styled, { keyframes, createGlobalStyle, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@shared/store/hooks';
import { fetchSupplies, fetchCalendarData, selectRequests, selectCalendarData, selectCalendarLoading, setParams, reset } from './store/requestsSlice';
import { getCalendarData } from './services/requestsApi';
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
import SupplyCalendar from './components/SupplyCalendar';

// Интерфейс для конфигурации поставок
interface SuppliesConfig {
  spreadsheet_id: string;
  household_spreadsheet_id?: string;
  stationery_spreadsheet_id?: string;
  default_sheet_pattern: string;
  branch_name: string;
  start_row?: number;
  header_row?: number;
  months_range_back?: number;
  months_range_forward?: number;
}

// Типы поставок
const SUPPLY_TYPES = [
  { id: 'raw_materials', name: 'Сырье', description: 'Продукты и ингредиенты' },
  { id: 'household', name: 'Хозтовары', description: 'Бытовая химия и уборка' },
  { id: 'stationery', name: 'Канцелярия', description: 'Офисные принадлежности' }
] as const;


// Стили для карусельки типов поставок
const SupplyTypeCarousel = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--card-background);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  margin: 20px 0;
  backdrop-filter: blur(10px);
`;

const SupplyTypeButton = styled.button<{ $isActive: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0px;
  padding: 16px 20px;
  border: none;
  border-radius: var(--radius-lg);
  background: ${props => props.$isActive 
    ? 'linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%)' 
    : 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(var(--primary-rgb), 0.12) 100%)'
  };
  color: ${props => props.$isActive 
    ? 'white' 
    : 'var(--text-primary)'
  };
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 100px;
  position: relative;
  overflow: hidden;
  border: 1px solid ${props => props.$isActive 
    ? 'var(--primary-color)' 
    : 'var(--border-color)'
  };
  box-shadow: ${props => props.$isActive 
    ? '0 4px 16px rgba(var(--primary-rgb), 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)' 
    : '0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
  };
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.6s ease;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &:hover {
    background: ${props => props.$isActive 
      ? 'linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%)' 
      : 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.12) 0%, rgba(var(--primary-rgb), 0.18) 100%)'
    };
    border-color: ${props => props.$isActive 
      ? 'var(--primary-color)' 
      : 'var(--primary-color)'
    };
    transform: translateY(-2px) scale(1.02);
    box-shadow: ${props => props.$isActive 
      ? '0 8px 24px rgba(var(--primary-rgb), 0.4), 0 4px 8px rgba(0, 0, 0, 0.15)' 
      : '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
    };
    
    &::before {
      left: 100%;
    }
    
    &::after {
      opacity: 1;
    }
  }
  
  &:active {
    transform: translateY(-1px) scale(1.01);
    transition: all 0.1s ease;
  }
`;

const SupplyTypeName = styled.span`
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
`;

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


const shineAnimation = keyframes`
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
`;



// Стилизованные компоненты в брендовом стиле
const PageContainer = styled(motion.div)`
  width: 100%;
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
    pointer-events: none;
    z-index: 0;
  }
  
  @media (max-width: 768px) {
    height: 100vh;
    padding: 5px;
    padding-bottom: 80px; /* Меньший отступ для мобильных */
  }
`;

const ContentWrapper = styled(motion.div)`
  padding-bottom: 80px;
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

const CalendarHeaderButton = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(var(--primary-rgb), 0.1);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: var(--radius);
  color: var(--primary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(var(--primary-rgb), 0.2);
    border-color: rgba(var(--primary-rgb), 0.3);
    transform: scale(1.02);
  }
`;

const CalendarDropdown = styled(motion.div)`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
`;

const LoadingContainer = styled(motion.div)`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 40px;
  border-radius: var(--radius-lg);
  margin: 24px 0;
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
  width: 40px;
  height: 40px;
  border: 3px solid var(--gray-200);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
  const calendarData = useAppSelector(selectCalendarData);
  const calendarLoading = useAppSelector(selectCalendarLoading);
  const [date, setDate] = useState<string>(getKrasnoyarskDate);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState<boolean>(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // Состояние модалки приемки
  const [modalProgress, setModalProgress] = useState(0);
  const [isModalComplete, setIsModalComplete] = useState(false);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const [deliveryData, setDeliveryData] = useState<Array<{date: string, count: number, suppliers: string[]}>>([]);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [showCalendarInHeader, setShowCalendarInHeader] = useState(false);
  const [selectedSupplyType, setSelectedSupplyType] = useState<'raw_materials' | 'household' | 'stationery'>('raw_materials');
  
  // 🚀 Глобальный кеш принятых поставок - не теряется при перемонтировании ItemsTable
  const acceptedDeliveriesCache = useRef<Map<string, Map<string, any>>>(new Map());
  const closeModalRef = useRef<(() => void) | null>(null); // Ref для функции закрытия модалки
  const acceptDeliveryRef = useRef<(() => void) | null>(null); // Ref для функции принятия поставки
  const currentRequestId = useRef<string | null>(null); // ID текущего запроса для отмены
  const abortController = useRef<AbortController | null>(null); // Контроллер для отмены запросов
  const isRequestInProgress = useRef<boolean>(false); // Флаг для предотвращения дублирования запросов
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
  const getChatDataConfig = (chatId: string, selectedDate: string): SuppliesConfig & { range: string; branchName: string } | null => {
    
    // Ищем чат по chat_id, учитывая возможные различия в типах (string vs number)
    const selectedChat = chefGroups.find(chat => 
      String(chat.chat_id) === String(chatId)
    );
    
    // Используем supplies_config из группы, если доступен
    if (selectedChat?.supplies_config) {
      const config = selectedChat.supplies_config;
      
      const result = {
        ...config,
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

  // 🔄 Обработчик смены типа поставок с отменой предыдущего запроса
  const handleSupplyTypeChange = (newSupplyType: 'raw_materials' | 'household' | 'stationery') => {
    console.log('🔄 [Requests] Смена типа поставок:', { from: selectedSupplyType, to: newSupplyType });
    
    // Отменяем предыдущий запрос если он есть
    if (abortController.current) {
      console.log('❌ [Requests] Отменяем предыдущий запрос на сервере:', currentRequestId.current);
      abortController.current.abort(); // РЕАЛЬНАЯ отмена запроса!
      abortController.current = null;
      currentRequestId.current = null;
    }
    
    // Сбрасываем флаг запроса
    isRequestInProgress.current = false;
    
    // Сбрасываем данные и состояние при смене типа
    dispatch(reset());
    setIsConfigMissing(false);
    setIsPermissionDenied(false);
    
    // Устанавливаем новый тип
    setSelectedSupplyType(newSupplyType);
  };

  useEffect(() => {
    if (selectedChatId && date) {
      const config = getChatDataConfig(selectedChatId, date);
      
      // Проверяем наличие конфигурации
      if (!config) {
        setIsConfigMissing(true);
        dispatch(reset()); // Сбрасываем loading если конфиг отсутствует
        return;
      }
      
      // Проверяем конфигурацию для выбранного типа поставок
      if (selectedSupplyType === 'household' && !config.household_spreadsheet_id) {
        setIsConfigMissing(true);
        dispatch(reset()); // Сбрасываем loading если конфиг для хозтоваров отсутствует
        return;
      }
      
      // Для канцелярии проверяем конфигурацию как для обычных поставок
      if (selectedSupplyType === 'stationery') {
        console.log('🎯 [Requests] Канцелярия выбрана - проверяем конфигурацию');
        // Проверяем есть ли конфигурация для канцелярии
        if (!config.stationery_spreadsheet_id) {
          console.log('⚠️ [Requests] Конфигурация канцелярии не найдена');
          setIsConfigMissing(true);
          setIsPermissionDenied(false);
          dispatch(reset()); // Сбрасываем loading если конфиг для канцелярии отсутствует
          return;
        }
        console.log('✅ [Requests] Конфигурация канцелярии найдена:', config.stationery_spreadsheet_id);
      }
      
      // Конфигурация найдена - сбрасываем флаги и устанавливаем параметры
      setIsConfigMissing(false);
      setIsPermissionDenied(false);
      
      // Обновляем параметры только если они изменились
      if (!params.spreadsheet_id || params.spreadsheet_id !== config.spreadsheet_id || params.range !== config.range) {
        dispatch(setParams({ 
          spreadsheet_id: config.spreadsheet_id, 
          range: config.range 
        }));
      }
      
      // Получаем правильный spreadsheet_id в зависимости от типа поставок
      const getSpreadsheetIdForType = (supplyType: string): string => {
        switch (supplyType) {
          case 'raw_materials':
            return config.spreadsheet_id;
          case 'household':
            return config.household_spreadsheet_id || config.spreadsheet_id;
          case 'stationery':
            return config.stationery_spreadsheet_id || config.spreadsheet_id;
          default:
            return config.spreadsheet_id;
        }
      };

      const currentSpreadsheetId = getSpreadsheetIdForType(selectedSupplyType);
      
      // Отправляем запрос только если данных еще нет или параметры изменились
      const shouldFetch = !data || 
                        !params.spreadsheet_id || 
                        params.spreadsheet_id !== currentSpreadsheetId || 
                        params.range !== config.range;
      
      if (shouldFetch && !isRequestInProgress.current) {
        // Предотвращаем дублирование запросов
        isRequestInProgress.current = true;
        
        // Создаем новый AbortController для текущего запроса
        abortController.current = new AbortController();
        
        // Генерируем уникальный ID для текущего запроса
        const requestId = `${selectedSupplyType}-${currentSpreadsheetId}-${config.range}-${Date.now()}`;
        currentRequestId.current = requestId;
        
        console.log('🔄 [Requests] Отправляем fetchSupplies:', {
          requestId,
          hasData: !!data,
          currentSpreadsheetId: params.spreadsheet_id,
          newSpreadsheetId: currentSpreadsheetId,
          currentRange: params.range,
          newRange: config.range,
          currentSupplyType: params.supply_type,
          newSupplyType: selectedSupplyType,
          date,
          mode,
          reason: !data ? 'Нет данных' : 
                 !params.spreadsheet_id ? 'Нет spreadsheet_id' :
                 params.spreadsheet_id !== currentSpreadsheetId ? 'Изменился spreadsheet_id' :
                 params.range !== config.range ? 'Изменился range' : 'Неизвестно'
        });
        
      dispatch(fetchSupplies({
          spreadsheet_id: currentSpreadsheetId,
          range: config.range,
        date,
        mode,
          subtract_withdrawn: false,
        exclude_zero: true,
          supply_type: selectedSupplyType,
          signal: abortController.current.signal, // Передаем сигнал отмены
      }) as any);
      
          // 🚀 ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА: Загружаем данные календаря одновременно с основными поставками
          const currentMonth = new Date();
          const year = currentMonth.getFullYear();
          const monthNum = currentMonth.getMonth();
          const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
          
          dispatch(fetchCalendarData({
            chat_id: selectedChatId,
            month: monthKey,
            supply_type: selectedSupplyType
          }));
      } else {
        // Данные уже есть и параметры не изменились
      }
    }
  }, [dispatch, selectedChatId, date, params.spreadsheet_id, params.range, mode, data, selectedSupplyType]);

  // Сбрасываем флаг запроса при изменении состояния Redux
  useEffect(() => {
    if (loading === false || error) {
      isRequestInProgress.current = false;
    }
  }, [loading, error]);

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

  // 🔄 Сброс ошибок при смене типа поставок
  useEffect(() => {
    if (error) {
      console.log('🔄 [Requests] Сбрасываем ошибку при смене типа поставок:', selectedSupplyType);
      dispatch(reset());
    }
  }, [selectedSupplyType, dispatch]);

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
    // НЕ сбрасываем данные при смене вкладки - только флаги ошибок
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

  // 📊 Функция для получения данных о поставках для календаря (ленивая загрузка по месяцам)
  const fetchDeliveryData = useCallback(async (month: Date) => {
    if (!selectedChatId) {
      return;
    }
    
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
    
    try {
      dispatch(fetchCalendarData({
        chat_id: selectedChatId,
        month: monthKey,
        supply_type: selectedSupplyType
      }));
    } catch (error) {
      console.error('Ошибка при загрузке данных календаря:', error);
    }
  }, [selectedChatId, selectedSupplyType, dispatch]);

  // 📊 Загружаем данные о поставках при смене филиала
  useEffect(() => {
    if (selectedChatId) {
      fetchDeliveryData(new Date());
    }
  }, [selectedChatId, fetchDeliveryData]);

  // 🚀 Синхронизация данных календаря из Redux store для ВСЕХ месяцев
  useEffect(() => {
    if (!selectedChatId) return;
    
    setDeliveryData(prevData => {
      let newData = [...prevData];
      
      // Проходим по всем данным календаря в Redux store
      for (const [key, cachedData] of Array.from(calendarData.entries())) {
        if (key.startsWith(`${selectedChatId}-`)) {
          const monthKey = key.replace(`${selectedChatId}-`, '');
          
          // Удаляем старые данные для этого месяца
          newData = newData.filter(item => !item.date.startsWith(monthKey));
          
          // Добавляем новые данные
          if (cachedData.deliveries && cachedData.deliveries.length > 0) {
            newData = [...newData, ...cachedData.deliveries];
          }
        }
      }
      
      return newData;
    });
  }, [selectedChatId, calendarData]);

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

        {/* Каруселька типов поставок - показываем всегда */}
        <SupplyTypeCarousel>
          {SUPPLY_TYPES.map((type) => (
            <SupplyTypeButton
              key={type.id}
              $isActive={selectedSupplyType === type.id}
              onClick={() => handleSupplyTypeChange(type.id)}
            >
              <SupplyTypeName>{type.name}</SupplyTypeName>
            </SupplyTypeButton>
          ))}
        </SupplyTypeCarousel>

        {/* Сообщение о ненастроенной конфигурации */}
        {isConfigMissing && (
          <ConfigMissing 
            branchName={chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title || 'Неизвестный филиал'}
            supplyType={selectedSupplyType}
          />
        )}

        {/* Сообщение об ошибке прав доступа */}
        {isPermissionDenied && !isConfigMissing && (
          <PermissionDenied 
            branchName={chefGroups.find(chat => chat.chat_id === selectedChatId)?.chat_title || 'Неизвестный филиал'}
            errorMessage={error || undefined}
            supplyType={selectedSupplyType}
          />
        )}

        {/* Контент приемки поставок */}
        {((!isConfigMissing && !isPermissionDenied && activeTab === 'delivery') || (selectedSupplyType === 'stationery' && activeTab === 'delivery')) && (
          <>

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

            {((data && !loading) || (selectedSupplyType === 'stationery' && !loading)) && (
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <DataContainer>
                  <ItemsTable 
                    items={data?.items || []} 
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
                    acceptedDeliveriesCache={acceptedDeliveriesCache}
                    onDateChange={handleDateChange}
                    selectedSupplyType={selectedSupplyType}
                    onSupplyTypeChange={handleSupplyTypeChange}
                    onMonthChange={fetchDeliveryData}
                    deliveryData={deliveryData}
                    loading={calendarLoading}
                  />
                </DataContainer>
              </motion.div>
            )}

        </>
      )}
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


