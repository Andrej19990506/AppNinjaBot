import React, { useEffect, useRef, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'; 
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; 
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext'; 
import { theme } from './styles/themes/theme';
import store from './shared/store/store'; 
import { initializeFromTelegram} from '@shared/store/userSlice/userThunks';
import { selectIsUserInitialized, selectUserInitializationError } from '@shared/store/userSlice/userSelectors';
import { useAppDispatch } from './shared/store/hooks';
import { logger } from './shared/utils/logger';
import MainMenu from './features/MainMenu/MainMenu';
import CourierSchedule from './features/courierSchedule/CourierSchedule';
import './App.css';
import './styles/base/variables.css';
import LocationChangeListener from './shared/components/LocationChangeListener/LocationChangeListener'; 
import { useWebSocketSync } from './shared/hooks/useWebSocketSync';
import NotificationHandler from './shared/components/Notifications/NotificationHandler';
import InventoryPage from './features/Inventory/pages/InventoryPage';
import LoadingOverlay from './shared/components/LoadingOverlay/LoadingOverlay';
import EventList from './features/Events/EventList';
import { setActiveRole } from './shared/store/userSlice/userSlice';
import WriteOff from '@/features/WriteOff/WriteOff';
import TelegramAccessError from './shared/components/TelegramAccessError/TelegramAccessError';



const MIN_LOADING_TIME = 1500; 

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isUserInitialized = useSelector(selectIsUserInitialized);
  const initError = useSelector(selectUserInitializationError);
  const initStarted = useRef(false);
  const initStartTimeRef = useRef<number | null>(null); 
  const location = useLocation();

  const [showOverlay, setShowOverlay] = useState(true); 

  const isActuallyLoading = !isUserInitialized && !initError;

  // Восстанавливаем роль из URL при старте
  useEffect(() => {
    if (location.pathname.startsWith('/courier')) {
      dispatch(setActiveRole('courier'));
    } else if (location.pathname.startsWith('/chef')) {
      dispatch(setActiveRole('chef'));
    }
  }, [location.pathname, dispatch]);

  useEffect(() => {
    if (!isUserInitialized && !initError && !initStarted.current) {
      initStarted.current = true;
      initStartTimeRef.current = Date.now(); 
      setShowOverlay(true); 
      logger.log('🚀 [AppInitializer] Начало инициализации приложения...');
      
      dispatch(initializeFromTelegram()).unwrap()
        .then((initResult) => {
        })
        .catch((error) => {
          logger.error('❌ [AppInitializer] Ошибка инициализации пользователя:', error);
        });
    }
  }, [dispatch, isUserInitialized, initError]);

  useEffect(() => {
    if (!isActuallyLoading && initStartTimeRef.current) {
      const elapsedTime = Date.now() - initStartTimeRef.current;
      const remainingTime = MIN_LOADING_TIME - elapsedTime;

      if (remainingTime > 0) {
        const timer = setTimeout(() => {
          setShowOverlay(false); 
        }, remainingTime);
        return () => clearTimeout(timer);
      } else {
        setShowOverlay(false);
      }
    } 
  }, [isActuallyLoading]);

  useWebSocketSync();

  return (
    <>
        <LoadingOverlay isLoading={showOverlay} /> 
      {!showOverlay && !initError && (
        <>{children}</>
      )}
      {initError && (
        <TelegramAccessError error={initError} />
      )}
    </>
  );
};

function App() {
  logger.log('🔄 Инициализация главного меню (запускается рендер App)...');

  return (
    <Provider store={store}>
      <CustomThemeProvider>
        <MuiThemeProvider theme={theme}> 
          <Router>
            <LocationChangeListener /> 
            <AppInitializer>
              <NotificationHandler />
              <Routes>
                <Route path="/courier" element={<MainMenu />} />
                <Route path="/chef" element={<MainMenu />} />
                <Route path="/courier/events" element={<EventList />} />
                <Route path="/courier/courier-schedule" element={<CourierSchedule />} />
                <Route path="/chef/events" element={<EventList />} />
                <Route path="/chef/inventory" element={<InventoryPage />} />
                <Route path="/chef/write-off" element={<WriteOff />} />
                <Route path="/inventory/:chatId" element={<InventoryPage />} />
                <Route path="*" element={<Navigate to="/courier" replace />} />
              </Routes>
            </AppInitializer>
          </Router>
        </MuiThemeProvider>
      </CustomThemeProvider>
    </Provider>
  );
}

export default App;
