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
  transition: ${props => (props.$visible ? 'none' : 'opacity 0.3s ease-out')};
  opacity: ${props => (props.$visible ? 1 : 0)};
  background: ${props => props.theme?.colors?.background || 'var(--background-color, #0D0D0D)'};
`;

const LoaderContainer = styled.div<{ $progress: number }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transform: scale(${props => props.$progress});
  opacity: ${props => props.$progress};
  transition: ${props => (props.$progress >= 1 ? 'none' : 'transform 0.2s ease, opacity 0.2s ease')};
`;

const Spinner = styled.div<{ $isRefreshing: boolean }>`
  width: 32px;
  height: 32px;
  border: 3px solid ${props => props.theme?.colors?.border || 'rgba(255, 255, 255, 0.2)'};
  border-top-color: ${props => props.theme?.colors?.primary || '#007bff'};
  border-radius: 50%;
  animation: ${props => (props.$isRefreshing ? spin : 'none')} 0.8s linear infinite;
  transition: border-color 0.3s ease;
`;

const Text = styled.span<{ $isRefreshing: boolean }>`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme?.colors?.text || 'var(--text-color, #FFFFFF)'};
  opacity: ${props => (props.$isRefreshing ? 1 : 0.7)};
  transition: opacity 0.3s ease;
`;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  isRefreshing,
  isPulling,
  progress,
  pullDistance,
  threshold,
}) => {
  const shouldShow = isPulling || isRefreshing;
  const displayDistance = Math.max(pullDistance, shouldShow ? 60 : 0);

  return (
    <Container $visible={shouldShow} $distance={displayDistance}>
      <LoaderContainer $progress={progress}>
        <Spinner $isRefreshing={isRefreshing} />
        <Text $isRefreshing={isRefreshing}>
          {isRefreshing ? 'Обновление...' : progress >= 1 ? 'Отпустите для обновления' : 'Потяните для обновления'}
        </Text>
      </LoaderContainer>
    </Container>
  );
};

