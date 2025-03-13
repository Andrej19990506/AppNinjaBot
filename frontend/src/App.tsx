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
import { useWebSocket } from './hooks/useWebSocket';
import { socketService } from './services/socket';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { addNotification, NotificationTypes } from './store/slices/notificationSlice';
import { initializeFromTelegram } from './store/slices/inventorySlice';

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
    const currentUser = useAppSelector((state) => state.inventory.currentUser);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                console.debug('🚀 Инициализация приложения...');
                await dispatch(initializeFromTelegram()).unwrap();
                console.debug('✅ Пользователь инициализирован:', currentUser);
                setIsInitialized(true);
            } catch (error) {
                console.error('❌ Ошибка при инициализации:', error);
                // Можно добавить обработку ошибки, например показать уведомление
            }
        };

        if (!isInitialized) {
            initializeApp();
        }
    }, [dispatch, isInitialized, currentUser]);

    // Показываем загрузку, пока не инициализировали пользователя
    if (!isInitialized) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                backgroundColor: '#1a1a1a'
            }}>
                <div style={{ color: '#fff' }}>Загрузка...</div>
            </div>
        );
    }

    return <>{children}</>;
};

// Компонент для управления WebSocket соединением
const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const websocket = useWebSocket();
    // Делаем безопасные деструктуризации с проверками
    const socket = websocket?.socket;
    const isConnectedFunc = websocket?.isConnected;
    const joinGlobalRoomFunc = websocket?.joinGlobalRoom;
    
    // Функции-обертки с проверками
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
    const currentUser = useAppSelector((state) => state.inventory.currentUser);
    const MAX_CONNECTION_ATTEMPTS = 3;

    // Инициализируем соединение при старте
    useEffect(() => {
        const initConnection = async () => {
            if (!socket && currentUser) {
                console.log('🚀 Инициализируем подключение WebSocket');
                try {
                    // Проверяем наличие текущего пользователя
                    if (!currentUser) {
                        console.warn('⚠️ Нет данных о текущем пользователе, подключение отложено');
                        return;
                    }

                    // При успешном соединении присоединяемся к глобальной комнате
                    joinGlobalRoom({
                        first_name: currentUser.first_name || '',
                        isAdmin: currentUser.isAdmin || false,
                        id: currentUser.id || null
                    });
                } catch (error: any) {
                    console.error('❌ Ошибка при инициализации WebSocket:', error);
                    
                    // Увеличиваем счетчик попыток подключения
                    setConnectionAttempts(prev => {
                        const newAttempts = prev + 1;
                        
                        // Показываем уведомление о проблеме, если превышен порог попыток
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
    }, [currentUser, dispatch, socket, joinGlobalRoom, MAX_CONNECTION_ATTEMPTS]);

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
    return (
        <Provider store={store}>
            <ThemeProvider>
                <StyledThemeProvider theme={{ mode: 'light' }}>
                    <AppInitializer>
                        <WebSocketProvider>
                            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                                    <Routes>
                                        <Route path="/" element={<MainMenu />} />
                                        <Route path="/events" element={<div>События</div>} />
                                        <Route path="/inventory/:chatId" element={<Inventory />} />
                                        <Route path="/inventory" element={<Inventory />} />
                                        <Route path="/write-off" element={<WriteOff />} />
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
