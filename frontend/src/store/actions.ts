import { createAction } from '@reduxjs/toolkit';

/**
 * Action dispatched when the browser navigation history changes.
 * Payload: The new pathname (string).
 */
export const routeChanged = createAction<string>('navigation/routeChanged'); 