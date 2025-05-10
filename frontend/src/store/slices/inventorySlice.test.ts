import inventoryReducer, { initializeFromTelegram } from './inventorySlice';
import { InventoryState, ChatInventory, Admin, Inventory } from '../../types/inventory';
import { WebApp } from '../../types/telegram';

describe('inventorySlice', () => {
    const initialState: InventoryState = {
        items: [],
        isLoading: false,
        error: null,
        selectedChatId: null,
        selectedChat: null,
        currentUser: {
            id: null,
            isAdmin: false,
            adminRights: null,
            photo_url: null,
            first_name: null
        }
    };

    const mockAdmin: Admin = {
        user_id: 1,
        username: 'admin',
        first_name: 'Admin',
        last_name: null,
        status: 'creator',
        is_bot: false,
        can_manage_chat: true,
        can_delete_messages: true,
        can_manage_voice_chats: true,
        can_restrict_members: true,
        can_promote_members: true,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true,
        photo_url: 'test.jpg'
    };

    const mockInventory: Inventory = {
        items: {},
        categories: {}
    };

    const chatData: ChatInventory[] = [
        {
            chat_id: '123',
            chat_title: 'Test Chat',
            admins: [mockAdmin],
            members: [],
            members_count: 0,
            inventory: mockInventory,
            metadata: {
                chat_id: '123',
                progress: 0,
                lastUpdated: new Date().toISOString()
            }
        }
    ];

    const stateWithUser: InventoryState = {
        ...initialState,
        currentUser: {
            id: 1,
            isAdmin: false,
            adminRights: null,
            photo_url: null,
            first_name: 'Test User'
        }
    };

    beforeEach(() => {
        // Очищаем моки перед каждым тестом
        window.Telegram = undefined;
    });

    it('should handle initial state', () => {
        expect(inventoryReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should initialize from Telegram WebApp', async () => {
        // Мокаем Telegram WebApp
        window.Telegram = {
            WebApp: {
                initDataUnsafe: {
                    user: {
                        id: 1682142222,
                        first_name: 'Test User'
                    }
                }
            } as WebApp
        };

        const state = inventoryReducer(initialState, {
            type: initializeFromTelegram.fulfilled.type,
            payload: 1682142222
        });

        expect(state.currentUser.id).toBe(1682142222);
    });

    it('should update admin rights after fetching inventory', () => {
        // Начальное состояние с установленным ID пользователя
        const stateWithUser: InventoryState = {
            ...initialState,
            currentUser: {
                id: 1682142222,
                isAdmin: false,
                adminRights: null,
                photo_url: null,
                first_name: 'Test User'
            }
        };

        // Тестовые данные чатов
        const chatData = [{
            admins: [{
                can_change_info: true,
                can_delete_messages: true,
                can_invite_users: true,
                can_manage_chat: true,
                can_manage_voice_chats: true,
                can_pin_messages: true,
                can_promote_members: true,
                can_restrict_members: true,
                first_name: 'andrej',
                is_bot: false,
                last_name: 'malahow',
                photo_url: 'https://example.com/photo.jpg',
                status: 'creator',
                user_id: 1682142222,
                username: 'andrejnikolaevich1999'
            }],
            chat_id: '4715475833',
            chat_title: 'Тестовый чат',
            inventory: mockInventory,
            members: [],
            members_count: 0,
            metadata: {
                chat_id: '4715475833',
                lastUpdated: '2025-02-24T15:14:39.519379',
                progress: 0
            }
        }];

        // Вызываем fetchInventory.fulfilled
        const state = inventoryReducer(stateWithUser, {
            type: 'inventory/fetchInventory/fulfilled',
            payload: chatData
        });

        // Проверяем что права администратора обновились
        expect(state.currentUser.isAdmin).toBe(true);
        expect(state.currentUser.adminRights).toBeDefined();
        expect(state.currentUser.adminRights?.status).toBe('creator');
    });

    it('should not update admin rights if user is not admin', () => {
        // Начальное состояние с установленным ID пользователя
        const stateWithUser: InventoryState = {
            ...initialState,
            currentUser: {
                id: 99999,
                isAdmin: false,
                adminRights: null,
                photo_url: null,
                first_name: 'Test User'
            }
        };

        // Тестовые данные чатов
        const chatData = [{
            admins: [{
                user_id: 1682142222,
                username: 'admin',
                first_name: 'Admin',
                last_name: null,
                status: 'creator',
                is_bot: false,
                can_manage_chat: true,
                can_delete_messages: true,
                can_manage_voice_chats: true,
                can_restrict_members: true,
                can_promote_members: true,
                can_change_info: true,
                can_invite_users: true,
                can_pin_messages: true,
                photo_url: 'test.jpg'
            }],
            chat_id: '4715475833',
            chat_title: 'Тестовый чат',
            inventory: mockInventory,
            members: [],
            members_count: 0,
            metadata: {
                chat_id: '4715475833',
                lastUpdated: '2025-02-24T15:14:39.519379',
                progress: 0
            }
        }];

        // Вызываем fetchInventory.fulfilled
        const state = inventoryReducer(stateWithUser, {
            type: 'inventory/fetchInventory/fulfilled',
            payload: chatData
        });

        // Проверяем что права администратора не изменились
        expect(state.currentUser.isAdmin).toBe(false);
        expect(state.currentUser.adminRights).toBeNull();
    });

    it('should handle Telegram WebApp not available', async () => {
        window.Telegram = undefined;

        const state = inventoryReducer(initialState, {
            type: initializeFromTelegram.rejected.type,
            error: { message: 'Telegram WebApp user data not available' }
        });

        expect(state.error).toBe('Failed to initialize user from Telegram');
    });
}); 