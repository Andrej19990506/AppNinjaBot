import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Provider, useSelector } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'; 
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; 
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext'; 
import { theme } from './styles/themes/theme';
import store from './shared/store/store'; 
import { initializeFromTelegram } from '@shared/store/userSlice/userThunks';
import { selectIsUserInitialized, selectUserInitializationError } from '@shared/store/userSlice/userSelectors';
import { useAppDispatch } from './shared/store/hooks';
import MainMenu from './features/MainMenu/MainMenu';
import CourierSchedule from './features/courierSchedule/CourierSchedule';
import './App.css';
import './styles/base/variables.css';
import LocationChangeListener from './shared/components/LocationChangeListener/LocationChangeListener'; 
import { useWebSocketSync } from './shared/hooks/useWebSocketSync';
import { usePermissionsWebSocket } from './shared/hooks/usePermissionsWebSocket';
import { useWebSocketConnection } from './shared/hooks/useWebSocketConnection';
import { useActivityNotifications } from './shared/hooks/useActivityNotifications';
import { useAwayState } from './shared/hooks/useAwayState';
import { PermissionsExpiredModal } from './shared/components/PermissionsExpiredModal/PermissionsExpiredModal';
import NotificationHandler from './shared/components/Notifications/NotificationHandler';
import { TooltipContainer } from './shared/components/Notifications/Toast';
import AwayOverlay from './shared/components/AwayOverlay/AwayOverlay';
import InventoryPage from './features/Inventory/pages/InventoryPage';
import LoadingOverlay from './shared/components/LoadingOverlay/LoadingOverlay';
import EventList from './features/Events/EventList';
import { setActiveRole } from './shared/store/userSlice/userSlice';
import WriteOff from '@/features/WriteOff/WriteOff';
import TelegramAccessError from './shared/components/TelegramAccessError/TelegramAccessError';
import ProtectedRoute from './shared/components/ProtectedRoute/ProtectedRoute';
import NoGroupAssigned from './shared/components/NoGroupAssigned/NoGroupAssigned';
import ServerErrorModal from './shared/components/ServerErrorModal/ServerErrorModal';
import TutorialMaterials from './features/MainMenu/TutorialMaterials';
import Competitions from './features/Competitions/Competitions';
import Requests from './features/Requests/Requests';
import { initializeGlobalErrorHandlers, cleanupGlobalErrorHandlers } from './shared/utils/globalErrorHandler';
import InstallPWAButton from './shared/components/InstallPWAButton/InstallPWAButton';
import { usePullToRefresh } from './shared/hooks/usePullToRefresh';
import { PullToRefresh } from './shared/components/PullToRefresh/PullToRefresh';
import ContestTermsPage from './features/VoiceDataCollection/pages/ContestTermsPage';

const WINTER_DECOR_STORAGE_KEY = 'flowix-winter-decor-enabled';

// Только реально серверные ошибки — не мобильная сеть
const isServerUnavailableError = (error: string | null): boolean => {
  if (!error) return false;
  return (
    error.includes('HTTP 5') ||
    error.includes('ERR_CONNECTION_REFUSED')
  );
};

const AuthenticatedAppEffects: React.FC = () => {
  useWebSocketSync();
  useWebSocketConnection();
  useActivityNotifications();
  return null;
};

const AuthenticatedModals: React.FC = () => {
  const { isModalOpen, permissionsNotification, handleModalClose } = usePermissionsWebSocket();
  return permissionsNotification ? (
    <PermissionsExpiredModal
      isOpen={isModalOpen}
      onClose={handleModalClose}
      message={permissionsNotification.message}
      notificationType={permissionsNotification.notification_type}
    />
  ) : null;
};

const AuthenticatedAwayOverlay: React.FC = () => {
  const { isAwayOverlayVisible, handleContinueWork } = useAwayState();
  return (
    <AwayOverlay 
      isVisible={isAwayOverlayVisible}
      onContinue={handleContinueWork}
    />
  );
};

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isUserInitialized = useSelector(selectIsUserInitialized);
  const initError = useSelector(selectUserInitializationError);
  const user = useSelector((state: any) => state.user.user);
  const initStarted = useRef(false);
  const location = useLocation();

  const [showOverlay, setShowOverlay] = useState(true);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [showBothScreens, setShowBothScreens] = useState(false);
  const [showServerError, setShowServerError] = useState(false);

  const isServerError = isServerUnavailableError(initError);

  // Запуск инициализации — один раз
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    dispatch(initializeFromTelegram())
      .unwrap()
      .catch((error) => {
        if (error !== 'AUTH_REQUIRED') {
          console.error('❌ [App] Ошибка инициализации:', error);
        }
      });
  }, [dispatch]);

  // Снимаем оверлей когда инициализация завершилась (успех или ошибка)
  useEffect(() => {
    if (isUserInitialized || initError) {
      setShowOverlay(false);
    }
  }, [isUserInitialized, initError]);

  // Показываем модалку только для реально серверных ошибок
  useEffect(() => {
    if (isServerError) {
      setShowServerError(true);
    }
  }, [isServerError]);

  // Восстанавливаем роль из URL при старте
  useEffect(() => {
    const user = store.getState().user.user;
    if (location.pathname.startsWith('/courier')) {
      dispatch(setActiveRole('courier'));
    } else if (location.pathname.startsWith('/chef')) {
      dispatch(setActiveRole('chef'));
    } else {
      if (Array.isArray(user?.groups)) {
        const hasChef = user.groups.some(g => g.group_type === 'chef');
        const hasCourier = user.groups.some(g => g.group_type === 'courier');
        if (hasChef) dispatch(setActiveRole('chef'));
        else if (hasCourier) dispatch(setActiveRole('courier'));
      }
    }
  }, [location.pathname, dispatch]);

  const isAuthenticated = isUserInitialized && initError !== 'AUTH_REQUIRED';

  const refreshApp = useCallback(async () => {
    try {
      await dispatch(initializeFromTelegram()).unwrap();
      window.dispatchEvent(new CustomEvent('appRefresh', { detail: { pathname: location.pathname } }));
    } catch (error) {
      console.error('❌ [PullToRefresh] Ошибка при обновлении:', error);
      throw error;
    }
  }, [dispatch, location.pathname]);

  const { isRefreshing, isPulling, progress, pullDistance, shouldShowLoader } = usePullToRefresh({
    onRefresh: refreshApp,
    threshold: 80,
    resistance: 0.5,
    disabled: showOverlay || !isUserInitialized || !!initError,
  });

  // Обработчики Tutorial
  useEffect(() => {
    const handleStartTransition = () => { setShowBothScreens(true); setIsTutorialOpen(true); };
    const handleOpenTutorial = () => { setShowBothScreens(false); };
    const handleCloseTutorial = () => { setIsTutorialOpen(false); setShowBothScreens(false); };

    window.addEventListener('startTutorialTransition', handleStartTransition);
    window.addEventListener('openTutorialMaterials', handleOpenTutorial);
    window.addEventListener('closeTutorialMaterials', handleCloseTutorial);

    return () => {
      window.removeEventListener('startTutorialTransition', handleStartTransition);
      window.removeEventListener('openTutorialMaterials', handleOpenTutorial);
      window.removeEventListener('closeTutorialMaterials', handleCloseTutorial);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setShowServerError(false);
    initStarted.current = false;
    setShowOverlay(true);

    dispatch(initializeFromTelegram())
      .unwrap()
      .catch((error) => {
        console.error('❌ [App] Ошибка при повторной попытке:', error);
      });
  }, [dispatch]);

  const noGroups = isUserInitialized && (!user || !Array.isArray(user.groups) || user.groups.length === 0);

  return (
    <>
      <LoadingOverlay isLoading={showOverlay} />

      {shouldShowLoader && (
        <PullToRefresh
          isRefreshing={isRefreshing}
          isPulling={isPulling}
          progress={progress}
          pullDistance={pullDistance}
          threshold={80}
        />
      )}

      {!showOverlay && initError === 'AUTH_REQUIRED' && (
        <TelegramAccessError error={initError} />
      )}

      {!showOverlay && !initError && noGroups && (
        <NoGroupAssigned user={user} />
      )}

      {!showOverlay && !initError && !noGroups && (
        <>
          {(!isTutorialOpen || showBothScreens) && <>{children}</>}
          {isTutorialOpen && (
            <TutorialMaterials
              isOpen={true}
              onClose={() => setIsTutorialOpen(false)}
            />
          )}
        </>
      )}

      {/* Сетевые ошибки (не сервер) — просто показываем TelegramAccessError без модалки */}
      {!showOverlay && initError && initError !== 'AUTH_REQUIRED' && !isServerError && (
        <TelegramAccessError error={initError} />
      )}

      <ServerErrorModal
        isOpen={showServerError && isServerError}
        onClose={() => setShowServerError(false)}
        onRetry={handleRetry}
        error={initError || undefined}
      />

      {isAuthenticated && <AuthenticatedModals />}
      {isAuthenticated && <AuthenticatedAwayOverlay />}
      {isAuthenticated && <AuthenticatedAppEffects />}
    </>
  );
};

// --- Автоматический редирект по ролям ---
const AutoRedirectByRole = () => {
  const user = store.getState().user.user;

  if (Array.isArray(user?.groups)) {
    const workingGroups = user.groups.filter(g =>
      g.group_type === 'chef' || g.group_type === 'courier'
    );

    if (workingGroups.some(g => g.group_type === 'chef')) return <Navigate to="/chef" replace />;
    if (workingGroups.some(g => g.group_type === 'courier')) return <Navigate to="/courier" replace />;
  }

  return <NoGroupAssigned user={user} />;
};

function App() {
  const [isWinterDecorEnabled, setIsWinterDecorEnabled] = React.useState<boolean>(() => {
    const stored = localStorage.getItem(WINTER_DECOR_STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  React.useEffect(() => {
    const handleToggle = (event: CustomEvent<{ enabled: boolean }>) => {
      const enabled = event.detail.enabled;
      setIsWinterDecorEnabled(enabled);
      localStorage.setItem(WINTER_DECOR_STORAGE_KEY, String(enabled));
      window.dispatchEvent(new CustomEvent('winterDecorStateChanged', { detail: { enabled } }));
    };

    window.addEventListener('winterDecorToggle', handleToggle as EventListener);
    return () => window.removeEventListener('winterDecorToggle', handleToggle as EventListener);
  }, []);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('winterDecorStateChanged', { detail: { enabled: isWinterDecorEnabled } }));
  }, [isWinterDecorEnabled]);

  React.useEffect(() => {
    initializeGlobalErrorHandlers();
    return () => cleanupGlobalErrorHandlers();
  }, []);

  return (
    <Provider store={store}>
      <CustomThemeProvider>
        <MuiThemeProvider theme={theme}> 
          <Router>
            <LocationChangeListener />
            <AppInitializer>
              <NotificationHandler />
              <TooltipContainer />
              <InstallPWAButton />
              <Routes>
                <Route path="/courier" element={
                  <ProtectedRoute requiredGroup="courier"><MainMenu /></ProtectedRoute>
                } />
                <Route path="/chef" element={
                  <ProtectedRoute requiredGroup="chef"><MainMenu /></ProtectedRoute>
                } />
                <Route path="/courier/events" element={<EventList />} />
                <Route path="/courier/courier-schedule" element={<CourierSchedule />} />
                <Route path="/chef/events" element={<EventList />} />
                <Route path="/chef/inventory" element={<InventoryPage />} />
                <Route path="/chef/write-off" element={<WriteOff />} />
                <Route path="/chef/requests" element={<Requests />} />
                <Route path="/chef/requests/:tab" element={<Requests />} />
                <Route path="/inventory/:chatId" element={<InventoryPage />} />
                <Route path="/competitions" element={<Competitions />} />
                <Route path="/voice-contest-terms" element={<ContestTermsPage />} />
                <Route path="*" element={<AutoRedirectByRole />} />
              </Routes>
            </AppInitializer>
          </Router>
        </MuiThemeProvider>
      </CustomThemeProvider>
    </Provider>
  );
}

export default App;