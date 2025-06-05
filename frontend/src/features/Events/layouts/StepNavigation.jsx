import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StepNavigation.module.css';

const StepNavigation = ({ currentStep, totalSteps, onNext, onBack }) => {
    const navigate = useNavigate();

    const handleNavigation = (direction) => {
        // Вибрация при навигации
        if ('vibrate' in navigator) {
            if (direction === 'next') {
                // Короткая вибрация при движении вперед
                navigator.vibrate([30]);
            } else {
                // Двойная вибрация при движении назад
                navigator.vibrate([20, 40, 20]);
            }
        }

        if (direction === 'next') {
            if (currentStep < totalSteps) {
                onNext();
            } else {
                // Длинная вибрация при завершении
                if ('vibrate' in navigator) {
                    navigator.vibrate([50, 30, 50]);
                }
                navigate('/events');
            }
        } else {
            if (currentStep > 1) {
                onBack();
            } else {
                // Вибрация при отмене
                if ('vibrate' in navigator) {
                    navigator.vibrate([40, 60, 40]);
                }
                navigate('/events');
            }
        }
    };

    return (
        <div className={styles.navigation}>
            <button 
                className={`${styles.navButton} ${styles.backButton}`}
                onClick={() => handleNavigation('back')}
                aria-label="Назад"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
            </button>
            <button 
                className={`${styles.navButton} ${styles.nextButton}`}
                onClick={() => handleNavigation('next')}
                aria-label="Далее"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>
        </div>
    );
};

export default React.memo(StepNavigation); 