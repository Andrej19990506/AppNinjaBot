import React, { useEffect, useRef } from 'react';
import { Provider, useSelector } from 'react-redux';
// Возвращаем BrowserRouter
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; 
// Импортируем ОБА ThemeProvider-а
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; 
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext'; 
// Импортируем объект темы MUI
import { theme } from './styles/themes/theme'; // <-- Нашли тему!
// import { PersistGate } from 'redux-persist/integration/react';
import store /*, { persistor } */ from './store/store'; // <-- Исправлен импорт store, persistor комментируем
// Возвращаем импорт селекторов
import { initializeFromTelegram, selectIsUserInitialized, selectUserInitializationError, selectUser } from './store/slices/userSlice'; 
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

// --- Заглушки --- 
const LoadingScreen: React.FC<{ message: string }> = ({ message }) => <div>{message}...</div>;
const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => <div style={{ color: 'red' }}>{message}</div>;
const AdminPanel: React.FC = () => <div>Admin Panel Placeholder</div>;
// const theme = {}; // <-- Убираем заглушку темы
// const selectIsUserInitialized = (state: any) => state.user.isInitialized;
// const selectUserInitializationError = (state: any) => state.user.error;
// const selectUser = (state: any) => state.user.user;
// --- ------------------------------- ---

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  // Используем реальные селекторы
  const isUserInitialized = useSelector(selectIsUserInitialized);
  const initError = useSelector(selectUserInitializationError);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _user = useSelector(selectUser); // <-- Добавлено подчеркивание и коммент для eslint
  const initStarted = useRef(false);

  useEffect(() => {
    if (!isUserInitialized && !initError && !initStarted.current) {
      initStarted.current = true; 
      logger.log('🚀 [AppInitializer] Начало инициализации приложения...');
      
      dispatch(initializeFromTelegram()).unwrap()
        .then((initResult) => {
          // ... (логика после инициализации остается)
        })
        .catch((error) => {
          logger.error('❌ [AppInitializer] Ошибка инициализации пользователя:', error);
        });
    }
  }, [dispatch, isUserInitialized, initError]);

  if (!isUserInitialized && !initError) {
    return <LoadingScreen message="Инициализация приложения..." />;
  }

  if (initError) {
    logger.error(`[AppInitializer] Отображение ошибки инициализации: ${initError}`);
    return <ErrorDisplay message={`Ошибка инициализации: ${initError}`} />;
  }

  logger.log('[AppInitializer] Инициализация завершена, рендер основного приложения.');
  return <>{children}</>;
};

function App() {
  logger.log('🔄 Инициализация главного меню (запускается рендер App)...');

  return (
    <Provider store={store}>
      {/* <PersistGate loading={<LoadingScreen message="Загрузка состояния..." />} persistor={persistor}> */}
      {/* Сначала кастомный провайдер для data-theme */}
      <CustomThemeProvider>
        {/* Потом MUI провайдер с его темой */}
        <MuiThemeProvider theme={theme}> 
          <Router>
            {/* Добавляем слушатель сюда */}
            <LocationChangeListener /> 
            <AppInitializer>
              <Routes>
                <Route path="/" element={<MainMenu />} />
                <Route path="/courier-schedule" element={<CourierSchedule />} />
                <Route path="/admin" element={<AdminPanel />} /> {/* Используем заглушку */} 
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
