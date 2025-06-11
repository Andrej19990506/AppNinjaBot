import { axiosInstance } from '@/shared/api/api';
import { socketService } from '@/shared/services/socketService';
import { AxiosResponse } from 'axios';

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
    getWriteOffs: (group_id: string) => {
        return axiosInstance.get(`/v1/write-offs/${group_id}`, {
            params: {
                _t: Date.now()
            }
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
                    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                });
                
                if (response.data && response.data[group_id]) {
                    console.log('📦 [getWriteOffs] Returning data from group_id key:', response.data[group_id]);
                    return { data: response.data[group_id] };
                }
                if (Array.isArray(response.data)) {
                    console.log('📦 [getWriteOffs] Returning array data:', response.data);
                    return { data: response.data };
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
        return axiosInstance.post(`/v1/write-offs/${group_id}`, {
            name: data.name,
            reason: typeof data.reason === 'string' ? data.reason : data.reason.id,
            quantity: data.quantity,
            description: data.description || '',
            unitType: data.unitType || 'шт',
            user_id: data.user_id
        }).then((response: AxiosResponse<any>) => response.data);
    },
    updateWriteOff: (group_id: string, writeOffId: string, data: any) => {
        if (socketService.isConnected()) {
            return new Promise((resolve, reject) => {
                let isResolved = false;
                const successHandler = (response: any) => {
                    if (isResolved) return;
                    isResolved = true;
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    resolve(response.writeOffItem);
                };
                const errorHandler = (error: any) => {
                    if (isResolved) return;
                    isResolved = true;
                    socketService.unsubscribe('writeoff_update_sent');
                    socketService.unsubscribe('writeoff_update_error');
                    reject(error);
                };
                socketService.subscribe('writeoff_update_sent', successHandler);
                socketService.subscribe('writeoff_update_error', errorHandler);
                emitSocketEvent('writeoff_update', {
                    action: 'update',
                    group_id: group_id,
                    writeOffId: writeOffId,
                    writeOffItem: {
                        name: data.name,
                        reason: data.reason,
                        quantity: data.quantity,
                        description: data.description || '',
                        unitType: data.unitType || 'шт'
                    }
                }).then((success: boolean) => {
                    if (!success && !isResolved) {
                        isResolved = true;
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        fallbackToREST();
                    }
                }).catch(() => {
                    if (!isResolved) {
                        isResolved = true;
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        fallbackToREST();
                    }
                });
                const fallbackToREST = () => {
                    axiosInstance.put(`/v1/write-offs/${group_id}/${writeOffId}`, {
                        name: data.name,
                        reason: data.reason,
                        quantity: data.quantity,
                        description: data.description || '',
                        unitType: data.unitType || 'шт'
                    }).then((response: AxiosResponse<any>) => {
                        resolve(response.data);
                    }).catch((error: any) => {
                        reject(error);
                    });
                };
                setTimeout(() => {
                    if (!isResolved) {
                        isResolved = true;
                        socketService.unsubscribe('writeoff_update_sent');
                        socketService.unsubscribe('writeoff_update_error');
                        fallbackToREST();
                    }
                }, 10000);
            });
        } else {
            return axiosInstance.put(`/v1/write-offs/${group_id}/${writeOffId}`, {
                name: data.name,
                reason: data.reason,
                quantity: data.quantity,
                description: data.description || '',
                unitType: data.unitType || 'шт'
            }).then((response: AxiosResponse<any>) => response.data);
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
};