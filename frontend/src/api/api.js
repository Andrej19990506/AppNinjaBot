import axios from 'axios';
import config from '../config';

const api = axios.create({
    baseURL: config.API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Добавляем поддержку credentials
});

// Добавляем интерцептор для обработки ошибок
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        return Promise.reject(error);
    }
);

// ... rest of the code ... 