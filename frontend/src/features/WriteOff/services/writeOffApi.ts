import { axiosInstance } from '@/shared/api/api';
import { socketService } from '@/shared/services/socketService';
import { AxiosResponse } from 'axios';
import { convertLocalDateToUTC, convertUTCDateToLocal } from '@/shared/utils/dateUtils';

// Типы для инвентаря
export interface InventoryItem {
    name: string;
    category: string;
}

export interface InventoryTemplateResponse {
    success: boolean;
    items?: InventoryItem[];
    total_count?: number;
    categories?: string[];
    error?: string;
}

const emitSocketEvent = (event: string, data: any): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!socketService.isConnected()) {
            console.warn('⚠️ Socket not connected for event:', event);
            resolve(false);
            return;
        }
        socketService.emitWithAck(event, data, (response: any) => {
            if (response && response.error) {
                console.error('❌ Socket event error:', response.error);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

export const WriteOffApi = {
    getWriteOffChats: (userId: number, groupType: string) => {
        return axiosInstance.get('/v1/groups/chats', {
            params: {
                user_id: userId,
                group_type: groupType
            }
        });
    },
    getWriteOffChat: (group_id: string) => {
        return axiosInstance.get(`/v1/chats/${group_id}`);
    },
    getWriteOffs: (group_id: string, date?: string) => {
        const params: { _t: number; date?: string } = {
            _t: Date.now()
        };
        
        // Конвертируем локальную дату в UTC дату для поиска в БД
        if (date) {
            params.date = convertLocalDateToUTC(date);
        }
        
        console.log('🔍 [getWriteOffs] Параметры запроса:', {
            group_id,
            originalDate: date,
            convertedDate: params.date,
            params,
            finalUrl: `/v1/write-offs/${group_id}`,
            queryString: new URLSearchParams(params as any).toString()
        });
        
        return axiosInstance.get(`/v1/write-offs/${group_id}`, {
            params
        })
            .then((response: AxiosResponse<any>) => {
                console.log('🔍 [getWriteOffs] Raw response:', {
                    status: response.status,
                    data: response.data,
                    headers: response.headers,
                    dataType: typeof response.data,
                    isArray: Array.isArray(response.data),
                    hasGroupIdKey: response.data && response.data[group_id] !== undefined,
                    userAgent: navigator.userAgent,
                    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                    requestConfig: response.config
                });
                
                // Функция для конвертации UTC дат в локальные и маппинга snake_case → camelCase
                const convertDatesInRecords = (records: any[]) => {
                    return records.map(record => {
                        const converted = {
                            ...record,
                            date: record.date ? convertUTCDateToLocal(record.date) : record.date,
                            unitType: record.unit_type || 'шт', // ← ИСПРАВЛЕНО: snake_case → camelCase
                            photoPath: record.photo_path // ← ДОБАВЛЕНО: маппинг photo_path → photoPath
                        };
                        console.log('🔄 [convertDatesInRecords] Маппинг записи:', {
                            original_unit_type: record.unit_type,
                            mapped_unitType: converted.unitType,
                            original_photo_path: record.photo_path,
                            mapped_photoPath: converted.photoPath,
                            name: record.name
                        });
                        return converted;
                    });
                };
                
                if (response.data && response.data[group_id]) {
                    const convertedData = convertDatesInRecords(response.data[group_id]);
                    console.log('📦 [getWriteOffs] Returning converted data from group_id key:', convertedData);
                    return { data: convertedData };
                }
                if (Array.isArray(response.data)) {
                    const convertedData = convertDatesInRecords(response.data);
                    console.log('📦 [getWriteOffs] Returning converted array data:', convertedData);
                    return { data: convertedData };
                }
                console.log('⚠️ [getWriteOffs] Returning empty array - unexpected data format');
                return { data: [] };
            })
            .catch((error: any) => {
                console.error('❌ [getWriteOffs] Error:', error);
                if (error.response?.status === 404) {
                    return { data: [] };
                }
                throw error;
            });
    },
    createWriteOff: (group_id: string, data: any) => {
        console.log('🔍 [createWriteOff] Исходные данные:', data);
        
        // Если есть фото, используем FormData
        if (data.photos && data.photos.length > 0) {
            const formData = new FormData();
            formData.append('name', data.name);
            formData.append('reason', typeof data.reason === 'string' ? data.reason : data.reason.id);
            formData.append('quantity', data.quantity.toString());
            formData.append('description', data.description || '');
            formData.append('unit_type', data.unitType || 'шт');
            formData.append('user_id', data.user_id.toString());
            
            if (data.date) {
                formData.append('date', data.date);
            }
            
            // Добавляем фото
            data.photos.forEach((photo: File, index: number) => {
                formData.append('photo', photo);
            });
            
            console.log('🚀 [createWriteOff] Отправляем FormData с фото:', {
                ...Object.fromEntries(formData.entries()),
                photosCount: data.photos.length
            });
            
            return axiosInstance.post(`/v1/write-offs/${group_id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }).then((response: AxiosResponse<any>) => {
                // Маппим photo_path → photoPath и unit_type → unitType
                const data = response.data;
                if (data.photo_path) {
                    data.photoPath = data.photo_path;
                }
                if (data.unit_type) {
                    data.unitType = data.unit_type;
                }
                return data;
            });
        } else {
            // Без фото - обычный JSON
            const payload = {
                name: data.name,
                reason: typeof data.reason === 'string' ? data.reason : data.reason.id,
                quantity: data.quantity,
                description: data.description || '',
                unit_type: data.unitType || 'шт',
                user_id: data.user_id,
                ...(data.date && { date: data.date }) // Добавляем date только если он определен
            };
            
            console.log('🔍 [createWriteOff] Проверка user_id:', {
                originalUserId: data.user_id,
                userIdType: typeof data.user_id,
                userIdInPayload: payload.user_id,
                isUserIdValid: payload.user_id !== undefined && payload.user_id !== null,
                dateValue: data.date,
                dateIncluded: !!data.date
            });
            
            console.log('🚀 [createWriteOff] Отправляем JSON без фото:', payload);
            return axiosInstance.post(`/v1/write-offs/${group_id}`, payload).then((response: AxiosResponse<any>) => {
                // Маппим photo_path → photoPath и unit_type → unitType
                const data = response.data;
                if (data.photo_path) {
                    data.photoPath = data.photo_path;
                }
                if (data.unit_type) {
                    data.unitType = data.unit_type;
                }
                return data;
            });
        }
    },
    updateWriteOff: (group_id: string, writeOffId: string, data: any) => {
        console.log('🔍 [updateWriteOff] Исходные данные:', data);
        
        // Если есть фото, используем FormData
        if (data.photos && data.photos.length > 0) {
            const formData = new FormData();
            formData.append('name', data.name);
            formData.append('reason', typeof data.reason === 'string' ? data.reason : data.reason.id);
            formData.append('quantity', data.quantity.toString());
            formData.append('description', data.description || '');
            formData.append('unit_type', data.unitType || 'шт');
            
            if (data.date) {
                formData.append('date', data.date);
            }
            
            // Добавляем фото
            data.photos.forEach((photo: File, index: number) => {
                formData.append('photo', photo);
            });
            
            console.log('🚀 [updateWriteOff] Отправляем FormData с фото:', {
                ...Object.fromEntries(formData.entries()),
                photosCount: data.photos.length
            });
            
            return axiosInstance.put(`/v1/write-offs/${group_id}/${writeOffId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }).then((response: AxiosResponse<any>) => {
                // Маппим photo_path → photoPath и unit_type → unitType
                const data = response.data;
                if (data.photo_path) {
                    data.photoPath = data.photo_path;
                }
                if (data.unit_type) {
                    data.unitType = data.unit_type;
                }
                return data;
            });
        } else {
            // Без фото - обычный JSON
            const payload = {
                name: data.name,
                reason: typeof data.reason === 'string' ? data.reason : data.reason.id,
                quantity: data.quantity,
                description: data.description || '',
                unit_type: data.unitType || 'шт',
                ...(data.date && { date: data.date }) // Добавляем date только если он определен
            };
            console.log('🚀 [updateWriteOff] Отправляем JSON без фото:', payload);
            return axiosInstance.put(`/v1/write-offs/${group_id}/${writeOffId}`, payload).then((response: AxiosResponse<any>) => {
                // Маппим photo_path → photoPath и unit_type → unitType
                const data = response.data;
                if (data.photo_path) {
                    data.photoPath = data.photo_path;
                }
                if (data.unit_type) {
                    data.unitType = data.unit_type;
                }
                return data;
            });
        }
    },
    
    deleteWriteOff: (group_id: string, writeOffId: string) => {
        return axiosInstance.delete(`/v1/write-offs/${group_id}/${writeOffId}`)
            .then((response: AxiosResponse<any>) => {
                return { success: true };
            });
    },
    sendWriteOffReport: (groupId: string) => {
        return axiosInstance.post(`/v1/write-offs/${groupId}/report`);
    },
    
    getInventoryTemplate: async (groupId: string): Promise<InventoryTemplateResponse> => {
        try {
            console.log('🔄 [WriteOffApi] Загрузка шаблона инвентаря для группы:', groupId);
            const response = await axiosInstance.get(`/v1/write-offs/${groupId}/inventory-template`);
            
            console.log('✅ [WriteOffApi] Шаблон загружен:', response.data);
            return {
                success: true,
                items: response.data.items || [],
                total_count: response.data.total_count || 0,
                categories: response.data.categories || []
            };
        } catch (error: any) {
            console.error('❌ [WriteOffApi] Ошибка загрузки шаблона:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message || 'Ошибка загрузки шаблона инвентаря'
            };
        }
    },
};