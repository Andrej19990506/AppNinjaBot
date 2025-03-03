import React from 'react';
import { motion } from 'framer-motion';
import styles from './Skeleton.module.css';

interface SkeletonProps {
    variant?: 'text' | 'rectangular' | 'circular';
    width?: string | number;
    height?: string | number;
    className?: string;
    animation?: 'pulse' | 'wave';
    children?: React.ReactNode;
}

const Skeleton: React.FC<SkeletonProps> = ({
    variant = 'rectangular',
    width,
    height,
    className,
    animation = 'pulse',
    children
}) => {
    const getAnimation = () => {
        if (animation === 'pulse') {
            return {
                opacity: [0.5, 0.8, 0.5]
            };
        }
        return {
            background: [
                'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
                'linear-gradient(90deg, #3a3a3a 0%, #2a2a2a 50%, #3a3a3a 100%)',
                'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)'
            ]
        };
    };

    return (
        <motion.div
            className={`${styles.skeleton} ${styles[variant]} ${className || ''}`}
            style={{ width, height }}
            initial={{ opacity: 0.5 }}
            animate={getAnimation()}
            transition={{
                repeat: Infinity,
                duration: animation === 'pulse' ? 1.5 : 2,
                ease: "linear"
            }}
        >
            {children}
        </motion.div>
    );
};

export default Skeleton; 