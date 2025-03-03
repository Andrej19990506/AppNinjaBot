import adminReducer, { setAdminPhoto, setError, clearError } from './adminSlice';

interface AdminState {
    adminPhotos: Record<number, string>;
    error: string | null;
}

describe('admin reducer', () => {
    const initialState: AdminState = {
        adminPhotos: {},
        error: null
    };

    it('should handle initial state', () => {
        expect(adminReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should not change state for unknown action', () => {
        const state: AdminState = {
            adminPhotos: { 123: 'test.jpg' },
            error: 'test error'
        };
        expect(adminReducer(state, { type: 'unknown' })).toEqual(state);
    });

    it('should handle setAdminPhoto', () => {
        const previousState: AdminState = {
            adminPhotos: {},
            error: null
        };
        const payload = {
            userId: 123,
            photoData: 'test.jpg'
        };
        expect(adminReducer(previousState, setAdminPhoto(payload))).toEqual({
            adminPhotos: { 123: 'test.jpg' },
            error: null
        });
    });

    it('should handle setError', () => {
        const previousState: AdminState = {
            adminPhotos: {},
            error: null
        };
        expect(adminReducer(previousState, setError('test error'))).toEqual({
            adminPhotos: {},
            error: 'test error'
        });
    });

    it('should handle clearError', () => {
        const previousState: AdminState = {
            adminPhotos: {},
            error: 'test error'
        };
        expect(adminReducer(previousState, clearError())).toEqual({
            adminPhotos: {},
            error: null
        });
    });

    it('should not modify adminPhotos when setting error', () => {
        const previousState: AdminState = {
            adminPhotos: { 123: 'test.jpg' },
            error: null
        };
        expect(adminReducer(previousState, setError('test error'))).toEqual({
            adminPhotos: { 123: 'test.jpg' },
            error: 'test error'
        });
    });

    it('should not modify error when setting admin photo', () => {
        const previousState: AdminState = {
            adminPhotos: {},
            error: 'test error'
        };
        const payload = {
            userId: 123,
            photoData: 'test.jpg'
        };
        expect(adminReducer(previousState, setAdminPhoto(payload))).toEqual({
            adminPhotos: { 123: 'test.jpg' },
            error: 'test error'
        });
    });

    it('should handle multiple admin photos', () => {
        let state: AdminState = {
            adminPhotos: {},
            error: null
        };

        // Добавляем первое фото
        state = adminReducer(state, setAdminPhoto({
            userId: 123,
            photoData: 'test1.jpg'
        }));

        // Добавляем второе фото
        state = adminReducer(state, setAdminPhoto({
            userId: 456,
            photoData: 'test2.jpg'
        }));

        // Обновляем первое фото
        state = adminReducer(state, setAdminPhoto({
            userId: 123,
            photoData: 'test3.jpg'
        }));

        expect(state).toEqual({
            adminPhotos: {
                123: 'test3.jpg',
                456: 'test2.jpg'
            },
            error: null
        });
    });

    it('should handle async action without modifying state', () => {
        const state: AdminState = {
            adminPhotos: { 123: 'test.jpg' },
            error: 'test error'
        };

        // Проверяем, что асинхронные экшены не меняют состояние
        expect(adminReducer(state, {
            type: 'inventory/initializeFromTelegram/fulfilled',
            payload: 1682142222,
            meta: {
                requestId: '_xtbG2fefXsoPOJiB1EcG',
                requestStatus: 'fulfilled'
            }
        })).toEqual(state);

        expect(adminReducer(state, {
            type: 'inventory/fetchInventory/pending',
            meta: {
                requestId: 'hX1U_iB1J7h17Am3PVxms',
                requestStatus: 'pending'
            }
        })).toEqual(state);
    });
}); 