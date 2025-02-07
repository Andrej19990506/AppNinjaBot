import React from 'react';
import { CircularProgress } from '@mui/material';
import styles from './LoadingSpinner.module.css';

const LoadingSpinner = ({ text = 'Загрузка...' }) => {
    return (
        <div className={styles.loadingContainer}>
            <CircularProgress size={40} className={styles.loader} />
            <p className={styles.text}>{text}</p>
        </div>
    );
};

export default LoadingSpinner; 