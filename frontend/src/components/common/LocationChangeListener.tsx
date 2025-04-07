import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { routeChanged } from '../../store/actions';
import { logger } from '../../utils/logger';

/**
 * A component that listens for location changes using React Router v6 hooks
 * and dispatches a Redux action (`routeChanged`) when the pathname changes.
 * This component does not render anything to the DOM.
 */
const LocationChangeListener: React.FC = () => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPathname = location.pathname;
    // Dispatch only if the pathname has actually changed
    if (previousPathnameRef.current !== currentPathname) {
       logger.log('[LocationChangeListener] Route changed to:', currentPathname);
       dispatch(routeChanged(currentPathname));
       previousPathnameRef.current = currentPathname;
    }
  }, [location.pathname, dispatch]); // Depend on pathname and dispatch

  return null; // This component renders nothing
};

export default LocationChangeListener; 