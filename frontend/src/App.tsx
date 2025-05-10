import React, { useEffect, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { ThemeProvider } from './contexts/ThemeContext';
import { store } from './store';
import './styles/base/variables.css';
import MainMenu from './components/MainMenu/MainMenu';
import Inventory from './components/Inventory/Inventory';
import WriteOff from './components/WriteOff/WriteOff';
import CourierSchedule from './components/CourierSchedule/CourierSchedule';
import ProtectedCourierRoute from './components/common/ProtectedCourierRoute';
import { useWebSocket } from './hooks/useWebSocket';
import { socketService } from './services/socket';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { addNotification, NotificationTypes } from './store/slices/notificationSlice';
import { initializeFromTelegram } from './store/slices/userSlice';
import { MainMenuSkeleton } from './components/common/Skeleton';

// Вспомогательная функция для генерации уникальных ID для уведомлений
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

// Очищаем уведомления при запуске приложения
clearOldNotifications();

// Компонент для инициализации приложения
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const dispatch = useAppDispatch();
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const { user } = useAppSelector((state) => state.user);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                console.debug('🚀 Начало инициализации приложения...');
                
                // Инициализация данных пользователя
                console.debug('🔄 Начало инициализации данных пользователя...');
                const initResult = await dispatch(initializeFromTelegram()).unwrap();
                console.debug('✅ Результат инициализации данных:', initResult);
                
                // Инициализация WebSocket подключения
                console.debug('🔄 Инициализация WebSocket подключения...');
                const socketConnected = await socketService.connect();
                if (socketConnected) {
                    console.debug('✅ WebSocket подключение установлено');
                } else {
                    console.warn('⚠️ Не удалось установить WebSocket подключение');
                }
                
                setIsInitialized(true);
                console.debug('🎉 Инициализация приложения завершена успешно');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка при инициализации';
                console.error('❌ Ошибка при инициализации:', errorMessage);
                setInitError(errorMessage);
            }
        };

        if (!isInitialized && !initError) {
            initializeApp();
        }

        // Отключаем WebSocket при размонтировании
        return () => {
            socketService.disconnect();
        };
    }, [dispatch, isInitialized, initError]);

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
                <div>Ошибка при инициализации приложения:</div>
                <div style={{ marginTop: '10px' }}>{initError}</div>
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh' 
            }}>
                <div>Загрузка приложения...</div>
            </div>
        );
    }

    return children;
};

// Компонент для управления WebSocket соединением
const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const websocket = useWebSocket();
    const socket = websocket?.socket;
    const isConnectedFunc = websocket?.isConnected;
    const joinGlobalRoomFunc = websocket?.joinGlobalRoom;
    
    const isConnected = useCallback(() => {
        return typeof isConnectedFunc === 'function' ? isConnectedFunc() : false;
    }, [isConnectedFunc]);
    
    const joinGlobalRoom = useCallback((userInfo: any) => {
        if (typeof joinGlobalRoomFunc === 'function') {
            joinGlobalRoomFunc(userInfo);
        }
    }, [joinGlobalRoomFunc]);
    
    const [connectionAttempts, setConnectionAttempts] = useState(0);
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const MAX_CONNECTION_ATTEMPTS = 3;

    // Инициализируем соединение при старте
    useEffect(() => {
        const initConnection = async () => {
            if (!socket && user?.id) {
                console.log('🚀 Инициализируем подключение WebSocket');
                try {
                    // Проверяем наличие текущего пользователя
                    if (!user.id) {
                        console.warn('⚠️ Нет данных о текущем пользователе, подключение отложено');
                        return;
                    }

                    // При успешном соединении присоединяемся к глобальной комнате
                    joinGlobalRoom({
                        first_name: user.first_name || '',
                        isAdmin: user.isAdmin || false,
                        id: user.id
                    });
                } catch (error: any) {
                    console.error('❌ Ошибка при инициализации WebSocket:', error);
                    
                    setConnectionAttempts(prev => {
                        const newAttempts = prev + 1;
                        if (newAttempts >= MAX_CONNECTION_ATTEMPTS) {
                            dispatch(addNotification({
                                id: generateUniqueNotificationId('socket-error'),
                                type: NotificationTypes.WARNING,
                                message: 'Проблемы с сетевым соединением. Некоторые функции могут быть недоступны.',
                                duration: 10000
                            }));
                        }
                        return newAttempts;
                    });
                }
            }
        };

        initConnection();
    }, [user, dispatch, socket, joinGlobalRoom, MAX_CONNECTION_ATTEMPTS]);

    // Отслеживаем изменение состояния соединения
    useEffect(() => {
        if (socket) {
            const connected = isConnected();
            console.log('📡 WebSocket состояние:', connected ? 'Подключен' : 'Отключен');
            
            if (connected && connectionAttempts > 0) {
                // Если соединение восстановлено после разрыва
                dispatch(addNotification({
                    id: generateUniqueNotificationId('socket-connected'),
                    type: NotificationTypes.SUCCESS,
                    message: 'Соединение с сервером восстановлено',
                    duration: 3000
                }));
                setConnectionAttempts(0);
            } else if (!connected && connectionAttempts > MAX_CONNECTION_ATTEMPTS) {
                // Если соединение разорвано и уже были попытки восстановления
                dispatch(addNotification({
                    id: generateUniqueNotificationId('socket-error'),
                    type: NotificationTypes.WARNING,
                    message: 'Соединение с сервером разорвано',
                    duration: 10000
                }));
            }
        }
    }, [socket, connectionAttempts, dispatch, MAX_CONNECTION_ATTEMPTS, isConnected]);

    return <>{children}</>;
};

const App: React.FC = () => {
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
                        <WebSocketProvider>
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
                                    <Route path="/events" element={<div>События</div>} />
                                    <Route path="/inventory/:chatId" element={<Inventory />} />
                                    <Route path="/inventory" element={<Inventory />} />
                                    <Route path="/write-off" element={<WriteOff />} />
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
                        </WebSocketProvider>
                    </AppInitializer>
                </StyledThemeProvider>
            </ThemeProvider>
        </Provider>
    );
};

export default App;
