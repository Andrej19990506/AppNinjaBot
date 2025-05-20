import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';

interface PhotoGalleryProps {
  photos: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

// Стилизованные компоненты
const GalleryOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(5px);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const GalleryContent = styled(motion.div)`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const GalleryControls = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 16px;
  z-index: 1101;
`;

const GalleryCloseButton = styled(motion.button)`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.5);
  transition: background-color var(--transition-normal);
  
  &:hover {
    background-color: var(--primary-color);
  }
`;

const GalleryImageContainer = styled(motion.div)<{ $scale: number }>`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform: scale(${props => props.$scale});
  transition: transform var(--transition-normal);
`;

const GalleryImage = styled(motion.img)`
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  user-select: none;
  box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
`;

const GalleryNavButton = styled(motion.button)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  z-index: 1102;
  transition: background-color var(--transition-normal);
  
  &:hover {
    background-color: var(--primary-color);
  }
  
  &.prev {
    left: 16px;
  }
  
  &.next {
    right: 16px;
  }
`;

const GalleryCounter = styled.div`
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  z-index: 1102;
`;

const ZoomControls = styled.div`
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 10px;
  z-index: 1102;
`;

const ZoomButton = styled(motion.button)`
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color var(--transition-normal);
  
  &:hover {
    background-color: var(--primary-color);
  }
`;

// После GalleryImage добавляем новый компонент для отображения плейсхолдера
const ImageErrorPlaceholder = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80%;
  height: 80%;
  max-width: 600px;
  max-height: 400px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius);
  padding: 2rem;
  color: white;
  text-align: center;
  
  svg {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.7;
  }
  
  p {
    margin: 0;
    opacity: 0.8;
  }
`;

// Анимационные варианты
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.3,
      ease: "easeOut"
    } 
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: { 
      duration: 0.2,
      ease: "easeIn" 
    } 
  }
};

const imageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  })
};

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ 
  photos, 
  initialIndex = 0, 
  isOpen, 
  onClose 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const [scale, setScale] = useState(1);
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    // Сбрасываем масштаб при смене фото
    setScale(1);
  }, [currentIndex]);
  
  useEffect(() => {
    // Сбрасываем индекс при открытии галереи
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
    }
  }, [isOpen, initialIndex]);
  
  // Сброс состояния ошибки при изменении индекса
  useEffect(() => {
    setImageError(false);
  }, [currentIndex]);
  
  // Обработчик клавиш для навигации
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          showPrevious();
          break;
        case 'ArrowRight':
          showNext();
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose]);
  
  // Функции навигации
  const showPrevious = () => {
    if (photos.length <= 1) return;
    
    setDirection(-1);
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };
  
  const showNext = () => {
    if (photos.length <= 1) return;
    
    setDirection(1);
    setCurrentIndex((prevIndex) => 
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  // Функции масштабирования
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };
  
  // Обработчик клика по изображению
  const handleImageClick = (e: React.MouseEvent) => {
    // Предотвращаем закрытие при клике на изображение
    e.stopPropagation();
  };
  
  // Обработчик ошибки загрузки изображения
  const handleImageError = () => {
    setImageError(true);
  };
  
  if (!isOpen || photos.length === 0) return null;
  
  return (
    <>
    {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
    {/* @ts-ignore */}
    <AnimatePresence mode="wait">
      <GalleryOverlay
        key="gallery-overlay"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <GalleryContent
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          <GalleryControls>
            <GalleryCloseButton
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
            >
              <CloseIcon />
            </GalleryCloseButton>
          </GalleryControls>
          
          {/* Навигационные кнопки */}
          {photos.length > 1 && (
            <>
              <GalleryNavButton
                className="prev"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={showPrevious}
              >
                <ArrowBackIosNewIcon fontSize="small" />
              </GalleryNavButton>
              
              <GalleryNavButton
                className="next"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={showNext}
              >
                <ArrowForwardIosIcon fontSize="small" />
              </GalleryNavButton>
            </>
          )}
          
          {/* Контейнер для изображения */}
          <GalleryImageContainer $scale={scale}>
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {/* @ts-ignore */}
            <AnimatePresence initial={false} custom={direction}>
              {imageError ? (
                <ImageErrorPlaceholder
                  key={`error-${currentIndex}`}
                  variants={imageVariants}
                  custom={direction}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <BrokenImageIcon />
                  <p>Не удалось загрузить изображение</p>
                  <p>Попробуйте обновить страницу или проверьте подключение к интернету</p>
                </ImageErrorPlaceholder>
              ) : (
                <GalleryImage
                  key={`photo-${currentIndex}`}
                  src={photos[currentIndex]}
                  alt={`Фото ${currentIndex + 1}`}
                  custom={direction}
                  variants={imageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onClick={handleImageClick}
                  onError={handleImageError}
                  drag={scale > 1}
                  dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
                  dragElastic={0.1}
                />
              )}
            </AnimatePresence>
          </GalleryImageContainer>
          
          {/* Счетчик фотографий */}
          {photos.length > 1 && (
            <GalleryCounter>
              {currentIndex + 1} / {photos.length}
            </GalleryCounter>
          )}
          
          {/* Контроль масштаба */}
          <ZoomControls>
            <ZoomButton
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOutIcon fontSize="small" />
            </ZoomButton>
            
            <ZoomButton
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleZoomIn}
              disabled={scale >= 3}
            >
              <ZoomInIcon fontSize="small" />
            </ZoomButton>
          </ZoomControls>
        </GalleryContent>
      </GalleryOverlay>
    </AnimatePresence>
    </>
  );
};

export default PhotoGallery; 