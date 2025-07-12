import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { 
    clearSelectedChat
} from '@/features/WriteOff/store/writeOffSlice';
import { useNavigate } from 'react-router-dom';
import { WriteOffChat as BaseWriteOffChat } from '@/types/writeOff';
import { fetchWriteOffChats, fetchWriteOffs, selectWriteOffChat } from '@/features/WriteOff/store/writeOffThunks';

interface UseWriteOffLoaderProps {
    chatId?: string;
    currentUserId: number | null;
    isAdmin: boolean;
    selectedDate?: string;  // Выбранная дата для фильтрации
}

type LoadWriteOffResult = BaseWriteOffChat | BaseWriteOffChat[] | null;

export const useWriteOffLoader = ({ chatId, currentUserId, isAdmin, selectedDate }: UseWriteOffLoaderProps) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isInitialized = useRef<boolean>(false);
    const retryCount = useRef<number>(0);
    const maxRetries = 3;
    const [loadingProgress, setLoadingProgress] = useState(0);
    
    // Селектор для получения текущего состояния списаний
    const selectedChat = useAppSelector(state => state.writeOff.selectedChat);
    const chats = useAppSelector(state => state.writeOff.chats);

    // Функция для проверки прав доступа к чату
    const checkChatAccess = useCallback((chatData: BaseWriteOffChat): boolean => {
        if (!chatData.admins) return false;
        return isAdmin || chatData.admins.some(admin => admin.user_id === currentUserId);
    }, [currentUserId, isAdmin]);

    // Функция для обработки ошибок с повторными попытками
    const handleError = useCallback(async <T>(error: any, retryFunction: () => Promise<T>): Promise<T | null> => {
        console.error('❌ Ошибка при загрузке данных:', error);
        
        if (retryCount.current < maxRetries) {
            console.log(`🔄 Повторная попытка ${retryCount.current + 1}/${maxRetries}...`);
            retryCount.current += 1;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));
            return retryFunction();
        }
        
        setError(error instanceof Error ? error.message : 'Произошла ошибка при загрузке данных');
        return null;
    }, []);

    // Основная функция загрузки данных списания
    const loadWriteOffData = useCallback(async (forceReload = false): Promise<LoadWriteOffResult> => {
        try {
            setIsLoading(true);
            setLoadingProgress(0);
            console.log('🔄 Загрузка данных списания:', { chatId, currentUserId, isAdmin });

            if (!currentUserId) {
                throw new Error('Отсутствует ID пользователя');
            }

            // Имитация прогресса
            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => Math.min(prev + 5, 70));
            }, 100);

            try {
                if (chatId) {
                    console.log('📥 Загрузка списаний для конкретного чата:', chatId);
                    
                    if (!forceReload && selectedChat?.chat_id === chatId && selectedChat.writeOffs) {
                        console.log('📦 Используем кэшированные данные');
                        return selectedChat;
                    }

                    // Сначала получаем информацию о чате и проверяем права доступа
                    const chatInfo = await dispatch(selectWriteOffChat({ 
                        chatId, 
                        date: selectedDate 
                    })).unwrap();
                    
                    if (!chatInfo || !checkChatAccess(chatInfo)) {
                        throw new Error('У вас нет доступа к этому чату');
                    }

                    // Списания уже загружены в selectWriteOffChat с фильтром по дате
                    console.log('📦 Чат и списания загружены успешно для даты:', selectedDate || 'все даты');

                    return chatInfo;
                } else {
                    console.log('📥 Загрузка списка чатов для списания');
                    const chats = await dispatch(fetchWriteOffChats()).unwrap();
                    console.log('📦 Получен список чатов:', chats);
                    return chats;
                }
            } finally {
                clearInterval(progressInterval);
            }

        } catch (error) {
            return handleError(error, () => loadWriteOffData(forceReload));
        } finally {
            setLoadingProgress(100);
            setTimeout(() => setIsLoading(false), 500);
        }
    }, [chatId, currentUserId, isAdmin, dispatch, selectedChat, handleError, checkChatAccess]);

    // Эффект для инициализации приложения
    useEffect(() => {
        let isMounted = true;
        
        const initializeApp = async () => {
            if (!isInitialized.current && isMounted) {
                console.log('🔍 Начало инициализации списания:', {
                    chatId,
                    currentUserId,
                    isAdmin,
                    isInitialized: isInitialized.current
                });
                
                try {
                    const result = await loadWriteOffData();
                    if (result) {
                        isInitialized.current = true;
                        console.log('✅ Инициализация списания завершена успешно');
                    }
                } catch (error) {
                    console.error('❌ Ошибка при инициализации списания:', error);
                }
            }
        };
        
        if (currentUserId) {
            initializeApp();
        }
        
        return () => {
            isMounted = false;
        };
    }, [currentUserId, loadWriteOffData, chatId, isAdmin]);

    // Эффект для проверки прав администратора
    useEffect(() => {
        if (!currentUserId || !chatId) return;
        
        if (!isAdmin) {
            console.debug('⚠️ Потеря прав администратора в списании:', { chatId });
            
            sessionStorage.setItem('wasKickedFromWriteOff', chatId);
            
            if (window.location.pathname.includes(`/write-off/${chatId}`)) {
                navigate('/write-off');
            }
        }
    }, [chatId, isAdmin, currentUserId, dispatch, navigate]);

    return {
        isLoading,
        error,
        isInitialized: isInitialized.current,
        loadWriteOffData,
        loadingProgress,
        selectedChat,
        chats
    };
}; 