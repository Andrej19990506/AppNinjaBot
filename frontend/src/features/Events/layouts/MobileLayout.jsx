import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RotateDevice from '../common/RotateDevice/RotateDevice';
import Footer from '../common/Footer/Footer';
import StepIndicator from './StepIndicator';
import styles from './MobileLayout.module.css';
import PropTypes from 'prop-types';
import { useTheme } from '../../contexts/ThemeContext';

const steps = [
    { id: 1, title: 'Описание', subtitle: 'Добавьте описание события' },
    { id: 2, title: 'Дата и время', subtitle: 'Выберите дату и время' },
    { id: 3, title: 'Повторение', subtitle: 'Настройте повторение' },
    { id: 4, title: 'Уведомления', subtitle: 'Добавьте уведомления' },
    { id: 5, title: 'Выбор чатов', subtitle: 'Выберите чаты для отправки' }
];

const MobileLayout = ({ children, currentStep, onStepChange, isLoading, canProceed, onSubmit }) => {
    const { theme } = useTheme();
    const [isLandscape, setIsLandscape] = useState(false);
    const [completedSteps, setCompletedSteps] = useState([]);

    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    useEffect(() => {
        document.body.classList.add('fullscreen-mode');
        return () => {
            document.body.classList.remove('fullscreen-mode');
        };
    }, []);

    // Отслеживаем завершенные шаги
    useEffect(() => {
        if (canProceed) {
            // Если текущий шаг валиден, добавляем его в завершенные
            setCompletedSteps(prev => {
                const newSteps = prev.filter(step => step !== currentStep);
                return [...newSteps, currentStep].sort((a, b) => a - b);
            });
        } else {
            // Если текущий шаг стал невалидным, удаляем его и все последующие шаги
            setCompletedSteps(prev => prev.filter(step => step < currentStep));
        }
    }, [canProceed, currentStep]);

    // Проверяем, можно ли отправить форму
    const canSubmitForm = useMemo(() => {
        // Проверяем, что все шаги завершены
        const allStepsCompleted = steps.every(step => completedSteps.includes(step.id));
        // И находимся на последнем шаге
        return allStepsCompleted && currentStep === steps.length;
    }, [completedSteps, currentStep]);

    if (isLandscape) {
        return <RotateDevice />;
    }

    return (
        <div className={styles.mobileLayout}>
            <StepIndicator 
                steps={steps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                canProceed={canProceed}
                onStepClick={onStepChange}
                onSubmit={onSubmit}
            />

            <div className={styles.stepTitleContainer}>
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={`title-${currentStep}`}
                        className={styles.stepTitle}
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 50, opacity: 0 }}
                    >
                        <h2>{steps[currentStep - 1]?.title}</h2>
                        <p className={styles.stepSubtitle}>
                            {steps[currentStep - 1]?.subtitle}
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className={styles.mainContainer}>
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={`content-${currentStep}`}
                        className={styles.contentContainer}
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 30 
                        }}
                    >
                        <div className={styles.contentWrapper}>
                            {children}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            <Footer 
                onSubmit={onSubmit}
                canSubmit={canSubmitForm}
            />
        </div>
    );
};

MobileLayout.propTypes = {
    children: PropTypes.node.isRequired,
    currentStep: PropTypes.number.isRequired,
    onStepChange: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
    canProceed: PropTypes.bool,
    onSubmit: PropTypes.func
};

export default MobileLayout; 