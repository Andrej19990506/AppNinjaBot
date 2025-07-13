import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '@shared/store/hooks';
import { logger } from '@shared/utils/logger';
import { routeChanged } from '@/store/actions';
import { resetWriteOffState } from '@features/WriteOff/store/writeOffSlice';


const LocationChangeListener: React.FC = () => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPathname = location.pathname;
    if (previousPathnameRef.current !== currentPathname) {
       logger.log('[LocationChangeListener] Route changed to:', currentPathname);
       dispatch(routeChanged(currentPathname));
       
       // Очищаем состояние списаний при переходе на главную страницу
       if (currentPathname === '/') {
         dispatch(resetWriteOffState());
         logger.log('[LocationChangeListener] Cleared writeOff state on home navigation');
       }
       
       previousPathnameRef.current = currentPathname;
    }
  }, [location.pathname, dispatch]);

  return null;
};

export default LocationChangeListener; 