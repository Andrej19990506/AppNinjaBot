import React, { useState, useEffect, useMemo } from 'react';
import styles from './ItemOptions.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import config from '../../config';
import inventoryService from '../../services/inventoryService';

const ItemOptions = ({ types, values, onChange, selectedCategory, selectedItem }) => {
    console.log('=== ItemOptions рендер ===');
    console.log('Пропсы:', { types, values, selectedCategory, selectedItem });
    console.log('Типы, полученные для отображения:', types);
    
    const [activeItem, setActiveItem] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [localTypes, setLocalTypes] = useState(types);

    // Синхронизируем локальные типы с пропсами
    useEffect(() => {
        setLocalTypes(types);
    }, [types]);
    
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

    const handleAddSemifinished = async () => {
        try {
            console.log('=== handleAddSemifinished начало ===');
            if (!selectedCategory || !selectedItem) {
                console.error('Ошибка: категория или товар не выбраны');
                return;
            }

            setIsAdding(true);
            console.log('Отправка запроса на сервер...');
            console.log('Категория:', selectedCategory);
            console.log('Товар:', selectedItem);
            
            const result = await inventoryService.updateTemplateWithSemifinished(selectedCategory, selectedItem);
            console.log('Ответ сервера:', result);

            if (result.status === 'success' || result.status === 'already_exists') {
                // Сбрасываем кэш шаблона
                await inventoryService.getTemplate(true);
                
                // Инициализируем значение для полуфабриката и сразу обновляем UI
                onChange('semifinished', 0);
                
                // Принудительно обновляем типы
                const newTypes = await getTypes(inventory, selectedCategory, selectedItem);
                setTypes(newTypes);
            }
        } catch (error) {
            console.error('Ошибка при добавлении полуфабриката:', error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteSemifinished = async (type) => {
        if (type === 'semifinished') {
            try {
                // Удаляем полуфабрикат из текущей инвентаризации
                onChange('semifinished', 0);
                
                // Удаляем полуфабрикат из шаблона
                await inventoryService.removeSemifinishedFromTemplate(selectedCategory, selectedItem);
                
                // Сбрасываем кэш шаблона
                await inventoryService.getTemplate(true);
                
                // Обновляем локальные типы, убирая semifinished
                const newTypes = types.filter(t => t !== 'semifinished');
                setLocalTypes(newTypes);
                
                // Удаляем поле semifinished из values
                if (values.semifinished) {
                    delete values.semifinished;
                }
            } catch (error) {
                console.error('Ошибка при удалении полуфабриката:', error);
            }
        }
    };

    return (
        <div className={styles.container}>
            {/* Отладочная информация */}
            {localTypes.map(type => (
                <div key={type} className={styles.item}>
                    {type === 'semifinished' && (
                        <motion.button
                            className={styles.deleteButton}
                            onClick={() => handleDeleteSemifinished(type)}
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            >
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </motion.button>
                    )}
                    <div className={styles.label}>
                        {type === 'semifinished' ? 'Полуфабрикат' : 'Сырье'}
                    </div>
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
            
            {/* Кнопка добавления полуфабриката */}
            {!localTypes.includes('semifinished') && (
                <motion.button
                    className={styles.addSemifinishedButton}
                    onClick={handleAddSemifinished}
                    disabled={isAdding}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.div
                        className={styles.plusIcon}
                        animate={isAdding ? { rotate: 180 } : { rotate: 0 }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <motion.path
                                d="M12 5v14M5 12h14"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5 }}
                            />
                        </svg>
                    </motion.div>
                    Добавить полуфабрикат
                </motion.button>
            )}
        </div>
    );
};

export default ItemOptions;
