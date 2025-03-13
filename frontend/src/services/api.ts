import axios from 'axios';
import config from '../config';
import { WriteOffReason, CreateWriteOffData } from '../types/writeOff';
import { socketService } from './socket';

// Создаем инстанс axios с базовыми настройками
const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// API для работы со списаниями
const writeOffApi = {
    // Получение списка чатов
    getWriteOffChats: () => {
        console.log('=== 📡 Запрос списка чатов для списания ===');
        console.log('🔗 URL:', `${config.API_URL}/chats`);
        return axiosInstance.get('/chats');
    },
    
    // Получение данных конкретного чата
    getWriteOffChat: (chatId: string) => {
        console.log('=== 📡 Запрос данных чата ===');
        console.log('🏠 Чат:', chatId);
        return axiosInstance.get(`/chats/${chatId}`);
    },
    
    // Получение списаний для чата (если есть)
    getWriteOffs: (chatId: string) => {
        console.log('=== 📡 Запрос списаний чата ===');
        console.log('🏠 Чат:', chatId);
        console.log('🔗 URL запроса:', `/write-offs/${chatId}`);
        console.log('🔗 Полный URL:', `${config.API_URL}/write-offs/${chatId}`);
        console.log('🔗 BASE URL:', process.env.REACT_APP_API_URL || '/api');
        
        return axiosInstance.get(`/write-offs/${chatId}`).catch(error => {
            // Если списаний нет (404), возвращаем пустой массив
            if (error.response?.status === 404) {
                console.log('ℹ️ Списания не найдены (404), возвращаем пустой массив');
                return { data: [] };
            }
            console.error('❌ Ошибка при запросе списаний:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        });
    },
    
    // Создание списания
    createWriteOff: (chatId: string, data: any) => {
        console.log('=== 📡 Создание списания ===');
        console.log('🏠 Чат:', chatId);
        console.log('📝 Данные:', data);

        // Пробуем сначала через WebSocket
        if (socketService.isConnected()) {
            console.log('🔌 Используем WebSocket для создания списания');
            
            // Для WebSocket-соединения мы будем использовать промис, который резолвится вручную
            return new Promise((resolve, reject) => {
                // Флаг для предотвращения двойного вызова resolve/reject
                let isResolved = false;
                
                // Обработчик успешного создания списания
                const successHandler = (response: any) => {
                    console.log('✅ Ответ WebSocket (создание):', response);
                    
                    // Предотвращаем дублирование ответа
                    if (isResolved) return;
                    isResolved = true;
                    
                    // Отписываемся от событий
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    
                    // Возвращаем созданное списание
                    resolve(response.writeOffItem);
                };
                
                // Обработчик ошибки создания списания
                const errorHandler = (error: any) => {
                    console.error('❌ Ошибка WebSocket при создании списания:', error);
                    
                    // Предотвращаем дублирование ответа
                    if (isResolved) return;
                    isResolved = true;
                    
                    // Отписываемся от событий
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    
                    // Отклоняем промис
                    reject(error);
                };
                
                // Подписываемся на события
                socketService.subscribe('writeoff_update_sent', successHandler);
                socketService.subscribe('writeoff_update_error', errorHandler);
                
                // Отправляем событие
                socketService.emit('writeoff_update', {
                    action: 'create',
                    chatId: chatId,
                    writeOffItem: {
                        name: data.name,
                        reason: data.reason,
                        quantity: data.quantity,
                        description: data.description || '',
                        unitType: data.unitType || 'шт'
                    }
                }).then(success => {
                    if (!success && !isResolved) {
                        console.error('❌ Не удалось отправить сообщение через WebSocket');
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                }).catch(error => {
                    if (!isResolved) {
                        console.error('❌ Ошибка при отправке через WebSocket:', error);
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                });
                
                // Функция для fallback на REST API
                const fallbackToREST = () => {
                    console.log('⚠️ Fallback на REST API...');
                    axiosInstance.post(`/write-offs/${chatId}`, {
                        name: data.name,
                        reason: data.reason,
                        quantity: data.quantity,
                        description: data.description || '',
                        unitType: data.unitType || 'шт'
                    }).then(response => {
                        resolve(response.data);
                    }).catch(error => {
                        reject(error);
                    });
                };
                
                // Увеличиваем таймаут до 10 секунд
                setTimeout(() => {
                    if (!isResolved) {
                        console.warn('⚠️ Timeout на ожидание ответа от WebSocket');
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                }, 10000); // 10 секунд вместо 5
            });
        } else {
            console.log('📡 Используем REST API для создания списания');
            
            // Если WebSocket не подключен, используем REST API
            return axiosInstance.post(`/write-offs/${chatId}`, {
                name: data.name,
                reason: data.reason,
                quantity: data.quantity,
                description: data.description || '',
                unitType: data.unitType || 'шт'
            }).then(response => response.data);
        }
    },
    
    // Обновление списания
    updateWriteOff: (chatId: string, writeOffId: string, data: any) => {
        console.log('=== 📡 Обновление списания ===');
        console.log('🏠 Чат:', chatId);
        console.log('📝 ID списания:', writeOffId);
        console.log('📝 Данные:', data);

        // Пробуем сначала через WebSocket
        if (socketService.isConnected()) {
            console.log('🔌 Используем WebSocket для обновления списания');
            
            // Для WebSocket-соединения мы будем использовать промис, который резолвится вручную
            return new Promise((resolve, reject) => {
                // Флаг для предотвращения двойного вызова resolve/reject
                let isResolved = false;
                
                // Обработчик успешного обновления списания
                const successHandler = (response: any) => {
                    console.log('✅ Ответ WebSocket (обновление):', response);
                    
                    // Предотвращаем дублирование ответа
                    if (isResolved) return;
                    isResolved = true;
                    
                    // Отписываемся от событий
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    
                    // Возвращаем обновленное списание
                    resolve(response.writeOffItem);
                };
                
                // Обработчик ошибки обновления списания
                const errorHandler = (error: any) => {
                    console.error('❌ Ошибка WebSocket при обновлении списания:', error);
                    
                    // Предотвращаем дублирование ответа
                    if (isResolved) return;
                    isResolved = true;
                    
                    // Отписываемся от событий
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    
                    // Отклоняем промис
                    reject(error);
                };
                
                // Подписываемся на события
                socketService.subscribe('writeoff_update_sent', successHandler);
                socketService.subscribe('writeoff_update_error', errorHandler);
                
                // Отправляем событие
                socketService.emit('writeoff_update', {
                    action: 'update',
                    chatId: chatId,
                    writeOffId: writeOffId,
                    writeOffItem: {
                        name: data.name,
                        reason: data.reason,
                        quantity: data.quantity,
                        description: data.description || '',
                        unitType: data.unitType || 'шт'
                    }
                }).then(success => {
                    if (!success && !isResolved) {
                        console.error('❌ Не удалось отправить сообщение через WebSocket');
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                }).catch(error => {
                    if (!isResolved) {
                        console.error('❌ Ошибка при отправке через WebSocket:', error);
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                });
                
                // Функция для fallback на REST API
                const fallbackToREST = () => {
                    console.log('⚠️ Fallback на REST API...');
                    axiosInstance.put(`/write-offs/${chatId}/${writeOffId}`, {
                        name: data.name,
                        reason: data.reason,
                        quantity: data.quantity,
                        description: data.description || '',
                        unitType: data.unitType || 'шт'
                    }).then(response => {
                        resolve(response.data);
                    }).catch(error => {
                        reject(error);
                    });
                };
                
                // Увеличиваем таймаут до 10 секунд
                setTimeout(() => {
                    if (!isResolved) {
                        console.warn('⚠️ Timeout на ожидание ответа от WebSocket');
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                }, 10000); // 10 секунд вместо 5
            });
        } else {
            console.log('📡 Используем REST API для обновления списания');
            
            // Если WebSocket не подключен, используем REST API
            return axiosInstance.put(`/write-offs/${chatId}/${writeOffId}`, {
                name: data.name,
                reason: data.reason,
                quantity: data.quantity,
                description: data.description || '',
                unitType: data.unitType || 'шт'
            }).then(response => response.data);
        }
    },
    
    // Удаление списания
    deleteWriteOff: (chatId: string, writeOffId: string) => {
        console.log('=== 📡 Удаление списания ===');
        console.log('🏠 Чат:', chatId);
        console.log('📝 ID списания:', writeOffId);
        console.log('🔗 URL запроса:', `${config.API_URL}/write-offs/${chatId}/${writeOffId}`);
        
        // Пробуем сначала через WebSocket
        if (socketService.isConnected()) {
            console.log('🔌 Используем WebSocket для удаления списания');
            
            // Для WebSocket-соединения мы будем использовать промис, который резолвится вручную
            return new Promise((resolve, reject) => {
                // Флаг для предотвращения двойного вызова resolve/reject
                let isResolved = false;
                
                // Обработчик успешного удаления списания
                const successHandler = (response: any) => {
                    console.log('✅ Ответ WebSocket (удаление):', response);
                    
                    // Предотвращаем дублирование ответа
                    if (isResolved) return;
                    isResolved = true;
                    
                    // Отписываемся от событий
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    
                    // Возвращаем результат
                    resolve({ success: true });
                };
                
                // Обработчик ошибки удаления списания
                const errorHandler = (error: any) => {
                    console.error('❌ Ошибка WebSocket при удалении списания:', error);
                    
                    // Предотвращаем дублирование ответа
                    if (isResolved) return;
                    isResolved = true;
                    
                    // Отписываемся от событий
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    
                    // Отклоняем промис
                    reject(error);
                };
                
                // Подписываемся на события
                socketService.subscribe('writeoff_update_sent', successHandler);
                socketService.subscribe('writeoff_update_error', errorHandler);
                
                // Отправляем событие
                socketService.emit('writeoff_update', {
                    action: 'delete',
                    chatId: chatId,
                    writeOffId: writeOffId
                }).then(success => {
                    if (!success && !isResolved) {
                        console.error('❌ Не удалось отправить сообщение через WebSocket');
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                }).catch(error => {
                    if (!isResolved) {
                        console.error('❌ Ошибка при отправке через WebSocket:', error);
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                });
                
                // Функция для fallback на REST API
                const fallbackToREST = () => {
                    console.log('⚠️ Fallback на REST API...');
                    axiosInstance.delete(`/write-offs/${chatId}/${writeOffId}`)
                        .then(response => {
                            console.log('✅ Ответ сервера при удалении:', {
                                status: response.status,
                                data: response.data
                            });
                            resolve({ success: true });
                        }).catch(error => {
                            reject(error);
                        });
                };
                
                // Увеличиваем таймаут до 10 секунд
                setTimeout(() => {
                    if (!isResolved) {
                        console.warn('⚠️ Timeout на ожидание ответа от WebSocket');
                        isResolved = true;
                        
                        // Отписываемся от событий
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        
                        // Fallback на REST API
                        fallbackToREST();
                    }
                }, 10000); // 10 секунд вместо 5
            });
        } else {
            console.log('📡 Используем REST API для удаления списания');
            
            // Если WebSocket не подключен, используем REST API
            return axiosInstance.delete(`/write-offs/${chatId}/${writeOffId}`)
                .then(response => {
                    console.log('✅ Ответ сервера при удалении:', {
                        status: response.status,
                        data: response.data
                    });
                    return { success: true };
                });
        }
    }
};

// История инвентаря
const historyApi = {
    getItemHistory: async (chatId: string, itemId: string, category: string, itemName: string) => {
        console.log('=== 📡 Запрос истории ===');
        console.log('🏠 Чат:', chatId);
        console.log('📦 Товар:', itemName);
        console.log('📑 Категория:', category);
        console.log('🆔 ID товара:', itemId);
        
        const url = `/item_history/${chatId}/${encodeURIComponent(category)}/${encodeURIComponent(itemName)}`;
        console.log('🔗 URL запроса:', url);
        console.log('🔗 Полный URL:', `${config.API_URL}${url}`);
        
        return axiosInstance.get(url);
    },

    addHistoryRecord: async (chatId: string, itemId: string, data: {
        action: string;
        type: 'raw' | 'semifinished';
        quantity: number;
        oldQuantity: number;
        newQuantity: number;
    }) => {
        return axiosInstance.post(`/item_history/${chatId}`, data);
    },

    getHistoryByDateRange: async (chatId: string, itemId: string, startDate: string, endDate: string) => {
        return axiosInstance.get(`/item_history/${chatId}/range`, {
            params: { startDate, endDate }
        });
    }
};

// Пользователи
const userApi = {
    getCurrentUser: () => {
        console.log('=== 📡 Запрос данных пользователя ===');
        console.log('🔗 URL:', `${config.API_URL}/users/me`);
        return axiosInstance.get('/users/me');
    }
};

// Интерцептор для логирования запросов
axiosInstance.interceptors.request.use(
    config => {
        console.log('🚀 API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            fullURL: `${config.baseURL}${config.url}`,
            data: config.data
        });
        return config;
    },
    error => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ошибок
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw error;
    }
);

// Экспортируем API
export const api = {
    writeOff: writeOffApi,
    history: historyApi,
    user: userApi
}; 