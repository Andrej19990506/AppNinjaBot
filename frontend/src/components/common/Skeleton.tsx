import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Skeleton.module.css';

interface SkeletonProps {
    variant?: 'text' | 'rectangular' | 'circular';
    width?: string | number;
    height?: string | number;
    className?: string;
    animation?: 'pulse' | 'wave' | 'shimmer';
    children?: React.ReactNode;
    theme?: 'light' | 'dark';
    customColors?: {
        from?: string;
        via?: string;
        to?: string;
    };
    count?: number;
    layout?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({
    variant = 'rectangular',
    width,
    height,
    className,
    animation = 'pulse',
    children,
    theme = 'dark',
    customColors,
    count = 1,
    layout = false
}) => {
    const getDefaultColors = () => {
        if (theme === 'light') {
            return {
                from: 'rgba(255, 255, 255, 0.1)',
                via: 'rgba(255, 255, 255, 0.2)',
                to: 'rgba(255, 255, 255, 0.1)'
            };
        }
        return {
            from: 'rgba(42, 42, 42, 0.8)',
            via: 'rgba(58, 58, 58, 0.8)',
            to: 'rgba(42, 42, 42, 0.8)'
        };
    };

    const colors = customColors || getDefaultColors();

    const getAnimation = () => {
        switch (animation) {
            case 'pulse':
                return {
                    opacity: [0.5, 0.8, 0.5],
                    transition: {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                    }
                };
            case 'wave':
                return {
                    x: ['-100%', '100%'],
                    transition: {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                    }
                };
            case 'shimmer':
                return {
                    background: [
                        `linear-gradient(90deg, ${colors.from} 0%, ${colors.via} 50%, ${colors.to} 100%)`,
                        `linear-gradient(90deg, ${colors.via} 0%, ${colors.to} 50%, ${colors.via} 100%)`,
                        `linear-gradient(90deg, ${colors.to} 0%, ${colors.from} 50%, ${colors.to} 100%)`
                    ],
                    transition: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear"
                    }
                };
            default:
                return {};
        }
    };

    const getSkeletonStyle = () => {
        const baseStyle: React.CSSProperties = {
            width,
            height,
            background: colors.from
        };

        if (variant === 'circular') {
            baseStyle.borderRadius = '50%';
        } else if (variant === 'text') {
            baseStyle.borderRadius = '4px';
            baseStyle.height = height || '1em';
        } else {
            baseStyle.borderRadius = '8px';
        }

        return baseStyle;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: {
                duration: 0.3
            }
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                layout={layout}
                className={styles.flex}
            >
                {Array.from({ length: count }).map((_, index) => (
                    <motion.div
                        key={index}
                        variants={itemVariants}
                        className={`${styles.skeleton} ${styles[variant]} ${className || ''} ${styles[theme]}`}
                        style={getSkeletonStyle()}
                        animate={getAnimation()}
                        layout={layout}
                    >
                        {children}
                    </motion.div>
                ))}
            </motion.div>
        </AnimatePresence>
    );
};

export default Skeleton; 