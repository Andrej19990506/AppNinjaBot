import React from 'react';
import { 
  LoadingContainer, 
  LoadingText,
  LoadingCard,
  IconWrapper,
  Circle,
  CircleInner,
  CircleCore,
  CalendarIconWrapper,
  CalendarIcon,
  LoadingTitle,
  ProgressBar
} from './styles';

interface LoadingOverlayProps {
  isVisible?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible = true }) => {
  if (!isVisible) return null;
  
  return (
    <LoadingContainer>
      <LoadingCard>
        <IconWrapper>
          <Circle />
          <CircleInner />
          <CircleCore />
          <CalendarIconWrapper>
            <CalendarIcon />
          </CalendarIconWrapper>
        </IconWrapper>
        
        <LoadingTitle>Загрузка календаря</LoadingTitle>
        
        <LoadingText>
          Собираем актуальную информацию о доступных сменах и резервах...
        </LoadingText>
        
        <ProgressBar />
      </LoadingCard>
    </LoadingContainer>
  );
};

export default LoadingOverlay; 