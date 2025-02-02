import { useState, useCallback } from 'react';
import usePolling from './usePolling';
import config from '../config';

const useChats = () => {
    const [chats, setChats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchChats = useCallback(async () => {
        try {
            const response = await fetch(`${config.API_URL}/chats`);
            if (!response.ok) {
                throw new Error('Failed to fetch chats');
            }
            const data = await response.json();
            setChats(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching chats:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Используем polling для периодического обновления
    usePolling(fetchChats, config.CACHE_DURATION);

    return {
        chats,
        isLoading,
        error,
        refetch: fetchChats
    };
};

export default useChats; 