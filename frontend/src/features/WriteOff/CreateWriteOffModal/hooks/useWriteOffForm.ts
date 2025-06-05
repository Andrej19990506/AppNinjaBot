import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { 
  setModalName, 
  setModalReason, 
  setModalQuantity, 
  setModalDescription,
  setModalUnitType,
  setModalSubmitting,
  resetModal
} from '@/features/WriteOff/store/writeOffSlice';
import { WriteOffReason } from '@/types/writeOff';

interface WriteOffFormCallbacks {
  onNameChange?: (name: string) => void;
  onReasonChange?: (reason: WriteOffReason) => void;
  onQuantityChange?: (quantity: number) => void;
  onDescriptionChange?: (description: string) => void;
  onUnitTypeChange?: (unitType: 'шт' | 'гр') => void;
}

/**
 * Хук для работы с формой списания через Redux
 * @param callbacks объект с колбэками для внешних компонентов
 * @returns объект с состоянием и обработчиками формы
 */
export function useWriteOffForm(callbacks?: WriteOffFormCallbacks) {
  const dispatch = useAppDispatch();
  const { 
    name: writeOffName, 
    reason: selectedReason, 
    quantity, 
    description: writeOffDescription,
    isSubmitting,
    unitType,
    isSuccess
  } = useAppSelector((state) => state.writeOff.modal);

  // Обработчик изменения названия списания
  const handleNameChange = useCallback((valueOrEvent: string | React.ChangeEvent<HTMLInputElement>) => {
    let newName: string;
    if (typeof valueOrEvent === 'string') {
      newName = valueOrEvent;
    } else {
      newName = valueOrEvent.target.value;
    }
    console.log('🔄 [handleNameChange] Изменение названия:', newName, 'Текущее:', writeOffName);
    dispatch(setModalName(newName));
    if (callbacks?.onNameChange) {
      console.log('✅ [handleNameChange] Вызов внешнего обработчика');
      callbacks.onNameChange(newName);
    }
  }, [dispatch, writeOffName, callbacks]);

  // Обработчик выбора причины
  const handleReasonSelect = useCallback((reason: WriteOffReason) => {
    console.log('🔄 [handleReasonSelect] Выбор причины:', reason.title, 'Текущая:', selectedReason?.title);
    dispatch(setModalReason(reason));
    if (callbacks?.onReasonChange) {
      console.log('✅ [handleReasonSelect] Вызов внешнего обработчика');
      callbacks.onReasonChange(reason);
    }
  }, [dispatch, selectedReason, callbacks]);

  // Обработчик изменения количества
  const handleQuantityChange = useCallback((value: number) => {
    console.log('🔄 [handleQuantityChange] Обновление Redux:', value, 'Текущее:', quantity);
    dispatch(setModalQuantity(value));
    if (callbacks?.onQuantityChange) {
      console.log('✅ [handleQuantityChange] Вызов внешнего обработчика');
      callbacks.onQuantityChange(value);
    }
  }, [dispatch, quantity, callbacks]);

  // Обработчик изменения текстового поля количества
  const handleQuantityInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Разрешаем пустую строку или числа
    if (value === '' || /^\d*$/.test(value)) {
      // Если строка пустая, устанавливаем количество в 0
      if (value === '') {
        handleQuantityChange(0);
        return;
      }
      
      // Преобразуем строку в число
      const numValue = parseInt(value, 10);
      
      // Проверяем, что число положительное
      if (!isNaN(numValue) && numValue >= 0) {
        handleQuantityChange(numValue);
      }
    }
  }, [handleQuantityChange]);

  // Обработчик для переключения единицы измерения
  const handleUnitToggle = useCallback((newUnitType: 'шт' | 'гр') => {
    console.log(`🔄 [handleUnitToggle] - переключение на ${newUnitType}`);
    dispatch(setModalUnitType(newUnitType));
    if (callbacks?.onUnitTypeChange) {
      callbacks.onUnitTypeChange(newUnitType);
    }
  }, [dispatch, callbacks]);

  // Обработчик изменения описания
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    console.log('🔄 Изменение описания:', newDescription);
    dispatch(setModalDescription(newDescription));
    if (callbacks?.onDescriptionChange) {
      callbacks.onDescriptionChange(newDescription);
    }
  }, [dispatch, callbacks]);

  // Обработчик начала отправки формы
  const handleStartSubmitting = useCallback(() => {
    dispatch(setModalSubmitting(true));
  }, [dispatch]);

  // Обработчик сброса формы
  const handleResetForm = useCallback(() => {
    dispatch(resetModal());
  }, [dispatch]);

  return {
    // Состояние
    writeOffName,
    selectedReason,
    quantity,
    writeOffDescription,
    isSubmitting,
    unitType,
    isSuccess,
    
    // Обработчики
    handleNameChange,
    handleReasonSelect,
    handleQuantityChange,
    handleQuantityInputChange,
    handleUnitToggle,
    handleDescriptionChange,
    handleStartSubmitting,
    handleResetForm
  };
} 