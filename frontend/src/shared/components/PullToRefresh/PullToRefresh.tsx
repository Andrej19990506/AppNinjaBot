import React from 'react';
import styled, { keyframes } from 'styled-components';

interface PullToRefreshProps {
  isRefreshing: boolean;
  isPulling: boolean;
  progress: number;
  pullDistance: number;
  threshold: number;
}

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const Container = styled.div<{ $visible: boolean; $distance: number }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${props => Math.max(props.$distance, 0)}px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: none;
  transition: ${props => (props.$visible ? 'none' : 'opacity 0.2s ease-out')};
  opacity: ${props => (props.$visible ? 1 : 0)};
  background: transparent;
`;

const LoaderContainer = styled.div<{ $progress: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  transform: scale(${props => Math.max(props.$progress, 0)});
  opacity: ${props => Math.max(props.$progress, 0)};
  transition: ${props => (props.$progress >= 1 ? 'none' : 'transform 0.15s ease, opacity 0.15s ease')};
`;

const Spinner = styled.div<{ $isRefreshing: boolean }>`
  width: 40px;
  height: 40px;
  border: 3px solid ${props => props.theme?.colors?.border || 'rgba(255, 255, 255, 0.3)'};
  border-top-color: ${props => props.theme?.colors?.primary || 'var(--primary-color, #FF5F1F)'};
  border-radius: 50%;
  animation: ${props => (props.$isRefreshing ? spin : 'none')} 0.8s linear infinite;
  transition: border-color 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  isRefreshing,
  isPulling,
  progress,
  pullDistance,
  threshold,
}) => {
  const shouldShow = isPulling || isRefreshing;
  // Вычисляем расстояние для отображения - только иконка, без текста
  const displayDistance = shouldShow ? Math.max(pullDistance, 50) : 0;

  return (
    <Container $visible={shouldShow} $distance={displayDistance}>
      <LoaderContainer $progress={progress}>
        <Spinner $isRefreshing={isRefreshing} />
      </LoaderContainer>
    </Container>
  );
};

