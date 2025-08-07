import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '@shared/store/userSlice/userSelectors';
import SlidingDrawer from '../SlidingDrawer/SlidingDrawer';
import styles from './AwayOverlay.module.css';

interface AwayOverlayProps {
  isVisible: boolean;
  onContinue: () => void;
}

const AwayOverlay: React.FC<AwayOverlayProps> = ({ isVisible, onContinue }) => {
  const user = useSelector(selectUser);
  const [showContent, setShowContent] = useState(false);

  // Отладочная информация только при изменении состояния
  useEffect(() => {
    console.log('😴 [AwayOverlay] Состояние изменилось:', { isVisible, showContent });
  }, [isVisible, showContent]);

  useEffect(() => {
    if (isVisible) {
      console.log('😴 [AwayOverlay] Показываем заставку');
      setShowContent(true);
    } else {
      console.log('😴 [AwayOverlay] Скрываем заставку');
      setShowContent(false);
    }
  }, [isVisible]);

  // Если не видим, не рендерим ничего
  if (!isVisible) {
    return null;
  }

  console.log('😴 [AwayOverlay] Рендерим заставку');

  return (
    <AnimatePresence mode="wait">
      <SlidingDrawer onClose={onContinue}>
        <div className={styles.fullscreenContent}>
          {/* Анимированный фон */}
          <motion.div
            className={styles.backgroundAnimation}
            animate={{
              background: [
                "linear-gradient(135deg, rgba(255, 95, 31, 0.1), rgba(16, 185, 129, 0.1))",
                "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(245, 158, 11, 0.1))",
                "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(255, 95, 31, 0.1))"
              ]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Центральный контент */}
          <div className={styles.centerContent}>
            {/* Иконка отсутствия */}
            <motion.div
              className={styles.iconContainer}
              animate={{
                y: [0, -15, 0],
                rotateY: [0, 8, 0],
                scale: [1, 1.08, 1]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className={styles.icon}>😴</div>
            </motion.div>

            {/* Заголовок */}
            <motion.h1
              className={styles.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            >
              Вы отсутствуете
            </motion.h1>

            {/* Подзаголовок */}
            <motion.p
              className={styles.subtitle}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            >
              {user?.first_name ? `${user.first_name}, ` : ''}вы неактивны уже некоторое время
            </motion.p>

            {/* Кнопка продолжить */}
            <motion.button
              className={styles.continueButton}
              onClick={onContinue}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ 
                scale: 1.05,
                boxShadow: "0 20px 50px rgba(255, 95, 31, 0.4)"
              }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Продолжить работу</span>
              <motion.div
                className={styles.buttonIcon}
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                →
              </motion.div>
            </motion.button>

            {/* Дополнительная информация */}
            <motion.div
              className={styles.info}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              <p>Ваши коллеги видят, что вы отошли</p>
            </motion.div>
          </div>

          {/* Дополнительные декоративные элементы */}
          <div className={styles.decorativeElements}>
            <motion.div
              className={styles.floatingElement}
              animate={{
                y: [0, -20, 0],
                rotate: [0, 5, 0]
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              💤
            </motion.div>
            <motion.div
              className={styles.floatingElement}
              animate={{
                y: [0, -15, 0],
                rotate: [0, -3, 0]
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            >
              🌙
            </motion.div>
          </div>
        </div>
      </SlidingDrawer>
    </AnimatePresence>
  );
};

export default AwayOverlay; 