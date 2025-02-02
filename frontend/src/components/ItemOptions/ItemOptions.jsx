import React, { useState } from 'react';
import styles from './ItemOptions.module.css';

const ItemOptions = ({ types, values, onChange }) => {
    const [activeItem, setActiveItem] = useState(null);
    const [inputValue, setInputValue] = useState('');

    const handlePlusClick = (type) => {
        setActiveItem({ type, operation: 'add' });
        setInputValue('');
    };

    const handleMinusClick = (type) => {
        setActiveItem({ type, operation: 'subtract' });
        setInputValue('');
    };

    const handleInputChange = (e) => {
        const value = e.target.value.replace(/[^\d]/g, '');
        setInputValue(value);
    };

    const handleSubmit = () => {
        if (!activeItem || !inputValue) return;

        const number = parseInt(inputValue);
        if (number === 0) return;

        const currentValue = values[activeItem.type]?.quantity || 0;
        const newValue = activeItem.operation === 'add' 
            ? currentValue + number 
            : Math.max(0, currentValue - number);

        onChange(activeItem.type, newValue);
        setActiveItem(null);
        setInputValue('');
    };

    return (
        <div className={styles.container}>
            {types.map(type => (
                <div key={type} className={styles.item}>
                    <div className={styles.label}>{type}</div>
                    <div className={styles.content}>
                        <div className={`${styles.value} ${values[type]?.quantity > 0 ? styles.hasValue : ''}`}>
                            {values[type]?.quantity || 0}
                            <div className={styles.indicator}>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path 
                                        d="M5 13l5 5L20 7" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                        </div>
                        {activeItem?.type === type ? (
                            <div className={styles.inputGroup}>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    placeholder={`Введите число для ${activeItem.operation === 'add' ? 'добавления' : 'вычитания'}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSubmit();
                                        }
                                    }}
                                    autoFocus
                                />
                                <button 
                                    className={styles.okButton}
                                    onClick={handleSubmit}
                                >
                                    OK
                                </button>
                            </div>
                        ) : (
                            <div className={styles.buttons}>
                                <button 
                                    className={styles.button}
                                    onClick={() => handlePlusClick(type)}
                                >
                                    +
                                </button>
                                <button 
                                    className={styles.button}
                                    onClick={() => handleMinusClick(type)}
                                >
                                    -
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ItemOptions;
