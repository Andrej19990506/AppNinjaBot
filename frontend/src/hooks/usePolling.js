import { useEffect, useRef } from 'react';
import config from '../config';

const usePolling = (callback, interval = 5000, enabled = true) => {
    const timeoutRef = useRef(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const pollData = async () => {
            try {
                await callbackRef.current();
            } catch (error) {
                console.error('Polling error:', error);
            }

            // Планируем следующий запрос
            timeoutRef.current = setTimeout(pollData, interval);
        };

        // Начинаем опрос
        pollData();

        // Очистка при размонтировании
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [interval, enabled]);
};

export default usePolling; 