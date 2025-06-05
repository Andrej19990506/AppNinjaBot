import React, { useState, useEffect } from 'react';
import { 
  LoadingOverlayContainer, 
  LoadingSpinner,
  LoadingText
} from '@/features/courierSchedule/components/loading-overlay/styles';

interface LoadingOverlayProps {
  isVisible?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible = true }) => {
  const [isHiding, setIsHiding] = useState(false);
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsHiding(false);
    } else {
      setIsHiding(true);
    }
  }, [isVisible]);

  const handleAnimationEnd = () => {
    if (isHiding) {
      setShouldRender(false);
    }
  };

  if (!shouldRender) return null;
  
  return (
    <LoadingOverlayContainer isHiding={isHiding} onAnimationEnd={handleAnimationEnd}>
      <LoadingSpinner />
      <LoadingText>Загружаем актуальные данные смен и резервов...</LoadingText>
    </LoadingOverlayContainer>
  );
};

export default LoadingOverlay; 