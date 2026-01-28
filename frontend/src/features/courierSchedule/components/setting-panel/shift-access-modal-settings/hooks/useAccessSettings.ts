import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch } from '@shared/store/store';
import {  
    selectAccessSettings, 
    selectIsLoadingSettings, 
    selectSettingsError
} from '@features/courierSchedule/store/shiftsSlice/shiftsSelectors';
import { addNotification} from '@shared/store/notificationSlice/notificationSlice';
import { AccessSettings } from '@/features/courierSchedule/types/courierScheduleTypes';
import { fetchAccessSettings } from '@/features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { updateAccessSettings } from '@features/courierSchedule/store/shiftsSlice/shiftsThunks';
import { NotificationTypes } from '@/shared/store/notificationSlice/notificationTypes';
interface UseAccessSettingsProps {
    chatId?: string;
}



export const useAccessSettings = ({ chatId }: UseAccessSettingsProps) => {
    const dispatch = useDispatch<AppDispatch>();
    // Получаем ТОЛЬКО настройки доступа из Redux
    const storedSettings = useSelector(selectAccessSettings);
    const isLoading = useSelector(selectIsLoadingSettings);
    const error = useSelector(selectSettingsError);

    // Локальное состояние для редактирования НАСТРОЕК ДОСТУПА
    const [settings, setSettings] = useState<AccessSettings | null>(storedSettings);
    const [isDirty, setIsDirty] = useState(false);

    // Загружаем настройки при монтировании или изменении chatId
    useEffect(() => {
        if (chatId) {
            // Загрузка настроек для chatId: ${chatId}`);
            dispatch(fetchAccessSettings({ chatId }));
        } else {
             // warn('[useAccessSettings] chatId не определен, настройки не загружены.');
        }
    }, [dispatch, chatId]);

    // Обновляем локальное состояние при изменении данных из Redux
    useEffect(() => {
        // debug('[useAccessSettings] Синхронизация локальных настроек с Redux:', storedSettings);
        setSettings(storedSettings);
    }, [storedSettings]);
    
    // Обработчик изменения настроек в UI
    const handleSettingsChange = useCallback((updatedValues: Partial<AccessSettings>) => {
        setSettings(prevSettings => {
            const current = prevSettings ?? {}; 
            const newSettings = { ...current, ...updatedValues };
            setIsDirty(true);
            // debug('[useAccessSettings] Local settings changed:', newSettings);
            return newSettings as AccessSettings; // Утверждаем тип, т.к. при изменении он не должен быть null
        });
    }, []);

    // Сохранение настроек ДОСТУПА на сервере
    const saveSettings = useCallback(async (customSettings?: AccessSettings) => {
        // log(`[useAccessSettings saveSettings] Попытка сохранения. Текущий chatId: ${chatId}`);
        
        const settingsToSave = customSettings || settings;

        if (!chatId) {
            // error('❌ Ошибка: chatId не определен при попытке сохранения настроек.');
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Ошибка: Не удалось определить ID чата.' }));
            return { success: false }; 
        }
        
        // Проверяем, есть ли локальные настройки для сохранения
        if (!settingsToSave) {
             // error('❌ Ошибка: Локальные настройки отсутствуют (null).');
             dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Ошибка: Нет данных для сохранения.' }));
             return { success: false };
        }

        console.log('[useAccessSettings] Сохранение настроек:', settingsToSave);

        try {
            const result = await dispatch(updateAccessSettings({ chatId, settings: { ...settingsToSave } })).unwrap();
            
            console.log('[useAccessSettings] Результат сохранения:', result);
            
            // Проверяем наличие конфликта (существующих смен)
            if (result?.hasExistingShifts) {
                // Не показываем уведомление об успехе, вернём данные для модалки
                setIsDirty(false);
                return { 
                    success: true, 
                    hasConflict: true,
                    existingShiftsCount: result.existingShiftsCount || 0,
                    data: result
                };
            }
            
            dispatch(addNotification({ type: NotificationTypes.SUCCESS, message: 'Настройки доступа успешно сохранены' }));
            setIsDirty(false);
            return { success: true, hasConflict: false, data: result };
        } catch (error) {
            // error('❌ Ошибка при сохранении настроек доступа:', error);
            const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'Неизвестная ошибка');
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: errorMessage }));
            return { success: false };
        }
    }, [dispatch, settings, chatId]);
    
    // Сброс настроек к значениям из Redux
    const resetSettings = useCallback(() => {
        // debug('[useAccessSettings] Сброс локальных настроек к значениям из Redux.');
        setSettings(storedSettings);
        setIsDirty(false);
    }, [storedSettings]);

    return {
        settings,
        isLoading,
        error,
        isDirty,
        handleSettingsChange,
        saveSettings,
        resetSettings
    };
}; 