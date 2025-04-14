import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch } from '../../../../store/store';
import { 
    AccessSettings, 
    selectAccessSettings, 
    selectIsLoadingSettings, 
    selectSettingsError,
    updateAccessRules,
    fetchAccessSettings
} from '../../../../store/slices/shiftsSlice';
import { addNotification, NotificationTypes } from '../../../../store/slices/notificationSlice';
import { logger } from '../../../../utils/logger';

interface UseAccessSettingsProps {
    chatId?: string;
}

/**
 * Хук для управления настройками ДОСТУПА к сменам (НЕ СЛОТАМИ)
 */
export const useAccessSettings = ({ chatId }: UseAccessSettingsProps) => {
    logger.log(`[useAccessSettings] Хук инициализирован/обновлен с chatId: ${chatId}`);

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
            logger.log(`[useAccessSettings] Загрузка настроек для chatId: ${chatId}`);
            dispatch(fetchAccessSettings({ chatId }));
        } else {
             logger.warn('[useAccessSettings] chatId не определен, настройки не загружены.');
        }
    }, [dispatch, chatId]);

    // Обновляем локальное состояние при изменении данных из Redux
    useEffect(() => {
        logger.debug('[useAccessSettings] Синхронизация локальных настроек с Redux:', storedSettings);
        setSettings(storedSettings);
        // Сбрасываем isDirty при получении новых данных из стора
        // setIsDirty(false); // Возможно, это нужно, чтобы отменить несохраненные изменения? Или нет?
    }, [storedSettings]);
    
    // Обработчик изменения настроек в UI
    const handleSettingsChange = useCallback((updatedValues: Partial<AccessSettings>) => {
        setSettings(prevSettings => {
            // Обрабатываем случай, когда prevSettings может быть null
            const current = prevSettings ?? {}; 
            const newSettings = { ...current, ...updatedValues };
            setIsDirty(true);
            logger.debug('[useAccessSettings] Local settings changed:', newSettings);
            return newSettings as AccessSettings; // Утверждаем тип, т.к. при изменении он не должен быть null
        });
    }, []);

    // Сохранение настроек ДОСТУПА на сервере
    const saveSettings = useCallback(async () => {
        logger.log(`[useAccessSettings saveSettings] Попытка сохранения. Текущий chatId: ${chatId}`);

        if (!chatId) {
            logger.error('❌ Ошибка: chatId не определен при попытке сохранения настроек.');
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Ошибка: Не удалось определить ID чата.' }));
            return false; 
        }
        
        // Проверяем, есть ли локальные настройки для сохранения
        if (!settings) {
             logger.error('❌ Ошибка: Локальные настройки отсутствуют (null).');
             dispatch(addNotification({ type: NotificationTypes.ERROR, message: 'Ошибка: Нет данных для сохранения.' }));
             return false;
        }

        try {
             logger.log('📝 Настройки доступа для отправки:', settings);
            // <<< Диспатчим НОВЫЙ thunk updateAccessRules >>>
            // Передаем chat_id и остальные настройки
            await dispatch(updateAccessRules({ chat_id: chatId, ...settings })).unwrap();
            
            dispatch(addNotification({ type: NotificationTypes.SUCCESS, message: 'Настройки доступа успешно сохранены' }));
            setIsDirty(false);
            return true;
        } catch (error) {
            logger.error('❌ Ошибка при сохранении настроек доступа:', error);
            const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'Неизвестная ошибка');
            dispatch(addNotification({ type: NotificationTypes.ERROR, message: errorMessage }));
            return false;
        }
    }, [dispatch, settings, chatId]);
    
    // Сброс настроек к значениям из Redux
    const resetSettings = useCallback(() => {
        logger.debug('[useAccessSettings] Сброс локальных настроек к значениям из Redux.');
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