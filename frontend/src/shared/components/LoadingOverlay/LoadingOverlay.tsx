import React from 'react';
import { motion, AnimatePresence } from 'framer-motion'; 
import styles from './LoadingOverlay.module.css';

interface LoadingOverlayProps {
  isLoading: boolean;
}

const overlayVariants = {
  initial: {
    opacity: 1,
    x: 0,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0 }
  },
  exit: {
    x: "-100%", // Анимация выезда влево
    opacity: 0,
    transition: { duration: 0.3, ease: "easeIn" }
  }
};

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
  return (
    // AnimatePresence управляет появлением/исчезновением motion.div
    // @ts-ignore // Игнорируем ошибку TS2786 для внутренней AnimatePresence
    <AnimatePresence>
      {isLoading && ( // Рендерим только если isLoading === true
        <motion.div 
          className={styles.overlay} // Основной класс для фона/позиционирования
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Возвращаем контейнер для точек */}
          <div className={styles.dotsContainer}>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
            <span className={styles.dot}></span>
          </div>
          {/* Убираем Player
          <Player
            autoplay={true}
            loop={true}
            src={animationUrl}
            className={styles.lottieAnimation}
          />
          */}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay; 