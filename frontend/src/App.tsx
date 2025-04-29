import React, { useEffect, useRef, useState } from 'react';
import { Provider, useSelector /*, useDispatch*/ } from 'react-redux';
// Возвращаем BrowserRouter
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; 
// Импортируем ОБА ThemeProvider-а
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; 
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext'; 
// Импортируем объект темы MUI
import { theme } from './styles/themes/theme';
// import { PersistGate } from 'redux-persist/integration/react';
import store /*, { persistor } */ from './store/store'; // <-- Исправлен импорт store, persistor комментируем
// Возвращаем импорт селекторов
import { initializeFromTelegram, selectIsUserInitialized, selectUserInitializationError/*, selectUser*/ } from './store/slices/userSlice'; 
// import { initializeFromTelegram } from './store/slices/userSlice'; // <-- Убираем старый импорт
import { useAppDispatch } from './store/hooks';
// import { theme } from './contexts/ThemeContext'; // <-- Откатываем импорт
import { logger } from './utils/logger';
import MainMenu from './components/MainMenu/MainMenu';
import CourierSchedule from './components/CourierSchedule/CourierSchedule';
// import AdminPanel from './components/AdminPanel/AdminPanel'; // <-- Комментируем компонент
// import LoadingScreen from './components/Common/LoadingScreen'; // <-- Комментируем компонент
// import ErrorDisplay from './components/Common/ErrorDisplay'; // <-- Комментируем компонент
import './App.css';
// Импортируем CSS переменные
import './styles/base/variables.css';
// Импортируем слушатель
import LocationChangeListener from './components/common/LocationChangeListener'; 
// import { socketService } from './services/socket'; // <<< Удаляем импорт
import { useWebSocketSync } from './hooks/useWebSocketSync';
// import styled from 'styled-components'; // <<< Удаляем импорт
// <<< Импортируем новый компонент-обработчик >>>
import NotificationHandler from './components/notifications/NotificationHandler';
// import { AnimatePresence } from 'framer-motion'; // <<< УДАЛЯЕМ НЕИСПОЛЬЗУЕМЫЙ ИМПОРТ

// NEW: Импортируем страницу инвентаря и защищенный маршрут
import InventoryPage from './pages/InventoryPage';
import ProtectedChefRoute from './components/ProtectedChefRoute';

// ИМПОРТИРУЕМ новый LoadingOverlay
import LoadingOverlay from './components/common/LoadingOverlay/LoadingOverlay';

// NEW: Импортируем компоненты событий
import EventList from './components/Events/EventList';
import CreateEvent from './components/Events/CreateEvent';

// --- Заглушки --- 
const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => <div style={{ color: 'red' }}>{message}</div>;
const AdminPanel: React.FC = () => <div>Admin Panel Placeholder</div>;


const MIN_LOADING_TIME = 3000; // Минимальное время отображения в миллисекундах (УВЕЛИЧЕНО)

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isUserInitialized = useSelector(selectIsUserInitialized);
  const initError = useSelector(selectUserInitializationError);
  const initStarted = useRef(false);
  const initStartTimeRef = useRef<number | null>(null); // Для хранения времени старта

  // Состояние для управления видимостью оверлея (отличается от реальной загрузки)
  const [showOverlay, setShowOverlay] = useState(true); 

  // Флаг реальной загрузки (для рендера children)
  const isActuallyLoading = !isUserInitialized && !initError;

  useEffect(() => {
    // Запускаем инициализацию и засекаем время только один раз
    if (!isUserInitialized && !initError && !initStarted.current) {
      initStarted.current = true;
      initStartTimeRef.current = Date.now(); // Засекаем время старта
      setShowOverlay(true); // Убедимся, что оверлей показан в начале
      logger.log('🚀 [AppInitializer] Начало инициализации приложения...');
      
      dispatch(initializeFromTelegram()).unwrap()
        .then((initResult) => {
            // ... (логика после успешной инициализации)
        })
        .catch((error) => {
          logger.error('❌ [AppInitializer] Ошибка инициализации пользователя:', error);
          // Ошибку обрабатываем в следующем useEffect
        });
    }
  }, [dispatch, isUserInitialized, initError]);

  // Эффект для управления скрытием оверлея с учетом минимального времени
  useEffect(() => {
    if (!isActuallyLoading && initStartTimeRef.current) {
      // Инициализация завершена (успешно или с ошибкой)
      const elapsedTime = Date.now() - initStartTimeRef.current;
      const remainingTime = MIN_LOADING_TIME - elapsedTime;

      if (remainingTime > 0) {
        // Если прошло меньше минимального времени, ждем остаток
        const timer = setTimeout(() => {
          setShowOverlay(false); // Скрываем оверлей после задержки
        }, remainingTime);
        return () => clearTimeout(timer);
      } else {
        // Если времени прошло достаточно, скрываем сразу
        setShowOverlay(false);
      }
    } 
    // Этот эффект должен зависеть только от isActuallyLoading, чтобы сработать один раз при завершении
  }, [isActuallyLoading]);

  useWebSocketSync();

  // LoadingOverlay управляется состоянием showOverlay
  // Основной контент рендерится только ПОСЛЕ того, как showOverlay станет false
  return (
    <>
      {/* Убираем внешнюю AnimatePresence и возвращаем isLoading */}
      {/* @ts-ignore // Игнорируем ошибку TS2786 для AnimatePresence - Убираем этот коммент */}
      {/* <AnimatePresence> */}
        {/* Используем тернарный оператор вместо && - Возвращаем isLoading */}
        {/* {showOverlay ? <LoadingOverlay /> : null } */}
        <LoadingOverlay isLoading={showOverlay} /> { /* Возвращаем isLoading */ }
      {/* </AnimatePresence> */}

      {/* Рендерим контент ТОЛЬКО когда showOverlay = false И нет ошибки - возвращаем !showOverlay */}
      {!showOverlay && !initError && (
        <>{children}</>
      )}
      {initError && (
        <ErrorDisplay message={`Ошибка инициализации: ${initError}`} />
      )}
    </>
  );
};

function App() {
  logger.log('🔄 Инициализация главного меню (запускается рендер App)...');

  return (
    <Provider store={store}>
      <CustomThemeProvider>
        {/* Потом MUI провайдер с его темой */}
        <MuiThemeProvider theme={theme}> 
          <Router>
            {/* Добавляем слушатель сюда */}
            <LocationChangeListener /> 
            <AppInitializer>
              {/* <<< Вставляем обработчик уведомлений сюда >>> */}
              <NotificationHandler />
              <Routes>
                <Route path="/" element={<MainMenu />} />
                {/* Используем ProtectedCourierRoute для /courier-schedule */}
                <Route 
                  path="/courier-schedule" 
                  element={ 
                    /*<ProtectedCourierRoute>*/
                      <CourierSchedule /> 
                    /*</ProtectedCourierRoute>*/ // TODO: Раскомментировать защиту курьера позже
                  }
                 />
                <Route path="/admin" element={<AdminPanel />} /> 

                {/* NEW: Добавляем маршруты для инвентаря */}
                <Route 
                    path="/inventory" 
                    element={
                        <ProtectedChefRoute>
                            <InventoryPage />
                        </ProtectedChefRoute>
                    }
                 />
                 <Route 
                    path="/inventory/:chatId" // Маршрут с параметром chatId
                    element={
                        <ProtectedChefRoute>
                            <InventoryPage />
                        </ProtectedChefRoute>
                    }
                 />
                
                {/* NEW: Добавляем маршруты для событий */}
                <Route 
                    path="/events"
                    element={
                        <ProtectedChefRoute>
                            <EventList />
                        </ProtectedChefRoute>
                    }
                />
                <Route 
                    path="/events/new"
                    element={
                        <ProtectedChefRoute>
                            <CreateEvent />
                        </ProtectedChefRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppInitializer>
          </Router>
        </MuiThemeProvider>
      </CustomThemeProvider>
      {/* </PersistGate> */}
    </Provider>
  );
}

export default App;
