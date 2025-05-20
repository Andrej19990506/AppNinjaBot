import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Типизированный хук для использования dispatch
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Типизированный хук для использования selector
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector; 