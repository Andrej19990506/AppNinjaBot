import React, { useState, useEffect } from 'react';
import styles from './NotesModal.module.css';

interface NotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    notes: string;
    onSave: (notes: string) => void;
    onDelete: () => void;
    itemName: string;
}

const NotesModal: React.FC<NotesModalProps> = ({
    isOpen,
    onClose,
    notes,
    onSave,
    onDelete,
    itemName
}) => {
    const [editedNotes, setEditedNotes] = useState(notes);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEditedNotes(notes);
            setHasChanges(false);
        }
    }, [isOpen, notes]);

    const handleNotesChange = (value: string) => {
        setEditedNotes(value);
        setHasChanges(value !== notes);
    };

    const handleSave = () => {
        onSave(editedNotes);
        setHasChanges(false);
        onClose();
    };

    const handleCancel = () => {
        setEditedNotes(notes);
        setHasChanges(false);
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm('Вы уверены, что хотите удалить заметки для этого товара?')) {
            onDelete();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modal}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        <svg 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10,9 9,9 8,9"/>
                        </svg>
                        Заметки для товара
                    </h3>
                    <button className={styles.closeButton} onClick={handleCancel}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.itemName}>
                        <strong>{itemName}</strong>
                    </div>
                    
                    <div className={styles.textareaContainer}>
                        <textarea
                            className={styles.textarea}
                            value={editedNotes}
                            onChange={(e) => handleNotesChange(e.target.value)}
                            placeholder="Оставляйте заметки для товара... Например: в цельной упаковке 720 шт, срок годности 30 дней, хранить в холодильнике..."
                            rows={6}
                            autoFocus
                        />
                        <div className={styles.characterCount}>
                            {editedNotes.length} символов
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.leftButtons}>
                        <button 
                            className={styles.deleteButton}
                            onClick={handleDelete}
                            disabled={!notes.trim()}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Удалить
                        </button>
                    </div>
                    
                    <div className={styles.rightButtons}>
                        <button 
                            className={styles.cancelButton}
                            onClick={handleCancel}
                        >
                            Отменить
                        </button>
                        <button 
                            className={styles.saveButton}
                            onClick={handleSave}
                            disabled={!hasChanges}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17,21 17,13 7,13 7,21"/>
                                <polyline points="7,3 7,8 15,8"/>
                            </svg>
                            Сохранить
                        </button>
                    </div>
                </div>
        </div>
    );
};

export default NotesModal;
