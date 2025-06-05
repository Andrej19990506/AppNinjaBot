import React, { useEffect, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import styles from '@/features/WriteOff/EmptyWriteOff.module.css';

interface EmptyWriteOffProps {
    branchName: string;
    onCreateWriteOff: () => void;
}

const EmptyWriteOff: React.FC<EmptyWriteOffProps> = ({ branchName, onCreateWriteOff }) => {
    const iconControls = useAnimation();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Оптимизированная анимация пульсации для иконки
        iconControls.start({
            scale: [1, 1.03, 1],
            transition: {
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
            }
        });
    }, [iconControls]);

    const handleIconHover = useCallback(() => {
        iconControls.start({
            rotate: [0, -5, 5, -3, 3, 0],
            transition: { duration: 0.3 }
        });
    }, [iconControls]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={styles.emptyWriteOffContainer}
            ref={containerRef}
            layoutId="emptyWriteOff"
        >
            {/* Плавающие частицы */}
            <div className={styles.particles}>
                <div className={styles.particle}></div>
                <div className={styles.particle}></div>
                <div className={styles.particle}></div>
            </div>

            <motion.div 
                className={styles.emptyStateCard}
                initial={{ y: 10, scale: 0.98, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 30,
                    delay: 0.1
                }}
                layoutId="emptyStateCard"
            >
                <div className={styles.iconContainer}>
                    <div className={styles.rippleEffect}></div>
                    <div className={styles.rippleEffect}></div>
                    <motion.div 
                        className={styles.iconCircle}
                        onClick={onCreateWriteOff}
                        whileTap={{ scale: 0.95 }}
                        animate={iconControls}
                        onHoverStart={handleIconHover}
                    >
                        <AddCircleOutlineIcon className={styles.icon} />
                    </motion.div>
                </div>
                
                <div className={styles.contentContainer}>
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                    >
                        <Typography className={styles.title}>
                            Список пуст
                        </Typography>
                    </motion.div>
                    
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                    >
                        <Typography className={styles.subtitle}>
                            В этом чате еще нет списаний товаров
                        </Typography>
                    </motion.div>
                    
                    <motion.div 
                        className={styles.hintText}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                    >
                        <TouchAppIcon className={styles.hintIcon} />
                        Нажмите на иконку для создания
                    </motion.div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default React.memo(EmptyWriteOff); 