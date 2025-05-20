import React, { useEffect, useRef, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; 
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; 
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext'; 
import { theme } from './styles/themes/theme';
import store from './store/store'; 
import { initializeFromTelegram, selectIsUserInitialized, selectUserInitializationError/*, selectUser*/ } from './store/slices/userSlice'; 
import { useAppDispatch } from './store/hooks';
import { logger } from './utils/logger';
import MainMenu from './components/MainMenu/MainMenu';
import CourierSchedule from './components/CourierSchedule/CourierSchedule';
import './App.css';
import './styles/base/variables.css';
import LocationChangeListener from './components/common/LocationChangeListener'; 
import { useWebSocketSync } from './hooks/useWebSocketSync';
import NotificationHandler from './components/notifications/NotificationHandler';
import InventoryPage from './pages/InventoryPage';
import ProtectedChefRoute from './components/ProtectedChefRoute';
import LoadingOverlay from './components/common/LoadingOverlay/LoadingOverlay';
import EventList from './components/Events/EventList';

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => <div style={{ color: 'red' }}>{message}</div>;
const AdminPanel: React.FC = () => <div>Admin Panel Placeholder</div>;


const MIN_LOADING_TIME = 1500; 

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isUserInitialized = useSelector(selectIsUserInitialized);
  const initError = useSelector(selectUserInitializationError);
  const initStarted = useRef(false);
  const initStartTimeRef = useRef<number | null>(null); 

  const [showOverlay, setShowOverlay] = useState(true); 

  const isActuallyLoading = !isUserInitialized && !initError;

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
        <MuiThemeProvider theme={theme}> 
          <Router>
            <LocationChangeListener /> 
            <AppInitializer>
              <NotificationHandler />
              <Routes>
                <Route path="/" element={<MainMenu />} />
                <Route 
                  path="/courier-schedule" 
                  element={ 
                    <CourierSchedule /> 
                  }
                 />
                <Route path="/admin" element={<AdminPanel />} /> 
                <Route 
                    path="/inventory" 
                    element={
                        <ProtectedChefRoute>
                            <InventoryPage />
                        </ProtectedChefRoute>
                    }
                 />
                 <Route 
                    path="/inventory/:chatId" 
                    element={
                        <ProtectedChefRoute>
                            <InventoryPage />
                        </ProtectedChefRoute>
                    }
                 />
                
                <Route 
                    path="/events"
                    element={
                        <ProtectedChefRoute>
                            <EventList />
                        </ProtectedChefRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppInitializer>
          </Router>
        </MuiThemeProvider>
      </CustomThemeProvider>
    </Provider>
  );
}

export default App;
