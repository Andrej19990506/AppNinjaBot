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
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 1102;
`;

const GalleryNavButton = styled(motion.button)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1102;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
  opacity: 0.7;
  will-change: transform;

  &:hover {
    background-color: rgba(0, 0, 0, 0.5);
    opacity: 1;
  }

  &.prev {
    left: 16px;
  }

  &.next {
    right: 16px;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  svg {
    font-size: 20px;
  }
`;

const GalleryImageContainer = styled(motion.div)<{ $scale: number; $isNavigating?: boolean }>`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform: scale(${props => props.$scale});
  /* Условный переход: мгновенный при навигации, плавный при зуме */
  transition: ${props => props.$isNavigating ? 'none' : `transform 0.3s ease`};
  will-change: transform;
`;

const GalleryImage = styled(motion.img)`
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  user-select: none;
  box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
`;

const GalleryCounter = styled.div`
  position: absolute;
  top: 16px;
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
  left: 50%;
  transform: translateX(-50%);
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
    opacity: 0,
    scale: 0.8
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.3, ease: "easeOut" }
    }
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.2, ease: "easeIn" }
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
  const [isNavigating, setIsNavigating] = useState(false);
  
  // --- Определяем пропсы для перетаскивания --- 
  const commonDragLogic = {
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.5,
    onDragEnd: (event: any, info: { offset: { x: number; y: number; }; velocity: { x: number; y: number; }; }) => {
      // Для ImageErrorPlaceholder или GalleryImage при scale === 1 (когда isNavigating=false)
      handleSwipe(info.offset, info.velocity);
    },
  };

  const galleryImageDragProps = isNavigating ? {
    drag: false as const,
    onDragEnd: undefined,
    dragConstraints: undefined,
    dragElastic: undefined,
  } : {
    drag: scale === 1 ? "x" as const : (scale > 1 ? true : undefined),
    dragConstraints: scale === 1
      ? { left: 0, right: 0 }
      : (scale > 1 
          ? { left: -window.innerWidth / 2, right: window.innerWidth / 2, top: -window.innerHeight / 2, bottom: window.innerHeight /2 } // Более широкие границы для зума
          : undefined),
    dragElastic: scale === 1 ? 0.5 : 0.2, // Меньшая эластичность при зуме
    onDragEnd: (event: any, info: { offset: { x: number; y: number; }; velocity: { x: number; y: number; }; }) => {
      if (scale === 1) { 
        handleSwipe(info.offset, info.velocity);
      }
      // Для масштабированных изображений здесь можно добавить логику возврата к центру или другую
    },
  };

  const errorPlaceholderDragProps = isNavigating ? {
    drag: false as const,
    onDragEnd: undefined,
    dragConstraints: undefined,
    dragElastic: undefined,
  } : {
    drag: "x" as const,
    ...commonDragLogic,
  };
  // --- Конец определения пропсов для перетаскивания ---

  useEffect(() => {
    // Сбрасываем индекс при открытии галереи
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
    }
  }, [isOpen, initialIndex]);
  
  // Эффект для сброса ошибки изображения при смене индекса
  useEffect(() => {
    setImageError(false);
  }, [currentIndex]);
  
  // Обработчик завершения анимации для нового изображения
  const handleImageAnimationComplete = (definition: any) => {
    if (definition === "center") {
      // Сброс флага навигации после завершения анимации перехода к центру
      setIsNavigating(false);
    }
  };
  
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
  }, [isOpen, currentIndex, photos.length, onClose, isNavigating]); // Добавляем isNavigating в зависимости
  
  // Функции навигации
  const showPrevious = () => {
    if (photos.length <= 1) return;
    if (isNavigating) return; // Предотвращаем навигацию во время анимации
    
    setIsNavigating(true); // Устанавливаем флаг навигации
    setScale(1); // Сбрасываем масштаб перед сменой фото
    setDirection(-1);
    
    // Переключаем индекс немедленно
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };
  
  const showNext = () => {
    if (photos.length <= 1) return;
    if (isNavigating) return; // Предотвращаем навигацию во время анимации
    
    setIsNavigating(true); // Устанавливаем флаг навигации
    setScale(1); // Сбрасываем масштаб перед сменой фото
    setDirection(1);
    
    // Переключаем индекс немедленно
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
  
  // Функция для обработки свайпа
  const handleSwipe = (offset: { x: number; y: number }, velocity: { x: number; y: number }) => {
    const swipeThreshold = 50;      // Минимальное расстояние перетаскивания для "засчитанного" свайпа
    const velocityThreshold = 200;  // Минимальная скорость для "быстрого" свайпа (флика)

    // Не обрабатываем свайпы во время анимации
    if (isNavigating) return;

    // Проверяем горизонтальный свайп
    if (velocity.x < -velocityThreshold || offset.x < -swipeThreshold) {
      showNext();
    } else if (velocity.x > velocityThreshold || offset.x > swipeThreshold) {
      showPrevious();
    }
  };
  
  // Добавляем эффект для отладки состояния isNavigating
  useEffect(() => {
    // Добавляем резервный механизм сброса isNavigating
    // В случае если анимация не срабатывает корректно, гарантируем сброс флага
    if (isNavigating) {
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 800); // Запас времени для завершения анимации
      
      return () => clearTimeout(timer);
    }
  }, [isNavigating, currentIndex]);
  
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
          <GalleryCloseButton
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
          >
            <CloseIcon />
          </GalleryCloseButton>
          
          
          {/* Восстанавливаем и добавляем навигационные кнопки */}
          {photos.length > 1 && (
            <>
              <GalleryNavButton
                className="prev"
                whileHover={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
                whileTap={{ backgroundColor: 'var(--primary-color)', opacity: 1 }}
                onClick={(e) => { e.stopPropagation(); showPrevious(); }}
                disabled={currentIndex === 0}
              >
                <ArrowBackIosNewIcon />
              </GalleryNavButton>
              
              <GalleryNavButton
                className="next"
                whileHover={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
                whileTap={{ backgroundColor: 'var(--primary-color)', opacity: 1 }}
                onClick={(e) => { e.stopPropagation(); showNext(); }}
                disabled={currentIndex === photos.length - 1}
              >
                <ArrowForwardIosIcon />
              </GalleryNavButton>
            </>
          )}
          
          {/* Контейнер для изображения */}
          <GalleryImageContainer 
            $scale={scale} 
            $isNavigating={isNavigating}
            key={`container-${currentIndex}`} // Добавляем ключ для форсирования пересоздания при смене фото
          >
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {/* @ts-ignore */}
            <AnimatePresence initial={false} custom={direction} mode="wait">
              {imageError ? (
                <ImageErrorPlaceholder
                  key={`error-${currentIndex}`}
                  variants={imageVariants}
                  custom={direction}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  {...errorPlaceholderDragProps}
                  onAnimationComplete={handleImageAnimationComplete}
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
                  {...galleryImageDragProps}
                  onAnimationComplete={handleImageAnimationComplete}
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