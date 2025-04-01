// @ts-nocheck
import React from 'react';
import { useDeviceDetection } from '../../hooks';
import { WriteOffReason } from '../../../../../types/writeOff';
import NormalModeMobile from './NormalModeMobile';
import NormalModeDesktop from './NormalModeDesktop';

// Расширяем тип для использования в компоненте
interface ReasonInfo extends WriteOffReason {
  description: string;
}

interface NormalModeProps {
  writeOffName: string;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  writeOffDescription: string;
  showDescriptionHint: boolean;
  setShowDescriptionHint: (show: boolean) => void;
  handleOpenDescriptionModal: (e: React.MouseEvent) => void;
  
  quantity: number;
  unitType: 'шт' | 'гр';
  handleQuantityChange: (newQuantity: number) => void;
  isQuantityInputOpen: boolean;
  tempQuantity: string;
  handleOpenQuantityInput: () => void;
  handleQuantityInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmQuantityInput: (e: React.MouseEvent) => void;
  handleCancelQuantityInput: (e: React.MouseEvent) => void;
  handleUnitToggle: (newUnitType: 'шт' | 'гр') => void;

  selectedReason: ReasonInfo | null;
  handleOpenReasonModal: () => void;
  setInfoModalOpen: (reasonId: string) => void;
  
  nameInputRef: React.RefObject<HTMLInputElement>;
  quantityInputRef: React.RefObject<HTMLInputElement>;
  
  // Добавляем обработчики для кнопок
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isEditMode?: boolean;
  
  // Добавляем дополнительные параметры для интегрированных компонентов
  writeOffReasons?: WriteOffReason[];
  handleReasonSelect?: (reason: WriteOffReason) => void;
  handleDescriptionChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const NormalMode: React.FC<NormalModeProps> = (props) => {
  const { isMobile } = useDeviceDetection();
  
  return isMobile 
    ? <NormalModeMobile {...props} /> 
    : <NormalModeDesktop {...props} />;
};

export default NormalMode; 