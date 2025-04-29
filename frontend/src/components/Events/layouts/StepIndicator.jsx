import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './StepIndicator.module.css';

const CheckIcon = () => (
    <motion.svg
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        className={styles.checkIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
    >
        <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            exit={{ pathLength: 0 }}
            transition={{ duration: 0.3 }}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
        />
    </motion.svg>
);

const StepIndicator = ({ steps, currentStep, completedSteps, canProceed, onStepClick, onSubmit }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [wasCollapsed, setWasCollapsed] = useState(false);
    const allStepsCompleted = completedSteps.length === steps.length;

    useEffect(() => {
        if (allStepsCompleted && !isCollapsed) {
            const timer = setTimeout(() => {
                setIsCollapsed(true);
                setWasCollapsed(true);
            }, 300);
            return () => clearTimeout(timer);
        } else if (!allStepsCompleted && isCollapsed) {
            setIsCollapsed(false);
        }
    }, [allStepsCompleted, isCollapsed]);

    const handleDotClick = (stepId) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }
        onStepClick(stepId);
        if (isCollapsed) {
            setIsCollapsed(false);
        }
    };

    const handleFinalClick = () => {
        if (allStepsCompleted) {
            if ('vibrate' in navigator) {
                navigator.vibrate([15, 30, 15]);
            }
        }
    };

    const dotVariants = {
        collapsed: (index) => ({
            x: wasCollapsed ? 0 : index * 24,
            scale: 1,
            opacity: 1,
            transition: { 
                duration: 0.5,
                delay: index * 0.05,
                type: "spring",
                stiffness: 200,
                damping: 20
            }
        }),
        expanded: (index) => ({
            x: 0,
            scale: 1,
            opacity: 1,
            transition: { 
                duration: 0.5,
                delay: index * 0.05,
                type: "spring",
                stiffness: 200,
                damping: 20
            }
        })
    };

    if (isCollapsed) {
        return (
            <motion.div 
                className={styles.finalIndicator}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ 
                    scale: 1,
                    rotate: 0,
                    boxShadow: ["0 0 0 0 rgba(var(--primary-rgb), 0)", "0 0 0 12px rgba(var(--primary-rgb), 0.2)", "0 0 0 0 rgba(var(--primary-rgb), 0)"]
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ 
                    duration: 0.5,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    boxShadow: {
                        duration: 1.5,
                        repeat: Infinity,
                        repeatType: "loop"
                    }
                }}
            >
                <CheckIcon />
            </motion.div>
        );
    }

    return (
        <motion.div 
            className={styles.stepIndicator}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <AnimatePresence mode="wait">
                {steps.map((step, index) => {
                    const isCompleted = completedSteps.includes(step.id);
                    const isActive = currentStep === step.id;
                    const isNext = currentStep + 1 === step.id;
                    const shouldPulse = isNext && canProceed;
                    const showCheck = isCompleted && (!isActive || (isActive && canProceed));

                    return (
                        <motion.div 
                            key={step.id}
                            className={`${styles.stepDot} ${isActive ? styles.active : ''} ${showCheck ? styles.completed : ''}`}
                            onClick={() => handleDotClick(step.id)}
                            custom={index}
                            variants={dotVariants}
                            initial="expanded"
                            animate={isCollapsed ? "collapsed" : "expanded"}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                                boxShadow: shouldPulse 
                                    ? ["0 0 0 0 rgba(var(--primary-rgb), 0)", "0 0 0 6px rgba(var(--primary-rgb), 0.2)", "0 0 0 0 rgba(var(--primary-rgb), 0)"]
                                    : "none"
                            }}
                        >
                            <AnimatePresence mode="wait">
                                {showCheck && (
                                    <CheckIcon key={`check-${step.id}-${canProceed}`} />
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </motion.div>
    );
};

export default React.memo(StepIndicator); 