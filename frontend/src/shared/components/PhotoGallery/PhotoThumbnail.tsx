import React, { useState } from 'react';
import styled from 'styled-components';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';

interface PhotoThumbnailProps {
  src: string;
  alt: string;
  onClick: (e: React.MouseEvent) => void;
  width?: string;
  height?: string;
}

const ThumbnailContainer = styled.div<{ width?: string; height?: string }>`
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-sm);
  width: ${props => props.width || '100px'};
  height: ${props => props.height || '100px'};
  cursor: pointer;
  transition: transform var(--transition-normal);
  
  &:hover {
    box-shadow: var(--shadow-md);
  }
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid var(--border-color);
  transition: transform var(--transition-normal);
  
  &:hover {
    transform: scale(1.05);
  }
`;

const ZoomIconOverlay = styled.div`
  position: absolute;
  top: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0.7;
  transition: opacity var(--transition-normal), background-color var(--transition-normal);
  
  ${ThumbnailContainer}:hover & {
    opacity: 1;
    background-color: var(--primary-color);
  }
`;

// Новый компонент для отображения плейсхолдера при ошибке загрузки
const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--gray-100);
  color: var(--gray-500);
  
  svg {
    font-size: 2rem;
    opacity: 0.7;
  }
`;

const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({ 
  src, 
  alt, 
  onClick, 
  width, 
  height 
}) => {
  // Добавляем состояние для отслеживания ошибок загрузки изображения
  const [imageError, setImageError] = useState(false);
  
  // Обработчик ошибок загрузки изображения
  const handleImageError = () => {
    setImageError(true);
  };
  
  return (
    <ThumbnailContainer 
      onClick={onClick} 
      width={width} 
      height={height}
    >
      {imageError ? (
        <ImagePlaceholder>
          <ImageNotSupportedIcon />
        </ImagePlaceholder>
      ) : (
        <ThumbnailImage 
          src={src} 
          alt={alt}
          onError={handleImageError}
        />
      )}
      <ZoomIconOverlay>
        <ZoomInIcon style={{ fontSize: '14px' }} />
      </ZoomIconOverlay>
    </ThumbnailContainer>
  );
};

export default PhotoThumbnail; 