import { createAsyncThunk } from '@reduxjs/toolkit';

// Централизованная проверка прав администратора
export const checkAdminRights = createAsyncThunk(
    'admin/checkAdminRights',
    async ({ 
        userId, 
        chatId, 
        admins, 
        members,
        context = 'inventory' 
    }: {
        userId: number;
        chatId: string;
        admins: Array<{
            user_id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            status?: string;
        }>;
        members?: Array<{
            user_id: number;
            first_name: string;
            photo_url?: string;
        }>;
        context?: 'inventory' | 'writeoff' | 'events';
    }, { rejectWithValue }) => {
        try {
            console.log('🔍 Проверка прав администратора:', {
                userId,
                chatId,
                context,
                adminsCount: admins.length,
                membersCount: members?.length
            });

            // Находим данные администратора
            const adminData = admins.find(
                admin => Number(admin.user_id) === Number(userId)
            );

            if (adminData) {
                console.log('✅ Пользователь является администратором:', {
                    userId,
                    chatId,
                    adminStatus: adminData.status
                });
                
                // Убедимся, что status всегда определен
                const status = adminData.status || 'member';
                
                return {
                    isAdmin: true,
                    adminRights: {
                        status,
                        can_manage_chat: status === 'creator' || status === 'administrator'
                    },
                    photo_url: adminData.photo_url || null,
                    first_name: adminData.first_name
                };
            }

            // Если пользователь не админ, проверяем есть ли он в списке участников
            if (members) {
                const memberData = members.find(
                    member => Number(member.user_id) === Number(userId)
                );

                if (memberData) {
                    console.log('👤 Пользователь является участником чата:', {
                        userId,
                        chatId
                    });
                    
                    return {
                        isAdmin: false,
                        adminRights: null,
                        photo_url: memberData.photo_url || null,
                        first_name: memberData.first_name
                    };
                }
            }

            return rejectWithValue('Пользователь не найден в чате');
        } catch (error) {
            console.error('❌ Ошибка при проверке прав администратора:', error);
            return rejectWithValue('Ошибка при проверке прав администратора');
        }
    }
); 