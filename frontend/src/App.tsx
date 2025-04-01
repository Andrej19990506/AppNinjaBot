import React, { useEffect, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { ThemeProvider } from './contexts/ThemeContext';
import { store } from './store';
import './styles/base/variables.css';
import MainMenu from './components/MainMenu/MainMenu';
import Inventory from './components/Inventory/Inventory';
import WriteOff from './components/WriteOff/WriteOff';
import CourierSchedule from './components/CourierSchedule/CourierSchedule';
import ProtectedCourierRoute from './components/common/ProtectedCourierRoute';
import ProtectedChefRoute from './components/common/ProtectedChefRoute';
import { useAppDispatch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useAppSelector 
} from './store/hooks';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { addNotification, NotificationTypes } from './store/slices/notificationSlice';
import { initializeFromTelegram } from './store/slices/userSlice';
import { MainMenuSkeleton } from './components/common/Skeleton';
import WebSocketHandler from './components/WebSocketHandler';
import { TooltipContainer } from './components/Tooltip';
import { logger } from './utils/logger';
import useWebSocketConnection from './hooks/useWebSocketConnection';

// Вспомогательная функция для генерации уникальных ID для уведомлений
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const generateUniqueNotificationId = (prefix: string = 'notification'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Функция для очистки устаревших уведомлений из localStorage при запуске
const clearOldNotifications = () => {
    try {
        // Константа из notificationSlice.ts
        const PERSISTENT_NOTIFICATIONS_KEY = 'app_persistent_notifications';
        
        // Проверяем, есть ли сохраненные уведомления
        const savedData = localStorage.getItem(PERSISTENT_NOTIFICATIONS_KEY);
        if (savedData) {
            // Получаем только важные уведомления (предложения товаров со статусом)
            const notifications = JSON.parse(savedData);
            const filteredNotifications = notifications.filter((n: any) => 
                n.type === 'suggestion_status' || 
                (n.payload && n.payload.type === 'item_suggestion')
            );
            
            // Если есть что сохранять, то сохраняем отфильтрованные
            if (filteredNotifications.length > 0) {
                localStorage.setItem(PERSISTENT_NOTIFICATIONS_KEY, JSON.stringify(filteredNotifications));
                console.log(`🧹 Очищено ${notifications.length - filteredNotifications.length} устаревших уведомлений при запуске`);
            } else {
                // Если нет важных уведомлений, то удаляем ключ
                localStorage.removeItem(PERSISTENT_NOTIFICATIONS_KEY);
                console.log('🧹 Все уведомления очищены из localStorage при запуске');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при очистке устаревших уведомлений:', error);
    }
};

// Компонент для инициализации приложения
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const dispatch = useAppDispatch();
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    // Используем хук для WebSocket
    const { joinGlobalRoom, reinitializeSocket, connectToServer } = useWebSocketConnection();

    useEffect(() => {
        const initializeApp = async () => {
            try {
                logger.log('🚀 Начало инициализации приложения...');
                
                // Инициализация данных пользователя
                const initResult = await dispatch(initializeFromTelegram()).unwrap();
                logger.log('✅ Данные пользователя инициализированы:', initResult);
                
                // Устанавливаем флаг инициализации сразу после получения данных пользователя
                setIsInitialized(true);

                // Инициализируем WebSocket асинхронно через хук
                setTimeout(async () => {
                    try {
                        // Убедимся, что сокет правильно инициализирован
                        const socket = reinitializeSocket();
                        if (!socket) {
                            logger.error('❌ Не удалось инициализировать Socket.IO в AppInitializer');
                            return;
                        }
                        
                        // Устанавливаем соединение
                        logger.log('🔄 [AppInitializer] Установка WebSocket соединения...');
                        const connected = await connectToServer();
                        if (!connected) {
                            logger.error('❌ [AppInitializer] Не удалось установить соединение');
                            return;
                        }

                        // Подключаемся к глобальной комнате с информацией о пользователе
                        const userInfo = {
                            first_name: initResult?.first_name || 'Гость',
                            last_name: initResult?.last_name || '',
                            role: 'client'
                        };
                        
                        const joined = await joinGlobalRoom(userInfo);
                        if (!joined) {
                            logger.warn('⚠️ Не удалось подключиться к глобальной комнате');
                        } else {
                            logger.log('✅ Успешно подключились к глобальной комнате');
                        }
                    } catch (error) {
                        logger.error('❌ Ошибка при подключении к WebSocket:', error);
                    }
                }, 2000); // Задержка перед подключением
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                logger.error('❌ Ошибка при инициализации:', errorMessage);
                setInitError(errorMessage);
            }
        };

        if (!isInitialized && !initError) {
            initializeApp();
        }

        return () => {
            // Очистка выполняется автоматически в хуке useWebSocketConnection
        };
    }, [dispatch, isInitialized, initError, joinGlobalRoom, reinitializeSocket, connectToServer]);

    if (initError) {
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                padding: '20px',
                textAlign: 'center',
                color: '#ff4444'
            }}>
                <div>Ошибка при инициализации:</div>
                <div style={{ marginTop: '10px' }}>{initError}</div>
            </div>
        );
    }

    if (!isInitialized) {
        return <div>Загрузка...</div>;
    }

    return <>{children}</>;
};

// Компонент для управления WebSocket соединением

const App: React.FC = () => {
    // Очищаем уведомления при запуске приложения
    useEffect(() => {
        clearOldNotifications();
    }, []);

    // Добавляем состояние для контроля загрузки главного меню
    const [isMainMenuLoading, setIsMainMenuLoading] = useState(true);

    // Глобальный обработчик для предотвращения контекстного меню и сброса состояний
    useEffect(() => {
        const preventContextMenu = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Сбрасываем все состояния, связанные с drag-and-drop
            const dragElements = document.querySelectorAll('.dragging');
            dragElements.forEach(el => el.classList.remove('dragging'));
            
            // Сбрасываем выделение текста
            if (window.getSelection) {
                window.getSelection()?.removeAllRanges();
            }
            
            return false;
        };

        // Добавляем обработчики для всех событий, которые могут вызвать контекстное меню
        document.addEventListener('contextmenu', preventContextMenu);
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                preventContextMenu(e);
            }
        }, { passive: false });
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                preventContextMenu(e);
            }
        }, { passive: false });

        return () => {
            document.removeEventListener('contextmenu', preventContextMenu);
            document.removeEventListener('touchstart', preventContextMenu);
            document.removeEventListener('touchmove', preventContextMenu);
        };
    }, []);

    // Имитируем загрузку данных при первом рендере
    useEffect(() => {
        console.log('🔄 Инициализация главного меню...');
        const timer = setTimeout(() => {
            setIsMainMenuLoading(false);
            console.log('✅ Главное меню загружено');
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    // Обработчик завершения анимации скелетона
    const handleSkeletonAnimationComplete = useCallback(() => {
        console.log('✨ Анимация скелетона главного меню завершена');
        setIsMainMenuLoading(false);
    }, []);

    return (
        <Provider store={store}>
            <ThemeProvider>
                <StyledThemeProvider theme={{ mode: 'light' }}>
                    <AppInitializer>
                            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                                <Routes>
                                    <Route path="/" element={
                                        isMainMenuLoading 
                                            ? <MainMenuSkeleton 
                                                animation="shimmer" 
                                                onAnimationComplete={handleSkeletonAnimationComplete} 
                                              /> 
                                            : <MainMenu />
                                    } />
                                    <Route path="/events" element={
                                        <ProtectedChefRoute>
                                            <div>События</div>
                                        </ProtectedChefRoute>
                                    } />
                                    <Route path="/inventory/:chatId" element={
                                        <ProtectedChefRoute>
                                            <Inventory />
                                        </ProtectedChefRoute>
                                    } />
                                    <Route path="/inventory" element={
                                        <ProtectedChefRoute>
                                            <Inventory />
                                        </ProtectedChefRoute>
                                    } />
                                    <Route path="/write-off" element={
                                        <ProtectedChefRoute>
                                            <WriteOff />
                                        </ProtectedChefRoute>
                                    } />
                                    <Route 
                                        path="/courier-schedule" 
                                        element={
                                            <ProtectedCourierRoute>
                                                <CourierSchedule />
                                            </ProtectedCourierRoute>
                                        } 
                                    />
                                </Routes>
                            </Router>
                            <WebSocketHandler />
                            <TooltipContainer />
                    </AppInitializer>
                </StyledThemeProvider>
            </ThemeProvider>
        </Provider>
    );
};

export default App;
