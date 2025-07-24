import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface VictoryDescriptionModalProps {
    open: boolean;
    initialValue?: string;
    onSave: (desc: string) => void;
    onCancel: () => void;
}

const ModalOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
`;

const ModalWindow = styled(motion.div)`
    background: var(--card-background);
    border-radius: var(--radius);
    padding: 28px 24px 20px 24px;
    max-width: 480px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    align-items: stretch;
`;

const ModalTitle = styled.div`
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 18px;
    text-align: center;
`;

const TextArea = styled.textarea`
    width: 100%;
    min-height: 120px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    padding: 12px;
    font-size: 1rem;
    color: var(--text-color);
    background: var(--background-light);
    resize: vertical;
    margin-bottom: 18px;
`;

const ModalActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' }>`
    padding: 10px 20px;
    border-radius: var(--radius);
    border: 1px solid var(--primary-color);
    background: ${props => props.variant === 'primary' ? 'var(--primary-color)' : 'transparent'};
    color: ${props => props.variant === 'primary' ? 'white' : 'var(--primary-color)'};
    cursor: pointer;
    font-weight: 500;
    transition: all var(--transition-fast);
    &:hover {
        background: ${props => props.variant === 'primary' ? 'var(--primary-hover)' : 'var(--primary-transparent)'};
    }
`;

const VictoryDescriptionModal: React.FC<VictoryDescriptionModalProps> = ({ open, initialValue = '', onSave, onCancel }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue, open]);

    const handleSave = () => {
        onSave(value);
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <ModalOverlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onCancel}
                >
                    <ModalWindow
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <ModalTitle>Описание победы</ModalTitle>
                        <TextArea
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder="Введите описание победы..."
                        />
                        <ModalActions>
                            <Button onClick={onCancel}>Отмена</Button>
                            <Button variant="primary" onClick={handleSave}>Сохранить</Button>
                        </ModalActions>
                    </ModalWindow>
                </ModalOverlay>
            )}
        </AnimatePresence>
    );
};

export default VictoryDescriptionModal; 