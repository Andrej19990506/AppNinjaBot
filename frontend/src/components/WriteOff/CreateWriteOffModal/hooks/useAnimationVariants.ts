import { useMemo } from 'react';
import { useDeviceDetection } from './useDeviceDetection';

/**
 * Хук для создания вариантов анимаций для компонентов framer-motion
 * @returns объект с вариантами анимаций для различных элементов
 */
export function useAnimationVariants() {
  const { isMobile, isDesktop, windowWidth } = useDeviceDetection();
  
  console.log(`[useAnimationVariants] Инициализация вариантов анимаций: isMobile=${isMobile}, isDesktop=${isDesktop}, width=${windowWidth}`);

  // Варианты анимаций для выдвижного контейнера (мобильная версия - ОПТИМИЗИРОВАННАЯ)
  const mobileDrawerVariants = useMemo(() => {
    console.log('[useAnimationVariants] Создание оптимизированных mobileDrawerVariants');
    return {
      hidden: { 
        y: "100%",
        opacity: 1,
        filter: "none",
        scale: 1,
        // Используем translate3d для аппаратного ускорения
        transform: "translate3d(0, 100%, 0)",
        // Указываем браузеру подготовиться к анимации этих свойств
        willChange: "transform",
        transition: {
          // Используем более простые и быстрые пружины
          type: "tween", // Заменяем spring на tween для мобильных устройств
          duration: 0.35, // Сокращаем время для ощущения отзывчивости
          ease: [0.25, 0.1, 0.25, 1], // Используем cubic-bezier для лучшей производительности
        }
      },
      visible: { 
        y: 0,
        opacity: 1,
        filter: "none",
        scale: 1,
        // Используем translate3d для аппаратного ускорения
        transform: "translate3d(0, 0, 0)",
        // Указываем браузеру подготовиться к анимации этих свойств
        willChange: "transform",
        transition: { 
          // Используем более простые и быстрые переходы для мобильных устройств
          type: "tween", 
          duration: 0.4,
          ease: [0.25, 0.1, 0.25, 1], // Плавный cubic-bezier
        } 
      },
      exit: { 
        y: "100%",
        opacity: 1,
        filter: "none",
        scale: 1,
        // Убираем transform здесь, чтобы избежать конфликта с y
        willChange: "transform",
        transition: {
          // Используем более плавную и чуть более долгую анимацию
          type: "tween",
          duration: 0.35, // Увеличиваем длительность для плавности
          ease: "easeIn", // Используем стандартную ease-функцию для лучшей совместимости
        }
      }
    };
  }, []);

  // Варианты анимаций для выдвижного контейнера (десктопная версия)
  const desktopDrawerVariants = useMemo(() => {
    console.log('[useAnimationVariants] Создание desktopDrawerVariants');
    return {
      hidden: { 
        scale: 0.95,
        y: 10,
        opacity: 0,
        filter: "blur(2px)",
        transition: {
          type: "spring",
          damping: 25,
          stiffness: 250
        }
      },
      visible: { 
        scale: 1,
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        transition: { 
          type: "spring", 
          damping: 20,
          stiffness: 300,
          mass: 0.8,
          duration: 0.7,
          ease: [0.34, 1.56, 0.64, 1]
        } 
      },
      exit: { 
        scale: 0.95,
        y: 10,
        opacity: 0,
        filter: "blur(2px)",
        transition: {
          duration: 0.3,
          ease: "easeInOut"
        }
      }
    };
  }, []);

  // Варианты анимаций для overlay (мобильная версия)
  const mobileOverlayVariants = useMemo(() => ({
    hidden: { 
      opacity: 0,
      willChange: "opacity"
    },
    visible: { 
      opacity: 1,
      willChange: "opacity",
      transition: { 
        duration: 0.3, // Ускоряем для мобильной версии
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0,
      willChange: "opacity",
      transition: { 
        duration: 0.2
      }
    }
  }), []);

  // Варианты анимаций для overlay (десктопная версия)
  const desktopOverlayVariants = useMemo(() => ({
    hidden: { 
      opacity: 0
    },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1]
      }
    },
    exit: { 
      opacity: 0,
      transition: { 
        duration: 0.5,
        delay: 0.1
      }
    }
  }), []);

  // Используем правильные варианты в зависимости от устройства
  const drawerVariants = useMemo(() => {
    const isCurrentMobile = windowWidth <= 768;
    console.log(`[useAnimationVariants] Выбор drawerVariants: реальная ширина=${windowWidth}, isMobile=${isMobile}, isCurrentMobile=${isCurrentMobile}`);
    const selectedVariants = isCurrentMobile ? mobileDrawerVariants : desktopDrawerVariants;
    console.log(`[useAnimationVariants] Выбраны варианты: ${isCurrentMobile ? 'МОБИЛЬНЫЕ' : 'ДЕСКТОПНЫЕ'}`);
    return selectedVariants;
  }, [windowWidth, isMobile, mobileDrawerVariants, desktopDrawerVariants]);

  // Используем правильные варианты overlay в зависимости от устройства
  const overlayVariants = useMemo(() => 
    isMobile ? mobileOverlayVariants : desktopOverlayVariants, 
  [isMobile, mobileOverlayVariants, desktopOverlayVariants]);

  // Варианты анимаций для модального окна с подсказкой
  const infoModalVariants = useMemo(() => ({
    hidden: { 
      opacity: 0,
      scale: 0.9,
      y: 10
    },
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { 
        type: "spring", 
        damping: 30,
        stiffness: 350,
        willChange: "transform, opacity"
      } 
    },
    exit: { 
      opacity: 0,
      scale: 0.9,
      y: 10,
      transition: { 
        duration: 0.15,
        willChange: "transform, opacity"
      }
    }
  }), []);

  // Варианты анимаций для карточек
  const cardVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({ 
      opacity: 1, 
      y: 0, 
      transition: { 
        delay: i * 0.03,
        duration: 0.2,
        willChange: "transform, opacity"
      } 
    }),
    hover: { 
      scale: 1.02,
      boxShadow: "0 6px 15px rgba(255, 95, 31, 0.15)",
      transition: { 
        duration: 0.15,
        willChange: "transform, box-shadow"
      } 
    },
    tap: { 
      scale: 0.98,
      transition: { 
        willChange: "transform"
      }
    }
  }), []);

  // Варианты анимаций для заголовка модального окна
  const titleVariants = useMemo(() => ({
    hidden: { 
      opacity: 0, 
      y: 10 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: 0.1, 
        duration: 0.5 
      }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      transition: { 
        duration: 0.3 
      }
    }
  }), []);

  // Варианты анимаций для кнопки закрытия
  const closeButtonVariants = useMemo(() => ({
    hidden: { 
      opacity: 0, 
      scale: 0.5, 
      rotate: -45 
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      rotate: 0,
      transition: { 
        delay: 0.3, 
        duration: 0.4, 
        ease: [0.34, 1.56, 0.64, 1] 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.5,
      transition: { 
        duration: 0.2 
      }
    }
  }), []);

  return {
    drawerVariants,
    overlayVariants,
    infoModalVariants,
    cardVariants,
    titleVariants,
    closeButtonVariants,
    mobileDrawerVariants,
    desktopDrawerVariants,
    mobileOverlayVariants,
    desktopOverlayVariants,
    _isMobile: isMobile,
    _windowWidth: windowWidth
  };
} 