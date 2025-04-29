import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const EventItem = ({ event, onDelete }) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const x = useMotionValue(0);
    const opacity = useTransform(x, [0, 100], [0, 1]);
    const background = useTransform(
        x,
        [0, 100, 100],
        ['transparent', 'var(--error-transparent)', 'var(--error-color)']
    );

    // Функция для вибрации
    const vibrate = (pattern) => {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    const handleDragEnd = (event, info) => {
        if (info.offset.x > 100) {
            setIsConfirming(true);
            // Короткая вибрация при достижении порога
            vibrate(30);
        } else {
            x.set(0);
            // Очень короткая вибрация при отмене
            vibrate(10);
        }
    };

    const handleConfirmDelete = async () => {
        // Короткая вибрация при удалении
        vibrate(30);
        setIsDeleting(true);
        try {
            setIsVisible(false);
            await new Promise(resolve => setTimeout(resolve, 600));
            await onDelete(event.id);
        } catch (error) {
            setIsDeleting(false);
            setIsConfirming(false);
            setIsVisible(true);
            x.set(0);
        }
    };

    const handleCancelDelete = () => {
        // Очень короткая вибрация при отмене
        vibrate(10);
        setIsConfirming(false);
        x.set(0);
    };

    // Убираем промежуточную вибрацию при движении
    useEffect(() => {
        const unsubscribe = x.onChange(latest => {
            // Убрали вибрацию при движении
        });
        return () => unsubscribe();
    }, [x]);

    const isActive = event.scheduling_status?.active;
    const notificationCount = event.notifications?.length || 0;

    // Загрузку ставим в false, т.к. useChats удален
    const loading = false;
    // chatNames делаем пустым объектом
    const chatNames = {};

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    className="eventItem"
                    initial={{ opacity: 1, x: 0 }}
                    exit={{ 
                        x: [0, 20, -400],
                        scale: [1, 1.1, 1],
                        transition: {
                            duration: 0.6,
                            times: [0, 0.3, 1],
                            ease: [0.32, 0, 0.67, 0],
                            scale: {
                                times: [0, 0.4, 1],
                                ease: "easeInOut"
                            }
                        }
                    }}
                >
                    <motion.div 
                        className="deleteBackground"
                        style={{ opacity, background }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </motion.div>
                    <motion.div 
                        className="content"
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.6}
                        onDragEnd={handleDragEnd}
                        style={{ x }}
                    >
                        {isConfirming ? (
                            <motion.div 
                                className="confirmDelete"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                {isDeleting ? (
                                    <div className="checkCircle">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : (
                                    <>
                                        <h3>Удалить событие?</h3>
                                        <div className="confirmButtons">
                                            <button 
                                                className="confirmButton delete"
                                                onClick={handleConfirmDelete}
                                            >
                                                Удалить
                                            </button>
                                            <button 
                                                className="confirmButton cancel"
                                                onClick={handleCancelDelete}
                                            >
                                                Отмена
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        ) : (
                            <>
                                <div className={`statusBorder ${isActive ? 'active' : ''}`} />
                                <div className="content">
                                    <div className={`statusIcon ${isActive ? 'active' : ''}`}>
                                        {isActive ? (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="info">
                                        <div className="description">{event.description}</div>
                                        <div className="details">
                                            <span className="date">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                </svg>
                                                {format(new Date(event.date), 'dd MMM yyyy HH:mm', { locale: ru })}
                                            </span>
                                            <span className={`status ${isActive ? 'active' : ''}`}>
                                                {isActive ? 'Активно' : 'Не активно'}
                                            </span>
                                        </div>
                                        {event.chat_ids && (
                                            <div className="tags">
                                                {event.chat_ids.map((chatId, index) => (
                                                    <span key={chatId} className="chatTag">
                                                        {loading ? '...' : chatNames[chatId]?.replace('Чат ', '')}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {event.repeat && event.repeat.type !== 'none' && (
                                            <div>Повтор: {event.repeat.type}</div>
                                        )}
                                    </div>
                                    <div className="actions">
                                        {notificationCount > 0 && <div>Уведомлений: {notificationCount}</div>}
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EventItem;