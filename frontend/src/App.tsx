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
import  NotificationHandler from './shared/components/Notifications/NotificationHandler';
import AwayOverlay from './shared/components/AwayOverlay/AwayOverlay';
import InventoryPage from './features/Inventory/pages/InventoryPage';
import LoadingOverlay from './shared/components/LoadingOverlay/LoadingOverlay';
import EventList from './features/Events/EventList';
import { setActiveRole } from './shared/store/userSlice/userSlice';
import WriteOff from '@/features/WriteOff/WriteOff';
import TelegramAccessError from './shared/components/TelegramAccessError/TelegramAccessError';
import ProtectedRoute from './shared/components/ProtectedRoute/ProtectedRoute';
import NoGroupAssigned from './shared/components/NoGroupAssigned/NoGroupAssigned';
import TutorialMaterials from './features/MainMenu/TutorialMaterials';
import Competitions from './features/Competitions/Competitions';



const MIN_LOADING_TIME = 1500; 

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const isUserInitialized = useSelector(selectIsUserInitialized);
  const initError = useSelector(selectUserInitializationError);
  const user = useSelector((state: any) => state.user.user);
  const initStarted = useRef(false);
  const initStartTimeRef = useRef<number | null>(null); 
  const location = useLocation();

  const [showOverlay, setShowOverlay] = useState(true);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [showBothScreens, setShowBothScreens] = useState(false); 

  const isActuallyLoading = !isUserInitialized && !initError;

  // Восстанавливаем роль из URL при старте
  useEffect(() => {
    // Получаем пользователя из стора
    const user = store.getState().user.user;
    if (location.pathname.startsWith('/courier')) {
      dispatch(setActiveRole('courier'));
    } else if (location.pathname.startsWith('/chef')) {
      dispatch(setActiveRole('chef'));
    } else {
      // Если путь не начинается ни с chef, ни с courier — определяем дефолтную роль по группам
      if (Array.isArray(user?.groups)) {
        if (user.groups.length === 1) {
          const onlyType = user.groups[0].group_type;
          if (onlyType === 'chef') dispatch(setActiveRole('chef'));
          else if (onlyType === 'courier') dispatch(setActiveRole('courier'));
        } else {
          const hasChef = user.groups.some(group => group.group_type === 'chef');
          const hasCourier = user.groups.some(group => group.group_type === 'courier');
          if (hasChef && !hasCourier) dispatch(setActiveRole('chef'));
          else if (hasCourier && !hasChef) dispatch(setActiveRole('courier'));
          else if (hasChef && hasCourier) dispatch(setActiveRole('chef'));
        }
      }
    }
  }, [location.pathname, dispatch]);

  useEffect(() => {
    if (!isUserInitialized && !initError && !initStarted.current) {
      initStarted.current = true;
      initStartTimeRef.current = Date.now(); 
      setShowOverlay(true); 
      dispatch(initializeFromTelegram()).unwrap()
        .then((initResult) => {
        })
        .catch((error) => {
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
  const { isModalOpen, permissionsNotification, handleModalClose } = usePermissionsWebSocket();
  useWebSocketConnection(); // Инициализация WebSocket
  useActivityNotifications(); // Глобальные уведомления активности
  const { isAwayOverlayVisible, handleContinueWork } = useAwayState(); // Управление заставкой отсутствия

  // Обработчики для TutorialMaterials
  useEffect(() => {
    const handleStartTransition = () => {
      // Показываем оба экрана одновременно - материалы под панелью
      setShowBothScreens(true);
      setIsTutorialOpen(true);
    };

    const handleOpenTutorial = () => {
      // Переход завершен, убираем флаг двойного показа
      setShowBothScreens(false);
    };

    const handleCloseTutorial = () => {
      setIsTutorialOpen(false);
      setShowBothScreens(false);
    };

    window.addEventListener('startTutorialTransition', handleStartTransition);
    window.addEventListener('openTutorialMaterials', handleOpenTutorial);
    window.addEventListener('closeTutorialMaterials', handleCloseTutorial);

    return () => {
      window.removeEventListener('startTutorialTransition', handleStartTransition);
      window.removeEventListener('openTutorialMaterials', handleOpenTutorial);
      window.removeEventListener('closeTutorialMaterials', handleCloseTutorial);
    };
  }, []);

  // Отладка состояний
  console.log('🔍 [App Debug] Состояния:', {
    showOverlay,
    initError,
    isUserInitialized,
    user: user ? { id: user.id, groups: user.groups } : null,
    hasGroups: user?.groups ? user.groups.length : 0,
    isAwayOverlayVisible // Добавляем состояние заставки отсутствия
  });

  // Отладка состояния заставки отсутствия
  useEffect(() => {
    console.log('🔍 [App Debug] isAwayOverlayVisible изменился:', isAwayOverlayVisible);
  }, [isAwayOverlayVisible]);

  return (
    <>
        <LoadingOverlay isLoading={showOverlay} /> 
      {!showOverlay && !initError && (
        // Если пользователь проинициализирован, но нет групп — показываем NoGroupAssigned
        (isUserInitialized && (!user || !Array.isArray(user.groups) || user.groups.length === 0))
          ? <NoGroupAssigned user={user} />
          : (
              <>
                {/* Показываем главное меню если tutorial не открыт или если показываем оба */}
                {(!isTutorialOpen || showBothScreens) && <>{children}</>}
                
                {/* Показываем обучающие материалы */}
                {isTutorialOpen && (
                  <TutorialMaterials 
                    isOpen={true}
                    onClose={() => setIsTutorialOpen(false)}
                  />
                )}
              </>
            )
      )}
      {initError && (
        <TelegramAccessError error={initError} />
      )}
      
      {/* Модальное окно об истечении прав */}
      {permissionsNotification && (
        <PermissionsExpiredModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          message={permissionsNotification.message}
          notificationType={permissionsNotification.notification_type}
        />
      )}
      
      {/* Заставка отсутствия */}
      <AwayOverlay 
        isVisible={isAwayOverlayVisible}
        onContinue={handleContinueWork}
      />
    </>
  );
};

// --- Автоматический редирект по ролям ---
const AutoRedirectByRole = () => {
  const user = store.getState().user.user;
  
  console.log('🔍 [AutoRedirectByRole] Пользователь:', user);
  
  if (Array.isArray(user?.groups)) {
    // Фильтруем только рабочие группы (chef и courier), исключаем технические группы
    const workingGroups = user.groups.filter(group => 
      group.group_type === 'chef' || group.group_type === 'courier'
    );
    
    console.log('🔍 [AutoRedirectByRole] Рабочие группы:', workingGroups);
    
    if (workingGroups.length === 1) {
      const onlyType = workingGroups[0].group_type;
      console.log('🔍 [AutoRedirectByRole] Единственная рабочая группа:', onlyType);
      
      if (onlyType === 'chef') return <Navigate to="/chef" replace />;
      if (onlyType === 'courier') return <Navigate to="/courier" replace />;
    } else if (workingGroups.length > 1) {
      const hasChef = workingGroups.some(group => group.group_type === 'chef');
      const hasCourier = workingGroups.some(group => group.group_type === 'courier');
      
      console.log('🔍 [AutoRedirectByRole] Несколько рабочих групп:', { hasChef, hasCourier });
      
      // Приоритет: chef > courier
      if (hasChef) return <Navigate to="/chef" replace />;
      if (hasCourier) return <Navigate to="/courier" replace />;
    }
  }
  
  console.log('🔍 [AutoRedirectByRole] Нет рабочих групп, показываем NoGroupAssigned');
  // Если нет рабочих групп — показываем NoGroupAssigned
  return <NoGroupAssigned user={user} />;
};

function App() {
  return (
    <Provider store={store}>
      <CustomThemeProvider>
        <MuiThemeProvider theme={theme}> 
          <Router>
            <LocationChangeListener /> 
            <AppInitializer>
              <NotificationHandler />
              <Routes>
                <Route path="/courier" element={
                  <ProtectedRoute requiredGroup="courier">
                    <MainMenu />
                  </ProtectedRoute>
                } />
                <Route path="/chef" element={
                  <ProtectedRoute requiredGroup="chef">
                    <MainMenu />
                  </ProtectedRoute>
                } />
                <Route path="/courier/events" element={<EventList />} />
                <Route path="/courier/courier-schedule" element={<CourierSchedule />} />
                <Route path="/chef/events" element={<EventList />} />
                <Route path="/chef/inventory" element={<InventoryPage />} />
                <Route path="/chef/write-off" element={<WriteOff />} />
                <Route path="/inventory/:chatId" element={<InventoryPage />} />
                <Route path="/competitions" element={<Competitions />} />
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
